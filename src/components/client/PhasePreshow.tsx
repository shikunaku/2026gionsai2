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
          style={{ background: 'linear-gradient(90deg, #000080, #1084d0)' }}
        >
          <span>第①フェーズ: プレショー (待機ホール)</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '10px', fontSize: '12px', color: '#27292e', lineHeight: 1.6 }}>
          待機ホールにて正面スクリーン上映の「保安点検ガイダンス映像」を注視してください。
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
              ? '[指示受信] 品質管理室へ移動'
              : !hasArrivedHall
              ? '[待機位置へ移動中] 到着確認'
              : '[上映中] スクリーン映像注視'}
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
                  待機ホールの正面スクリーン前へ
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
                  <div>[GUIDE] 待機ホールの指定枠内に整列してください</div>
                  <div>[NOTICE] 位置に到着したら下の到着ボタンを押してください</div>
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
                  <span className="inline-block">プレショー待機位置に</span>{' '}
                  <span className="inline-block">到着した [確認]</span>
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

                <div style={{ fontSize: '13px', color: '#37474f', marginBottom: '14px', lineHeight: '1.6' }}>
                  スクリーンにて保安点検ガイダンス映像を上映中です。
                  <br />
                  （※本端末上では動画再生は行われません）
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
                  <div>[STATUS] 正面スクリーン上映待機中</div>
                  <div>[SIGNAL] 映像終了と同時に本端末へ点検開始合図が届きます</div>
                  <div>[CAUTION] バイブレーションおよび通知音にご注意ください</div>
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
                点検を開始します。
                <br />
                品質管理室へ向かってください。
              </div>

              <div
                className="win95-inset"
                style={{
                  padding: '12px',
                  fontSize: '12px',
                  color: '#2e7d32',
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #81c784',
                  marginBottom: '16px',
                  lineHeight: '1.6',
                }}
              >
                ガイダンス映像が終了しました。
                <br />
                通路を進み、1F「品質管理室」に到着したら下の【到着】ボタンを押してください。
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
            <span className="inline-block">品質管理室に到着した</span>{' '}
            <span className="inline-block">[到着確認] -&gt;</span>
          </button>
        </div>
      )}
    </div>
  );
};
