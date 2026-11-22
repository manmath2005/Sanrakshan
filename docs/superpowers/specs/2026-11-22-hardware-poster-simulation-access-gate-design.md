# Specification: Guardian Hardware Poster, Interactive Working Video, IoT 3D Simulation & Bike Number Access Gate

**Date:** 2026-11-22  
**Status:** Approved by User  
**Target Platform:** Web (HTML5 / TailwindCSS / Three.js / Vanilla JS / Vercel Serverless)

---

## 1. Overview & Goal
Enhance the Sanrakshan / Guardian Smart Helmet web platform with four coordinated features:
1. **Strict Bike Number Access Gate**: Enforce mandatory vehicle registration authentication across all web views (`index.html`, `hardware-poster.html`, `simulation-3d.html`). Unauthenticated visitors cannot access telemetry, posters, or 3D digital twins without entering a valid registered bike number (e.g., `MH-12-AB-1234` or `BIKE-101`).
2. **Updated Hardware Poster & Pinout Cards (`hardware-poster.html`)**: Focus strictly on the exact components and pinouts physically used in the project (Transmitter: ESP32, IR Sensor, MQ-3, MPU-6050, Piezo Buzzer, SOS Button; Receiver: ESP32, Relay Module, Key Switch, DC Motor, OLED, Status LED). All unneeded components (18650 cells on transmitter, boost/buck converter modules, etc.) are removed.
3. **Interactive Working Video & Demonstration Section**: Embed a dedicated, rich video and animated demonstration section on the hardware poster page that walks through the 5-step safety flow (Helmet wear detection $\rightarrow$ Sobriety check $\rightarrow$ Motor start $\rightarrow$ Engine lockout on violation $\rightarrow$ Crash impact SOS).
4. **Real-Time IoT-Driven 3D Simulation (`simulation-3d.html`)**: Connect the Three.js 3D motorcycle and rider simulation to `/api/telemetry?rideId=...`. When live ESP32/APK telemetry streams in, the 3D model reacts dynamically (helmet snaps on/off, alcohol fumes & lockout, wheel spin & highway speed, crash camera shudder and SOS modal).

---

## 2. Subsystem Specifications

### Subsystem A: Bike Number Access Control Gate
* **Enforcement**:
  - `index.html`: Existing `#login-gate-modal` validated against registered vehicles (`MH-12-AB-1234` / `BIKE-101`, `MH-14-CD-5678` / `BIKE-102`, `MH-12-EF-9012` / `FLEET-007` or valid standard Indian vehicle number format `^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$`).
  - `hardware-poster.html` & `simulation-3d.html`: Implement the matching high-security glassmorphism gate modal. If `localStorage.getItem('smart_helmet_ride_id')` is missing or invalid, the content is blurred and locked behind the prompt.
  - Quick-switch / Logout button on all pages to lock the dashboard.

### Subsystem B: Streamlined Hardware Poster & Pinouts
* **Helmet Transmitter Unit (5V USB Powered)**:
  - **ESP32 DevKit V1 (30-Pin)**: Central Controller (BLE 4.2 GATT Server & ESP-NOW Unicast).
  - **IR Proximity Obstacle Sensor**: `VCC -> 5V/3V3`, `GND -> GND`, `OUT -> GPIO 13`.
  - **MQ-3 Alcohol Breathalyzer**: `VCC -> VIN (5V)`, `GND -> GND`, `AOUT -> GPIO 34`.
  - **GY-521 MPU-6050 (6-Axis IMU)**: `VCC -> 3V3`, `GND -> GND`, `SCL -> GPIO 22`, `SDA -> GPIO 21`.
  - **5V Active Piezo Buzzer**: `(+) -> GPIO 19`, `(-) -> GND`.
  - **False-Alarm Push Button**: `Pin 1 -> GPIO 4`, `Pin 2 -> GND`.
* **Bike Receiver Unit (5V USB Powered)**:
  - **ESP32 DevKit V1 (30-Pin)**: Motor Ignition Controller (ESP-NOW Receiver).
  - **5V Relay Module (Active-LOW Open-Drain)**: `VCC -> VIN (5V)`, `GND -> GND`, `IN -> GPIO 18`.
  - **Temporary Key Switch**: `Terminal 1 -> GPIO 4`, `Terminal 2 -> GND`.
  - **DC Motor / Bike Starter Simulator**: `(+) -> Relay NO`, `(-) -> GND`, `Relay COM -> VIN (5V)`.
  - **0.96" SSD1306 OLED (Optional)**: `VCC -> 3V3`, `GND -> GND`, `SCL -> GPIO 22`, `SDA -> GPIO 21`.
  - **Status LED**: Built-in Blue LED on `GPIO 2`.

### Subsystem C: Interactive Working Video & Demonstration Section
* Embedded below the hardware poster with:
  - A responsive modern media player container with controls, full-screen mode, and playback speed.
  - Canvas-based interactive step-by-step visual animation demonstrating all 5 states:
    1. Helmet Wear Detection (IR sensor toggles green).
    2. Sobriety Breathalyzer Analysis (MQ-3 checks alcohol).
    3. Motor Ignition Start (Relay clicks ON, DC motor spins).
    4. Safety Interlock Violation (Helmet removed or alcohol detected $\rightarrow$ motor cuts off).
    5. Crash Impact & Emergency Rescue (MPU-6050 $\ge$ 4.0G $\rightarrow$ SMS with Google Maps coordinates).
  - Interactive scenario buttons to trigger each step instantly.

### Subsystem D: Live IoT-Synchronized 3D Simulation
* Polling `GET /api/telemetry?rideId=<RIDE_ID>` every 350ms.
* **Visual 3D Transformations**:
  - `helmetWorn`: When `true`, helmet snaps firmly onto rider's head with green glow. When `false`, helmet detaches and hovers above rider with red warning wireframe.
  - `alcoholAdc`: When $\ge 800$, red particle smoke renders at the helmet chin guard, audio alarm beeps, and motor halts.
  - `ignitionRelay`: Controls wheel rotation speed and road scrolling animation.
  - `isCrashDetected`: Triggers camera shake, motorcycle skid, and 3-second SOS cancellation modal.
  - Live HUD badge: Shows "LIVE IOT LINK: ACTIVE" with ping latency.

---

## 3. Files Touched
1. `E:\Website\index.html`: Enforce vehicle validation regex and profile matching in login modal.
2. `E:\Website\hardware-poster.html`: Clean up components to match exact project pinout; add vehicle access gate modal; add video & interactive animated working demo.
3. `E:\Website\simulation-3d.html`: Add vehicle access gate modal; add live IoT indicator.
4. `E:\Website\js\simulation-3d\simulation-app.js`: Implement active polling against `/api/telemetry` to animate the 3D model dynamically based on real sensor values.
5. Deploy repository: Sync all modified files to `E:\sanrakshan_deploy` and commit/push to GitHub.
