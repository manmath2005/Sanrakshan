# 🏍️ Smart Helmet IoT — Live GPS Tracking Dashboard

Real-time helmet crash detection, GPS tracking, and SOS alerting system.
Deployed on **Vercel** with **Firebase Realtime Database** — works globally like Zomato/Blinkit live delivery tracking.

## 🚀 Live Demo
> **Dashboard**: https://smart-helmet-tracker.vercel.app  
> **APK Server URL**: `https://smart-helmet-tracker.vercel.app`

---

## 📱 How to Connect the APK to This Website

1. Install `SmartHelmet.apk` on your Android phone
2. Login with your **Bike Number** and **Rider Name** as password
3. Open **Settings** → find **"Server URL"** field
4. Enter: `https://smart-helmet-tracker.vercel.app`
5. Tap **Save** — the phone now sends live GPS to the cloud dashboard

Anyone who opens the website URL will see the rider's live location in real-time.

---

## 🏗️ Architecture

```
📱 APK (Android Phone — Rider)
       │
       │  HTTPS POST /api/telemetry
       │  (GPS lat/lng, speed, crash alerts, SOS)
       ▼
🌐 Vercel Serverless Function (api/telemetry.js)
       │
       │  Firebase Admin SDK write
       ▼
🔥 Firebase Realtime Database
       │
       │  onValue() real-time push (< 100ms)
       ▼
💻 Browser Dashboard (Family / Emergency Contacts / Fleet Manager)
```

---

## 🛠️ Setup Guide (First Time)

### Step 1 — Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/smart-helmet-tracker.git
cd smart-helmet-tracker
npm install
```

### Step 2 — Create Firebase Project

1. Go to https://console.firebase.google.com/
2. **Add project** → name: `smart-helmet-tracker` → Create
3. Left sidebar → **Realtime Database** → **Create database**
   - Choose **Start in test mode**
   - Select Asia region (asia-southeast1) → Enable
4. **Project Settings** (gear icon) → **General** tab → **Add app** → Web (`</>`)
   - Register name: `smart-helmet-web`
   - Copy the `firebaseConfig` object
5. **Project Settings** → **Service Accounts** tab
   - Click **Generate new private key**
   - Download and keep the JSON file safe

### Step 3 — Configure Firebase Credentials

**In `js/firebase-config.js`**, replace all `REPLACE_WITH_*` values with your real Firebase config:

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← your real key
  authDomain: "smart-helmet-tracker.firebaseapp.com",
  databaseURL: "https://smart-helmet-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-helmet-tracker",
  storageBucket: "smart-helmet-tracker.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123"
};
```

### Step 4 — Deploy to Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com → **Add New Project** → Import your GitHub repo
3. In Vercel project settings → **Environment Variables** → Add:

| Name | Value |
|------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Paste the **entire content** of your service account JSON as a single line |
| `FIREBASE_DATABASE_URL` | `https://smart-helmet-tracker-default-rtdb.asia-southeast1.firebasedatabase.app` |

4. Click **Deploy** — Vercel will auto-build and give you a URL like `https://smart-helmet-tracker.vercel.app`

### Step 5 — Set APK Server URL

In the Android APK Settings, enter your Vercel URL:
```
https://smart-helmet-tracker.vercel.app
```

---

## 📁 Project Structure

```
smart-helmet-tracker/
├── api/
│   ├── telemetry.js        ← POST from APK, writes to Firebase RTDB
│   └── sos-history.js      ← GET SOS history from Firebase RTDB
├── js/
│   ├── app.js              ← Dashboard orchestrator
│   ├── firebase-config.js  ← Firebase project credentials
│   ├── firebase-sync.js    ← Real-time Firebase listener (onValue)
│   ├── map-tracker.js      ← Leaflet map with rider marker & trail
│   ├── simulator.js        ← Pune road-centerline demo simulation
│   ├── telemetry-hud.js    ← Speed / G-force / battery UI
│   ├── safety-controls.js  ← Emergency SOS modal & alerts
│   └── phone-transmitter.js← Browser GPS transmitter mode
├── css/
│   └── styles.css          ← Dark dashboard theme
├── downloads/
│   └── SmartHelmet.apk     ← Android APK download
├── index.html              ← Single-page dashboard
├── vercel.json             ← Routing & CORS headers
├── package.json            ← firebase + firebase-admin deps
├── .env.example            ← Template for environment variables
└── .gitignore
```

---

## 🔧 Local Development

```bash
# Serve locally (no build step needed — static HTML)
npx http-server . -p 3000 --cors
# Open http://localhost:3000
```

For Vercel serverless functions locally:
```bash
npx vercel dev
```

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/telemetry` | APK sends GPS + crash data |
| `GET` | `/api/telemetry?rideId=BIKE-101` | Get latest telemetry |
| `GET` | `/api/sos-history?rideId=BIKE-101` | Get last 20 SOS events |
| `GET` | `/downloads/SmartHelmet.apk` | Download Android APK |

### POST /api/telemetry — Payload Example
```json
{
  "rideId": "BIKE-101",
  "riderName": "Manmath",
  "vehicleNumber": "MH-12-AB-1234",
  "bloodGroup": "O+",
  "location": { "lat": 18.5204, "lng": 73.8567, "speed": 42.5 },
  "sensors": { "totalG": 0.98, "batteryPct": 78 },
  "alerts": { "isCrashDetected": false, "isManualSosActive": false },
  "emergencyContacts": [{ "name": "Father", "phone": "+91 9876543210" }],
  "timestamp": 1727092200000
}
```

---

## 🔐 Security Notes

- The Firebase Realtime Database is in **test mode** — change the rules after initial testing:
  ```json
  {
    "rules": {
      "rides": {
        "$rideId": {
          ".read": true,
          ".write": "auth != null"
        }
      }
    }
  }
  ```
- Never commit `firebase-service-account.json` or `.env.local` — they are in `.gitignore`
- The Vercel environment variables are encrypted at rest

---

## 🏍️ Made for Sankalp Smart Helmet IoT Project
