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
          style={{ background: '#252d33' }}
        >
          <span>エレベーターでB1Fへ移動</span>
          <span className="phase-init-title-tag">端末 {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '14px', color: '#27292e', lineHeight: 1.5 }}>
          全員が乗ったことを確認してから、地下へ移動してください。
        </div>
      </div>

      {/* Main Power Switch Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: powerOn ? '#2e7d32' : '#c62828' }}>
          <span>到着確認</span>
          <span>{powerOn ? '[到着済み]' : '[移動中]'}</span>
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
            {powerOn ? 'エレベーターに到着しました' : 'エレベーターに到着した'}
          </button>
        </div>
      </div>

      {/* Descent Trigger / Status Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#263238' }}>
          <span>ステータス</span>
          <span>[{isArrivedB1 ? 'B1Fに到着' : isMoving ? '地下へ移動中...' : '1Fで待機'}]</span>
        </div>
        <div style={{ padding: '18px 16px', textAlign: 'center' }}>
          {!powerOn ? (
            <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '14px' }}>
              エレベーターに着いたら、上のボタンを押してください。
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
                全員が乗ったら「地下へ移動する」を押してください。
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
                <span className="inline-block">地下へ移動する</span>
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
                地下へ移動中...（照明と振動にご注意ください）
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
                B1Fに到着しました。
              </div>
              <div style={{ fontSize: '14px', color: '#555', marginBottom: '14px', lineHeight: 1.5 }}>
                足元に注意して「第零製造ライン」へ移動してください。
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
            <span className="inline-block">第零製造ラインへ向かう</span>
          </button>
        </div>
      )}
    </div>
  );
};
