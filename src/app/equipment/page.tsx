'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { EquipmentGrid } from '../../components/equipment/EquipmentGrid';
import { EquipmentItem } from '../../lib/types';
import '../../styles/app-shell.css';
import '../../styles/equipment.css';

import { SerialDeviceManager } from '../../components/equipment/SerialDeviceManager';

export default function EquipmentPage() {
  const { socket, connected } = useSocket();
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'network' | 'serial'>('serial');

  useEffect(() => {
    if (!socket) return;

    socket.emit('equipment:get_all');

    socket.on('equipment:init', (items) => {
      setEquipments(items);
    });

    socket.on('equipment:updated', (item) => {
      setEquipments((prev) => {
        const index = prev.findIndex((e) => e.id === item.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = item;
          return next;
        }
        return [...prev, item];
      });
    });

    socket.on('equipment:removed', ({ id }) => {
      setEquipments((prev) => prev.filter((e) => e.id !== id));
    });

    return () => {
      socket.off('equipment:init');
      socket.off('equipment:updated');
      socket.off('equipment:removed');
    };
  }, [socket]);

  const handleControl = (id: string, action: string, value: any) => {
    if (socket) {
      socket.emit('equipment:control', { id, action, value });
    }
  };

  const handleAdd = (item: Omit<EquipmentItem, 'updatedAt'>) => {
    if (socket) {
      socket.emit('equipment:add', item);
    }
  };

  const handleRemove = (id: string) => {
    if (socket) {
      socket.emit('equipment:remove', { id });
    }
  };

  return (
    <div className="app-shell">
      {/* Title bar */}
      <div className="win95-titlebar app-titlebar">
        <div className="app-titlebar-left">
          <span className="app-titlebar-title">[機材制御] 機材演出制御盤</span>
          <span className={`app-connection-badge${connected ? ' online' : ''}`}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="app-titlebar-nav">
          <FullscreenButton className="app-nav-btn" />
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="equipment-tab-bar win95-window">
        <button
          className={`win95-btn equipment-subtab-btn ${activeTab === 'serial' ? 'active' : ''}`}
          onClick={() => setActiveTab('serial')}
        >
          USBマイコン端末管理・シリアル制御 (Web Serial)
        </button>
        <button
          className={`win95-btn equipment-subtab-btn ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          ネットワーク機材同期盤 (Socket.io / Wi-Fi / BLE)
        </button>
      </div>

      {/* Main Area */}
      <div className="equipment-main">
        {activeTab === 'serial' ? (
          <SerialDeviceManager />
        ) : (
          <EquipmentGrid
            equipments={equipments}
            onControl={handleControl}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="win95-statusbar app-statusbar">
        <div className="win95-statusbar-item app-statusbar-item-wide">
          機材ステータス: 正常同期中 (equipments.json 永続化有効)
        </div>
        <div className="win95-statusbar-item app-statusbar-item-medium">
          稼働設備: {equipments.filter((e) => !!e.state).length} / {equipments.length}
        </div>
        <div className="win95-statusbar-item">
          ESP32 / BLE / RELAY HUB
        </div>
      </div>
    </div>
  );
}
