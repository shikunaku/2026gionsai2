'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

interface PhaseArea3VideoProps {
  deviceId: string;
  onTriggerVideo: () => void;
  playHorrorSound?: () => void;
}

export const PhaseArea3Video: React.FC<PhaseArea3VideoProps> = ({
  deviceId,
  onTriggerVideo,
  playHorrorSound,
}) => {
  const [triggered, setTriggered] = useState<boolean>(false);

  const handleTrigger = () => {
    if (triggered) return;
    setTriggered(true);
    if (playHorrorSound) playHorrorSound();
    onTriggerVideo();
  };

  return (
    <div className="phase-area3-video">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #4a148c, #6a1b9a)' }}>
          <span>[フェーズ 5] エリア3: 主電算モニター機動ギミック</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          部屋の大型モニター（別端末）と通信リンクしています。起動認証を行ってください。
        </div>
      </div>

      {/* Trigger Box */}
      <div className="win95-window" style={{ marginTop: '8px' }}>
        <div className="win95-titlebar" style={{ background: '#311b92' }}>
          <span>主電算装置 認証ステータス</span>
        </div>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>
            別置大型モニターリンク状態: <strong>READY</strong>
          </div>

          <div
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: triggered ? '#d50000' : '#4a148c',
              marginBottom: '16px',
            }}
          >
            {triggered ? '【緊急映像再生信号 送信済】' : '【認証キー入力待機中】'}
          </div>

          <button
            onClick={handleTrigger}
            disabled={triggered}
            className="win95-btn"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: triggered ? '#757575' : '#b71c1c',
              color: '#ffffff',
              letterSpacing: '1px',
              boxShadow: triggered ? 'none' : '0 0 15px rgba(183, 28, 28, 0.4)',
            }}
          >
            {triggered ? '映像再生信号 送信完了 [TRANSMITTED]' : '主電算映像を緊急再生 [OVERRIDE PLAY]'}
          </button>
        </div>
      </div>

      {/* Logs */}
      <div
        className="win95-inset-dark"
        style={{
          marginTop: '8px',
          padding: '8px',
          fontSize: '11px',
          color: triggered ? '#ef5350' : '#ba68c8',
        }}
      >
        <div>[SYSTEM] エリア3映像再生用別端末へ TRIGGER_VIDEO_PLAY をブロードキャストします。</div>
        {triggered && <div>[WARNING] 異常シグナル受信。現場の大型モニターを確認してください。</div>}
      </div>
    </div>
  );
};
