'use client';

/**
 * @file page.tsx (Elevator Background Display Player)
 * @description エレベーター内背景映像・プロシージャル降下演出・CCTV映像表示コンポーネント。
 * エリア3（モニター室）の高品質な映像再生、CRT走査線ノイズ、WebRTC CCTVライブ配信、
 * 音響アンロック、プロシージャル生成アニメーション技術をそのまま活用し、
 * エレベーターの降下シークエンス（FLOOR_1 ➔ MOVING ➔ FLOOR_B1）やグリッチ演出にリアルタイム同期します。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import {
  CctvCameraId,
  CCTV_CAMERAS,
  CctvCameraStatusPayload,
  ElevatorFloorState,
  ElevatorStatePayload,
} from '../../../lib/types';
import { requestFullscreenSafe } from '../../../lib/fullscreen';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import '../../../styles/elevator-bg.css';

export default function ElevatorBackgroundPlayerPage() {
  const { socket, connected } = useSocket();
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasStartedVideo, setHasStartedVideo] = useState<boolean>(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [useProcedural, setUseProcedural] = useState<boolean>(false);
  const [isGlitching, setIsGlitching] = useState<boolean>(false);

  // エレベーターフロア状態 ('FLOOR_1' | 'MOVING' | 'FLOOR_B1' | 'OFF')
  const [floorState, setFloorState] = useState<ElevatorFloorState>('FLOOR_1');

  // 表示モード ('video' | 'cctv')
  const [displayMode, setDisplayMode] = useState<'video' | 'cctv'>('video');
  const [cctvLayout, setCctvLayout] = useState<'grid3' | 'single'>('single');
  const [cctvActiveCam, setCctvActiveCam] = useState<CctvCameraId>('cam2'); // エレベーター前通路カメラをデフォルトに
  const [cameraStatus, setCameraStatus] = useState<
    Record<CctvCameraId, { online: boolean; lightOn: boolean; battery?: number | string }>
  >({
    cam1: { online: false, lightOn: false },
    cam2: { online: false, lightOn: false },
    cam3: { online: false, lightOn: false },
  });
  const [cctvClock, setCctvClock] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const glitchTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // WebRTC PeerConnections (key: CctvCameraId)
  const peerConnectionsRef = useRef<Map<CctvCameraId, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<CctvCameraId, MediaStream>>(new Map());
  const cctvVideoElsRef = useRef<Map<CctvCameraId, HTMLVideoElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<CctvCameraId, RTCIceCandidateInit[]>>(new Map());

  // CCTV 時計更新
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCctvClock(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // CCTV video要素のマウント/再マウント時に既存のMediaStreamを即時再アタッチ
  const setCctvVideoRef = useCallback((camId: CctvCameraId, el: HTMLVideoElement | null) => {
    if (el) {
      cctvVideoElsRef.current.set(camId, el);
      const existingStream = remoteStreamsRef.current.get(camId);
      if (existingStream) {
        if (el.srcObject !== existingStream) {
          el.srcObject = existingStream;
        }
        el.play().catch(() => {});
      }
    } else {
      cctvVideoElsRef.current.delete(camId);
    }
  }, []);

  // WebRTC PeerConnection の作成
  const getOrCreatePeerConnection = useCallback(
    (camId: CctvCameraId, cameraSocketId?: string) => {
      if (peerConnectionsRef.current.has(camId)) {
        return peerConnectionsRef.current.get(camId)!;
      }

      console.log(`[Elevator BG] Creating WebRTC PeerConnection for: ${camId}`);
      const rtcConfig: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      };

      const pc = new RTCPeerConnection(rtcConfig);

      pc.ontrack = (event) => {
        console.log(`[Elevator BG] WebRTC Track received (${camId}):`, event.streams[0]);
        const stream = event.streams[0];
        if (stream) {
          remoteStreamsRef.current.set(camId, stream);
          const videoEl = cctvVideoElsRef.current.get(camId);
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch((err) => {
              console.error(`[Elevator BG] Video play error for ${camId}:`, err);
            });
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && cameraSocketId) {
          socket.emit('cctv:signal', {
            camId,
            targetSocketId: cameraSocketId,
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peerConnectionsRef.current.set(camId, pc);
      return pc;
    },
    [socket]
  );

  // Background Analog TV Noise on standby
  useEffect(() => {
    const canvas = noiseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const renderNoise = () => {
      if (!running) return;

      const clientW = canvas.clientWidth;
      const clientH = canvas.clientHeight;
      if (!clientW || !clientH || isNaN(clientW) || isNaN(clientH)) {
        requestAnimationFrame(renderNoise);
        return;
      }

      const w = Math.floor(clientW / 2);
      const h = Math.floor(clientH / 2);
      if (w <= 0 || h <= 0) {
        requestAnimationFrame(renderNoise);
        return;
      }

      canvas.width = w;
      canvas.height = h;

      const imgData = ctx.createImageData(w, h);
      const buffer = new Uint32Array(imgData.data.buffer);
      const len = buffer.length;

      for (let i = 0; i < len; i++) {
        const shade = Math.floor(Math.random() * 255);
        buffer[i] = (255 << 24) | (shade << 16) | (shade << 8) | shade;
      }
      ctx.putImageData(imgData, 0, 0);
      requestAnimationFrame(renderNoise);
    };

    renderNoise();
    return () => {
      running = false;
    };
  }, []);

  const [availableVideos, setAvailableVideos] = useState<string[]>([]);

  // サーバー上の利用可能な動画ファイル一覧を取得
  useEffect(() => {
    fetch('/api/video-files')
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => {
        if (Array.isArray(data.files) && data.files.length > 0) {
          setAvailableVideos(data.files);
          console.log('[Elevator BG] Available video files in /videos:', data.files);
        }
      })
      .catch((err) => {
        console.warn('[Elevator BG] Failed to fetch /api/video-files:', err);
      });
  }, []);

  // グリッチ演出トリガー
  const triggerGlitch = useCallback((durationMs = 1500) => {
    setIsGlitching(true);
    if (glitchTimerRef.current) {
      clearTimeout(glitchTimerRef.current as NodeJS.Timeout);
    }
    glitchTimerRef.current = setTimeout(() => {
      setIsGlitching(false);
    }, durationMs);
  }, []);

  // プロシージャル降下シャフト演出 (エレベーターシャフトの壁や鉄骨が下へ流れ、火花や警告灯が走る)
  const playElevatorDescentAnimation = useCallback(() => {
    setIsPlaying(true);
    setUseProcedural(true);

    const canvas = proceduralCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const actx = audioCtxRef.current;

    // 音響（モーター重低音＋機械摩擦音）
    if (actx) {
      const droneOsc = actx.createOscillator();
      const droneGain = actx.createGain();
      droneOsc.type = 'sawtooth';
      droneOsc.frequency.setValueAtTime(60, actx.currentTime);
      droneOsc.frequency.linearRampToValueAtTime(45, actx.currentTime + 3);
      droneOsc.frequency.linearRampToValueAtTime(30, actx.currentTime + 6);
      droneGain.gain.setValueAtTime(0.35, actx.currentTime);

      const filter = actx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, actx.currentTime);

      droneOsc.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(actx.destination);

      droneOsc.start();
      droneGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 8);
      droneOsc.stop(actx.currentTime + 8);
    }

    let startTime = Date.now();
    const duration = 8000; // 8秒間の降下シークエンス

    let posY = 0;
    const renderDescent = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        setIsPlaying(false);
        // 元の待機画面には戻さず、Canvasの最終フレームで停止保持
        return;
      }

      if (canvas && ctx) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        posY += 18; // 下降スピード

        // 背景暗色
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // エレベーターシャフト鉄骨グリッド
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        const beamSpacing = 120;
        const offset = posY % beamSpacing;

        for (let y = -beamSpacing; y < canvas.height + beamSpacing; y += beamSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y + offset);
          ctx.lineTo(canvas.width, y + offset);
          ctx.stroke();

          // 斜めブレース
          ctx.beginPath();
          ctx.moveTo(0, y + offset);
          ctx.lineTo(canvas.width, y + offset + beamSpacing);
          ctx.stroke();
        }

        // 左右のガイドレール
        ctx.fillStyle = '#334155';
        ctx.fillRect(40, 0, 16, canvas.height);
        ctx.fillRect(canvas.width - 56, 0, 16, canvas.height);

        // 通過する階数・警告ランプ
        const lightFlash = Math.sin((elapsed / 1000) * Math.PI * 4);
        if (lightFlash > 0.3) {
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.arc(80, (posY * 1.5) % canvas.height, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 深度テキストHUD
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`DESCENT SEQUENCE: -${Math.floor(elapsed / 100)}m`, 70, 70);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px monospace';
        ctx.fillText(`SHAFT VELOCITY: 2.4 m/s | MOTOR TORQUE: 94%`, 70, 100);
      }

      requestAnimationFrame(renderDescent);
    };

    renderDescent();
  }, []);

  // エレベーター降下演出の開始（動画ファイルがある場合は動画再生、無ければプロシージャル描画）
  const playElevatorDescent = useCallback(
    (explicitSrc?: string) => {
      setDisplayMode('video');

      // 指定された動画、または elevator 関連の動画ファイルを探す
      let selectedFile = explicitSrc;
      if (!selectedFile) {
        const found = availableVideos.find((f) => {
          const lower = f.toLowerCase();
          return lower.includes('elevator') || lower.includes('ev') || lower.includes('descent');
        });
        if (found) {
          selectedFile = `/videos/${found}`;
        }
      }

      setHasStartedVideo(true);
      if (selectedFile) {
        const src = selectedFile.startsWith('/') ? selectedFile : `/videos/${selectedFile}`;
        setVideoSrc(src);
        setIsPlaying(true);
        setUseProcedural(false);

        if (videoRef.current) {
          videoRef.current.src = src;
          videoRef.current.currentTime = 0;
          videoRef.current.muted = !audioUnlocked;
          videoRef.current.play().catch(() => {
            playElevatorDescentAnimation();
          });
        }
      } else {
        // 専用動画がない場合はリアルタイム降下プロシージャルアニメーション
        playElevatorDescentAnimation();
      }
    },
    [availableVideos, audioUnlocked, playElevatorDescentAnimation]
  );

  // WebSocket イベントリスナー
  useEffect(() => {
    if (!socket) return;

    // CCTVビューアーとして登録
    socket.emit('cctv:register_viewer');

    const handleAllStatus = (allStatus: CctvCameraStatusPayload[]) => {
      setCameraStatus((prev) => {
        const next = { ...prev };
        allStatus.forEach((s) => {
          next[s.camId] = {
            online: s.online,
            lightOn: !!s.lightOn,
            battery: s.batteryLevel,
          };
        });
        return next;
      });
    };

    const handleStatusUpdate = (payload: CctvCameraStatusPayload) => {
      setCameraStatus((prev) => {
        const wasOnline = prev[payload.camId]?.online;
        if (payload.online && !wasOnline) {
          const pc = peerConnectionsRef.current.get(payload.camId);
          if (!pc || (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed')) {
            socket.emit('cctv:signal', {
              camId: payload.camId,
              type: 'viewer_ready',
            });
          }
        }
        return {
          ...prev,
          [payload.camId]: {
            online: payload.online,
            lightOn: payload.lightOn ?? prev[payload.camId]?.lightOn ?? false,
            battery: payload.batteryLevel ?? prev[payload.camId]?.battery,
          },
        };
      });

      if (!payload.online) {
        if (peerConnectionsRef.current.has(payload.camId)) {
          peerConnectionsRef.current.get(payload.camId)?.close();
          peerConnectionsRef.current.delete(payload.camId);
        }
        remoteStreamsRef.current.delete(payload.camId);
        pendingCandidatesRef.current.delete(payload.camId);
        const videoEl = cctvVideoElsRef.current.get(payload.camId);
        if (videoEl) {
          videoEl.srcObject = null;
        }
      }
    };

    const handleSignal = async (payload: any) => {
      const { camId, type, senderSocketId, sdp, candidate } = payload;
      if (!camId || !type) return;

      const pc = getOrCreatePeerConnection(camId, senderSocketId);

      if (type === 'offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const queued = pendingCandidatesRef.current.get(camId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(camId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('cctv:signal', {
            camId,
            targetSocketId: senderSocketId,
            type: 'answer',
            sdp: pc.localDescription?.toJSON(),
          });
        } catch (err) {
          console.error(`[Elevator BG] Failed to handle offer for ${camId}:`, err);
        }
      } else if (type === 'candidate' && candidate) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            const queued = pendingCandidatesRef.current.get(camId) || [];
            queued.push(candidate);
            pendingCandidatesRef.current.set(camId, queued);
          }
        } catch (err) {
          console.error(`[Elevator BG] Failed to add ICE candidate for ${camId}:`, err);
        }
      }
    };

    // CCTV 切り替え
    const handleCctvSwitch = (payload: { camId: CctvCameraId | 'grid3' }) => {
      setDisplayMode('cctv');
      if (payload.camId === 'grid3') {
        setCctvLayout('grid3');
      } else {
        setCctvLayout('single');
        setCctvActiveCam(payload.camId);
      }
    };

    // エレベーターフロア状態更新
    const handleElevatorState = (payload: ElevatorStatePayload) => {
      console.log('[Elevator BG] Received floor state:', payload);
      setFloorState(payload.floor);

      if (payload.floor === 'MOVING') {
        // エレベーター移動中: 降下映像またはプロシージャルアニメーション開始
        playElevatorDescent();
      } else if (payload.floor === 'FLOOR_B1') {
        // B1F 到着: グリッチ＆到着演出
        triggerGlitch(2000);
      }

      if (payload.glitch) {
        triggerGlitch(1800);
      }
    };

    // エレベーターグリッチ
    const handleElevatorGlitch = (payload?: { duration?: number }) => {
      triggerGlitch(payload?.duration || 1500);
    };

    // エレベーター映像再生指示（管理コンソール等から）
    const handlePlayVideo = (payload?: { videoSrc?: string }) => {
      console.log('[Elevator BG] Video play triggered explicitly:', payload);
      playElevatorDescent(payload?.videoSrc);
    };

    socket.on('cctv:all_status', handleAllStatus);
    socket.on('cctv:status', handleStatusUpdate);
    socket.on('cctv:signal', handleSignal);
    socket.on('cctv:monitor_switch', handleCctvSwitch);
    socket.on('elevator:state', handleElevatorState);
    socket.on('elevator:glitch', handleElevatorGlitch);
    socket.on('elevator:play_video', handlePlayVideo);

    return () => {
      socket.off('cctv:all_status', handleAllStatus);
      socket.off('cctv:status', handleStatusUpdate);
      socket.off('cctv:signal', handleSignal);
      socket.off('cctv:monitor_switch', handleCctvSwitch);
      socket.off('elevator:state', handleElevatorState);
      socket.off('elevator:glitch', handleElevatorGlitch);
      socket.off('elevator:play_video', handlePlayVideo);
    };
  }, [socket, getOrCreatePeerConnection, triggerGlitch, playElevatorDescent]);

  // 音声アンロック＆全画面化
  const handleUnlockAudio = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }

    await requestFullscreenSafe();
    setAudioUnlocked(true);
  };

  // CCTV各カメラのレンダリング
  const renderCctvCamera = (camId: CctvCameraId) => {
    const config = CCTV_CAMERAS.find((c) => c.id === camId) || CCTV_CAMERAS[0];
    const status = cameraStatus[camId] || { online: false, lightOn: false };
    const isActive = cctvActiveCam === camId;
    const isHiddenInSingle = cctvLayout === 'single' && !isActive;

    return (
      <div
        key={camId}
        className={`elevator-cctv-card ${isActive ? 'is-active-cam' : ''}`}
        style={isHiddenInSingle ? { display: 'none' } : undefined}
      >
        <div className="elevator-cctv-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`elevator-cctv-badge ${status.online ? 'live' : 'offline'}`}>
              {status.online ? 'LIVE' : 'NO SIGNAL'}
            </span>
            <span className="elevator-cctv-title">{config.name}</span>
          </div>
          <div className="elevator-cctv-clock">
            {cctvClock} {status.battery !== undefined && `[BAT ${status.battery}%]`}
          </div>
        </div>

        <div className="elevator-cctv-media-box">
          <video
            ref={(el) => setCctvVideoRef(camId, el)}
            autoPlay
            playsInline
            muted
            className="elevator-cctv-stream-video"
            style={{ display: status.online ? 'block' : 'none' }}
          />
          <div className="elevator-bg-scanlines" />
          <div className="elevator-bg-vignette" />

          {!status.online && (
            <div className="elevator-cctv-no-signal">
              <div className="elevator-cctv-no-signal-title">[NO SIGNAL]</div>
              <div className="elevator-cctv-no-signal-desc">{config.location}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="elevator-bg-root">
      {/* 1. CCTV モード表示 */}
      {displayMode === 'cctv' && (
        <div className={`elevator-cctv-container cctv-layout-${cctvLayout}`}>
          <div className="elevator-cctv-wrapper">
            {CCTV_CAMERAS.map((cam) => renderCctvCamera(cam.id))}
          </div>
        </div>
      )}

      {/* 2. 待機画面（CRT走査線＋アナログノイズ） */}
      {displayMode === 'video' && !hasStartedVideo && (
        <div className="elevator-bg-standby">
          <canvas ref={noiseCanvasRef} className="elevator-bg-noise-canvas" />
          <div className="elevator-bg-scanlines" />
          <div className="elevator-bg-vignette" />

          {!audioUnlocked && (
            <div className="elevator-bg-unlock" onClick={handleUnlockAudio}>
              <div className="elevator-bg-unlock-title">[ ELEVATOR DISPLAY INITIALIZE ]</div>
              <div className="elevator-bg-unlock-desc">
                画面をタップして音声出力とフルスクリーンを有効化してください。
                <br />
                （エレベーター降下シーケンスおよびCCTV遠隔切替に自動同期します）
              </div>
              <button className="elevator-bg-unlock-btn">READY [ STANDBY ENABLE ]</button>
            </div>
          )}

          <div className="elevator-bg-standby-text">
            <div className="elevator-bg-standby-title">[ ELEVATOR SHAFT MONITOR ]</div>
            <div className="elevator-bg-standby-sub">
              {floorState === 'FLOOR_1' && 'CURRENT FLOOR: 1F (STATIONARY)'}
              {floorState === 'MOVING' && 'STATUS: MOVING BETWEEN 1F -> B1F'}
              {floorState === 'FLOOR_B1' && 'CURRENT FLOOR: B1F (STATIONARY)'}
              {floorState === 'OFF' && 'SYSTEM OFFLINE'}
            </div>
          </div>
        </div>
      )}

      {/* 3. エレベーター降下動画再生 */}
      <video
        ref={videoRef}
        className="elevator-bg-video"
        style={{
          display: displayMode === 'video' && hasStartedVideo && !useProcedural ? 'block' : 'none',
        }}
        onEnded={() => {
          console.log('[Elevator BG] Video playback finished. Holding on last frame without reverting.');
          setIsPlaying(false);
          // 元の待機画面には戻さず、最終フレームで静止したまま表示し続ける
        }}
        playsInline
        autoPlay
        preload="auto"
      />

      {/* 4. プロシージャル降下シャフト描画 Canvas */}
      {displayMode === 'video' && hasStartedVideo && useProcedural && (
        <canvas ref={proceduralCanvasRef} className="elevator-bg-canvas" />
      )}

      {/* 5. グリッチ・怪異発生オーバーレイ */}
      {isGlitching && <div className="elevator-bg-glitch-overlay" />}

      {/* 6. 右下ステータス HUD */}
      <div className={`elevator-bg-hud ${audioUnlocked ? 'ready' : ''}`}>
        <span>STATUS: {connected ? 'LINK OK' : 'LINK DOWN'}</span>
        <span>|</span>
        <span>FLOOR: {floorState}</span>
        <span>|</span>
        <button
          className="elevator-bg-hud-btn"
          onClick={() => {
            if (displayMode === 'video') {
              playElevatorDescent();
            } else {
              setDisplayMode('video');
            }
          }}
        >
          {displayMode === 'video' ? '映像再開' : '映像モード'}
        </button>
        <button
          className="elevator-bg-hud-btn"
          onClick={() => {
            setDisplayMode(displayMode === 'cctv' ? 'video' : 'cctv');
          }}
        >
          {displayMode === 'cctv' ? '映像に戻す' : 'CCTV中継'}
        </button>
        {hasStartedVideo && (
          <button
            className="elevator-bg-hud-btn"
            onClick={() => {
              setHasStartedVideo(false);
              setIsPlaying(false);
              setUseProcedural(false);
            }}
            title="待機画面（砂嵐）に戻す"
          >
            待機画面へ
          </button>
        )}
        <FullscreenButton className="elevator-bg-hud-fs-btn" />
      </div>
    </div>
  );
}
