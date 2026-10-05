# 文化祭・工場点検ホラーアトラクション演出統合システム (2026 祇園祭)

文化祭・イベント等のアトラクションにおいて、参加者が携帯する **「工場保守用PDA（Webクライアント）」** と、運営・演出スタッフが監視・審査・演出制御を行う **「集中管理コンソール（Admin）」**、および会場内の物理ギミック（搬送コンベア、蒸気バルブ、非常灯、サーボモーター等）を連携制御する **「マイコン（ESP32 / BLE / Serial）」** をリアルタイムに統合制御するWebアプリケーション基盤です。

Next.js (App Router) + TypeScript + Socket.io によるフルスタック構成で、レトロ業務機（Windows 95/98 Classic）テイストのデザインシステムを採用しています。

---

## 🏗️ システムアーキテクチャ

```text
[ 参加者用 PDA 端末 ] (/client)
  ├── 100dvh & PWA / 全画面表示
  ├── カメラ写真撮影 (<input type="file"> + 800px Canvas圧縮)
  ├── Web Audio API プロシージャル怪音・音響合成 (最大2.5倍ゲイン増幅)
  └── 背面トーチ制御 (Android Bridge / ImageCapture 多重フォールバック)
         │
         │ WebSocket (Socket.io)
         ▼
[ 統合バックエンドサーバー ] (server/index.ts)
  ├── Express + Socket.io + Next.js カスタムサーバー
  ├── メモリ内状態管理 & 10秒多重送信デバウンス (store.ts)
  ├── 設備設定永続化 (data/equipments.json)
  └── マイコン連携ディスパッチャー (mcu-manager.ts)
         │
         ├──► [ 集中管理コンソール ] (/admin)
         │      ├── 接続端末監視 (電池残量・オンライン・フェーズ・妨害[G]・点滅[T])
         │      ├── 写真審査キュー (合否判定・差し戻し理由)
         │      ├── キャスト運用マニュアル (PDFビューア埋め込み)
         │      └── 演出制御 (全端末フェーズ切替・グリッチ・音響・非常全点灯)
         │
         ├──► [ 機材演出制御盤 ] (/equipment)
         │      └── 物理/仮想設備 (リレー・サーボ・ライト・ファン) の即時制御・追加・削除
         │
         └──► [ 会場ハードウェア ] (ESP32 Wi-Fi / USB Serial / Web Bluetooth)
```

---

## 🌟 主な機能・特徴

### 1. 参加者用 PDA 端末 (`/client`)
- **スマホ縦長最適化**: 縦画面（横幅 `480px` 上限）に完全対応し、片手操作しやすい親指リーチレイアウト。
- **4段階の進行フェーズ**:
  - `INIT` (待機・同意確認・オーディオアンロック)
  - `ZONE1` (品質管理室 - 3箇所の写真撮影・提出)
  - `ZONE2` (第零製造ライン - 搬送コンベア/蒸気バルブの機器操作)
  - `END` (怪異発生・システム遮断・電源降下・ブラックアウト)
- **カメラ撮影 & 圧縮**: 低スペック端末でもクラッシュしない `<input type="file" capture="environment">` + Canvas 800px 自動リサイズ。
- **トーチ制御の多重フォールバック**: Android WebView Bridge ➔ Web標準 ImageCapture ➔ スクリーンフラッシュ。
- **プロシージャル音響エンジン**: 外部mp3ファイルを使わず、Web Audio API でビープ音、ガイガー音、重低音、モーター音、電源降下音を完全動的合成。

### 2. 集中管理コンソール (`/admin`)
- **レトロ業務機テイスト (Win95 UI)**: 目に優しい低コントラスト配色、立体ベベルボタン、MSゴシック風等幅フォント。
- **4カラム統合オペレーション**:
  1. **接続端末監視 (`Device Monitor`)**: 全PDAの接続状態、バッテリー残量、フェーズ切替、個別グリッチ妨害、個別トーチ点滅。
  2. **点検写真審査キュー (`Photo Review Queue`)**: 提出された写真のサムネイル確認、合格（APPROVE）、不鮮明/箇所違いによる差し戻し。
  3. **キャスト運用マニュアル (`CastManualViewer`)**: 運営・誘導スタッフ向けマニュアル（PDF）のインライン閲覧と別窓表示・ダウンロード。
  4. **演出制御パネル (`EffectTriggerPanel`)**: 全端末フェーズ強制切替、グリッチ演出発火（強度・モード）、音響トリガー、音量一括ブースト（100%〜250%）、トーチ遠隔制御、**非常用全照明発火 [EMERGENCY LIGHT]**。
- **タイトルバー共通ナビゲーション**: ポータル (`/`)、管理コンソール (`/admin`)、機材制御盤 (`/equipment`) のワンクリック相互行き来。

### 3. 機材演出制御盤 (`/equipment`)
- 会場内の照明、リレー、サーボ、換気ファン等の系統を一覧管理・手動ON/OFF。
- `data/equipments.json` による自動永続化（サーバー再起動時も状態を保持）。

---

## 📁 ディレクトリ構成

```text
.
├── server/                      # リアルタイム通信バックエンド
│   ├── index.ts                 # Express + Socket.io + Next.js サーバー
│   ├── store.ts                 # インメモリストア & 写真重複防止デバウンス
│   ├── persistence.ts           # equipments.json 読み書き
│   └── mcu-manager.ts           # マイコン統合管理 (Serial, BLE, Wi-Fi)
├── src/
│   ├── app/                     # Next.js 14+ App Router
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── page.tsx             # ポータルランチャー (/)
│   │   ├── client/page.tsx      # 参加者用 PDA 端末 (/client)
│   │   ├── admin/page.tsx       # 集中管理コンソール (/admin)
│   │   └── equipment/page.tsx   # 機材演出制御盤 (/equipment)
│   ├── components/
│   │   ├── admin/               # 管理コンポーネント (端末監視/写真審査/演出/マニュアル)
│   │   ├── client/              # PDA 端末コンポーネント (各フェーズ/カメラ/オーバーレイ)
│   │   ├── equipment/           # 機材制御コンポーネント
│   │   └── common/              # 共通コンポーネント (全画面切替ボタン等)
│   ├── hooks/                   # カスタムフック (useSocket, useTorch, useBattery, useSoundEngine)
│   ├── lib/                     # コアロジック (soundEngine.ts, types.ts)
│   └── styles/                  # スタイル定義 (win95.css, glitch.css, globals.css)
├── public/                      # 静的アセット (cast-manual.pdf 等)
├── data/                        # 永続化データ (equipments.json)
└── requirements_definition.md   # システム完全仕様書・要件定義
```

---

## 🚀 セットアップ & 起動方法

### 前提環境
- Node.js 18+ (推奨: Node.js 20+)
- npm または yarn / pnpm

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 開発用サーバーの起動
```bash
npm run dev
```
起動後、ブラウザで以下のURLにアクセスできます：
- **ポータルランチャー**: [http://localhost:3000](http://localhost:3000)
- **参加者用 PDA 端末**: [http://localhost:3000/client](http://localhost:3000/client)
- **集中管理コンソール**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **機材演出制御盤**: [http://localhost:3000/equipment](http://localhost:3000/equipment)

### 3. 型チェック & ビルド
```bash
# TypeScript 型チェック
npx tsc --noEmit

# 本番用ビルド
npm run build
```

---

## 🔒 ライセンス・著作権
本プロジェクトは文化祭・展示イベント専用に設計されたシステムです。
詳細な演出仕様およびハードウェア連携仕様については `requirements_definition.md` をご参照ください。
