# 文化祭・工場点検ホラーアトラクション演出統合システム (2026 祇園祭)

文化祭・イベント等のアトラクションにおいて、参加者が携帯する **「工場保守用PDA（Webクライアント）」** と、運営・演出スタッフが監視・審査・演出制御を行う **「集中管理コンソール（Admin）」**、および会場内の物理ギミック（搬送コンベア、エレベータ昇降リレー、蒸気バルブ、非常灯、換気ファン等）を連携制御する **「マイコン（ESP32 / BLE / Wi-Fi / Serial）」**、さらに **エレベータ内階数電照パネル端末** や **エリア3大型モニター端末** をリアルタイムに統合制御するWebアプリケーション基盤です。

Next.js (App Router) + TypeScript + Socket.io によるフルスタック構成で、レトロ業務機（Windows 95/98 Classic）テイストのデザインシステムを採用しています。

---

## システムアーキテクチャ

```text
[ 参加者用 PDA 端末 ] (/client)
  ├── 100dvh & PWA / 全画面表示
  ├── カメラ写真撮影 (<input type="file"> + 800px Canvas圧縮)
  ├── Web Audio API 合成 (合格チャイム♪、重低音、ガイガー、ビープ等)
  ├── 画面妨害エフェクト (不穏歪み/激震裂け/色反転/突発暗転/血色赤転/砂嵐)
  └── 背面トーチ制御 (Android Bridge / ImageCapture 多重フォールバック)
         │
         │ WebSocket (Socket.io)
         ▼
[ 統合バックエンドサーバー ] (server/index.ts)
  ├── Express + Socket.io + Next.js カスタムサーバー (HTTP/HTTPS対応)
  ├── メモリ内状態管理 & 10秒多重送信デバウンス (store.ts)
  ├── 設備設定永続化 (data/equipments.json)
  └── マルチマイコン・プロトコル振り分けディスパッチャー (mcu-manager.ts)
         │
         ├──► [ 集中管理コンソール ] (/admin)
         │      ├── 接続端末監視 (電池残量・オンライン・新5段階エリア制御・個別妨害・個別点滅)
         │      ├── 写真審査キュー (合否判定・差し戻し理由)
         │      ├── キャスト運用マニュアル (PDFビューア埋め込み)
         │      ├── 演出制御 (全端末5エリア切替・多重妨害モード・音響トリガー・非常照明)
         │      └── エレベータ階数テスト & コンベア操作 & エリア3映像手動トリガー
         │
         ├──► [ エレベータ内 階数表示端末 ] (/elevator-display または /display/elevator)
         │      ├── 段ボール切り抜き用バックライト電照パネル画面 (漆黒背景 & 暖色系白発光 #FFF3D0)
         │      ├── 縦配置 (上:1 / 下:B1) & 横配置 (左:1 / 右:B1) 切り替え & 反転設定
         │      ├── 段ボール穴合わせ微調整 (幅・高さ・余白スライダー / LocalStorage保存)
         │      └── 古い蛍光灯/白熱球特有のフリッカー・チラつき演出 & 昇降連動
         │
         ├──► [ エリア3 映像再生用別端末 ] (/display/video または /display/player)
         │      ├── 別置き大型モニター/タブレット用 フルスクリーンプレイヤー
         │      ├── CRT走査線・アナログ砂嵐ノイズの待機画面 & 音声自動再生アンロック機構
         │      └── WebSocket連動による動画再生 & 合成ホラービジュアルフォールバック
         │
         ├──► [ 機材演出制御盤 ] (/equipment)
         │      ├── 有線シリアル / Wi-Fi / Bluetooth (BLE) のプロトコル個別設定
         │      └── 物理/仮想設備 (リレー・サーボ・ライト・ファン) の即時制御・追加・永続化
         │
         └──► [ 会場ハードウェア ] (ESP32 有線ハブ / Wi-Fi ノード / BLE ノード)
```

---

## 主な機能・特徴

