'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import { DEFAULT_VIDEO_CONFIG } from '../../../lib/types';
import '../../../styles/video-display.css';

export default function PreshowDisplayPlayerPage() {
  const { socket, connected } = useSocket();
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [availableVideos, setAvailableVideos] = useState<string[]>([]);
  const [preshowEndedSent, setPreshowEndedSent] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Background Analog TV Noise on standby (same as Area 3 video player)
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

  // Fetch available video files in public/videos/
  useEffect(() => {
    fetch('/api/video-files')
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => {
        if (Array.isArray(data.files) && data.files.length > 0) {
          setAvailableVideos(data.files);
          console.log('[Preshow Display] Available video files:', data.files);
        }
      })
      .catch((err) => {
        console.warn('[Preshow Display] Failed to fetch /api/video-files:', err);
      });
  }, []);

  // Determine target video source for preshow
  const getPreshowVideoSource = (overrideSrc?: string): string => {
    if (overrideSrc) return overrideSrc;

    const defaultPreshowFile = DEFAULT_VIDEO_CONFIG.preshow;
    if (availableVideos.includes(defaultPreshowFile)) {
      return `/videos/${defaultPreshowFile}`;
    }

    // Search for any file with 'preshow' in name
    const preshowMatch = availableVideos.find((f) => f.toLowerCase().includes('preshow'));
    if (preshowMatch) {
      return `/videos/${preshowMatch}`;
    }

    // If only one video exists, use it
    if (availableVideos.length === 1) {
      return `/videos/${availableVideos[0]}`;
    }

    return `/videos/${defaultPreshowFile}`;
  };

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleStartPlayback = (payload?: { videoSrc?: string }) => {
      console.log('[Preshow Display] Preshow start trigger received:', payload);
      setPreshowEndedSent(false);

      const src = getPreshowVideoSource(payload?.videoSrc);
      setVideoSrc(src);
      setIsPlaying(true);

      if (videoRef.current) {
        videoRef.current.src = src;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = !audioUnlocked;
        videoRef.current
          .play()
          .then(() => {
            console.log(`[Preshow Display] Video started: ${src}`);
          })
          .catch((err) => {
            console.warn('[Preshow Display] Direct playback failed, attempting muted fallback:', err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }
          });
      }
    };

    const handleVideoReset = () => {
      console.log('[Preshow Display] Reset received');
      setPreshowEndedSent(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    };

    socket.on('preshow:start', handleStartPlayback);
    socket.on('preshow:trigger', handleStartPlayback);
    socket.on('video:reset', handleVideoReset);

    return () => {
      socket.off('preshow:start', handleStartPlayback);
      socket.off('preshow:trigger', handleStartPlayback);
      socket.off('video:reset', handleVideoReset);
    };
  }, [socket, availableVideos, audioUnlocked]);

  // Audio unlock and Fullscreen request
  const handleUnlockAudio = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        audioCtxRef.current = ctx;
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }

    try {
      if (document.documentElement && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // Fullscreen optional
    }

    setAudioUnlocked(true);
  };

  // Video playback completion handler
  const handleVideoEnded = () => {
    console.log('[Preshow Display] Preshow video ended. Emitting preshow:ended to notify clients');
    setIsPlaying(false);
    setPreshowEndedSent(true);
    if (socket) {
      socket.emit('preshow:ended');
    }
  };

  // Manual Trigger for test / offline inspection
  const handleManualPlay = () => {
    const src = getPreshowVideoSource();
    setVideoSrc(src);
    setIsPlaying(true);
    setPreshowEndedSent(false);

    if (videoRef.current) {
      videoRef.current.src = src;
      videoRef.current.currentTime = 0;
      videoRef.current.muted = !audioUnlocked;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  };

  return (
    <div className="video-player-root">
      {/* Standby screen with CRT Scanlines, Noise, and Vignette */}
      {!isPlaying && (
        <div className="video-standby-screen">
          <canvas ref={noiseCanvasRef} className="video-noise-canvas" />
          <div className="video-scanlines" />
          <div className="video-vignette" />

          {/* Audio unlock prompt overlay */}
          {!audioUnlocked && (
            <div className="video-unlock-prompt" onClick={handleUnlockAudio}>
              <div className="video-unlock-title">[ PRE-SHOW DISPLAY INITIALIZE ]</div>
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
            <div className="video-standby-title">[ PRE-SHOW DISPLAY SCREEN ]</div>
            <div className="video-standby-sub">
              {audioUnlocked
                ? 'STANDBY // 待機ホール正面スクリーン - 上映開始命令を待機中...'
                : 'WAITING FOR INITIALIZATION TAP...'}
            </div>

            {preshowEndedSent && (
              <div
                style={{
                  margin: '16px auto 0 auto',
                  padding: '8px 16px',
                  backgroundColor: 'rgba(27, 94, 32, 0.85)',
                  color: '#e8f5e9',
                  border: '1px solid #81c784',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                [COMPLETE] 上映完了 - PDA端末へ品質管理室への移動指示を通知しました
              </div>
            )}

            {audioUnlocked && (
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={handleManualPlay}
                  className="win95-btn"
                  style={{
                    padding: '8px 18px',
                    fontSize: '12px',
                    backgroundColor: '#0d47a1',
                    color: '#fff',
                    fontWeight: 'bold',
                  }}
                >
                  手動テスト上映開始 ({getPreshowVideoSource()})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video element (matches Area 3 video player dimensions & CSS) */}
      <video
        ref={videoRef}
        className="video-fullscreen-player"
        style={{ display: isPlaying ? 'block' : 'none' }}
        onEnded={handleVideoEnded}
        playsInline
        autoPlay
        preload="auto"
      />

      {/* HUD status in corner */}
      <div className={`video-hud ${audioUnlocked ? 'ready' : ''}`}>
        <span>SCREEN: PRE-SHOW</span>
        <span>|</span>
        <span>LINK: {connected ? 'OK' : 'OFFLINE'}</span>
        <span>|</span>
        <span>AUDIO: {audioUnlocked ? 'UNLOCKED' : 'LOCKED'}</span>
        <span>|</span>
        <span>FILE: {videoSrc || getPreshowVideoSource()}</span>
      </div>
    </div>
  );
}
