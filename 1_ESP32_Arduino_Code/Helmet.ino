#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_MPU6050 mpu;

// PIN MAPPING
#define POT_ALCOHOL_PIN 34  // MQ-3 Potentiometer (0 to 4095)
#define IR_RECEIVE_PIN  13  // IR signal means helmet is worn
#define SOS_CANCEL_PIN  4   // Red Push Button for SOS cancel
#define RELAY_PIN       18  // Motor Relay Interlock
#define BUZZER_PIN      19  // Warning Buzzer

const int ALCOHOL_LIMIT = 1500;
const float CRASH_G_LIMIT = 2.5;
bool isCrashAlertActive = false;
unsigned long crashStartTime = 0;
const unsigned long SOS_WINDOW_MS = 10000; // 10s countdown

void setup() {
  Serial.begin(115200);
  
  pinMode(SOS_CANCEL_PIN, INPUT_PULLUP);
  pinMode(IR_RECEIVE_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  analogSetPinAttenuation(POT_ALCOHOL_PIN, ADC_11db);

  digitalWrite(RELAY_PIN, LOW); // Engine locked by default
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(21, 22); // SDA=21, SCL=22

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.setTextColor(WHITE);

  if (!mpu.begin()) {
    Serial.println("MPU6050 not detected!");
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);

  display.setTextSize(1);
  display.setCursor(15, 25);
  display.print("SMART HELMET INIT");
  display.display();
  delay(1000);
}

void loop() {
  // 1. Read Sensors
  bool helmetWorn = digitalRead(IR_RECEIVE_PIN) == LOW;
  int alcoholRaw = analogRead(POT_ALCOHOL_PIN);
  bool isDrunk = (alcoholRaw > ALCOHOL_LIMIT);
  bool engineAllowed = helmetWorn && !isDrunk;

  // 2. Read MPU6050 Acceleration
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float totalG = sqrt(a.acceleration.x * a.acceleration.x +
                      a.acceleration.y * a.acceleration.y +
                      a.acceleration.z * a.acceleration.z) / 9.81;

  // 3. Crash Trigger
  if (totalG > CRASH_G_LIMIT && !isCrashAlertActive) {
    isCrashAlertActive = true;
    crashStartTime = millis();
  }

  // 4. Cancel SOS Button Press
  if (digitalRead(SOS_CANCEL_PIN) == LOW && isCrashAlertActive) {
    isCrashAlertActive = false; // Aborted
    digitalWrite(BUZZER_PIN, LOW);
  }

  display.clearDisplay();

  // --- STATE 1: CRASH ALERT ---
  if (isCrashAlertActive) {
    unsigned long elapsed = millis() - crashStartTime;
    int remainingSec = (SOS_WINDOW_MS - elapsed) / 1000;

    digitalWrite(RELAY_PIN, LOW); // Cut motor
    digitalWrite(BUZZER_PIN, HIGH);

    display.setTextSize(2);
    display.setCursor(0, 0);
    display.print("! CRASH !");
    display.setTextSize(1);
    display.setCursor(0, 25);
    display.print("SOS SMS in: ");
    display.print(max(0, remainingSec));
    display.print("s");
    display.setCursor(0, 45);
    display.print("Press Red to Cancel");

    if (elapsed >= SOS_WINDOW_MS) {
      display.setCursor(0, 55);
      display.print(">> SOS TRANSMITTED <<");
    }
  }
  // --- STATE 2: NO HELMET ---
  else if (!helmetWorn) {
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(">> BIKE DASHBOARD <<");
    display.setCursor(0, 16);
    display.print("Helmet  : NOT WORN [X]");
    display.setCursor(0, 32);
    display.print("Alcohol : --");
    display.setCursor(0, 48);
    display.print("IGNITION: LOCKED");
  }
  // --- STATE 3: DRUNK DETECTED ---
  else if (isDrunk) {
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(40);
    digitalWrite(BUZZER_PIN, LOW);

    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(">> BIKE DASHBOARD <<");
    display.setCursor(0, 16);
    display.print("Helmet  : WORN [OK]");
    display.setCursor(0, 30);
    display.print("Alcohol : DRUNK [FAIL]");
    display.setCursor(0, 44);
    display.print("Value   : ");
    display.print(alcoholRaw);
    display.setCursor(0, 56);
    display.print("IGNITION: BLOCKED!");
  }
  // --- STATE 4: ALL CHECKS PASSED -> ENGINE ON ---
  else if (engineAllowed) {
    digitalWrite(RELAY_PIN, HIGH); // Green Motor LED Turns ON!
    digitalWrite(BUZZER_PIN, LOW);

    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(">> BIKE DASHBOARD <<");
    display.setCursor(0, 16);
    display.print("Helmet  : WORN [OK]");
    display.setCursor(0, 30);
    display.print("Alcohol : SOBER [OK]");
    display.setCursor(0, 48);
    display.print(">> ENGINE RUNNING <<");
  }

  display.display();
  delay(150);
}