'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

/**
 * @file PhaseArea3Video.tsx
 * @description エリア3（モニター室）監視記録アーカイブ再生トリガーUI。
 * 押下時に WebSocket（`video:trigger_play`）をブロードキャストし、
 * 別置大型モニター（`/display/video`）にて記録映像が再生されます。
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
    <div className="phase-area3-video phase-container">
      {/* Title */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #4a148c, #6a1b9a)' }}>
          <span>エリア3: モニター室 </span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          部屋の大型モニターと通信リンクしています。監視記録アーカイブを再生し本工場で過去にあった事件について知りましょう。
        </div>
      </div>

      {/* Trigger Box */}
      <div className="win95-window">
        <div className="win95-titlebar" style={{ background: '#311b92' }}>
          <span>監視記録アーカイブ 再生制御</span>
        </div>
        <div style={{ padding: '18px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>
            別置大型モニターリンク状態: <strong>接続中</strong>
          </div>

          <div
            style={{
              fontSize: '17px',
              fontWeight: 'bold',
              color: triggered ? '#d50000' : '#4a148c',
              marginBottom: '16px',
            }}
          >
            {triggered ? '【監視記録映像 再生中】' : '【監視記録アーカイブ 再生待機】'}
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
            {triggered ? '再生信号送信完了' : '監視記録アーカイブ再生'}
          </button>
        </div>
      </div>

      {/* Logs */}
      <div
        className="win95-inset-dark"
        style={{
          padding: '10px',
          fontSize: '11px',
          color: triggered ? '#ef5350' : '#ba68c8',
          lineHeight: '1.7',
        }}
      >
        <div>[SYSTEM] 大型モニターへ映像再生トリガーを送信します。</div>
        {triggered ? (
          <div>[WARNING] 映像を注視してください。異常が発生した場合は端末の指示に従ってください。</div>
        ) : (
          <div>[INFO] 体験者全員がモニター室に入室したことを確認し、ボタンを押してください。</div>
        )}
      </div>
    </div>
  );
};
