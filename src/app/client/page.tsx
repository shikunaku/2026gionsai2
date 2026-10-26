'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useTorch } from '../../hooks/useTorch';
import { useBattery } from '../../hooks/useBattery';
import { useSoundEngine } from '../../hooks/useSoundEngine';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { ReconnectingModal } from '../../components/common/ReconnectingModal';
import { HorrorCanvasOverlay } from '../../components/client/HorrorCanvasOverlay';
import { PhaseInit } from '../../components/client/PhaseInit';
import { PhaseZone1 } from '../../components/client/PhaseZone1';
import { PhaseElevator } from '../../components/client/PhaseElevator';
import { PhaseArea2Conveyor } from '../../components/client/PhaseArea2Conveyor';
import { PhaseArea3Video } from '../../components/client/PhaseArea3Video';
import { PhasePanicEscape } from '../../components/client/PhasePanicEscape';
import { PhaseReturn } from '../../components/client/PhaseReturn';
import {
  DevicePhase,
  InspectionTask,
  GlitchEffectOptions,
  TorchEffectOptions,
  SoundEffectOptions,
  ElevatorFloorState,
} from '../../lib/types';
import '../../styles/client.css';

// Root container class per glitch mode (unknown modes fall back to 'glitch-creepy')
const GLITCH_CLASS: Record<string, string> = {
  violent: 'glitch-violent',
  invert: 'glitch-invert',
  blackout: 'glitch-blackout',
  redout: 'glitch-redout',
  static: 'glitch-static',
};

const INITIAL_TASKS: InspectionTask[] = [
  {
    id: 1,
    title: '検査試薬保管キャビネットの施錠確認',
    location: '1F 品質管理室 (北壁面)',
    targetDescription: '保管庫のメカニカルロックおよび密閉パッキンを撮影し、破損や薬品漏洩がないか確認してください。',
    status: 'UNINSPECTED',
  },
  {
    id: 2,
    title: '水質・成分分析計の液晶インジケーター',
    location: '1F 品質管理室 (中央検査台)',
    targetDescription: '分析装置の中央ディスプレイを撮影し、エラーランプ消灯および測定数値が安定しているか確認してください。',
    status: 'UNINSPECTED',
  },
  {
    id: 3,
    title: '廃液中和ドレンバルブの開閉状態',
    location: '1F 品質管理室 (南側排水孔)',
    targetDescription: '床面付近の赤いドレンハンドルを撮影し、バルブが「閉」位置で固定されているか記録してください。',
    status: 'UNINSPECTED',
  },
];

