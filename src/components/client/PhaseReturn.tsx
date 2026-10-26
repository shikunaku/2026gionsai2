'use client';

import React from 'react';
import '../../styles/client.css';

interface PhaseReturnProps {
  deviceId: string;
}

export const PhaseReturn: React.FC<PhaseReturnProps> = ({ deviceId }) => {
  return (
    <div className="phase-return phase-container">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1b3a27, #2e5b3e)' }}>
          <span>[業務完了] 巡視保守業務 終了</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
      </div>

      {/* Return Notice Card */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#253d2d' }}>
          <span>端末返却案内</span>
        </div>
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1b5e20',
              lineHeight: '1.8',
              letterSpacing: '1px',
              marginBottom: '16px',
            }}
          >
            点検業務お疲れさまでした。
            <br />
            端末を所定の位置にお戻しください。
          </div>

          <div
            className="win95-inset-dark"
            style={{
              padding: '12px',
              fontSize: '11px',
              color: '#a5d6a7',
              lineHeight: '1.8',
              textAlign: 'left',
            }}
          >
            <div>[LOG] 巡回ログ同期: 完了</div>
            <div>[SECURITY] 機器操作権限: 自動失効</div>
            <div>[TERMINAL] 端末ロック: 施錠済</div>
          </div>
        </div>
      </div>

      {/* Lock Notice */}
      <div
        className="win95-inset"
        style={{
          padding: '12px',
          fontSize: '11px',
          color: '#555960',
          textAlign: 'center',
          backgroundColor: '#dedbd4',
        }}
      >
        ※ 本端末の点検操作はすべて終了しロックされています。所定の位置に端末を返却後ご退室お願いいたします。最後まで点検業務お疲れさまでした。
      </div>
    </div>
  );
};
