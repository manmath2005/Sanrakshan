/**
 * ============================================================================
 * GUARDIAN SMART HELMET - TRANSMITTER UNIT (TRANSMITTER -> APK & BIKE RELAY)
 * Target Hardware: ESP32 DevKit V1 (30-Pin)
 * Power Source: Direct USB 5V
 * ============================================================================
 * SENSOR CONNECTIONS:
 * - ESP32 VIN                        -> Red Rail (+5V)
 * - ESP32 GND                        -> Blue Rail (GND)
 * - MQ-3 Alcohol Sensor (AO)         -> GPIO 34 (ADC1_CH6)
 * - TCRT5000 IR / Ultrasonic (DO)    -> GPIO 13 (INPUT_PULLUP: LOW = Worn)
 * - MPU-6050 6-Axis IMU (I2C)        -> SDA = GPIO 21, SCL = GPIO 22
 * - Emergency SOS Cancel Button      -> GPIO 4  (INPUT_PULLUP to GND)
 * - Warning Active Piezo Buzzer      -> GPIO 19 (HIGH = Beep)
 * 
 * BUZZER LOGIC:
 * 1. Rider wears helmet & Sober      -> Buzzer beeps ONCE (180ms confirmation)
 * 2. Rider is Drunk (>= 800 ADC)     -> Buzzer beeps CONTINUOUSLY until level drops
 * 3. Crash Detected (>= 4.0G)        -> Buzzer beeps CONTINUOUSLY (SOS alarm)
 * 4. Helmet Removed                  -> Buzzer is OFF
 * 
 * WIRELESS TRANSMISSION:
 * 1. Bluetooth Low Energy (BLE): Direct real-time link to Guardian APK (50ms rate)
 * 2. ESP-NOW Broadcast: Sub-millisecond radio link to Bike Receiver Ignition Relay
 * ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
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

// BLE DEFINITIONS (Matches Guardian Android App)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;

// SENSOR & STATE VARIABLES
Adafruit_MPU6050 mpu;
bool mpuAvailable = false;
bool isCrashAlertActive = false;
unsigned long crashDetectedTime = 0;
bool sosTransmittedToApp = false;

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

// ESP-NOW Universal Broadcast Peer Configuration
esp_now_peer_info_t peerInfo;
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// BLE CONNECTION CALLBACKS
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("\n📱 [BLE] Guardian Android Phone Connected to Helmet!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("\n📱 [BLE] Phone Disconnected. Advertising restarted.");
      pServer->getAdvertising()->start();
    }
};

void initBLE() {
  BLEDevice::init("Guardian_Helmet");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );

  pCharacteristic->addDescriptor(new BLE2902());
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
  Serial.println("  🛡️  GUARDIAN SMART HELMET - TRANSMITTER UNIT (USB)");
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
  if (!mpu.begin()) {
    Serial.println("⚠️ [WARN] MPU-6050 not detected. Check I2C wiring (SDA:21, SCL:22, VCC, GND).");
    mpuAvailable = false;
  } else {
    mpuAvailable = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("✅ MPU-6050 6-Axis IMU Initialized (Range: ±8G).");
  }

  // 4. Wi-Fi Station Mode for ESP-NOW (No router needed)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ [ERROR] ESP-NOW initialization failed!");
  } else {
    Serial.println("✅ ESP-NOW Wireless Protocol Active.");
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;  
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) == ESP_OK) {
      Serial.println("✅ Universal Broadcast Peer Registered for Bike Unit.");
    }
  }

  // 5. Initialize BLE Server for Android Phone APK
  initBLE();

  // 6. Startup Sound Check (Dual Chirp)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);
  delay(60);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("🚀 System Ready. Streaming live telemetry to APK & Bike Unit...\n");
}

void loop() {
  // -------------------------------------------------------------
  // 1. SENSOR READINGS
  // -------------------------------------------------------------
  // IR Sensor: LOW = Skin detected / Helmet Worn
  bool helmetWorn = (digitalRead(IR_HELMET_PIN) == LOW);

  // MQ-3 Breath Alcohol ADC reading
  int alcoholRaw = analogRead(MQ3_ALCOHOL_PIN);
  bool isDrunk = (alcoholRaw >= ALCOHOL_THRESHOLD_ADC);

  // MPU-6050 Vector G-Force impact reading
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
  // 2. CRASH IMPACT DETECTION LOGIC
  // -------------------------------------------------------------
  if (totalG >= CRASH_INSTANT_TRIGGER_G) {
    // Severe accident (>= 4.0G) -> Immediate SOS
    isCrashAlertActive = true;
    sosTransmittedToApp = true;
    Serial.printf("\n💥 [CRITICAL CRASH DETECTED] Force: %.2fG! IMMEDIATE SOS!\n", totalG);
  } else if (totalG >= CRASH_THRESHOLD_G && !isCrashAlertActive) {
    // Moderate impact (2.5G - 4.0G) -> 3-second grace window to cancel bumps
    isCrashAlertActive = true;
    crashDetectedTime = millis();
    sosTransmittedToApp = false;
    Serial.printf("\n🚨 [MODERATE IMPACT] Force: %.2fG! 3s abort window active.\n", totalG);
  }

  // False-Alarm Cancel Button
  if (isCrashAlertActive && !sosTransmittedToApp && digitalRead(SOS_CANCEL_PIN) == LOW) {
    isCrashAlertActive = false;
    sosTransmittedToApp = false;
    Serial.println("🛑 [FALSE ALARM] SOS cancelled by rider button.");
    delay(300); // Debounce
  }

  // Confirm crash after countdown window
  if (isCrashAlertActive && !sosTransmittedToApp) {
    if (millis() - crashDetectedTime >= CANCEL_WINDOW_MS) {
      sosTransmittedToApp = true;
      Serial.println("🚨 [CRASH CONFIRMED] Countdown expired -> SOS Active!");
    }
  }

  // -------------------------------------------------------------
  // 3. EXACT BUZZER LOGIC
  // -------------------------------------------------------------
  // A. Transition check: Rider just wore the helmet
  if (helmetWorn && !previousHelmetWorn) {
    if (!isDrunk) {
      // Alcohol NOT found -> Beep ONCE (180ms confirmation beep)
      isSingleBeepActive = true;
      singleBeepStartTime = millis();
      digitalWrite(BUZZER_PIN, HIGH);
      Serial.println("🔔 [HELMET WORN] Sober rider detected -> Single confirmation beep.");
    }
  }

  // B. Buzzer Priority Outputs:
  if (sosTransmittedToApp) {
    // Case 1: Crash confirmed -> Beep CONTINUOUSLY!
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (helmetWorn && isDrunk) {
    // Case 2: Rider is DRUNK -> Beep CONTINUOUSLY until alcohol lowers!
    digitalWrite(BUZZER_PIN, HIGH);
    isSingleBeepActive = false; // Cancel any single beep
  } else if (isSingleBeepActive) {
    // Case 3: Finishing the single confirmation beep (180ms)
    if (millis() - singleBeepStartTime < 180) {
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(BUZZER_PIN, LOW);
      isSingleBeepActive = false;
    }
  } else {
    // Case 4: Normal / Safe / Helmet Removed -> Buzzer OFF
    digitalWrite(BUZZER_PIN, LOW);
  }

  previousHelmetWorn = helmetWorn;

  // -------------------------------------------------------------
  // 4. BROADCAST TELEMETRY TO BIKE RECEIVER (ESP-NOW)
  // -------------------------------------------------------------
  currentPacket.helmetWorn = helmetWorn;
  currentPacket.alcoholAdc = alcoholRaw;
  currentPacket.totalG = totalG;
  currentPacket.isCrashTriggered = sosTransmittedToApp;

  esp_now_send(broadcastAddress, (uint8_t *) &currentPacket, sizeof(currentPacket));

  // -------------------------------------------------------------
  // 5. STREAM CONTINUOUS TELEMETRY TO PHONE APK (BLE)
  // -------------------------------------------------------------
  static unsigned long lastBleNotify = 0;
  if (deviceConnected && pCharacteristic != NULL && (millis() - lastBleNotify >= 50)) {
    lastBleNotify = millis();
    char jsonBuffer[128];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
             "{\"helmet\":%s,\"alcohol\":%d,\"gForce\":%.2f,\"crash\":%s}",
             helmetWorn ? "true" : "false",
             alcoholRaw,
             totalG,
             sosTransmittedToApp ? "true" : "false");

    pCharacteristic->setValue(jsonBuffer);
    pCharacteristic->notify();
  }

  // -------------------------------------------------------------
  // 6. SERIAL MONITOR TELEMETRY LOG (Every 400ms)
  // -------------------------------------------------------------
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 400) {
    lastPrint = millis();
    Serial.printf("[HELMET TX] Worn: %s | Alcohol: %4d ADC (%s) | Impact: %5.2fG | BLE: %s | Status: %s\n",
                  helmetWorn ? "YES ✅" : "NO ⚠️",
                  alcoholRaw,
                  isDrunk ? "DRUNK 🛑" : "SOBER ✅",
                  totalG,
                  deviceConnected ? "CONNECTED 📱" : "WAITING 📡",
                  sosTransmittedToApp ? "CRASH SOS 🚨" : (isDrunk ? "DRUNK ALARM 🛑" : "SAFE ✅"));
  }

  delay(25); // ~40Hz loop for zero delay
}
