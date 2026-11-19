# 📱 Smart Helmet Android BLE Gateway App v3.0 (.apk)

This folder contains the installable Android application (SmartHelmet.apk) and its full native source code.

---

## 🚀 Key Features in v3.0
1. **👤 Rider Login & Profile Section**:
   - Manage Rider ID (e.g. BIKE-101), Rider Name, Bike Registration Number, and Blood Group (O+, B+, A+).
2. **📞 Customizable Multiple Emergency SOS Contacts**:
   - Add, edit, set primary, and remove emergency contacts directly inside the app.
   - Test one-touch emergency calls directly from contact cards.
3. **💥 Automatic Emergency Crash Calling & SMS Broadcast**:
   - When impact G-Force exceeds the threshold (>= 4.0G), the app **automatically dials the primary emergency contact** and **sends emergency SMS with live Google Maps coordinates** to **ALL** registered emergency contacts.
4. **🏍️ In-App Demo Simulation Engine**:
   - Built-in virtual ride simulator for testing and demonstrations without needing physical hardware.
   - Smoothly moves along realistic city coordinates with changing speed (35–62 km/h), heading angles (0°–360°), and normal road vibrations.
   - Includes a **"Simulate Crash (5.2G)"** button to trigger and test the full accident alarm, auto-call, and SMS dispatch flow.
5. **🌐 Real-Time Cloud / Web Dashboard Sync**:
   - Live telemetry and GPS updates stream directly to the web dashboard (http://<ip>:5500).
   - Persists last known pre-crash GPS coordinates and logs full SOS dispatch history.

---

## 📁 Folder Contents
* SmartHelmet.apk — Signed, release-ready Android APK for Android 9, 10, 11, 12, 13, 14, 15+.
* source_code/ — Complete Android Java source code.

---

## 📲 How to Install & Test on Smartphone
1. Transfer SmartHelmet.apk to your smartphone or download from web dashboard (http://<ip>:5500/downloads/SmartHelmet.apk).
2. Install APK, grant Location, Call & SMS permissions.
3. Configure your Emergency Contacts and start tracking or launch Demo Ride simulation!