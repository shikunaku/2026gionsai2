'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSocket } from '../../../hooks/useSocket';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import { CctvCameraId, CCTV_CAMERAS, CctvCameraStatusPayload } from '../../../lib/types';
import { generateQrSvgString } from '../../../lib/qrCode';
import '../../../styles/cctv.css';

type LayoutMode = 'grid3' | 'focus' | 'single';

export default function CctvDashboardPage() {
  const { socket, connected } = useSocket();

  // 表示レイアウト (3分割均等, フォーカス1大2小, 1画面全開)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid3');
  // フォーカスまたはシングル表示で選択中のカメラID
  const [activeCamId, setActiveCamId] = useState<CctvCameraId>('cam1');
  // QRコード一括表示モーダル
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  // リアルタイムクロック
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // 3台のカメラ状態 (online, lightOn, batteryLevel)
  const [cameraStatus, setCameraStatus] = useState<Record<CctvCameraId, { online: boolean; lightOn: boolean; battery?: number | string }>>({
    cam1: { online: false, lightOn: false },
    cam2: { online: false, lightOn: false },
    cam3: { online: false, lightOn: false },
  });

  // WebRTC PeerConnections (key: CctvCameraId)
  const peerConnectionsRef = useRef<Map<CctvCameraId, RTCPeerConnection>>(new Map());
  // 各カメラの Remote MediaStream
  const remoteStreamsRef = useRef<Map<CctvCameraId, MediaStream>>(new Map());
  // 各カメラの <video> 要素参照（Mapで管理）
  const videoElementsRef = useRef<Map<CctvCameraId, HTMLVideoElement>>(new Map());

  // 時計更新
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCurrentTimeStr(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // video要素のマウント/再マウント時に既存のMediaStreamを即時再アタッチするrefコールバック
  const setVideoRef = useCallback((camId: CctvCameraId, el: HTMLVideoElement | null) => {
    if (el) {
      videoElementsRef.current.set(camId, el);
      const existingStream = remoteStreamsRef.current.get(camId);
      if (existingStream) {
        if (el.srcObject !== existingStream) {
          el.srcObject = existingStream;
        }
        el.play().catch(() => {});
      }
    } else {
      videoElementsRef.current.delete(camId);
    }
  }, []);

  // 未完了Candidateキュー (key: camId)
  const pendingCandidatesRef = useRef<Map<CctvCameraId, RTCIceCandidateInit[]>>(new Map());

  // WebRTC PeerConnection の作成
  const getOrCreatePeerConnection = useCallback(
    (camId: CctvCameraId, cameraSocketId?: string) => {
      if (peerConnectionsRef.current.has(camId)) {
        return peerConnectionsRef.current.get(camId)!;
      }

      console.log(`[CCTV Viewer] Creating PeerConnection for: ${camId}`);
      const rtcConfig: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      };

      const pc = new RTCPeerConnection(rtcConfig);

      // トラック受信イベント
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Track received (${camId}):`, event.streams[0]);
        const stream = event.streams[0];
        if (stream) {
          remoteStreamsRef.current.set(camId, stream);

          const videoEl = videoElementsRef.current.get(camId);
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch((err) => {
              console.error(`[CCTV Viewer] Video play error for ${camId}:`, err);
            });
          }
        }
      };

      // ICE Candidate 送信
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && cameraSocketId) {
          console.log(`[CCTV Viewer] Generated ICE Candidate for ${camId}:`, event.candidate.candidate);
          socket.emit('cctv:signal', {
            camId,
            targetSocketId: cameraSocketId,
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE Connection State (${camId}):`, pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling State (${camId}):`, pc.signalingState);
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection State (${camId}):`, pc.connectionState);
      };

      peerConnectionsRef.current.set(camId, pc);
      return pc;
    },
    [socket]
  );

  // Socket イベントリスナー
  useEffect(() => {
    if (!socket) return;

    // ビューアーとして登録
    socket.emit('cctv:register_viewer');

    // 全カメラ初期状態受信
    const handleAllStatus = (allStatus: CctvCameraStatusPayload[]) => {
      console.log('[CCTV Viewer] Received all camera statuses:', allStatus);
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

    // 個別カメラ状態変更通知
    const handleStatusUpdate = (payload: CctvCameraStatusPayload) => {
      console.log('[CCTV Viewer] Camera status update:', payload);
      setCameraStatus((prev) => {
        const wasOnline = prev[payload.camId]?.online;
        // 初めてオンラインになったときのみ配信側へ viewer_ready を送信（不要な再接続ループ防止）
        if (payload.online && !wasOnline) {
          const pc = peerConnectionsRef.current.get(payload.camId);
          if (!pc || (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed')) {
            console.log(`[CCTV Viewer] Camera ${payload.camId} newly online, requesting stream.`);
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

      // オフラインになった場合はストリームをクリア
      if (!payload.online) {
        if (peerConnectionsRef.current.has(payload.camId)) {
          peerConnectionsRef.current.get(payload.camId)?.close();
          peerConnectionsRef.current.delete(payload.camId);
        }
        remoteStreamsRef.current.delete(payload.camId);
        pendingCandidatesRef.current.delete(payload.camId);
        const videoEl = videoElementsRef.current.get(payload.camId);
        if (videoEl) {
          videoEl.srcObject = null;
        }
      }
    };

    // WebRTC シグナリング処理 (Offer受信 -> Answer返信)
    const handleSignal = async (payload: any) => {
      const { camId, type, senderSocketId, sdp, candidate } = payload;
      if (!camId || !type) return;

      if (type === 'offer' && sdp) {
        const existingPc = peerConnectionsRef.current.get(camId);
        if (existingPc && (existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed')) {
          console.log(`[CCTV Viewer] WebRTC connection for ${camId} is already active (${existingPc.iceConnectionState}). Skipping offer.`);
          return;
        }

        console.log(`[CCTV Viewer] Received Offer for ${camId} from ${senderSocketId}`);
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

          // 保留していたICE Candidateがあれば適用
          const pending = pendingCandidatesRef.current.get(camId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(camId);
        } catch (err) {
          console.error(`[CCTV Viewer] Error handling offer for ${camId}:`, err);
        }
      } else if (type === 'candidate' && candidate) {
        const pc = peerConnectionsRef.current.get(camId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn(`[CCTV Viewer] addIceCandidate error for ${camId}:`, e);
          }
        } else {
          // 未設定時はキューに保存
          const queue = pendingCandidatesRef.current.get(camId) || [];
          queue.push(candidate);
          pendingCandidatesRef.current.set(camId, queue);
        }
      }
    };

    socket.on('cctv:all_status', handleAllStatus);
    socket.on('cctv:status', handleStatusUpdate);
    socket.on('cctv:signal', handleSignal);

    return () => {
      socket.off('cctv:all_status', handleAllStatus);
      socket.off('cctv:status', handleStatusUpdate);
      socket.off('cctv:signal', handleSignal);
    };
  }, [socket, getOrCreatePeerConnection]);

  // 遠隔ライト操作
  const handleToggleLight = (camId: CctvCameraId, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!socket) return;
    const current = cameraStatus[camId]?.lightOn ?? false;
    const nextState = !current;
    socket.emit('cctv:light_control', { camId, lightOn: nextState });
  };

  // カメラ枠クリック（フォーカス切り替え）
  const handleCardClick = (camId: CctvCameraId) => {
    setActiveCamId(camId);
    if (layoutMode === 'grid3') {
      setLayoutMode('focus');
    }
  };

  // 全画面/フォーカスボタン
  const handleExpandCam = (camId: CctvCameraId, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveCamId(camId);
    if (layoutMode === 'single' && activeCamId === camId) {
      setLayoutMode('grid3');
    } else {
      setLayoutMode('single');
    }
  };

  // カメラURL取得
  const getCameraUrl = (camId: CctvCameraId) => {
    if (typeof window === 'undefined') return `/camera?id=${camId}`;
    return `${window.location.protocol}//${window.location.host}/camera?id=${camId}`;
  };

  // オンライン台数計算
  const onlineCount = Object.values(cameraStatus).filter((s) => s.online).length;

  // カメラ個別ビューアーレンダリング
  const renderCameraCard = (camId: CctvCameraId, isMainFocus = false) => {
    const config = CCTV_CAMERAS.find((c) => c.id === camId) || CCTV_CAMERAS[0];
    const status = cameraStatus[camId] || { online: false, lightOn: false };
    const isFocused = activeCamId === camId;
    const qrSvg = generateQrSvgString(getCameraUrl(camId), { size: 100, margin: 2, color: '#000', backgroundColor: '#fff' });

    return (
      <div
        key={camId}
        className={`cctv-card cam-${camId}${isFocused ? ' focused is-active-focus' : ' is-sub-focus'}`}
        onClick={() => handleCardClick(camId)}
      >
        {/* Header HUD */}
        <div className="cctv-card-header">
          <div className="cctv-cam-title">
            <span className={`cctv-cam-badge ${status.online ? 'live' : 'offline'}`}>
              {status.online ? 'LIVE REC' : 'NO SIGNAL'}
            </span>
            <span>{config.name}</span>
          </div>

          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {status.battery !== undefined && `[BAT ${status.battery}%]`}
          </div>
        </div>

        {/* Video Surface */}
        <div className="cctv-video-wrapper">
          <video
            ref={(el) => setVideoRef(camId, el)}
            autoPlay
            playsInline
            muted
            controls={false}
            className="cctv-video"
            style={{
              display: status.online ? 'block' : 'none',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#000',
            }}
          />

          {/* CRT Scanline */}
          <div className="cctv-scanline-overlay" />

          {/* Standby No Signal with Mini QR */}
          {!status.online && (
            <div className="cctv-no-signal-box">
              <div className="cctv-no-signal-title">[NO SIGNAL]</div>
              <div className="cctv-no-signal-desc">
                {config.location}
                <br />
                スマホでQRをスキャンして配信接続
              </div>
              <div
                className="cctv-qr-mini"
                title="タップして接続URLを開く"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(getCameraUrl(camId), '_blank');
                }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
          )}

          {/* Timestamp HUD */}
          <div className="cctv-timestamp-hud">
            {currentTimeStr} | {config.id.toUpperCase()}
          </div>
        </div>

        {/* Bottom Control Overlay */}
        <div className="cctv-card-footer">
          <button
            onClick={(e) => handleToggleLight(camId, e)}
            disabled={!status.online}
            className={`cctv-control-btn ${status.lightOn ? 'light-on' : ''}`}
            title="暗所視認用フラッシュライト点灯/消灯"
          >
            {status.lightOn ? 'LIGHT ON' : 'LIGHT OFF'}
          </button>

          <button
            onClick={(e) => handleExpandCam(camId, e)}
            className="cctv-control-btn expand"
            title="拡大表示 / 全画面切替"
          >
            {layoutMode === 'single' && isFocused ? '戻す [EXIT]' : '拡大 [FOCUS]'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="cctv-root">
      {/* Top CCTV Surveillance Header */}
      <header className="cctv-header">
        <div className="cctv-header-left">
          <div className="cctv-title">
            <span className="cctv-live-dot" />
            <span>FACTORY SURVEILLANCE CCTV</span>
          </div>

          <span className={`cctv-status-badge ${onlineCount > 0 ? 'online' : ''}`}>
            ONLINE: {onlineCount}/3 CAMERAS
          </span>
        </div>

        <div className="cctv-header-right">
          <span className="cctv-clock">{currentTimeStr}</span>

          {/* Layout Mode Toggles */}
          <div className="cctv-layout-group">
            <button
              onClick={() => setLayoutMode('grid3')}
              className={`cctv-layout-btn ${layoutMode === 'grid3' ? 'active' : ''}`}
              title="3分割均等グリッド表示"
            >
              3分割
            </button>
            <button
              onClick={() => setLayoutMode('focus')}
              className={`cctv-layout-btn ${layoutMode === 'focus' ? 'active' : ''}`}
              title="フォーカス表示 (1大+2小)"
            >
              強調表示
            </button>
            <button
              onClick={() => setLayoutMode('single')}
              className={`cctv-layout-btn ${layoutMode === 'single' ? 'active' : ''}`}
              title="選択カメラ1画面全開"
            >
              1画面
            </button>
          </div>

          {/* QR Code Modal Trigger */}
          <button
            onClick={() => setShowQrModal(true)}
            className="cctv-header-btn"
            title="各カメラ接続用QRコードを一括表示"
          >
            カメラ接続QR
          </button>

          {/* Return to Admin Link */}
          <Link href="/admin">
            <button className="cctv-header-btn" title="集中管理コンソールに戻る">
              管理画面へ
            </button>
          </Link>

          {/* Fullscreen Button */}
          <FullscreenButton className="cctv-header-btn" />
        </div>
      </header>

      {/* Main Viewport Content according to layoutMode (keep DOM stable to prevent video blackouts) */}
      <main className={`cctv-viewport-container layout-${layoutMode}`}>
        <div className="cctv-layout-wrapper">
          {CCTV_CAMERAS.map((c) => renderCameraCard(c.id, c.id === activeCamId))}
        </div>
      </main>

      {/* Camera Connection QR Code Modal */}
      {showQrModal && (
        <div className="cctv-modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="cctv-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cctv-modal-header">
              <span className="cctv-modal-title">[CCTV CAMERA CONNECT] 監視カメラ接続QRコード</span>
              <button className="cctv-modal-close" onClick={() => setShowQrModal(false)}>
                ✕
              </button>
            </div>

            <div className="cctv-modal-body">
              {CCTV_CAMERAS.map((cam) => {
                const url = getCameraUrl(cam.id);
                const svg = generateQrSvgString(url, { size: 160, margin: 4, color: '#000', backgroundColor: '#fff' });
                const isOnline = cameraStatus[cam.id]?.online;

                return (
                  <div key={cam.id} className="cctv-qr-card">
                    <div className="cctv-qr-card-title">{cam.name}</div>
                    <div className="cctv-qr-card-desc">
                      {cam.location}
                      <br />
                      ステータス:{' '}
                      <span style={{ color: isOnline ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                        {isOnline ? '接続中 (配信中)' : '未接続 (待機)'}
                      </span>
                    </div>

                    <div
                      className="cctv-qr-image-wrapper"
                      dangerouslySetInnerHTML={{ __html: svg }}
                      title="スマホで読み取って配信開始"
                    />

                    <input
                      type="text"
                      readOnly
                      value={url}
                      className="cctv-qr-url-input"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />

                    <div style={{ marginTop: '8px' }}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <button className="cctv-header-btn" style={{ fontSize: '10px' }}>
                          この端末でテスト開く
                        </button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
