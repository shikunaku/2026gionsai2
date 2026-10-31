/**
 * @file webSerial.ts
 * @description Web Serial APIを利用したESP32/Arduinoマイコンとのシリアル通信管理モジュール。
 * ポートの検出・接続・改行区切りテキスト受信ループ・JSONコマンド送信・安全なリソース解放を提供します。
 */

// ============================================================================
// 1. Web Serial API 型定義 (ブラウザ標準の型補完用)
// ============================================================================

/** W3C Web Serial API: ポート情報 */
export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

/** W3C Web Serial API: ポート接続オプション */
export interface SerialOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

/** W3C Web Serial API: SerialPort インターフェース */
export interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<BufferSource> | null;
  open(options: SerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  forget?(): Promise<void>;
  getInfo(): SerialPortInfo;
}

/** 検出されたUSBデバイスの識別情報 */
export interface DetectedUsbInfo {
  /** USB Vendor ID (例: 0x10C4) */
  usbVendorId?: number;
  /** USB Product ID (例: 0xEA60) */
  usbProductId?: number;
  /** ユーザー向け表示名 (推定チップ名を含む) */
  displayName: string;
}

/** 内部で保持するアクティブなポートセッション情報 */
interface ActivePortSession {
  port: SerialPort;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  reader: ReadableStreamDefaultReader<string> | null;
  abortController: AbortController;
  readLoopRunning: boolean;
}

// ============================================================================
// 2. セッション管理 & サポート判定
// ============================================================================

/** デバイスIDとアクティブ接続のマッピングを保持するグローバルレジストリ */
const activeSessions = new Map<string, ActivePortSession>();

/**
 * 現在のブラウザ環境で Web Serial API が利用可能かどうかを判定します。
 * @returns {boolean} Web Serial API をサポートしている場合は true
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

// ============================================================================
// 3. ポート選択・デバイス検出
// ============================================================================

/**
 * ブラウザ標準のポート選択ダイアログを表示し、ユーザーが許可したポートとその識別情報を取得します。
 *
 * @throws {Error} Web Serial API 非対応ブラウザ、またはユーザーがキャンセルした場合
 * @returns {Promise<{ port: SerialPort; info: DetectedUsbInfo }>} 選択されたポートと推定情報
 */
export async function requestSerialPort(): Promise<{ port: SerialPort; info: DetectedUsbInfo }> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
  }

  const serial = (navigator as unknown as { serial: { requestPort: () => Promise<SerialPort> } }).serial;
  const port = await serial.requestPort();
  const portInfo = port.getInfo();

  // 16進数文字列へのフォーマット (デバッグおよびUI表示用)
  const vidHex = portInfo.usbVendorId ? `0x${portInfo.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}` : 'Unknown';
  const pidHex = portInfo.usbProductId ? `0x${portInfo.usbProductId.toString(16).padStart(4, '0').toUpperCase()}` : 'Unknown';

  // 主要なUSB-シリアル変換チップのVIDに基づく名称推定
  let vendorName = 'USB Serial Device';
  if (portInfo.usbVendorId === 0x10C4) {
    vendorName = 'Silicon Labs CP210x (ESP32 NodeMCU/DevKit)';
  } else if (portInfo.usbVendorId === 0x1A86) {
    vendorName = 'WCH CH340 / CH341 (Arduino Clone / ESP32)';
  } else if (portInfo.usbVendorId === 0x0403) {
    vendorName = 'FTDI FT232R (USB UART)';
  } else if (portInfo.usbVendorId === 0x2341) {
    vendorName = 'Arduino Official Board';
  } else if (portInfo.usbVendorId === 0x303A) {
    vendorName = 'Espressif Native USB-JTAG/Serial (ESP32-S2/S3/C3)';
  }

  const displayName = `${vendorName} (VID:${vidHex} PID:${pidHex})`;

  return {
    port,
    info: {
      usbVendorId: portInfo.usbVendorId,
      usbProductId: portInfo.usbProductId,
      displayName,
    },
  };
}

// ============================================================================
// 4. 接続確立とデータ読み取りループ
// ============================================================================

/**
 * 指定されたシリアルポートを開き、非同期受信ループと送信パイプラインを初期化します。
 *
 * @param {string} deviceId 管理対象の機器一意ID
 * @param {SerialPort} port 接続対象のポート
 * @param {number} baudRate 通信速度 (デフォルト: 115200)
 * @param {(line: string) => void} [onDataReceived] 改行コードで区切られた1行のテキスト受信時のコールバック
 * @param {() => void} [onDisconnect] 切断発生時のコールバック
 */
