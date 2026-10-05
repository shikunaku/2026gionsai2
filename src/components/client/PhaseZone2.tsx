'use client';

import React, { useState } from 'react';

interface PhaseZone2Props {
  deviceId: string;
  onMachineControl: (machineId: string, state: boolean) => void;
  playMotorSound?: () => void;
}

export const PhaseZone2: React.FC<PhaseZone2Props> = ({
  deviceId,
  onMachineControl,
  playMotorSound,
}) => {
  const [conveyorOn, setConveyorOn] = useState(false);
  const [valveOpen, setValveOpen] = useState(false);

  const toggleConveyor = () => {
    const nextState = !conveyorOn;
    setConveyorOn(nextState);
    onMachineControl('eq_conveyor_01', nextState);
    if (playMotorSound) playMotorSound();
  };

  const toggleValve = () => {
    const nextState = !valveOpen;
    setValveOpen(nextState);
    onMachineControl('eq_valve_01', nextState);
    if (playMotorSound) playMotorSound();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '10px 12px',
        backgroundColor: '#c7c4bd',
        color: '#27292e',
        boxSizing: 'border-box',
        overflowY: 'auto',
        gap: '8px',
      }}
    >
      {/* Title */}
      <div className="win95-window" style={{ flexShrink: 0 }}>
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #54493b, #6b5c4b)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>[ZONE 2] 第零製造ライン - 機器制御</span>
          <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>ID: {deviceId}</span>
        </div>
        <div style={{ padding: '5px 8px', fontSize: '11px', color: '#444850', lineHeight: 1.4 }}>
          現場機器の物理リレーおよびバルブサーボと双方向直結しています。
        </div>
      </div>

      {/* Conveyor Control Card */}
      <div className="win95-window" style={{ flexShrink: 0 }}>
        <div
          className="win95-titlebar"
          style={{
            background: conveyorOn
              ? 'linear-gradient(90deg, #32543c, #446e50)'
              : 'linear-gradient(90deg, #424750, #545a66)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>[A-01] 搬送コンベア (Relay)</span>
          <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>
            {conveyorOn ? '[稼働 RUN]' : '[停止 STOP]'}
          </span>
        </div>
        <div style={{ padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#33373e', lineHeight: 1.4 }}>
              <div>主搬送モーター: <strong>200V 三相交流</strong></div>
              <div>通信リンク: <strong>ESP32 GPIO 25</strong></div>
            </div>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: conveyorOn ? '#4d8c63' : '#6b7280',
                flexShrink: 0,
              }}
            />
          </div>

          <button
            onClick={toggleConveyor}
            className="win95-btn"
            style={{
              width: '100%',
              height: '42px',
              fontSize: '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              backgroundColor: conveyorOn ? '#8f6436' : '#38577a',
              color: '#f0f3f8',
            }}
          >
            {conveyorOn ? 'コンベア停止 [STOP]' : 'コンベア起動 [START]'}
          </button>
        </div>
      </div>

      {/* Steam Valve Control Card */}
      <div className="win95-window" style={{ flexShrink: 0 }}>
        <div
          className="win95-titlebar"
          style={{
            background: valveOpen
              ? 'linear-gradient(90deg, #6e3939, #8c4b4b)'
              : 'linear-gradient(90deg, #424750, #545a66)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>[B-02] 蒸気減圧弁 (Servo)</span>
          <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>
            {valveOpen ? '[減圧 OPEN]' : '[閉塞 CLOSE]'}
          </span>
        </div>
        <div style={{ padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#33373e', lineHeight: 1.4 }}>
              <div>弁開度サーボ: <strong>0° ⇔ 90° 開放</strong></div>
              <div>管内圧力: <strong>{valveOpen ? '0.12 MPa (減圧済)' : '0.85 MPa (高圧)'}</strong></div>
            </div>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: valveOpen ? '#a64d4d' : '#6b7280',
                flexShrink: 0,
              }}
            />
          </div>

          <button
            onClick={toggleValve}
            className="win95-btn"
            style={{
              width: '100%',
              height: '42px',
              fontSize: '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              backgroundColor: valveOpen ? '#4c525c' : '#7d3838',
              color: '#f8f0f0',
            }}
          >
            {valveOpen ? '減圧弁を復帰閉鎖 [CLOSE]' : '蒸気減圧弁を全開 [PURGE]'}
          </button>
        </div>
      </div>

      {/* Industrial Warning Display */}
      <div className="win95-inset-dark" style={{ flex: 1, padding: '8px 10px', fontSize: '11px', lineHeight: 1.4 }}>
        <div style={{ color: '#c79c52', fontWeight: 'bold', marginBottom: '3px' }}>
          [現場警告ログ]
        </div>
        <div>[02:14:08] 搬送コンベア速度センサー微動検出</div>
        <div>[02:14:31] 管内異常圧力上昇 (ZONE-00 異常振動)</div>
        <div>[02:15:02] 手元の端末から機器安全停止を行ってください</div>
      </div>
    </div>
  );
};
