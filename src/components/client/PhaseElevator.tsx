'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

interface PhaseElevatorProps {
  deviceId: string;
  onTriggerMove: () => void;
  onFloorGlitch: () => void;
  onProceedNext: () => void;
  playMotorSound?: () => void;
}

export const PhaseElevator: React.FC<PhaseElevatorProps> = ({
  deviceId,
  onTriggerMove,
  onFloorGlitch,
  onProceedNext,
  playMotorSound,
}) => {
  const [elevatorStatus, setElevatorStatus] = useState<'IDLE' | 'MOVING' | 'ARRIVED'>('IDLE');

  const handleStartElevator = () => {
    if (elevatorStatus !== 'IDLE') return;
    setElevatorStatus('MOVING');
    if (playMotorSound) playMotorSound();
    onTriggerMove();

    // 3.5s sequence
    setTimeout(() => {
      setElevatorStatus('ARRIVED');
    }, 3800);
  };

  return (
    <div className="phase-elevator">
      {/* Title window */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #37474f, #455a64)' }}>
          <span>[フェーズ 3] 地下昇降機 (ELEVATOR) 運行制御</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          全員が搭乗したことを確認し、昇降機運行を開始してください。
        </div>
      </div>

      {/* Status Box */}
      <div className="win95-window" style={{ marginTop: '8px' }}>
        <div className="win95-titlebar" style={{ background: '#263238' }}>
          <span>昇降機 運行ステータスモニター</span>
        </div>
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>現在運行ステータス</div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: elevatorStatus === 'MOVING' ? '#e65100' : elevatorStatus === 'ARRIVED' ? '#2e7d32' : '#37474f',
              letterSpacing: '1px',
            }}
          >
            {elevatorStatus === 'IDLE' && '【地上1階 待機中 (1F)】'}
            {elevatorStatus === 'MOVING' && '【地下へ降下移動中... (MOVING)】'}
            {elevatorStatus === 'ARRIVED' && '【地下1階 到着完了 (B1)】'}
          </div>

          <div
            className="win95-inset-dark"
            style={{
              marginTop: '12px',
              padding: '8px',
              fontSize: '11px',
              textAlign: 'left',
              color: '#81c784',
              lineHeight: '1.6',
            }}
          >
            <div>[LINK] ESP32昇降リレーおよびバックライト表示端末と同期中</div>
            <div>[GATE] ドアインターロック: 正常遮断</div>
            <div>[DEPTH] 目標地点: 地下1階 第零製造所</div>
          </div>
        </div>
      </div>

      {/* Action Trigger Buttons */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {elevatorStatus === 'IDLE' && (
          <button
            onClick={handleStartElevator}
            className="win95-btn"
            style={{
              padding: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: '#bf360c',
              color: '#ffffff',
            }}
          >
            エレベータ降下開始 [START DESCENT]
          </button>
        )}

        {elevatorStatus === 'MOVING' && (
          <button
            disabled
            className="win95-btn"
            style={{
              padding: '12px',
              fontSize: '13px',
              backgroundColor: '#546e7a',
              color: '#cfd8dc',
            }}
          >
            地下へ降下中... (振動に注意してください)
          </button>
        )}

        {elevatorStatus === 'ARRIVED' && (
          <>
            <div
              className="win95-inset"
              style={{
                padding: '8px',
                textAlign: 'center',
                backgroundColor: '#e8f5e9',
                color: '#1b5e20',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
            >
              地下1階 到着。扉を開けてエリア2（コンベア区画）へ進んでください。
            </div>
            <button
              onClick={onProceedNext}
              className="win95-btn"
              style={{
                padding: '12px',
                fontSize: '13px',
                fontWeight: 'bold',
                backgroundColor: '#2e7d32',
                color: '#ffffff',
              }}
            >
              エリア2 (コンベア操作) へ進む -&gt;
            </button>
          </>
        )}
      </div>
    </div>
  );
};
