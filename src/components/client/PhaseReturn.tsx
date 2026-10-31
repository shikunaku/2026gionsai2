'use client';

import React from 'react';
import '../../styles/client.css';

interface PhaseReturnProps {
  deviceId: string;
  onResetToInit?: () => void;
}

export const PhaseReturn: React.FC<PhaseReturnProps> = ({ deviceId, onResetToInit }) => {
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

      {/* Reception Staff Reset Action */}
      {onResetToInit && (
        <div className="win95-window" style={{ marginTop: '16px', border: '1px solid #78909c' }}>
          <div className="win95-titlebar" style={{ background: '#37474f' }}>
            <span>[受付・スタッフ専用操作]</span>
          </div>
          <div style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#455a64', marginBottom: '10px' }}>
              次の体験者を案内する前に端末を完全初期化し、同意画面に戻します。
            </div>
            <button
              onClick={() => {
                if (window.confirm('端末の撮影写真とステータスを全初期化し、同意画面に戻しますか？')) {
                  onResetToInit();
                }
              }}
              className="win95-btn btn-natural-wrap break-keep"
              style={{
                width: '100%',
                padding: '14px 12px',
                fontSize: '15px',
                fontWeight: 'bold',
                backgroundColor: '#1565c0',
                color: '#ffffff',
                boxShadow: '0 0 10px rgba(21, 101, 192, 0.4)',
              }}
            >
              端末を初期化して同意画面へ戻す
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
