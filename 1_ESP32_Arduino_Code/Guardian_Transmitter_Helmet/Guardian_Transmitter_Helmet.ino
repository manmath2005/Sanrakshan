/**
- ============================================================================
- GUARDIAN SMART HELMET - TRANSMITTER UNIT (TRANSMITTER -> APK & BIKE RELAY)
- Target Hardware: ESP32 DevKit V1 (30-Pin)
- Power Source: Direct USB 5V
- ============================================================================
- SENSOR CONNECTIONS:
- - ESP32 VIN                        -> Red Rail (+5V)
- - ESP32 GND                        -> Blue Rail (GND)
- - MQ-3 Alcohol Sensor (AO)         -> GPIO 34 (ADC1_CH6)
- - TCRT5000 IR / Ultrasonic (DO)    -> GPIO 13 (INPUT_PULLUP: LOW = Worn)
- - MPU-6050 6-Axis IMU (I2C)        -> SDA = GPIO 21, SCL = GPIO 22
- - Emergency SOS Cancel Button      -> GPIO 4  (INPUT_PULLUP to GND)
- - Warning Active Piezo Buzzer      -> GPIO 19 (HIGH = Beep)
- ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// PIN ASSIGNMENTS
#define MQ3_ALCOHOL_PIN   34  // Analog Input for Breath Alcohol
#define IR_HELMET_PIN     13  // Digital Input for Helmet Proximity (LOW = Worn)
#define SOS_CANCEL_PIN    4   // False-Alarm Cancel Push Button (LOW = Pressed)
#define BUZZER_PIN        19  // Active Piezo Warning Buzzer

// SAFETY THRESHOLDS
const int ALCOHOL_THRESHOLD_ADC      = 800;   // >= 800 ADC = Intoxicated
const float CRASH_THRESHOLD_G        = 2.50;  // >= 2.5G = Moderate Impact (3s cancel window)
const float CRASH_INSTANT_TRIGGER_G  = 4.00;  // >= 4.0G = High-Speed Crash (Immediate SOS)
const unsigned long CANCEL_WINDOW_MS = 3000;  // 3-second grace window to cancel bumps

// BLE DEFINITIONS (Matches Guardian Android App / Website)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
uint16_t negotiatedMTU = 23; // Default BLE MTU is 23 bytes (20 bytes payload)

// SENSOR & STATE VARIABLES
Adafruit_MPU6050 mpu;
bool mpuAvailable = false;
bool isCrashAlertActive = false;
unsigned long crashDetectedTime = 0;
bool sosTransmittedToApp = false;
unsigned long cancelPressStart = 0;

// BUZZER STATE TRACKING
bool previousHelmetWorn = false;
bool isSingleBeepActive = false;
unsigned long singleBeepStartTime = 0;

// TELEMETRY PACKET DATA STRUCTURE FOR ESP-NOW
struct GuardianTelemetryPacket {
  bool helmetWorn;       // true = Worn on head, false = Removed
  int alcoholAdc;        // Raw MQ-3 reading (0 - 4095)
  float totalG;          // Current vector G-force impact
  bool isCrashTriggered; // True if crash confirmed
};

GuardianTelemetryPacket currentPacket;

// ESP-NOW UNICAST MAC PAIRING (RECEIVER ESP32 MAC: D4:E9:F4:84:B5:04)
esp_now_peer_info_t peerInfo;
uint8_t receiverMAC[] = {0xD4, 0xE9, 0xF4, 0x84, 0xB5, 0x04};

// BLE CONNECTION & MTU CALLBACKS
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      negotiatedMTU = 23; // Reset to safe default until phone negotiates higher MTU
      Serial.println("\n📱 [BLE] Guardian Phone/App Connected!");
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("\n📱 [BLE] Phone Disconnected. Advertising restarted.");
      delay(100);
      pServer->getAdvertising()->start();
    }

    void onMtuChanged(BLEServer* pServer, esp_ble_gatts_cb_param_t* param) {
      negotiatedMTU = param->mtu.mtu;
      Serial.printf("📶 [BLE] Negotiated MTU Size: %d bytes\n", negotiatedMTU);
    }
};

void initBLE() {
  BLEDevice::init("Guardian_Helmet");
  BLEDevice::setMTU(512);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Use READ + NOTIFY only (INDICATE can stall if app doesn't send ACKs)
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setValue("{\"h\":0,\"a\":0,\"g\":1.0,\"c\":0}");
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("✅ BLE Server Active: Advertising as 'Guardian_Helmet'");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  🛡️  GUARDIAN SMART HELMET - TRANSMITTER UNIT (FIXED)");
  Serial.println("  \"Your Silent Co-Rider for Life & Safety.\"");
  Serial.println("=======================================================");

  // 1. Digital GPIO Configuration
  pinMode(IR_HELMET_PIN, INPUT_PULLUP);
  pinMode(SOS_CANCEL_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 2. Analog ADC Setup (11dB = Full 0 - 3.3V range for MQ-3)
  analogSetPinAttenuation(MQ3_ALCOHOL_PIN, ADC_11db);

  // 3. I2C Bus & MPU-6050 Initialization
  Wire.begin(21, 22);
  Wire.setTimeOut(100);
  if (!mpu.begin()) {
    Serial.println("⚠️ [WARN] MPU-6050 not detected. Check I2C wiring (SDA:21, SCL:22).");
    mpuAvailable = false;
  } else {
    mpuAvailable = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("✅ MPU-6050 6-Axis IMU Initialized (Range: ±8G).");
  }

  // 4. Wi-Fi Station Mode for ESP-NOW (Disable power save for BLE coexistence)
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_NONE);

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ [ERROR] ESP-NOW initialization failed!");
  } else {
    Serial.println("✅ ESP-NOW Wireless Protocol Active.");
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, receiverMAC, 6);
    peerInfo.channel = 0;  
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) == ESP_OK) {
      Serial.printf("✅ Paired Bike Receiver MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                    receiverMAC[0], receiverMAC[1], receiverMAC[2],
                    receiverMAC[3], receiverMAC[4], receiverMAC[5]);
    } else {
      Serial.println("❌ [ERROR] Failed to register Bike Receiver MAC peer!");
    }
  }

  // 5. Initialize BLE Server for Phone APK / Website
  initBLE();

  // 6. Startup Sound Check (Dual Chirp)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);
  delay(60);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("🚀 System Ready. Streaming live telemetry...\n");
}

void loop() {
  // -------------------------------------------------------------
  // 1. SENSOR READINGS
  // -------------------------------------------------------------
  bool helmetWorn = (digitalRead(IR_HELMET_PIN) == LOW);
  int alcoholRaw = analogRead(MQ3_ALCOHOL_PIN);
  bool isDrunk = (alcoholRaw >= ALCOHOL_THRESHOLD_ADC);

  float totalG = 1.0;
  if (mpuAvailable) {
    sensors_event_t a, g, temp;
    if (mpu.getEvent(&a, &g, &temp)) {
      totalG = sqrt(a.acceleration.x * a.acceleration.x +
                    a.acceleration.y * a.acceleration.y +
                    a.acceleration.z * a.acceleration.z) / 9.80665;
    }
  }

  // -------------------------------------------------------------
  // 2. CRASH IMPACT DETECTION LOGIC (FIXED)
  // -------------------------------------------------------------
  if (totalG >= CRASH_INSTANT_TRIGGER_G && !sosTransmittedToApp) {
    isCrashAlertActive = true;
    sosTransmittedToApp = true;
    Serial.printf("\n💥 [CRITICAL CRASH DETECTED] Force: %.2fG! IMMEDIATE SOS!\n", totalG);
  } else if (totalG >= CRASH_THRESHOLD_G && !isCrashAlertActive && !sosTransmittedToApp) {
    isCrashAlertActive = true;
    crashDetectedTime = millis();
    sosTransmittedToApp = false;
    Serial.printf("\n🚨 [MODERATE IMPACT] Force: %.2fG! 3s abort window active.\n", totalG);
  }

  // False-Alarm Cancel Button (Instant cancel during 3s window, or 1.5s hold to reset SOS)
  if (digitalRead(SOS_CANCEL_PIN) == LOW) {
    if (cancelPressStart == 0) cancelPressStart = millis();
    
    if (isCrashAlertActive && !sosTransmittedToApp) {
      isCrashAlertActive = false;
      Serial.println("🛑 [FALSE ALARM] SOS cancelled during grace window.");
    } else if (sosTransmittedToApp && (millis() - cancelPressStart >= 1500)) {
      isCrashAlertActive = false;
      sosTransmittedToApp = false;
      Serial.println("🛑 [SOS RESET] Confirmed SOS reset by 1.5s button hold.");
    }
  } else {
    cancelPressStart = 0;
  }

  // Confirm crash after 3-second countdown window
  if (isCrashAlertActive && !sosTransmittedToApp) {
    if (millis() - crashDetectedTime >= CANCEL_WINDOW_MS) {
      sosTransmittedToApp = true;
      Serial.println("🚨 [CRASH CONFIRMED] Countdown expired -> SOS Active!");
    }
  }

  // -------------------------------------------------------------
  // 3. EXACT BUZZER LOGIC
  // -------------------------------------------------------------
  if (helmetWorn && !previousHelmetWorn && !isDrunk) {
    isSingleBeepActive = true;
    singleBeepStartTime = millis();
    digitalWrite(BUZZER_PIN, HIGH);
    Serial.println("🔔 [HELMET WORN] Sober rider detected -> Single confirmation beep.");
  }

  if (sosTransmittedToApp) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (helmetWorn && isDrunk) {
    digitalWrite(BUZZER_PIN, HIGH);
    isSingleBeepActive = false;
  } else if (isSingleBeepActive) {
    if (millis() - singleBeepStartTime < 180) {
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(BUZZER_PIN, LOW);
      isSingleBeepActive = false;
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  previousHelmetWorn = helmetWorn;

  // -------------------------------------------------------------
  // 4. SEND UNICAST TELEMETRY TO BIKE RECEIVER (ESP-NOW @ 10Hz)
  // -------------------------------------------------------------
  static unsigned long lastEspNowSend = 0;
  if (millis() - lastEspNowSend >= 100) {
    lastEspNowSend = millis();
    currentPacket.helmetWorn = helmetWorn;
    currentPacket.alcoholAdc = alcoholRaw;
    currentPacket.totalG = totalG;
    currentPacket.isCrashTriggered = sosTransmittedToApp;

    esp_now_send(receiverMAC, (uint8_t *) &currentPacket, sizeof(currentPacket));
  }

  // -------------------------------------------------------------
  // 5. STREAM CONTINUOUS TELEMETRY TO PHONE APK / SITE (BLE @ 5Hz)
  // -------------------------------------------------------------
  static unsigned long lastBleNotify = 0;
  if (deviceConnected && pCharacteristic != NULL && (millis() - lastBleNotify >= 200)) {
    lastBleNotify = millis();
    char jsonBuffer[128];

    // If phone negotiated MTU >= 90 bytes, send full JSON; otherwise send valid <20-byte JSON
    if (negotiatedMTU >= 90) {
      snprintf(jsonBuffer, sizeof(jsonBuffer),
               "{\"h\":%d,\"a\":%d,\"c\":%d,\"helmet\":%s,\"alcohol\":%d,\"gForce\":%.2f,\"crash\":%s}\n",
               helmetWorn ? 1 : 0,
               alcoholRaw,
               sosTransmittedToApp ? 1 : 0,
               helmetWorn ? "true" : "false",
               alcoholRaw,
               totalG,
               sosTransmittedToApp ? "true" : "false");
    } else {
      // Strictly <= 20 bytes so it NEVER gets truncated on default BLE MTU!
      snprintf(jsonBuffer, sizeof(jsonBuffer),
               "{\"h\":%d,\"a\":%d,\"c\":%d}",
               helmetWorn ? 1 : 0,
               alcoholRaw,
               sosTransmittedToApp ? 1 : 0);
    }

    pCharacteristic->setValue((uint8_t*)jsonBuffer, strlen(jsonBuffer));
    pCharacteristic->notify();
  }

  // -------------------------------------------------------------
  // 6. SERIAL MONITOR TELEMETRY LOG (Every 500ms)
  // -------------------------------------------------------------
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();
    Serial.printf("[HELMET TX] Worn: %s | Alcohol: %4d (%s) | Impact: %5.2fG | BLE: %s (MTU:%d) | Status: %s\n",
                  helmetWorn ? "YES" : "NO ",
                  alcoholRaw,
                  isDrunk ? "DRUNK" : "SOBER",
                  totalG,
                  deviceConnected ? "CONNECTED" : "WAITING  ",
                  negotiatedMTU,
                  sosTransmittedToApp ? "CRASH SOS" : (isDrunk ? "DRUNK ALARM" : "SAFE"));
  }

  delay(20);
}