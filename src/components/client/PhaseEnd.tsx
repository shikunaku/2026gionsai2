'use client';

import React, { useEffect } from 'react';
import '../../styles/client.css';

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
    <div className="shutdown-overlay phase-end">
      <div className="phase-end-box">
        <div className="phase-end-label">[EMERGENCY LOCKDOWN]</div>
        <h1>FATAL SYSTEM FAILURE</h1>
        <div className="phase-end-status">システム異常・強制遮断 [TERMINATED]</div>
        <div className="phase-end-log">
          <div>TERMINAL ID : [{deviceId}]</div>
          <div>ERROR CODE  : 0xDEAD0066 (ANOMALY)</div>
          <div>STATUS      : CORE DISCONNECTED</div>
          <div>INSTRUCTION : 直ちに現場から退避してください。</div>
        </div>

        <div className="phase-end-note">
          ※ 本端末の操作はロックされています。運営スタッフの指示に従ってください。
        </div>
      </div>
    </div>
  );
};
