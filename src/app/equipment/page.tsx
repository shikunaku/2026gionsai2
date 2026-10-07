'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { EquipmentGrid } from '../../components/equipment/EquipmentGrid';
import { EquipmentItem } from '../../lib/types';
import '../../styles/app-shell.css';
import '../../styles/equipment.css';

export default function EquipmentPage() {
  const { socket, connected } = useSocket();
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);

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
          <Link href="/" className="app-nav-link">
            <button className="win95-btn app-nav-btn" title="ポータル移動">
              [ポータル]
            </button>
          </Link>
          <Link href="/admin" className="app-nav-link">
            <button className="win95-btn app-nav-btn" title="管理コンソール移動">
              [管理コンソール]
            </button>
          </Link>
          <Link href="/equipment" className="app-nav-link">
            <button className="win95-btn app-nav-btn active" title="機材制御盤（現在の画面）">
              [機材制御盤]
            </button>
          </Link>
          <FullscreenButton className="app-nav-btn" />
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="equipment-main">
        <EquipmentGrid
          equipments={equipments}
          onControl={handleControl}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
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
