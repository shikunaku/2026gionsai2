'use client';

import React, { useState } from 'react';
import { SerialDeviceConfig } from '../../lib/types';
import { useSerialDevices } from './useSerialDevices';
import { SerialDeviceCard } from './SerialDeviceCard';
import { SerialConfigModal } from './SerialConfigModal';
import '../../styles/serial-manager.css';

export const SerialDeviceManager: React.FC = () => {
  const {
    devices,
    supported,
    logs,
    clearLogs,
    registerPort,
    saveDeviceConfig,
    deleteDevice,
    connectDevice,
    disconnectDevice,
    toggleSwitch,
    triggerButton,
  } = useSerialDevices();

  const [editingDevice, setEditingDevice] = useState<SerialDeviceConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalMode, setModalMode] = useState<'new' | 'edit'>('new');

  const handleOpenNewModal = () => {
    setModalMode('new');
    setEditingDevice(null);
    setShowConfigModal(true);
  };

  const handleOpenEditModal = (dev: SerialDeviceConfig) => {
    setModalMode('edit');
    setEditingDevice(dev);
    setShowConfigModal(true);
  };

  return (
    <div className="serial-manager-root win95-window">
      <div className="win95-titlebar serial-header-titlebar">
        <span>マイコンUSBシリアル統合制御コンソール (Web Serial)</span>
        <span className="serial-browser-badge">
          {supported ? 'Web Serial API 有効' : 'Web Serial 非対応 (Chrome/Edge推奨)'}
        </span>
      </div>

      <div className="serial-manager-toolbar">
        <div className="serial-toolbar-left">
          <span className="serial-summary-text">
            登録端末数: <strong>{devices.length}台</strong> | 接続中: <strong>{devices.filter((d) => d.connected).length}台</strong>
          </span>
        </div>
        <div className="serial-toolbar-actions">
          <button className="win95-btn serial-add-btn" onClick={handleOpenNewModal}>
            新規マイコン端末を追加
          </button>
        </div>
      </div>

      {/* Main Workspace: Top = Compact Device Cards Grid, Bottom = Unified Log Console */}
      <div className="serial-compact-workspace">
        {/* Device Cards Section */}
        <div className="serial-devices-compact-container">
          {devices.length === 0 ? (
            <div className="serial-empty-message win95-inset">
              マイコン端末が登録されていません。「新規マイコン端末を追加」ボタンからUSB接続・設定を行ってください。
            </div>
          ) : (
            devices.map((device) => (
              <SerialDeviceCard
                key={device.id}
                device={device}
                onEdit={handleOpenEditModal}
                onDelete={deleteDevice}
                onConnect={connectDevice}
                onDisconnect={disconnectDevice}
                onToggleSwitch={toggleSwitch}
                onTriggerButton={triggerButton}
              />
            ))
          )}
        </div>

        {/* Global Unified Serial Log Console */}
        <div className="win95-window serial-global-log-window">
          <div className="win95-titlebar serial-global-log-titlebar">
            <span>全マイコン統合シリアル通信ログ ({logs.length}件)</span>
            <button className="win95-btn serial-clear-btn" onClick={clearLogs}>
              ログクリア
            </button>
          </div>
          <div className="serial-global-log-console win95-inset">
            {logs.length === 0 ? (
              <div className="serial-log-placeholder">送受信ログはありません (マイコンを接続して操作するとここに流れます)</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="serial-log-line">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Device Modal */}
      <SerialConfigModal
        isOpen={showConfigModal}
        mode={modalMode}
        initialDevice={editingDevice}
        onClose={() => setShowConfigModal(false)}
        onSave={saveDeviceConfig}
        onPortSelected={registerPort}
        isWebSerialSupported={supported}
      />
    </div>
  );
};
