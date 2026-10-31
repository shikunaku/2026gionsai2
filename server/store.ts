import { DeviceInfo, DevicePhase, DeviceRole, ElevatorFloorState, ElevatorStatePayload, EquipmentItem, PhotoSubmission } from '../src/lib/types';
import { persistence } from './persistence';

export class AppStore {
  private static instance: AppStore;

  private devices = new Map<string, DeviceInfo>();
  private submissions: PhotoSubmission[] = [];
  private equipments: EquipmentItem[] = [];
  private currentElevatorState: ElevatorStatePayload = { floor: 'FLOOR_1' };
  // 10-second deduplication map: key = `${deviceId}:${taskId}` => timestamp
  private recentSubmissions = new Map<string, number>();

  private constructor() {
    this.equipments = persistence.loadEquipments();
    this.submissions = persistence
      .loadSubmissions()
      .slice(0, 100)
      .map((submission) => ({
        ...submission,
        imageBase64: submission.imageUrl,
      }));
  }

  public static getInstance(): AppStore {
    if (!AppStore.instance) {
      AppStore.instance = new AppStore();
    }
    return AppStore.instance;
  }

  public getElevatorState(): ElevatorStatePayload {
    return this.currentElevatorState;
  }

  public setElevatorState(state: ElevatorStatePayload): void {
    this.currentElevatorState = { ...state };
  }

  public registerDevice(
    deviceId: string,
    socketId: string,
    phase: DevicePhase = 'STANDBY',
    location?: string,
    role?: DeviceRole
  ): DeviceInfo {
    const existing = this.devices.get(deviceId);
    const device: DeviceInfo = {
      deviceId,
      socketId,
      phase: existing ? existing.phase : phase,
      role: role || (existing ? existing.role : 'client'),
      location: location || (existing ? existing.location : undefined),
      batteryLevel: existing ? existing.batteryLevel : 100,
      charging: existing ? existing.charging : false,
      flashState: existing ? existing.flashState : false,
      lastSeen: Date.now(),
    };
    this.devices.set(deviceId, device);
    return device;
  }

  public getSoundNodes(): DeviceInfo[] {
    return Array.from(this.devices.values()).filter((d) => d.role === 'sound_node');
  }

