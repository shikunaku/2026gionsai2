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
import { PhaseZone2 } from '../../components/client/PhaseZone2';
import { PhaseEnd } from '../../components/client/PhaseEnd';
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
    location: '1F 品質管理室 北側区画',
    targetDescription: '冷却配管下部のバルブジョイント部を撮影し、赤錆または液漏れの有無を記録してください。',
    status: 'SUBMITTING',
  },
  {
    id: 2,
    title: '高圧電気制御盤の計器指示値',
    location: '1F 品質管理室 主配電盤',
    targetDescription: '計器盤の中央アナログ電圧計の針の位置を撮影し、目盛りが適正範囲内にあるか記録してください。',
    status: 'SUBMITTING',
  },
  {
    id: 3,
    title: '第2地下通路 排気ダクトの異音確認',
    location: '1F 管理室奥 地下排気孔',
    targetDescription: '排気ダクトの金網フィルターを撮影し、異物の引っ掛かりや損傷がないか記録してください。',
    status: 'SUBMITTING',
  },
];

function ClientContent() {
  const searchParams = useSearchParams();
  const [deviceId, setDeviceId] = useState<string>('0001');
  const [phase, setPhase] = useState<DevicePhase>('INIT');
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

  const { torchOn, screenFlashActive, setTorch, toggleTorch, flicker } =
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
    socket.on('effect:torch', ({ state, flicker: shouldFlicker, count, intervalMs }) => {
      console.log('[Client] Torch effect received:', { state, shouldFlicker });
      if (shouldFlicker) {
        flicker(count || 6, intervalMs || 100);
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
      setPhase('END');
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
  }, [socket, deviceId, soundEngine, flicker, setTorch]);

  // Emit device:ready once connected or deviceId set
  useEffect(() => {
    if (socket && connected) {
      const location =
        phase === 'INIT'
          ? 'エントランス待機所'
          : phase === 'ZONE1'
          ? '1F 品質管理室 (写真点検)'
          : phase === 'ZONE2'
          ? '1F 第零製造ライン (機器操作)'
          : '出口・電源遮断区画';
      socket.emit('device:ready', { deviceId, phase, location });
    }
  }, [socket, connected, deviceId, phase]);

  // Phase transition handlers
  const handleStartInspection = () => {
    soundEngine.unlockAudio();
    soundEngine.playBeep(880, 0.1);
    setPhase('ZONE1');
    if (socket) {
      socket.emit('device:start_inspection', { deviceId });
    }
  };

  const handlePhotoSubmit = (taskId: number, taskTitle: string, imageBase64: string) => {
    // Set status to PENDING
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

  const handleMachineControl = (machineId: string, state: boolean) => {
    if (socket) {
      socket.emit('machine:control', {
        machineId,
        state,
        deviceId,
      });
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
          {phase === 'INIT' && (
            <PhaseInit
              deviceId={deviceId}
              onDeviceIdChange={setDeviceId}
              onStart={handleStartInspection}
            />
          )}

          {phase === 'ZONE1' && (
            <PhaseZone1
              deviceId={deviceId}
              tasks={tasks}
              onPhotoSubmit={handlePhotoSubmit}
              onProceedZone2={() => setPhase('ZONE2')}
              playShutterSound={() => soundEngine.playShutter()}
              onPhotoTaken={() => {
                // If torch was meant to be ON, re-activate it after camera app returns
                if (torchOn) {
                  setTimeout(() => setTorch(true), 300);
                }
              }}
            />
          )}

          {phase === 'ZONE2' && (
            <PhaseZone2
              deviceId={deviceId}
              onMachineControl={handleMachineControl}
              playMotorSound={() => soundEngine.playMotor()}
            />
          )}

          {phase === 'END' && (
            <PhaseEnd
              deviceId={deviceId}
              onShutdownSound={() => soundEngine.playPowerDown()}
              onTurnOffFlash={() => setTorch(false)}
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
