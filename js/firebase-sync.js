/**
 * Real-Time Sync Client for Smart Helmet IoT
 * Polls & listens to REST API / WebSocket / Local Bridge for instant telemetry from APK & ESP32.
 */

class RealtimeSyncManager {
  constructor() {
    this.currentRideId = 'BIKE-101';
    this.listeners = [];
    this.sosListeners = [];
    this.pollInterval = null;
    this.isSandbox = true;
    this.mockDatabase = {};
  }

  init(rideId = 'BIKE-101') {
    this.currentRideId = rideId.toUpperCase();
    console.log(`[RealtimeSync] Initialized for Ride: ${this.currentRideId}`);
    this.startPolling();
    return this;
  }

  onTelemetryUpdate(callback) {
    this.listeners.push(callback);
  }

  onSosHistoryUpdate(callback) {
    this.sosListeners.push(callback);
  }

  publishTelemetry(telemetryData, riderInfo = null) {
    this.mockDatabase[this.currentRideId] = {
      telemetry: telemetryData,
      riderInfo: riderInfo
    };

    // Forward to local API server so other dashboard viewers receive it
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: this.currentRideId,
          ...telemetryData,
          riderInfo: riderInfo
        })
      }).catch(() => {});
    } catch (ignored) {}

    // Trigger local listeners
    this.listeners.forEach(cb => cb(telemetryData, riderInfo));
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    
    // Poll every 800ms for live APK telemetry & SOS dispatches
    this.pollInterval = setInterval(() => {
      this.fetchRemoteTelemetry();
      this.fetchSosHistory();
    }, 800);
  }

  async fetchRemoteTelemetry() {
    try {
      const res = await fetch(`/api/telemetry?rideId=${encodeURIComponent(this.currentRideId)}`);
      if (res.ok) {
        const json = await res.json();
        const badge = document.getElementById('cloud-status-badge');
        const badgeText = document.getElementById('cloud-status-text');

        if (json.hasData && json.telemetry) {
          const t = json.telemetry;
          if (badge && badgeText) {
            if (json.isLive) {
              badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium';
              badgeText.textContent = 'Hardware Live Stream (<50ms)';
            } else {
              badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium';
              badgeText.textContent = 'Hardware Stream (Buffered)';
            }
          }
          this.listeners.forEach(cb => cb(t, {
            riderName: t.riderName || 'Manmath',
            vehicleNumber: t.vehicleNumber || 'MH-12-AB-1234',
            bloodGroup: t.bloodGroup || 'O+',
            emergencyContact: (t.emergencyContacts && t.emergencyContacts[0]) ? t.emergencyContacts[0].phone : '+91 9876543210',
            emergencyContacts: t.emergencyContacts || [],
            rentalCompany: 'SafeRide Fleet',
            isLive: true
          }));
        } else {
          // Hardware is not actively streaming right now -> trigger standby state
          if (badge && badgeText) {
            badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium';
            badgeText.textContent = 'Standby (Awaiting BLE/GPS Signal)';
          }
        }
      }
    } catch (e) {
      // Offline fallback: keep local standby
      this.listeners.forEach(cb => cb(null, null));
    }
  }

  async fetchSosHistory() {
    try {
      const res = await fetch('/api/sos-history');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.history) {
          this.sosListeners.forEach(cb => cb(json.history));
        }
      }
    } catch (ignored) {}
  }

  saveConfig(configData) {
    try {
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: this.currentRideId,
          ...configData
        })
      }).catch(() => {});
    } catch (ignored) {}
  }
}

export const syncManager = new RealtimeSyncManager();
