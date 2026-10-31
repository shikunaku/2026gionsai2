'use client';

import React from 'react';
import Link from 'next/link';
import { FullscreenButton } from '../components/common/FullscreenButton';
import '../styles/portal.css';

interface PortalCardItem {
  key: string;
  href: string;
  title: string;
  description: string;
  launchLabel: string;
}

interface PortalCategory {
  categoryName: string;
  categoryDesc: string;
  cards: PortalCardItem[];
}

const PORTAL_CATEGORIES: PortalCategory[] = [
  {
    categoryName: '[管理・監視系]',
    categoryDesc: 'アトラクション全体の統括・遠隔監視・物理機材制御',
    cards: [
      {
        key: 'admin',
        href: '/admin',
        title: '[管理] 集中管理コンソール',
        description: '運営スタッフ向け統括画面。端末監視・点検写真合否審査・グリッチ/音響/トーチ遠隔制御。',
        launchLabel: '管理コンソールを起動 (/admin) ->',
      },
      {
        key: 'cctv',
        href: '/admin/cctv',
        title: '[監視] 監視カメラ CCTV モニター',
        description: '現場設置カメラ3台（品質管理室/通路・EV前/製造ライン）のWebRTC常時モニタリング・3分割/フォーカス切替。',
        launchLabel: 'CCTV モニターを起動 (/admin/cctv) ->',
      },
      {
        key: 'equipment',
        href: '/equipment',
        title: '[機材] 機材演出制御盤',
        description: '物理設備（ESP32有線/Wi-Fi/Bluetooth対応リレー・サーボ・ライト・ファン）の個別登録と遠隔制御。',
        launchLabel: '機材制御盤を起動 (/equipment) ->',
      },
      {
        key: 'preshow-console',
        href: '/preshow',
        title: '[演出] プレショー担当者操作コンソール',
        description: 'プレショー担当スタッフ向け操作画面。接続端末一覧・フラッシュライト遠隔点滅・画面グリッチ・プレショー映像上映スイッチ。',
        launchLabel: 'プレショー操作卓を起動 (/preshow) ->',
      },
    ],
  },
  {
    categoryName: '[ディスプレイ・演出系]',
    categoryDesc: '館内スクリーン・プロジェクター・電照パネル・音響ノード端末',
    cards: [
      {
        key: 'elevator-bg',
        href: '/display/elevator',
        title: '[背景] エレベーター背景映像・CCTV演出端末',
        description: 'エレベーター内専用背景画面。1F〜B1F降下シークエンス連動・シャフトアニメーション・CCTV中継対応。',
        launchLabel: 'EV背景画面を起動 (/display/elevator) ->',
      },
      {
        key: 'elevator',
        href: '/elevator-display',
        title: '[電照] エレベータ内 階数表示端末',
        description: '段ボール切り抜き用バックライト電照パネル画面。縦横切替、キャリブレーション、フリッカー演出対応。',
        launchLabel: '階数表示を起動 (/elevator-display) ->',
      },
      {
        key: 'preshow',
        href: '/display/preshow',
        title: '[映像] プレショー映像 (Pre-show Display)',
        description: '待機ホール正面スクリーン用フルスクリーン再生プレイヤー。管理卓からの上映トリガー・映像終了通知連動。',
        launchLabel: 'プレショー映像を起動 (/display/preshow) ->',
      },
      {
        key: 'video',
        href: '/display/video',
        title: '[映像] エリア3/モニター室 最終映像再生端末',
        description: 'エリア3大型プロジェクター/モニター用フルスクリーン再生プレイヤー。怪異タイムスタンプ検知＆パニック連動。',
        launchLabel: 'モニター室映像を起動 (/display/video) ->',
      },
      {
        key: 'sound',
        href: '/display/sound',
        title: '[音響] 音響再生専用ノード (Sound Node)',
        description: '会場内天井・隠しスピーカー用待機端末。ワンタップでオーディオ待機し、サーバーからの音響指示を即時再生。',
        launchLabel: '音響ノードを起動 (/display/sound) ->',
      },
    ],
  },
  {
    categoryName: '[端末系]',
    categoryDesc: '参加者携行端末および現場中継用カメラ配信用端末',
    cards: [
      {
        key: 'client',
        href: '/client',
        title: '[端末] 参加者用 PDA 端末',
        description: '現場巡回保守員向け画面。写真撮影・機器点検操作・フラッシュライト・プロシージャル怪異音響を搭載。',
        launchLabel: 'PDA 端末を起動 (/client) ->',
      },
      {
        key: 'camera',
        href: '/camera',
        title: '[配信] CCTV 配信用カメラ画面',
        description: '現場中継配信用スマートフォン向け画面。内蔵カメラ映像をWebRTC経由でCCTVモニターへリアルタイム中継。',
        launchLabel: '配信カメラを起動 (/camera) ->',
      },
    ],
  },
];

export default function PortalPage() {
  const [showLicense, setShowLicense] = React.useState<boolean>(false);

  return (
    <div className="portal-root">
      <div className="win95-window portal-window">
        <div className="win95-titlebar">
          <span>工場保守演出統合システム ポータル</span>
          <FullscreenButton className="portal-fs-btn" />
        </div>

        <div className="portal-body">
          <div className="portal-heading">
            <h1>第零製造所 設備点検・演出統合コンソール</h1>
          </div>

          <div className="portal-sections">
            {PORTAL_CATEGORIES.map((section) => (
              <div key={section.categoryName} className="portal-category-group">
                <div className="portal-category-header">
                  <span className="portal-category-title">{section.categoryName}</span>
                  <span className="portal-category-desc">{section.categoryDesc}</span>
                </div>
                <div className="portal-cards">
                  {section.cards.map((card) => (
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
