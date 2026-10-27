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
  panicActive: boolean;
}

export const PhaseMonitorRoom: React.FC<PhaseMonitorRoomProps> = ({
  deviceId,
  arrived,
  onArrive,
  onTriggerVideo,
  onEscapeSuccess,
  videoPlaying,
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
            <span>第⑤フェーズ: モニター室 (移動中)</span>
            <span className="phase-init-title-tag">ID: {deviceId}</span>
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
              奥の「モニター室」へ駆け込んでください！
            </div>
            <div
              className="win95-inset"
              style={{
                padding: '12px',
                fontSize: '12px',
                color: '#333',
                lineHeight: '1.6',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              製造ラインを抜けて「モニター室」へ全員入室後、下の【到着】ボタンを押してください。最終演出（大型プロジェクター映像）が始まります。
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
              モニター室に到着した [最終演出へ]
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
              : 'linear-gradient(90deg, #4a148c, #6a1b9a)',
            color: '#fff',
          }}
        >
          <span>
            {panicActive
              ? '[緊急事態発令] 出口へ逃走せよ！'
              : '第⑤フェーズ: モニター室 - 最終アーカイブ映像'}
          </span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{
            background: panicActive ? '#d50000' : '#311b92',
            color: '#fff',
          }}
        >
          <span>{panicActive ? '【怪異侵入・キャスト突入】' : '【プロジェクター最終上映】'}</span>
        </div>

        <div style={{ padding: '16px', textAlign: 'center' }}>
          {!panicActive ? (
            <div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: videoPlaying ? '#b71c1c' : '#4a148c',
                  marginBottom: '12px',
                }}
              >
                {videoPlaying
                  ? '大型スクリーンにて最終映像を上映中...'
                  : 'モニター室の大型プロジェクターで最終記録を再生してください'}
              </div>

              {!videoPlaying && (
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
                  <span className="inline-block">▶ 最終映像を</span>{' '}
                  <span className="inline-block">再生する</span>
                </button>
              )}

              <div
                className="win95-inset-dark"
                style={{
                  padding: '12px',
                  fontSize: '11px',
                  color: '#ce93d8',
                  lineHeight: '1.7',
                  textAlign: 'left',
                }}
              >
                <div>[STATUS] プロジェクター (/display/video) 映像同期中</div>
                <div>[NOTICE] 映像終盤、現場照明オフおよび異変の発生にご注意ください</div>
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
                出口へ逃げろ！！
                <br />
                扉から脱出してください！
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
                <span className="inline-block">脱出成功</span>{' '}
                <span className="inline-block">(受付へ退避完了) -&gt;</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
