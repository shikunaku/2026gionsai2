'use client';

import React, { useState } from 'react';

interface PhaseInitProps {
  deviceId: string;
  onDeviceIdChange: (id: string) => void;
  onStart: () => void;
}

export const PhaseInit: React.FC<PhaseInitProps> = ({
  deviceId,
  onDeviceIdChange,
  onStart,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartClick = async () => {
    if (!agreed || isStarting) return;
    setIsStarting(true);

    // 1. Fullscreen request
    try {
      if (document.documentElement && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }

    // 2. Screen WakeLock
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      console.warn('WakeLock request failed:', e);
    }

    // 3. Callback to unlock Audio & emit device ready/start
    onStart();
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
        gap: '10px',
      }}
    >
      {/* Header Window */}
      <div className="win95-window" style={{ width: '100%', flexShrink: 0 }}>
        <div className="win95-titlebar" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>[端末OS v3.84] 保守端末初期設定</span>
          <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>[待機]</span>
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>端末ID:</span>
              <input
                type="text"
                value={deviceId}
                maxLength={6}
                onChange={(e) => onDeviceIdChange(e.target.value.toUpperCase())}
                className="win95-inset"
                style={{
                  width: '74px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  letterSpacing: '1px',
                  color: '#2d4b73',
                  padding: '2px 4px',
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#686c75', whiteSpace: 'nowrap' }}>自動割当済</span>
          </div>
        </div>
      </div>

      {/* Safety Notice Box */}
      <div
        className="win95-window"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #633939, #7a4747)', whiteSpace: 'nowrap' }}>
          <span>[重要規定] 巡視保守業務 安全規定</span>
        </div>
        <div
          className="win95-inset-dark"
          style={{
            padding: '10px',
            fontSize: '11px',
            lineHeight: 1.5,
            color: '#98bb83',
            maxHeight: '190px',
            overflowY: 'auto',
          }}
        >
          <p style={{ color: '#d07070', fontWeight: 'bold', marginBottom: '6px' }}>
            [保安注意事項]
          </p>
          <p style={{ marginBottom: '4px' }}>1. 本端末は第零製造区画の巡視保守用専用端末です。</p>
          <p style={{ marginBottom: '4px' }}>2. 各ポイントで指示された対象の撮影点検を行ってください。</p>
          <p style={{ marginBottom: '4px' }}>3. 異常振動・異音・照明明滅を感知した場合は直ちに退避してください。</p>
          <p style={{ marginBottom: '4px' }}>4. 業務中は画面から目を離さず、必ず管理者の指示に従ってください。</p>
          <p style={{ color: '#bfa156', marginTop: '6px', fontSize: '10px' }}>
            ※ 業務に伴い、端末の音声出力・背面ライト・画面振動が自動連動します。
          </p>
        </div>

        {/* Checkbox */}
        <div style={{ padding: '8px 10px', backgroundColor: '#c7c4bd', borderTop: '2px solid #7a7974' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: '#2a2c30',
              lineHeight: 1.3,
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: '18px', height: '18px', flexShrink: 0 }}
            />
            <span>上記安全規定および機能連動に同意する</span>
          </label>
        </div>
      </div>

      {/* Start Button - Positioned directly below the agreement box */}
      <div style={{ width: '100%', flexShrink: 0 }}>
        <button
          onClick={handleStartClick}
          disabled={!agreed || isStarting}
          className="win95-btn"
          style={{
            width: '100%',
            height: '46px',
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            backgroundColor: agreed ? '#38694a' : '#c7c4bd',
            color: agreed ? '#f1f5f2' : '#7d8085',
            cursor: agreed ? 'pointer' : 'not-allowed',
            borderTop: agreed ? '2px solid #5d9671' : '2px solid #e2e0d8',
            borderLeft: agreed ? '2px solid #5d9671' : '2px solid #e2e0d8',
            borderRight: agreed ? '2px solid #23422e' : '2px solid #5a5955',
            borderBottom: agreed ? '2px solid #23422e' : '2px solid #5a5955',
          }}
        >
          {isStarting ? 'システム初期化中...' : '点検業務を開始 [ENTER]'}
        </button>
      </div>
    </div>
  );
};
