'use client';

import React, { useState, useEffect, useRef } from 'react';
import '../../styles/client.css';

interface PhaseArea2ConveyorProps {
  deviceId: string;
  onConveyorControl: (action: 'forward' | 'reverse' | 'stop' | 'test_run', durationMs?: number) => void;
  onProceedNext: () => void;
  playMotorSound?: () => void;
  playSuccessSound?: () => void;
}

const TEST_DURATION_SECONDS = 6;

export const PhaseArea2Conveyor: React.FC<PhaseArea2ConveyorProps> = ({
  deviceId,
  onConveyorControl,
  onProceedNext,
  playMotorSound,
  playSuccessSound,
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [countdown, setCountdown] = useState<number>(TEST_DURATION_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // コンベア起動テスト開始
  const handleStartTest = () => {
    if (testStatus === 'running' || testStatus === 'completed') return;

    setTestStatus('running');
    setCountdown(TEST_DURATION_SECONDS);

    // サーバーへ起動信号送信 (6秒間リレー駆動)
    onConveyorControl('test_run', TEST_DURATION_SECONDS * 1000);

    if (playMotorSound) {
      playMotorSound();
    }
  };

  // カウントダウンと自動完了遷移
  useEffect(() => {
    if (testStatus === 'running') {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTestStatus('completed');
            if (playSuccessSound) {
              playSuccessSound();
            }
            if ('vibrate' in navigator) {
              navigator.vibrate([100, 50, 150]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [testStatus, playSuccessSound]);

  return (
    <div className="phase-area2-conveyor phase-container">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #1b5e20, #2e7d32)' }}>
          <span>第零製造ライン: 搬送コンベア起動テスト</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          地下製造ラインの主要搬送コンベアの動作点検を実施してください。
        </div>
      </div>

      {/* Main Test Console */}
      <div className="win95-window">
        <div className={`win95-titlebar ${testStatus === 'running' ? 'zone2-titlebar-conveyor on' : ''}`}>
          <span>[EQ-CV01] 搬送コンベア点検</span>
          <span>
            {testStatus === 'idle' && '[点検待機中]'}
            {testStatus === 'running' && `[点検稼働中 - 残り ${countdown}秒]`}
            {testStatus === 'completed' && '[点検完了]'}
          </span>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div>動力制御: <strong>ESP32 GPIO 23 (Relay 1)</strong></div>
              <div>試験モード: <strong>定格稼働点検 (自動計測)</strong></div>
            </div>
            <div
              className={`zone2-led conveyor ${testStatus === 'running' ? 'on' : ''}`}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor:
                  testStatus === 'running'
                    ? '#ff9800'
                    : testStatus === 'completed'
                    ? '#4caf50'
                    : '#757575',
                boxShadow:
                  testStatus === 'running'
                    ? '0 0 12px #ff9800'
                    : testStatus === 'completed'
                    ? '0 0 12px #4caf50'
                    : 'none',
              }}
            />
          </div>

          {/* Test Status Visual / Button */}
          {testStatus === 'idle' && (
            <div>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '12px', textAlign: 'center' }}>
                コンベア周辺の安全を確認し、起動ボタンを押してください。
              </div>
              <button
                onClick={handleStartTest}
                className="win95-btn"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  backgroundColor: '#2e7d32',
                  color: '#ffffff',
                  letterSpacing: '1px',
                }}
              >
                ▲ コンベア起動
              </button>
            </div>
          )}

          {testStatus === 'running' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#e65100',
                  marginBottom: '10px',
                }}
              >
                コンベア点検稼働中... 残り {countdown} 秒
              </div>

              {/* Progress bar */}
              <div
                className="win95-inset"
                style={{
                  width: '100%',
                  height: '24px',
                  backgroundColor: '#e0ded8',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${((TEST_DURATION_SECONDS - countdown) / TEST_DURATION_SECONDS) * 100}%`,
                    backgroundColor: '#ff9800',
                    transition: 'width 1s linear',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: '#666' }}>
                ※ モーター回転数およびベルト駆動を自動点検中
              </div>
            </div>
          )}

          {testStatus === 'completed' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 'bold',
                  color: '#2e7d32',
                  marginBottom: '8px',
                }}
              >
                正常動作確認完了
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1565c0',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                エリア3（モニター室）へ移動してください。
              </div>
              <div
                className="win95-inset-dark"
                style={{
                  padding: '10px',
                  fontSize: '11px',
                  color: '#a5d6a7',
                  textAlign: 'left',
                  lineHeight: '1.7',
                }}
              >
                <div>[STATUS] 搬送コンベア駆動点検: 合格 (自動停止完了)</div>
                <div>[INSTRUCTION] 現地へ到着したら端末の指示に従ってください。</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* When completed, show Advance to Area 3 */}
      {testStatus === 'completed' && (
        <div style={{ width: '100%', flexShrink: 0 }}>
          <button
            onClick={onProceedNext}
            className="win95-btn"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: '#1565c0',
              color: '#ffffff',
            }}
          >
            エリア3: モニター室へ進む -&gt;
          </button>
        </div>
      )}
    </div>
  );
};
