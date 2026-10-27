'use client';

/**
 * @file DeviceMonitor.tsx
 * @description 管理画面における接続端末（参加者PDA、サウンドノード、エレベータ電照端末）のリアルタイム監視コンポーネント。
 * 各種端末のロール判定バッジ、バッテリー残量・充電状態、20%未満の警告表示、個別テストアクションを提供します。
 */

import React, { useState, useEffect } from 'react';
import { DeviceInfo, DevicePhase, SoundEffectOptions } from '../../lib/types';
import { SOUND_PRESETS } from '../../lib/soundEngine';
import '../../styles/admin.css';

interface DeviceMonitorProps {
  devices: DeviceInfo[];
  onPhaseChange: (deviceId: string, phase: DevicePhase) => void;
  onIndividualGlitch: (deviceId: string) => void;
  onIndividualTorch: (deviceId: string) => void;
  /** サウンドノード宛ての個別効果音・ファイル再生トリガー */
  onIndividualSound?: (
    deviceId: string,
    soundType: SoundEffectOptions['soundType'],
    filename?: string,
    volume?: number
  ) => void;
}

export const DeviceMonitor: React.FC<DeviceMonitorProps> = ({
  devices,
  onPhaseChange,
  onIndividualGlitch,
  onIndividualTorch,
  onIndividualSound,
}) => {
  const [filterRole, setFilterRole] = useState<'all' | 'client' | 'sound_node' | 'elevator'>('all');
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  // サウンドノードごとの選択音源 (キー: deviceId, 値: "preset:beep" または "file:siren.mp3")
  const [selectedSounds, setSelectedSounds] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/audio-files')
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => {
        if (Array.isArray(data.files)) {
          setAudioFiles(data.files);
        }
      })
      .catch((err) => {
        console.warn('[DeviceMonitor] Failed to fetch audio files:', err);
      });
  }, []);

  const handleDeviceSoundSelect = (deviceId: string, value: string) => {
    setSelectedSounds((prev) => ({ ...prev, [deviceId]: value }));
  };

  const handleTriggerDeviceSound = (deviceId: string) => {
    const soundKey = selectedSounds[deviceId] || 'preset:lowImpact';
    if (soundKey.startsWith('file:')) {
      const filename = soundKey.slice(5);
      onIndividualSound?.(deviceId, 'file', filename, 1.5);
    } else if (soundKey.startsWith('preset:')) {
      const soundType = soundKey.slice(7) as SoundEffectOptions['soundType'];
      onIndividualSound?.(deviceId, soundType, undefined, 1.5);
    }
  };

  const filteredDevices = devices
    .filter((dev) => {
      if (filterRole === 'client') return !dev.role || dev.role === 'client';
      if (filterRole === 'sound_node') return dev.role === 'sound_node';
      if (filterRole === 'elevator') return dev.role === 'elevator_display' || dev.deviceId.includes('ELEVATOR');
      return true;
    })
    .sort((a, b) => {
      // 1. 接続状態: オンラインを常に先頭、オフラインは末尾
      const aOnline = a.socketId ? 1 : 0;
      const bOnline = b.socketId ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;

      // 2. 役割: PDA -> 音響 -> 昇降
      const roleOrder: Record<string, number> = { client: 1, sound_node: 2, elevator_display: 3 };
      const aPriority = roleOrder[a.role || 'client'] || 99;
      const bPriority = roleOrder[b.role || 'client'] || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // 3. 端末IDの自然昇順
      return a.deviceId.localeCompare(b.deviceId, undefined, { numeric: true, sensitivity: 'base' });
    });

  const clientCount = devices.filter((d) => !d.role || d.role === 'client').length;
  const soundNodeCount = devices.filter((d) => d.role === 'sound_node').length;
  const elevatorCount = devices.filter((d) => d.role === 'elevator_display' || d.deviceId.includes('ELEVATOR')).length;

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>[接続端末監視]({devices.length}台)</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          <button
            onClick={() => setFilterRole('all')}
            className={`win95-btn ${filterRole === 'all' ? 'active' : ''}`}
            style={{ fontSize: '0.72rem', padding: '1px 5px' }}
          >
            ALL ({devices.length})
          </button>
          <button
            onClick={() => setFilterRole('client')}
            className={`win95-btn ${filterRole === 'client' ? 'active' : ''}`}
            style={{ fontSize: '0.72rem', padding: '1px 5px' }}
          >
            PDA ({clientCount})
          </button>
          <button
            onClick={() => setFilterRole('sound_node')}
            className={`win95-btn ${filterRole === 'sound_node' ? 'active' : ''}`}
            style={{ fontSize: '0.72rem', padding: '1px 5px' }}
          >
            音響 ({soundNodeCount})
          </button>
          <button
            onClick={() => setFilterRole('elevator')}
            className={`win95-btn ${filterRole === 'elevator' ? 'active' : ''}`}
            style={{ fontSize: '0.72rem', padding: '1px 5px' }}
          >
            昇降 ({elevatorCount})
          </button>
        </div>
      </div>

      <div className="device-monitor-body">
        {filteredDevices.length === 0 ? (
          <div className="admin-empty">該当する接続端末はありません。</div>
        ) : (
          <div className="device-list">
            {filteredDevices.map((dev) => {
              const onlineClass = dev.socketId ? ' online' : '';
              const isSoundNode = dev.role === 'sound_node';
              const isElevator = dev.role === 'elevator_display' || dev.deviceId.includes('ELEVATOR');
              const numericBattery = Number(dev.batteryLevel);
              const isLowBattery = !isNaN(numericBattery) && numericBattery <= 20 && !dev.charging;

              // ロールに応じた枠線強調
              let borderStyle: React.CSSProperties | undefined;
              if (isLowBattery) {
                borderStyle = { border: '2px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' };
              } else if (isSoundNode) {
                borderStyle = { border: '2px solid #0284c7' };
              } else if (isElevator) {
                borderStyle = { border: '2px solid #f59e0b' };
              }

              // 端末カードのヘッダー表示名の整形
              let displayId = dev.deviceId;
              if (isSoundNode) {
                // SOUND_NODE_8421 や sound-node-1 のような冗長なプレフィックスを短縮し、末尾の個別識別番号を明確化
                const shortId = dev.deviceId.replace(/^SOUND_NODE_?/i, '').replace(/^sound-?/i, '');
                displayId = `[音響] ${shortId || dev.deviceId}`;
              } else if (isElevator) {
                const shortId = dev.deviceId.replace(/^ELEVATOR_DISPLAY_?/i, '').replace(/^elevator_?/i, '');
                displayId = `[昇降] ${shortId || dev.deviceId}`;
              }

              return (
                <div
                  key={dev.deviceId}
                  className={`win95-window device-card${onlineClass}`}
                  style={borderStyle}
                >
                  {/* Row 1: ID, Role Badge & Battery/Status */}
                  <div className="device-card-row between">
                    <div className="device-card-id" title={`${dev.deviceId} (${dev.socketId ? '接続中' : '未接続'})`}>
                      <span className={`device-link-dot${onlineClass}`} />
                      <strong className="device-id-text" title={dev.deviceId}>
                        {displayId}
                      </strong>
                    </div>

                    {/* バッテリー残量・充電状態（20%以下は赤色警告） */}
                    <div
                      className="device-battery"
                      style={isLowBattery ? { color: '#ef4444', fontWeight: 'bold' } : undefined}
                      title={dev.charging ? '給電中 (充電中)' : 'バッテリー駆動中'}
                    >
                      {dev.charging ? '給:' : '残:'}{dev.batteryLevel}%
                      {isLowBattery && '!'}
                    </div>
                  </div>

                  {/* 設置場所情報 */}
                  {dev.location && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', padding: '1px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dev.location}
                    </div>
                  )}

                  {/* Row 2: 端末種別に応じた詳細情報 / 操作 */}
                  {!isSoundNode && !isElevator ? (
                    <div className="device-card-row phase">
                      <span className="device-phase-label">相:</span>
                      <select
                        value={dev.phase}
                        onChange={(e) => onPhaseChange(dev.deviceId, e.target.value as DevicePhase)}
                        className="win95-inset device-phase-select"
                      >
                        <option value="STANDBY">待機 (STANDBY)</option>
                        <option value="preshow">① プレショー</option>
                        <option value="quality_control">② 品質管理室</option>
                        <option value="elevator">③ エレベーター</option>
                        <option value="manufacturing_line">④ 製造ライン</option>
                        <option value="monitor_room">⑤ モニター室</option>
                        <option value="escape">非常脱出 (パニック)</option>
                        <option value="return">返却 (終了)</option>
                        <optgroup label="── 旧フェーズ互換 ──">
                          <option value="AREA_1_PHOTO">AREA_1_PHOTO</option>
                          <option value="ELEVATOR">ELEVATOR</option>
                          <option value="AREA_2_CONVEYOR">AREA_2_CONVEYOR</option>
                          <option value="AREA_3_VIDEO">AREA_3_VIDEO</option>
                          <option value="PANIC_ESCAPE">PANIC_ESCAPE</option>
                          <option value="RETURN">RETURN</option>
                        </optgroup>
                      </select>
                    </div>
                  ) : isElevator ? (
                    <div style={{ fontSize: '0.72rem', color: '#d97706', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      昇降演出発光稼働中
                    </div>
                  ) : (
                    /* Sound Node: 端末別音源選択ドロップダウン */
                    <div style={{ margin: '2px 0' }}>
                      <select
                        value={selectedSounds[dev.deviceId] || 'preset:lowImpact'}
                        onChange={(e) => handleDeviceSoundSelect(dev.deviceId, e.target.value)}
                        className="win95-inset"
                        style={{ width: '100%', fontSize: '10px', height: '22px', padding: '1px 2px' }}
                      >
                        <optgroup label="── プリセット音 ──">
                          {SOUND_PRESETS.map((p) => (
                            <option key={`preset:${p.type}`} value={`preset:${p.type}`}>
                              {p.label}
                            </option>
                          ))}
                        </optgroup>
                        {audioFiles.length > 0 && (
                          <optgroup label="── 外部音源 (audio/) ──">
                            {audioFiles.map((f) => (
                              <option key={`file:${f}`} value={`file:${f}`}>
                                {f}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}

                  {/* Row 3: アクションボタン */}
                  <div className="device-actions">
                    {!isSoundNode && !isElevator ? (
                      <>
                        <button
                          onClick={() => onIndividualGlitch(dev.deviceId)}
                          className="win95-btn device-action-btn"
                          title="個別グリッチ演出発火"
                        >
                          妨害 [G]
                        </button>

                        <button
                          onClick={() => onIndividualTorch(dev.deviceId)}
                          className="win95-btn device-action-btn"
                          title="個別トーチ点滅"
                        >
                          点滅 [T]
                        </button>
                      </>
                    ) : isSoundNode ? (
                      <>
                        <button
                          onClick={() => handleTriggerDeviceSound(dev.deviceId)}
                          className="win95-btn device-action-btn"
                          style={{ fontWeight: 'bold', color: '#0369a1' }}
                          title="選択中の音源をこの端末単体に再生指示"
                        >
                          再生
                        </button>
                        <button
                          onClick={() => onIndividualSound?.(dev.deviceId, 'beep')}
                          className="win95-btn device-action-btn"
                          title="接続テスト短ビープ音"
                        >
                          テスト音
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.68rem', color: '#78716c', gridColumn: 'span 2', textAlign: 'center' }}>
                        発光・監視中
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="win95-statusbar">
        <div className="win95-statusbar-item admin-statusbar-item">
          オンライン: {devices.filter((d) => !!d.socketId).length} / {devices.length} 台 (PDA:{clientCount} / 音響:{soundNodeCount} / 昇降:{elevatorCount})
        </div>
      </div>
    </div>
  );
};
