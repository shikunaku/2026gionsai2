'use client';

import React, { useState } from 'react';
import { EquipmentItem } from '../../lib/types';
import '../../styles/equipment.css';

interface EquipmentGridProps {
  equipments: EquipmentItem[];
  onControl: (id: string, action: string, value: any) => void;
  onAdd: (item: Omit<EquipmentItem, 'updatedAt'>) => void;
  onRemove: (id: string) => void;
}

export const EquipmentGrid: React.FC<EquipmentGridProps> = ({
  equipments,
  onControl,
  onAdd,
  onRemove,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'relay' | 'servo' | 'light' | 'fan' | 'custom'>('relay');
  const [newTopic, setNewTopic] = useState('');
  const [newMcuId, setNewMcuId] = useState('ESP32_MAIN');
  const [newProtocol, setNewProtocol] = useState<'serial' | 'wifi' | 'ble'>('serial');
  const [newEndpoint, setNewEndpoint] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;
    onAdd({
      id: newId,
      name: newName,
      type: newType,
      state: false,
      topic: newTopic || `mcu/${newType}/${newId}`,
      mcuId: newMcuId || 'ESP32_MAIN',
      protocol: newProtocol,
      endpoint: newEndpoint,
    });
    setNewId('');
    setNewName('');
    setNewTopic('');
    setNewMcuId('ESP32_MAIN');
    setNewProtocol('serial');
    setNewEndpoint('');
    setShowAddModal(false);
  };

  const getEquipmentTag = (type: string) => {
    switch (type) {
      case 'relay':
        return '[RELAY]';
      case 'servo':
        return '[SERVO]';
      case 'light':
        return '[LIGHT]';
      case 'fan':
        return '[FAN]';
      default:
        return '[DEVICE]';
    }
  };

  const getProtocolBadge = (protocol?: string) => {
    switch (protocol) {
      case 'wifi':
        return <span className="equipment-protocol wifi">Wi-Fi</span>;
      case 'ble':
        return <span className="equipment-protocol ble">Bluetooth</span>;
      default:
        return <span className="equipment-protocol">有線シリアル</span>;
    }
  };

  return (
    <div className="equipment-grid-root">
      {/* Action Toolbar */}
      <div className="win95-window equipment-toolbar">
        <div className="equipment-toolbar-row">
          <div className="equipment-toolbar-title">
            登録設備・マルチMCU演出制御盤 ({equipments.length}系統)
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="win95-btn equipment-add-btn"
          >
            + 新規機器登録 [ADD]
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="equipment-cards">
        {equipments.map((eq) => {
          const isOn = !!eq.state;
          return (
            <div key={eq.id} className={`win95-window equipment-card${isOn ? ' on' : ''}`}>
              <div className="win95-titlebar equipment-card-titlebar">
                <span>
                  {getEquipmentTag(eq.type)} {eq.name}
                </span>
                <span className="equipment-card-state">{isOn ? 'ACTIVE' : 'IDLE'}</span>
              </div>

              <div className="equipment-card-body">
                <div className="equipment-card-info">
                  <div><strong>ID:</strong> {eq.id}</div>
                  <div><strong>種別:</strong> {eq.type.toUpperCase()}</div>
                  <div className="equipment-card-mcu-row">
                    <strong>担当マイコン:</strong>
                    <span className="equipment-card-mcu">{eq.mcuId || 'ESP32_MAIN'}</span>
                    {getProtocolBadge(eq.protocol)}
                  </div>
                  {eq.endpoint && (
                    <div><strong>接続先:</strong> <span className="equipment-card-endpoint">{eq.endpoint}</span></div>
                  )}
                  <div><strong>トピック:</strong> {eq.topic || 'N/A'}</div>
                  <div><strong>最終同期:</strong> {new Date(eq.updatedAt).toLocaleTimeString()}</div>
                </div>

                <div className="equipment-card-actions">
                  <button
                    onClick={() => onControl(eq.id, 'toggle', !isOn)}
                    className={`win95-btn equipment-toggle-btn${isOn ? ' on' : ''}`}
                  >
                    {isOn ? '通電中 (ON) -> 切断' : '停止中 (OFF) -> 起動'}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`設備 "${eq.name}" を削除しますか？`)) {
                        onRemove(eq.id);
                      }
                    }}
                    className="win95-btn win95-btn-danger equipment-remove-btn"
                    title="設備削除"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          className="equipment-modal-backdrop"
        >
          <div
            className="win95-window equipment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win95-titlebar">
              <span>新規機器・演出ギミック登録 (マルチMCU対応)</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="win95-btn equipment-modal-close"
              >
                [X]
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="equipment-form">
              <div className="equipment-form-fields">
                <div>
                  <label>機器ID (例: eq_valve_02):</label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="win95-inset equipment-form-input"
                  />
                </div>
                <div>
                  <label>機器表示名称:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="win95-inset equipment-form-input"
                  />
                </div>

                <div className="equipment-form-row">
                  <div>
                    <label>制御種別:</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="win95-inset equipment-form-input"
                    >
                      <option value="relay">リレー (Relay)</option>
                      <option value="servo">サーボ (Servo)</option>
                      <option value="light">照明・回転灯 (Light)</option>
                      <option value="fan">換気ファン (Fan)</option>
                      <option value="custom">カスタム (Custom)</option>
                    </select>
                  </div>

                  <div>
                    <label>通信方式 (プロトコル):</label>
                    <select
                      value={newProtocol}
                      onChange={(e) => setNewProtocol(e.target.value as any)}
                      className="win95-inset equipment-form-input"
                    >
                      <option value="serial">有線シリアル (USB/COM)</option>
                      <option value="wifi">Wi-Fi (WebSocket/TCP)</option>
                      <option value="ble">Bluetooth (BLE)</option>
                    </select>
                  </div>
                </div>

                <div className="equipment-form-row">
                  <div>
                    <label>担当マイコンID:</label>
                    <input
                      type="text"
                      value={newMcuId}
                      placeholder="ESP32_MAIN / ESP32_02"
                      onChange={(e) => setNewMcuId(e.target.value)}
                      className="win95-inset equipment-form-input"
                    />
                  </div>
                  <div>
                    <label>接続先 / ポート (任意):</label>
                    <input
                      type="text"
                      value={newEndpoint}
                      placeholder="COM4 / 192.168.1.10 / BLE_ID"
                      onChange={(e) => setNewEndpoint(e.target.value)}
                      className="win95-inset equipment-form-input"
                    />
                  </div>
                </div>

                <div>
                  <label>トピック:</label>
                  <input
                    type="text"
                    value={newTopic}
                    placeholder="mcu/device/topic"
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="win95-inset equipment-form-input"
                  />
                </div>
              </div>

              <div className="equipment-form-actions">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="win95-btn"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="win95-btn equipment-submit-btn"
                >
                  登録保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
