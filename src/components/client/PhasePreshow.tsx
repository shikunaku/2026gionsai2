'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

interface PhasePreshowProps {
  deviceId: string;
  onArriveQualityControl: () => void;
  preshowEnded: boolean;
  onConfirmPreshowArrival?: () => void;
}

export const PhasePreshow: React.FC<PhasePreshowProps> = ({
  deviceId,
  onArriveQualityControl,
  preshowEnded,
  onConfirmPreshowArrival,
}) => {
  // プレショー待機場所への到着確認ステート（到着前 -> 到着後ガイダンス待機）
  const [hasArrivedHall, setHasArrivedHall] = useState<boolean>(false);

  const handleArrivalClick = () => {
    setHasArrivedHall(true);
    if (onConfirmPreshowArrival) {
      onConfirmPreshowArrival();
    }
  };

  return (
    <div className="phase-preshow phase-container">
      {/* Title Window */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{ background: '#1f4f7a' }}
        >
          <span>待機ホール</span>
          <span className="phase-init-title-tag">端末 {deviceId}</span>
        </div>
        <div style={{ padding: '10px', fontSize: '14px', color: '#27292e', lineHeight: 1.6 }}>
          正面スクリーンで案内映像を上映します。
        </div>
      </div>

      {/* Main Instruction Status Box */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{ background: preshowEnded ? '#1b5e20' : '#37474f' }}
        >
          <span>
            {preshowEnded
              ? '次の場所へ移動'
              : !hasArrivedHall
              ? '待機ホールへ移動'
              : '案内映像を上映中'}
          </span>
        </div>
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          {/* STEP 1: プレショー終了前 */}
          {!preshowEnded ? (
            !hasArrivedHall ? (
              /* 到着待ち状態 */
              <div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0d47a1',
                    marginBottom: '12px',
                    lineHeight: '1.6',
                  }}
                >
                  正面スクリーンの前へ
                  <br />
                  移動してください。
                </div>

                <div
                  className="win95-inset-dark"
                  style={{
                    padding: '12px',
                    fontSize: '11px',
                    color: '#81d4fa',
                    textAlign: 'left',
                    lineHeight: '1.8',
                    marginBottom: '18px',
                  }}
                >
                  <div>[GUIDE] 床の案内に沿って並んでください</div>
                  <div>[NOTICE] 到着したら下のボタンを押してください</div>
                </div>

                <button
                  onClick={handleArrivalClick}
                  className="win95-btn btn-natural-wrap break-keep leading-snug"
                  style={{
                    width: '100%',
                    padding: '16px 12px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    backgroundColor: '#0d47a1',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(13, 71, 161, 0.4)',
                  }}
                >
                  <span className="inline-block">スクリーン前に到着した</span>
                </button>
              </div>
            ) : (
              /* 到着確認後：正面スクリーンの動画視聴待機 */
              <div>
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 'bold',
                    color: '#0d47a1',
                    marginBottom: '12px',
                    lineHeight: '1.6',
                  }}
                >
                  正面スクリーンをご覧ください
                </div>

                <div style={{ fontSize: '14px', color: '#37474f', marginBottom: '14px', lineHeight: '1.6' }}>
                  案内映像を上映しています。
                  <br />
                  この端末ではなく、正面スクリーンをご覧ください。
                </div>

                <div
                  className="win95-inset-dark"
                  style={{
                    padding: '12px',
                    fontSize: '11px',
                    color: '#81d4fa',
                    textAlign: 'left',
                    lineHeight: '1.8',
                  }}
                >
                  <div>[STATUS] 案内映像を上映中</div>
                  <div>[SIGNAL] 映像が終わると次の案内を表示します</div>
                  <div>[CAUTION] 端末の振動と通知音にご注意ください</div>
                </div>
              </div>
            )
          ) : (
            /* STEP 2: プレショー終了後 -> 品質管理室への移動指示 */
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1b5e20',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                次の点検を始めます。
                <br />
                品質管理室へ向かってください。
              </div>

              <div
                className="win95-inset"
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  color: '#2e7d32',
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #81c784',
                  marginBottom: '16px',
                  lineHeight: '1.6',
                }}
              >
                案内映像が終わりました。
                <br />
                1F「品質管理室」に着いたら、下のボタンを押してください。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Arrival Button (Shown when preshow has ended) */}
      {preshowEnded && (
        <div style={{ width: '100%', flexShrink: 0 }}>
          <button
            onClick={onArriveQualityControl}
            className="win95-btn btn-natural-wrap break-keep leading-snug"
            style={{
              width: '100%',
              padding: '16px 12px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: '#1b5e20',
              color: '#ffffff',
              boxShadow: '0 0 14px rgba(27, 94, 32, 0.5)',
            }}
          >
            <span className="inline-block">品質管理室に到着した</span>
          </button>
        </div>
      )}
    </div>
  );
};
