'use client';

import React, { useState, useEffect } from 'react';
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
import '../../styles/serial-manager.css';

const STORAGE_KEY = 'gionsai_serial_devices_v1';

// Temporary in-memory hold for selected port objects before connection
const portObjectRegistry = new Map<string, any>();

export const SerialDeviceManager: React.FC = () => {
  const [devices, setDevices] = useState<SerialDeviceConfig[]>([]);
  const [supported, setSupported] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'control' | 'edit'>('control');
  const [editingDevice, setEditingDevice] = useState<SerialDeviceConfig | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalMode, setModalMode] = useState<'new' | 'edit'>('new');
  const [detecting, setDetecting] = useState(false);

  // Form states for creating / editing device
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPortName, setFormPortName] = useState('');
  const [formVid, setFormVid] = useState<number | undefined>(undefined);
  const [formPid, setFormPid] = useState<number | undefined>(undefined);
  const [formBaudRate, setFormBaudRate] = useState<number>(115200);
  const [formSwitches, setFormSwitches] = useState<SerialSwitchConfig[]>([]);
  const [formButtons, setFormButtons] = useState<SerialButtonConfig[]>([]);

  // Temp form input for adding switch / button inside modal
  const [tempSwitchName, setTempSwitchName] = useState('');
  const [tempSwitchAction, setTempSwitchAction] = useState('');
  const [tempButtonName, setTempButtonName] = useState('');
  const [tempButtonAction, setTempButtonAction] = useState('');

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    setSupported(isWebSerialSupported());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SerialDeviceConfig[] = JSON.parse(saved);
        // Mark all as disconnected upon reload
        const resetStatus = parsed.map((d) => ({ ...d, connected: false }));
        setDevices(resetStatus);
      } else {
        // Preset default demo device
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

  // Save to LocalStorage whenever devices change
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

  // 2. Detection (USB Serial)
  const handleDetectPort = async () => {
    if (!supported) {
      alert('お使いのブラウザはWeb Serial APIに対応していません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
      return;
    }
    setDetecting(true);
    try {
      const { port, info } = await requestSerialPort();
      const generatedId = formId || `dev_${Date.now()}`;
      portObjectRegistry.set(generatedId, port);

      setFormId(generatedId);
      setFormPortName(info.displayName);
      setFormVid(info.usbVendorId);
      setFormPid(info.usbProductId);
      if (!formName) {
        setFormName(info.displayName.split('(')[0].trim() || 'マイコン端末');
      }
      alert(`マイコンを検出しました！\n端末情報: ${info.displayName}`);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        alert(`検出エラー: ${err.message}`);
      }
    } finally {
      setDetecting(false);
    }
  };

  // Open modal for new device
  const handleOpenNewModal = () => {
    const newId = `dev_${Date.now()}`;
    setModalMode('new');
    setFormId(newId);
    setFormName('');
    setFormPortName('');
    setFormVid(undefined);
    setFormPid(undefined);
    setFormBaudRate(115200);
    setFormSwitches([
      { id: `sw_${Date.now()}_1`, name: 'リレー1 (電源)', action: 'relay1', state: false },
    ]);
    setFormButtons([
      { id: `btn_${Date.now()}_1`, name: '緊急停止 (ALL OFF)', action: 'all_off' },
    ]);
    setShowConfigModal(true);
  };

  // Open modal for editing existing device
  const handleOpenEditModal = (dev: SerialDeviceConfig) => {
    setModalMode('edit');
    setFormId(dev.id);
    setFormName(dev.name);
    setFormPortName(dev.portName || '');
    setFormVid(dev.usbVendorId);
    setFormPid(dev.usbProductId);
    setFormBaudRate(dev.baudRate || 115200);
    setFormSwitches([...dev.switches]);
    setFormButtons([...dev.buttons]);
    setShowConfigModal(true);
  };

  // Add Switch to Modal Form
  const handleAddSwitchToForm = () => {
    if (!tempSwitchName.trim() || !tempSwitchAction.trim()) {
      alert('スイッチ名とアクション名(キー)を入力してください。');
      return;
    }
    const newSw: SerialSwitchConfig = {
      id: `sw_${Date.now()}`,
      name: tempSwitchName.trim(),
      action: tempSwitchAction.trim(),
      state: false,
    };
    setFormSwitches([...formSwitches, newSw]);
    setTempSwitchName('');
    setTempSwitchAction('');
  };

  const handleRemoveSwitchFromForm = (id: string) => {
    setFormSwitches(formSwitches.filter((s) => s.id !== id));
  };

  // Add Button to Modal Form
  const handleAddButtonToForm = () => {
    if (!tempButtonName.trim() || !tempButtonAction.trim()) {
      alert('ボタン名と送信命令(アクション名)を入力してください。');
      return;
    }
    const newBtn: SerialButtonConfig = {
      id: `btn_${Date.now()}`,
      name: tempButtonName.trim(),
      action: tempButtonAction.trim(),
    };
    setFormButtons([...formButtons, newBtn]);
    setTempButtonName('');
    setTempButtonAction('');
  };

  const handleRemoveButtonFromForm = (id: string) => {
    setFormButtons(formButtons.filter((b) => b.id !== id));
  };

  // Save Modal Form
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('端末名を入力してください。');
      return;
    }

    const deviceData: SerialDeviceConfig = {
      id: formId,
      name: formName.trim(),
      portName: formPortName.trim() || 'USB Serial',
      usbVendorId: formVid,
      usbProductId: formPid,
      baudRate: Number(formBaudRate),
      switches: formSwitches,
      buttons: formButtons,
      connected: isDeviceConnected(formId),
      createdAt: new Date().toISOString(),
    };

    if (modalMode === 'new') {
      saveDevices([...devices, deviceData]);
    } else {
      saveDevices(devices.map((d) => (d.id === formId ? { ...deviceData, connected: d.connected } : d)));
    }

    setShowConfigModal(false);
  };

  // Delete Device
  const handleDeleteDevice = async (id: string) => {
    if (!confirm('このマイコン設定を削除しますか？')) return;
    if (isDeviceConnected(id)) {
      await disconnectSerialDevice(id);
    }
    portObjectRegistry.delete(id);
    saveDevices(devices.filter((d) => d.id !== id));
  };

  // 3. Connect to Device
  const handleConnect = async (device: SerialDeviceConfig) => {
    if (!supported) {
      alert('Web Serial API非対応ブラウザです。');
      return;
    }

    let port = portObjectRegistry.get(device.id);

    // If port object not in memory, prompt user to select port
    if (!port) {
      try {
        const res = await requestSerialPort();
        port = res.port;
        portObjectRegistry.set(device.id, port);
        // update port display info
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
          // Disconnected
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

  // Disconnect from Device
  const handleDisconnect = async (device: SerialDeviceConfig) => {
    try {
      await disconnectSerialDevice(device.id);
      addLog(device.name, `[切断完了] シリアルポートを閉じました`);
      saveDevices(devices.map((d) => (d.id === device.id ? { ...d, connected: false } : d)));
    } catch (err: any) {
      alert(`切断時エラー: ${err.message}`);
    }
  };

  // 4. Toggle Switch -> Send JSON Command
  const handleToggleSwitch = async (device: SerialDeviceConfig, sw: SerialSwitchConfig) => {
    const nextState = !sw.state;
    const payload = {
      mcuId: device.id,
      action: sw.action,
      state: nextState,
      power: nextState ? 1 : 0,
      timestamp: Date.now(),
    };

    // Update state in UI
    const updatedSwitches = device.switches.map((s) => (s.id === sw.id ? { ...s, state: nextState } : s));
    saveDevices(devices.map((d) => (d.id === device.id ? { ...d, switches: updatedSwitches } : d)));

    // Send via Serial
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

  // 5. Trigger Command Button -> Send JSON Command
  const handleTriggerButton = async (device: SerialDeviceConfig, btn: SerialButtonConfig) => {
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

  return (
    <div className="serial-manager-root win95-window">
      <div className="win95-titlebar serial-header-titlebar">
        <span>🔌 マイコンUSBシリアル統合制御コンソール (Web Serial)</span>
        <span className="serial-browser-badge">
          {supported ? '✅ Web Serial API 有効' : '⚠️ Web Serial 非対応 (Chrome/Edge推奨)'}
        </span>
      </div>

      <div className="serial-manager-toolbar">
        <div className="serial-toolbar-left">
          <span className="serial-summary-text">
            登録端末数: <strong>{devices.length}台</strong> | 接続中: <strong>{devices.filter((d) => d.connected).length}台</strong>
          </span>
        </div>
        <div className="serial-toolbar-actions">
          <button className="win95-btn serial-add-btn" onClick={handleOpenNewModal}>
            ➕ 新規マイコン端末を追加
          </button>
        </div>
      </div>

      {/* Main Device List / Panels */}
      {/* Main Workspace: Top = Compact Device Cards Grid, Bottom = Unified Log Console */}
      <div className="serial-compact-workspace">
        {/* Device Cards Section */}
        <div className="serial-devices-compact-container">
          {devices.length === 0 ? (
            <div className="serial-empty-message win95-inset">
              マイコン端末が登録されていません。「➕ 新規マイコン端末を追加」ボタンからUSB接続・設定を行ってください。
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className={`win95-window serial-device-card ${device.connected ? 'is-connected' : ''}`}>
                <div className="win95-titlebar serial-device-titlebar">
                  <div className="serial-device-titlebar-left">
                    <span className="serial-status-dot" title={device.connected ? '接続中' : '未接続'} />
                    <span className="serial-device-name" title={device.name}>{device.name}</span>
                    <span className="serial-baud-badge">{device.baudRate} bps</span>
                  </div>
                  <div className="serial-device-titlebar-right">
                    <button
                      className="win95-btn serial-mini-btn"
                      onClick={() => handleOpenEditModal(device)}
                      title="設定・ボタン構成を後から編集"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      className="win95-btn serial-mini-btn serial-delete-btn"
                      onClick={() => handleDeleteDevice(device.id)}
                      title="端末削除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="serial-device-body compact">
                  {/* Port Info & Connect/Disconnect Bar (Slim) */}
                  <div className="serial-port-bar win95-inset">
                    <div className="serial-port-info" title={device.portName || '未検出'}>
                      <span className="serial-info-value">{device.portName || '未検出'}</span>
                    </div>
                    <div className="serial-connect-action">
                      {device.connected ? (
                        <button
                          className="win95-btn serial-disconnect-btn"
                          onClick={() => handleDisconnect(device)}
                        >
                          ⏹️ 切断
                        </button>
                      ) : (
                        <button
                          className="win95-btn serial-connect-btn"
                          onClick={() => handleConnect(device)}
                        >
                          ⚡ 接続
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Switches and Buttons row */}
                  <div className="serial-controls-compact">
                    {/* Switches */}
                    {device.switches.length > 0 && (
                      <div className="serial-control-group">
                        <span className="serial-group-tag">SW:</span>
                        <div className="serial-chips-row">
                          {device.switches.map((sw) => (
                            <button
                              key={sw.id}
                              type="button"
                              className={`win95-btn serial-switch-chip ${sw.state ? 'is-on' : 'is-off'}`}
                              onClick={() => handleToggleSwitch(device, sw)}
                              title={`スイッチ: ${sw.name} (action: ${sw.action})`}
                            >
                              <span className="chip-name">{sw.name}</span>
                              <span className="chip-state">{sw.state ? 'ON' : 'OFF'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Buttons */}
                    {device.buttons.length > 0 && (
                      <div className="serial-control-group">
                        <span className="serial-group-tag">CMD:</span>
                        <div className="serial-chips-row">
                          {device.buttons.map((btn) => (
                            <button
                              key={btn.id}
                              type="button"
                              className="win95-btn serial-button-chip"
                              onClick={() => handleTriggerButton(device, btn)}
                              title={`送信: {"action":"${btn.action}"}`}
                            >
                              {btn.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {device.switches.length === 0 && device.buttons.length === 0 && (
                      <div className="serial-no-controls">スイッチ・ボタン未登録 (「✏️ 編集」から追加)</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Unified Serial Log Console (Fixed height, bottom panel) */}
        <div className="win95-window serial-global-log-window">
          <div className="win95-titlebar serial-global-log-titlebar">
            <span>📜 全マイコン統合シリアル通信ログ ({logs.length}件)</span>
            <button
              className="win95-btn serial-clear-btn"
              onClick={() => setLogs([])}
            >
              ログクリア
            </button>
          </div>
          <div className="serial-global-log-console win95-inset">
            {logs.length === 0 ? (
              <div className="serial-log-placeholder">送受信ログはありません (マイコンを接続して操作するとここに流れます)</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="serial-log-line">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== Add / Edit Device Modal ===== */}
      {showConfigModal && (
        <div className="win95-modal-backdrop">
          <div className="win95-window serial-modal-content">
            <div className="win95-titlebar serial-modal-titlebar">
              <span>{modalMode === 'new' ? 'マイコン端末の新規追加 & 設定' : 'マイコン端末の設定編集'}</span>
              <button className="win95-btn serial-close-modal-btn" onClick={() => setShowConfigModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="serial-modal-body">
              {/* Step 1: Detect Port */}
              <div className="serial-form-group win95-inset">
                <label className="serial-form-label">
                  <strong>ステップ1: マイコンをUSBで接続して検出</strong>
                </label>
                <div className="serial-detect-row">
                  <button
                    type="button"
                    className="win95-btn serial-detect-action-btn"
                    onClick={handleDetectPort}
                    disabled={detecting}
                  >
                    {detecting ? '検出中...' : '🔍 USBマイコンを検出 (ポート選択)'}
                  </button>
                  <div className="serial-detected-info">
                    {formPortName ? (
                      <span className="serial-detect-success">✅ {formPortName}</span>
                    ) : (
                      <span className="serial-detect-waiting">未検出 (ボタンを押してポートを選択)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Name & Baudrate */}
              <div className="serial-form-row">
                <div className="serial-form-group flex-2">
                  <label className="serial-form-label">マイコン端末名称 (表示名)</label>
                  <input
                    type="text"
                    className="win95-input serial-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例: ESP32_コンベア制御盤"
                    required
                  />
                </div>
                <div className="serial-form-group flex-1">
                  <label className="serial-form-label">ボーレート (baud)</label>
                  <select
                    className="win95-select serial-select"
                    value={formBaudRate}
                    onChange={(e) => setFormBaudRate(Number(e.target.value))}
                  >
                    <option value={9600}>9600</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={57600}>57600</option>
                    <option value={115200}>115200 (推奨/ESP32標準)</option>
                    <option value={230400}>230400</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Configure Switches */}
              <div className="serial-form-section win95-fieldset">
                <legend className="serial-legend">ON/OFF スイッチの追加・管理</legend>
                <div className="serial-builder-add-row">
                  <input
                    type="text"
                    className="win95-input serial-input"
                    placeholder="スイッチ表示名 (例: 換気ファン)"
                    value={tempSwitchName}
                    onChange={(e) => setTempSwitchName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="win95-input serial-input"
                    placeholder='命令キー (例: "fan" または "relay1")'
                    value={tempSwitchAction}
                    onChange={(e) => setTempSwitchAction(e.target.value)}
                  />
                  <button type="button" className="win95-btn" onClick={handleAddSwitchToForm}>
                    ➕ 追加
                  </button>
                </div>

                <div className="serial-items-preview-list win95-inset">
                  {formSwitches.length === 0 ? (
                    <div className="serial-preview-empty">スイッチは登録されていません</div>
                  ) : (
                    formSwitches.map((sw) => (
                      <div key={sw.id} className="serial-item-preview-badge">
                        <span><strong>{sw.name}</strong> (action: <code>{sw.action}</code>)</span>
                        <button
                          type="button"
                          className="win95-btn serial-badge-del"
                          onClick={() => handleRemoveSwitchFromForm(sw.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Step 4: Configure Command Buttons */}
              <div className="serial-form-section win95-fieldset">
                <legend className="serial-legend">命令ボタンの追加・管理</legend>
                <div className="serial-builder-add-row">
                  <input
                    type="text"
                    className="win95-input serial-input"
                    placeholder="ボタン表示名 (例: 緊急停止)"
                    value={tempButtonName}
                    onChange={(e) => setTempButtonName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="win95-input serial-input"
                    placeholder='命令キー (例: "emergency" または "open")'
                    value={tempButtonAction}
                    onChange={(e) => setTempButtonAction(e.target.value)}
                  />
                  <button type="button" className="win95-btn" onClick={handleAddButtonToForm}>
                    ➕ 追加
                  </button>
                </div>

                <div className="serial-items-preview-list win95-inset">
                  {formButtons.length === 0 ? (
                    <div className="serial-preview-empty">命令ボタンは登録されていません</div>
                  ) : (
                    formButtons.map((btn) => (
                      <div key={btn.id} className="serial-item-preview-badge">
                        <span><strong>{btn.name}</strong> (command: <code>{btn.action}</code>)</span>
                        <button
                          type="button"
                          className="win95-btn serial-badge-del"
                          onClick={() => handleRemoveButtonFromForm(btn.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="serial-modal-footer">
                <button type="button" className="win95-btn" onClick={() => setShowConfigModal(false)}>
                  キャンセル
                </button>
                <button type="submit" className="win95-btn serial-modal-save-btn">
                  💾 {modalMode === 'new' ? '設定を保存して登録' : '変更を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
