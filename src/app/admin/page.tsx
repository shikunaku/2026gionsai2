'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { DeviceMonitor } from '../../components/admin/DeviceMonitor';
import { PhotoReviewQueue } from '../../components/admin/PhotoReviewQueue';
import { EffectTriggerPanel } from '../../components/admin/EffectTriggerPanel';
import { CastManualViewer } from '../../components/admin/CastManualViewer';
import { DeviceInfo, DevicePhase, PhotoSubmission, EquipmentItem } from '../../lib/types';

export default function AdminPage() {
  const { socket, connected } = useSocket();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [submissions, setSubmissions] = useState<PhotoSubmission[]>([]);
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('admin:join');

    socket.on('admin:state_sync', (state) => {
      setDevices(state.devices);
      setSubmissions(state.submissions);
      setEquipments(state.equipments);
    });

    return () => {
      socket.off('admin:state_sync');
    };
  }, [socket]);

  // Handlers
  const handleDevicePhaseChange = (deviceId: string, phase: DevicePhase) => {
    if (socket) {
      socket.emit('admin:override_phase', { targetDeviceId: deviceId, phase });
    }
  };

  const handleIndividualGlitch = (deviceId: string) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        targetDeviceId: deviceId,
        effectType: 'glitch',
        options: { level: 2, duration: 2500, mode: 'creepy', vibrate: true },
      });
    }
  };

  const handleIndividualTorch = (deviceId: string) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        targetDeviceId: deviceId,
        effectType: 'torch',
        options: { flicker: true, count: 5, intervalMs: 120 },
      });
    }
  };

  const handleReviewPhoto = (submissionId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    if (socket) {
      socket.emit('admin:review_photo', {
        submissionId,
        status,
        reason,
      });
    }
  };

  const handleOverrideAllPhase = (phase: DevicePhase) => {
    if (socket) {
      socket.emit('admin:override_phase', { phase });
    }
  };

  const handleTriggerGlitch = (options: any) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        effectType: 'glitch',
        options,
      });
    }
  };

  const handleTriggerSound = (soundType: string, level?: number) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        effectType: 'sound',
        options: { soundType, level },
      });
    }
  };

  const handleTriggerTorch = (options: any) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        effectType: 'torch',
        options,
      });
    }
  };

  const handleSetVolume = (volume: number) => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        effectType: 'volume',
        options: { volume },
      });
    }
  };

  const handleEmergencyAllLight = () => {
    if (socket) {
      socket.emit('admin:emergency_all_light');
    }
  };

  const handleTriggerShutdown = () => {
    if (socket) {
      socket.emit('admin:trigger_effect', {
        effectType: 'shutdown',
        options: {},
      });
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
      {/* Top Application Bar */}
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
          <span style={{ fontWeight: 'bold' }}>[統括管理] 集中管理コンソール</span>
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
            <button className="win95-btn" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px' }} title="ポータル">
              [ポータル]
            </button>
          </Link>
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <button className="win95-btn active" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px', fontWeight: 'bold', backgroundColor: '#b5b2aa' }} title="管理コンソール移動（現在の画面）">
              [管理コンソール]
            </button>
          </Link>
          <Link href="/equipment" style={{ textDecoration: 'none' }}>
            <button className="win95-btn" style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px' }} title="機材制御盤">
              [機材制御盤]
            </button>
          </Link>
          <FullscreenButton style={{ padding: '3px 10px', fontSize: '11px', minHeight: '28px' }} />
        </div>
      </div>

      {/* Main 4-Column Working Area */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '270px 1fr 500px 350px',
          gap: '6px',
          padding: '6px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Column 1: Device Monitor */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <DeviceMonitor
            devices={devices}
            onPhaseChange={handleDevicePhaseChange}
            onIndividualGlitch={handleIndividualGlitch}
            onIndividualTorch={handleIndividualTorch}
          />
        </div>

        {/* Column 2: Photo Review Queue (Narrowed/Optimized) */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <PhotoReviewQueue
            submissions={submissions}
            onReview={handleReviewPhoto}
          />
        </div>

        {/* Column 3: Cast & Operator Manual (PDF Viewer) */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <CastManualViewer pdfUrl="/cast-manual.pdf" />
        </div>

        {/* Column 4: Master Effects & Remote Control */}
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <EffectTriggerPanel
            onOverrideAllPhase={handleOverrideAllPhase}
            onTriggerGlitch={handleTriggerGlitch}
            onTriggerSound={handleTriggerSound}
            onTriggerTorch={handleTriggerTorch}
            onSetVolume={handleSetVolume}
            onEmergencyAllLight={handleEmergencyAllLight}
            onTriggerShutdown={handleTriggerShutdown}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="win95-statusbar" style={{ flexShrink: 0, padding: '2px 6px' }}>
        <div className="win95-statusbar-item" style={{ flex: 2 }}>
          システム正常稼働中 | 端末総数: {devices.length}台 (審査中: {submissions.filter(s => s.status === 'PENDING').length}件)
        </div>
        <div className="win95-statusbar-item" style={{ flex: 1 }}>
          機材登録数: {equipments.length}系統
        </div>
        <div className="win95-statusbar-item">
          SECURE PROTOCOL v2.0
        </div>
      </div>
    </div>
  );
}
