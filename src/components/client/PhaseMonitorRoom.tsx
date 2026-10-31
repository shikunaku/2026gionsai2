'use client';

import React, { useState } from 'react';
import '../../styles/client.css';

interface PhaseMonitorRoomProps {
  deviceId: string;
  arrived: boolean;
  onArrive: () => void;
  onTriggerVideo: () => void;
  onEscapeSuccess: () => void;
  videoPlaying: boolean;
  videoEnded?: boolean;
  panicActive: boolean;
}

export const PhaseMonitorRoom: React.FC<PhaseMonitorRoomProps> = ({
  deviceId,
  arrived,
  onArrive,
  onTriggerVideo,
  onEscapeSuccess,
  videoPlaying,
  videoEnded = false,
  panicActive,
}) => {
  // 1. 到着前: 到着ボタン
  if (!arrived) {
    return (
      <div className="phase-container">
        <div className="win95-window">
          <div
            className="win95-titlebar"
            style={{ background: 'linear-gradient(90deg, #4a148c, #6a1b9a)' }}
          >
            <span>モニター室へ移動</span>
            <span className="phase-init-title-tag">端末 {deviceId}</span>
          </div>
          <div style={{ padding: '18px 16px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#4a148c',
                lineHeight: '1.6',
                marginBottom: '12px',
              }}
            >
              モニター室へ逃げてください！
            </div>
            <div
              className="win95-inset"
              style={{
                padding: '12px',
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.6',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              全員がモニター室に入ったら、下のボタンを押してください。スクリーンに映像が流れます。
            </div>

            <button
              onClick={onArrive}
              className="win95-btn"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#6a1b9a',
                color: '#ffffff',
                boxShadow: '0 0 14px rgba(106, 27, 154, 0.5)',
              }}
            >
              モニター室に到着した
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 到着後: 最終映像再生 ＆ クライマックス脱出
  return (
    <div className="phase-container">
      {/* Title */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{
            background: panicActive
              ? 'linear-gradient(90deg, #b71c1c, #d50000)'
              : videoEnded
              ? 'linear-gradient(90deg, #0284c7, #0369a1)'
              : 'linear-gradient(90deg, #4a148c, #6a1b9a)',
            color: '#fff',
          }}
        >
          <span>
            {panicActive
              ? '[緊急] 会場の外へ逃げてください！'
              : videoEnded
              ? 'モニター室 - スクリーンを確認'
              : 'モニター室 - 最終映像'}
          </span>
          <span className="phase-init-title-tag">端末 {deviceId}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{
            background: panicActive ? '#d50000' : videoEnded ? '#0369a1' : '#311b92',
            color: '#fff',
          }}
        >
          <span>
            {panicActive
              ? '【怪異侵入・キャスト突入】'
              : videoEnded
              ? '【スクリーンに映像を表示中】'
              : '【最終映像を再生】'}
          </span>
        </div>

        <div style={{ padding: '16px', textAlign: 'center' }}>
          {!panicActive ? (
            <div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: videoEnded ? '#0284c7' : videoPlaying ? '#b71c1c' : '#4a148c',
                  marginBottom: '12px',
                  lineHeight: '1.5',
                }}
              >
                {videoEnded
                  ? '大型スクリーンに映像が流れています。スクリーンをご覧ください。'
                  : videoPlaying
                  ? '大型スクリーンで最終映像を上映しています。'
                  : '準備ができたら、最終映像を再生してください。'}
              </div>

              {!videoPlaying && !videoEnded && (
                <button
                  onClick={onTriggerVideo}
                  className="win95-btn btn-natural-wrap break-keep leading-snug"
                  style={{
                    width: '100%',
                    padding: '16px 12px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    backgroundColor: '#6a1b9a',
                    color: '#ffffff',
                    marginBottom: '14px',
                  }}
                >
                  <span className="inline-block">最終映像を再生する</span>
                </button>
              )}

              <div
                className="win95-inset-dark"
                style={{
                  padding: '12px',
                  fontSize: '11px',
                  color: videoEnded ? '#7dd3fc' : '#ce93d8',
                  lineHeight: '1.7',
                  textAlign: 'left',
                }}
              >
                <div>
                  [STATUS]{' '}
                  {videoEnded
                    ? 'スクリーンに映像を表示中'
                    : 'スクリーンの映像を準備中'}
                </div>
                <div>
                  [NOTICE]{' '}
                  {videoEnded
                    ? '次の案内が表示されるまで、その場でお待ちください'
                    : '映像が終わるまでスクリーンをご覧ください'}
                </div>
              </div>
            </div>
          ) : (
            /* クライマックス・キャスト飛び出し・パニック脱出 */
            <div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  color: '#d50000',
                  marginBottom: '12px',
                  lineHeight: '1.4',
                  animation: 'pulse 0.6s infinite alternate',
                }}
              >
                会場の外へ逃げてください！
                <br />
                近くの出口から外へ出てください。
              </div>

              <div
                className="win95-inset-dark"
                style={{
                  padding: '12px',
                  fontSize: '12px',
                  color: '#ff8a80',
                  backgroundColor: '#1a0000',
                  border: '1px solid #d50000',
                  lineHeight: '1.8',
                  marginBottom: '18px',
                  textAlign: 'left',
                }}
              >
                <div>[WARNING] 施設照明強制遮断・キャスト接近</div>
                <div>[ESCAPE] 直ちに非常口から会場外へ脱出してください</div>
                <div>[RETURN] 脱出完了後、受付にて端末を返却してください</div>
              </div>

              <button
                onClick={onEscapeSuccess}
                className="win95-btn btn-natural-wrap break-keep leading-snug"
                style={{
                  width: '100%',
                  padding: '18px 12px',
                  fontSize: '17px',
                  fontWeight: 'bold',
                  backgroundColor: '#d50000',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 20px rgba(213, 0, 0, 0.8)',
                }}
              >
                <span className="inline-block">会場の外へ出た</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
