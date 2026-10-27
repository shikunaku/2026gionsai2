/**
 * @file mcu-manager.ts
 * @description ハードウェア・MCU（ESP32/Arduino等）との通信統合管理モジュール。
 * 有線USBシリアル・Wi-Fi (REST/WebSocket)・BLE の各通信プロトコルに対するコマンド送出、
 * 機材状態更新、および非常時の一括制御（全点灯・緊急停止）を統括します。
 */

import { store } from './store';
import { EquipmentProtocol } from '../src/lib/types';

// ============================================================================
// 1. 型定義
// ============================================================================

/** MCU向け送受信メッセージ構造 */
export interface McuMessage {
  protocol: EquipmentProtocol;
  topic: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

/** 搬送コンベア制御アクション */
export type ConveyorAction = 'forward' | 'reverse' | 'stop';

/** エレベータフロア状態 */
export type ElevatorFloor = 'FLOOR_1' | 'FLOOR_B1' | 'MOVING';

// ============================================================================
// 2. McuManager シングルトンクラス
// ============================================================================

/**
 * サーバーサイドにおけるMCU制御マネージャー。
 * フロントエンドやAdminからの機材操作要求を受け取り、プロトコルに応じたペイロードを構築・送出します。
 */
export class McuManager {
  private static instance: McuManager | null = null;

  /** 直近の送信ログ履歴（デバッグ・状態監視用、最大50件保持） */
  private messageLog: McuMessage[] = [];

  private constructor() {
    console.log('[McuManager] Hardware & MCU integration bridge initialized.');
  }

  /**
   * McuManagerのシングルトンインスタンスを取得します。
   * @returns {McuManager}
   */
  public static getInstance(): McuManager {
    if (!McuManager.instance) {
      McuManager.instance = new McuManager();
    }
    return McuManager.instance;
  }

  // ==========================================================================
  // コマンド送出パイプライン
  // ==========================================================================

  /**
   * MCU宛てにトピックとペイロードをディスパッチします。
   *
   * @param {string} topic メッセージトピック（例: "mcu/machine/eq_conveyor_01/control"）
   * @param {Record<string, unknown>} payload 送信データオブジェクト
   * @param {EquipmentProtocol} [protocol='wifi'] 通信プロトコル ('wifi' | 'serial' | 'ble')
   */
  public dispatchCommand(
    topic: string,
    payload: Record<string, unknown>,
    protocol: EquipmentProtocol = 'wifi'
  ): void {
    const msg: McuMessage = {
      protocol,
      topic,
      payload,
      timestamp: Date.now(),
    };

    // リングバッファ形式で直近50件のログを保持
    this.messageLog.unshift(msg);
    if (this.messageLog.length > 50) {
      this.messageLog.pop();
    }

    console.log(`[McuManager] DISPATCH -> [${protocol.toUpperCase()}] ${topic} :`, JSON.stringify(payload));

    // シリアル接続用ブリッジ（有線シリアル構成時に行単位JSONを出力）
    this.sendSerialLine(JSON.stringify({ topic, ...payload }));
  }

  /**
   * 有線USBシリアルポート宛てのテキスト送信プレースホルダー。
   * Node.js環境で直接COMポートを開く拡張を行う際、またはWebSerialとの双方向中継時に使用します。
   *
   * @param {string} _line 改行区切りのJSONテキスト
   * @private
   */
  private sendSerialLine(_line: string): void {
    // クライアント側（ブラウザ）のWeb Serial API連携が主体の構成となっており、
    // サーバー単体でNode-SerialPortを利用する場合はここにドライバ呼び出しを結合します。
  }

  // ==========================================================================
  // 高水準機材制御メソッド
  // ==========================================================================

