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

    // Optional serial communication (if serial port instance or bridge configured)
    this.sendSerialLine(JSON.stringify({ topic, ...payload }));
  }

  private sendSerialLine(line: string): void {
    // If USB Serial is enabled, it sends directly through serial port
    // Placeholder hook for seamless USB Serial integration
  }

  public handleMachineControl(machineId: string, state: boolean): void {
    // Look up equipment
    const equipments = store.getEquipments();
    const item = equipments.find((e) => e.id === machineId || e.topic?.includes(machineId));
    const topic = item?.topic || `mcu/machine/${machineId}/control`;
    const protocol = item?.protocol || 'serial';
    const mcuId = item?.mcuId || 'ESP32_MAIN';
    const endpoint = item?.endpoint || '';

    store.updateEquipmentState(machineId, state);

    // Format action for MCU firmware
    let action = 'custom';
    if (machineId.includes('conveyor') || topic.includes('conveyor')) action = 'conveyor';
    else if (machineId.includes('valve') || topic.includes('valve')) action = 'valve';
    else if (machineId.includes('light') || topic.includes('light')) action = 'light';
    else if (machineId.includes('fan') || topic.includes('fan')) action = 'fan';

    this.dispatchCommand(
      topic,
      {
        mcuId,
        endpoint,
        action,
        state,
        power: state ? 1 : 0,
      },
      protocol
    );
  }

  public handleEmergencyAllLight(): void {
    console.log('[McuManager] EMERGENCY ALL LIGHT TRIGGERED! Activating all relays & beacons.');
    this.dispatchCommand('mcu/alarm/light', { action: 'emergency', state: true, power: 1 });
    this.dispatchCommand('mcu/relays/all', { action: 'emergency', state: true, power: 1 });
  }

  public handleElevatorMove(targetFloor: 'FLOOR_1' | 'FLOOR_B1' | 'MOVING'): void {
    console.log(`[McuManager] ELEVATOR MOVE TRIGGERED -> ${targetFloor}`);
    // Dispatch elevator motor / relay command to ESP32
    this.dispatchCommand('mcu/elevator/motor', {
      action: 'elevator',
      floor: targetFloor,
      state: targetFloor === 'MOVING' || targetFloor === 'FLOOR_B1',
      power: targetFloor === 'MOVING' ? 1 : 0,
    });
  }

  public handleConveyorControl(action: 'forward' | 'reverse' | 'stop', speed: number = 100): void {
    console.log(`[McuManager] CONVEYOR CONTROL -> action: ${action}, speed: ${speed}`);
    const isRunning = action !== 'stop';
    store.updateEquipmentState('eq_conveyor_01', isRunning);

    this.dispatchCommand('mcu/conveyor/motor', {
      action: 'conveyor',
      direction: action,
      state: isRunning,
      power: isRunning ? 1 : 0,
      speed,
    });
  }

  public getRecentLogs(): McuMessage[] {
    return this.messageLog;
  }
}

export const mcuManager = McuManager.getInstance();
