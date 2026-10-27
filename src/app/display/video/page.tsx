'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import { DEFAULT_VIDEO_CONFIG } from '../../../lib/types';
import '../../../styles/video-display.css';

export default function VideoDisplayPlayerPage() {
  const { socket, connected } = useSocket();
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [useProcedural, setUseProcedural] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasTriggeredPanicRef = useRef<boolean>(false);
  const [panicEmitted, setPanicEmitted] = useState<boolean>(false);

  /** 怪異出現・パニック自動発火タイムスタンプ（秒） */
  const PANIC_TRIGGER_SECONDS = 5.0;

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
        // まだ要素がレイアウトされていないか非表示の場合は次フレームで再試行
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
        // Random grayscale noise with occasional flicker
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

      const handlePreshowTrigger = (payload?: { videoSrc?: string }) => {
        console.log('[Video Player] PRESHOW_TRIGGER received:', payload);
        setIsPreshowMode(true);
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
        hasTriggeredPanicRef.current = false;
        setPanicEmitted(false);

        // 優先度: payload指定 > DEFAULT_VIDEO_CONFIG.area3 > 'area3'を含む実在ファイル > preshow以外の実在ファイル > フォールバック
        let src = payload?.videoSrc;
        if (!src) {
          const defaultArea3File = DEFAULT_VIDEO_CONFIG.area3;
          if (availableVideos.includes(defaultArea3File)) {
            src = `/videos/${defaultArea3File}`;
          } else {
            const area3Match = availableVideos.find((f) => {
              const lower = f.toLowerCase();
              return (lower.includes('area3') || lower.includes('monitor') || lower.includes('final')) && !lower.includes('preshow');
            });
            if (area3Match) {
              src = `/videos/${area3Match}`;
            } else {
              // preshow以外のファイル
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

          // 音声アンロック状態に応じて音声を有効化（未アンロック時はブラウザポリシー制限回避のためmutedで確実に再生）
          videoRef.current.muted = !audioUnlocked;

          videoRef.current
            .play()
            .then(() => {
              console.log(`[Video Player] Video playback started successfully for: ${src} (muted: ${videoRef.current?.muted})`);
            })
            .catch((err) => {
              console.warn(`[Video Player] Video playback failed for ${src}, trying muted autoPlay fallback:`, err);
              if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current
                  .play()
                  .then(() => {
                    console.log('[Video Player] Muted fallback playback succeeded.');
                  })
                  .catch((e2) => {
                    console.warn('[Video Player] Both direct and muted video failed. Falling back to procedural horror synth:', e2);
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
      };

      socket.on('preshow:trigger', handlePreshowTrigger);
      socket.on('video:trigger_play', handleTriggerPlay);
      socket.on('video:reset', handleVideoReset);

      return () => {
        socket.off('preshow:trigger', handlePreshowTrigger);
        socket.off('video:trigger_play', handleTriggerPlay);
        socket.off('video:reset', handleVideoReset);
      };
    }, [socket, availableVideos, audioUnlocked]);

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

          // Play brief sub-bass unlock sound
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

      // Also attempt fullscreen
      try {
        if (document.documentElement && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        // Fullscreen optional
      }

      setAudioUnlocked(true);
    };

    // Video element playback events
    const handleVideoEnded = () => {
      console.log('[Video Player] Video ended.');
      setIsPlaying(false);
      if (socket) {
        if (isPreshowMode) {
          console.log('[Video Player] Emitting preshow:ended to notify clients');
          socket.emit('preshow:ended');
        } else {
          socket.emit('video:ended');
        }
      }
    };

  // 動画再生中のタイムスタンプ監視（特定秒数で自動パニックを発動）
  const handleTimeUpdate = () => {
    if (!videoRef.current || hasTriggeredPanicRef.current) return;
    const currentTime = videoRef.current.currentTime;

    if (currentTime >= PANIC_TRIGGER_SECONDS) {
      hasTriggeredPanicRef.current = true;
      setPanicEmitted(true);
      console.log(`[Video Player] PANIC TIMESTAMP HIT: ${currentTime.toFixed(2)}s (Target: ${PANIC_TRIGGER_SECONDS}s) -> Emitting panic:trigger!`);
      if (socket) {
        socket.emit('panic:trigger', { timestamp: currentTime, reason: 'VIDEO_ANOMALY_TIMESTAMP' });
      }
    }
  };

  // Procedural Generative Horror Visual & Audio (Used when video file is absent or as fallback)
  const playProceduralHorrorShow = () => {
    const canvas = proceduralCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const actx = audioCtxRef.current;

    // Synthesize eerie audio drones & alarms
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

    // Procedural Canvas animation
    let startTime = Date.now();
    const duration = 7500; // 7.5 seconds

    const renderShow = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        setIsPlaying(false);
        setUseProcedural(false);
        if (socket) socket.emit('video:ended');
        return;
      }

      // プロシージャル再生時も4秒経過時に自動パニックを発行
      if (elapsed >= 4000 && !hasTriggeredPanicRef.current) {
        hasTriggeredPanicRef.current = true;
        setPanicEmitted(true);
        console.log('[Video Player] Procedural horror elapsed 4.0s -> Emitting panic:trigger!');
        if (socket) {
          socket.emit('panic:trigger', { timestamp: elapsed / 1000, reason: 'PROCEDURAL_HORROR_TIMESTAMP' });
        }
      }

      if (canvas && ctx) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const progress = elapsed / duration;
        // Background color shifts from black to warning blood red and static
        const redIntensity = Math.floor(Math.sin(progress * Math.PI * 6) * 120 + 130);
        ctx.fillStyle = `rgb(${redIntensity}, 10, 10)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw horror warning anomalies
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRITICAL FACILITY FAILURE', canvas.width / 2, canvas.height / 2 - 40);

        ctx.font = '20px monospace';
        ctx.fillStyle = '#ffcccc';
        ctx.fillText('ANOMALY DETECTED IN SECTOR 03', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText(`TIME: ${(elapsed / 1000).toFixed(2)}s / EVACUATE IMMEDIATELY`, canvas.width / 2, canvas.height / 2 + 45);

        // Red glitch tear lines
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

  return (
    <div className="video-player-root">
      {/* Standby screen with CRT Scanlines and Grain */}
      {!isPlaying && (
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

      {/* Video element when active video file exists */}
      <video
        ref={videoRef}
        className="video-fullscreen-player"
        style={{ display: isPlaying && !useProcedural ? 'block' : 'none' }}
        onEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        autoPlay
        preload="auto"
      />

      {/* Procedural visualizer canvas fallback */}
      {isPlaying && useProcedural && (
        <canvas ref={proceduralCanvasRef} className="video-procedural-canvas" />
      )}

      {/* HUD status in corner */}
      <div className={`video-hud ${audioUnlocked ? 'ready' : ''}`}>
        <span>STATUS: {connected ? 'LINK OK' : 'LINK DOWN'}</span>
        <span>|</span>
        <span>AUDIO: {audioUnlocked ? 'UNLOCKED' : 'LOCKED'}</span>
        <span>|</span>
        <span>STATE: {isPlaying ? (panicEmitted ? 'PANIC SYNC ACTIVE' : 'PLAYING') : 'IDLE'}</span>
      </div>
    </div>
  );
}
