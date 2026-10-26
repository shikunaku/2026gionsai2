'use client';

/**
 * @file ReconnectingModal.tsx
 * @description 通信切断・オフライン検知時に最前面へ表示される再接続待機モーダル。
 * アトラクションのダーク＆インダストリアルな世界観を崩さないパルスアニメーションと、
 * 再試行カウント表示、および手動即時再接続ボタンを提供します。
 */

import React from 'react';

export interface ReconnectingModalProps {
  /** WebSocketが切断中または再試行中かどうか */
  isReconnecting: boolean;
  /** ブラウザのネットワーク接続が物理的にオフラインかどうか */
  isOnline: boolean;
  /** 現在の再試行回数 */
  reconnectAttempts: number;
  /** 手動で即座に再接続をトリガーするコールバック */
  onManualReconnect: () => void;
}

export const ReconnectingModal: React.FC<ReconnectingModalProps> = ({
  isReconnecting,
  isOnline,
  reconnectAttempts,
  onManualReconnect,
}) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // SSR初期描画時、または正常接続中・オンラインなら非表示
  if (!isMounted || (!isReconnecting && isOnline)) {
    return null;
  }

  return (
    <aside
      aria-live="assertive"
      aria-label="通信切断アラート"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(5, 5, 8, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeInModal 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#0f1115',
          border: '2px solid #b32d2e',
          borderRadius: '4px',
          padding: '24px',
          boxShadow: '0 0 30px rgba(179, 45, 46, 0.4), inset 0 0 15px rgba(0, 0, 0, 0.8)',
          color: '#e0e0e0',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          textAlign: 'center',
        }}
      >
        {/* 警告アイコン / パルススピナー */}
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            border: '3px solid #b32d2e',
            borderTopColor: 'transparent',
            animation: 'spinPulse 1s linear infinite',
          }}
        />

        {/* タイトル */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#ff4d4d',
            letterSpacing: '0.1em',
            margin: '0 0 8px',
            textTransform: 'uppercase',
          }}
        >
          {!isOnline ? 'NETWORK OFFLINE' : 'SIGNAL LOST'}
        </h2>

        {/* 状況メッセージ */}
        <p
          style={{
            fontSize: '0.9rem',
            color: '#a0a5ad',
            lineHeight: 1.5,
            margin: '0 0 16px',
          }}
        >
          {!isOnline
            ? '端末のWi-Fi/LAN通信が切断されています。ネットワーク接続を確認してください。'
            : '中央管理サーバーとのリンクが途絶しました。バックグラウンドで自動再接続を試みています...'}
        </p>

        {/* 再試行ステータス */}
        {isOnline && (
          <div
            style={{
              display: 'inline-block',
              backgroundColor: '#1b1d24',
              border: '1px solid #333842',
              borderRadius: '3px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              color: '#f0b429',
              marginBottom: '20px',
            }}
          >
            再試行回数: <span style={{ fontWeight: 'bold' }}>#{reconnectAttempts}</span>
          </div>
        )}

        {/* 今すぐ再接続ボタン */}
        <div>
          <button
            onClick={onManualReconnect}
            style={{
              width: '100%',
              backgroundColor: '#b32d2e',
              color: '#ffffff',
              border: '1px solid #ff6666',
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              borderRadius: '3px',
              transition: 'background-color 0.2s, transform 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            今すぐ再接続を試行
          </button>
        </div>
      </div>

      {/* スピナーキーフレーム定義 */}
      <style jsx>{`
        @keyframes spinPulse {
          0% {
            transform: rotate(0deg);
            box-shadow: 0 0 5px rgba(255, 77, 77, 0.4);
          }
          50% {
            box-shadow: 0 0 18px rgba(255, 77, 77, 0.8);
          }
          100% {
            transform: rotate(360deg);
            box-shadow: 0 0 5px rgba(255, 77, 77, 0.4);
          }
        }
        @keyframes fadeInModal {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </aside>
  );
};
