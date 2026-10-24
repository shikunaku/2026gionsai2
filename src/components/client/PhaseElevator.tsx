'use client';

import React from 'react';
import '../../styles/elevator-display.css';

interface PhaseElevatorProps {
  deviceId: string;
}

export const PhaseElevator: React.FC<PhaseElevatorProps> = ({ deviceId }) => {
  return (
    <div className="phase-elevator">
      {/* Title window */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1f2429, #37474f)' }}>
          <span>[フェーズ 3] エレベータ移動</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          安全装置作動中。現場の運行指示に従ってください。
        </div>
      </div>

      {/* Creepy Instruction & Moving Notice Card */}
      <div className="win95-window" style={{ marginTop: '10px' }}>
        <div className="win95-titlebar" style={{ background: '#263238' }}>
          <span>運行指示アナウンス</span>
        </div>
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 'bold',
              color: '#d32f2f',
              lineHeight: '1.7',
              letterSpacing: '1px',
              marginBottom: '16px',
            }}
          >
            エレベータに乗って
            <br />
            地下（エリア2）に移動してください。
          </div>

          <div
            className="win95-inset-dark"
            style={{
              padding: '12px',
              fontSize: '11px',
              color: '#81c784',
              lineHeight: '1.8',
              textAlign: 'left',
            }}
          >
            <div>[STATUS] 昇降ケージ遠隔制御モード（搭乗者操作不要）</div>
            <div>[SECTOR] 地上1階 ➔ 地下1階 第零製造区画</div>
            <div>[CAUTION] 移動中の急な揺れ・照明の明滅にご注意ください。</div>
          </div>
        </div>
      </div>

      {/* Non-interactive Guidance Notice */}
      <div
        className="win95-inset"
        style={{
          marginTop: '12px',
          padding: '10px',
          fontSize: '11px',
          color: '#5f6368',
          textAlign: 'center',
          backgroundColor: '#e0ded8',
        }}
      >
        ※ 昇降機の起動およびエリア2への移行は、運行管理システムにより遠隔で行われます。手元の端末操作は不要です。
      </div>
    </div>
  );
};
