/**
 * ============================================================================
 * GUARDIAN SMART HELMET - TRANSMITTER UNIT (TRANSMITTER -> APK & BIKE RELAY)
 * Target Hardware: ESP32 DevKit V1 (30-Pin)
 * Power Source: Direct USB 5V
 * ============================================================================
 * SENSOR CONNECTIONS:
 * - ESP32 VIN                        -> Red Rail (+5V)
 * - ESP32 GND                        -> Blue Rail (GND)
 * - MQ-3 Alcohol Sensor (AO/DO)      -> GPIO 34 (ADC1_CH6)
 * - TCRT5000 IR / Proximity (DO)    -> GPIO 13 (INPUT_PULLUP: LOW = Worn)
 * - MPU-6050 6-Axis IMU (I2C):
 *     * VCC                          -> ESP32 VIN (5V) or 3.3V
 *     * GND                          -> ESP32 GND
 *     * SCL                          -> GPIO 22
 *     * SDA                          -> GPIO 21
 *     * AD0                          -> ESP32 GND (Sets I2C Address to 0x68)
 * - Emergency SOS Cancel Button      -> GPIO 4  (INPUT_PULLUP to GND)
 * - Warning Active Piezo Buzzer      -> GPIO 19 (HIGH = Beep)
 * ============================================================================
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
#define IR_HELMET_PIN     13  // Digital Input for Helmet Proximity
#define SOS_CANCEL_PIN    4   // False-Alarm Cancel Push Button (LOW = Pressed)
#define BUZZER_PIN        19  // Active Piezo Warning Buzzer

// SENSOR POLARITY CONFIGURATIONS
// 1. IR Helmet Sensor: LOW = Obstacle (head) detected on standard TCRT5000. Change to HIGH if your sensor is Active-HIGH.
#define IR_WORN_LEVEL     LOW

// 2. MQ-3 Alcohol Sensor Polarity:
// Maps clean air (high raw ADC) to 0 (SOBER), and alcohol exposure (low raw ADC) to high ADC (>800 = DRUNK).
#define INVERT_ALCOHOL_POLARITY true

// SAFETY THRESHOLDS
const int ALCOHOL_THRESHOLD_ADC      = 800;   // >= 800 ADC = Intoxicated
const float CRASH_THRESHOLD_G        = 2.20;  // >= 2.2G = Moderate Impact (3s cancel window)
const float CRASH_INSTANT_TRIGGER_G  = 3.50;  // >= 3.5G = High-Speed Crash (Immediate SOS)
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
bool rawMpuMode = false;      // True if direct Wire fallback is used (supports all MPU-6050/6500 clones)
uint8_t activeMpuAddr = 0x68;  // Active I2C address (0x68 or 0x69)

bool isCrashAlertActive = false;
unsigned long crashDetectedTime = 0;
bool sosTransmittedToApp = false;
unsigned long cancelPressStart = 0;
float peakImpactG = 1.0;      // Latched peak G-force during impact

// BUZZER STATE TRACKING
bool previousHelmetWorn = false;
bool isSingleBeepActive = false;
unsigned long singleBeepStartTime = 0;

// TELEMETRY PACKET DATA STRUCTURE FOR ESP-NOW
struct GuardianTelemetryPacket {
  bool helmetWorn;       // true = Worn on head, false = Removed
  int alcoholAdc;        // Processed MQ-3 reading (0 - 4095)
  float totalG;          // Vector G-force impact
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

    void onConnect(BLEServer* pServer, esp_ble_gatts_cb_param_t *param) {
      deviceConnected = true;
      negotiatedMTU = 23;
      Serial.println("\n📱 [BLE] Guardian Phone/App Connected! (Core 3.x callback)");
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("\n📱 [BLE] Phone Disconnected. Advertising restarted.");
      delay(100);
      pServer->getAdvertising()->start();
    }

    void onDisconnect(BLEServer* pServer, esp_ble_gatts_cb_param_t *param) {
      deviceConnected = false;
      Serial.println("\n📱 [BLE] Phone Disconnected (Core 3.x callback). Advertising restarted.");
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

// -------------------------------------------------------------
// I2C BUS SCANNER & MPU INITIALIZATION (Dual Mode)
// -------------------------------------------------------------
void scanI2CBus() {
  Serial.println("🔍 [I2C Scanner] Scanning bus on SDA:GPIO 21, SCL:GPIO 22...");
  byte found = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("   📍 [I2C Device Found] Address: 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) {
    Serial.println("   ❌ [I2C Device NOT Found] No devices responded!");
    Serial.println("      -> Check wiring: MPU VCC to VIN (5V) or 3.3V, GND to GND, SCL to GPIO 22, SDA to GPIO 21, AD0 to GND.");
  } else {
    Serial.printf("   ✅ [I2C Scan Complete] Found %d device(s).\n", found);
  }
}

bool rawMpuWake(uint8_t addr) {
  // Wake up MPU (clear SLEEP bit in PWR_MGMT_1 register 0x6B)
  Wire.beginTransmission(addr);
  Wire.write(0x6B);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;

  delay(20);

  // Set Accelerometer Range to +/- 8G (register 0x1C = 0x10)
  Wire.beginTransmission(addr);
  Wire.write(0x1C);
  Wire.write(0x10);
  if (Wire.endTransmission() != 0) return false;

  activeMpuAddr = addr;
  rawMpuMode = true;
  mpuAvailable = true;
  Serial.printf("✅ Direct Wire I2C MPU Initialized at 0x%02X (Range: ±8G).\n", addr);
  return true;
}

bool initMpuSensor() {
  // 1. Try Adafruit MPU6050 driver (at 0x68, then 0x69)
  if (mpu.begin(0x68) || mpu.begin(0x69)) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    mpuAvailable = true;
    rawMpuMode = false;
    Serial.println("✅ Adafruit MPU-6050 6-Axis IMU Initialized (Range: ±8G).");
    return true;
  }

  // 2. Fallback: Direct Wire register wake-up (works with all MPU-6050/6500 clones even if WHO_AM_I is 0x70/0x72/0x98)
  if (rawMpuWake(0x68) || rawMpuWake(0x69)) {
    return true;
  }

  mpuAvailable = false;
  return false;
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
  scanI2CBus();
  initMpuSensor();

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
  // Helmet IR reading
  int irRaw = digitalRead(IR_HELMET_PIN);
  bool helmetWorn = (irRaw == IR_WORN_LEVEL);

  // MQ-3 Alcohol reading with polarity correction
  int rawAdc = analogRead(MQ3_ALCOHOL_PIN);
  int alcoholRaw;
  if (INVERT_ALCOHOL_POLARITY) {
    // Reverse condition: when sensor output drops on alcohol exposure, map to standard rising scale
    alcoholRaw = 4095 - rawAdc;
    if (alcoholRaw < 0) alcoholRaw = 0;
  } else {
    alcoholRaw = rawAdc;
  }
  bool isDrunk = (alcoholRaw >= ALCOHOL_THRESHOLD_ADC);

  // MPU-6050 Accelerometer Reading (with auto-retry and periodic I2C scan if disconnected)
  static unsigned long lastMpuRetry = 0;
  if (!mpuAvailable && (millis() - lastMpuRetry >= 3000)) {
    lastMpuRetry = millis();
    scanI2CBus();
    initMpuSensor();
  }

  float totalG = 1.0;
  if (mpuAvailable) {
    if (!rawMpuMode) {
      sensors_event_t a, g, temp;
      if (mpu.getEvent(&a, &g, &temp)) {
        totalG = sqrt(a.acceleration.x * a.acceleration.x +
                      a.acceleration.y * a.acceleration.y +
                      a.acceleration.z * a.acceleration.z) / 9.80665;
      }
    } else {
      // Direct raw I2C read from registers 0x3B..0x40
      Wire.beginTransmission(activeMpuAddr);
      Wire.write(0x3B);
      if (Wire.endTransmission(false) == 0 && Wire.requestFrom(activeMpuAddr, (uint8_t)6) == 6) {
        int16_t rx = (Wire.read() << 8) | Wire.read();
        int16_t ry = (Wire.read() << 8) | Wire.read();
        int16_t rz = (Wire.read() << 8) | Wire.read();
        // Scale for +/- 8G: 4096 LSB/g
        float ax = (float)rx / 4096.0;
        float ay = (float)ry / 4096.0;
        float az = (float)rz / 4096.0;
        totalG = sqrt(ax * ax + ay * ay + az * az);
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CRASH IMPACT DETECTION LOGIC (WITH PEAK LATCH)
  // -------------------------------------------------------------
  if (totalG >= CRASH_INSTANT_TRIGGER_G && !sosTransmittedToApp) {
    isCrashAlertActive = true;
    sosTransmittedToApp = true;
    if (totalG > peakImpactG) peakImpactG = totalG;
    Serial.printf("\n💥 [CRITICAL CRASH DETECTED] Force: %.2fG! IMMEDIATE SOS!\n", totalG);
  } else if (totalG >= CRASH_THRESHOLD_G && !isCrashAlertActive && !sosTransmittedToApp) {
    isCrashAlertActive = true;
    crashDetectedTime = millis();
    sosTransmittedToApp = false;
    if (totalG > peakImpactG) peakImpactG = totalG;
    Serial.printf("\n🚨 [MODERATE IMPACT] Force: %.2fG! 3s abort window active.\n", totalG);
  } else if (isCrashAlertActive || sosTransmittedToApp) {
    if (totalG > peakImpactG) peakImpactG = totalG;
  }

  // False-Alarm Cancel Button (Instant cancel during 3s window, or 1.5s hold to reset SOS)
  if (digitalRead(SOS_CANCEL_PIN) == LOW) {
    if (cancelPressStart == 0) cancelPressStart = millis();
    
    if (isCrashAlertActive && !sosTransmittedToApp) {
      isCrashAlertActive = false;
      peakImpactG = 1.0;
      Serial.println("🛑 [FALSE ALARM] SOS cancelled during grace window.");
    } else if (sosTransmittedToApp && (millis() - cancelPressStart >= 1500)) {
      isCrashAlertActive = false;
      sosTransmittedToApp = false;
      peakImpactG = 1.0;
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
  // 3. CONTINUOUS BUZZER ALARM LOGIC
  // -------------------------------------------------------------
  if (sosTransmittedToApp) {
    digitalWrite(BUZZER_PIN, HIGH); // Continuous siren on Crash SOS
  } else if (isDrunk) {
    digitalWrite(BUZZER_PIN, HIGH); // BEEP CONTINUOUSLY WHEN ALCOHOL DETECTED
    isSingleBeepActive = false;
  } else if (helmetWorn && !previousHelmetWorn) {
    isSingleBeepActive = true;
    singleBeepStartTime = millis();
    digitalWrite(BUZZER_PIN, HIGH);
    Serial.println("🔔 [HELMET WORN] Sober rider detected -> Single confirmation beep.");
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

  // The G-force reported over BLE/ESP-NOW: reports latched peak impact during crash, otherwise real-time G
  float reportedG = (isCrashAlertActive || sosTransmittedToApp) ? peakImpactG : totalG;

  // -------------------------------------------------------------
  // 4. SEND UNICAST TELEMETRY TO BIKE RECEIVER (ESP-NOW @ 10Hz)
  // -------------------------------------------------------------
  static unsigned long lastEspNowSend = 0;
  if (millis() - lastEspNowSend >= 100) {
    lastEspNowSend = millis();
    currentPacket.helmetWorn = helmetWorn;
    currentPacket.alcoholAdc = alcoholRaw;
    currentPacket.totalG = reportedG;
    currentPacket.isCrashTriggered = sosTransmittedToApp;

    esp_now_send(receiverMAC, (uint8_t *) &currentPacket, sizeof(currentPacket));
  }

  // -------------------------------------------------------------
  // 5. STREAM CONTINUOUS TELEMETRY TO PHONE APK / SITE (BLE @ 6Hz)
  // -------------------------------------------------------------
  bool isClientConnected = deviceConnected || (pServer != NULL && pServer->getConnectedCount() > 0);

  if (pCharacteristic != NULL) {
    char jsonBuffer[140];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
             "{\"h\":%d,\"a\":%d,\"g\":%.2f,\"c\":%d,\"helmet\":%s,\"alcohol\":%d,\"gForce\":%.2f,\"crash\":%s}\n",
             helmetWorn ? 1 : 0,
             alcoholRaw,
             reportedG,
             sosTransmittedToApp ? 1 : 0,
             helmetWorn ? "true" : "false",
             alcoholRaw,
             reportedG,
             sosTransmittedToApp ? "true" : "false");

    // ALWAYS update characteristic value so any BLE Read returns live data!
    pCharacteristic->setValue((uint8_t*)jsonBuffer, strlen(jsonBuffer));

    // Send notify if client is connected
    static unsigned long lastBleNotify = 0;
    if (isClientConnected && (millis() - lastBleNotify >= 150)) {
      lastBleNotify = millis();
      pCharacteristic->notify();
    }
  }

  // -------------------------------------------------------------
  // 6. SERIAL MONITOR TELEMETRY LOG (Every 500ms)
  // -------------------------------------------------------------
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();
    const char* mpuStatus = mpuAvailable ? (rawMpuMode ? "OK(RAW)" : "OK") : "DISCONNECTED";
    Serial.printf("[HELMET TX] IR(13):%d [%s] | Alcohol: raw=%4d -> %4d [%s] | Impact: %5.2fG (Peak:%5.2fG) | MPU:%s | BLE:%s\n",
                  irRaw,
                  helmetWorn ? "WORN" : "REMOVED",
                  rawAdc,
                  alcoholRaw,
                  isDrunk ? "DRUNK! 🍺" : "SOBER ✅",
                  totalG,
                  reportedG,
                  mpuStatus,
                  isClientConnected ? "CONNECTED" : "WAITING");
  }

  delay(20);
}
