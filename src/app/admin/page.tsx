'use client';

/**
 * @file page.tsx (Admin Console)
 * @description アトラクション集中管理コンソール。
 * PDA端末監視、写真審査、機材・演出トリガー、音響専用ノード (Sound Node) の死活監視および一斉発火、
 * そしてオフライン検知・再接続モーダルを統合提供します。
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { ReconnectingModal } from '../../components/common/ReconnectingModal';
import { DeviceMonitor } from '../../components/admin/DeviceMonitor';
import { PhotoReviewQueue } from '../../components/admin/PhotoReviewQueue';
import { EffectTriggerPanel } from '../../components/admin/EffectTriggerPanel';
import {
  DeviceInfo,
  DevicePhase,
  PhotoSubmission,
  EquipmentItem,
  SoundEffectOptions,
  GlitchEffectOptions,
  TorchEffectOptions,
} from '../../lib/types';
import '../../styles/app-shell.css';
import '../../styles/admin.css';

type EffectType = 'glitch' | 'torch' | 'sound' | 'volume' | 'shutdown';

export default function AdminPage() {
  const { socket, connected, isReconnecting, reconnectAttempts, isOnline, manualReconnect } = useSocket();
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

  // --------------------------------------------------------------------------
  // エフェクト & 端末操作ハンドラー
  // --------------------------------------------------------------------------

  const triggerEffect = (effectType: EffectType, options: unknown, targetDeviceId?: string) => {
    socket?.emit('admin:trigger_effect', { targetDeviceId, effectType, options });
  };

  const handleDevicePhaseChange = (deviceId: string, phase: DevicePhase) => {
    socket?.emit('admin:override_phase', { targetDeviceId: deviceId, phase });
  };

  const handleIndividualGlitch = (deviceId: string) => {
    triggerEffect('glitch', { level: 2, duration: 2500, mode: 'creepy', vibrate: true } as GlitchEffectOptions, deviceId);
  };

  const handleIndividualTorch = (deviceId: string) => {
    // Eerie horror blink rhythm: "ぴかっ...ぴかっ...ぴかっ..."
    triggerEffect('torch', { pattern: '1,0,0,1,0,0,1,0,0,0', intervalMs: 120 } as TorchEffectOptions, deviceId);
  };

  /** サウンドノード宛ての個別効果音・ファイル再生 */
  const handleIndividualSound = (
    deviceId: string,
    soundType: SoundEffectOptions['soundType'],
    filename?: string,
    volume = 1.5
  ) => {
    socket?.emit('sound:trigger', {
      targetDeviceId: deviceId,
      soundType,
      filename,
      volume,
      level: 4,
    });
  };

  /** サウンド専用ノード (Sound Nodes) に対する演出発火 (一斉または個別指定) */
  const handleTriggerSoundNode = (
    soundType: string,
    level = 3,
    volume = 1.5,
    filename?: string,
    targetDeviceId?: string
  ) => {
    socket?.emit('sound:trigger', {
      targetDeviceId,
      soundType: soundType as SoundEffectOptions['soundType'],
      filename,
      volume,
      level,
    });
  };

  /** 全体・全ノードに対するMP3/音声ファイル再生指示 */
  const handleTriggerFileSound = (filename: string, volume = 1.0, loop = false) => {
    if (!filename) return;
    // 1. 全体端末 (PDA) 向け
    triggerEffect('sound', { soundType: 'file', filename, volume, loop });
    // 2. 音響専用ノード (Sound Nodes) 向け
    socket?.emit('sound:trigger', {
      soundType: 'file',
      filename,
      volume,
      loop,
    });
  };

  const handleReviewPhoto = (submissionId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    socket?.emit('admin:review_photo', { submissionId, status, reason });
  };

  const handleOverrideAllPhase = (phase: DevicePhase) => {
    socket?.emit('admin:override_phase', { phase });
  };

  const handleTriggerGlitch = (options: GlitchEffectOptions) => triggerEffect('glitch', options);

  const handleTriggerSound = (soundType: string, level?: number) =>
    triggerEffect('sound', { soundType, level });

  const handleTriggerTorch = (options: TorchEffectOptions) => triggerEffect('torch', options);

  const handleSetVolume = (volume: number) => triggerEffect('volume', { volume });

  const handleEmergencyAllLight = () => {
    socket?.emit('admin:emergency_all_light');
  };

  const handleTriggerShutdown = () => triggerEffect('shutdown', {});

  // 機材・エレベータ・映像ハンドラー
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

  const handleTriggerPanic = () => {
    socket?.emit('panic:trigger', { reason: 'ADMIN_MANUAL_TRIGGER' });
  };

  return (
    <div className="app-shell">
      {/* オフライン・再接続通知ダイアログ */}
      <ReconnectingModal
        isReconnecting={isReconnecting}
        isOnline={isOnline}
        reconnectAttempts={reconnectAttempts}
        onManualReconnect={manualReconnect}
      />

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
            <button className="win95-btn app-nav-btn active" title="管理コンソール（現在の画面）">
              [管理コンソール]
            </button>
          </Link>
          <Link href="/admin/cctv" className="app-nav-link" target="_blank">
            <button className="win95-btn app-nav-btn" title="監視カメラ専用モニタリング画面 (別タブ)">
              [監視CCTV]
            </button>
          </Link>
          <Link href="/display/sound" className="app-nav-link" target="_blank">
            <button className="win95-btn app-nav-btn" title="音響専用ノード画面を開く">
              [音響ノード]
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

      {/* Main 3-Column Working Area (端末監視, 写真審査, 演出制御) */}
      <div className="admin-workspace">
        <div className="app-column">
          <DeviceMonitor
            devices={devices}
            onPhaseChange={handleDevicePhaseChange}
            onIndividualGlitch={handleIndividualGlitch}
            onIndividualTorch={handleIndividualTorch}
            onIndividualSound={handleIndividualSound}
          />
        </div>

        <div className="app-column">
          <PhotoReviewQueue submissions={submissions} onReview={handleReviewPhoto} />
        </div>

        <div className="app-column">
          <EffectTriggerPanel
            devices={devices}
            equipments={equipments}
            onOverrideAllPhase={handleOverrideAllPhase}
            onTriggerGlitch={handleTriggerGlitch}
            onTriggerSound={handleTriggerSound}
            onTriggerSoundNode={handleTriggerSoundNode}
            onTriggerFileSound={handleTriggerFileSound}
            onTriggerTorch={handleTriggerTorch}
            onSetVolume={handleSetVolume}
            onEmergencyAllLight={handleEmergencyAllLight}
            onTriggerShutdown={handleTriggerShutdown}
            onTriggerPanic={handleTriggerPanic}
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
