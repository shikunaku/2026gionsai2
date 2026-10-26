/**
 * @file types.ts
 * @description アトラクションシステム全体の共有型定義。
 * 端末フェーズ、デバイスメタ情報、エレベーター・コンベア制御、Web Serial、
 * サウンドノード（Sound Node）、および Socket.IO イベント通信規約を定義します。
 */

// ============================================================================
// 1. デバイスフェーズ & 端末ロール定義
// ============================================================================

/** 参加者端末（PDA）の進行フェーズ */
export type DevicePhase =
  | 'STANDBY'
  | 'AREA_1_PHOTO'
  | 'ELEVATOR'
  | 'AREA_2_CONVEYOR'
  | 'AREA_3_VIDEO'
  | 'RETURN';

/** 端末の運用ロール種別 */
export type DeviceRole = 'client' | 'sound_node' | 'display' | 'admin';

/** エレベーター階層状態 */
export type ElevatorFloorState = 'FLOOR_1' | 'MOVING' | 'FLOOR_B1' | 'OFF';

/** エレベーター状態同期ペイロード */
export interface ElevatorStatePayload {
  floor: ElevatorFloorState;
  glitch?: boolean;
}

/** 搬送コンベア制御アクション */
export type ConveyorAction = 'forward' | 'reverse' | 'stop';

/** 搬送コンベア制御ペイロード */
export interface ConveyorControlPayload {
  action: ConveyorAction;
  speed?: number;
  deviceId?: string;
}

// ============================================================================
// 2. ブラウザ / ネイティブ環境拡張
// ============================================================================

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
  interface BatteryManager extends EventTarget {
    level: number;
    charging: boolean;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
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

// ============================================================================
// 3. 端末・審査・ミッション型定義
// ============================================================================

export type ReviewStatus = 'SUBMITTING' | 'PENDING' | 'APPROVED' | 'REJECTED';

/** 接続端末（PDA / Sound Node等）のテレメトリ情報 */
export interface DeviceInfo {
  deviceId: string;
  socketId: string;
  phase: DevicePhase;
  role?: DeviceRole;
  location?: string;
  batteryLevel: number | string;
  charging: boolean;
  flashState: boolean;
  lastSeen: number;
}

/** 提出された写真データ */
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

/** 点検ミッションタスク仕様 */
export interface InspectionTask {
  id: number;
  title: string;
  location: string;
  targetDescription: string;
  status: ReviewStatus;
  rejectionReason?: string;
}

// ============================================================================
// 4. 演出エフェクト型定義
// ============================================================================

/** 画面グリッチ妨害エフェクトのオプション */
export interface GlitchEffectOptions {
  level: number;
  duration: number;
  vibrate?: boolean;
  mode?: 'violent' | 'creepy' | 'invert' | 'blackout' | 'redout' | 'static';
}

/** LEDトーチ点滅エフェクトのオプション */
export interface TorchEffectOptions {
  state?: boolean;
  flicker?: boolean;
  count?: number;
  intervalMs?: number;
  pattern?: string;
  stop?: boolean;
}

/** 効果音エフェクトのオプション（内蔵プロシージャル音源またはMP3音声ファイル） */
export interface SoundEffectOptions {
  soundType: 'beep' | 'shutter' | 'lowImpact' | 'geiger' | 'drone' | 'motor' | 'powerDown' | 'taskSuccess' | 'file';
  level?: number;
  /** 再生する音声ファイル名 (public/audio/ 配下、例: "alarm.mp3") */
  filename?: string;
  /** 音量倍率 (0.0 〜 2.5) */
  volume?: number;
  /** ループ再生フラグ */
  loop?: boolean;
}

/** サウンド専用ノード（Sound Node）向け高機能オーディオ再生ペイロード */
export interface SoundNodePlayPayload {
  /** 対象端末ID（省略時は全Sound Nodeで同時再生） */
  targetDeviceId?: string;
  /** 再生するサウンド種別または音源URL/名前 ('file' でMP3ファイル再生) */
  soundType: SoundEffectOptions['soundType'] | 'custom' | 'file';
  /** 再生する音声ファイル名 (public/audio/ 配下、例: "siren.mp3") */
  filename?: string;
  /** カスタム音源URL（soundType === 'custom' の場合） */
  soundUrl?: string;
  /** 音量倍率 (0.0 〜 2.5) */
  volume?: number;
  /** 効果音の強度レベル (例: ガイガー音の激しさ 1〜5) */
  level?: number;
  /** ループ再生フラグ */
  loop?: boolean;
  /** 再生時間 (ミリ秒、省略時は音源の終端まで) */
  durationMs?: number;
}

// ============================================================================
// 5. ハードウェア機材 (Equipment) 型定義
// ============================================================================

export type EquipmentProtocol = 'serial' | 'wifi' | 'ble';

export interface SerialSwitchConfig {
  id: string;
  name: string;
  action: string;      // 例: "conveyor", "fan", "light"
  state: boolean;      // 現在の状態
  onPayload?: Record<string, unknown>;
  offPayload?: Record<string, unknown>;
}

export interface SerialButtonConfig {
  id: string;
  name: string;
  action: string;      // 例: "emergency", "all_off", "reset"
  payload?: Record<string, unknown>;
}

export interface SerialDeviceConfig {
  id: string;
  name: string;
  portName?: string;
  usbVendorId?: number;
  usbProductId?: number;
  baudRate: number;
  switches: SerialSwitchConfig[];
  buttons: SerialButtonConfig[];
  connected: boolean;
  createdAt: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  type: 'relay' | 'servo' | 'light' | 'fan' | 'custom';
  state: boolean | number | string;
  topic?: string;
  mcuId?: string;
  protocol?: EquipmentProtocol;
  endpoint?: string;
  updatedAt: string;
}

// ============================================================================
// 6. Socket.IO 通信イベント規格
// ============================================================================

/** サーバーからクライアントへ送信されるイベント */
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
    currentElevatorState?: ElevatorStatePayload;
  }) => void;
  'equipment:init': (equipments: EquipmentItem[]) => void;
  'equipment:updated': (equipment: EquipmentItem) => void;
  'equipment:removed': (payload: { id: string }) => void;

  // エレベーター表示画面向けイベント
  'elevator:state': (payload: ElevatorStatePayload) => void;
  'elevator:glitch': (payload?: { duration?: number }) => void;

  // エリア3 ビデオ表示画面向けイベント
  'video:trigger_play': (payload?: { videoSrc?: string; title?: string }) => void;
  'video:reset': () => void;

  // サウンド専用端末（Sound Node）向けイベント
  'sound:play': (payload: SoundNodePlayPayload) => void;
  'sound:stop': (payload?: { targetDeviceId?: string }) => void;
}

