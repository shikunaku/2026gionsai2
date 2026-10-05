'use client';

import React, { useEffect } from 'react';

interface PhaseEndProps {
  deviceId: string;
  onShutdownSound?: () => void;
  onTurnOffFlash?: () => void;
}

export const PhaseEnd: React.FC<PhaseEndProps> = ({
  deviceId,
  onShutdownSound,
  onTurnOffFlash,
}) => {
  useEffect(() => {
    if (onTurnOffFlash) onTurnOffFlash();
    if (onShutdownSound) onShutdownSound();
  }, [onTurnOffFlash, onShutdownSound]);

  return (
    <div
      className="shutdown-overlay"
      style={{
        padding: '16px 12px',
        textAlign: 'center',
        backgroundColor: '#181b1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          border: '2px solid #8c4242',
          padding: '18px 14px',
          maxWidth: '420px',
          width: '100%',
          backgroundColor: '#1f2227',
          boxShadow: '0 0 20px rgba(140, 66, 66, 0.25)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c76b6b', marginBottom: '6px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
          [EMERGENCY LOCKDOWN]
        </div>
        <h1 style={{ fontSize: '17px', color: '#c76b6b', letterSpacing: '1px', marginBottom: '10px', whiteSpace: 'nowrap' }}>
          FATAL SYSTEM FAILURE
        </h1>
        <div style={{ color: '#d8dadf', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', whiteSpace: 'nowrap' }}>
          システム異常・強制遮断 [TERMINATED]
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#a4a8b2',
            lineHeight: 1.6,
            textAlign: 'left',
            backgroundColor: '#262a32',
            padding: '10px',
            border: '1px solid #3c404a',
            marginBottom: '12px',
            fontFamily: 'monospace',
          }}
        >
          <div>TERMINAL ID : [{deviceId}]</div>
          <div>ERROR CODE  : 0xDEAD0066 (ANOMALY)</div>
          <div>STATUS      : CORE DISCONNECTED</div>
          <div>INSTRUCTION : 直ちに現場から退避してください。</div>
        </div>

        <div style={{ fontSize: '10px', color: '#7a7e88', lineHeight: 1.3 }}>
          ※ 本端末の操作はロックされています。運営スタッフの指示に従ってください。
        </div>
      </div>
    </div>
  );
};