function ClientContent() {
  const searchParams = useSearchParams();
  const [deviceId, setDeviceId] = useState<string>('0001');
  const [isClientMounted, setIsClientMounted] = useState<boolean>(false);
  const [phase, setPhase] = useState<DevicePhase>('STANDBY');
  const [tasks, setTasks] = useState<InspectionTask[]>(INITIAL_TASKS);
  const [glitchOptions, setGlitchOptions] = useState<GlitchEffectOptions | null>(null);
  const [elevatorFloor, setElevatorFloor] = useState<ElevatorFloorState>('FLOOR_1');

  const { socket, connected, isReconnecting, reconnectAttempts, isOnline, manualReconnect } = useSocket();
  const soundEngine = useSoundEngine();

  // Torch state management
  const handleTorchStateChange = useCallback(
    (torchState: boolean) => {
      if (socket && connected) {
        socket.emit('device:flash_state', { deviceId, flashState: torchState });
      }
    },
    [socket, connected, deviceId]
  );

  const { torchOn, screenFlashActive, setTorch, toggleTorch, flicker, blinkPattern, stopBlink } =
    useTorch(handleTorchStateChange);

  // Battery monitoring synchronization (every 5 seconds)
  const handleBatterySync = useCallback(
    (batteryLevel: number, charging: boolean) => {
      if (socket && connected) {
        socket.emit('device:battery_update', {
          deviceId,
          batteryLevel,
          charging,
        });
      }
    },
    [socket, connected, deviceId]
  );

  const { level: batteryLevel, charging } = useBattery(handleBatterySync);

  // Initialize random 4-digit device ID or read from URL
  useEffect(() => {
    setIsClientMounted(true);
    const qId = searchParams.get('deviceId');
    if (qId) {
      setDeviceId(qId.toUpperCase());
    } else {
      const rand = Math.floor(1000 + Math.random() * 9000).toString();
      setDeviceId(rand);
    }
  }, [searchParams]);

  // Handle Socket Events from Server
  useEffect(() => {
    if (!socket) return;

    // Phase update from admin
    socket.on('phase:update', ({ phase: newPhase, deviceId: targetDevId }) => {
      if (!targetDevId || targetDevId === deviceId) {
        console.log(`[Client] Phase updated to: ${newPhase}`);
        setPhase(newPhase);
      }
    });

    // Elevator state
    socket.on('elevator:state', ({ floor }) => {
      console.log(`[Client] Elevator state updated: ${floor}`);
      setElevatorFloor(floor);
    });

    // Review result
    socket.on('task:review_result', ({ taskId, status, reason }) => {
      console.log(`[Client] Review result received for Task ${taskId}: ${status}`);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status, rejectionReason: reason } : t
        )
      );

      if (status === 'APPROVED') {
        soundEngine.playTaskSuccess();
        if ('vibrate' in navigator) navigator.vibrate([80, 40, 140]);
      } else if (status === 'REJECTED') {
        soundEngine.playBeep(440, 0.2);
        if ('vibrate' in navigator) navigator.vibrate(300);
      }
    });

    // Glitch effect
    socket.on('effect:glitch', (options) => {
      console.log('[Client] Glitch effect triggered:', options);
      setGlitchOptions(options);

      if (options.vibrate && 'vibrate' in navigator) {
        navigator.vibrate(options.mode === 'violent' ? [150, 80, 200, 100, 300] : [200, 100, 200]);
      }

      setTimeout(() => {
        setGlitchOptions(null);
      }, options.duration || 3000);
    });

    // Torch effect
    socket.on('effect:torch', ({ state, flicker: shouldFlicker, count, intervalMs, pattern, stop }) => {
      console.log('[Client] Torch effect received:', { state, shouldFlicker, pattern, stop });
      if (stop) {
        stopBlink();
        setTorch(false);
      } else if (pattern) {
        blinkPattern(pattern, intervalMs || 100);
      } else if (shouldFlicker) {
        flicker(count || 5, intervalMs || 100);
      } else if (typeof state === 'boolean') {
        setTorch(state);
      }
    });

    // Sound effect
    socket.on('effect:sound', ({ soundType, level, filename, volume, loop }) => {
      console.log(`[Client] Sound effect received: ${soundType}${filename ? ` (${filename})` : ''}`);
      if (soundType === 'file' && filename) {
        soundEngine.playAudioFile(filename, { volume, loop }).catch((err) => {
          console.warn(`[Client] playAudioFile error for [${filename}]:`, err);
        });
      } else {
        soundEngine.playSound(soundType, level, filename);
      }
    });

    // Master volume control
    socket.on('effect:volume', ({ volume }) => {
      console.log(`[Client] Master volume changed to: ${volume * 100}%`);
      soundEngine.setVolume(volume);
    });

    // Emergency shutdown
    socket.on('effect:shutdown', () => {
      console.log('[Client] Shutdown signal received!');
      setPhase('STANDBY');
    });

    // 自動パニック連携 (動画同期またはAdminトリガー)
    const handlePanicTrigger = (payload?: { timestamp?: number; reason?: string }) => {
      console.log('[Client] CRITICAL PANIC EVENT RECEIVED!', payload);
      setPhase('PANIC_ESCAPE');

      // 1. 最大音量アラーム音 (低周波衝撃音 + 高周波ビープ)
      soundEngine.playSound('lowImpact', 5);
      soundEngine.playBeep(980, 0.4);

      // 2. スマホバイブレーション作動
      if ('vibrate' in navigator) {
        navigator.vibrate([250, 100, 250, 100, 500, 150, 500]);
      }

      // 3. 背面カメラトーチの激速点滅
      flicker(30, 70);
    };

    socket.on('panic:trigger', handlePanicTrigger);

    return () => {
      socket.off('phase:update');
      socket.off('elevator:state');
      socket.off('task:review_result');
      socket.off('effect:glitch');
      socket.off('effect:torch');
      socket.off('effect:sound');
      socket.off('effect:volume');
      socket.off('effect:shutdown');
      socket.off('panic:trigger', handlePanicTrigger);
    };
  }, [socket, deviceId, soundEngine, flicker, blinkPattern, stopBlink, setTorch]);

  // Emit device:ready once connected or deviceId set
  useEffect(() => {
    if (socket && connected) {
      const location =
        phase === 'STANDBY'
          ? '待機室 (オープニング)'
          : phase === 'AREA_1_PHOTO'
            ? '品質管理室 (指定3点点検)'
            : phase === 'ELEVATOR'
              ? 'エレベータ'
              : phase === 'AREA_2_CONVEYOR'
                ? '第零製造ライン (コンベア点検)'
                : phase === 'AREA_3_VIDEO'
                  ? 'モニター室 (記録映像アーカイブ)'
                  : phase === 'PANIC_ESCAPE'
                    ? '非常脱出路 (地上へ退避中)'
                    : '受付 (端末返却所)';
      socket.emit('device:ready', { deviceId, phase, location });
    }
  }, [socket, connected, deviceId, phase]);

  // Phase transition handlers
  const handleStartInspection = () => {
    soundEngine.unlockAudio();
    soundEngine.playBeep(880, 0.1);
    setPhase('AREA_1_PHOTO');
    if (socket) {
      socket.emit('device:start_inspection', { deviceId });
    }
  };

  const handlePhotoSubmit = (taskId: number, taskTitle: string, imageBase64: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'PENDING' } : t))
    );

    if (socket) {
      socket.emit('task:photo_submit', {
        deviceId,
        taskId,
        taskTitle,
        imageBase64,
      });
    }
  };

  // Elevator power toggle
  const handleElevatorPower = (powerOn: boolean) => {
    if (socket) {
      socket.emit('elevator:power', { powerOn, deviceId });
    }
  };

  // Conveyor controls
  const handleConveyorControl = (action: 'forward' | 'reverse' | 'stop' | 'test_run', durationMs?: number) => {
    if (socket) {
      socket.emit('conveyor:control', { action, speed: 100, durationMs, deviceId });
    }
  };

  // Video trigger
  const handleTriggerVideo = () => {
    if (socket) {
      socket.emit('video:trigger_play', { deviceId });
    }
  };

  return (
    <div className="client-root">
      {/* ネットワーク切断・再接続待機ダイアログ */}
      <ReconnectingModal
        isReconnecting={isReconnecting}
        isOnline={isOnline}
        reconnectAttempts={reconnectAttempts}
        onManualReconnect={manualReconnect}
      />

      <div
        className={`win95-window client-window ${glitchOptions ? GLITCH_CLASS[glitchOptions.mode || 'creepy'] ?? 'glitch-creepy' : ''
          }`}
      >
        {/* Horror & Glitch Overlays */}
        <HorrorCanvasOverlay
          glitchOptions={glitchOptions}
          screenFlashActive={screenFlashActive}
        />

        {/* Industrial Retro Titlebar Header */}
        <header className="win95-titlebar client-header">
          <div className="client-header-group">
            <span className={`client-link-dot${connected ? ' online' : ''}`} />
            <strong className="client-device-id">PDA-ID: {isClientMounted ? deviceId : '----'}</strong>
          </div>

          <div className="client-header-group">
            <span className="client-battery">
              {charging ? '[CHG]' : '[バッテリー残量]'} {batteryLevel}%
            </span>

            <FullscreenButton className="client-fs-btn" />
          </div>
        </header>

        {/* Main Phase Container */}
        <main className="client-main">
          {phase === 'STANDBY' && (
            <PhaseInit
              deviceId={deviceId}
              onDeviceIdChange={setDeviceId}
              onStart={handleStartInspection}
            />
          )}

          {phase === 'AREA_1_PHOTO' && (
            <PhaseZone1
              deviceId={deviceId}
              tasks={tasks}
              onPhotoSubmit={handlePhotoSubmit}
              onProceedZone2={() => setPhase('ELEVATOR')}
              playShutterSound={() => soundEngine.playShutter()}
              onPhotoTaken={() => {
                if (torchOn) {
                  setTimeout(() => setTorch(true), 300);
                }
              }}
            />
          )}

          {phase === 'ELEVATOR' && (
            <PhaseElevator
              deviceId={deviceId}
              currentFloor={elevatorFloor}
              onPowerToggle={handleElevatorPower}
              playSwitchSound={() => soundEngine.playBeep(600, 0.15)}
              onProceedZone2={() => setPhase('AREA_2_CONVEYOR')}
            />
          )}

          {phase === 'AREA_2_CONVEYOR' && (
            <PhaseArea2Conveyor
              deviceId={deviceId}
              onConveyorControl={handleConveyorControl}
              onProceedNext={() => setPhase('AREA_3_VIDEO')}
              playMotorSound={() => soundEngine.playMotor()}
              playSuccessSound={() => soundEngine.playTaskSuccess()}
            />
          )}

          {phase === 'AREA_3_VIDEO' && (
            <PhaseArea3Video
              deviceId={deviceId}
              onTriggerVideo={handleTriggerVideo}
              playHorrorSound={() => soundEngine.playSound('lowImpact')}
            />
          )}

          {phase === 'PANIC_ESCAPE' && (
            <PhasePanicEscape
              deviceId={deviceId}
              onProceedReturn={() => setPhase('RETURN')}
              triggerEmergencySound={() => {
                soundEngine.playSound('lowImpact', 5);
                soundEngine.playBeep(980, 0.4);
              }}
              triggerFastTorch={() => flicker(30, 70)}
            />
          )}

          {phase === 'RETURN' && (
            <PhaseReturn deviceId={deviceId} />
          )}
        </main>

        {/* Retro Industrial Statusbar at Bottom */}
        <footer className="win95-statusbar client-footer">
          <div className="win95-statusbar-item client-footer-link">
            {connected ? 'LINK: ONLINE' : 'LINK: OFFLINE'} | PDA-OS v3.84
          </div>
          <div className="win95-statusbar-item client-footer-phase">
            [{phase}]
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={<div className="client-loading">Loading PDA Terminal...</div>}>
      <ClientContent />
    </Suspense>
  );
}
