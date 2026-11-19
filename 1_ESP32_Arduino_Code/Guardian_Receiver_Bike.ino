/**
 * ============================================================================
 * GUARDIAN SMART HELMET - BIKE RECEIVER & IGNITION MOTOR CONTROLLER
 * Target Hardware: ESP32 DevKit V1 (30-Pin)
 * Power Source for ESP32: 5V USB / Power Bank / Buck Converter
 * Power Source for Motor: 1200mAh Rechargeable Li-ion Battery (3.7V - 4.2V)
 * ============================================================================
 * 
 * HARDWARE CONNECTIONS:
 * ----------------------------------------------------------------------------
 * 1. TEMPORARY IGNITION KEY SWITCH:
 *    - Switch Terminal 1   -> ESP32 GPIO 4
 *    - Switch Terminal 2   -> ESP32 GND
 *    (Uses internal INPUT_PULLUP: Switch ON/Closed = LOW, Switch OFF/Open = HIGH)
 * 
 * 2. MOTOR CONTROL OUTPUT (Relay / MOSFET / Transistor / Motor Driver):
 *    - Control Signal (IN) -> ESP32 GPIO 18 (Active HIGH: HIGH = Motor ON)
 * 
 * 3. 1200mAh Li-ion CELL & DC MOTOR POWER WIRING:
 *    - Li-ion Battery (+)  -> Relay COM (or Motor Driver VCC / MOSFET Drain)
 *    - Relay NO Terminal   -> DC Motor (+) Wire
 *    - DC Motor (-) Wire   -> Li-ion Battery (-) Wire
 *    - Li-ion Battery (-)  -> ESP32 GND  (⚠️ CRITICAL: COMMON GROUND REQUIRED!)
 * 
 * 4. OPTIONAL I2C OLED (128x64 0.96"):
 *    - OLED VCC            -> ESP32 3V3 (or VIN)
 *    - OLED GND            -> ESP32 GND
 *    - OLED SCL            -> ESP32 GPIO 22
 *    - OLED SDA            -> ESP32 GPIO 21
 * 
 * 5. STATUS INDICATOR:
 *    - Built-in Blue LED   -> ESP32 GPIO 2 (Solid ON = Motor Running, Blinking = Lockout)
 * ----------------------------------------------------------------------------
 * 
 * EXACT IGNITION MOTOR LOGIC:
 * 1. Switch ON + Helmet Worn + Rider Sober + No Crash  -> MOTOR RUNS! (Ignition Active)
 * 2. Switch ON + Rider is DRUNK                        -> MOTOR STAYS OFF! (Locked until sober)
 * 3. Switch ON + Helmet NOT Worn                       -> MOTOR STAYS OFF! (Must wear helmet)
 * 4. Switch ON + Crash Occurs                          -> MOTOR CUTS OFF INSTANTLY!
 * 5. Switch OFF                                        -> MOTOR OFF
 * ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// PIN ASSIGNMENTS
#define IGNITION_SWITCH_PIN 4   // Temporary Ignition Key Switch (INPUT_PULLUP to GND)
#define MOTOR_PIN           18  // Motor Relay / MOSFET Driver Signal (Active HIGH)
#define STATUS_LED_PIN      2   // Built-in Blue LED indicator

// SAFETY THRESHOLDS
const int ALCOHOL_THRESHOLD_ADC      = 800;   // >= 800 ADC = Intoxicated / Engine Locked
const unsigned long HELMET_TIMEOUT_MS = 2500;  // Lock motor if helmet transmitter loses power/range

// OPTIONAL OLED DISPLAY (128x64 I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool oledAvailable = false;

// TELEMETRY PACKET MATCHING HELMET TRANSMITTER
struct GuardianTelemetryPacket {
  bool helmetWorn;       // true = Worn on head, false = Removed
  int alcoholAdc;        // Raw MQ-3 reading (0 - 4095)
  float totalG;          // Vector G-force impact
  bool isCrashTriggered; // True if crash confirmed
};

GuardianTelemetryPacket helmetData = {false, 0, 1.0, false};
unsigned long lastPacketReceived = 0;
bool motorRunning = false;

// ESP-NOW Receive Callback (Compatible with ESP32 Core 2.x & 3.x)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len == sizeof(GuardianTelemetryPacket)) {
    memcpy(&helmetData, incomingData, sizeof(helmetData));
    lastPacketReceived = millis();

    // Instant Zero-Delay Crash Cutoff (< 5ms)
    if (helmetData.isCrashTriggered) {
      digitalWrite(MOTOR_PIN, LOW);
      digitalWrite(STATUS_LED_PIN, LOW);
      motorRunning = false;
    }
  }
}

void updateOledDisplay(bool switchOn, bool isDrunk, bool isSafe, const char* lockReason) {
  if (!oledAvailable) return;

  display.clearDisplay();
  display.setTextColor(WHITE);

  // Header
  display.setTextSize(1);
  display.setCursor(10, 0);
  display.println("GUARDIAN BIKE UNIT");
  display.drawLine(0, 10, 127, 10, WHITE);

  // Line 1: Ignition Switch
  display.setCursor(0, 15);
  display.printf("SWITCH : %s", switchOn ? "ON [CLOSED]" : "OFF [OPEN]");

  // Line 2: Helmet Status
  display.setCursor(0, 26);
  display.printf("HELMET : %s", helmetData.helmetWorn ? "WORN [OK]" : "REMOVED [X]");

  // Line 3: Alcohol
  display.setCursor(0, 37);
  display.printf("ALCOHOL: %4d (%s)", helmetData.alcoholAdc, isDrunk ? "DRUNK!" : "SOBER");

  // Line 4: Motor Status Bar
  display.setCursor(0, 49);
  if (motorRunning) {
    display.println("MOTOR  : >> RUNNING <<");
  } else {
    display.printf("MOTOR  : LOCKED (%s)", lockReason);
  }

  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=======================================================");
  Serial.println("  🏍️  GUARDIAN BIKE RECEIVER & MOTOR IGNITION CONTROLLER");
  Serial.println("  \"Smart Alcohol & Helmet Interlock for DC Motor\"");
  Serial.println("=======================================================");

  // 1. Digital GPIO Configuration
  pinMode(IGNITION_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);

  // Default state: Motor and LED completely OFF
  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);

  // 2. Optional OLED Display (With I2C Timeout to prevent freeze)
  Wire.begin(21, 22);
  Wire.setTimeOut(100);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(12, 18);
    display.println("GUARDIAN RECEIVER");
    display.setCursor(8, 35);
    display.println("Waiting for Helmet...");
    display.display();
    Serial.println("✅ OLED Display 128x64 Initialized.");
  } else {
    Serial.println("ℹ️  OLED Display not detected (operating in standalone mode).");
  }

  // 3. Initialize ESP-NOW Radio
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ [ERROR] ESP-NOW initialization failed!");
  } else {
    Serial.println("✅ ESP-NOW Radio Active. Listening for Helmet Transmitter...");
    esp_now_register_recv_cb(OnDataRecv);
  }

  Serial.println("🚀 Receiver Ready. Turn switch ON when wearing helmet & sober to start motor.\n");
}

void loop() {
  unsigned long now = millis();

  // -------------------------------------------------------------
  // 1. READ PHYSICAL IGNITION KEY SWITCH
  // -------------------------------------------------------------
  // INPUT_PULLUP: Switch ON connects pin to GND -> LOW
  bool switchOn = (digitalRead(IGNITION_SWITCH_PIN) == LOW);

  // -------------------------------------------------------------
  // 2. EVALUATE WIRELESS HELMET TELEMETRY
  // -------------------------------------------------------------
  bool helmetConnected = (now - lastPacketReceived < HELMET_TIMEOUT_MS);
  bool helmetWorn      = helmetConnected && helmetData.helmetWorn;
  bool isDrunk         = helmetConnected && (helmetData.alcoholAdc >= ALCOHOL_THRESHOLD_ADC);
  bool isCrash         = helmetConnected && helmetData.isCrashTriggered;

  // Safe condition: Switch is ON + Helmet Worn + Sober + No Crash + Helmet Signal Alive
  bool safeToRun = switchOn && helmetWorn && !isDrunk && !isCrash;

  const char* lockReason = "SAFE";

  // -------------------------------------------------------------
  // 3. MOTOR IGNITION CONTROL LOGIC
  // -------------------------------------------------------------
  if (switchOn) {
    if (safeToRun) {
      // ALL CLEAR: Start the motor from 1200mAh Li-ion battery!
      digitalWrite(MOTOR_PIN, HIGH);
      digitalWrite(STATUS_LED_PIN, HIGH);
      motorRunning = true;
      lockReason = "RUN";
    } else {
      // SWITCH IS ON, BUT SAFETY FAILED -> KEEP MOTOR OFF!
      digitalWrite(MOTOR_PIN, LOW);
      motorRunning = false;

      // Determine Lockout Reason for display & serial
      if (isCrash) {
        lockReason = "CRASH";
      } else if (isDrunk) {
        lockReason = "DRUNK";
      } else if (!helmetWorn) {
        lockReason = "NO HELMET";
      } else if (!helmetConnected) {
        lockReason = "NO HELMET SIGNAL";
      }

      // Fast warning blink on built-in LED (5Hz) to show user why motor won't turn on
      digitalWrite(STATUS_LED_PIN, (now / 100) % 2 == 0 ? HIGH : LOW);
    }
  } else {
    // Switch is OFF -> Motor OFF, LED OFF
    digitalWrite(MOTOR_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    motorRunning = false;
    lockReason = "SWITCH OFF";
  }

  // -------------------------------------------------------------
  // 4. PERIODIC SERIAL & OLED STATUS (Every 250ms)
  // -------------------------------------------------------------
  static unsigned long lastLog = 0;
  if (now - lastLog >= 250) {
    lastLog = now;

    Serial.printf("[BIKE RECEIVER] Switch: %-3s | Helmet: %-7s | Alcohol: %4d (%-5s) | Signal: %-7s | Motor: %s\n",
                  switchOn ? "ON" : "OFF",
                  helmetWorn ? "WORN" : "REMOVED",
                  helmetData.alcoholAdc,
                  isDrunk ? "DRUNK" : "SOBER",
                  helmetConnected ? "ONLINE" : "OFFLINE",
                  motorRunning ? "🟢 RUNNING" : (switchOn ? "🛑 LOCKED" : "⚪ OFF"));

    updateOledDisplay(switchOn, isDrunk, safeToRun, lockReason);
  }

  delay(20);
}
