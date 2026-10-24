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
                      <option value="STANDBY">1: STANDBY (待機)</option>
                      <option value="AREA_1_PHOTO">2: AREA 1 (撮影)</option>
                      <option value="ELEVATOR">3: ELEVATOR (昇降)</option>
                      <option value="AREA_2_CONVEYOR">4: AREA 2 (コンベア)</option>
                      <option value="AREA_3_VIDEO">5: AREA 3 (映像)</option>
                      <option value="RETURN">6: RETURN (返却)</option>
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
