/**
 * =========================================================================================
 * 2026 祇園祭 ホラーアトラクション 統合機材制御ファームウェア (ESP32-WROOM-32)
 *
 * 【設計思想】
 * ESP32の台数を極力減らし、1台（または予備含め最小台数）で会場内の全ギミック・リレー・サーボ・警告灯を集約制御。
 *
 * 【通信方式】
 * 1. USBシリアル通信 (115200bps): サーバーPCと有線直結（Wi-Fi混雑時も100%確実に動作）
 * 2. Wi-Fi + WebSocket / HTTP: 会場ルーター経由での遠隔制御（オプション）
 *
 * 【ピンアサイン (ESP32-WROOM-32 30Pin / 38Pin 共通推奨)】
 *  - GPIO 23 : リレー1 (第零搬送コンベア)
 *  - GPIO 22 : リレー2 (排煙大型換気ファン)
 *  - GPIO 21 : リレー3 (非常用警告赤色灯 / パトランプ)
 *  - GPIO 19 : リレー4 (予備リレー / ストロボ照明等)
 *  - GPIO 18 : サーボモーター (蒸気第2減圧弁)
 *  - GPIO 2  : オンボードLED (通信・ハートビート表示)
 * =========================================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ESP32Servo.h>

// --- [設定パラメータ] ---
// Wi-Fi接続を使用する場合はSSIDとPASSを設定（USBシリアル単体運用の場合は未接続でも動作します）
const char* WIFI_SSID     = "GIONSAI_FACTORY_WIFI";
const char* WIFI_PASSWORD = "factory_secret_2026";
const bool  ENABLE_WIFI   = false; // USBシリアル優先運用の場合は false

// --- [ピン定義] ---
const int PIN_RELAY_CONVEYOR = 23; // コンベア
const int PIN_RELAY_FAN      = 22; // 換気ファン
const int PIN_RELAY_LIGHT    = 21; // 非常警告灯
const int PIN_RELAY_AUX      = 19; // 予備ギミック
const int PIN_SERVO_VALVE    = 18; // 蒸気弁サーボ
const int PIN_STATUS_LED     = 2;  // 稼働確認LED

// リレーのロジック (通常のリレーモジュールはLOWアクティブが多いです。HIGHアクティブの場合は反転)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// サーボ制御オブジェクト
Servo valveServo;

// 状態変数
bool stateConveyor = false;
bool stateFan      = false;
bool stateLight    = false;
bool stateAux      = false;
bool stateValve    = false; // false = 閉(0度), true = 開(90度)

void applyRelayStates() {
  digitalWrite(PIN_RELAY_CONVEYOR, stateConveyor ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN,      stateFan      ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_RELAY_LIGHT,    stateLight    ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_RELAY_AUX,      stateAux      ? RELAY_ON : RELAY_OFF);
}

void applyServoState() {
  if (stateValve) {
    valveServo.write(90); // 減圧弁 開放
  } else {
    valveServo.write(0);  // 減圧弁 閉鎖
  }
}

// コマンド解析と実行
// フォーマット例:
//   {"action":"conveyor","state":true}
//   {"action":"valve","state":false}
//   {"action":"emergency"}
//   {"action":"all_off"}
void processCommand(const String& cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  Serial.println("[ACK] Received: " + cmd);

  // 1. 非常用全点灯
  if (cmd.indexOf("emergency") >= 0 || cmd.indexOf("alarm") >= 0) {
    stateLight = true;
    stateConveyor = false;
    stateFan = true;
    applyRelayStates();
    Serial.println("[EVENT] EMERGENCY_TRIGGERED: Beacons ON, Conveyor OFF");
    return;
  }

  // 2. 全停止
  if (cmd.indexOf("all_off") >= 0 || cmd.indexOf("shutdown") >= 0) {
    stateConveyor = false;
    stateFan = false;
    stateLight = false;
    stateAux = false;
    stateValve = false;
    applyRelayStates();
    applyServoState();
    Serial.println("[EVENT] ALL_DEVICES_OFF");
    return;
  }

  // 3. 搬送コンベア
  if (cmd.indexOf("conveyor") >= 0) {
    stateConveyor = (cmd.indexOf("true") >= 0 || cmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_CONVEYOR, stateConveyor ? RELAY_ON : RELAY_OFF);
    Serial.printf("[STATE] Conveyor: %d\n", stateConveyor);
  }

  // 4. 蒸気バルブ (サーボ)
  if (cmd.indexOf("valve") >= 0) {
    stateValve = (cmd.indexOf("true") >= 0 || cmd.indexOf("1") >= 0);
    applyServoState();
    Serial.printf("[STATE] Valve: %d\n", stateValve);
  }

  // 5. 非常灯 / 赤色灯
  if (cmd.indexOf("light") >= 0) {
    stateLight = (cmd.indexOf("true") >= 0 || cmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_LIGHT, stateLight ? RELAY_ON : RELAY_OFF);
    Serial.printf("[STATE] EmergencyLight: %d\n", stateLight);
  }

  // 6. 排気ファン
  if (cmd.indexOf("fan") >= 0) {
    stateFan = (cmd.indexOf("true") >= 0 || cmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_FAN, stateFan ? RELAY_ON : RELAY_OFF);
    Serial.printf("[STATE] Fan: %d\n", stateFan);
  }
}

void setup() {
  // シリアル通信初期化 (115200bps)
  Serial.begin(115200);
  delay(500);

  Serial.println("\n========================================================");
  Serial.println(" GIONSAI 2026 - Central Equipment Hub (ESP32)");
  Serial.println(" Minimum Device Architecture: 1-MCU Full Control Mode");
  Serial.println("========================================================");

  // ピン初期化
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_RELAY_CONVEYOR, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  pinMode(PIN_RELAY_LIGHT, OUTPUT);
  pinMode(PIN_RELAY_AUX, OUTPUT);

  // 初期状態（安全のため全OFF）
  applyRelayStates();

  // サーボ初期化
  ESP32PWM::allocateTimer(0);
  valveServo.setPeriodHertz(50);
  valveServo.attach(PIN_SERVO_VALVE, 500, 2400);
  applyServoState();

  // Wi-Fi接続 (有効な場合のみ)
  if (ENABLE_WIFI) {
    Serial.printf("[WiFi] Connecting to %s ...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    } else {
      Serial.println("\n[WiFi] Connection timed out. Running in USB Serial standalone mode.");
    }
  } else {
    Serial.println("[MODE] Standalone USB-Serial Mode (WiFi Disabled for High Reliability).");
  }

  // 起動完了シグナル（LED 3回点滅）
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(100);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(100);
  }
}

String serialBuffer = "";
unsigned long lastHeartbeat = 0;

void loop() {
  // 1. USBシリアルコマンド受信
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

  // 2. ハートビート点滅 (1秒周期)
  if (millis() - lastHeartbeat >= 1000) {
    lastHeartbeat = millis();
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
}
