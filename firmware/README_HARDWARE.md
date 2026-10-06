# 2026 祇園祭 ホラーアトラクション - 機材・ESP32 マイコン運用＆AIコード生成仕様書

本システムは、**単一マイコンによる省力運用**から、**複数台のESP32を用いた「有線シリアル・Wi-Fi・Bluetooth (BLE)」ハイブリッド分散運用**まで、機材管理パネル（`/equipment`）から柔軟に設定・運用できるように設計されています。

また、**本ドキュメントをChatGPTやClaude等のLLMにそのまま提示することで、新しいセンサーやギミック用のESP32コードを即座に生成できるように、ハードウェア仕様・通信プロトコル・ボイラープレートテンプレート**を網羅しています。

---

## 1. 3つの通信プロトコルと適した用途

管理画面の「機材制御盤（`/equipment`）」では、各機材ごとに**通信方式（プロトコル）**と**担当マイコンID**を個別に指定・登録できます。

| 通信プロトコル | 安定性 | 遅延 | 配線 | 主な推奨用途・配置場所 |
| :--- | :---: | :---: | :---: | :--- |
| **有線シリアル (USB/COM)** | ★★★★★ | < 1ms | 必要 (USB) | **最重要基幹設備**（コンベア・主減圧弁・メイン非常パトランプ）。管理PC直結のため、電波混雑ゼロ・給電兼用で100%確実に動作。 |
| **Wi-Fi (HTTP / WebSocket)** | ★★★☆☆ | ~50ms | 不要 (LAN) | **中・長距離配置の機材**（別教室・廊下の大型換気ファン、天井照明、スモークマシンなど）。IPアドレスまたはmDNS名で通信。 |
| **Bluetooth (BLE)** | ★★★★☆ | ~20ms | 不要 (近距離) | **配線困難な隠し演出・移動型ギミック**（壁裏スポット照明、手持ち小道具、扉用電磁ロックなど）。ペアリングレスで高速レスポンス。 |

---

## 2. ファームウェア一覧と構成

プロジェクトの `firmware/` ディレクトリに、各通信方式・マイコン用のスケッチが用意されています。

```text
firmware/
├── README_HARDWARE.md                # 本マニュアル（AI生成プロンプト仕様書兼用）
├── esp32_relay_hub/                  # 【有線 / 統合メイン機材ハブ】
│   └── esp32_relay_hub.ino           # リレー4ch + サーボ統合制御
├── esp32_wifi_hub/                   # 【Wi-Fi リモートノード】
│   └── esp32_wifi_hub.ino            # REST API (GET /status, POST /control)
└── esp32_ble_hub/                    # 【Bluetooth (BLE) ノード】
    └── esp32_ble_hub.ino             # Nordic UART Service (NUS) 対応BLE受信
```

---

## 3. 複数台運用時のマイコン設定ルール

複数台のESP32を配置する場合、各スケッチの先頭にある **`TARGET_MCU_ID`** を機材管理パネルの「担当マイコンID」と一致させます。

### 例: 3台構成で運用する場合
- **1号機 (USB有線メイン)**: `ESP32_MAIN`
  - スケッチ: `firmware/esp32_relay_hub/esp32_relay_hub.ino`
  - 担当: コンベア (GPIO 23), 蒸気弁サーボ (GPIO 18), メイン赤色灯 (GPIO 21)
  - 接続先: `COM3` または `/dev/ttyUSB0`
- **2号機 (Wi-Fiサブ)**: `ESP32_SUB_LIGHT`
  - スケッチ: `firmware/esp32_wifi_hub/esp32_wifi_hub.ino`
  - 担当: 天井演出スポットライト (GPIO 23), 排気ダクトファン (GPIO 22)
  - 接続先: `192.168.1.15` または `http://gionsai-sub-light.local`
- **3号機 (Bluetooth BLE)**: `ESP32_BLE_HUB`
  - スケッチ: `firmware/esp32_ble_hub/esp32_ble_hub.ino`
  - 担当: 隠しストロボ照明 (GPIO 23), ギミック用ブザー (GPIO 22)
  - 接続先: `GIONSAI-BLE-01`

---

## 4. 機材管理パネル（Web UI）での個別設定手順

1. ブラウザで `https://localhost:3000/equipment` を開きます。
2. 画面右上の **「新規機器登録」** ボタンを押します。
3. 以下の項目を設定して **「登録保存」** を実行します：
   - **機器管理ID**: 例 `mcu-light-02`
   - **機器表示名称**: 例 `Zone B 天井ストロボ照明`
   - **制御種別**: `照明・回転灯` / `リレー` / `サーボ` / `換気ファン` / `カスタム`
   - **通信方式 (プロトコル)**: `有線シリアル` / `Wi-Fi` / `Bluetooth`
   - **担当マイコンID**: 例 `ESP32_SUB_LIGHT`
   - **接続先 / ポート (任意)**: 例 `COM4`、`192.168.1.15`、`GIONSAI-BLE-01`
   - **トピック**: 例 `mcu/lighting/zoneB`