  /**
   * 各種機材（コンベア・バルブ・照明・ファン等）のON/OFF制御を実行します。
   * ファームウェア側の文字列パーサー (`cmd.indexOf("conveyor")` 等) と完全な互換性を持つ形式で送信します。
   *
   * @param {string} machineId 機材ID (例: "eq_conveyor_01", "eq_valve_01")
   * @param {boolean} state 稼働状態 (true: ON, false: OFF)
   */
  public handleMachineControl(machineId: string, state: boolean): void {
    // 1. ストアから機材設定を検索
    const equipments = store.getEquipments();
    const item = equipments.find((e) => e.id === machineId || e.topic?.includes(machineId));
    const topic = item?.topic || `mcu/machine/${machineId}/control`;
    const protocol: EquipmentProtocol = item?.protocol || 'serial';
    const mcuId = item?.mcuId || 'ESP32_MAIN';
    const endpoint = item?.endpoint || '';

    // 2. サーバー側ストアの状態を更新
    store.updateEquipmentState(machineId, state);

    // 3. ファームウェア側で解釈可能なアクション文字列を判定
    let action = 'custom';
    if (machineId.includes('conveyor') || topic.includes('conveyor')) action = 'conveyor';
    else if (machineId.includes('valve') || topic.includes('valve')) action = 'valve';
    else if (machineId.includes('light') || topic.includes('light')) action = 'light';
    else if (machineId.includes('fan') || topic.includes('fan')) action = 'fan';

    // 4. ファームウェアのJSON形式に則ってコマンド送出
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

  /**
   * 非常用全点灯コマンドを発行します。
   * 避難誘導・パトランプ点灯および危険動力機器（コンベア等）の緊急停止を指示します。
   */
  public handleEmergencyAllLight(): void {
    console.log('[McuManager] EMERGENCY ALL LIGHT TRIGGERED! Activating all relays & beacons.');
    this.dispatchCommand('mcu/alarm/light', { action: 'emergency', state: true, power: 1 });
    this.dispatchCommand('mcu/relays/all', { action: 'emergency', state: true, power: 1 });
  }

  /**
   * エレベータ演出のフロア移動状態をマイコン（インジケータLED・モーター演出等）に通知します。
   *
   * @param {ElevatorFloor} targetFloor 階層状態 ('FLOOR_1' | 'FLOOR_B1' | 'MOVING')
   */
  public handleElevatorMove(targetFloor: ElevatorFloor): void {
    console.log(`[McuManager] ELEVATOR MOVE TRIGGERED -> ${targetFloor}`);
    this.dispatchCommand('mcu/elevator/motor', {
      action: 'elevator',
      floor: targetFloor,
      state: targetFloor === 'MOVING' || targetFloor === 'FLOOR_B1',
      power: targetFloor === 'MOVING' ? 1 : 0,
    });
  }

  /**
   * 搬送コンベアの動作（前進・後退・停止）および速度を制御します。
   *
   * @param {ConveyorAction} action 動作モード ('forward' | 'reverse' | 'stop')
   * @param {number} [speed=100] 搬送速度 (0-100%)
   */
  public handleConveyorControl(action: ConveyorAction, speed = 100): void {
    console.log(`[McuManager] CONVEYOR CONTROL -> action: ${action}, speed: ${speed}`);
    const isRunning = action !== 'stop';

    // 機材管理ストアのコンベア状態を同期更新
    store.updateEquipmentState('eq_conveyor_01', isRunning);

    this.dispatchCommand('mcu/conveyor/motor', {
      action: 'conveyor',
      direction: action,
      state: isRunning,
      power: isRunning ? 1 : 0,
      speed,
    });
  }

  /**
   * 生首ギミック（リレー/アクチュエータ等）の制御
   *
   * @param {boolean} [trigger=true] 作動フラグ
   * @param {number} [durationMs=3000] 作動維持時間(ms)
   */
  public handleHeadGimmick(trigger = true, durationMs = 3000): void {
    console.log(`[McuManager] HEAD GIMMICK TRIGGERED -> state: ${trigger}, duration: ${durationMs}ms`);
    store.updateEquipmentState('eq_head_gimmick_01', trigger);
    this.dispatchCommand('mcu/gimmick/head', {
      action: 'gimmick',
      target: 'head',
      state: trigger,
      power: trigger ? 1 : 0,
    });

    if (trigger && durationMs > 0) {
      setTimeout(() => {
        console.log('[McuManager] Head gimmick auto-reset');
        store.updateEquipmentState('eq_head_gimmick_01', false);
        this.dispatchCommand('mcu/gimmick/head', {
          action: 'gimmick',
          target: 'head',
          state: false,
          power: 0,
        });
      }, durationMs);
    }
  }

  /**
   * エレベーターや各フェーズ用の照明異常（明滅・減光）
   */
  public handleLightingAnomaly(mode: 'flicker' | 'blackout' | 'normal' = 'flicker', durationMs = 3500): void {
    console.log(`[McuManager] LIGHTING ANOMALY -> mode: ${mode}, duration: ${durationMs}ms`);
    this.dispatchCommand('mcu/lighting/anomaly', {
      action: 'light_anomaly',
      mode,
      durationMs,
    });
  }

  /**
   * 直近のコマンド送信履歴を取得します。
   * @returns {McuMessage[]} 直近最大50件のメッセージ配列
   */
  public getRecentLogs(): McuMessage[] {
    return this.messageLog;
  }
}

/** グローバル McuManager シングルトンインスタンス */
export const mcuManager = McuManager.getInstance();