  public getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId);
  }

  public getDeviceBySocketId(socketId: string): DeviceInfo | undefined {
    for (const dev of this.devices.values()) {
      if (dev.socketId === socketId) return dev;
    }
    return undefined;
  }

  public updateDevice(deviceId: string, updates: Partial<DeviceInfo>): DeviceInfo | undefined {
    const dev = this.devices.get(deviceId);
    if (!dev) return undefined;
    const updated = { ...dev, ...updates, lastSeen: Date.now() };
    this.devices.set(deviceId, updated);
    return updated;
  }

  public removeDeviceBySocketId(socketId: string): DeviceInfo | undefined {
    for (const [id, dev] of this.devices.entries()) {
      if (dev.socketId === socketId) {
        // We can keep device record but mark lastSeen or remove
        // For accurate real-time monitor, we retain but can detect stale, or remove.
        // Let's keep it with updated socketId = '' so admin can still see it or clean up.
        dev.socketId = '';
        return dev;
      }
    }
    return undefined;
  }

  public getAllDevices(): DeviceInfo[] {
    const rolePriority: Record<string, number> = {
      client: 1,
      sound_node: 2,
      elevator_display: 3,
    };

    return Array.from(this.devices.values()).sort((a, b) => {
      // 1. 接続状態: オンラインを常に先頭、オフラインは末尾
      const aOnline = a.socketId ? 1 : 0;
      const bOnline = b.socketId ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;

      // 2. ロール順 (PDA -> 音響 -> 昇降)
      const aPriority = rolePriority[a.role || 'client'] || 99;
      const bPriority = rolePriority[b.role || 'client'] || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // 3. 端末IDの自然昇順ソート (端末入れ替わり防止)
      return a.deviceId.localeCompare(b.deviceId, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  // Submission management with 10s debounce
  public addSubmission(
    deviceId: string,
    taskId: number,
    taskTitle: string,
    imageUrl: string
  ): { submission?: PhotoSubmission; evicted?: PhotoSubmission; deduped: boolean } {
    const dedupKey = `${deviceId}:${taskId}`;
    const now = Date.now();
    const lastTime = this.recentSubmissions.get(dedupKey);

    if (lastTime && now - lastTime < 10000) {
      console.log(`[Store] Duplicate submission rejected for ${dedupKey} within 10s`);
      return { deduped: true };
    }

    this.recentSubmissions.set(dedupKey, now);

    const submission: PhotoSubmission = {
      id: `sub_${now}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId,
      taskId,
      taskTitle,
      imageUrl,
      thumbnailUrl: imageUrl,
      imageBase64: imageUrl,
      timestamp: now,
      status: 'PENDING',
    };

    // Prepend so latest appears first
    this.submissions.unshift(submission);

    // Limit to latest 100 submissions in memory
    const evicted = this.submissions.length > 100 ? this.submissions.pop() : undefined;
    persistence.saveSubmissions(this.submissions);

    return { submission, evicted, deduped: false };
  }

  public recoverSubmission(imageUrl: string, timestamp: number): PhotoSubmission | undefined {
    if (this.submissions.some((submission) => submission.imageUrl === imageUrl)) return undefined;

    const submission: PhotoSubmission = {
      id: `recovered_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId: 'RECOVERED',
      taskId: 0,
      taskTitle: '再起動前に保存された写真',
      imageUrl,
      thumbnailUrl: imageUrl,
      imageBase64: imageUrl,
      timestamp,
      status: 'PENDING',
    };
    this.submissions.push(submission);
    this.submissions.sort((a, b) => b.timestamp - a.timestamp);
    if (this.submissions.length > 100) this.submissions.pop();
    persistence.saveSubmissions(this.submissions);
    return submission;
  }

  public getSubmissions(): PhotoSubmission[] {
    return this.submissions;
  }

  public updateSubmissionStatus(
    submissionId: string,
    status: 'APPROVED' | 'REJECTED',
    reason?: string
  ): PhotoSubmission | undefined {
    const sub = this.submissions.find((s) => s.id === submissionId);
    if (sub) {
      sub.status = status;
      sub.reason = reason;
      // If rejected, allow client to resend by clearing deduplication entry
      if (status === 'REJECTED') {
        const dedupKey = `${sub.deviceId}:${sub.taskId}`;
        this.recentSubmissions.delete(dedupKey);
      }
      persistence.saveSubmissions(this.submissions);
    }
    return sub;
  }

  public clearDeviceSubmissions(deviceId: string): PhotoSubmission[] {
    console.log(`[Store] Clearing photo submissions and debounce cache for device: ${deviceId}`);
    const removed = this.submissions.filter((s) => s.deviceId === deviceId);
    this.submissions = this.submissions.filter((s) => s.deviceId !== deviceId);
    for (const key of Array.from(this.recentSubmissions.keys())) {
      if (key.startsWith(`${deviceId}:`)) {
        this.recentSubmissions.delete(key);
      }
    }
    persistence.saveSubmissions(this.submissions);
    return removed;
  }

  public clearAllSubmissions(): PhotoSubmission[] {
    console.log('[Store] Clearing all photo submissions and debounce cache');
    const removed = this.submissions;
    this.submissions = [];
    this.recentSubmissions.clear();
    persistence.saveSubmissions(this.submissions);
    return removed;
  }

  // Equipments management
  public getEquipments(): EquipmentItem[] {
    return this.equipments;
  }

  public addEquipment(item: Omit<EquipmentItem, 'updatedAt'>): EquipmentItem {
    const existingIndex = this.equipments.findIndex((e) => e.id === item.id);
    const newItem: EquipmentItem = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      this.equipments[existingIndex] = newItem;
    } else {
      this.equipments.push(newItem);
    }
    persistence.saveEquipments(this.equipments);
    return newItem;
  }

  public removeEquipment(id: string): boolean {
    const initialLen = this.equipments.length;
    this.equipments = this.equipments.filter((e) => e.id !== id);
    if (this.equipments.length !== initialLen) {
      persistence.saveEquipments(this.equipments);
      return true;
    }
    return false;
  }

  public updateEquipmentState(id: string, value: any): EquipmentItem | undefined {
    const item = this.equipments.find((e) => e.id === id);
    if (item) {
      item.state = value;
      item.updatedAt = new Date().toISOString();
      persistence.saveEquipments(this.equipments);
    }
    return item;
  }
}

export const store = AppStore.getInstance();
