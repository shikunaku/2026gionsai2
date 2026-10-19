'use client';

import React, { useState, useEffect } from 'react';
import {
  SerialDeviceConfig,
  SerialSwitchConfig,
  SerialButtonConfig,
} from '../../lib/types';
import { requestSerialPort } from '../../lib/webSerial';

interface SerialConfigModalProps {
  isOpen: boolean;
  mode: 'new' | 'edit';
  initialDevice: SerialDeviceConfig | null;
  onClose: () => void;
  onSave: (device: SerialDeviceConfig, isNew: boolean) => void;
  onPortSelected: (deviceId: string, port: any) => void;
  isWebSerialSupported: boolean;
}

// Reusable Sub-Section for adding & previewing items (Switches / Buttons)
interface ItemBuilderProps {
  title: string;
  namePlaceholder: string;
  actionPlaceholder: string;
  items: { id: string; name: string; action: string }[];
  onAdd: (name: string, action: string) => void;
  onRemove: (id: string) => void;
}

const ItemBuilderSection: React.FC<ItemBuilderProps> = ({
  title,
  namePlaceholder,
  actionPlaceholder,
  items,
  onAdd,
  onRemove,
}) => {
  const [name, setName] = useState('');
  const [action, setAction] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !action.trim()) {
      alert('名称と命令キーを入力してください。');
      return;
    }
    onAdd(name.trim(), action.trim());
    setName('');
    setAction('');
  };

  return (
    <div className="serial-form-section win95-fieldset">
      <legend className="serial-legend">{title}</legend>
      <div className="serial-builder-add-row">
        <input
          type="text"
          className="win95-input serial-input"
          placeholder={namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          className="win95-input serial-input"
          placeholder={actionPlaceholder}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <button type="button" className="win95-btn" onClick={handleAdd}>
          ➕ 追加
        </button>
      </div>

      <div className="serial-items-preview-list win95-inset">
        {items.length === 0 ? (
          <div className="serial-preview-empty">未登録です</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="serial-item-preview-badge">
              <span><strong>{item.name}</strong> (<code>{item.action}</code>)</span>
              <button
                type="button"
                className="win95-btn serial-badge-del"
                onClick={() => onRemove(item.id)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const SerialConfigModal: React.FC<SerialConfigModalProps> = ({
  isOpen,
  mode,
  initialDevice,
  onClose,
  onSave,
  onPortSelected,
  isWebSerialSupported,
}) => {
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPortName, setFormPortName] = useState('');
  const [formVid, setFormVid] = useState<number | undefined>(undefined);
  const [formPid, setFormPid] = useState<number | undefined>(undefined);
  const [formBaudRate, setFormBaudRate] = useState<number>(115200);
  const [formSwitches, setFormSwitches] = useState<SerialSwitchConfig[]>([]);
  const [formButtons, setFormButtons] = useState<SerialButtonConfig[]>([]);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialDevice) {
      setFormId(initialDevice.id);
      setFormName(initialDevice.name);
      setFormPortName(initialDevice.portName || '');
      setFormVid(initialDevice.usbVendorId);
      setFormPid(initialDevice.usbProductId);
      setFormBaudRate(initialDevice.baudRate || 115200);
      setFormSwitches([...initialDevice.switches]);
      setFormButtons([...initialDevice.buttons]);
    } else {
      const newId = `dev_${Date.now()}`;
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
    }
  }, [isOpen, mode, initialDevice]);

  if (!isOpen) return null;

  const handleDetectPort = async () => {
    if (!isWebSerialSupported) {
      alert('お使いのブラウザはWeb Serial APIに対応していません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
      return;
    }
    setDetecting(true);
    try {
      const { port, info } = await requestSerialPort();
      onPortSelected(formId, port);

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
      connected: initialDevice?.id === formId ? initialDevice.connected : false,
      createdAt: initialDevice?.createdAt || new Date().toISOString(),
    };

    onSave(deviceData, mode === 'new');
    onClose();
  };

  return (
    <div className="win95-modal-backdrop">
      <div className="win95-window serial-modal-content">
        <div className="win95-titlebar serial-modal-titlebar">
          <span>{mode === 'new' ? 'マイコン端末の新規追加 & 設定' : 'マイコン端末の設定編集'}</span>
          <button className="win95-btn serial-close-modal-btn" onClick={onClose}>
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
          <ItemBuilderSection
            title="ON/OFF スイッチの追加・管理"
            namePlaceholder="スイッチ表示名 (例: 換気ファン)"
            actionPlaceholder='命令キー (例: "fan" または "relay1")'
            items={formSwitches}
            onAdd={(swName, swAction) => {
              setFormSwitches((prev) => [
                ...prev,
                { id: `sw_${Date.now()}`, name: swName, action: swAction, state: false },
              ]);
            }}
            onRemove={(id) => setFormSwitches((prev) => prev.filter((s) => s.id !== id))}
          />

          {/* Step 4: Configure Command Buttons */}
          <ItemBuilderSection
            title="命令ボタンの追加・管理"
            namePlaceholder="ボタン表示名 (例: 緊急停止)"
            actionPlaceholder='命令キー (例: "emergency" または "open")'
            items={formButtons}
            onAdd={(btnName, btnAction) => {
              setFormButtons((prev) => [
                ...prev,
                { id: `btn_${Date.now()}`, name: btnName, action: btnAction },
              ]);
            }}
            onRemove={(id) => setFormButtons((prev) => prev.filter((b) => b.id !== id))}
          />

          {/* Footer Buttons */}
          <div className="serial-modal-footer">
            <button type="button" className="win95-btn" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="win95-btn serial-modal-save-btn">
              💾 {mode === 'new' ? '設定を保存して登録' : '変更を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
