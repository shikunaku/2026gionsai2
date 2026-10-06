/**
 * =========================================================================================
 * 2026 祇園祭 ホラーアトラクション - マルチマイコン対応 Bluetooth (BLE) 端末ファームウェア
 * 対象マイコン: ESP32 / ESP32-WROOM-32 / ESP32-C3 / ESP32-S3
 *
 * 【役割】
 * 配線が困難な場所にある機器（例: 移動式ギミック、隠し照明、天井設置ブザー、遠隔パトランプなど）を
 * PCやタブレットとBluetooth Low Energy (BLE) でワイヤレス接続し、個別制御します。
 *
 * 【特徴】
 * 1. 各ESP32に一意の「TARGET_MCU_ID」と「BLE_DEVICE_NAME」を設定可能。
 * 2. Nordic UART Service (NUS) 互換のUUIDを採用しているため、
 *    Web Bluetooth API（Chromeブラウザ）やBLEシリアルアプリから直接コマンド送受信可能。
 * 3. 有線シリアル (USB) からのコマンド受信にも同時対応。
 * =========================================================================================
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// --- [マイコン識別設定] ---
// 機材管理パネルの「担当マイコンID」と一致させてください
#define TARGET_MCU_ID    "ESP32_BLE_HUB"
#define BLE_DEVICE_NAME  "GIONSAI-BLE-01"

// --- [Nordic UART Service UUIDs] ---
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

// --- [ピン定義 (リレー / 照明 / ブザー)] ---
const int PIN_RELAY_1    = 23; // リレー1 (スポット照明 / ストロボ)
const int PIN_RELAY_2    = 22; // リレー2 (ギミック用リレー)
const int PIN_STATUS_LED = 2;  // 通信ステータスLED

const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// BLEサーバーおよびキャラクタリスティック
BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// 状態変数
bool stateRelay1 = false;
bool stateRelay2 = false;

// 出力更新
void applyStates() {
  digitalWrite(PIN_RELAY_1, stateRelay1 ? RELAY_ON : RELAY_OFF);
  digitalWrite(PIN_RELAY_2, stateRelay2 ? RELAY_ON : RELAY_OFF);
}

// レスポンス返信用関数
void sendBleResponse(String msg) {
  if (deviceConnected && pTxCharacteristic) {
    pTxCharacteristic->setValue(msg.c_str());
    pTxCharacteristic->notify();
  }
}

// 受信コマンド処理
void processCommand(const String& cmd) {
  String cleanCmd = cmd;
  cleanCmd.trim();
  if (cleanCmd.length() == 0) return;

  Serial.println("[BLE CMD] " + cleanCmd);

  // マイコンIDフィルタリング（指定がある場合は自機宛か判定）
  if (cleanCmd.indexOf("\"mcuId\":") >= 0) {
    if (cleanCmd.indexOf(TARGET_MCU_ID) < 0 && cleanCmd.indexOf("\"mcuId\":\"ALL\"") < 0) {
      Serial.println("[BLE IGNORE] Message is for different MCU.");
      return;
    }
  }

  // 1. 非常全点灯・アラーム
  if (cleanCmd.indexOf("emergency") >= 0 || cleanCmd.indexOf("alarm") >= 0) {
    stateRelay1 = true;
    stateRelay2 = true;
    applyStates();
    sendBleResponse("{\"mcu\":\"" TARGET_MCU_ID "\",\"status\":\"emergency_on\"}\n");
    return;
  }

  // 2. 全消灯 / 停止
  if (cleanCmd.indexOf("all_off") >= 0) {
    stateRelay1 = false;
    stateRelay2 = false;
    applyStates();
    sendBleResponse("{\"mcu\":\"" TARGET_MCU_ID "\",\"status\":\"all_off\"}\n");
    return;
  }

  // 3. 個別制御
  if (cleanCmd.indexOf("light") >= 0 || cleanCmd.indexOf("relay1") >= 0) {
    stateRelay1 = (cleanCmd.indexOf("true") >= 0 || cleanCmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_1, stateRelay1 ? RELAY_ON : RELAY_OFF);
    Serial.printf("[BLE STATE] Relay 1: %d\n", stateRelay1);
  }

  if (cleanCmd.indexOf("aux") >= 0 || cleanCmd.indexOf("relay2") >= 0) {
    stateRelay2 = (cleanCmd.indexOf("true") >= 0 || cleanCmd.indexOf("1") >= 0);
    digitalWrite(PIN_RELAY_2, stateRelay2 ? RELAY_ON : RELAY_OFF);
    Serial.printf("[BLE STATE] Relay 2: %d\n", stateRelay2);
  }

  sendBleResponse("{\"mcu\":\"" TARGET_MCU_ID "\",\"relay1\":" + String(stateRelay1) + ",\"relay2\":" + String(stateRelay2) + "}\n");
}

// 接続イベントコールバック
class ServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      digitalWrite(PIN_STATUS_LED, HIGH);
      Serial.println("[BLE] Client connected.");
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      digitalWrite(PIN_STATUS_LED, LOW);
      Serial.println("[BLE] Client disconnected. Restarting advertising...");
      pServer->startAdvertising();
    }
};

// 受信イベントコールバック
class ReceiveCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        String cmdStr = "";
        for (int i = 0; i < rxValue.length(); i++) {
          cmdStr += rxValue[i];
        }
        processCommand(cmdStr);
      }
    }
};

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n========================================================");
  Serial.printf(" GIONSAI 2026 - BLE Peripheral Node [%s]\n", TARGET_MCU_ID);
  Serial.println("========================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_RELAY_1, OUTPUT);
  pinMode(PIN_RELAY_2, OUTPUT);
  applyStates();

  // BLE初期化
  BLEDevice::init(BLE_DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // サービス作成
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // 送信(TX)キャラクタリスティック
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // 受信(RX)キャラクタリスティック
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  pRxCharacteristic->setCallbacks(new ReceiveCallbacks());

  // サービス開始
  pService->start();

  // アドバタイズ開始
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.printf("[BLE] Advertising started as \"%s\". Ready for pairing.\n", BLE_DEVICE_NAME);
}

String serialBuffer = "";

void loop() {
  // USBシリアルからの直接入力にも対応
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

  // 切断時の再アドバタイズ処理
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(20);
}
