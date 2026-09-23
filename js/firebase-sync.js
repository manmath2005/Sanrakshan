/**
 * Smart Helmet IoT — Firebase Realtime Database Sync Manager
 *
 * BEFORE (old): Polled REST API every 800ms (slow, misses fast events)
 * NOW (new):    Firebase onValue() listener — sub-100ms real-time push
 *               like Zomato/Blinkit live rider tracking.
 *
 * Flow:
 *   APK → POST /api/telemetry (Vercel) → Firebase RTDB → onValue() → Map updates
 *
 * The Firebase listener fires INSTANTLY whenever new data arrives at:
 *   /rides/{rideId}/latest          ← live GPS + sensors
 *   /rides/{rideId}/sos_history     ← crash & SOS events
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  off
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js';

import { firebaseConfig, VERCEL_API_BASE } from './firebase-config.js';

class RealtimeSyncManager {
  constructor() {
    this.currentRideId = 'BIKE-101';
    this.listeners = [];
    this.sosListeners = [];
    this.db = null;
    this.telemetryRef = null;
    this.sosRef = null;
    this.isConnected = false;

    // Fallback polling if Firebase SDK fails (offline / config not set)
    this.pollInterval = null;
    this.firebaseReady = false;

    this._initFirebase();
  }

  _initFirebase() {
    try {
      // Check if real credentials are set (not placeholder)
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('REPLACE_')) {
        console.warn('[RealtimeSync] Firebase not configured — using REST API polling fallback');
        this.firebaseReady = false;
        return;
      }
      const app = initializeApp(firebaseConfig);
      this.db = getDatabase(app);
      this.firebaseReady = true;
      console.log('[RealtimeSync] Firebase Realtime Database connected ✅');
    } catch (e) {
      console.warn('[RealtimeSync] Firebase init failed — using REST polling:', e.message);
      this.firebaseReady = false;
    }
  }

  init(rideId = 'BIKE-101') {
    this.currentRideId = rideId.toUpperCase();
    console.log(`[RealtimeSync] Starting live tracking for: ${this.currentRideId}`);

    // Detach any old listeners
    this._detachListeners();

    if (this.firebaseReady && this.db) {
      this._attachFirebaseListeners();
    } else {
      // Fallback: poll Vercel REST API every 800ms
      this._startRestPolling();
    }

    return this;
  }

  // -------------------------------------------------------------------
  // FIREBASE REAL-TIME PATH (primary — sub-100ms push, like Blinkit)
  // -------------------------------------------------------------------
  _attachFirebaseListeners() {
    // 1. Listen to latest telemetry (GPS, speed, sensors, alerts)
    this.telemetryRef = ref(this.db, `rides/${this.currentRideId}/latest`);
    onValue(this.telemetryRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      this.isConnected = true;

      // Build riderInfo from the telemetry record itself
      const riderInfo = {
        riderName: data.riderName || `Rider (${this.currentRideId})`,
        vehicleNumber: data.vehicleNumber || this.currentRideId,
        bloodGroup: data.bloodGroup || 'Unknown',
        emergencyContact: (data.emergencyContacts && data.emergencyContacts[0])
          ? data.emergencyContacts[0].phone : '',
        emergencyContacts: data.emergencyContacts || []
      };

      this.listeners.forEach(cb => {
        try { cb(data, riderInfo); } catch (e) {}
      });
    });

    // 2. Listen to SOS history (crash / manual SOS events)
    this.sosRef = ref(this.db, `rides/${this.currentRideId}/sos_history`);
    onValue(this.sosRef, (snapshot) => {
      const raw = snapshot.val() || {};
      const history = Object.values(raw).sort((a, b) => b.timestamp - a.timestamp);
      this.sosListeners.forEach(cb => {
        try { cb(history); } catch (e) {}
      });
    });

    console.log(`[RealtimeSync] Firebase listeners active on /rides/${this.currentRideId}`);
  }

  _detachListeners() {
    if (this.telemetryRef) { off(this.telemetryRef); this.telemetryRef = null; }
    if (this.sosRef) { off(this.sosRef); this.sosRef = null; }
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  // -------------------------------------------------------------------
  // REST API FALLBACK PATH (when Firebase SDK not configured)
  // -------------------------------------------------------------------
  _startRestPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    const base = VERCEL_API_BASE || '';
    this.pollInterval = setInterval(() => {
      this._fetchRestTelemetry(base);
      this._fetchRestSosHistory(base);
    }, 800);
    console.log('[RealtimeSync] REST fallback polling at', base || 'relative /api');
  }

  async _fetchRestTelemetry(base = '') {
    try {
      const res = await fetch(`${base}/api/telemetry?rideId=${encodeURIComponent(this.currentRideId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.hasData && json.telemetry) {
        const t = json.telemetry;
        const riderInfo = {
          riderName: t.riderName || 'Rider',
          vehicleNumber: t.vehicleNumber || this.currentRideId,
          bloodGroup: t.bloodGroup || 'Unknown',
          emergencyContact: (t.emergencyContacts && t.emergencyContacts[0])
            ? t.emergencyContacts[0].phone : '',
          emergencyContacts: t.emergencyContacts || []
        };
        this.listeners.forEach(cb => { try { cb(t, riderInfo); } catch (e) {} });
      }
    } catch (_) {}
  }

  async _fetchRestSosHistory(base = '') {
    try {
      const res = await fetch(`${base}/api/sos-history?rideId=${encodeURIComponent(this.currentRideId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.history) {
        this.sosListeners.forEach(cb => { try { cb(json.history); } catch (e) {} });
      }
    } catch (_) {}
  }

  // -------------------------------------------------------------------
  // PUBLIC API (same interface as before — no changes needed in app.js)
  // -------------------------------------------------------------------
  onTelemetryUpdate(callback) {
    this.listeners.push(callback);
  }

  onSosHistoryUpdate(callback) {
    this.sosListeners.push(callback);
  }

  /**
   * Called by simulator or phone-transmitter to publish data.
   * Posts to Vercel /api/telemetry which then writes to Firebase.
   */
  publishTelemetry(telemetryData, riderInfo = null) {
    const base = VERCEL_API_BASE || '';

    // Immediate local update (so simulator feels instant)
    this.listeners.forEach(cb => {
      try { cb(telemetryData, riderInfo); } catch (e) {}
    });

    // POST to Vercel → Firebase (reaches all other browsers in <100ms)
    fetch(`${base}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rideId: this.currentRideId,
        ...telemetryData,
        riderName: riderInfo ? riderInfo.riderName : undefined,
        vehicleNumber: riderInfo ? riderInfo.vehicleNumber : undefined,
        bloodGroup: riderInfo ? riderInfo.bloodGroup : undefined
      })
    }).catch(() => {});
  }

  saveConfig(configData) {
    // Config sync not critical — just local for now
    console.log('[RealtimeSync] Config:', configData);
  }
}

export const syncManager = new RealtimeSyncManager();
