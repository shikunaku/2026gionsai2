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
        <div className="win95-titlebar" style={{ background: '#254b33' }}>
          <span>体験終了</span>
          <span className="phase-init-title-tag">端末 {deviceId}</span>
        </div>
      </div>

      {/* Return Notice Card */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#253d2d' }}>
          <span>端末を返却してください</span>
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
            体験は終了です。
            <br />
            端末を受付スタッフへ返してください。
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
            <div>[LOG] 体験データの保存: 完了</div>
            <div>[SECURITY] 端末の操作: 終了</div>
            <div>[TERMINAL] 返却待ち</div>
          </div>
        </div>
      </div>

      {/* Lock Notice */}
      <div
        className="win95-inset"
        style={{
          padding: '12px',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#555960',
          textAlign: 'center',
          backgroundColor: '#dedbd4',
        }}
      >
        受付で端末を返却してから、ご退場ください。ご参加ありがとうございました。
      </div>

      {/* Reception Staff Reset Action */}
      {onResetToInit && (
        <div className="win95-window" style={{ marginTop: '16px', border: '1px solid #78909c' }}>
          <div className="win95-titlebar" style={{ background: '#37474f' }}>
            <span>[受付・スタッフ専用操作]</span>
          </div>
          <div style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#455a64', marginBottom: '10px' }}>
              次の体験者を案内する前に、写真と進行状況を消去して開始画面に戻します。
            </div>
            <button
              onClick={() => {
                if (window.confirm('写真と進行状況を消去して、開始画面に戻しますか？')) {
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
              端末をリセットして開始画面へ戻す
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
