'use client';

import React from 'react';
import Link from 'next/link';
import { FullscreenButton } from '../components/common/FullscreenButton';
import '../styles/portal.css';

const PORTAL_CARDS = [
  {
    key: 'client',
    href: '/client',
    title: '[端末] 参加者用 PDA 端末',
    description: '現場巡回保守員向け画面。写真撮影・機器操作・フラッシュライト・プロシージャル怪異音響を搭載。',
    launchLabel: 'PDA 端末を起動 (/client) ->',
  },
  {
    key: 'admin',
    href: '/admin',
    title: '[管理] 集中管理コンソール',
    description: '運営スタッフ向け4カラム画面。端末監視・点検写真合否審査・グリッチ/音響/トーチ遠隔制御。',
    launchLabel: '管理コンソールを起動 (/admin) ->',
  },
  {
    key: 'equipment',
    href: '/equipment',
    title: '[機材] 機材演出制御盤',
    description: '物理設備（ESP32有線/Wi-Fi/Bluetooth対応リレー・サーボ・ライト・ファン）の個別登録と遠隔制御。',
    launchLabel: '機材制御盤を起動 (/equipment) ->',
  },
  {
    key: 'elevator',
    href: '/elevator-display',
    title: '[演出] エレベータ内 階数表示端末',
    description: '段ボール切り抜き用バックライト電照パネル画面。縦横切替、キャリブレーション、フリッカー演出対応。',
    launchLabel: 'エレベータ表示を起動 (/elevator-display) ->',
  },
  {
    key: 'video',
    href: '/display/video',
    title: '[演出] エリア3 映像再生用端末',
    description: '別置き大型モニター/タブレット用フルスクリーン再生プレイヤー。自動再生アンロック＆ノイズ待機画面。',
    launchLabel: '映像プレイヤーを起動 (/display/video) ->',
  },
];

export default function PortalPage() {
  const [showLicense, setShowLicense] = React.useState<boolean>(false);

  return (
    <div className="portal-root">
      <div className="win95-window portal-window">
        <div className="win95-titlebar">
          <span>[SYSTEM] 工場保守演出統合システム ポータル</span>
          <FullscreenButton className="portal-fs-btn" />
        </div>

        <div className="portal-body">
          <div className="portal-heading">
            <h1>第零製造所 設備点検・演出統合コンソール</h1>
            <p>Next.js 14+ App Router &amp; WebSocket (Socket.io) リアルタイム演出基盤</p>
          </div>

          <div className="portal-cards">
            {PORTAL_CARDS.map((card) => (
              <div key={card.key} className="win95-window portal-card">
                <div>
                  <div className={`portal-card-title ${card.key}`}>{card.title}</div>
                  <div className="portal-card-desc">{card.description}</div>
                </div>
                <Link href={card.href} className="portal-link">
                  <button className={`win95-btn portal-launch-btn ${card.key}`}>
                    {card.launchLabel}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          {/* System Status Console */}
          <div className="win95-inset-dark portal-status">
            <div>[STATUS] Next.js 14 App Router + Realtime WebSocket Ready.</div>
            <div>[NODE_ENV] {process.env.NODE_ENV || 'development'}</div>
            <div>[NETWORK] 全画面は単一Socket.ioサーバーと自動双方向同期します。</div>
          </div>

          {/* Toggleable License & Legal Information Panel */}
          <div className="portal-license">
            <div className="portal-license-toggle-row">
              <button
                onClick={() => setShowLicense(!showLicense)}
                className="win95-btn portal-license-toggle"
              >
                <span>{showLicense ? '▲ ライセンス情報を隠す' : '▼ ライセンス・著作権表記を表示'}</span>
              </button>
            </div>

            {showLicense && (
              <div className="win95-inset portal-license-box">
                <div className="portal-license-title">
                  [LICENSE &amp; THIRD-PARTY NOTICES / 権利・ライセンス表記]
                </div>
                <div className="portal-license-section">
                  <strong>本プロジェクト著作権:</strong><br />
                  © 2026 祇園祭 ホラーアトラクション制作有志. All Rights Reserved.<br />
                  本システムは、2026年 祇園祭・文化祭展示専用に設計・制作された演出統合基盤です。
                </div>
                <div className="portal-license-section">
                  <strong>使用オープンソースライブラリ / ライセンス:</strong>
                  <ul>
                    <li><strong>Next.js / React:</strong> MIT License (Copyright © Meta Platforms, Inc. / Vercel, Inc.)</li>
                    <li><strong>Socket.io:</strong> MIT License (Copyright © Guillermo Rauch)</li>
                    <li><strong>Express:</strong> MIT License (Copyright © StrongLoop, Inc.)</li>
                    <li><strong>Lucide React:</strong> ISC License (Copyright © Lucide Contributors)</li>
                    <li><strong>Web Audio API / Web Bluetooth API:</strong> W3C Standards &amp; Browser Native Implementations</li>
                    <li><strong>ESP32 Arduino Core / ESP32Servo:</strong> LGPL 2.1 / GPL (Espressif Systems &amp; Kevin Harrington)</li>
                  </ul>
                </div>
                <div className="portal-license-note">
                  ※ 各ソフトウェアは各著作者のライセンス規約に基づき提供されています。無断転載・営利目的の無許可再配布はご遠慮ください。
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="win95-statusbar">
          <div className="win95-statusbar-item portal-statusbar-main">
            文化祭・工場点検ホラーアトラクションシステム 2026 | All Rights Reserved
          </div>
          <div className="win95-statusbar-item">v2.0-NEXT</div>
        </div>
      </div>
    </div>
  );
}
