'use client';

import React, { useState } from 'react';
import { EquipmentItem } from '../../lib/types';

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;
    onAdd({
      id: newId,
      name: newName,
      type: newType,
      state: false,
      topic: newTopic || `mcu/${newType}/${newId}`,
    });
    setNewId('');
    setNewName('');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action Toolbar */}
      <div className="win95-window" style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#27292d' }}>
            登録設備・演出ギミック一覧 ({equipments.length}系統)
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="win95-btn"
            style={{ fontSize: '12px', padding: '6px 14px', minHeight: '32px' }}
          >
            + 新規機器登録 [ADD]
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '10px',
          alignContent: 'start',
        }}
      >
        {equipments.map((eq) => {
          const isOn = !!eq.state;
          return (
            <div key={eq.id} className="win95-window" style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                className="win95-titlebar"
                style={{
                  background: isOn
                    ? 'linear-gradient(90deg, #2c4159, #3f5d7d)'
                    : 'linear-gradient(90deg, #464a52, #585d66)',
                }}
              >
                <span>
                  {getEquipmentTag(eq.type)} {eq.name}
                </span>
                <span style={{ fontSize: '11px' }}>{isOn ? 'ACTIVE' : 'IDLE'}</span>
              </div>

              <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '11px', color: '#444850', marginBottom: '8px' }}>
                  <div><strong>ID:</strong> {eq.id}</div>
                  <div><strong>種別:</strong> {eq.type.toUpperCase()}</div>
                  <div><strong>トピック:</strong> {eq.topic || 'N/A'}</div>
                  <div><strong>最終同期:</strong> {new Date(eq.updatedAt).toLocaleTimeString()}</div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => onControl(eq.id, 'toggle', !isOn)}
                    className="win95-btn"
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      backgroundColor: isOn ? '#38694a' : '#c7c4bd',
                      color: isOn ? '#f0f5f1' : '#27292e',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}
                  >
                    {isOn ? '通電中 (ON) -> 切断' : '停止中 (OFF) -> 起動'}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`設備 "${eq.name}" を削除しますか？`)) {
                        onRemove(eq.id);
                      }
                    }}
                    className="win95-btn win95-btn-danger"
                    style={{ padding: '0 12px', minHeight: '38px', fontSize: '12px' }}
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(25, 28, 33, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="win95-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '100%' }}
          >
            <div className="win95-titlebar">
              <span>新規機器・演出ギミック登録</span>
              <button onClick={() => setShowAddModal(false)} className="win95-btn" style={{ padding: '0 6px', fontWeight: 'bold' }}>
                [X]
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', color: '#27292e' }}>機器ID (例: eq_lamp_01):</label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="win95-inset"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', color: '#27292e' }}>機器表示名称:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="win95-inset"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', color: '#27292e' }}>制御種別:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="win95-inset"
                    style={{ width: '100%' }}
                  >
                    <option value="relay">リレー (Relay)</option>
                    <option value="servo">サーボ (Servo)</option>
                    <option value="light">照明・回転灯 (Light)</option>
                    <option value="fan">換気ファン (Fan)</option>
                    <option value="custom">カスタム (Custom)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', color: '#27292e' }}>MQTT/MCUトピック:</label>
                  <input
                    type="text"
                    value={newTopic}
                    placeholder="mcu/device/topic"
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="win95-inset"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="win95-btn">
                  キャンセル
                </button>
                <button type="submit" className="win95-btn" style={{ fontWeight: 'bold', backgroundColor: '#38577a', color: '#f0f3f8' }}>
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