/** クライアントからサーバーへ送信されるイベント */
export interface ClientToServerEvents {
  'device:ready': (payload: {
    deviceId: string;
    phase: DevicePhase;
    location?: string;
    role?: DeviceRole;
  }) => void;
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

  // 搬送コンベア直接操作
  'conveyor:control': (payload: ConveyorControlPayload) => void;

  // エレベーター動作指示
  'elevator:trigger_move': (payload?: { from?: ElevatorFloorState; to?: ElevatorFloorState; deviceId?: string }) => void;
  'elevator:set_floor': (payload: ElevatorStatePayload) => void;
  'elevator:trigger_glitch': (payload?: { duration?: number }) => void;

  // ビデオトリガー
  'video:trigger_play': (payload?: { videoSrc?: string; deviceId?: string }) => void;
  'video:ended': (payload?: { deviceId?: string }) => void;

  // サウンド専用端末（Sound Node）登録およびトリガー
  'sound:register_node': (payload: { deviceId: string; location?: string }) => void;
  'sound:trigger': (payload: SoundNodePlayPayload) => void;

  // 管理コンソール (Admin) ハンドラー
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
    options: unknown;
  }) => void;
  'admin:emergency_all_light': () => void;
  'equipment:get_all': () => void;
  'equipment:add': (equipment: Omit<EquipmentItem, 'updatedAt'>) => void;
  'equipment:remove': (payload: { id: string }) => void;
  'equipment:control': (payload: { id: string; action: string; value: unknown }) => void;
}