export async function connectSerialDevice(
  deviceId: string,
  port: SerialPort,
  baudRate: number,
  onDataReceived?: (line: string) => void,
  onDisconnect?: () => void
): Promise<void> {
  // 既存のセッションがあれば二重接続を防止するため事前にクローズ
  if (activeSessions.has(deviceId)) {
    await disconnectSerialDevice(deviceId);
  }

  // --- 1. ポートオープン ---
  try {
    await port.open({
      baudRate: Number(baudRate) || 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // 既に開かれているエラー以外は上位へスロー
    if (!errorMsg.includes('already open')) {
      throw err;
    }
  }

  // --- 2. 書き込みストリームの初期化 ---
  if (!port.writable) {
    throw new Error(`[WebSerial] Port writable stream is not available for device: ${deviceId}`);
  }

  const writer = (port.writable as WritableStream<Uint8Array>).getWriter();

  // --- 3. セッション登録 ---
  const abortController = new AbortController();
  const session: ActivePortSession = {
    port,
    writer,
    reader: null,
    abortController,
    readLoopRunning: true,
  };
  activeSessions.set(deviceId, session);

  // --- 4. 非同期読み取りループ (バックグラウンド起動) ---
  (async () => {
    while (port.readable && session.readLoopRunning) {
      const textDecoder = new TextDecoderStream();
      const pipePromise = (port.readable as ReadableStream<BufferSource>).pipeTo(textDecoder.writable, {
        signal: abortController.signal,
      }).catch(() => {
        // 中断シグナルによる終了時は正常動作として無視
      });

      const reader = textDecoder.readable.getReader();
      session.reader = reader;

      let lineBuffer = '';
      try {
        while (session.readLoopRunning) {
          const { value, done } = await reader.read();
          if (done) break;

          if (value) {
            lineBuffer += value;
            let newlineIdx: number;

            // 受信バッファ内の改行コード (\n) を検出し、1行単位でディスパッチ
            while ((newlineIdx = lineBuffer.indexOf('\n')) >= 0) {
              const fullLine = lineBuffer.slice(0, newlineIdx).replace(/\r$/, '');
              lineBuffer = lineBuffer.slice(newlineIdx + 1);

              if (fullLine.trim().length > 0 && onDataReceived) {
                onDataReceived(fullLine.trim());
              }
            }
          }
        }
      } catch (readErr: unknown) {
        if (session.readLoopRunning) {
          console.warn(`[WebSerial] Read error on device ${deviceId}:`, readErr);
        }
      } finally {
        // ストリームの排他ロックを解除（再接続やclose呼び出しに必須）
        try {
          reader.releaseLock();
        } catch (_) {}
        await pipePromise;
      }
    }
  })().catch((err) => {
    console.error(`[WebSerial] Read loop terminated unexpectedly for ${deviceId}:`, err);
    if (onDisconnect) onDisconnect();
  });
}

// ============================================================================
// 5. 切断 & リソース解放
// ============================================================================

/**
 * 指定したデバイスのシリアルセッションを安全にシャットダウンし、ポートのロックを解放します。
 * Reader / Writer のクローズと port.close() を適切な順序で実行します。
 *
 * @param {string} deviceId 解放対象のデバイスID
 */
export async function disconnectSerialDevice(deviceId: string): Promise<void> {
  const session = activeSessions.get(deviceId);
  if (!session) return;

  // 1. ループ停止フラグを立てて、パイプラインの中断シグナルを発行
  session.readLoopRunning = false;
  session.abortController.abort();

  // 2. 書き込みストリームのクローズ
  if (session.writer) {
    try {
      await session.writer.close();
    } catch (_) {}
  }

  // 3. 読み取りストリームのキャンセル
  if (session.reader) {
    try {
      await session.reader.cancel();
    } catch (_) {}
  }

  // 4. ハードウェアポートのクローズ
  if (session.port) {
    try {
      await session.port.close();
    } catch (closeErr) {
      console.warn(`[WebSerial] Error closing port for ${deviceId}:`, closeErr);
    }
  }

  // 5. レジストリから削除
  activeSessions.delete(deviceId);
  console.log(`[WebSerial] Device [${deviceId}] successfully disconnected and cleaned up.`);
}

// ============================================================================
// 6. コマンド送信 & 状態確認
// ============================================================================

/**
 * 接続中のシリアルデバイスへJSONコマンド（末尾に改行付与）を非同期送信します。
 *
 * @param {string} deviceId 送信先デバイスID
 * @param {Record<string, unknown>} payload 送信するオブジェクト
 * @throws {Error} デバイスが未接続、またはWriterが存在しない場合
 */
export async function sendSerialCommand(deviceId: string, payload: Record<string, unknown>): Promise<void> {
  const session = activeSessions.get(deviceId);
  if (!session || !session.writer) {
    throw new Error(`Device [${deviceId}] is not connected.`);
  }

  // マイコン側の行単位パーサーが解釈できるように末尾に \n を付与
  const jsonStr = JSON.stringify(payload) + '\n';
  const encoder = new TextEncoder();
  await session.writer.write(encoder.encode(jsonStr));
}

/**
 * 指定したデバイスが現在アクティブに接続中かどうかを判定します。
 *
 * @param {string} deviceId 確認対象のデバイスID
 * @returns {boolean} 接続セッションが存在する場合 true
 */
export function isDeviceConnected(deviceId: string): boolean {
  return activeSessions.has(deviceId);
}
