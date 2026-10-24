'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

interface PhaseArea2ConveyorProps {
  deviceId: string;
  onConveyorControl: (action: 'forward' | 'reverse' | 'stop') => void;
  onProceedNext: () => void;
  playMotorSound?: () => void;
}

export const PhaseArea2Conveyor: React.FC<PhaseArea2ConveyorProps> = ({
  deviceId,
  onConveyorControl,
  onProceedNext,
  playMotorSound,
}) => {
  const [conveyorState, setConveyorState] = useState<'forward' | 'reverse' | 'stop'>('stop');

  const handleAction = (action: 'forward' | 'reverse' | 'stop') => {
    setConveyorState(action);
    onConveyorControl(action);
    if (playMotorSound && action !== 'stop') {
      playMotorSound();
    }
  };

  return (
    <div className="phase-area2-conveyor">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1b5e20, #2e7d32)' }}>
          <span>[エリア 4] エリア2: 第零搬送コンベア制御</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          コンベアを起動して奥の資材/鍵を搬送してください。
        </div>
      </div>

      {/* Conveyor Main Control Console */}
      <div className="win95-window" style={{ marginTop: '8px' }}>
        <div className={`win95-titlebar ${conveyorState !== 'stop' ? 'zone2-titlebar-conveyor on' : ''}`}>
          <span>[EQ-CV01] 搬送コンベア・モータースイッチ</span>
          <span>
            {conveyorState === 'forward' && '[正転中 FWD]'}
            {conveyorState === 'reverse' && '[逆転中 REV]'}
            {conveyorState === 'stop' && '[停止中 STOP]'}
          </span>
        </div>
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px' }}>
              <div>動力源: <strong>ESP32 GPIO 23 (Relay 1)</strong></div>
              <div>回転速度: <strong>定格 100%</strong></div>
            </div>
            <div
              className={`zone2-led conveyor ${conveyorState !== 'stop' ? 'on' : ''}`}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: conveyorState !== 'stop' ? '#4caf50' : '#757575',
                boxShadow: conveyorState !== 'stop' ? '0 0 10px #4caf50' : 'none',
              }}
            />
          </div>

          {/* Switch Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => handleAction('forward')}
              className={`win95-btn ${conveyorState === 'forward' ? 'active' : ''}`}
              style={{
                padding: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: conveyorState === 'forward' ? '#388e3c' : undefined,
                color: conveyorState === 'forward' ? '#fff' : undefined,
              }}
            >
              ▲ 正転起動 [FORWARD]
            </button>
            <button
              onClick={() => handleAction('reverse')}
              className={`win95-btn ${conveyorState === 'reverse' ? 'active' : ''}`}
              style={{
                padding: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: conveyorState === 'reverse' ? '#f57c00' : undefined,
                color: conveyorState === 'reverse' ? '#fff' : undefined,
              }}
            >
              ▼ 逆転起動 [REVERSE]
            </button>
          </div>

          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => handleAction('stop')}
              className="win95-btn"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 'bold',
                backgroundColor: conveyorState === 'stop' ? '#b0bec5' : '#d32f2f',
                color: conveyorState === 'stop' ? '#37474f' : '#ffffff',
              }}
            >
              ■ 緊急停止 [STOP]
            </button>
          </div>
        </div>
      </div>

      {/* Live Log */}
      <div className="win95-inset-dark" style={{ marginTop: '8px', padding: '8px', fontSize: '11px', color: '#a5d6a7' }}>
        <div>[02:18:10] コンベア駆動回路: 通電中</div>
        <div>[02:18:24] 搬送対象の回収が完了したら、エリア3へ進んでください。</div>
      </div>

      {/* Advance to Area 3 Button */}
      <div style={{ marginTop: '14px' }}>
        <button
          onClick={onProceedNext}
          className="win95-btn"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            backgroundColor: '#1565c0',
            color: '#fff',
          }}
        >
          エリア3 (大型モニター区画) へ進む -&gt;
        </button>
      </div>
    </div>
  );
};
