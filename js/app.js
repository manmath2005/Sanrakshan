/**
 * Main Application Orchestrator for Smart Helmet IoT Live Tracking Dashboard
 * Features: Rider ID Access Control Gate, Zero-Delay Firebase Telemetry Sync,
 * Free Leaflet OpenStreetMap Engine, Remote Sensitivity Sliders & Emergency SOS.
 */

import { initMap, updateRiderLocation, centerOnRider, toggleTrail, switchBasemap, toggleTraffic } from './map-tracker.js';
import { updateTelemetry, renderSosHistoryList } from './telemetry-hud.js';
import { initSafetyControls, triggerEmergencyAlert, dismissEmergencyAlert } from './safety-controls.js';
import { syncManager } from './firebase-sync.js';
import { startPhoneGpsBroadcaster, stopPhoneGpsBroadcaster } from './phone-transmitter.js';

// Application State
let currentRideId = '';
let currentMode = 'viewer'; // 'viewer' | 'transmitter' | 'simulator'
let latestTelemetry = null;
let dismissedAlertTimestamp = parseInt(sessionStorage.getItem('smart_helmet_dismissed_alert_ts') || '0', 10);

// Rider Database Records (Mock/Cloud)
const riderProfiles = {
  'BIKE-101': { riderName: "Manmath", vehicleNumber: "MH-12-AB-1234", emergencyContact: "+91 9876543210", rentalCompany: "SafeRide Pune" },
  'BIKE-102': { riderName: "Aarav Patil", vehicleNumber: "MH-14-CD-5678", emergencyContact: "+91 9123456780", rentalCompany: "Zeal Fleet" },
  'FLEET-007': { riderName: "Rohan Sharma", vehicleNumber: "MH-12-EF-9012", emergencyContact: "+91 9988776655", rentalCompany: "SafeRide Rentals" }
};

function getRiderProfile(id) {
  return riderProfiles[id] || {
    riderName: `Rider (${id})`,
    vehicleNumber: `MH-12-${id}`,
    emergencyContact: "+91 9876543210",
    rentalCompany: "Private Owner"
  };
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'pointer-events-none');
    }, 2500);
  }
}

function handleIncomingTelemetry(telemetry, riderInfo) {
  latestTelemetry = telemetry;

  // 1. Update Map
  const loc = telemetry.location;
  const isEmergency = telemetry.alerts && (telemetry.alerts.isCrashDetected || telemetry.alerts.isManualSosActive);
  if (loc && loc.latitude && loc.longitude) {
    updateRiderLocation(loc.latitude, loc.longitude, loc.heading || 0, loc.accuracyMeters || 5, loc.speedKmph || 0, isEmergency);
  }

  // 2. Update HUD
  const activeProfile = riderInfo || getRiderProfile(currentRideId);
  updateTelemetry(telemetry, activeProfile);

  // 3. Handle Emergency Alerts (only if not already dismissed by user)
  if (isEmergency) {
    const alertTs = telemetry.timestamp || telemetry.serverTimestamp || Date.now();
    if (alertTs > dismissedAlertTimestamp) {
      triggerEmergencyAlert({
        ...telemetry.alerts,
        latitude: loc ? loc.latitude : undefined,
        longitude: loc ? loc.longitude : undefined,
        totalG: (telemetry.sensors && telemetry.sensors.totalG) || 0,
        emergencyContact: activeProfile.emergencyContact
      });
    }
  } else {
    // Normal telemetry received: hide modal if open
    dismissEmergencyAlert();
  }
}

function unlockDashboard(rideId) {
  currentRideId = rideId.trim().toUpperCase();
  localStorage.setItem('smart_helmet_ride_id', currentRideId);

  // Update URL Query String without reloading
  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?rideId=${encodeURIComponent(currentRideId)}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  // Update Badge
  const badge = document.getElementById('active-ride-badge');
  if (badge) badge.textContent = currentRideId;

  // Hide Login Gate
  const modal = document.getElementById('login-gate-modal');
  if (modal) modal.classList.add('hidden');

  // Initialize Firebase sync for this specific Rider ID
  syncManager.init(currentRideId);

  showToast(`Unlocked live tracking for ${currentRideId}`);
}

