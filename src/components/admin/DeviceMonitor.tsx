'use client';

/**
 * @file DeviceMonitor.tsx
 * @description 管理画面における接続端末（参加者PDAおよびサウンドノード）のリアルタイム監視コンポーネント。
 * 通常のPDA端末とサウンド再生専用端末（SOUND_NODE）をタブまたは視覚バッジで区別し、
 * 個別テストトーンのトリガーやフェーズ強制変更を提供します。
 */

import React, { useState } from 'react';
import { DeviceInfo, DevicePhase, SoundEffectOptions } from '../../lib/types';
import '../../styles/admin.css';

interface DeviceMonitorProps {
  devices: DeviceInfo[];
  onPhaseChange: (deviceId: string, phase: DevicePhase) => void;
  onIndividualGlitch: (deviceId: string) => void;
  onIndividualTorch: (deviceId: string) => void;
  /** サウンドノード宛ての個別効果音テストトリガー */
  onIndividualSound?: (deviceId: string, soundType: SoundEffectOptions['soundType']) => void;
}

export const DeviceMonitor: React.FC<DeviceMonitorProps> = ({
  devices,
  onPhaseChange,
  onIndividualGlitch,
  onIndividualTorch,
  onIndividualSound,
}) => {
  const [filterRole, setFilterRole] = useState<'all' | 'client' | 'sound_node'>('all');

  const filteredDevices = devices.filter((dev) => {
    if (filterRole === 'client') return !dev.role || dev.role === 'client';
    if (filterRole === 'sound_node') return dev.role === 'sound_node';
    return true;
  });

  const clientCount = devices.filter((d) => !d.role || d.role === 'client').length;
  const soundNodeCount = devices.filter((d) => d.role === 'sound_node').length;

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>[接続端末監視] Device &amp; Sound Monitor ({devices.length}台)</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setFilterRole('all')}
            className={`win95-btn ${filterRole === 'all' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '1px 6px' }}
          >
            ALL ({devices.length})
          </button>
          <button
            onClick={() => setFilterRole('client')}
            className={`win95-btn ${filterRole === 'client' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '1px 6px' }}
          >
            PDA ({clientCount})
          </button>
          <button
            onClick={() => setFilterRole('sound_node')}
            className={`win95-btn ${filterRole === 'sound_node' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '1px 6px' }}
          >
             音響 ({soundNodeCount})
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

              return (
                <div
                  key={dev.deviceId}
                  className={`win95-window device-card${onlineClass}`}
                  style={isSoundNode ? { border: '2px solid #0284c7' } : undefined}
                >
                  {/* Row 1: ID, Role Badge & Battery/Status */}
                  <div className="device-card-row between">
                    <div className="device-card-id" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={`device-link-dot${onlineClass}`} />
                      <strong className="device-id-text">
                        {isSoundNode ? '[SOUND] ' : ''}ID: {dev.deviceId}
                      </strong>
                    </div>

                    <div className="device-battery">
                      {isSoundNode ? (
                        <span style={{ color: '#0284c7', fontWeight: 'bold' }}>SOUND NODE</span>
                      ) : (
                        <>
                          {dev.charging ? 'CHG ' : 'BAT '}
                          {dev.batteryLevel}%
                        </>
                      )}
                    </div>
                  </div>

                  {/* 設置場所情報 */}
                  {dev.location && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '2px 0' }}>
                      場所: {dev.location}
                    </div>
                  )}

                  {/* Row 2: PDAフェーズ切り替え or サウンドノード情報 */}
                  {!isSoundNode ? (
                    <div className="device-card-row phase">
                      <span className="device-phase-label">Phase:</span>
                      <select
                        value={dev.phase}
                        onChange={(e) => onPhaseChange(dev.deviceId, e.target.value as DevicePhase)}
                        className="win95-inset device-phase-select"
                      >
                        <option value="STANDBY">1: STANDBY (待機)</option>
                        <option value="AREA_1_PHOTO">2: AREA 1 (撮影)</option>
                        <option value="ELEVATOR">3: ELEVATOR (昇降)</option>
                        <option value="AREA_2_CONVEYOR">4: AREA 2 (コンベア)</option>
                        <option value="AREA_3_VIDEO">5: AREA 3 (映像)</option>
                        <option value="RETURN">6: RETURN (返却)</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', margin: '4px 0' }}>
                      専用音響待機中 (自動再生アンロック済)
                    </div>
                  )}

                  {/* Row 3: アクションボタン */}
                  <div className="device-actions">
                    {!isSoundNode ? (
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
                    ) : (
                      <>
                        <button
                          onClick={() => onIndividualSound?.(dev.deviceId, 'beep')}
                          className="win95-btn device-action-btn"
                          title="テストビープ音"
                        >
                          テスト音
                        </button>
                        <button
                          onClick={() => onIndividualSound?.(dev.deviceId, 'lowImpact')}
                          className="win95-btn device-action-btn"
                          title="重低音ドカン"
                        >
                          重低音
                        </button>
                        <button
                          onClick={() => onIndividualSound?.(dev.deviceId, 'geiger')}
                          className="win95-btn device-action-btn"
                          title="ガイガー放射線音"
                        >
                          ガイガー
                        </button>
                      </>
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
          オンライン: {devices.filter((d) => !!d.socketId).length} / {devices.length} 台 (PDA:{clientCount} / 音響:{soundNodeCount})
        </div>
      </div>
    </div>
  );
};
