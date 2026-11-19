# 🏍️ Smart Helmet ESP32 Firmware

This folder contains the complete Arduino source code and flashable binary firmware for the ESP32 microcontroller mounted on the helmet.

---

## 📁 Folder Contents
* `Helmet.ino` — Main Arduino sketch source code with Bluetooth Low Energy (BLE), MPU-6050 crash sensor, MQ-3 alcohol sensor, helmet wear switch, and starter relay logic.
* `libraries.txt` — List of required Arduino IDE libraries.
* `firmware_binaries/` — Precompiled flashable binaries (`Helmet.ino.bin`, `Helmet.ino.merged.bin`).

---

## ⚡ Hardware Pinout Connections

| Sensor / Module | ESP32 GPIO Pin | Function |
| :--- | :--- | :--- |
| **MPU-6050 SDA** | **GPIO 21** | I2C Data (Crash / G-Force Detection) |
| **MPU-6050 SCL** | **GPIO 22** | I2C Clock |
| **MQ-3 Alcohol Sensor (A0)** | **GPIO 34** (ADC1) | Analog Alcohol Vapor Concentration |
| **Helmet Touch / Limit Switch**| **GPIO 4** (INPUT_PULLUP) | Helmet Worn (LOW) / Removed (HIGH) |
| **Ignition Relay Module** | **GPIO 5** (OUTPUT) | HIGH = Engine Starter Active, LOW = Locked |
| **Emergency Red Buzzer / LED** | **GPIO 18** (OUTPUT) | Accident / Alcohol Alarm Beeper |

---

## 🚀 How to Upload Using Arduino IDE
1. Open **Arduino IDE** (v2.x).
2. Go to **Tools $ightarrow$ Board $ightarrow$ ESP32 $ightarrow$ ESP32 Dev Module**.
3. Install required libraries via **Sketch $ightarrow$ Include Library $ightarrow$ Manage Libraries**:
   - `Adafruit MPU6050`
   - `Adafruit Unified Sensor`
   - `Adafruit BusIO`
4. Connect ESP32 via USB and select the COM port.
5. Click **Upload (Ctrl + U)**.
6. Open Serial Monitor at **115200 baud** to see live BLE advertisements (`SmartHelmet-ESP32`).