function lockDashboard() {
  localStorage.removeItem('smart_helmet_ride_id');
  currentRideId = '';
  const modal = document.getElementById('login-gate-modal');
  if (modal) modal.classList.remove('hidden');
  const input = document.getElementById('gate-ride-id-input');
  if (input) input.value = '';
  showToast('Logged out of tracking session.');
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Leaflet Map (Centered on Pune area)
  initMap('map', 18.4529, 73.8553);

  // 2. Subscribe to Firebase Sync
  syncManager.onTelemetryUpdate(handleIncomingTelemetry);
  syncManager.onSosHistoryUpdate(renderSosHistoryList);

  // 3. Initialize Remote Safety Controls
  initSafetyControls((newConfig) => {
    syncManager.saveConfig(newConfig);
    showToast(`Sensitivity threshold synced to ${newConfig.mpuSensitivityG}G`);
  });

  // 4. Check for existing Ride ID (URL parameter or LocalStorage)
  const urlParams = new URLSearchParams(window.location.search);
  const paramRide = urlParams.get('rideId');
  const storedRide = localStorage.getItem('smart_helmet_ride_id');

  if (paramRide) {
    unlockDashboard(paramRide);
  } else if (storedRide) {
    unlockDashboard(storedRide);
  } else {
    // Show Login Gate
    const modal = document.getElementById('login-gate-modal');
    if (modal) modal.classList.remove('hidden');
  }

  // 5. Login Gate Form Submission
  const loginForm = document.getElementById('login-form');
  const gateInput = document.getElementById('gate-ride-id-input');

  if (loginForm && gateInput) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = gateInput.value.trim();
      if (val) {
        unlockDashboard(val);
      }
    });
  }

  // Quick Demo Buttons on Login Gate
  document.querySelectorAll('.quick-id-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-id');
      if (gateInput) gateInput.value = val;
      unlockDashboard(val);
    });
  });

  // 5b. Dismiss Emergency Alert Modal Button
  const btnDismissSos = document.getElementById('btn-dismiss-sos');
  if (btnDismissSos) {
    btnDismissSos.addEventListener('click', () => {
      dismissEmergencyAlert();
      const currentTs = (latestTelemetry && (latestTelemetry.timestamp || latestTelemetry.serverTimestamp)) || Date.now();
      dismissedAlertTimestamp = currentTs;
      sessionStorage.setItem('smart_helmet_dismissed_alert_ts', currentTs.toString());

      // Update Firebase & server to clear active crash status
      if (currentRideId && latestTelemetry) {
        const clearedPayload = {
          ...latestTelemetry,
          alerts: {
            ...(latestTelemetry.alerts || {}),
            isCrashDetected: false,
            isManualSosActive: false
          }
        };
        syncManager.publishTelemetry(clearedPayload, getRiderProfile(currentRideId));
      }
      showToast('Emergency alert dismissed. Standby mode restored.');
    });
  }

  // 6. Switch Rider / Logout Button
  const btnSwitch = document.getElementById('btn-switch-rider');
  if (btnSwitch) {
    btnSwitch.addEventListener('click', () => {
      lockDashboard();
    });
  }

  // 7. Copy Shareable Live Link
  const btnCopyLink = document.getElementById('btn-copy-link');
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (!currentRideId) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?rideId=${encodeURIComponent(currentRideId)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Live Tracking Link copied to clipboard!');
      }).catch(() => {
        prompt('Copy your Live Tracking link:', shareUrl);
      });
    });
  }

  // 8. Map Action Buttons & Google Maps Basemap Switcher
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.getAttribute('data-basemap');
      switchBasemap(style);

      // Update button visual styles
      document.querySelectorAll('.basemap-btn').forEach(b => {
        b.className = 'basemap-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5';
      });
      btn.className = 'basemap-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white transition-all flex items-center gap-1.5 shadow-sm';

      showToast(`Switched map to Google Maps ${style.toUpperCase()}`);
    });
  });

  const btnTraffic = document.getElementById('btn-toggle-traffic');
  if (btnTraffic) {
    btnTraffic.addEventListener('click', () => {
      const isLive = toggleTraffic();
      btnTraffic.className = isLive 
        ? 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 border border-emerald-500 shadow-md transition-all flex items-center gap-1.5'
        : 'px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 border border-slate-700 transition-all flex items-center gap-1.5';
      showToast(isLive ? 'Live Traffic Layer Enabled' : 'Live Traffic Layer Disabled');
    });
  }

  const btnCenterMap = document.getElementById('btn-center-map');
  if (btnCenterMap) {
    btnCenterMap.addEventListener('click', () => {
      centerOnRider();
      showToast('Map centered on rider');
    });
  }

  const btnToggleTrail = document.getElementById('btn-toggle-trail');
  if (btnToggleTrail) {
    btnToggleTrail.addEventListener('click', () => {
      const isVisible = toggleTrail();
      showToast(isVisible ? 'Path trail enabled' : 'Path trail hidden');
    });
  }

  // 9. Mode Switcher (Viewer / Phone GPS / Demo Simulator)
  const btnViewer = document.getElementById('mode-viewer');
  const btnTransmitter = document.getElementById('mode-transmitter');

  function setMode(mode) {
    currentMode = mode;
    [btnViewer, btnTransmitter].filter(Boolean).forEach(b => {
      b.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white transition-all flex items-center gap-1';
    });

    if (mode === 'viewer') {
      if (btnViewer) btnViewer.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      stopPhoneGpsBroadcaster();
      showToast('Viewer Mode: Listening for live bike data...');
    } else if (mode === 'transmitter') {
      if (btnTransmitter) btnTransmitter.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      
      const started = startPhoneGpsBroadcaster((phoneLoc) => {
        const payload = {
          timestamp: phoneLoc.timestamp,
          location: phoneLoc,
          sensors: {
            helmetWorn: true,
            alcoholAdc: 410,
            alcoholStatus: 'SAFE',
            gForceX: 0.1,
            gForceY: 0.98,
            gForceZ: 0.05,
            totalG: 1.01,
            vibrationLevel: 'NORMAL',
            ignitionRelay: true
          },
          alerts: { isCrashDetected: false, isManualSosActive: false }
        };
        syncManager.publishTelemetry(payload, getRiderProfile(currentRideId));
      });
      if (started) showToast('Broadcasting live phone GPS location...');
    }
  }

  if (btnViewer) btnViewer.addEventListener('click', () => setMode('viewer'));
  if (btnTransmitter) btnTransmitter.addEventListener('click', () => setMode('transmitter'));
});
