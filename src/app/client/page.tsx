'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useTorch } from '../../hooks/useTorch';
import { useBattery } from '../../hooks/useBattery';
import { useSoundEngine } from '../../hooks/useSoundEngine';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { HorrorCanvasOverlay } from '../../components/client/HorrorCanvasOverlay';
import { PhaseInit } from '../../components/client/PhaseInit';
import { PhaseZone1 } from '../../components/client/PhaseZone1';
import { PhaseElevator } from '../../components/client/PhaseElevator';
import { PhaseArea2Conveyor } from '../../components/client/PhaseArea2Conveyor';
import { PhaseArea3Video } from '../../components/client/PhaseArea3Video';
import {
  DevicePhase,
  InspectionTask,
  GlitchEffectOptions,
  TorchEffectOptions,
  SoundEffectOptions,
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
    title: '冷却塔メインバルブの腐食状況',
    location: '1F エリア1 北側区画',
    targetDescription: '冷却配管下部のバルブジョイント部を撮影し、赤錆または液漏れの有無を記録してください。',
    status: 'SUBMITTING',
  },
  {
    id: 2,
    title: '高圧電気制御盤の計器指示値',
    location: '1F エリア1 主配電盤',
    targetDescription: '計器盤の中央アナログ電圧計の針の位置を撮影し、目盛りが適正範囲内にあるか記録してください。',
    status: 'SUBMITTING',
  },
  {
    id: 3,
    title: '第2地下通路 排気ダクトの異音確認',
    location: '1F エリア1 地下排気孔',
    targetDescription: '排気ダクトの金網フィルターを撮影し、異物の引っ掛かりや損傷がないか記録してください。',
    status: 'SUBMITTING',
  },
];

function ClientContent() {
  const searchParams = useSearchParams();
  const [deviceId, setDeviceId] = useState<string>('0001');
  const [phase, setPhase] = useState<DevicePhase>('STANDBY');
  const [tasks, setTasks] = useState<InspectionTask[]>(INITIAL_TASKS);
  const [glitchOptions, setGlitchOptions] = useState<GlitchEffectOptions | null>(null);

  const { socket, connected } = useSocket();
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
    socket.on('effect:sound', ({ soundType, level }) => {
      console.log(`[Client] Sound effect received: ${soundType}`);
      soundEngine.playSound(soundType, level);
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

    return () => {
      socket.off('phase:update');
      socket.off('task:review_result');
      socket.off('effect:glitch');
      socket.off('effect:torch');
      socket.off('effect:sound');
      socket.off('effect:volume');
      socket.off('effect:shutdown');
    };
  }, [socket, deviceId, soundEngine, flicker, blinkPattern, stopBlink, setTorch]);

  // Emit device:ready once connected or deviceId set
  useEffect(() => {
    if (socket && connected) {
      const location =
        phase === 'STANDBY'
          ? '待機室 (オープニング)'
          : phase === 'AREA_1_PHOTO'
          ? 'エリア1 (3枚撮影・提出)'
          : phase === 'ELEVATOR'
          ? 'エレベータ (昇降機移動)'
          : phase === 'AREA_2_CONVEYOR'
          ? 'エリア2 (コンベア操作)'
          : 'エリア3 (映像再生トリガー)';
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

  // Elevator triggers
  const handleElevatorTriggerMove = () => {
    if (socket) {
      socket.emit('elevator:trigger_move', { deviceId });
    }
  };

  const handleElevatorGlitch = () => {
    if (socket) {
      socket.emit('elevator:trigger_glitch', { duration: 1500 });
    }
  };

  // Conveyor controls
  const handleConveyorControl = (action: 'forward' | 'reverse' | 'stop') => {
    if (socket) {
      socket.emit('conveyor:control', { action, speed: 100, deviceId });
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
      <div
        className={`win95-window client-window ${
          glitchOptions ? GLITCH_CLASS[glitchOptions.mode || 'creepy'] ?? 'glitch-creepy' : ''
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
            <strong className="client-device-id">PDA-ID: {deviceId}</strong>
          </div>

          <div className="client-header-group">
            <span className="client-battery">
              {charging ? '[CHG]' : '[BAT]'} {batteryLevel}%
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
              onTriggerMove={handleElevatorTriggerMove}
              onFloorGlitch={handleElevatorGlitch}
              onProceedNext={() => setPhase('AREA_2_CONVEYOR')}
              playMotorSound={() => soundEngine.playMotor()}
            />
          )}

          {phase === 'AREA_2_CONVEYOR' && (
            <PhaseArea2Conveyor
              deviceId={deviceId}
              onConveyorControl={handleConveyorControl}
              onProceedNext={() => setPhase('AREA_3_VIDEO')}
              playMotorSound={() => soundEngine.playMotor()}
            />
          )}

          {phase === 'AREA_3_VIDEO' && (
            <PhaseArea3Video
              deviceId={deviceId}
              onTriggerVideo={handleTriggerVideo}
              playHorrorSound={() => soundEngine.playSound('lowImpact')}
            />
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
