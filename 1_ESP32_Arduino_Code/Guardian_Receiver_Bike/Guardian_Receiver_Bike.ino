/**
 * ============================================================================
 * GUARDIAN SMART HELMET - BIKE RECEIVER & IGNITION INTERLOCK CONTROLLER
 * Target Hardware: ESP32 DevKit V1 (30-Pin)
 * Power Source: 5V DC (Bike Battery / USB)
 * ============================================================================
 * HARDWARE CONNECTIONS:
 * - ESP32 VIN                        -> +5V Power
 * - ESP32 GND                        -> Ground (GND)
 * - Relay Module (Signal IN)         -> GPIO 18 (HIGH = Ignition UNLOCKED / ON)
 * - 0.96" I2C OLED Display (Optional) -> SDA = GPIO 21, SCL = GPIO 22
 * 
 * SAFETY IGNITION INTERLOCK RULE:
 * Ignition unlocks ONLY IF:
 * 1. Helmet is Worn (true)
 * 2. Rider is Sober (alcohol < 800 ADC)
 * 3. No Crash Triggered (false)
 * 
 * If ANY condition fails or the wireless signal is lost, the Relay cuts off!
 * ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// PIN DEFINITION
#define RELAY_IGNITION_PIN  18  // Motor / Ignition Relay (Active HIGH)

// OPTIONAL OLED DISPLAY (128x64 I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool oledAvailable = false;

// SENSOR DATA RECEIVED FROM HELMET VIA ESP-NOW
struct GuardianTelemetryPacket {
  bool helmetWorn;       // true = Worn, false = Removed
  int alcoholAdc;        // Raw MQ-3 reading
  float totalG;          // Impact force in Gs
  bool isCrashTriggered; // Crash confirmed
};

GuardianTelemetryPacket helmetData;
unsigned long lastPacketReceived = 0;
const unsigned long HELMET_TIMEOUT_MS = 2500; // If helmet turns off or goes out of range

// ESP-NOW Receive Callback (Supports ESP32 Core 2.x & Core 3.x)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len == sizeof(GuardianTelemetryPacket)) {
    memcpy(&helmetData, incomingData, sizeof(helmetData));
    lastPacketReceived = millis();

    // Instant Zero-Delay Safety Action on Crash (< 5ms)
    if (helmetData.isCrashTriggered) {
      digitalWrite(RELAY_IGNITION_PIN, LOW); // Immediate engine cutoff
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==============================================");
  Serial.println("  GUARDIAN - BIKE RECEIVER & IGNITION UNIT");
  Serial.println("  \"Your Silent Co-Rider for Life & Safety.\"");
  Serial.println("==============================================");

  // Configure Relay (Locked by default for safety)
  pinMode(RELAY_IGNITION_PIN, OUTPUT);
  digitalWrite(RELAY_IGNITION_PIN, LOW);

  // Initialize OLED Display (Optional)
  Wire.begin(21, 22);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(15, 20);
    display.println("GUARDIAN BIKE UNIT");
    display.setCursor(5, 35);
    display.println("Waiting for Helmet...");
    display.display();
  }

  // Initialize ESP-NOW Radio
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ ESP-NOW initialization failed!");
  } else {
    Serial.println("✅ ESP-NOW Wireless Receiver Active.");
    esp_now_register_recv_cb(OnDataRecv);
  }

  Serial.println("🚀 Bike Receiver Ready. Waiting for Helmet signal...\n");
}

void loop() {
  // Check if wireless link from Helmet Transmitter is alive
  bool helmetLinkActive = (millis() - lastPacketReceived < HELMET_TIMEOUT_MS);

  bool isHelmetWorn = helmetLinkActive && helmetData.helmetWorn;
  bool isAlcoholSafe = helmetLinkActive && (helmetData.alcoholAdc < 800);
  bool isNoCrash = !helmetData.isCrashTriggered;

  // THREE-TIER SAFETY INTERLOCK:
  // Ignition is unlocked ONLY IF helmet is on, alcohol is sober, and no crash occurred
  bool ignitionAllowed = isHelmetWorn && isAlcoholSafe && isNoCrash;

  if (ignitionAllowed) {
    digitalWrite(RELAY_IGNITION_PIN, HIGH); // Relay Closed -> Engine Active / Unlocked ✅
  } else {
    digitalWrite(RELAY_IGNITION_PIN, LOW);  // Relay Open -> Engine Disabled / Cutoff 🛑
  }

  // Update Bike OLED Display if connected
  if (oledAvailable) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(">> GUARDIAN BIKE HUD <<");

    display.setCursor(0, 14);
    display.printf("Helmet : %s", !helmetLinkActive ? "DISCONNECTED" : (helmetData.helmetWorn ? "WORN [OK]" : "NOT WORN [X]"));

    display.setCursor(0, 26);
    display.printf("Alcohol: %d (%s)", helmetData.alcoholAdc, (helmetData.alcoholAdc >= 800 ? "DRUNK!" : "SOBER"));

    display.setCursor(0, 38);
    display.printf("Impact : %.2fG", helmetData.totalG);

    display.setCursor(0, 50);
    if (helmetData.isCrashTriggered) {
      display.print("IGNITION: CRASH CUTOFF 🚨");
    } else if (!isHelmetWorn) {
      display.print("IGNITION: LOCKED (NO HELMET)");
    } else if (!isAlcoholSafe) {
      display.print("IGNITION: LOCKED (DRUNK)");
    } else {
      display.print("IGNITION: UNLOCKED [ON] ✅");
    }
    display.display();
  }

  // Serial Monitor Status Log (Every 500ms)
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();
    Serial.printf("[BIKE RX] Link: %s | Helmet: %s | Alcohol: %4d | Relay: %s\n",
                  helmetLinkActive ? "ONLINE ✅" : "OFFLINE ⚠️",
                  helmetData.helmetWorn ? "WORN" : "REMOVED",
                  helmetData.alcoholAdc,
                  ignitionAllowed ? "UNLOCKED [ON] ✅" : "LOCKED [OFF] 🛑");
  }

  delay(30); // Responsive 33Hz loop
}