設定内容は自動的にサーバー (`data/equipments.json`) に保存され、サーバー再起動後も永続化されます。

---

## 5. コマンドプロトコル仕様 (JSON形式)

管理サーバーから各マイコンへ送信されるコマンド形式は統一されています：

```json
{
  "mcuId": "ESP32_SUB_LIGHT",
  "endpoint": "192.168.1.15",
  "action": "light",
  "state": true,
  "power": 1
}
```

### 主要アクションコマンド
- コンベア制御: `{"action":"conveyor","state":true}`
- 蒸気バルブ制御: `{"action":"valve","state":true}`
- 非常用全点灯: `{"action":"emergency"}`
- 全停止・消灯: `{"action":"all_off"}`

---

## 6. AI（ChatGPT / Claude等）に新規ESP32コードを生成させるための指示書 (プロンプト)

新しいハードウェアギミックやセンサー、リレー盤を追加したい場合、以下のプロンプト枠をコピーしてAIに入力するだけで、本システムと100%互換性のあるArduinoコードを生成できます。

````markdown
### AIへのプロンプト入力例:
以下の仕様に基づいて、2026年祇園祭ホラーアトラクションシステム用のESP32 Arduinoスケッチ（.ino）を作成してください。

1. **基本仕様**:
   - プラットフォーム: ESP32 (Arduino-ESP32 Core)
   - 通信プロトコル: [有線USBシリアル / Wi-Fi HTTP / BLE の中から選択]
   - マイコンID: `ESP32_[名前]` (例: `ESP32_SMOKE_MACHINE`)
   - デバイス名/トピック: `mcu/gimmick/[名前]`

2. **通信受信仕様**:
   - シリアル通信ボーレート: 115200bps
   - 改行区切りのJSON文字列を受信して解析する。
   - `{"action":"[アクション名]","state":true/false}` または `{"action":"emergency"}`、`{"action":"all_off"}` に応答する。
   - `mcuId` が指定されている場合、自機宛か `ALL` の場合のみ実行する。

3. **制御対象ピンと動作**:
   - GPIO [XX]: [接続デバイス名] (ON=LOW/HIGH, OFF=HIGH/LOW)
   - GPIO 2: オンボード稼働LED (1秒周期で反転点滅)

4. **安全設計**:
   - setup起動時は安全のため全出力OFF。
   - 非常全点灯 (`emergency`) 時は演出灯を点灯、危険動力を遮断。
````

### 最小ボイラープレート（シリアル受信テンプレート）
```cpp
#include <Arduino.h>

#define TARGET_MCU_ID "ESP32_CUSTOM_NODE"
const int PIN_STATUS_LED = 2;
const int PIN_OUTPUT_1   = 23;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_OUTPUT_1, OUTPUT);
  digitalWrite(PIN_OUTPUT_1, HIGH); // 安全のため初期OFF
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  // マイコンIDチェック
  if (cmd.indexOf("\"mcuId\":") >= 0 && cmd.indexOf(TARGET_MCU_ID) < 0 && cmd.indexOf("\"ALL\"") < 0) return;

  if (cmd.indexOf("emergency") >= 0) {
    digitalWrite(PIN_OUTPUT_1, LOW); // 非常動作
  } else if (cmd.indexOf("all_off") >= 0) {
    digitalWrite(PIN_OUTPUT_1, HIGH);
  } else if (cmd.indexOf("\"state\":true") >= 0) {
    digitalWrite(PIN_OUTPUT_1, LOW); // ON
  } else if (cmd.indexOf("\"state\":false") >= 0) {
    digitalWrite(PIN_OUTPUT_1, HIGH); // OFF
  }
}

String buffer = "";
void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (buffer.length() > 0) { processCommand(buffer); buffer = ""; }
    } else { buffer += c; }
  }
}
```

---

## 7. トラブルシューティング

1. **有線シリアルが反応しない場合**:
   - デバイスマネージャーでCOMポート番号を確認（CH340 / CP2102 ドライバが当たっているか確認）。
   - シリアル通信速度が `115200` bps になっているか確認。
2. **Wi-Fiが繋がらない場合**:
   - `WIFI_SSID` / `WIFI_PASSWORD` を確認。会場の5GHz帯ではなく2.4GHz帯のSSIDを指定してください。
   - `firmware/esp32_wifi_hub/esp32_wifi_hub.ino` はWi-Fiが繋がらなくてもUSBシリアルからフォールバック動作します。
3. **Bluetoothが検出されない場合**:
   - ESP32の電源投入後、LEDが点灯または点滅しているか確認。
   - すでに他の端末（スマホ等）とペアリングされている場合は一度切断してください。
