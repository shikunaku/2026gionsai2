'use client';

import React, { useState } from 'react';

export type DimmerLevel = 'normal' | 'dim' | 'ultra';

interface ScreenDimmerOverlayProps {
  initialLevel?: DimmerLevel;
  wakeLockActive?: boolean;
}

export function ScreenDimmerOverlay({
  initialLevel = 'normal',
  wakeLockActive = false,
}: ScreenDimmerOverlayProps) {
  const [level, setLevel] = useState<DimmerLevel>(initialLevel);
  const [showControls, setShowControls] = useState<boolean>(true);

  // 不透明度マッピング
  const opacityMap: Record<DimmerLevel, number> = {
    normal: 0,
    dim: 0.65,
    ultra: 0.92,
  };

  const currentOpacity = opacityMap[level];

  return (
    <>
      {/* 画面調光用ブラックオーバーレイ */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000000',
          opacity: currentOpacity,
          pointerEvents: 'none',
          zIndex: 9990,
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* 調光操作 & スリープ防止ステータス バー（オーバーレイより前面） */}
      <div
        style={{
          position: 'fixed',
          bottom: '8px',
          left: '8px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'monospace',
          fontSize: '11px',
        }}
      >
        {/* 開閉トグルボタン */}
        <button
          type="button"
          onClick={() => setShowControls(!showControls)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '3px',
            padding: '3px 7px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="調光コントロールの表示切替"
        >
          {showControls ? '[-]' : '[調光/常時]'}
        </button>

        {showControls && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '3px 8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {/* スリープ防止ステータス */}
            <span
              style={{
                fontSize: '10px',
                fontWeight: 'bold',
                color: wakeLockActive ? '#4ade80' : '#94a3b8',
                letterSpacing: '0.5px',
              }}
            >
              {wakeLockActive ? '[WAKE LOCK: ACTIVE]' : '[WAKE LOCK: OFF]'}
            </span>

            <span style={{ color: '#475569' }}>|</span>

            {/* 調光ボタン群 */}
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>調光:</span>
            <button
              type="button"
              onClick={() => setLevel('normal')}
              style={{
                backgroundColor: level === 'normal' ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                color: level === 'normal' ? '#ffffff' : '#94a3b8',
                border: '1px solid #475569',
                borderRadius: '2px',
                padding: '2px 5px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: level === 'normal' ? 'bold' : 'normal',
              }}
            >
              通常
            </button>
            <button
              type="button"
              onClick={() => setLevel('dim')}
              style={{
                backgroundColor: level === 'dim' ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                color: level === 'dim' ? '#ffffff' : '#94a3b8',
                border: '1px solid #475569',
                borderRadius: '2px',
                padding: '2px 5px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: level === 'dim' ? 'bold' : 'normal',
              }}
            >
              暗 (減光)
            </button>
            <button
              type="button"
              onClick={() => setLevel('ultra')}
              style={{
                backgroundColor: level === 'ultra' ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                color: level === 'ultra' ? '#ffffff' : '#94a3b8',
                border: '1px solid #475569',
                borderRadius: '2px',
                padding: '2px 5px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: level === 'ultra' ? 'bold' : 'normal',
              }}
            >
              超暗 (演出用)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
