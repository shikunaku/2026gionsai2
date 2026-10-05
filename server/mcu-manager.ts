import { store } from './store';

export interface McuMessage {
  protocol: 'wifi' | 'serial' | 'ble';
  topic: string;
  payload: any;
  timestamp: number;
}

export class McuManager {
  private static instance: McuManager;
  private messageLog: McuMessage[] = [];

  private constructor() {
    console.log('[McuManager] Hardware & MCU integration bridge initialized.');
  }

  public static getInstance(): McuManager {
    if (!McuManager.instance) {
      McuManager.instance = new McuManager();
    }
    return McuManager.instance;
  }

  public dispatchCommand(topic: string, payload: any, protocol: 'wifi' | 'serial' | 'ble' = 'wifi'): void {
    const msg: McuMessage = {
      protocol,
      topic,
      payload,
      timestamp: Date.now(),
    };
    this.messageLog.unshift(msg);
    if (this.messageLog.length > 50) this.messageLog.pop();

    console.log(`[McuManager] DISPATCH -> [${protocol.toUpperCase()}] ${topic} :`, JSON.stringify(payload));
  }

  public handleMachineControl(machineId: string, state: boolean): void {
    // Look up equipment
    const equipments = store.getEquipments();
    const item = equipments.find((e) => e.id === machineId || e.topic?.includes(machineId));
    const topic = item?.topic || `mcu/machine/${machineId}/control`;

    store.updateEquipmentState(machineId, state);
    this.dispatchCommand(topic, { state, power: state ? 1 : 0 });
  }

  public handleEmergencyAllLight(): void {
    console.log('[McuManager] EMERGENCY ALL LIGHT TRIGGERED! Activating all relays & beacons.');
    this.dispatchCommand('mcu/alarm/light', { state: true, power: 1 });
    this.dispatchCommand('mcu/relays/all', { state: true, power: 1 });
  }

  public getRecentLogs(): McuMessage[] {
    return this.messageLog;
  }
}

export const mcuManager = McuManager.getInstance();
