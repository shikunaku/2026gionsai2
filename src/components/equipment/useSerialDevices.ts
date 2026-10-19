'use client';

import { useState, useEffect } from 'react';
import {
  SerialDeviceConfig,
  SerialSwitchConfig,
  SerialButtonConfig,
} from '../../lib/types';
import {
  isWebSerialSupported,
  requestSerialPort,
  connectSerialDevice,
  disconnectSerialDevice,
  sendSerialCommand,
  isDeviceConnected,
} from '../../lib/webSerial';

const STORAGE_KEY = 'gionsai_serial_devices_v1';

// Temporary in-memory hold for selected port objects before connection
const portObjectRegistry = new Map<string, any>();

export function useSerialDevices() {
  const [devices, setDevices] = useState<SerialDeviceConfig[]>([]);
  const [supported, setSupported] = useState<boolean>(true);
  const [logs, setLogs] = useState<string[]>([]);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    setSupported(isWebSerialSupported());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SerialDeviceConfig[] = JSON.parse(saved);
        const resetStatus = parsed.map((d) => ({ ...d, connected: false }));
        setDevices(resetStatus);
      } else {
        const defaultDevice: SerialDeviceConfig = {
          id: 'dev_esp32_sample',
          name: 'ESP32 メイン制御基板',
          portName: 'USB Serial (未検出・手動設定)',
          baudRate: 115200,
          connected: false,
          createdAt: new Date().toISOString(),
          switches: [
            { id: 'sw_conveyor', name: '搬送コンベア', action: 'conveyor', state: false },
            { id: 'sw_light', name: '演出照明/赤色灯', action: 'light', state: false },
            { id: 'sw_fan', name: '排気ファン', action: 'fan', state: false },
            { id: 'sw_valve', name: '蒸気バルブ (サーボ)', action: 'valve', state: false },
          ],
          buttons: [
            { id: 'btn_emergency', name: '🚨 非常全点灯・緊急停止', action: 'emergency' },
            { id: 'btn_alloff', name: '🛑 全機材強制OFF', action: 'all_off' },
            { id: 'btn_reset', name: '🔄 状態リセット', action: 'reset' },
          ],
        };
        setDevices([defaultDevice]);
      }
    } catch (e) {
      console.error('Failed to load serial devices', e);
    }
  }, []);

  const saveDevices = (newDevices: SerialDeviceConfig[]) => {
    setDevices(newDevices);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDevices));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  const addLog = (deviceName: string, msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] [${deviceName}] ${msg}`, ...prev].slice(0, 150));
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const registerPort = (deviceId: string, port: any) => {
    portObjectRegistry.set(deviceId, port);
  };

  const saveDeviceConfig = (deviceData: SerialDeviceConfig, isNew: boolean) => {
    if (isNew) {
      saveDevices([...devices, deviceData]);
    } else {
      saveDevices(
        devices.map((d) => (d.id === deviceData.id ? { ...deviceData, connected: d.connected } : d))
      );
    }
  };

  const deleteDevice = async (id: string) => {
    if (!confirm('このマイコン設定を削除しますか？')) return;
    if (isDeviceConnected(id)) {
      await disconnectSerialDevice(id);
    }
    portObjectRegistry.delete(id);
    saveDevices(devices.filter((d) => d.id !== id));
  };

  const connectDevice = async (device: SerialDeviceConfig) => {
    if (!supported) {
      alert('Web Serial API非対応ブラウザです。');
      return;
    }

    let port = portObjectRegistry.get(device.id);

    if (!port) {
      try {
        const res = await requestSerialPort();
        port = res.port;
        portObjectRegistry.set(device.id, port);
        device.portName = res.info.displayName;
        device.usbVendorId = res.info.usbVendorId;
        device.usbProductId = res.info.usbProductId;
      } catch (err: any) {
        alert(`ポート接続キャンセルまたはエラー: ${err.message}`);
        return;
      }
    }

    try {
      addLog(device.name, `接続試行中... (ボーレート: ${device.baudRate}bps)`);
      await connectSerialDevice(
        device.id,
        port,
        device.baudRate,
        (incomingLine) => {
          addLog(device.name, `[受信] ${incomingLine}`);
        },
        () => {
          addLog(device.name, `[切断] ポートが閉じられました`);
          saveDevices(devices.map((d) => (d.id === device.id ? { ...d, connected: false } : d)));
        }
      );

      addLog(device.name, `[接続完了] シリアルポートオープン`);
      saveDevices(devices.map((d) => (d.id === device.id ? { ...d, connected: true } : d)));
    } catch (err: any) {
      alert(`シリアルオープン失敗: ${err.message}`);
      addLog(device.name, `[エラー] ${err.message}`);
    }
  };

  const disconnectDevice = async (device: SerialDeviceConfig) => {
    try {
      await disconnectSerialDevice(device.id);
      addLog(device.name, `[切断完了] シリアルポートを閉じました`);
      saveDevices(devices.map((d) => (d.id === device.id ? { ...d, connected: false } : d)));
    } catch (err: any) {
      alert(`切断時エラー: ${err.message}`);
    }
  };

  const toggleSwitch = async (device: SerialDeviceConfig, sw: SerialSwitchConfig) => {
    const nextState = !sw.state;
    const payload = {
      mcuId: device.id,
      action: sw.action,
      state: nextState,
      power: nextState ? 1 : 0,
      timestamp: Date.now(),
    };

    const updatedSwitches = device.switches.map((s) => (s.id === sw.id ? { ...s, state: nextState } : s));
    saveDevices(devices.map((d) => (d.id === device.id ? { ...d, switches: updatedSwitches } : d)));

    try {
      if (isDeviceConnected(device.id)) {
        await sendSerialCommand(device.id, payload);
        addLog(device.name, `[送信] ${JSON.stringify(payload)}`);
      } else {
        addLog(device.name, `[未接続シミュレーション] ${JSON.stringify(payload)}`);
      }
    } catch (err: any) {
      alert(`送信エラー: ${err.message}`);
      addLog(device.name, `[送信失敗] ${err.message}`);
    }
  };

  const triggerButton = async (device: SerialDeviceConfig, btn: SerialButtonConfig) => {
    const payload = {
      mcuId: device.id,
      action: btn.action,
      command: btn.action,
      timestamp: Date.now(),
    };

    try {
      if (isDeviceConnected(device.id)) {
        await sendSerialCommand(device.id, payload);
        addLog(device.name, `[送信] ${JSON.stringify(payload)}`);
      } else {
        addLog(device.name, `[未接続シミュレーション] ${JSON.stringify(payload)}`);
      }
    } catch (err: any) {
      alert(`送信エラー: ${err.message}`);
      addLog(device.name, `[送信失敗] ${err.message}`);
    }
  };

  return {
    devices,
    supported,
    logs,
    clearLogs,
    registerPort,
    saveDeviceConfig,
    deleteDevice,
    connectDevice,
    disconnectDevice,
    toggleSwitch,
    triggerButton,
  };
}
