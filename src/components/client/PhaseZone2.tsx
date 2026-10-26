'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

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
    <div className="phase-zone2">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar zone2-titlebar zone2-titlebar-header">
          <span className="zone2-titlebar-text">第零製造ライン - 機器制御</span>
          <span className="zone2-titlebar-tag">ID: {deviceId}</span>
        </div>
        <div className="zone2-intro">
          現場機器の物理リレーおよびバルブサーボと双方向直結しています。
        </div>
      </div>

      {/* Conveyor Control Card */}
      <div className="win95-window">
        <div className={`win95-titlebar zone2-titlebar zone2-titlebar-conveyor${conveyorOn ? ' on' : ''}`}>
          <span className="zone2-titlebar-text">[A-01] 搬送コンベア (Relay)</span>
          <span className="zone2-titlebar-tag">
            {conveyorOn ? '[稼働 RUN]' : '[停止 STOP]'}
          </span>
        </div>
        <div className="zone2-card-body">
          <div className="zone2-card-row">
            <div className="zone2-card-info">
              <div>主搬送モーター: <strong>200V 三相交流</strong></div>
              <div>通信リンク: <strong>ESP32 GPIO 25</strong></div>
            </div>
            <div className={`zone2-led conveyor${conveyorOn ? ' on' : ''}`} />
          </div>

          <button
            onClick={toggleConveyor}
            className={`win95-btn zone2-btn conveyor${conveyorOn ? ' on' : ''}`}
          >
            {conveyorOn ? 'コンベア停止 [STOP]' : 'コンベア起動 [START]'}
          </button>
        </div>
      </div>

      {/* Steam Valve Control Card */}
      <div className="win95-window">
        <div className={`win95-titlebar zone2-titlebar zone2-titlebar-valve${valveOpen ? ' on' : ''}`}>
          <span className="zone2-titlebar-text">[B-02] 蒸気減圧弁 (Servo)</span>
          <span className="zone2-titlebar-tag">
            {valveOpen ? '[減圧 OPEN]' : '[閉塞 CLOSE]'}
          </span>
        </div>
        <div className="zone2-card-body">
          <div className="zone2-card-row">
            <div className="zone2-card-info">
              <div>弁開度サーボ: <strong>0° ⇔ 90° 開放</strong></div>
              <div>管内圧力: <strong>{valveOpen ? '0.12 MPa (減圧済)' : '0.85 MPa (高圧)'}</strong></div>
            </div>
            <div className={`zone2-led valve${valveOpen ? ' on' : ''}`} />
          </div>

          <button
            onClick={toggleValve}
            className={`win95-btn zone2-btn valve${valveOpen ? ' on' : ''}`}
          >
            {valveOpen ? '減圧弁を復帰閉鎖 [CLOSE]' : '蒸気減圧弁を全開 [PURGE]'}
          </button>
        </div>
      </div>

      {/* Industrial Warning Display */}
      <div className="win95-inset-dark zone2-log">
        <div className="zone2-log-title">[現場警告ログ]</div>
        <div>[02:14:08] 搬送コンベア速度センサー微動検出</div>
        <div>[02:14:31] 管内異常圧力上昇 (ZONE-00 異常振動)</div>
        <div>[02:15:02] 手元の端末から機器安全停止を行ってください</div>
      </div>
    </div>
  );
};