### 1. 進行エリア体系（全5段階）
ゲーム全体のエリアを以下の5段階フローで一元管理しています：
1. **エリア1: `STANDBY` (待機・オープニング)**
   - 参加者端末: 待機画面、案内・ガイダンス表示。管理画面からの開始トリガーを待つ。
2. **エリア2: `AREA_1_PHOTO` (エリア1: 画像撮影・提出)**
   - 参加者端末: 指定3か所の写真をカメラで撮影・提出。管理画面の審査で合格すると次へ。
3. **エリア3: `ELEVATOR` (エレベータ移動・稼働)**
   - 参加者端末: エレベータ搭乗・運行案内/操作UI。
   - トリガー時にMCU（ESP32リレー/モーター）へ稼働コマンド送信、エレベータ階数表示端末へ階数更新（1F ➔ MOVING ➔ チラつき点灯B1）を発行。
4. **エリア4: `AREA_2_CONVEYOR` (エリア2: コンベア操作)**
   - 参加者端末: 搬送コンベアの操作UI（正転・逆転・緊急停止）。WebSocket経由でESP32へコマンドを転送。
5. **エリア5: `AREA_3_VIDEO` (エリア3: 別端末映像再生トリガー)**
   - 参加者端末: ギミック解除・映像再生トリガーUI。
   - 参加者端末で操作すると、別置き大型モニター（`/display/video`）へ `TRIGGER_VIDEO_PLAY` をブロードキャスト。
- **カメラ撮影 & 圧縮**: 低スペック端末でもクラッシュしない `<input type="file" capture="environment">` + Canvas 800px 自動リサイズ。
- **トーチ制御の多重フォールバック**: Android WebView Bridge ➔ Web標準 ImageCapture ➔ スクリーンフラッシュ。

### 2. 集中管理コンソール (`/admin`)
- **レトロ業務機テイスト (Win95 UI)**: 目に優しい低コントラスト配色、立体ベベルボタン、MSゴシック風等幅フォント。
- **4カラム統合オペレーション**:
  1. **接続端末監視 (`Device Monitor`)**: 全PDAの接続状態、バッテリー残量、エリア切替、個別妨害発火、個別トーチ点滅。
  2. **点検写真審査キュー (`Photo Review Queue`)**: 提出された写真のサムネイル確認、合格（APPROVE）、不鮮明/箇所違いによる差し戻し。
  3. **キャスト運用マニュアル (`CastManualViewer`)**: 運営・誘導スタッフ向けマニュアル（PDF）のインライン閲覧と別窓表示・ダウンロード。
  4. **演出制御パネル (`EffectTriggerPanel`)**: 全端末エリア強制切替、6種類の画面妨害（強度・モード）、プロシージャル音響（合格チャイム、重低音、ガイガー等）、音量一括ブースト（100%〜250%）、トーチ遠隔制御、**非常用全照明発火 [EMERGENCY LIGHT]**。
- **タイトルバー共通ナビゲーション**: ポータル (`/`)、管理コンソール (`/admin`)、機材制御盤 (`/equipment`) のワンクリック相互行き来。

### 3. 機材演出制御盤 (`/equipment`)
- 会場内の照明、リレー、サーボ、換気ファン等の系統を一覧管理・手動ON/OFF。
- **マルチマイコン & 3通信方式対応**:
  - 有線シリアル (USB/COM)
  - Wi-Fi (HTTP / WebSocket)
  - Bluetooth (BLE)
- 機材ごとに担当マイコンID（例: `ESP32_MAIN`）や接続ポートを設定可能。
- `data/equipments.json` による自動永続化（サーバー再起動時も状態を保持）。

### 4. ポータルランチャー (`/`)
- 各種画面（PDA端末、管理コンソール、機材制御盤）へのワンクリックランチャー。
- **折りたたみ式ライセンス・著作権表記パネル**:
  - イベント運営や展示で必要なOSSライセンス（Next.js, Socket.io, Express, Web Audio等）や本プロジェクトの著作権表記を表示/非表示トグル可能。

---

## ハードウェア連携 (ESP32) & AIコード生成

