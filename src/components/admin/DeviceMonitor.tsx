'use client';

import React from 'react';
import { DeviceInfo, DevicePhase } from '../../lib/types';

interface DeviceMonitorProps {
  devices: DeviceInfo[];
  onPhaseChange: (deviceId: string, phase: DevicePhase) => void;
  onIndividualGlitch: (deviceId: string) => void;
  onIndividualTorch: (deviceId: string) => void;
}

export const DeviceMonitor: React.FC<DeviceMonitorProps> = ({
  devices,
  onPhaseChange,
  onIndividualGlitch,
  onIndividualTorch,
}) => {
  return (
    <div className="win95-window" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="win95-titlebar">
        <span>[接続端末監視] Device Monitor ({devices.length}台)</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {devices.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#5f636c', fontSize: '11px' }}>
            現在接続中のPDA端末はありません。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {devices.map((dev) => {
              const isOnline = !!dev.socketId;
              return (
                <div
                  key={dev.deviceId}
                  className="win95-window"
                  style={{
                    backgroundColor: isOnline ? '#dedbd4' : '#cbc7be',
                    padding: '6px',
                  }}
                >
                  {/* Row 1: ID & Battery */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#4a825e' : '#7d828c',
                          display: 'inline-block',
                        }}
                      />
                      <strong style={{ fontSize: '12px', color: '#27292e' }}>ID: {dev.deviceId}</strong>
                    </div>

                    <div style={{ fontSize: '11px', color: '#4a4e57' }}>
                      {dev.charging ? 'CHG ' : 'BAT '}
                      {dev.batteryLevel}%
                    </div>
                  </div>

                  {/* Row 2: Phase selector dropdown */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3c3f47', whiteSpace: 'nowrap' }}>Phase:</span>
                    <select
                      value={dev.phase}
                      onChange={(e) => onPhaseChange(dev.deviceId, e.target.value as DevicePhase)}
                      className="win95-inset"
                      style={{ fontSize: '11px', padding: '2px 4px', height: '28px', fontWeight: 'bold', flex: 1 }}
                    >
                      <option value="INIT">INIT (待機)</option>
                      <option value="ZONE1">ZONE 1 (写真)</option>
                      <option value="ZONE2">ZONE 2 (機器)</option>
                      <option value="END">END (遮断)</option>
                    </select>
                  </div>

                  {/* Row 4: 妨害 & 点滅 buttons row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <button
                      onClick={() => onIndividualGlitch(dev.deviceId)}
                      className="win95-btn"
                      style={{ fontSize: '11px', padding: '4px 0', minHeight: '28px', fontWeight: 'bold' }}
                      title="個別グリッチ演出発火"
                    >
                      妨害 [G]
                    </button>

                    <button
                      onClick={() => onIndividualTorch(dev.deviceId)}
                      className="win95-btn"
                      style={{ fontSize: '11px', padding: '4px 0', minHeight: '28px', fontWeight: 'bold' }}
                      title="個別トーチ点滅"
                    >
                      点滅 [T]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="win95-statusbar">
        <div className="win95-statusbar-item" style={{ flex: 1 }}>
          オンライン: {devices.filter((d) => !!d.socketId).length} / {devices.length}
        </div>
      </div>
    </div>
  );
};
