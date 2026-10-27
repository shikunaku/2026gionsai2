'use client';

import React, { useState } from 'react';
import { ElevatorFloorState } from '../../lib/types';
import '../../styles/client.css';

interface PhaseElevatorSeqProps {
  deviceId: string;
  currentFloor?: ElevatorFloorState;
  onPowerToggle?: (powerOn: boolean) => void;
  onStartMove?: () => void;
  onProceedManufacturing: () => void;
  playSwitchSound?: () => void;
}

export const PhaseElevatorSeq: React.FC<PhaseElevatorSeqProps> = ({
  deviceId,
  currentFloor = 'FLOOR_1',
  onPowerToggle,
  onStartMove,
  onProceedManufacturing,
  playSwitchSound,
}) => {
  const [powerOn, setPowerOn] = useState<boolean>(false);
  const [sequenceStarted, setSequenceStarted] = useState<boolean>(false);

  const handleTogglePower = () => {
    const nextState = !powerOn;
    setPowerOn(nextState);
    if (playSwitchSound) playSwitchSound();
    if (onPowerToggle) onPowerToggle(nextState);
  };

  const handleTriggerDescent = () => {
    setSequenceStarted(true);
    if (playSwitchSound) playSwitchSound();
    if (onStartMove) onStartMove();
  };

  const isArrivedB1 = currentFloor === 'FLOOR_B1';
  const isMoving = currentFloor === 'MOVING';

  return (
    <div className="phase-elevator phase-container">
      {/* Title */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{ background: 'linear-gradient(90deg, #1f2429, #37474f)' }}
        >
          <span>第③フェーズ: エレベーター (1F ➔ B1F 降下)</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          全員乗車後、扉を閉鎖してエレベーター降下シーケンスを開始してください。
        </div>
      </div>

      {/* Main Power Switch Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: powerOn ? '#2e7d32' : '#c62828' }}>
          <span>エレベーター主電源制御盤</span>
          <span>{powerOn ? '[通電中]' : '[主電源遮断]'}</span>
        </div>
        <div style={{ padding: '14px', textAlign: 'center' }}>
          <button
            onClick={handleTogglePower}
            disabled={sequenceStarted && !isArrivedB1}
            className={`win95-btn ${powerOn ? 'active' : ''}`}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: powerOn ? '#2e7d32' : '#d32f2f',
              color: '#ffffff',
              boxShadow: powerOn ? '0 0 10px rgba(46, 125, 50, 0.4)' : 'none',
            }}
          >
            {powerOn ? '■ 主電源投入済 [通電中]' : '▲ エレベーター主電源を投入する'}
          </button>
        </div>
      </div>

      {/* Descent Trigger / Status Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#263238' }}>
          <span>運行ステータス &amp; 降下シーケンス</span>
          <span>[{isArrivedB1 ? 'B1F 到着' : isMoving ? '降下中...' : '1F 待機'}]</span>
        </div>
        <div style={{ padding: '18px 16px', textAlign: 'center' }}>
          {!powerOn ? (
            <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '14px' }}>
              主電源が遮断されています。上のボタンを押してください。
            </div>
          ) : !sequenceStarted && !isArrivedB1 ? (
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1565c0',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                扉を閉め、安全を確認してから「降下開始」を押してください。
              </div>

              <button
                onClick={handleTriggerDescent}
                className="win95-btn btn-natural-wrap break-keep leading-snug"
                style={{
                  width: '100%',
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#0d47a1',
                  color: '#ffffff',
                  boxShadow: '0 0 15px rgba(13, 71, 161, 0.5)',
                  letterSpacing: '1px',
                }}
              >
                <span className="inline-block">▼ 降下シーケンス開始</span>{' '}
                <span className="inline-block">(扉閉鎖・降下)</span>
              </button>
            </div>
          ) : isMoving || (sequenceStarted && !isArrivedB1) ? (
            <div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 'bold',
                  color: '#d32f2f',
                  marginBottom: '10px',
                  animation: 'pulse 1s infinite alternate',
                }}
              >
                降下中... (照明異常・振動発生中)
              </div>
              <div
                className="win95-inset-dark"
                style={{
                  padding: '10px',
                  fontSize: '11px',
                  color: '#ff8a80',
                  textAlign: 'left',
                  lineHeight: '1.7',
                }}
              >
                <div>[WARNING] 階数インジケーター急降下中</div>
                <div>[ANOMALY] ケーブル負荷異常・照明明滅を検知</div>
                <div>[STATUS] 端末画面の妨害ノイズにご注意ください</div>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#2e7d32',
                  lineHeight: '1.6',
                  marginBottom: '10px',
                }}
              >
                B1F (第零製造ライン) に到着しました。
              </div>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '14px' }}>
                扉が開きました。足元に注意して「製造ライン」へ移動してください。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Descent Complete: Move to Manufacturing Line */}
      {isArrivedB1 && (
        <div style={{ width: '100%', flexShrink: 0 }}>
          <button
            onClick={onProceedManufacturing}
            className="win95-btn btn-natural-wrap break-keep leading-snug"
            style={{
              width: '100%',
              padding: '16px 12px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: '#1b5e20',
              color: '#ffffff',
              boxShadow: '0 0 12px rgba(27, 94, 32, 0.5)',
            }}
          >
            <span className="inline-block">扉が開きました:</span>{' '}
            <span className="inline-block">第④フェーズ (製造ライン) へ進む -&gt;</span>
          </button>
        </div>
      )}
    </div>
  );
};
