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
import { PhasePreshow } from '../../components/client/PhasePreshow';
import { PhaseQualityControl } from '../../components/client/PhaseQualityControl';
import { PhaseElevatorSeq } from '../../components/client/PhaseElevatorSeq';
import { PhaseManufacturingLine } from '../../components/client/PhaseManufacturingLine';
import { PhaseMonitorRoom } from '../../components/client/PhaseMonitorRoom';
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
  nightmare: 'glitch-nightmare',
  hallucination: 'glitch-hallucination',
  corruption: 'glitch-corruption',
  stalker: 'glitch-stalker',
  heartbeat: 'glitch-heartbeat',
  signalLoss: 'glitch-signalLoss',
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

  // 各フェーズの局所ステート
  const [preshowEnded, setPreshowEnded] = useState<boolean>(false);
  const [qualityControlArrived, setQualityControlArrived] = useState<boolean>(false);
  const [manufacturingLineArrived, setManufacturingLineArrived] = useState<boolean>(false);
  const [manufacturingPhotoApproved, setManufacturingPhotoApproved] = useState<boolean>(false);
  const [manufacturingPhotoStatus, setManufacturingPhotoStatus] = useState<'UNINSPECTED' | 'PENDING' | 'APPROVED' | 'REJECTED'>('UNINSPECTED');
  const [monitorRoomArrived, setMonitorRoomArrived] = useState<boolean>(false);
  const [monitorVideoPlaying, setMonitorVideoPlaying] = useState<boolean>(false);
  const [panicActive, setPanicActive] = useState<boolean>(false);

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

        // 各フェーズへの状態同期
        if (newPhase === 'quality_control' || newPhase === 'AREA_1_PHOTO') {
          setPreshowEnded(true);
        } else if (newPhase === 'manufacturing_line' || newPhase === 'AREA_2_CONVEYOR') {
          setQualityControlArrived(true);
        } else if (newPhase === 'monitor_room' || newPhase === 'AREA_3_VIDEO') {
          setManufacturingLineArrived(true);
          setManufacturingPhotoApproved(true);
        } else if (newPhase === 'escape' || newPhase === 'PANIC_ESCAPE') {
          setPanicActive(true);
        }
      }
    });

    // プレショー終了イベント
    socket.on('preshow:ended', () => {
      console.log('[Client] Preshow ended event received!');
      setPreshowEnded(true);
      if ('vibrate' in navigator) {
        navigator.vibrate([150, 80, 200, 100, 300]);
      }
      soundEngine.playSound('lowImpact', 3);
    });

    // エレベーター階数状態
    socket.on('elevator:state', ({ floor }) => {
      console.log(`[Client] Elevator state updated: ${floor}`);
      setElevatorFloor(floor);
    });

    // 写真審査結果
    socket.on('task:review_result', ({ taskId, status, reason }) => {
      console.log(`[Client] Review result received for Task ${taskId}: ${status}`);

      if (taskId === 10) {
        setManufacturingPhotoStatus(status);
        if (status === 'APPROVED') {
          setManufacturingPhotoApproved(true);
          soundEngine.playSound('lowImpact', 5);
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 300, 100, 500]);
        } else if (status === 'REJECTED') {
          soundEngine.playBeep(440, 0.2);
          if ('vibrate' in navigator) navigator.vibrate(300);
        }
      } else {
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
      }
    });

    // ジャンプスケア演出トリガー (恐怖演出: 低周波衝撃+絶叫+激震バイブレーション+高速ストロボ)
    socket.on('jumpscare:trigger', (payload) => {
      if (!payload?.targetDeviceId || payload.targetDeviceId === deviceId) {
        console.log('[Client] JUMPSCARE TRIGGER RECEIVED!', payload);
        setManufacturingPhotoApproved(true);
        // 重低音衝撃 + 金属絶叫の複合再生
        soundEngine.playSound('lowImpact', 5);
        soundEngine.playSound('scream');
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 40, 200, 50, 400, 60, 600]);
        }
        flicker(25, 50);
        // 瞬間的な激震ナイトメアグリッチを連動
        setGlitchOptions({
          level: 3,
          duration: payload?.durationMs || 2500,
          mode: 'nightmare',
          vibrate: true,
        });
        setTimeout(() => {
          setGlitchOptions(null);
        }, payload?.durationMs || 2500);
      }
    });

    // 画面グリッチ妨害トリガー
    socket.on('effect:glitch', (options) => {
      console.log('[Client] Glitch effect triggered:', options);
      setGlitchOptions(options);

      // モードに応じた不穏・恐怖音響の自動連動
      if (options.mode === 'nightmare') {
        soundEngine.playSound('scream');
      } else if (options.mode === 'violent' || options.mode === 'corruption') {
        soundEngine.playSound('glitchBurst');
      } else if (options.mode === 'stalker') {
        soundEngine.playSound('whisper');
      } else if (options.mode === 'heartbeat') {
        soundEngine.playSound('heartbeat');
      } else if (options.mode === 'signalLoss') {
        soundEngine.playSound('interference');
      } else if (options.mode === 'creepy' || options.mode === 'hallucination') {
        soundEngine.playSound('whisper');
      } else if (options.mode === 'static') {
        soundEngine.playSound('glitchBurst');
      } else if (options.mode === 'redout' || options.mode === 'blackout') {
        soundEngine.playSound('lowImpact', 4);
      }

      if (options.vibrate && 'vibrate' in navigator) {
        if (options.mode === 'nightmare' || options.mode === 'violent' || options.mode === 'corruption') {
          navigator.vibrate([200, 60, 150, 40, 300, 80, 500]);
        } else if (options.mode === 'heartbeat') {
          // 生体の不規則急迫心拍バイブレーション
          navigator.vibrate([80, 120, 140, 350, 90, 110, 150, 320, 100, 90, 180]);
        } else if (options.mode === 'stalker') {
          navigator.vibrate([50, 800, 70, 700, 120, 500]);
        } else {
          navigator.vibrate([120, 80, 200, 100, 150]);
        }
      }

      setTimeout(() => {
        setGlitchOptions(null);
      }, options.duration || 3000);
    });

    // トーチ制御
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

    // 効果音再生
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

    // 音量制御
    socket.on('effect:volume', ({ volume }) => {
      console.log(`[Client] Master volume changed to: ${volume * 100}%`);
      soundEngine.setVolume(volume);
    });

    // 緊急シャットダウン
    socket.on('effect:shutdown', () => {
      console.log('[Client] Shutdown signal received!');
      setPhase('STANDBY');
    });

    // ビデオ再生トリガー監視
    socket.on('video:trigger_play', () => {
      setMonitorVideoPlaying(true);
    });

    // 自動パニック連携 (動画同期またはAdminトリガー)
    const handlePanicTrigger = (payload?: { timestamp?: number; reason?: string }) => {
      console.log('[Client] CRITICAL PANIC EVENT RECEIVED!', payload);
      setPanicActive(true);
      setPhase('escape');

      soundEngine.playSound('lowImpact', 5);
      soundEngine.playBeep(980, 0.4);

      if ('vibrate' in navigator) {
        navigator.vibrate([250, 100, 250, 100, 500, 150, 500]);
      }

      flicker(30, 70);
    };

    socket.on('panic:trigger', handlePanicTrigger);

    return () => {
      socket.off('phase:update');
      socket.off('preshow:ended');
      socket.off('elevator:state');
      socket.off('task:review_result');
      socket.off('jumpscare:trigger');
      socket.off('effect:glitch');
      socket.off('effect:torch');
      socket.off('effect:sound');
      socket.off('effect:volume');
      socket.off('effect:shutdown');
      socket.off('video:trigger_play');
      socket.off('panic:trigger', handlePanicTrigger);
    };
  }, [socket, deviceId, soundEngine, flicker, blinkPattern, stopBlink, setTorch]);

  // Emit device:ready once connected or deviceId set
  useEffect(() => {
    if (socket && connected) {
      const locationMap: Record<string, string> = {
        STANDBY: '待機ホール (受付)',
        preshow: '待機ホール (プレショー)',
        quality_control: '1F 品質管理室 (撮影点検)',
        AREA_1_PHOTO: '1F 品質管理室 (撮影点検)',
        elevator: '1F〜B1F エレベーター',
        ELEVATOR: '1F〜B1F エレベーター',
        manufacturing_line: 'B1F 第零製造ライン (コンベア点検)',
        AREA_2_CONVEYOR: 'B1F 第零製造ライン (コンベア点検)',
        monitor_room: 'B1F モニター室 (最終アーカイブ映像)',
        AREA_3_VIDEO: 'B1F モニター室 (最終アーカイブ映像)',
        escape: '非常脱出路 (地上へ退避中)',
        PANIC_ESCAPE: '非常脱出路 (地上へ退避中)',
        return: '受付 (端末返却所)',
        RETURN: '受付 (端末返却所)',
      };
      const location = locationMap[phase] || '待機中';
      socket.emit('device:ready', { deviceId, phase, location });
    }
  }, [socket, connected, deviceId, phase]);

  // フェーズ移行 & アクションハンドラー
  const handleStartInspection = () => {
    soundEngine.unlockAudio();
    soundEngine.playBeep(880, 0.1);
    // 端末側はプレショーを表示せず、同意直後にエリア1（品質管理室）への移動・到着待ちへ進む
    setPhase('quality_control');
    setQualityControlArrived(false);
    if (socket) {
      socket.emit('device:start_inspection', { deviceId });
    }
  };

  const handleArriveAtPhase = (targetPhase: DevicePhase) => {
    soundEngine.playBeep(920, 0.12);
    setPhase(targetPhase);
    if (socket) {
      socket.emit('device:arrive', { deviceId, phase: targetPhase });
    }
  };

  const handlePhotoSubmit = (taskId: number, taskTitle: string, imageBase64: string) => {
    if (taskId === 10) {
      setManufacturingPhotoStatus('PENDING');
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'PENDING' } : t))
      );
    }

    if (socket) {
      socket.emit('task:photo_submit', {
        deviceId,
        taskId,
        taskTitle,
        imageBase64,
      });
    }
  };

  // Elevator controls
  const handleElevatorPower = (powerOn: boolean) => {
    if (socket) {
      socket.emit('elevator:power', { powerOn, deviceId });
    }
  };

  const handleElevatorStartMove = () => {
    if (socket) {
      socket.emit('elevator:trigger_move', { from: 'FLOOR_1', to: 'FLOOR_B1', deviceId });
    }
  };

  // Video trigger
  const handleTriggerVideo = () => {
    setMonitorVideoPlaying(true);
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

        {/* Main Phase Container (5 Phases) */}
        <main className="client-main">
          {/* 待機・初期設定 */}
          {phase === 'STANDBY' && (
            <PhaseInit
              deviceId={deviceId}
              onDeviceIdChange={setDeviceId}
              onStart={handleStartInspection}
            />
          )}

          {/* ① プレショー */}
          {phase === 'preshow' && (
            <PhasePreshow
              deviceId={deviceId}
              preshowEnded={preshowEnded}
              onConfirmPreshowArrival={() => {
                if (socket) {
                  socket.emit('device:arrive', { deviceId, phase: 'preshow' });
                }
              }}
              onArriveQualityControl={() => {
                setQualityControlArrived(true);
                handleArriveAtPhase('quality_control');
              }}
            />
          )}

          {/* ② 品質管理室 */}
          {(phase === 'quality_control' || phase === 'AREA_1_PHOTO') && (
            <PhaseQualityControl
              deviceId={deviceId}
              tasks={tasks}
              arrived={qualityControlArrived}
              onArrive={() => {
                setQualityControlArrived(true);
                handleArriveAtPhase('quality_control');
              }}
              onPhotoSubmit={handlePhotoSubmit}
              onProceedElevator={() => {
                handleArriveAtPhase('elevator');
              }}
              playShutterSound={() => soundEngine.playShutter()}
              onPhotoTaken={() => {
                if (torchOn) {
                  setTimeout(() => setTorch(true), 300);
                }
              }}
            />
          )}

          {/* ③ エレベーター */}
          {(phase === 'elevator' || phase === 'ELEVATOR') && (
            <PhaseElevatorSeq
              deviceId={deviceId}
              currentFloor={elevatorFloor}
              onPowerToggle={handleElevatorPower}
              onStartMove={handleElevatorStartMove}
              onProceedManufacturing={() => {
                setManufacturingLineArrived(true);
                handleArriveAtPhase('manufacturing_line');
              }}
              playSwitchSound={() => soundEngine.playBeep(600, 0.15)}
            />
          )}

          {/* ④ 製造ライン */}
          {(phase === 'manufacturing_line' || phase === 'AREA_2_CONVEYOR') && (
            <PhaseManufacturingLine
              deviceId={deviceId}
              arrived={manufacturingLineArrived}
              onArrive={() => {
                setManufacturingLineArrived(true);
                handleArriveAtPhase('manufacturing_line');
              }}
              onConveyorStart={() => {
                socket?.emit('conveyor:control', { action: 'test_run', durationMs: 6000, deviceId });
              }}
              onPhotoSubmit={handlePhotoSubmit}
              photoApproved={manufacturingPhotoApproved}
              photoStatus={manufacturingPhotoStatus}
              onProceedMonitorRoom={() => {
                setMonitorRoomArrived(true);
                handleArriveAtPhase('monitor_room');
              }}
              playShutterSound={() => soundEngine.playShutter()}
            />
          )}

          {/* ⑤ モニター室 */}
          {(phase === 'monitor_room' || phase === 'AREA_3_VIDEO') && (
            <PhaseMonitorRoom
              deviceId={deviceId}
              arrived={monitorRoomArrived}
              onArrive={() => {
                setMonitorRoomArrived(true);
                handleArriveAtPhase('monitor_room');
              }}
              onTriggerVideo={handleTriggerVideo}
              videoPlaying={monitorVideoPlaying}
              panicActive={panicActive}
              onEscapeSuccess={() => {
                handleArriveAtPhase('return');
              }}
            />
          )}

          {/* クライマックス・パニック脱出 */}
          {(phase === 'escape' || phase === 'PANIC_ESCAPE') && (
            <PhaseMonitorRoom
              deviceId={deviceId}
              arrived={true}
              onArrive={() => {}}
              onTriggerVideo={handleTriggerVideo}
              videoPlaying={true}
              panicActive={true}
              onEscapeSuccess={() => {
                handleArriveAtPhase('return');
              }}
            />
          )}

          {/* 体験終了・端末返却 */}
          {(phase === 'return' || phase === 'RETURN') && (
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

