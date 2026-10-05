'use client';

import React from 'react';
import Link from 'next/link';
import { FullscreenButton } from '../components/common/FullscreenButton';

export default function PortalPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '20px',
        backgroundColor: '#1f2228',
        color: '#d1d4db',
      }}
    >
      <div className="win95-window" style={{ maxWidth: '680px', width: '100%' }}>
        <div className="win95-titlebar">
          <span>[SYSTEM] 工場保守演出統合システム ポータル</span>
          <FullscreenButton style={{ padding: '0 6px', fontSize: '11px' }} />
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <h1 style={{ fontSize: '18px', color: '#2c3545', marginBottom: '6px', letterSpacing: '0.5px' }}>
              第零製造所 設備点検・演出統合コンソール
            </h1>
            <p style={{ fontSize: '12px', color: '#555861' }}>
              Next.js 14+ App Router & WebSocket (Socket.io) リアルタイム演出基盤
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {/* PDA Client Card */}
            <div
              className="win95-window"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: '#d8d5ce',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2d4b73', marginBottom: '6px' }}>
                  [端末] 参加者用 PDA 端末
                </div>
                <div style={{ fontSize: '11px', color: '#3d4048', lineHeight: 1.5, marginBottom: '12px' }}>
                  現場巡回保守員向け画面。写真撮影・機器操作・フラッシュライト・プロシージャル怪異音響を搭載。
                </div>
              </div>
              <Link href="/client" style={{ textDecoration: 'none' }}>
                <button
                  className="win95-btn"
                  style={{
                    width: '100%',
                    height: '40px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: '#3b5a80',
                    color: '#f0f3f8',
                  }}
                >
                  PDA 端末を起動 (/client) -&gt;
                </button>
              </Link>
            </div>

            {/* Admin Console Card */}
            <div
              className="win95-window"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: '#d8d5ce',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6e3535', marginBottom: '6px' }}>
                  [管理] 集中管理コンソール
                </div>
                <div style={{ fontSize: '11px', color: '#3d4048', lineHeight: 1.5, marginBottom: '12px' }}>
                  運営スタッフ向け3カラム画面。端末監視・点検写真合否審査・グリッチ/音響/トーチ遠隔制御。
                </div>
              </div>
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <button
                  className="win95-btn"
                  style={{
                    width: '100%',
                    height: '40px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: '#6e3535',
                    color: '#f8f0f0',
                  }}
                >
                  管理コンソールを起動 (/admin) -&gt;
                </button>
              </Link>
            </div>

            {/* Equipment Grid Card */}
            <div
              className="win95-window"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: '#d8d5ce',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2d5b3d', marginBottom: '6px' }}>
                  [機材] 機材演出制御盤
                </div>
                <div style={{ fontSize: '11px', color: '#3d4048', lineHeight: 1.5, marginBottom: '12px' }}>
                  物理設備（ESP32リレー/サーボ/非常灯/換気ファン）の登録・削除・永続化と即時手動制御。
                </div>
              </div>
              <Link href="/equipment" style={{ textDecoration: 'none' }}>
                <button
                  className="win95-btn"
                  style={{
                    width: '100%',
                    height: '40px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: '#2d5b3d',
                    color: '#eff8f2',
                  }}
                >
                  機材制御盤を起動 (/equipment) -&gt;
                </button>
              </Link>
            </div>
          </div>

          <div
            className="win95-inset-dark"
            style={{ marginTop: '18px', padding: '10px', fontSize: '11px', lineHeight: 1.6 }}
          >
            <div>[STATUS] Next.js 14 App Router + Realtime WebSocket Ready.</div>
            <div>[NODE_ENV] {process.env.NODE_ENV || 'development'}</div>
            <div>[NETWORK] 全画面は単一Socket.ioサーバーと自動双方向同期します。</div>
          </div>
        </div>

        <div className="win95-statusbar">
          <div className="win95-statusbar-item" style={{ flex: 1 }}>
            文化祭・工場点検ホラーアトラクションシステム 2026
          </div>
          <div className="win95-statusbar-item">v2.0-NEXT</div>
        </div>
      </div>
    </div>
  );
}
