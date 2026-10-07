'use client';

import React from 'react';
import { DeviceInfo, DevicePhase } from '../../lib/types';
import '../../styles/admin.css';

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
    <div className="win95-window admin-panel">
      <div className="win95-titlebar">
        <span>[接続端末監視] Device Monitor ({devices.length}台)</span>
      </div>

      <div className="device-monitor-body">
        {devices.length === 0 ? (
          <div className="admin-empty">現在接続中のPDA端末はありません。</div>
        ) : (
          <div className="device-list">
            {devices.map((dev) => {
              const onlineClass = dev.socketId ? ' online' : '';
              return (
                <div key={dev.deviceId} className={`win95-window device-card${onlineClass}`}>
                  {/* Row 1: ID & Battery */}
                  <div className="device-card-row between">
                    <div className="device-card-id">
                      <span className={`device-link-dot${onlineClass}`} />
                      <strong className="device-id-text">ID: {dev.deviceId}</strong>
                    </div>

                    <div className="device-battery">
                      {dev.charging ? 'CHG ' : 'BAT '}
                      {dev.batteryLevel}%
                    </div>
                  </div>

                  {/* Row 2: Phase selector dropdown */}
                  <div className="device-card-row phase">
                    <span className="device-phase-label">Phase:</span>
                    <select
                      value={dev.phase}
                      onChange={(e) => onPhaseChange(dev.deviceId, e.target.value as DevicePhase)}
                      className="win95-inset device-phase-select"
                    >
                      <option value="INIT">INIT (待機)</option>
                      <option value="ZONE1">ZONE 1 (写真)</option>
                      <option value="ZONE2">ZONE 2 (機器)</option>
                      <option value="END">END (遮断)</option>
                    </select>
                  </div>

                  {/* Row 4: 妨害 & 点滅 buttons row */}
                  <div className="device-actions">
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="win95-statusbar">
        <div className="win95-statusbar-item admin-statusbar-item">
          オンライン: {devices.filter((d) => !!d.socketId).length} / {devices.length}
        </div>
      </div>
    </div>
  );
};
