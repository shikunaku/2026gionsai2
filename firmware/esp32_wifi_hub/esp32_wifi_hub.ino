/**
 * =========================================================================================
 * 2026 祇園祭 ホラーアトラクション - マルチマイコン対応 Wi-Fi / HTTP / WebSocket 端末ファームウェア
 * 対象マイコン: ESP32 / ESP32-WROOM-32 / ESP32-S3
 *
 * 【役割】
 * 会場内のローカルWi-Fi（ルーター経由）に接続し、IPアドレス経由で
 * REST API (HTTP POST/GET) や WebSocket による遠隔制御を受け付けるノード。
 * ケーブル長に制限されず、広範なエリアの照明・音響・スモークマシーン・リレーを制御可能。
 *
 * 【特徴】
 * 1. 各ESP32に一意の「TARGET_MCU_ID」と「HOST_NAME」を付与可能。
 * 2. HTTPエンドポイント:
 *    - GET  /status              : 現在のピン状態やマイコン情報をJSONで返却
 *    - POST /control             : {"action":"light","state":true} 等で制御
 *    - POST /emergency           : 非常用全点灯
 * 3. mDNS対応 (例: http://gionsai-esp32-02.local でアクセス可能)
 * 4. USB有線シリアルコマンドにも同時対応（フォールバック動作）。
 * =========================================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// --- [マイコン識別設定] ---
// 機材管理パネルの「担当マイコンID」と一致させてください
#define TARGET_MCU_ID    "ESP32_SUB_LIGHT"
#define HOST_NAME        "gionsai-sub-light"

// --- [Wi-Fi接続設定] ---
const char* WIFI_SSID     = "GIONSAI_WIFI_2G";
const char* WIFI_PASSWORD = "factory_secret_2026";

// --- [ピン定義 (リレー / 照明 / 回転灯)] ---
const int PIN_RELAY_1    = 23; // 非常警告灯 / ストロボ
const int PIN_RELAY_2    = 22; // サブ照明 / 演出スポット
const int PIN_STATUS_LED = 2;  // Wi-Fi接続・稼働LED

const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

WebServer server(80);

// 状態変数
bool stateRelay1 = false;
bool stateRelay2 = false;

void applyStates() {
  digitalWrite(PIN_RELAY_1, stateRelay1 ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_RELAY_2, stateRelay2 ? RELAY_ON : RELAY_OFF);
}

// コマンド解析と実行
void processCommand(const String& cmd) {
  String cleanCmd = cmd;
  cleanCmd.trim();
  if (cleanCmd.length() == 0) return;

  Serial.println("[CMD] " + cleanCmd);

  // マイコンIDフィルタリング（指定がある場合は自機宛か判定）
  if (cleanCmd.indexOf("\"mcuId\":") >= 0) {
    if (cleanCmd.indexOf(TARGET_MCU_ID) < 0 && cleanCmd.indexOf("\"mcuId\":\"ALL\"") < 0) {
      Serial.println("[IGNORE] Message intended for another MCU ID.");
      return;
    }
  }

  // 1. 非常全点灯
  if (cleanCmd.indexOf("emergency") >= 0 || cleanCmd.indexOf("alarm") >= 0) {
    stateRelay1 = true;
    stateRelay2 = true;
    applyStates();
    Serial.println("[EVENT] EMERGENCY TRIGGERED");
    return;
  }

  // 2. 全消灯 / 全停止
  if (cleanCmd.indexOf("all_off") >= 0) {
    stateRelay1 = false;
    stateRelay2 = false;
    applyStates();
    Serial.println("[EVENT] ALL OFF");
    return;
  }

  // 3. 個別制御
  if (cleanCmd.indexOf("light") >= 0 || cleanCmd.indexOf("relay1") >= 0) {
    stateRelay1 = (cleanCmd.indexOf("true") >= 0 || cleanCmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_1, stateRelay1 ? RELAY_ON : RELAY_OFF);
    Serial.printf("[STATE] Relay 1: %d\n", stateRelay1);
  }

  if (cleanCmd.indexOf("aux") >= 0 || cleanCmd.indexOf("relay2") >= 0) {
    stateRelay2 = (cleanCmd.indexOf("true") >= 0 || cleanCmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_2, stateRelay2 ? RELAY_ON : RELAY_OFF);
    Serial.printf("[STATE] Relay 2: %d\n", stateRelay2);
  }
}

// HTTPハンドラー: GET /status
void handleGetStatus() {
  String json = "{";
  json += "\"mcuId\":\"" TARGET_MCU_ID "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"relay1\":" + String(stateRelay1 ? "true" : "false") + ",";
  json += "\"relay2\":" + String(stateRelay2 ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

// HTTPハンドラー: POST /control
void handlePostControl() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    processCommand(body);
    server.send(200, "application/json", "{\"status\":\"ok\",\"mcuId\":\"" TARGET_MCU_ID "\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
  }
}

// HTTPハンドラー: POST /emergency
void handlePostEmergency() {
  processCommand("{\"action\":\"emergency\"}");
  server.send(200, "application/json", "{\"status\":\"emergency_activated\"}");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n========================================================");
  Serial.printf(" GIONSAI 2026 - Wi-Fi Remote Node [%s]\n", TARGET_MCU_ID);
  Serial.println("========================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_RELAY_1, OUTPUT);
  pinMode(PIN_RELAY_2, OUTPUT);
  applyStates();

  // Wi-Fi接続開始
  Serial.printf("[WiFi] Connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());

    // mDNS設定
    if (MDNS.begin(HOST_NAME)) {
      Serial.printf("[mDNS] Responder started: http://%s.local\n", HOST_NAME);
    }

    // HTTPルート設定
    server.on("/status", HTTP_GET, handleGetStatus);
    server.on("/control", HTTP_POST, handlePostControl);
    server.on("/emergency", HTTP_POST, handlePostEmergency);
    server.begin();
    Serial.println("[HTTP] WebServer listening on port 80.");
  } else {
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("\n[WiFi] Connection timeout. Operating in USB Serial fallback mode.");
  }
}

String serialBuffer = "";
unsigned long lastBlink = 0;

void loop() {
  // 1. Webサーバーリクエスト処理
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  // 2. USBシリアルコマンド処理 (Wi-Fi断線時もシリアルで稼働可能)
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        processCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      serialBuffer += c;
    }
  }

  // 3. 稼働LEDステータス
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    // 未接続時はゆっくり点滅
    if (millis() - lastBlink > 800) {
      lastBlink = millis();
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    }
  }
}
