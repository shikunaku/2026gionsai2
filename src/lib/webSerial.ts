/**
 * Web Serial API Wrapper for ESP32 / Arduino and other MCUs
 * Handles port detection, connection opening/closing, reading incoming text, and writing JSON commands.
 */

// Global registry to map device ID to active SerialPort instance & reader/writer
interface ActivePortSession {
  port: any;
  reader?: any;
  writer?: any;
  readLoopRunning: boolean;
}

const activeSessions = new Map<string, ActivePortSession>();

export interface DetectedUsbInfo {
  usbVendorId?: number;
  usbProductId?: number;
  displayName: string;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Prompt user to select a serial port via browser dialog.
 * Returns the requested port and USB info.
 */
export async function requestSerialPort(): Promise<{ port: any; info: DetectedUsbInfo }> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
  }

  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  const portInfo = port.getInfo();

  const vidHex = portInfo.usbVendorId ? `0x${portInfo.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}` : 'Unknown';
  const pidHex = portInfo.usbProductId ? `0x${portInfo.usbProductId.toString(16).padStart(4, '0').toUpperCase()}` : 'Unknown';

  // Vendor heuristics
  let vendorName = 'USB Serial Device';
  if (portInfo.usbVendorId === 0x10C4) vendorName = 'Silicon Labs CP210x (ESP32)';
  else if (portInfo.usbVendorId === 0x1A86) vendorName = 'WCH CH340 / CH341 (ESP32/Arduino)';
  else if (portInfo.usbVendorId === 0x0403) vendorName = 'FTDI USB Serial';
  else if (portInfo.usbVendorId === 0x2341) vendorName = 'Arduino Official Node';
  else if (portInfo.usbVendorId === 0x303A) vendorName = 'Espressif USB JTAG/Serial';

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

/**
 * Connect to an already paired port or requested port
 */
export async function connectSerialDevice(
  deviceId: string,
  port: any,
  baudRate: number,
  onDataReceived?: (line: string) => void,
  onDisconnect?: () => void
): Promise<void> {
  // If previously open, close it first
  if (activeSessions.has(deviceId)) {
    await disconnectSerialDevice(deviceId);
  }

  try {
    // Open port
    await port.open({
      baudRate: Number(baudRate) || 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });
  } catch (err: any) {
    // If port is already open, ignore
    if (!err.message?.includes('already open')) {
      throw err;
    }
  }

  const textEncoder = new TextEncoderStream();
  const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
  const writer = textEncoder.writable.getWriter();

  const session: ActivePortSession = {
    port,
    writer,
    readLoopRunning: true,
  };
  activeSessions.set(deviceId, session);

  // Background read loop
  (async () => {
    while (port.readable && session.readLoopRunning) {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      session.reader = reader;

      let lineBuffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            lineBuffer += value;
            let newlineIdx;
            while ((newlineIdx = lineBuffer.indexOf('\n')) >= 0) {
              const fullLine = lineBuffer.slice(0, newlineIdx).replace(/\r$/, '');
              lineBuffer = lineBuffer.slice(newlineIdx + 1);
              if (fullLine.trim().length > 0 && onDataReceived) {
                onDataReceived(fullLine.trim());
              }
            }
          }
        }
      } catch (readErr) {
        console.warn(`[WebSerial] Read error on device ${deviceId}:`, readErr);
      } finally {
        try {
          reader.releaseLock();
        } catch (_) {}
      }
    }
  })().catch((err) => {
    console.error(`[WebSerial] Read loop terminated for ${deviceId}:`, err);
    if (onDisconnect) onDisconnect();
  });
}

/**
 * Disconnect and release the serial port
 */
export async function disconnectSerialDevice(deviceId: string): Promise<void> {
  const session = activeSessions.get(deviceId);
  if (!session) return;

  session.readLoopRunning = false;
  if (session.writer) {
    try {
      await session.writer.close();
    } catch (_) {}
  }
  if (session.reader) {
    try {
      await session.reader.cancel();
    } catch (_) {}
  }
  if (session.port) {
    try {
      await session.port.close();
    } catch (_) {}
  }

  activeSessions.delete(deviceId);
}

/**
 * Send JSON command line to serial device
 */
export async function sendSerialCommand(deviceId: string, payload: Record<string, any>): Promise<void> {
  const session = activeSessions.get(deviceId);
  if (!session || !session.writer) {
    throw new Error(`Device [${deviceId}] is not connected.`);
  }

  const jsonStr = JSON.stringify(payload) + '\n';
  await session.writer.write(jsonStr);
}

/**
 * Check if device is actively connected
 */
export function isDeviceConnected(deviceId: string): boolean {
  return activeSessions.has(deviceId);
}
