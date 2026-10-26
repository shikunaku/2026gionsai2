'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

/**
 * @file PhaseArea3Video.tsx
 * @description エリア3（主電算モニター）動画再生トリガーUI。
 * 押下時に WebSocket（`video:trigger_play`）をブロードキャストし、
 * 別置端末（`/display/video`）にて `public/videos/` 配下の動画（例: `2026-09-11 01-07-05.mp4` または `area3.mp4`）
 * がフルスクリーン再生されます。動画ファイル未配置時はプロシージャル合成シンセサイザー画面へと自動フォールバックします。
 */

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
          <span>モニター室: 主電算モニター機動ギミック</span>
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
        <div>[SYSTEM] モニター室映像端末へ TRIGGER_VIDEO_PLAY をブロードキャストします。</div>
        {triggered && <div>[WARNING] 異常シグナル受信。現場の大型モニターを確認してください。</div>}
      </div>
    </div>
  );
};