本リポジトリの `firmware/` ディレクトリに、各通信方式のファームウェアとAI生成用プロンプト仕様書が含まれています。

- [firmware/README_HARDWARE.md](file:///c:/works-LeX13/2026/2026gionsai2/firmware/README_HARDWARE.md):
  - 有線/Wi-Fi/BLEの選定基準、結線図、複数台設定ルール
  - **ChatGPTやClaudeに投げるだけで互換Arduinoコードを即生成できるAIプロンプトテンプレート**
- [firmware/esp32_relay_hub/esp32_relay_hub.ino](file:///c:/works-LeX13/2026/2026gionsai2/firmware/esp32_relay_hub/esp32_relay_hub.ino): 有線シリアル統合制御
- [firmware/esp32_wifi_hub/esp32_wifi_hub.ino](file:///c:/works-LeX13/2026/2026gionsai2/firmware/esp32_wifi_hub/esp32_wifi_hub.ino): Wi-Fi / REST API 遠隔制御
- [firmware/esp32_ble_hub/esp32_ble_hub.ino](file:///c:/works-LeX13/2026/2026gionsai2/firmware/esp32_ble_hub/esp32_ble_hub.ino): Bluetooth Low Energy (NUS) 制御

---

## ディレクトリ構成

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
│   │   ├── page.tsx             # ポータルランチャー (/)（ライセンス開閉付き）
│   │   ├── client/page.tsx      # 参加者用 PDA 端末 (/client)
│   │   ├── admin/page.tsx       # 集中管理コンソール (/admin)
│   │   └── equipment/page.tsx   # 機材演出制御盤 (/equipment)
│   ├── components/
│   │   ├── admin/               # 管理コンポーネント (端末監視/写真審査/演出/マニュアル)
│   │   ├── client/              # PDA 端末コンポーネント (各エリア/カメラ/妨害オーバーレイ)
│   │   ├── equipment/           # 機材制御コンポーネント
│   │   └── common/              # 共通コンポーネント (全画面切替ボタン等)
│   ├── hooks/                   # カスタムフック (useSocket, useTorch, useBattery, useSoundEngine)
│   ├── lib/                     # コアロジック (soundEngine.ts, types.ts)
│   └── styles/                  # スタイル定義 (win95.css, glitch.css, globals.css)
├── firmware/                    # ESP32 ファームウェア & AIコード生成仕様
│   ├── README_HARDWARE.md       # マイコン運用マニュアル & AIプロンプト仕様書
│   ├── esp32_relay_hub/         # 有線シリアル 統合ハブ
│   ├── esp32_wifi_hub/          # Wi-Fi 遠隔ハブ
│   └── esp32_ble_hub/           # Bluetooth BLE ハブ
├── docs/                        # 技術ドキュメント
│   └── FLASHLIGHT_API.md        # 専用Androidアプリ フラッシュライトAPI仕様書
├── public/                      # 静的アセット (cast-manual.pdf 等)
├── data/                        # 永続化データ (equipments.json)
└── requirements_definition.md   # システム完全仕様書・要件定義
```

---

## セットアップ & 起動方法

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

#### HTTPS (SSL) の設定方法
スマートフォンのカメラアクセスやトーチ機能、Web Audio の安定動作のため、ローカルネットワーク等で HTTPS を利用したい場合は、`certificates/` ディレクトリに証明書を配置するだけで自動認識されます：
```text
certificates/
├── cert.pem   # サーバー証明書
└── key.pem    # 秘密鍵
```

証明書が存在する場合は自動的に `https://localhost:3000` で起動し、存在しない場合は通常の `http://localhost:3000` で起動します。

### 3. 型チェック & ビルド
```bash
# TypeScript 型チェック
npx tsc --noEmit

# 本番用ビルド
npm run build
```

---

## ライセンス・著作権
本プロジェクトは 2026年 祇園祭・文化祭展示専用に設計・制作された演出統合基盤です。  
ポータル画面（`/`）最下部の「ライセンス・著作権表記を表示」から、利用ライブラリの一覧と権利条項を確認できます。
