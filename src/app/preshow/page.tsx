'use client';

/**
 * @file page.tsx (Preshow Operator Console)
 * @description プレショー担当スタッフ向け専用オペレーション画面。
 * 接続端末の一覧監視（PDA/音響/エレベータ）、フラッシュライト遠隔点滅制御、
 * 画面グリッチ妨害発火、およびプレショー映像の再生・停止制御を一体型コンソールとして提供します。
 */

import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { FullscreenButton } from '../../components/common/FullscreenButton';
import { ReconnectingModal } from '../../components/common/ReconnectingModal';
import { DeviceInfo, DevicePhase, GlitchEffectOptions, TorchEffectOptions } from '../../lib/types';
import '../../styles/app-shell.css';
import '../../styles/admin.css';

export default function PreshowConsolePage() {
  const { socket, connected, isReconnecting, reconnectAttempts, isOnline, manualReconnect } = useSocket();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isPreshowPlaying, setIsPreshowPlaying] = useState<boolean>(false);
  const [targetScope, setTargetScope] = useState<'all' | 'preshow_only'>('all');
  const [actionLog, setActionLog] = useState<string[]>([]);

  // ログ追記
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setActionLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // Socket通信とステート同期
  useEffect(() => {
    if (!socket) return;

    socket.emit('admin:join');

    socket.on('admin:state_sync', (state) => {
      setDevices(state.devices || []);
    });

    socket.on('preshow:start', () => {
      setIsPreshowPlaying(true);
      addLog('プレショー映像 再生中');
    });

    socket.on('preshow:ended', () => {
      setIsPreshowPlaying(false);
      addLog('プレショー映像 終了');
    });

    return () => {
      socket.off('admin:state_sync');
      socket.off('preshow:start');
      socket.off('preshow:ended');
    };
  }, [socket]);

  // --------------------------------------------------------------------------
  // エフェクト発火（フラッシュライト・グリッチ）
  // --------------------------------------------------------------------------

  // 一斉トーチ（フラッシュライト）点滅
  const handleTriggerTorch = (patternType: 'single' | 'horror' | 'emergency') => {
    if (!socket) return;
    let pattern = '1,0,1,0';
    let intervalMs = 150;

    if (patternType === 'horror') {
      pattern = '1,0,0,1,0,0,1,0,0,0';
      intervalMs = 120;
    } else if (patternType === 'emergency') {
      pattern = '1,1,1,0,0,1,1,1,0,0';
      intervalMs = 80;
    }

    const payload: { effectType: 'torch'; options: TorchEffectOptions; targetDeviceId?: string } = {
      effectType: 'torch',
      options: { pattern, intervalMs },
    };

    socket.emit('admin:trigger_effect', payload);
    addLog(`一斉トーチ点滅 発火 [${patternType.toUpperCase()}]`);
  };

  // 一斉常時点灯
  const handleSetTorchOn = () => {
    if (!socket) return;
    socket.emit('admin:trigger_effect', {
      effectType: 'torch',
      options: { state: true },
    });
    addLog('一斉トーチ 常時点灯');
  };

  // 一斉強制消灯
  const handleSetTorchOff = () => {
    if (!socket) return;
    socket.emit('admin:trigger_effect', {
      effectType: 'torch',
      options: { state: false, stop: true },
    });
    addLog('一斉トーチ 強制消灯');
  };

  // 個別トーチ点滅
  const handleIndividualTorch = (deviceId: string) => {
    if (!socket) return;
    socket.emit('admin:trigger_effect', {
      targetDeviceId: deviceId,
      effectType: 'torch',
      options: { pattern: '1,0,0,1,0,0,1,0,0,0', intervalMs: 120 } as TorchEffectOptions,
    });
    addLog(`個別トーチ点滅 [${deviceId}]`);
  };

  // 個別トーチ点灯/消灯
  const handleIndividualTorchState = (deviceId: string, state: boolean) => {
    if (!socket) return;
    socket.emit('admin:trigger_effect', {
      targetDeviceId: deviceId,
      effectType: 'torch',
      options: { state, stop: !state } as TorchEffectOptions,
    });
    addLog(`個別トーチ ${state ? '点灯' : '消灯'} [${deviceId}]`);
  };

  // 一斉画面グリッチ妨害
  const handleTriggerGlitch = (mode: 'creepy' | 'violent' | 'blackout') => {
    if (!socket) return;
    const options: GlitchEffectOptions = {
      level: mode === 'violent' ? 3 : 2,
      duration: mode === 'blackout' ? 4000 : 2500,
      mode,
      vibrate: true,
    };

    socket.emit('admin:trigger_effect', {
      effectType: 'glitch',
      options,
    });
    addLog(`一斉画面グリッチ 発火 [${mode.toUpperCase()}]`);
  };

  // 個別グリッチ妨害
  const handleIndividualGlitch = (deviceId: string) => {
    if (!socket) return;
    socket.emit('admin:trigger_effect', {
      targetDeviceId: deviceId,
      effectType: 'glitch',
      options: { level: 2, duration: 2500, mode: 'creepy', vibrate: true } as GlitchEffectOptions,
    });
    addLog(`個別画面グリッチ [${deviceId}]`);
  };

  // --------------------------------------------------------------------------
  // プレショー映像再生トリガー
  // --------------------------------------------------------------------------

  const handleStartPreshow = () => {
    if (!socket) return;
    socket.emit('preshow:start', {});
    setIsPreshowPlaying(true);
    addLog('プレショー映像 再生指示を送信');
  };

  const handleStopPreshow = () => {
    if (!socket) return;
    socket.emit('preshow:ended', {});
    setIsPreshowPlaying(false);
    addLog('プレショー映像 終了指示を送信');
  };

  // フェーズ変更
  const handleDevicePhaseChange = (deviceId: string, phase: DevicePhase) => {
    socket?.emit('admin:override_phase', { targetDeviceId: deviceId, phase });
    addLog(`端末 [${deviceId}] フェーズ変更 -> ${phase}`);
  };

  // 端末フィルタ
  const displayedDevices = devices.filter((d) => {
    if (targetScope === 'preshow_only') {
      return d.phase === 'preshow' || d.phase === 'STANDBY';
    }
    return true;
  });

  const pdaCount = devices.filter((d) => !d.role || d.role === 'client').length;
  const onlineCount = devices.filter((d) => d.socketId).length;

  return (
    <div className="app-shell">
      {/* 再接続モーダル */}
      <ReconnectingModal
        isReconnecting={isReconnecting}
        isOnline={isOnline}
        reconnectAttempts={reconnectAttempts}
        onManualReconnect={manualReconnect}
      />

      {/* Titlebar */}
      <header className="win95-titlebar app-titlebar">
        <div className="app-titlebar-left">
          <span>[プレショー] 待機ホール進行操作コンソール</span>
          <span className={`app-connection-badge ${connected ? 'online' : ''}`}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="app-titlebar-nav">
          <FullscreenButton className="app-nav-btn" />
        </div>
      </header>

      {/* Main Workspace (Responsive 2-Column or 1-Column) */}
      <main className="preshow-workspace">
        {/* 左カラム: 接続端末一覧 */}
        <section className="win95-window admin-panel preshow-panel-left" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="win95-titlebar effect-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>接続端末モニター ({displayedDevices.length}台)</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`win95-btn ${targetScope === 'all' ? 'active' : ''}`}
                style={{ fontSize: '10px', padding: '1px 6px' }}
              >
                全端末
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('preshow_only')}
                className={`win95-btn ${targetScope === 'preshow_only' ? 'active' : ''}`}
                style={{ fontSize: '10px', padding: '1px 6px' }}
              >
                プレショー/待機中
              </button>
            </div>
          </div>

          <div className="device-monitor-body" style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {displayedDevices.length === 0 ? (
              <div className="admin-empty" style={{ padding: '24px' }}>
                接続中の端末はありません。参加者PDAが起動するとここに表示されます。
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '6px',
                }}
              >
                {displayedDevices.map((dev) => {
                  const isOnline = !!dev.socketId;
                  const isPda = !dev.role || dev.role === 'client';

                  return (
                    <div
                      key={dev.deviceId}
                      className={`win95-window device-card ${isOnline ? 'online' : ''}`}
                      style={{ padding: '6px' }}
                    >
                      {/* Device Header */}
                      <div className="device-card-row between" style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#1e293b' }}>
                          {dev.deviceId}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            backgroundColor: isOnline ? '#10b981' : '#64748b',
                            color: '#ffffff',
                          }}
                        >
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>

                      {/* Status / Phase */}
                      <div style={{ fontSize: '10px', color: '#475569', marginBottom: '6px' }}>
                        <div>フェーズ: <strong style={{ color: '#0369a1' }}>{dev.phase || 'STANDBY'}</strong></div>
                        {dev.batteryLevel !== undefined && (
                          <div>バッテリー: {dev.batteryLevel}% {dev.charging ? '(充電中)' : ''}</div>
                        )}
                      </div>

                      {/* Individual Actions for PDA */}
                      {isPda && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                            <button
                              type="button"
                              onClick={() => handleIndividualTorch(dev.deviceId)}
                              className="win95-btn"
                              style={{ fontSize: '10px', padding: '2px' }}
                              title="この端末のフラッシュライトを怪異点滅"
                            >
                              点滅
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIndividualGlitch(dev.deviceId)}
                              className="win95-btn"
                              style={{ fontSize: '10px', padding: '2px' }}
                              title="この端末の画面を怪異妨害"
                            >
                              妨害
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                            <button
                              type="button"
                              onClick={() => handleIndividualTorchState(dev.deviceId, true)}
                              className="win95-btn"
                              style={{ fontSize: '10px', padding: '2px', color: '#16a34a' }}
                              title="この端末のライトを点灯"
                            >
                              点灯
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIndividualTorchState(dev.deviceId, false)}
                              className="win95-btn"
                              style={{ fontSize: '10px', padding: '2px', color: '#64748b' }}
                              title="この端末のライトを消灯"
                            >
                              消灯
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="win95-statusbar" style={{ fontSize: '10px' }}>
            <span>接続数: {onlineCount}/{devices.length}台</span>
            <span>|</span>
            <span>参加者PDA: {pdaCount}台</span>
          </div>
        </section>

        {/* 右カラム: プレショー進行 & 遠隔エフェクトコンソール */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
          }}
        >
          {/* 1. プレショー映像再生スイッチ */}
          <div className="win95-window admin-panel">
            <div className="win95-titlebar effect-titlebar">
              <span>[映像制御] プレショー上映トリガー</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '10px', lineHeight: '1.5' }}>
                待機ホール正面スクリーン（/display/preshow）へガイダンス映像の再生指示を一斉送信します。
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStartPreshow}
                  className="win95-btn"
                  style={{
                    height: '48px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    backgroundColor: isPreshowPlaying ? '#047857' : '#0284c7',
                    color: '#ffffff',
                    border: '2px solid #0369a1',
                  }}
                  title="プレショー映像の再生を開始"
                >
                  {isPreshowPlaying ? '[再生中] プレショー映像' : '[上映開始] プレショー映像'}
                </button>

                <button
                  type="button"
                  onClick={handleStopPreshow}
                  className="win95-btn"
                  style={{
                    height: '48px',
                    fontSize: '12px',
                    backgroundColor: '#475569',
                    color: '#f8fafc',
                  }}
                  title="プレショー映像を強制停止/待機ノイズへ戻す"
                >
                  上映終了 [停止]
                </button>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  padding: '6px 10px',
                  backgroundColor: isPreshowPlaying ? '#064e3b' : '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: isPreshowPlaying ? '#a7f3d0' : '#94a3b8',
                }}
              >
                スクリーン状態: <strong>{isPreshowPlaying ? '再生稼働中 (PLAYING)' : '待機中 (STANDBY)'}</strong>
              </div>
            </div>
          </div>

          {/* 2. フラッシュライト遠隔点滅制御 */}
          <div className="win95-window admin-panel">
            <div className="win95-titlebar effect-titlebar">
              <span>[照明制御] 参加者端末フラッシュライト遠隔発火</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                プレショー待機中・移動中の参加者PDAの背面ライトを遠隔で怪異点滅させます。
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleTriggerTorch('horror')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold' }}
                  title="怪異明滅（ぴかっ...ぴかっ...）"
                >
                  怪異明滅 [遅]
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerTorch('single')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold' }}
                  title="瞬時フラッシュ点滅"
                >
                  瞬間点滅
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerTorch('emergency')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold', color: '#b91c1c' }}
                  title="緊急警告ハイパルス点滅"
                >
                  高速警告点滅
                </button>
              </div>

              {/* 常時点灯・強制消灯スイッチ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSetTorchOn}
                  className="win95-btn"
                  style={{ height: '36px', fontSize: '11px', fontWeight: 'bold', color: '#15803d' }}
                  title="全端末のフラッシュライトを常時点灯"
                >
                  [点灯] 全体ライト点灯
                </button>
                <button
                  type="button"
                  onClick={handleSetTorchOff}
                  className="win95-btn"
                  style={{ height: '36px', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
                  title="全端末のフラッシュライトを消灯・停止"
                >
                  [消灯] 全体ライト消灯
                </button>
              </div>
            </div>
          </div>

          {/* 3. 画面グリッチ妨害制御 */}
          <div className="win95-window admin-panel">
            <div className="win95-titlebar effect-titlebar">
              <span>[画面妨害] 参加者端末画面グリッチ遠隔発火</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                参加者端末の画面にノイズ・歪み・暗転エフェクトを一斉発火させます。
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleTriggerGlitch('creepy')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold' }}
                  title="不気味な走査線・歪みノイズ"
                >
                  不気味歪み
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerGlitch('violent')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold', color: '#7c3aed' }}
                  title="激しい色反転・バイブレーション妨害"
                >
                  強ノイズ妨害
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerGlitch('blackout')}
                  className="win95-btn"
                  style={{ height: '38px', fontSize: '11px', fontWeight: 'bold', color: '#991b1b' }}
                  title="全画面強制ブラックアウト"
                >
                  完全暗転
                </button>
              </div>
            </div>
          </div>

          {/* 4. 操作履歴ログ */}
          <div className="win95-window admin-panel" style={{ flex: 1, minHeight: '120px' }}>
            <div className="win95-titlebar effect-titlebar">
              <span>操作履歴ログ</span>
            </div>
            <div
              style={{
                padding: '8px',
                backgroundColor: '#0f172a',
                color: '#94a3b8',
                fontFamily: 'monospace',
                fontSize: '11px',
                lineHeight: '1.5',
                overflowY: 'auto',
                height: '110px',
              }}
            >
              {actionLog.length === 0 ? (
                <div>操作履歴がここに表示されます。</div>
              ) : (
                actionLog.map((log, index) => (
                  <div key={index} style={{ color: index === 0 ? '#38bdf8' : '#64748b' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Status Bar */}
      <footer className="win95-statusbar app-statusbar">
        <div className="win95-statusbar-item app-statusbar-item-wide">
          プレショーオペレーション稼働中 | 対象待機ホール
        </div>
        <div className="win95-statusbar-item">PRESHOW CONSOLE v1.0</div>
      </footer>
    </div>
  );
}
