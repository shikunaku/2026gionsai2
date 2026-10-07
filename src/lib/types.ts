export type DevicePhase = 'INIT' | 'ZONE1' | 'ZONE2' | 'END';

declare global {
  interface Navigator {
    getBattery?: () => Promise<any>;
  }
  interface Window {
    Android?: {
      turnOnFlash?: () => void;
      turnOffFlash?: () => void;
      toggleFlash?: () => void;
      getBatteryLevel?: () => number;
    };
  }
}

export type ReviewStatus = 'SUBMITTING' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DeviceInfo {
  deviceId: string;
  socketId: string;
  phase: DevicePhase;
  location?: string;
  batteryLevel: number | string;
  charging: boolean;
  flashState: boolean;
  lastSeen: number;
}

export interface PhotoSubmission {
  id: string;
  deviceId: string;
  taskId: number;
  taskTitle: string;
  imageBase64: string;
  timestamp: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface InspectionTask {
  id: number;
  title: string;
  location: string;
  targetDescription: string;
  status: ReviewStatus;
  rejectionReason?: string;
}

export interface GlitchEffectOptions {
  level: number;
  duration: number;
  vibrate?: boolean;
  mode?: 'violent' | 'creepy' | 'invert' | 'blackout' | 'redout' | 'static';
}

export interface TorchEffectOptions {
  state?: boolean;
  flicker?: boolean;
  count?: number;
  intervalMs?: number;
  pattern?: string;
  stop?: boolean;
}

export interface SoundEffectOptions {
  soundType: 'beep' | 'shutter' | 'lowImpact' | 'geiger' | 'drone' | 'motor' | 'powerDown' | 'taskSuccess';
  level?: number;
}

export type EquipmentProtocol = 'serial' | 'wifi' | 'ble';

export interface EquipmentItem {
  id: string;
  name: string;
  type: 'relay' | 'servo' | 'light' | 'fan' | 'custom';
  state: boolean | number | string;
  topic?: string;
  mcuId?: string;       // マイコンID (例: ESP32_MAIN, ESP32_ZONE2, ARDUINO_01)
  protocol?: EquipmentProtocol; // 通信方式 (有線シリアル / Wi-Fi / Bluetooth)
  endpoint?: string;    // COMポート名 / IPアドレス / BLEサービスUUID
  updatedAt: string;
}

export interface ServerToClientEvents {
  'phase:update': (payload: { phase: DevicePhase; deviceId?: string }) => void;
  'task:review_result': (payload: {
    submissionId: string;
    taskId: number;
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) => void;
  'effect:glitch': (payload: GlitchEffectOptions) => void;
  'effect:torch': (payload: TorchEffectOptions) => void;
  'effect:sound': (payload: SoundEffectOptions) => void;
  'effect:volume': (payload: { volume: number }) => void;
  'effect:shutdown': () => void;
  'admin:state_sync': (payload: {
    devices: DeviceInfo[];
    submissions: PhotoSubmission[];
    equipments: EquipmentItem[];
  }) => void;
  'equipment:init': (equipments: EquipmentItem[]) => void;
  'equipment:updated': (equipment: EquipmentItem) => void;
  'equipment:removed': (payload: { id: string }) => void;
}

export interface ClientToServerEvents {
  'device:ready': (payload: { deviceId: string; phase: DevicePhase; location?: string }) => void;
  'device:start_inspection': (payload: { deviceId: string }) => void;
  'device:battery_update': (payload: {
    deviceId: string;
    batteryLevel: number | string;
    charging: boolean;
  }) => void;
  'device:flash_state': (payload: { deviceId: string; flashState: boolean }) => void;
  'task:photo_submit': (payload: {
    deviceId: string;
    taskId: number;
    taskTitle: string;
    imageBase64: string;
  }) => void;
  'machine:control': (payload: { machineId: string; state: boolean; deviceId: string }) => void;
  'admin:join': () => void;
  'admin:get_state': () => void;
  'admin:review_photo': (payload: {
    submissionId: string;
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) => void;
  'admin:override_phase': (payload: { targetDeviceId?: string; phase: DevicePhase }) => void;
  'admin:trigger_effect': (payload: {
    targetDeviceId?: string;
    effectType: 'glitch' | 'torch' | 'sound' | 'volume' | 'shutdown';
    options: any;
  }) => void;
  'admin:emergency_all_light': () => void;
  'equipment:get_all': () => void;
  'equipment:add': (equipment: Omit<EquipmentItem, 'updatedAt'>) => void;
  'equipment:remove': (payload: { id: string }) => void;
  'equipment:control': (payload: { id: string; action: string; value: any }) => void;
}
