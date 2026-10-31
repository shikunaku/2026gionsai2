'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import {
  DEFAULT_VIDEO_CONFIG,
  CctvCameraId,
  CCTV_CAMERAS,
  CctvCameraStatusPayload,
} from '../../../lib/types';
import { requestFullscreenSafe, isFullscreenActive } from '../../../lib/fullscreen';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import '../../../styles/video-display.css';

export default function VideoDisplayPlayerPage() {
  const { socket, connected } = useSocket();
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [useProcedural, setUseProcedural] = useState<boolean>(false);

  // CCTV 表示モード管理 ('video' | 'cctv')
  const [displayMode, setDisplayMode] = useState<'video' | 'cctv'>('video');
  const [cctvLayout, setCctvLayout] = useState<'grid3' | 'single'>('single');
  const [cctvActiveCam, setCctvActiveCam] = useState<CctvCameraId>('cam3');
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
  const animationFrameRef = useRef<number | null>(null);
  const hasTriggeredPanicRef = useRef<boolean>(false);
  const [panicEmitted, setPanicEmitted] = useState<boolean>(false);

  // WebRTC PeerConnections (key: CctvCameraId)
  const peerConnectionsRef = useRef<Map<CctvCameraId, RTCPeerConnection>>(new Map());
  // 各カメラの Remote MediaStream
  const remoteStreamsRef = useRef<Map<CctvCameraId, MediaStream>>(new Map());
  // 各カメラの <video> 要素参照
  const cctvVideoElsRef = useRef<Map<CctvCameraId, HTMLVideoElement>>(new Map());
  // 未完了Candidateキュー (key: camId)
  const pendingCandidatesRef = useRef<Map<CctvCameraId, RTCIceCandidateInit[]>>(new Map());

  /** 怪異出現・パニック自動発火タイムスタンプ（秒） */
  const PANIC_TRIGGER_SECONDS = 5.0;

  // CCTVクロック
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

      console.log(`[Area3 Monitor] Creating WebRTC PeerConnection for: ${camId}`);
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
        console.log(`[Area3 Monitor] WebRTC Track received (${camId}):`, event.streams[0]);
        const stream = event.streams[0];
        if (stream) {
          remoteStreamsRef.current.set(camId, stream);
          const videoEl = cctvVideoElsRef.current.get(camId);
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch((err) => {
              console.error(`[Area3 Monitor] Video play error for ${camId}:`, err);
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
          console.log('[Video Player] Available video files in /videos:', data.files);
        }
      })
      .catch((err) => {
        console.warn('[Video Player] Failed to fetch /api/video-files:', err);
      });
  }, []);

  const [isPreshowMode, setIsPreshowMode] = useState<boolean>(false);

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    // CCTVビューアーとして登録（カメラ配信受信準備）
    socket.emit('cctv:register_viewer');

    const handleAllStatus = (allStatus: CctvCameraStatusPayload[]) => {
      console.log('[Area3 Monitor] Received all camera statuses:', allStatus);
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
      console.log('[Area3 Monitor] Camera status update:', payload);
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

      if (type === 'offer' && sdp) {
        const existingPc = peerConnectionsRef.current.get(camId);
        if (existingPc && (existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed')) {
          return;
        }

        const pc = getOrCreatePeerConnection(camId, senderSocketId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('cctv:signal', {
            camId,
            targetSocketId: senderSocketId,
            type: 'answer',
            sdp: answer,
          });

          const pending = pendingCandidatesRef.current.get(camId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(camId);
        } catch (err) {
          console.error(`[Area3 Monitor] Error handling offer for ${camId}:`, err);
        }
      } else if (type === 'candidate' && candidate) {
        const pc = peerConnectionsRef.current.get(camId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn(`[Area3 Monitor] addIceCandidate error for ${camId}:`, e);
          }
        } else {
          const queue = pendingCandidatesRef.current.get(camId) || [];
          queue.push(candidate);
          pendingCandidatesRef.current.set(camId, queue);
        }
      }
    };

    // CCTV切り替え指示イベント（管理コンソールから受信）
    const handleCctvSwitch = (payload: { camId: CctvCameraId | 'grid3'; autoSwitchOnEnd?: boolean }) => {
      console.log('[Area3 Monitor] cctv:monitor_switch received:', payload);
      setDisplayMode('cctv');
      if (payload.camId === 'grid3') {
        setCctvLayout('grid3');
      } else {
        setCctvLayout('single');
        setCctvActiveCam(payload.camId);
      }
      // 再生中の動画があれば停止
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);

      // カメラ切り替え時にストリームを再アタッチ & 再生確認 (もし未接続ならviewer_readyで接続要求)
      const targetCams: CctvCameraId[] = payload.camId === 'grid3' ? ['cam1', 'cam2', 'cam3'] : [payload.camId];
      setTimeout(() => {
        targetCams.forEach((cId) => {
          const el = cctvVideoElsRef.current.get(cId);
          const stream = remoteStreamsRef.current.get(cId);
          if (el && stream) {
            if (el.srcObject !== stream) {
              el.srcObject = stream;
            }
            el.play().catch(() => {});
          } else if (!stream && socket) {
            // ストリームがまだ届いていない場合、対象カメラへ配信開始を要求
            socket.emit('cctv:signal', {
              camId: cId,
              type: 'viewer_ready',
            });
          }
        });
      }, 50);
    };

    const handlePreshowTrigger = (payload?: { videoSrc?: string }) => {
      console.log('[Video Player] PRESHOW_TRIGGER received:', payload);
      setIsPreshowMode(true);
      setDisplayMode('video');
      hasTriggeredPanicRef.current = false;
      setPanicEmitted(false);

      let src = payload?.videoSrc;
      if (!src) {
        if (availableVideos.length > 0) {
          src = `/videos/${availableVideos[0]}`;
        } else {
          src = '/videos/preshow.mp4';
        }
      }

      setVideoSrc(src);
      setIsPlaying(true);
      setUseProcedural(false);

      if (videoRef.current) {
        videoRef.current.src = src;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = !audioUnlocked;
        videoRef.current.play().catch((err) => {
          console.warn('[Video Player] Preshow play fallback:', err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    };

    const handleTriggerPlay = (payload?: { videoSrc?: string; title?: string }) => {
      console.log('[Video Player] TRIGGER_VIDEO_PLAY received:', payload);
      setIsPreshowMode(false);
      setDisplayMode('video');
      hasTriggeredPanicRef.current = false;
      setPanicEmitted(false);

      let src = payload?.videoSrc;
      if (!src) {
        const defaultArea3File = DEFAULT_VIDEO_CONFIG.area3;
        if (availableVideos.includes(defaultArea3File)) {
          src = `/videos/${defaultArea3File}`;
        } else {
          const area3Match = availableVideos.find((f) => {
            const lower = f.toLowerCase();
            return (
              (lower.includes('area3') || lower.includes('monitor') || lower.includes('final')) &&
              !lower.includes('preshow')
            );
          });
          if (area3Match) {
            src = `/videos/${area3Match}`;
          } else {
            const nonPreshow = availableVideos.find((f) => !f.toLowerCase().includes('preshow'));
            if (nonPreshow) {
              src = `/videos/${nonPreshow}`;
            } else {
              src = `/videos/${defaultArea3File}`;
            }
          }
        }
      }

      setVideoSrc(src);
      setIsPlaying(true);
      setUseProcedural(false);

      if (videoRef.current) {
        videoRef.current.src = src;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = !audioUnlocked;

        videoRef.current
          .play()
          .then(() => {
            console.log(`[Video Player] Video playback started successfully: ${src}`);
          })
          .catch((err) => {
            console.warn(`[Video Player] Playback failed for ${src}, trying muted:`, err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current
                .play()
                .then(() => {
                  console.log('[Video Player] Muted fallback playback succeeded.');
                })
                .catch((e2) => {
                  console.warn('[Video Player] Falling back to procedural horror synth:', e2);
                  setUseProcedural(true);
                  playProceduralHorrorShow();
                });
            } else {
              setUseProcedural(true);
              playProceduralHorrorShow();
            }
          });
      } else {
        setUseProcedural(true);
        playProceduralHorrorShow();
      }
    };

    const handleVideoReset = () => {
      console.log('[Video Player] Video reset received');
      hasTriggeredPanicRef.current = false;
      setPanicEmitted(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setUseProcedural(false);
      setDisplayMode('video');
    };

    socket.on('cctv:all_status', handleAllStatus);
    socket.on('cctv:status', handleStatusUpdate);
    socket.on('cctv:signal', handleSignal);
    socket.on('cctv:monitor_switch', handleCctvSwitch);
    socket.on('preshow:trigger', handlePreshowTrigger);
    socket.on('video:trigger_play', handleTriggerPlay);
    socket.on('video:reset', handleVideoReset);

    return () => {
      socket.off('cctv:all_status', handleAllStatus);
      socket.off('cctv:status', handleStatusUpdate);
      socket.off('cctv:signal', handleSignal);
      socket.off('cctv:monitor_switch', handleCctvSwitch);
      socket.off('preshow:trigger', handlePreshowTrigger);
      socket.off('video:trigger_play', handleTriggerPlay);
      socket.off('video:reset', handleVideoReset);
    };
  }, [socket, availableVideos, audioUnlocked, getOrCreatePeerConnection]);

  // Audio unlock click handler
  const handleUnlockAudio = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }

    // Fullscreen request
    await requestFullscreenSafe();

    setAudioUnlocked(true);
  };

  // Video element playback events: 終了時にそのままCCTV映像へ自動切り替え！
  const handleVideoEnded = () => {
    console.log('[Video Player] Video ended.');
    setIsPlaying(false);
    if (socket) {
      if (isPreshowMode) {
        socket.emit('preshow:ended');
      } else {
        socket.emit('video:ended');
        // ユーザー要件: 「映像を見たあと、そのままCCTVの映像を映してほしい」
        // 映像再生完了後、自動的にCAM-3（または設定されたCCTV画面）へ切り替え
        setDisplayMode('cctv');
        setCctvLayout('single');
        setCctvActiveCam('cam3');
        console.log('[Video Player] Auto-switched to CCTV live camera feed (CAM-3)');
      }
    }
  };

  // 動画再生中のタイムスタンプ監視
  // ※仕様変更: エリア3のパニック脱出は、動画終了後にCCTV映像を放映し、
  // 管理コンソールの［パニック脱出発火］ボタンを押したタイミングで切り替えるため、
  // 動画再生中の自動 panic:trigger 送信は行いません。
  const handleTimeUpdate = () => {
    // 自動発火は行わず、管理コンソールからの発火待ちとする
  };

  // Procedural Generative Horror Visual & Audio (Used when video file is absent or as fallback)
  const playProceduralHorrorShow = () => {
    const canvas = proceduralCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const actx = audioCtxRef.current;

    if (actx) {
      const droneOsc = actx.createOscillator();
      const droneGain = actx.createGain();
      droneOsc.type = 'sawtooth';
      droneOsc.frequency.setValueAtTime(55, actx.currentTime);
      droneGain.gain.setValueAtTime(0.4, actx.currentTime);

      const filter = actx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, actx.currentTime);
      filter.frequency.linearRampToValueAtTime(1200, actx.currentTime + 5);

      droneOsc.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(actx.destination);

      droneOsc.start();
      droneGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 7.5);
      droneOsc.stop(actx.currentTime + 7.5);
    }

    let startTime = Date.now();
    const duration = 7500; // 7.5 seconds

    const renderShow = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        setIsPlaying(false);
        setUseProcedural(false);
        if (socket) {
          socket.emit('video:ended');
          setDisplayMode('cctv');
          setCctvLayout('single');
          setCctvActiveCam('cam3');
        }
        return;
      }

      if (canvas && ctx) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const progress = elapsed / duration;
        const redIntensity = Math.floor(Math.sin(progress * Math.PI * 6) * 120 + 130);
        ctx.fillStyle = `rgb(${redIntensity}, 10, 10)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRITICAL FACILITY FAILURE', canvas.width / 2, canvas.height / 2 - 40);

        ctx.font = '20px monospace';
        ctx.fillStyle = '#ffcccc';
        ctx.fillText('ANOMALY DETECTED IN SECTOR 03', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText(
          `TIME: ${(elapsed / 1000).toFixed(2)}s / EVACUATE IMMEDIATELY`,
          canvas.width / 2,
          canvas.height / 2 + 45
        );

        for (let i = 0; i < 8; i++) {
          const y = Math.random() * canvas.height;
          const h = Math.random() * 20 + 5;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, y, canvas.width, h);
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderShow);
    };

    renderShow();
  };

  // CCTV各カメラのレンダリング (DOMを破棄せず保持してWebRTC接続とMediaStreamを維持)
  const renderCctvCamera = (camId: CctvCameraId) => {
    const config = CCTV_CAMERAS.find((c) => c.id === camId) || CCTV_CAMERAS[0];
    const status = cameraStatus[camId] || { online: false, lightOn: false };
    const isActive = cctvActiveCam === camId;
    const isHiddenInSingle = cctvLayout === 'single' && !isActive;

    return (
      <div
        key={camId}
        className={`video-cctv-card ${isActive ? 'is-active-cam' : ''} ${isHiddenInSingle ? 'cctv-card-hidden' : ''}`}
        style={isHiddenInSingle ? { display: 'none' } : undefined}
      >
        <div className="video-cctv-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`video-cctv-badge ${status.online ? 'live' : 'offline'}`}>
              {status.online ? 'LIVE' : 'NO SIGNAL'}
            </span>
            <span className="video-cctv-title">{config.name}</span>
          </div>
          <div className="video-cctv-clock">
            {cctvClock} {status.battery !== undefined && `[BAT ${status.battery}%]`}
          </div>
        </div>

        <div className="video-cctv-media-box">
          <video
            ref={(el) => setCctvVideoRef(camId, el)}
            autoPlay
            playsInline
            muted
            className="video-cctv-stream-video"
            style={{ display: status.online ? 'block' : 'none' }}
          />
          <div className="video-scanlines" />
          <div className="video-vignette" />

          {!status.online && (
            <div className="video-cctv-no-signal">
              <div className="video-cctv-no-signal-title">[NO SIGNAL]</div>
              <div className="video-cctv-no-signal-desc">{config.location}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="video-player-root">
      {/* 1. CCTV モード表示 */}
      {displayMode === 'cctv' && (
        <div className={`video-cctv-container cctv-layout-${cctvLayout}`}>
          <div className="video-cctv-wrapper">
            {CCTV_CAMERAS.map((cam) => renderCctvCamera(cam.id))}
          </div>
        </div>
      )}

      {/* 2. Standby screen with CRT Scanlines and Grain */}
      {displayMode === 'video' && !isPlaying && (
        <div className="video-standby-screen">
          <canvas ref={noiseCanvasRef} className="video-noise-canvas" />
          <div className="video-scanlines" />
          <div className="video-vignette" />

          {/* Prompt to unlock audio (if not yet unlocked) */}
          {!audioUnlocked && (
            <div className="video-unlock-prompt" onClick={handleUnlockAudio}>
              <div className="video-unlock-title">[ AREA 3 MONITOR INITIALIZE ]</div>
              <div className="video-unlock-desc">
                画面をタップして音声出力とフルスクリーンを有効化してください。
                <br />
                （ブラウザの自動再生制限を解除し待機状態にします）
              </div>
              <button className="video-unlock-btn">READY [ STANDBY ENABLE ]</button>
            </div>
          )}

          {/* Standby indicator */}
          <div className="video-standby-text">
            <div className="video-standby-title">[ AREA 3 MONITOR DISPLAY ]</div>
            <div className="video-standby-sub">
              {audioUnlocked
                ? 'STANDBY // WAITING FOR PARTICIPANT TRIGGER...'
                : 'WAITING FOR INITIALIZATION TAP...'}
            </div>
          </div>
        </div>
      )}

      {/* 3. Video element when active video file exists */}
      <video
        ref={videoRef}
        className="video-fullscreen-player"
        style={{
          display: displayMode === 'video' && isPlaying && !useProcedural ? 'block' : 'none',
        }}
        onEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        autoPlay
        preload="auto"
      />

      {/* 4. Procedural visualizer canvas fallback */}
      {displayMode === 'video' && isPlaying && useProcedural && (
        <canvas ref={proceduralCanvasRef} className="video-procedural-canvas" />
      )}

      {/* HUD status in corner */}
      <div className={`video-hud ${audioUnlocked ? 'ready' : ''}`}>
        <span>STATUS: {connected ? 'LINK OK' : 'LINK DOWN'}</span>
        <span>|</span>
        <span>MODE: {displayMode.toUpperCase()}</span>
        <span>|</span>
        <span>
          {displayMode === 'cctv'
            ? `CCTV: ${cctvLayout === 'grid3' ? '3分割' : cctvActiveCam.toUpperCase()}`
            : isPlaying
            ? panicEmitted
              ? 'PANIC SYNC ACTIVE'
              : 'PLAYING'
            : 'IDLE'}
        </span>
        <span>|</span>
        <FullscreenButton className="video-hud-fs-btn" />
      </div>
    </div>
  );
}
