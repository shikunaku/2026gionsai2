'use client';

import React, { useState } from 'react';
import { requestFullscreenSafe } from '../../lib/fullscreen';
import '../../styles/client.css';

interface PhaseInitProps {
  deviceId: string;
  onDeviceIdChange: (id: string) => void;
  onStart: () => void;
}

export const PhaseInit: React.FC<PhaseInitProps> = ({
  deviceId,
  onDeviceIdChange,
  onStart,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartClick = async () => {
    if (!agreed || isStarting) return;
    setIsStarting(true);

    // 1. Fullscreen request
    await requestFullscreenSafe();

    // 2. Screen WakeLock
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      console.warn('WakeLock request failed:', e);
    }

    // 3. Callback to unlock Audio & emit device ready/start
    onStart();
  };

  return (
    <div className="phase-init phase-container">
      {/* Header Window */}
      <div className="win95-window phase-init-window">
        <div className="win95-titlebar phase-init-titlebar">
          <span className="phase-init-title-text">点検用端末の準備</span>
          <span className="phase-init-title-tag">[開始前]</span>
        </div>
        <div className="phase-init-id-panel">
          <div className="phase-init-id-row">
            <div className="phase-init-id-field">
              <span className="phase-init-id-label">端末番号:</span>
              <input
                type="text"
                value={deviceId}
                maxLength={6}
                onChange={(e) => onDeviceIdChange(e.target.value.toUpperCase())}
                className="win95-inset phase-init-id-input"
              />
            </div>
            <span className="phase-init-id-hint">自動設定済み</span>
          </div>
        </div>
      </div>

      {/* Safety Notice Box */}
      <div className="win95-window phase-init-window phase-init-notice">
        <div className="win95-titlebar phase-init-titlebar-warn">
          <span>体験前の注意</span>
        </div>
        <div className="win95-inset-dark phase-init-rules">
          <p className="phase-init-rules-heading">始める前に確認してください</p>
          <p className="rule">1. 画面とスタッフの案内に沿って進んでください。</p>
          <p className="rule">2. 体験中に大きな音、振動、光の点滅があります。</p>
          <p className="rule">3. 気分が悪くなったときは、すぐにスタッフへお知らせください。</p>
          <p className="rule">4. 周囲と足元に注意して移動してください。</p>
          <div className="phase-init-rules-note">
            <p>※ 体験に合わせて、端末の音・ライト・振動が自動で作動します。</p>
          </div>
        </div>

        {/* Checkbox */}
        <div className="phase-init-agree">
          <label>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>注意事項を確認しました</span>
          </label>
        </div>
      </div>

      {/* Start Button - Positioned directly below the agreement box */}
      <div className="phase-init-start">
        <button
          onClick={handleStartClick}
          disabled={!agreed || isStarting}
          className={`win95-btn phase-start-btn btn-natural-wrap break-keep leading-snug${agreed ? ' agreed' : ''}`}
        >
          {isStarting ? (
            '画面を準備しています...'
          ) : (
            <>
              <span className="inline-block">体験を開始する</span>{' '}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
