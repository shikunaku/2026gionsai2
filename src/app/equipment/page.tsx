'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { EquipmentGrid } from '../../components/equipment/EquipmentGrid';
import { EquipmentItem } from '../../lib/types';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#c7c4bd',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        className="win95-titlebar"
        style={{
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold' }}>[機材制御] 機材演出制御盤</span>
          <span
            style={{
              fontSize: '11px',
              backgroundColor: connected ? '#38694a' : '#8c4242',
              color: '#f4f7f5',
              padding: '2px 6px',
              borderRadius: '2px',
            }}
          >
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button className="win95-btn" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px' }} title="ポータルへ移動">
              [ポータル]
            </button>
          </Link>
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <button className="win95-btn" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px', fontWeight: 'bold' }} title="管理コンソールへ移動">
              [管理コンソールへ]
            </button>
          </Link>
          <Link href="/equipment" style={{ textDecoration: 'none' }}>
            <button className="win95-btn active" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px', fontWeight: 'bold', backgroundColor: '#b5b2aa' }} title="機材制御盤（現在の画面）">
              [機材制御盤]
            </button>
          </Link>
          <FullscreenButton style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px' }} />
        </div>
      </div>

      {/* Main Grid Area */}
      <div style={{ flex: 1, padding: '8px', overflow: 'hidden' }}>
        <EquipmentGrid
          equipments={equipments}
          onControl={handleControl}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </div>

      {/* Status Bar */}
      <div className="win95-statusbar" style={{ flexShrink: 0, padding: '2px 6px' }}>
        <div className="win95-statusbar-item" style={{ flex: 2 }}>
          機材ステータス: 正常同期中 (equipments.json 永続化有効)
        </div>
        <div className="win95-statusbar-item" style={{ flex: 1 }}>
          稼働設備: {equipments.filter((e) => !!e.state).length} / {equipments.length}
        </div>
        <div className="win95-statusbar-item">
          ESP32 / BLE / RELAY HUB
        </div>
      </div>
    </div>
  );
}
