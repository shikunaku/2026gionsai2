'use client';

import React, { useState } from 'react';
import { ElevatorFloorState } from '../../lib/types';
import '../../styles/elevator-display.css';
import '../../styles/client.css';

interface PhaseElevatorProps {
  deviceId: string;
  currentFloor?: ElevatorFloorState;
  onPowerToggle?: (powerOn: boolean) => void;
  playSwitchSound?: () => void;
  onProceedZone2?: () => void;
}

export const PhaseElevator: React.FC<PhaseElevatorProps> = ({
  deviceId,
  currentFloor = 'FLOOR_1',
  onPowerToggle,
  playSwitchSound,
  onProceedZone2,
}) => {
  const [powerOn, setPowerOn] = useState<boolean>(false);

  const handleTogglePower = () => {
    const nextState = !powerOn;
    setPowerOn(nextState);
    if (playSwitchSound) playSwitchSound();
    if (onPowerToggle) onPowerToggle(nextState);
  };

  const isArrivedB1 = currentFloor === 'FLOOR_B1';

  return (
    <div className="phase-elevator phase-container">
      {/* Title window */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1f2429, #37474f)' }}>
          <span>移動: エレベータ (1F ➔ B1F)</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          地下区画へ向かうため、手元の端末でエレベータの主電源を投入してください。
        </div>
      </div>

      {/* Main Power Switch Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: powerOn ? '#2e7d32' : '#c62828' }}>
          <span>エレベータ主電源制御盤</span>
          <span>{powerOn ? '[通電中]' : '[主電源遮断]'}</span>
        </div>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#444', marginBottom: '10px' }}>
            エレベータ動力ユニット: <strong>{powerOn ? '通電完了' : '電力供給停止'}</strong>
          </div>

          <button
            onClick={handleTogglePower}
            className={`win95-btn ${powerOn ? 'active' : ''}`}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: powerOn ? '#2e7d32' : '#d32f2f',
              color: '#ffffff',
              letterSpacing: '1px',
              boxShadow: powerOn ? '0 0 12px rgba(46, 125, 50, 0.5)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {powerOn ? '■ 主電源投入済 [通電中 - クリックで遮断]' : '▲ エレベータ主電源を投入する'}
          </button>
        </div>
      </div>

      {/* Instruction Box depending on Power state */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#263238' }}>
          <span>運行指示アナウンス</span>
        </div>
        <div style={{ padding: '18px 16px', textAlign: 'center' }}>
          {!powerOn ? (
            <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '15px', lineHeight: '1.6' }}>
              [警告: 主電源が遮断されています]
              <br />
              <span style={{ fontSize: '13px', color: '#555', fontWeight: 'normal' }}>
                上記の「エレベータ主電源投入」スイッチを押してください。
              </span>
            </div>
          ) : !isArrivedB1 ? (
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1565c0',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                主電源投入を確認。
                <br />
                エレベータ内の【物理ボタン】を押してください。
              </div>
              <div
                className="win95-inset-dark"
                style={{
                  padding: '10px',
                  fontSize: '11px',
                  color: '#81c784',
                  textAlign: 'left',
                  lineHeight: '1.7',
                }}
              >
                <div>[STATUS] 昇降ケージ通電待機中 (階数表示器連動)</div>
                <div>[ACTION] 筐体壁面の下降ボタンを押下すると降下が始まります。</div>
                <div>[CAUTION] 移動中の急な揺れ・照明のチラつきにご注意ください。</div>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 'bold',
                  color: '#2e7d32',
                  lineHeight: '1.6',
                  marginBottom: '10px',
                }}
              >
                地下1階 (第零製造ライン) に到着しました。
              </div>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '14px' }}>
                扉が開いたら、足元に注意してエリア2（第零製造ライン）へ移動してください。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* When arrived at B1F or moving finished, show Proceed to Area 2 */}
      {(isArrivedB1 || powerOn) && onProceedZone2 && (
        <div style={{ width: '100%', flexShrink: 0 }}>
          <button
            onClick={onProceedZone2}
            className="win95-btn"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: isArrivedB1 ? '#2e7d32' : '#37474f',
              color: '#ffffff',
            }}
          >
            エリア2: 第零製造ラインへ進む -&gt;
          </button>
        </div>
      )}
    </div>
  );
};
