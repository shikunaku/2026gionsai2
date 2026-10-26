'use client';

import React, { useEffect, useRef } from 'react';
import '../../styles/client.css';

interface PhasePanicEscapeProps {
  deviceId: string;
  onProceedReturn?: () => void;
  triggerEmergencySound?: () => void;
  triggerFastTorch?: () => void;
}

export const PhasePanicEscape: React.FC<PhasePanicEscapeProps> = ({
  deviceId,
  onProceedReturn,
  triggerEmergencySound,
  triggerFastTorch,
}) => {
  const soundFiredRef = useRef<boolean>(false);

  // パニック突入時に大音量アラーム＆激速点滅＆バイブレーションを起動
  useEffect(() => {
    if (!soundFiredRef.current) {
      soundFiredRef.current = true;
      if (triggerEmergencySound) triggerEmergencySound();
      if (triggerFastTorch) triggerFastTorch();

      if ('vibrate' in navigator) {
        // 激しい心拍・パニック振動パターン
        try {
          navigator.vibrate([200, 100, 200, 100, 400, 150, 400, 200]);
        } catch (e) {
          // ignore
        }
      }
    }
  }, [triggerEmergencySound, triggerFastTorch]);

  return (
    <div className="phase-panic-escape phase-container">
      {/* Red flashing critical alert header */}
      <div
        className="win95-window"
        style={{
          border: '3px solid #d50000',
          backgroundColor: '#b71c1c',
          boxShadow: '0 0 25px rgba(213, 0, 0, 0.8)',
          animation: 'panicPulse 0.8s infinite alternate',
        }}
      >
        <div
          className="win95-titlebar"
          style={{
            background: 'linear-gradient(90deg, #b71c1c, #d50000)',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          <span>施設非常警報発令</span>
        </div>

        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#ffffff' }}>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '900',
              letterSpacing: '2px',
              lineHeight: '1.4',
              color: '#ffffff',
              textShadow: '0 0 10px #ff1744, 0 0 20px #d50000',
              marginBottom: '16px',
            }}
          >
            緊急事態発生
            <br />
            直ちに退避せよ！
          </div>

          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ffcdd2',
              marginBottom: '16px',
              lineHeight: '1.7',
            }}
          >
            モニター室周辺で深刻な異常現象を検知しました。
            <br />
            すべての点検作業を即時中止し、
            <br />
            <strong style={{ color: '#ffffff', textDecoration: 'underline' }}>
              地上非常口（受付）へ脱出
            </strong>
            してください。
          </div>

          <div
            className="win95-inset-dark"
            style={{
              padding: '12px',
              fontSize: '12px',
              color: '#ff8a80',
              textAlign: 'left',
              lineHeight: '1.8',
              backgroundColor: '#1a0000',
              border: '1px solid #d50000',
            }}
          >
            <div>[ALARM] CODE-RED 非常脱出プロトコル発動</div>
            <div>[LIGHT] 背面トーチフラッシュ緊急ストロボ点滅中</div>
            <div>[SECTOR] モニター室 ➔ 地下通路 ➔ 地上受付返却所</div>
          </div>
        </div>
      </div>

      {/* Escape Action Button */}
      {onProceedReturn && (
        <div style={{ width: '100%', flexShrink: 0 }}>
          <button
            onClick={onProceedReturn}
            className="win95-btn"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#d50000',
              color: '#ffffff',
              letterSpacing: '1px',
              border: '2px solid #ffffff',
              boxShadow: '0 0 15px rgba(255, 23, 68, 0.7)',
            }}
          >
            非常脱出完了 (受付返却所へ到着) -&gt;
          </button>
        </div>
      )}

      {/* Embedded CSS for flashing panic effect */}
      <style jsx>{`
        @keyframes panicPulse {
          0% {
            filter: brightness(1) drop-shadow(0 0 5px rgba(255, 0, 0, 0.5));
          }
          100% {
            filter: brightness(1.25) drop-shadow(0 0 25px rgba(255, 0, 0, 0.9));
          }
        }
        .phase-panic-escape {
          animation: panicScreenFlash 0.6s infinite alternate;
        }
        @keyframes panicScreenFlash {
          0% {
            background-color: transparent;
          }
          100% {
            background-color: rgba(213, 0, 0, 0.15);
          }
        }
      `}</style>
    </div>
  );
};
