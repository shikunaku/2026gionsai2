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
import '../../styles/app-shell.css';
import '../../styles/admin.css';

type EffectType = 'glitch' | 'torch' | 'sound' | 'volume' | 'shutdown';

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
  const triggerEffect = (effectType: EffectType, options: any, targetDeviceId?: string) => {
    socket?.emit('admin:trigger_effect', { targetDeviceId, effectType, options });
  };

  const handleDevicePhaseChange = (deviceId: string, phase: DevicePhase) => {
    socket?.emit('admin:override_phase', { targetDeviceId: deviceId, phase });
  };

  const handleIndividualGlitch = (deviceId: string) => {
    triggerEffect('glitch', { level: 2, duration: 2500, mode: 'creepy', vibrate: true }, deviceId);
  };

  const handleIndividualTorch = (deviceId: string) => {
    // Eerie horror blink rhythm: "ぴかっ...ぴかっ...ぴかっ..."
    triggerEffect('torch', { pattern: '1,0,0,1,0,0,1,0,0,0', intervalMs: 120 }, deviceId);
  };

  const handleReviewPhoto = (submissionId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    socket?.emit('admin:review_photo', { submissionId, status, reason });
  };

  const handleOverrideAllPhase = (phase: DevicePhase) => {
    socket?.emit('admin:override_phase', { phase });
  };

  const handleTriggerGlitch = (options: any) => triggerEffect('glitch', options);

  const handleTriggerSound = (soundType: string, level?: number) =>
    triggerEffect('sound', { soundType, level });

  const handleTriggerTorch = (options: any) => triggerEffect('torch', options);

  const handleSetVolume = (volume: number) => triggerEffect('volume', { volume });

  const handleEmergencyAllLight = () => {
    socket?.emit('admin:emergency_all_light');
  };

  const handleTriggerShutdown = () => triggerEffect('shutdown', {});

  // New Equipment & Display Direct Handlers
  const handleElevatorSetFloor = (floor: 'FLOOR_1' | 'MOVING' | 'FLOOR_B1' | 'OFF') => {
    socket?.emit('elevator:set_floor', { floor });
  };

  const handleElevatorTriggerMove = () => {
    socket?.emit('elevator:trigger_move', {});
  };

  const handleElevatorGlitch = () => {
    socket?.emit('elevator:trigger_glitch', { duration: 1500 });
  };

  const handleConveyorControl = (action: 'forward' | 'reverse' | 'stop') => {
    socket?.emit('conveyor:control', { action, speed: 100 });
  };

  const handleTriggerVideoPlay = () => {
    socket?.emit('video:trigger_play', {});
  };

  return (
    <div className="app-shell">
      {/* Top Application Bar */}
      <div className="win95-titlebar app-titlebar">
        <div className="app-titlebar-left">
          <span>[統括管理] 集中管理コンソール</span>
          <span className={`app-connection-badge ${connected ? 'online' : ''}`}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="app-titlebar-nav">
          <Link href="/" className="app-nav-link">
            <button className="win95-btn app-nav-btn" title="ポータル">
              [ポータル]
            </button>
          </Link>
          <Link href="/admin" className="app-nav-link">
            <button className="win95-btn app-nav-btn active" title="管理コンソール移動（現在の画面）">
              [管理コンソール]
            </button>
          </Link>
          <Link href="/elevator-display" className="app-nav-link" target="_blank">
            <button className="win95-btn app-nav-btn" title="エレベータ階数表示画面">
              [エレベータ画面]
            </button>
          </Link>
          <Link href="/display/video" className="app-nav-link" target="_blank">
            <button className="win95-btn app-nav-btn" title="エリア3映像再生端末">
              [エリア3映像画面]
            </button>
          </Link>
          <Link href="/equipment" className="app-nav-link">
            <button className="win95-btn app-nav-btn" title="機材制御盤">
              [機材制御盤]
            </button>
          </Link>
          <FullscreenButton className="app-nav-btn" />
        </div>
      </div>

      {/* Main 4-Column Working Area */}
      <div className="admin-workspace">
        <div className="app-column">
          <DeviceMonitor
            devices={devices}
            onPhaseChange={handleDevicePhaseChange}
            onIndividualGlitch={handleIndividualGlitch}
            onIndividualTorch={handleIndividualTorch}
          />
        </div>

        <div className="app-column">
          <PhotoReviewQueue submissions={submissions} onReview={handleReviewPhoto} />
        </div>

        <div className="app-column">
          <CastManualViewer pdfUrl="/cast-manual.pdf" />
        </div>

        <div className="app-column">
          <EffectTriggerPanel
            onOverrideAllPhase={handleOverrideAllPhase}
            onTriggerGlitch={handleTriggerGlitch}
            onTriggerSound={handleTriggerSound}
            onTriggerTorch={handleTriggerTorch}
            onSetVolume={handleSetVolume}
            onEmergencyAllLight={handleEmergencyAllLight}
            onTriggerShutdown={handleTriggerShutdown}
            onElevatorSetFloor={handleElevatorSetFloor}
            onElevatorTriggerMove={handleElevatorTriggerMove}
            onElevatorGlitch={handleElevatorGlitch}
            onConveyorControl={handleConveyorControl}
            onTriggerVideoPlay={handleTriggerVideoPlay}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="win95-statusbar app-statusbar">
        <div className="win95-statusbar-item app-statusbar-item-wide">
          システム正常稼働中 | 端末総数: {devices.length}台 (審査中: {submissions.filter((s) => s.status === 'PENDING').length}件)
        </div>
        <div className="win95-statusbar-item app-statusbar-item-medium">
          機材登録数: {equipments.length}系統
        </div>
        <div className="win95-statusbar-item">SECURE PROTOCOL v2.0</div>
      </div>
    </div>
  );
}
