'use client';

import React from 'react';
import {
  SerialDeviceConfig,
  SerialSwitchConfig,
  SerialButtonConfig,
} from '../../lib/types';

interface SerialDeviceCardProps {
  device: SerialDeviceConfig;
  onEdit: (device: SerialDeviceConfig) => void;
  onDelete: (id: string) => void;
  onConnect: (device: SerialDeviceConfig) => void;
  onDisconnect: (device: SerialDeviceConfig) => void;
  onToggleSwitch: (device: SerialDeviceConfig, sw: SerialSwitchConfig) => void;
  onTriggerButton: (device: SerialDeviceConfig, btn: SerialButtonConfig) => void;
}

export const SerialDeviceCard: React.FC<SerialDeviceCardProps> = ({
  device,
  onEdit,
  onDelete,
  onConnect,
  onDisconnect,
  onToggleSwitch,
  onTriggerButton,
}) => {
  return (
    <div className={`win95-window serial-device-card ${device.connected ? 'is-connected' : ''}`}>
      <div className="win95-titlebar serial-device-titlebar">
        <div className="serial-device-titlebar-left">
          <span className="serial-status-dot" title={device.connected ? '接続中' : '未接続'} />
          <span className="serial-device-name" title={device.name}>
            {device.name}
          </span>
          <span className="serial-baud-badge">{device.baudRate} bps</span>
        </div>
        <div className="serial-device-titlebar-right">
          <button
            className="win95-btn serial-mini-btn"
            onClick={() => onEdit(device)}
            title="設定・ボタン構成を後から編集"
          >
            編集
          </button>
          <button
            className="win95-btn serial-mini-btn serial-delete-btn"
            onClick={() => onDelete(device.id)}
            title="端末削除"
          >
            削除
          </button>
        </div>
      </div>

      <div className="serial-device-body compact">
        {/* Port Info & Connect/Disconnect Bar (Slim) */}
        <div className="serial-port-bar win95-inset">
          <div className="serial-port-info" title={device.portName || '未検出'}>
            <span className="serial-info-value">{device.portName || '未検出'}</span>
          </div>
          <div className="serial-connect-action">
            {device.connected ? (
              <button
                className="win95-btn serial-disconnect-btn"
                onClick={() => onDisconnect(device)}
              >
                切断
              </button>
            ) : (
              <button
                className="win95-btn serial-connect-btn"
                onClick={() => onConnect(device)}
              >
                接続
              </button>
            )}
          </div>
        </div>

        {/* Switches and Buttons row */}
        <div className="serial-controls-compact">
          {/* Switches */}
          {device.switches.length > 0 && (
            <div className="serial-control-group">
              <span className="serial-group-tag">SW:</span>
              <div className="serial-chips-row">
                {device.switches.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    className={`win95-btn serial-switch-chip ${sw.state ? 'is-on' : 'is-off'}`}
                    onClick={() => onToggleSwitch(device, sw)}
                    title={`スイッチ: ${sw.name} (action: ${sw.action})`}
                  >
                    <span className="chip-name">{sw.name}</span>
                    <span className="chip-state">{sw.state ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          {device.buttons.length > 0 && (
            <div className="serial-control-group">
              <span className="serial-group-tag">CMD:</span>
              <div className="serial-chips-row">
                {device.buttons.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    className="win95-btn serial-button-chip"
                    onClick={() => onTriggerButton(device, btn)}
                    title={`送信: {"action":"${btn.action}"}`}
                  >
                    {btn.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {device.switches.length === 0 && device.buttons.length === 0 && (
            <div className="serial-no-controls">スイッチ・ボタン未登録 (「編集」から追加)</div>
          )}
        </div>
      </div>
    </div>
  );
};
