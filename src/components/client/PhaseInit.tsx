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
          <span className="phase-init-title-text">[端末OS v3.84] 保守端末初期設定</span>
          <span className="phase-init-title-tag">[待機]</span>
        </div>
        <div className="phase-init-id-panel">
          <div className="phase-init-id-row">
            <div className="phase-init-id-field">
              <span className="phase-init-id-label">端末ID:</span>
              <input
                type="text"
                value={deviceId}
                maxLength={6}
                onChange={(e) => onDeviceIdChange(e.target.value.toUpperCase())}
                className="win95-inset phase-init-id-input"
              />
            </div>
            <span className="phase-init-id-hint">自動割当済</span>
          </div>
        </div>
      </div>

      {/* Safety Notice Box */}
      <div className="win95-window phase-init-window phase-init-notice">
        <div className="win95-titlebar phase-init-titlebar-warn">
          <span>[重要規定] 巡視保守業務 安全規定</span>
        </div>
        <div className="win95-inset-dark phase-init-rules">
          <p className="phase-init-rules-heading">[保安注意事項]</p>
          <p className="rule">1. 本端末は第零製造区画の巡視保守用専用端末です。</p>
          <p className="rule">2. 各エリアで指示された点検内容に従ってください。</p>
          <p className="rule">3. 異常振動・異音・照明明滅の可能性があります。</p>
          <p className="rule">4. 業務中は画面から目を離さず、必ず管理者の指示に従ってください。</p>
          <div className="phase-init-rules-note">
            <p>※ 業務に伴い、端末の音声出力・背面ライト・画面振動が自動連動します。</p>
            <p>※ なお、点検業務中における貴殿の損失に関しては負いかねますのでご了承ください。</p>
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
            <span>上記安全規定に同意する</span>
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
            'システム初期化中...'
          ) : (
            <>
              <span className="inline-block">同意して点検を開始</span>{' '}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
