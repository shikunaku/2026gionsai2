'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useTorch } from '../../hooks/useTorch';
import { useBattery } from '../../hooks/useBattery';
import { useWakeLock } from '../../hooks/useWakeLock';
import { ScreenDimmerOverlay } from '../../components/common/ScreenDimmerOverlay';
import { CctvCameraId, CCTV_CAMERAS } from '../../lib/types';
import '../../styles/client.css';

function CameraStreamerContent() {
  const searchParams = useSearchParams();
  const initialCamId = (searchParams.get('id') as CctvCameraId) || 'cam1';
  const [selectedCamId, setSelectedCamId] = useState<CctvCameraId>(initialCamId);
  const { socket, connected } = useSocket();
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const { isActive: wakeLockActive } = useWakeLock(true);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // ビューアーごとの PeerConnection 管理 (key: viewerSocketId)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [activeVideoTrack, setActiveVideoTrack] = useState<MediaStreamTrack | null>(null);

  // フラッシュライト（Torch）制御
  const handleTorchChange = useCallback(
    (torchState: boolean) => {
      if (socket && connected) {
        socket.emit('cctv:camera_status_update', {
          camId: selectedCamId,
          online: isStreaming,
          lightOn: torchState,
        });
      }
    },
    [socket, connected, selectedCamId, isStreaming]
  );

  const { torchOn, setTorch, toggleTorch, isTorchAvailable, torchWarning } = useTorch({
    externalTrack: activeVideoTrack,
    onStateChange: handleTorchChange,
  });

  // バッテリー監視（スロットル）
  const handleBatterySync = (() => {
    let lastEmit = 0;
    const throttleMs = 5000; // 5 秒ごとに送信
    return (batteryLevel: number) => {
      const now = Date.now();
      if (now - lastEmit < throttleMs) return;
      lastEmit = now;
      if (socket && connected) {
        socket.emit('cctv:camera_status_update', {
          camId: selectedCamId,
          online: isStreaming,
          lightOn: torchOn,
          batteryLevel,
          room: 'cctv', // ルーム限定でブロードキャスト
        });
      }
    };
  })();


  const { level: batteryLevel, charging } = useBattery(handleBatterySync);

  const currentCamInfo = CCTV_CAMERAS.find((c) => c.id === selectedCamId) || CCTV_CAMERAS[0];

  // カメラMediaStreamの起動
  const startCamera = async () => {
    try {
      setStreamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, // 監視用映像専用（帯域・負荷削減）
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640, max: 640 }, // 固定 640px 幅
          height: { ideal: 360, max: 360 }, // 固定 360px 高さ (CCTV 用に軽量化)
          frameRate: { ideal: 5, max: 5 }, // 5 FPS に制限して帯域と CPU 負荷を削減
        },
      });

      mediaStreamRef.current = stream;
      const vTrack = stream.getVideoTracks()[0] || null;
      setActiveVideoTrack(vTrack);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      setIsStreaming(true);

      // サーバーへ登録通知および接続済みビューアーへの配信接続要求
      if (socket && connected) {
        socket.emit('cctv:register_camera', { camId: selectedCamId, room: 'cctv' });
        socket.emit('cctv:camera_status_update', {
          camId: selectedCamId,
          online: true,
          lightOn: torchOn,
          batteryLevel,
          room: 'cctv', // ルーム限定でブロードキャスト
        });
      }
    } catch (err: any) {
      console.error('[CCTV Camera] getUserMedia error:', err);
      setStreamError(err.message || 'カメラへのアクセスが拒否されたか、利用できません。');
      setIsStreaming(false);
      setActiveVideoTrack(null);
    }
  };

  // カメラ停止
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setActiveVideoTrack(null);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    // 全PeerConnectionのクローズ
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setIsStreaming(false);
    setViewerCount(0);

    if (socket && connected) {
      socket.emit('cctv:camera_status_update', {
        camId: selectedCamId,
        online: false,
        lightOn: false,
        batteryLevel,
      });
    }
  };

  // 未完了Candidateキュー (key: viewerSocketId)
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // ビューアーとの WebRTC PeerConnection 接続作成 & Offer送信
  const createPeerConnectionForViewer = useCallback(
    async (viewerSocketId: string) => {
      if (!mediaStreamRef.current || !socket) return;

      console.log(`[CCTV Camera] Creating WebRTC PeerConnection for viewer: ${viewerSocketId}`);

      // 既存接続があればクローズ
      if (peerConnectionsRef.current.has(viewerSocketId)) {
        try {
          peerConnectionsRef.current.get(viewerSocketId)?.close();
        } catch {}
      }

      const rtcConfig: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      };

      const pc = new RTCPeerConnection(rtcConfig);

      // 映像トラックを追加
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.enabled = true;
        console.log(`[CCTV Camera] Adding track: id=${track.id}, kind=${track.kind}, enabled=${track.enabled}`);
        pc.addTrack(track, mediaStreamRef.current!);
      });

      // ICE Candidate 発見時
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(`[CCTV Camera] Generated ICE Candidate for ${viewerSocketId}:`, event.candidate.candidate);
          socket.emit('cctv:signal', {
            camId: selectedCamId,
            targetSocketId: viewerSocketId,
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[CCTV Camera] ICE Connection State (${selectedCamId} -> ${viewerSocketId}):`, pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log(`[CCTV Camera] Signaling State (${selectedCamId} -> ${viewerSocketId}):`, pc.signalingState);
      };

      pc.onconnectionstatechange = () => {
        console.log(`[CCTV Camera] Connection State (${selectedCamId} -> ${viewerSocketId}):`, pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(viewerSocketId);
          setViewerCount(peerConnectionsRef.current.size);
        } else if (pc.connectionState === 'connected') {
          setViewerCount(peerConnectionsRef.current.size);
        }
      };

      peerConnectionsRef.current.set(viewerSocketId, pc);
      setViewerCount(peerConnectionsRef.current.size);

      // Offer 作成 & 送信
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        console.log(`[CCTV Camera] Local offer set and sending to viewer: ${viewerSocketId}`);

        socket.emit('cctv:signal', {
          camId: selectedCamId,
          targetSocketId: viewerSocketId,
          type: 'offer',
          sdp: offer,
        });
      } catch (e) {
        console.error('[CCTV Camera] Error creating offer:', e);
      }
    },
    [socket, selectedCamId]
  );

  // Socket イベントリスナー
  useEffect(() => {
    if (!socket) return;

    // 接続時に自身のカメラIDをサーバーへ登録
    socket.emit('cctv:register_camera', { camId: selectedCamId });

    // 遠隔ライト制御シグナル受信
    const handleRemoteLightControl = ({ camId, lightOn }: { camId: CctvCameraId; lightOn: boolean }) => {
      if (camId === selectedCamId) {
        console.log(`[CCTV Camera] Remote light control received: ${lightOn}`);
        setTorch(lightOn);
      }
    };

    // WebRTC シグナリング処理
    const handleSignal = async (payload: any) => {
      const { camId, type, senderSocketId, sdp, candidate } = payload;
      if (camId !== selectedCamId || !senderSocketId) return;

      if (type === 'viewer_ready') {
        const existingPc = peerConnectionsRef.current.get(senderSocketId);
        if (existingPc && (existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed')) {
          console.log(`[CCTV Camera] WebRTC connection to ${senderSocketId} already active (${existingPc.iceConnectionState}). Skipping offer.`);
          return;
        }

        console.log(`[CCTV Camera] Viewer ready signal received from: ${senderSocketId}`);
        // ビューアーが準備できたので、ストリーミング中ならOfferを作成して接続開始
        if (mediaStreamRef.current) {
          createPeerConnectionForViewer(senderSocketId);
        }
      } else if (type === 'answer' && sdp) {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc) {
          console.log(`[CCTV Camera] Setting remote description (answer) from ${senderSocketId}`);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // 送信ビットレートの上限設定 (800kbps: 帯域詰まり・パケットロス・定期フリーズ防止)
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              const parameters = sender.getParameters();
              if (!parameters.encodings || parameters.encodings.length === 0) {
                parameters.encodings = [{}];
              }
              parameters.encodings[0].maxBitrate = 800000; // 800 kbps
              sender.setParameters(parameters).catch((err) => {
                console.warn('[CCTV Camera] setParameters maxBitrate error:', err);
              });
            }

            // 保留していたICE Candidateがあれば順次適用
            const pending = pendingCandidatesRef.current.get(senderSocketId) || [];
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingCandidatesRef.current.delete(senderSocketId);
          } catch (err) {
            console.error(`[CCTV Camera] Error setting remote answer:`, err);
          }
        }
      } else if (type === 'candidate' && candidate) {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[CCTV Camera] addIceCandidate error:', e);
          }
        } else {
          // remoteDescriptionがまだ設定されていない場合はキューに保存
          const currentQueue = pendingCandidatesRef.current.get(senderSocketId) || [];
          currentQueue.push(candidate);
          pendingCandidatesRef.current.set(senderSocketId, currentQueue);
        }
      }
    };

    socket.on('cctv:light_control', handleRemoteLightControl);
    socket.on('cctv:signal', handleSignal);

    return () => {
      socket.off('cctv:light_control', handleRemoteLightControl);
      socket.off('cctv:signal', handleSignal);
    };
  }, [socket, selectedCamId, setTorch, createPeerConnectionForViewer]);

  // カメラ切り替えハンドラー
  const handleCamSelect = (newId: CctvCameraId) => {
    if (isStreaming) {
      stopCamera();
    }
    setSelectedCamId(newId);
  };

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="client-root" style={{ backgroundColor: '#0d1117' }}>
      <div className="win95-window client-window" style={{ maxWidth: '520px', backgroundColor: '#161b22', color: '#e6edf3' }}>
        {/* Header */}
        <header className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1f2937, #374151)', color: '#fff' }}>
          <div className="client-header-group">
            <span className={`client-link-dot${connected ? ' online' : ''}`} />
            <strong>[CCTV CAM NODE] 監視カメラ配信端末</strong>
          </div>
          <div className="client-header-group">
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {charging ? '[CHG]' : '[BAT]'} {batteryLevel}%
            </span>
          </div>
        </header>

        {/* Main Body */}
        <main style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
          {/* Camera Selection */}
          <div className="win95-window" style={{ border: '1px solid #30363d', backgroundColor: '#21262d' }}>
            <div className="win95-titlebar" style={{ background: '#30363d', color: '#c9d1d9', fontSize: '12px' }}>
              <span>監視カメラ割り当て選択</span>
            </div>
            <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {CCTV_CAMERAS.map((cam) => {
                const isSelected = cam.id === selectedCamId;
                return (
                  <button
                    key={cam.id}
                    onClick={() => handleCamSelect(cam.id)}
                    disabled={isStreaming}
                    className="win95-btn"
                    style={{
                      padding: '8px 4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: isSelected ? '#1f6feb' : '#30363d',
                      color: isSelected ? '#ffffff' : '#8b949e',
                      border: isSelected ? '1px solid #58a6ff' : '1px solid #30363d',
                    }}
                  >
                    {cam.id.toUpperCase()}
                    <br />
                    <span style={{ fontSize: '9px', fontWeight: 'normal' }}>
                      {cam.name.split(':')[1]?.trim() || cam.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Camera Info Card */}
          <div
            style={{
              padding: '10px',
              backgroundColor: '#1f242c',
              border: '1px solid #384252',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.6',
            }}
          >
            <div>
              <strong>設置系統:</strong> <span style={{ color: '#58a6ff', fontWeight: 'bold' }}>{currentCamInfo.name}</span>
            </div>
            <div>
              <strong>監視エリア:</strong> {currentCamInfo.location}
            </div>
            <div>
              <strong>配信ステータス:</strong>{' '}
              <span style={{ color: isStreaming ? '#3fb950' : '#f85149', fontWeight: 'bold' }}>
                {isStreaming ? `● LIVE 配信中 (${viewerCount}台監視中)` : '○ 停止中 (待機)'}
              </span>
            </div>
          </div>

          {/* Video Preview Viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#000',
              border: '2px solid #30363d',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: isStreaming ? 'block' : 'none',
              }}
            />

            {!isStreaming && (
              <div style={{ textAlign: 'center', color: '#6e7681', padding: '20px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>[NO SIGNAL]</div>
                <div style={{ fontSize: '12px' }}>「カメラ配信を開始」を押すと背面カメラが起動します</div>
              </div>
            )}

            {/* Viewport Overlay */}
            {isStreaming && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  color: '#3fb950',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                }}
              >
                ● LIVE REC [{selectedCamId.toUpperCase()}]
              </div>
            )}

            {/* Torch indicator on video */}
            {isStreaming && torchOn && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(217, 119, 6, 0.8)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  color: '#ffffff',
                  fontWeight: 'bold',
                }}
              >
                LIGHT: ON
              </div>
            )}
          </div>

          {/* Stream Error Alert */}
          {streamError && (
            <div style={{ backgroundColor: '#490202', border: '1px solid #f85149', color: '#ff7b72', padding: '8px', fontSize: '11px' }}>
              [ERROR] {streamError}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={isStreaming ? stopCamera : startCamera}
              className="win95-btn"
              style={{
                padding: '14px',
                fontSize: '15px',
                fontWeight: 'bold',
                backgroundColor: isStreaming ? '#da3633' : '#238636',
                color: '#ffffff',
                border: '2px solid',
                borderColor: isStreaming ? '#f85149' : '#3fb950',
                letterSpacing: '1px',
              }}
            >
              {isStreaming ? '■ 配信を停止 [STOP STREAM]' : '▲ カメラ配信を開始 [START STREAM]'}
            </button>

            {/* Flashlight Remote / Local Test */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <button
                onClick={toggleTorch}
                disabled={!isStreaming}
                className="win95-btn"
                style={{
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  backgroundColor: torchOn ? '#d97706' : '#21262d',
                  color: torchOn ? '#ffffff' : '#8b949e',
                  border: '1px solid #30363d',
                }}
              >
                {torchOn ? '照明ライト: 点灯中 [タップで消灯]' : '照明ライト: テスト点灯 [TORCH]'}
              </button>
            </div>
          </div>

          {/* Operational Instructions */}
          <div
            className="win95-inset-dark"
            style={{
              padding: '10px',
              fontSize: '11px',
              color: '#8b949e',
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              lineHeight: '1.7',
            }}
          >
            <div>※ このスマホを現場の指定箇所に固定し、配信をONにしてください。</div>
            <div>※ 管理画面（/admin/cctv）から常時リアルタイム映像を確認できます。</div>
            <div>※ 暗視用ライトは管理画面側からも遠隔で点灯/消灯可能です。</div>
          </div>
        </main>

        {/* Footer */}
        <footer className="win95-statusbar" style={{ backgroundColor: '#161b22', borderTop: '1px solid #30363d', color: '#8b949e', fontSize: '10px' }}>
          <span>NODE: {selectedCamId.toUpperCase()}</span>
          <span>|</span>
          <span>WEBRTC: {peerConnectionsRef.current.size > 0 ? 'ACTIVE' : 'IDLE'}</span>
          <span>|</span>
          <span>TORCH: {torchOn ? 'ON' : 'OFF'}</span>
        </footer>
      </div>

      {/* 画面調光・消灯防止ステータス */}
      <ScreenDimmerOverlay wakeLockActive={wakeLockActive} initialLevel="normal" />
    </div>
  );
}

export default function CameraStreamerPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', color: '#fff' }}>Loading CCTV Camera Node...</div>}>
      <CameraStreamerContent />
    </Suspense>
  );
}
