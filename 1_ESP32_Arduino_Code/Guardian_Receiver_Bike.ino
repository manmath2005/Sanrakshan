/**
 * ============================================================================
 * GUARDIAN SMART HELMET - RECEIVER & BIKE IGNITION CONTROLLER
 * Project Motto: "Your Silent Co-Rider for Life & Safety."
 * Hardware: ESP32 DevKit V1
 * ============================================================================
 * ACTUATORS & HARDWARE MAPPING:
 * - Ignition Relay Output        -> GPIO 18 (HIGH = Ignition ON, LOW = Cutoff)
 * - Bike Warning Buzzer          -> GPIO 19
 * - SSD1306 OLED Display (0.96") -> I2C (SDA = GPIO 21, SCL = GPIO 22)
 * 
 * WIRELESS PROTOCOLS:
 * 1. ESP-NOW: Receives instantaneous sensor packets from the Helmet Unit
 * 2. BLE (Bluetooth Low Energy): Connects to the Guardian Android App
 *    - Advertises as: "Guardian_Helmet"
 *    - Service UUID:        4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *    - Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
 * ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// PIN DEFINITIONS
#define RELAY_IGNITION_PIN  18  // Motor / Ignition Relay (Active HIGH)
#define BUZZER_PIN          19  // Warning Alarm Buzzer

// OLED DISPLAY (128x64 I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// BLE DEFINITIONS (Matches Guardian Android App HelmetBleGattCallback.java)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;

// SENSOR DATA RECEIVED FROM HELMET
struct GuardianTelemetryPacket {
  bool helmetWorn;       // true = Worn, false = Off
  int alcoholAdc;        // Raw MQ-3 reading
  float totalG;          // Impact force in Gs
  bool isCrashTriggered; // Crash confirmed
};

GuardianTelemetryPacket helmetData;
unsigned long lastPacketReceived = 0;
const unsigned long HELMET_TIMEOUT_MS = 3000; // If helmet turns off or disconnects

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("📱 [BLE] Guardian Android Phone Connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("📱 [BLE] Phone Disconnected. Advertising restarted.");
      pServer->getAdvertising()->start();
    }
};

// Callback when ESP-NOW data is received from Helmet Transmitter (Supports Core 2.x & 3.x)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len == sizeof(GuardianTelemetryPacket)) {
    memcpy(&helmetData, incomingData, sizeof(helmetData));
    lastPacketReceived = millis();

    // Instant Zero-Delay Hardware Safety Action & BLE Push (< 20ms)
    if (helmetData.isCrashTriggered) {
      digitalWrite(RELAY_IGNITION_PIN, LOW); // Immediate engine cutoff
      digitalWrite(BUZZER_PIN, HIGH);        // Immediate alarm
      if (deviceConnected && pCharacteristic != NULL) {
        char jsonBuffer[128];
        snprintf(jsonBuffer, sizeof(jsonBuffer),
                 "{\"helmet\":%s,\"alcohol\":%d,\"gForce\":%.2f,\"crash\":true}",
                 helmetData.helmetWorn ? "true" : "false",
                 helmetData.alcoholAdc,
                 helmetData.totalG);
        pCharacteristic->setValue(jsonBuffer);
        pCharacteristic->notify();
      }
    }
  }
}

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
  delay(500);
  Serial.println("\n==============================================");
  Serial.println("  GUARDIAN - BIKE RECEIVER & RELAY CONTROLLER");
  Serial.println("  \"Your Silent Co-Rider for Life & Safety.\"");
  Serial.println("==============================================");

  // Configure Relays & Buzzers
  pinMode(RELAY_IGNITION_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_IGNITION_PIN, LOW); // Locked by default for safety
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize OLED Display
  Wire.begin(21, 22);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(15, 20);
    display.println("GUARDIAN BIKE HUD");
    display.setCursor(5, 35);
    display.println("Waiting for Helmet...");
    display.display();
  }

  // Initialize ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ ESP-NOW initialization failed!");
  } else {
    Serial.println("✅ ESP-NOW Receiver Active.");
    esp_now_register_recv_cb(OnDataRecv);
  }

  // Initialize BLE Server
  initBLE();

  // Startup Chirp
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  bool helmetLinkActive = (millis() - lastPacketReceived < HELMET_TIMEOUT_MS);

  bool isHelmetWorn = helmetLinkActive && helmetData.helmetWorn;
  bool isAlcoholSafe = helmetLinkActive && (helmetData.alcoholAdc < 800);
  bool isNoCrash = !helmetData.isCrashTriggered;

  // 1. THREE-TIER SAFETY INTERLOCK DECISION
  // Engine is unlocked ONLY IF helmet is on, alcohol is sober, and no crash occurred
  bool ignitionAllowed = isHelmetWorn && isAlcoholSafe && isNoCrash;

  if (ignitionAllowed) {
    digitalWrite(RELAY_IGNITION_PIN, HIGH); // Relay Closed -> Ignition Active
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(RELAY_IGNITION_PIN, LOW);  // Relay Cutoff -> Engine Disabled
  }

  // 2. TRANSMIT TELEMETRY TO ANDROID APP VIA BLE
  if (deviceConnected && pCharacteristic != NULL) {
    // Construct standardized JSON telemetry packet for Guardian APK
    char jsonBuffer[128];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
             "{\"helmet\":%s,\"alcohol\":%d,\"gForce\":%.2f,\"crash\":%s}",
             isHelmetWorn ? "true" : "false",
             helmetData.alcoholAdc,
             helmetData.totalG,
             helmetData.isCrashTriggered ? "true" : "false");

    pCharacteristic->setValue(jsonBuffer);
    pCharacteristic->notify();
  }

  // 3. UPDATE BIKE OLED HUD
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(">> GUARDIAN HUD <<");

  display.setCursor(0, 14);
  display.printf("Helmet : %s", !helmetLinkActive ? "DISCONNECTED" : (helmetData.helmetWorn ? "WORN [OK]" : "NOT WORN [X]"));

  display.setCursor(0, 26);
  display.printf("Alcohol: %d (%s)", helmetData.alcoholAdc, (helmetData.alcoholAdc >= 800 ? "DRUNK!" : "SOBER"));

  display.setCursor(0, 38);
  display.printf("Impact : %.2fG", helmetData.totalG);

  display.setCursor(0, 50);
  if (helmetData.isCrashTriggered) {
    display.print("STATUS : ! CRASH SOS !");
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (!isHelmetWorn) {
    display.print("IGNITION: LOCKED (HELMET)");
  } else if (!isAlcoholSafe) {
    display.print("IGNITION: LOCKED (DRUNK)");
  } else {
    display.print("IGNITION: UNLOCKED [ON]");
  }
  display.display();

  // 4. DEBUG SERIAL MONITOR
  Serial.printf("[BIKE RX] Link: %s | Relay: %s | App BLE: %s | G: %.2f | Crash: %s\n",
                helmetLinkActive ? "ACTIVE" : "OFFLINE",
                ignitionAllowed ? "UNLOCKED [ON] ✅" : "LOCKED [CUTOFF] 🛑",
                deviceConnected ? "CONNECTED" : "WAITING",
                helmetData.totalG,
                helmetData.isCrashTriggered ? "CRASH DETECTED!" : "NORMAL");

  delay(50); // 20Hz loop cycle for responsive bike telemetry and display
}
