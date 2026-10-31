'use client';

/**
 * @file page.tsx (Sound Node Display)
 * @description 音響再生専用端末（Sound Node）用の全画面待機・再生コンポーネント。
 * 会場内の天井スピーカーや隠し音響ポイントに配置され、ブラウザのAutoplay制約をユーザーの
 * ワンタップでアンロックした後、常時待機してサーバーからの再生コマンド（`sound:play`）を即座に鳴らします。
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '../../../hooks/useSocket';
import { useSoundEngine } from '../../../hooks/useSoundEngine';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import { ReconnectingModal } from '../../../components/common/ReconnectingModal';
import { ScreenDimmerOverlay } from '../../../components/common/ScreenDimmerOverlay';
import { useWakeLock } from '../../../hooks/useWakeLock';
import { SoundNodePlayPayload } from '../../../lib/types';

function SoundNodeContent() {
  const searchParams = useSearchParams();
  const [nodeId, setNodeId] = useState<string>('SOUND_NODE_01');
  const [locationName, setLocationName] = useState<string>('未設定エリア');

  const { socket, connected, isReconnecting, reconnectAttempts, isOnline, manualReconnect } = useSocket();
  const { engine, unlockAudio } = useSoundEngine();
  const { isActive: wakeLockActive } = useWakeLock(true);

  /** AudioContextがユーザー操作によりアンロックされたか */
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  /** 直近で再生されたサウンドログ履歴 */
  const [playLogs, setPlayLogs] = useState<string[]>([]);
  /** 再生中のアニメーション表示用フラグ */
  const [isPlayingVisual, setIsPlayingVisual] = useState(false);
  const visualTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // 端末IDの初期化: URLクエリ優先、無ければlocalStorage、無ければユニーク採番
  useEffect(() => {
    const qId = searchParams.get('id');
    const qLoc = searchParams.get('loc');

    if (qLoc) {
      setLocationName(qLoc);
    }

    if (qId) {
      setNodeId(qId);
    } else {
      // localStorage から既存の永続化IDを取得、無ければ新規生成 (例: SOUND_NODE_8421)
      try {
        const storedId = localStorage.getItem('sound_node_id');
        if (storedId) {
          setNodeId(storedId);
        } else {
          const rand = Math.floor(1000 + Math.random() * 9000);
          const newId = `SOUND_NODE_${rand}`;
          localStorage.setItem('sound_node_id', newId);
          setNodeId(newId);
        }
      } catch (_) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        setNodeId(`SOUND_NODE_${rand}`);
      }
    }
  }, [searchParams]);

  // 1. 待機開始・Autoplay制限解除ハンドラー
  const handleStartListening = useCallback(() => {
    unlockAudio();
    setAudioUnlocked(true);
    // 確認の微小ビープ
    engine.playBeep(440, 0.05);
    console.log(`[SoundNode] AudioContext unlocked for ${nodeId}`);
  }, [unlockAudio, engine, nodeId]);

  // 2. サーバーへの登録
  useEffect(() => {
    if (!socket || !connected || !nodeId) return;

    socket.emit('sound:register_node', {
      deviceId: nodeId,
      location: locationName,
    });
    console.log(`[SoundNode] Registered to server as ${nodeId}`);
  }, [socket, connected, nodeId, locationName]);

  // 3. sound:play イベント受信 & 再生
  useEffect(() => {
    if (!socket) return;

    const handleSoundPlay = (payload: SoundNodePlayPayload) => {
      // 個別端末指定があり、かつ自身宛てでない場合は無視
      if (payload.targetDeviceId && payload.targetDeviceId !== nodeId) {
        return;
      }

      console.log('[SoundNode] Received sound:play command:', payload);

      // 音量調整
      if (typeof payload.volume === 'number') {
        engine.setVolume(payload.volume);
      }

      // サウンド再生実行
      if (payload.soundType === 'file' && payload.filename) {
        // public/audio/ 配下のデコード済みキャッシュ付き再生
        engine.playAudioFile(payload.filename, {
          volume: payload.volume,
          loop: payload.loop,
        }).catch((err) => {
          console.warn(`[SoundNode] playAudioFile error for ${payload.filename}:`, err);
        });
      } else if (payload.soundType === 'custom' && payload.soundUrl) {
        // 外部カスタムURLの再生
        try {
          const audio = new Audio(payload.soundUrl);
          audio.volume = Math.min(1.0, payload.volume || 1.0);
          audio.loop = !!payload.loop;
          audio.play().catch((err) => {
            console.warn('[SoundNode] HTMLAudio play error:', err);
          });
        } catch (e) {
          console.error('[SoundNode] Custom sound instantiation error:', e);
        }
      } else {
        // プロシージャル合成音源再生
        engine.playSound(payload.soundType, payload.level || 3, payload.filename);
      }

      // ビジュアル波紋アニメーション起動
      setIsPlayingVisual(true);
      if (visualTimerRef.current) clearTimeout(visualTimerRef.current as NodeJS.Timeout);
      visualTimerRef.current = setTimeout(() => {
        setIsPlayingVisual(false);
      }, payload.durationMs || 1500);

      // ログ追加
      const timeStr = new Date().toLocaleTimeString('ja-JP');
      setPlayLogs((prev) => [
        `[${timeStr}] 再生: ${payload.soundType} (Vol: ${payload.volume ?? 1.0})`,
        ...prev.slice(0, 7),
      ]);
    };

    socket.on('sound:play', handleSoundPlay);

    return () => {
      socket.off('sound:play', handleSoundPlay);
      if (visualTimerRef.current) clearTimeout(visualTimerRef.current as NodeJS.Timeout);
    };
  }, [socket, engine]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0a0b0e',
        color: '#e2e8f0',
        fontFamily: 'Consolas, Monaco, monospace',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 再接続・オフラインモーダル */}
      <ReconnectingModal
        isReconnecting={isReconnecting}
        isOnline={isOnline}
        reconnectAttempts={reconnectAttempts}
        onManualReconnect={manualReconnect}
      />

      {/* トップバー: 端末ID & 接続ステータス */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.1em' }}>
            ACOUSTIC NODE TERMINAL
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8' }}>
            {nodeId}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            設置場所: {locationName}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#111827',
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${connected ? '#059669' : '#dc2626'}`,
              fontSize: '0.85rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: connected ? '#10b981' : '#ef4444',
                boxShadow: connected ? '0 0 8px #10b981' : 'none',
              }}
            />
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <FullscreenButton />
        </div>
      </header>

      {/* メイン中央: オーディオアンロック または 波紋モニター */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          margin: '20px 0',
        }}
      >
        {!audioUnlocked ? (
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.15em', marginBottom: '16px' }}>
              [ACOUSTIC NODE STANDBY]
            </div>
            <h2 style={{ fontSize: '1.3rem', color: '#f8fafc', marginBottom: '12px' }}>
              音響エンジンの待機を開始
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
              ブラウザの自動再生制限を解除するため、画面をタップして音響出力を有効化してください。
            </p>
            <button
              onClick={handleStartListening}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(2, 132, 199, 0.5)',
                transition: 'all 0.2s',
              }}
            >
              タップして音響ノードを有効化
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {/* パルス波紋アニメーション */}
            <div
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                margin: '0 auto 24px',
                border: isPlayingVisual ? '4px solid #38bdf8' : '2px dashed #334155',
                backgroundColor: isPlayingVisual ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlayingVisual ? '0 0 40px rgba(56, 189, 248, 0.6)' : 'none',
                transition: 'all 0.2s ease-out',
                transform: isPlayingVisual ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: isPlayingVisual ? '#38bdf8' : '#64748b' }}>
                {isPlayingVisual ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>

            <div style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 'bold' }}>
              {isPlayingVisual ? 'AUDIO PLAYING...' : 'STANDBY (AWAITING CUE)'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
              マスター出力ゲイン: {Math.round(engine.getVolume() * 100)}%
            </div>
          </div>
        )}
      </main>

      {/* フッター: 再生ログ履歴 */}
      <footer
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '6px',
          padding: '12px 16px',
          maxHeight: '130px',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', letterSpacing: '0.05em' }}>
          RECENT PLAYBACK LOGS
        </div>
        {playLogs.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            受信した音響トリガーログがここに表示されます。
          </div>
        ) : (
          playLogs.map((log, idx) => (
            <div key={idx} style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {log}
            </div>
          ))
        )}
      </footer>

      {/* 画面調光・消灯防止ステータス */}
      <ScreenDimmerOverlay wakeLockActive={wakeLockActive} initialLevel="dim" />
    </div>
  );
}

export default function SoundNodePage() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: 20 }}>Loading Sound Node...</div>}>
      <SoundNodeContent />
    </Suspense>
  );
}
