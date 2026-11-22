# Guardian Hardware Poster, Interactive Working Video, IoT 3D Simulation & Bike Number Access Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict bike number authentication gate across all views, update hardware poster to exact project pinouts, embed an interactive working demonstration video/animation, and link the 3D motorcycle simulation to live IoT telemetry.

**Architecture:** A client-side session gate in `localStorage` locks all pages (`index.html`, `hardware-poster.html`, `simulation-3d.html`) until a valid registered vehicle number is submitted. `hardware-poster.html` is refactored into two clean subsystems (Transmitter & Receiver) with exact pinout cards, followed by an HTML5 interactive working demonstration player. `simulation-app.js` polls `/api/telemetry` at 350ms to drive Three.js 3D entities (helmet on/off, alcohol fumes, wheel spin, and crash).

**Tech Stack:** HTML5, TailwindCSS, CSS3 Glassmorphism, Three.js (r128), Vanilla JavaScript (ES6+), Vercel Serverless Functions.

**Spec:** `docs/superpowers/specs/2026-11-22-hardware-poster-simulation-access-gate-design.md`

## Global Constraints
- Target Hardware: ESP32 DevKit V1 (30-pin), TCRT5000 IR (GPIO 13), MQ-3 (GPIO 34), MPU-6050 (GPIO 21/22), Piezo Buzzer (GPIO 19), SOS Cancel (GPIO 4), Relay (GPIO 18), Key Switch (GPIO 4).
- Vehicle validation: Registered profiles `MH-12-AB-1234` (Manmath), `MH-14-CD-5678`, `MH-12-EF-9012` or Indian vehicle regex `^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$`.
- All pages must look cohesive with the cyberpunk/slate dark theme.

---

### Task 1: Strict Bike Number Access Gate Across All Pages
**Files:**
- Modify: `E:\Website\index.html`
- Modify: `E:\Website\hardware-poster.html`
- Modify: `E:\Website\simulation-3d.html`
- Modify: `E:\Website\js\app.js`

- [ ] **Step 1:** Enhance `index.html` login gate logic in `js/app.js` to strictly require valid vehicle format or registered ID (`MH-12-AB-1234`, `BIKE-101`, etc.).
- [ ] **Step 2:** Add modal and authentication guard script to `hardware-poster.html` checking `localStorage.getItem('smart_helmet_ride_id')`.
- [ ] **Step 3:** Add modal and authentication guard script to `simulation-3d.html` checking `localStorage.getItem('smart_helmet_ride_id')`.
- [ ] **Step 4:** Add Logout / Switch Bike button on all pages to verify lock and unlock transitions.

---

### Task 2: Redesign Hardware Poster with Exact Project Pinouts
**Files:**
- Modify: `E:\Website\hardware-poster.html`

- [ ] **Step 1:** Refactor Subsystem A (Helmet Transmitter) cards to include:
  1. ESP32 DevKit V1 (30-Pin) - 5V VIN / 3.3V Logic.
  2. TCRT5000 Optical IR Sensor - VCC, GND, OUT -> GPIO 13.
  3. MQ-3 Alcohol Breathalyzer - VCC -> 5V VIN, GND, AOUT -> GPIO 34.
  4. GY-521 MPU-6050 6-Axis IMU - VCC -> 3V3, GND, SCL -> GPIO 22, SDA -> GPIO 21.
  5. 5V Active Piezo Buzzer - (+) -> GPIO 19, (-) -> GND.
  6. False-Alarm SOS Button - Terminal 1 -> GPIO 4, Terminal 2 -> GND.
- [ ] **Step 2:** Refactor Subsystem B (Bike Receiver & Motor Interlock) cards to include:
  1. ESP32 DevKit V1 (30-Pin) - 5V USB Powered.
  2. 5V Optocoupler Relay Module - VCC -> 5V VIN, GND, IN -> GPIO 18 (Active-LOW Open-Drain).
  3. Temporary Ignition Key Switch - Pin 1 -> GPIO 4, Pin 2 -> GND.
  4. DC Motor / Bike Starter - (+) -> Relay NO, (-) -> GND, Relay COM -> 5V VIN.
  5. 0.96" SSD1306 OLED Display (Optional) - VCC -> 3V3, GND, SCL -> GPIO 22, SDA -> GPIO 21.
  6. Built-in Status Blue LED - GPIO 2.
- [ ] **Step 3:** Remove outdated 18650 booster, LM2596 buck converter, and 12V vehicle battery cards.

---

### Task 3: Interactive Working Video & Demonstration Section
**Files:**
- Modify: `E:\Website\hardware-poster.html`

- [ ] **Step 1:** Create modern video & demonstration player section directly below the hardware poster.
- [ ] **Step 2:** Implement interactive HTML5 Canvas animated visual simulation showing all 5 operational steps:
  - Step 1: Rider wearing helmet $\rightarrow$ IR sensor turns Green.
  - Step 2: MQ-3 breath alcohol check $\rightarrow$ ADC level evaluated.
  - Step 3: Ignition switch turned ON $\rightarrow$ Relay clicks, DC motor starts spinning.
  - Step 4: Helmet removed or alcohol detected $\rightarrow$ Relay opens, motor stops instantly.
  - Step 5: Crash detected ($G \ge 4.0$) $\rightarrow$ Motor stops, SMS with live GPS dispatched.
- [ ] **Step 3:** Add interactive quick-simulation buttons ("Test Safe Start", "Test Drunk Lockout", "Test Helmet Removal", "Test Crash SOS").
- [ ] **Step 4:** Provide standard `<video>` container ready to stream any user-uploaded `.mp4` demonstration video.

---

### Task 4: Real-Time IoT Telemetry in 3D Simulation
**Files:**
- Modify: `E:\Website\simulation-3d.html`
- Modify: `E:\Website\js\simulation-3d\simulation-app.js`

- [ ] **Step 1:** In `simulation-app.js`, add `startTelemetryPolling()` method fetching `/api/telemetry?rideId=<RIDE_ID>` every 350ms.
- [ ] **Step 2:** Link `helmetWorn` telemetry to 3D helmet entity:
  - If `false`: Visibly lift the 3D helmet above the rider with red holographic warning aura.
  - If `true`: Smoothly lower and latch helmet onto rider's head with green glow.
- [ ] **Step 3:** Link `alcoholAdc` telemetry:
  - If $\ge 800$: Render red intoxication fumes particle effect, lock ignition, sound alert buzzer.
- [ ] **Step 4:** Link `ignitionRelay` and speed:
  - If relay active: Wheels rotate and road scrolls at speed.
  - If relay cut off: Wheels stop immediately.
- [ ] **Step 5:** Link `isCrashDetected`:
  - Trigger camera shudder, motorcycle slide, and emergency SOS modal countdown.
- [ ] **Step 6:** Add "LIVE IOT LINK: ACTIVE" glowing badge on the HUD.

---

### Task 5: Deploy, Verify and Push to GitHub
**Files:**
- Sync: All modified files to `E:\sanrakshan_deploy`
- Commit & Push: To `https://github.com/manmath2005/Sanrakshan.git` (`main` branch)

- [ ] **Step 1:** Copy all updated files to `E:\sanrakshan_deploy`.
- [ ] **Step 2:** Verify all endpoints and pages load without console errors.
- [ ] **Step 3:** Commit with git and push to GitHub using the user's PAT.
