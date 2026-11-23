/**
 * Main Application Orchestrator for Smart Helmet IoT Live Tracking Dashboard
 * Features: Rider ID Access Control Gate, Zero-Delay Firebase Telemetry Sync,
 * Free Leaflet OpenStreetMap Engine, Remote Sensitivity Sliders & Emergency SOS.
 */

import { initMap, updateRiderLocation, centerOnRider, toggleTrail, switchBasemap, toggleTraffic, resizeMap } from './map-tracker.js';
import { updateTelemetry, renderSosHistoryList } from './telemetry-hud.js';
import { triggerEmergencyAlert, dismissEmergencyAlert } from './safety-controls.js';
import { syncManager } from './firebase-sync.js';
import { startPhoneGpsBroadcaster, stopPhoneGpsBroadcaster } from './phone-transmitter.js';

// Application State
let currentRideId = '';
let currentMode = 'viewer'; // 'viewer' | 'transmitter'
let latestTelemetry = null;

// Rider Database Records (Mock/Cloud)
const riderProfiles = {
  'BIKE-101': { riderName: "Manmath", vehicleNumber: "MH-12-AB-1234", emergencyContact: "+91 9876543210", rentalCompany: "SafeRide Pune" },
  'BIKE-102': { riderName: "Aarav Patil", vehicleNumber: "MH-14-CD-5678", emergencyContact: "+91 9123456780", rentalCompany: "Zeal Fleet" },
  'FLEET-007': { riderName: "Rohan Sharma", vehicleNumber: "MH-12-EF-9012", emergencyContact: "+91 9988776655", rentalCompany: "SafeRide Rentals" }
};

const registeredVehicles = {
  'MH-12-AB-1234': 'BIKE-101',
  'MH12AB1234': 'BIKE-101',
  'MH 12 AB 1234': 'BIKE-101',
  'BIKE-101': 'BIKE-101',
  'BIKE101': 'BIKE-101',
  'MH-14-CD-5678': 'BIKE-102',
  'MH14CD5678': 'BIKE-102',
  'MH 14 CD 5678': 'BIKE-102',
  'BIKE-102': 'BIKE-102',
  'BIKE102': 'BIKE-102',
  'MH-12-EF-9012': 'FLEET-007',
  'MH12EF9012': 'FLEET-007',
  'MH 12 EF 9012': 'FLEET-007',
  'FLEET-007': 'FLEET-007',
  'FLEET007': 'FLEET-007'
};

export function isValidBikeNumber(input) {
  if (!input) return false;
  const clean = input.trim().toUpperCase();
  return clean.length >= 2;
}

function getRiderProfile(id) {
  const resolved = registeredVehicles[id] || id;
  return riderProfiles[resolved] || {
    riderName: `Rider (${id})`,
    vehicleNumber: id.includes('-') && id.length >= 8 ? id : `MH-12-${id}`,
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
  if (!telemetry || !telemetry.sensors) {
    updateTelemetry(null, null);
    return;
  }

  latestTelemetry = telemetry;

  const loc = telemetry.location || {};
  const isEmergency = Boolean(telemetry.alerts && (telemetry.alerts.isCrashDetected || telemetry.alerts.isManualSosActive));

  // 1. Update Map - whenever valid mobile coordinates are received
  if (loc.latitude && loc.longitude) {
    updateRiderLocation(loc.latitude, loc.longitude, loc.heading, loc.accuracyMeters, loc.speedKmph, isEmergency);
  }

  // 2. Update HUD
  const activeProfile = riderInfo || getRiderProfile(currentRideId);
  updateTelemetry(telemetry, activeProfile);

  // 3. Handle Emergency Alerts
  if (isEmergency && loc.latitude && loc.longitude) {
    triggerEmergencyAlert({
      ...telemetry.alerts,
      latitude: loc.latitude,
      longitude: loc.longitude,
      totalG: telemetry.sensors.totalG,
      emergencyContact: activeProfile.emergencyContact
    });
  }
}

export function unlockDashboard(rideId) {
  // Always keep window.__appUnlock pointing to us so inline handler can call us
  window.__appUnlock = unlockDashboard;
  currentRideId = (rideId || 'BIKE-101').trim().toUpperCase();
  localStorage.setItem('smart_helmet_ride_id', currentRideId);
  document.documentElement.classList.add('user-authenticated');

  // Update URL Query String without reloading
  try {
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?rideId=${encodeURIComponent(currentRideId)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  } catch (ignored) {}

  // Update Badge
  const badge = document.getElementById('active-ride-badge');
  if (badge) badge.textContent = currentRideId;

  // Fully hide Login Gate (force display: none directly on inline style)
  const gateModal = document.getElementById('login-gate-modal');
  if (gateModal) {
    gateModal.style.setProperty('display', 'none', 'important');
    gateModal.classList.add('hidden');
    gateModal.classList.remove('flex');
  }

  // Initialize Firebase sync for this specific Rider ID
  syncManager.init(currentRideId);

  // Recalculate map dimensions now that the access modal is dismissed
  setTimeout(() => {
    resizeMap();
  }, 100);

  showToast(`Unlocked live tracking for ${currentRideId}`);
}

export function lockDashboard() {
  localStorage.removeItem('smart_helmet_ride_id');
  document.documentElement.classList.remove('user-authenticated');
  currentRideId = '';
  const gateModal = document.getElementById('login-gate-modal');
  if (gateModal) {
    gateModal.style.setProperty('display', 'flex', 'important');
    gateModal.classList.remove('hidden');
    gateModal.classList.add('flex');
  }
  const gateInput = document.getElementById('gate-ride-id-input');
  if (gateInput) gateInput.value = '';
  showToast('Logged out of tracking session.');
}

// Global window helpers for instant inline button handlers
window.handleQuickUnlock = function(bikeNum) {
  const b = (bikeNum || 'MH-12-AB-1234').trim().toUpperCase();
  const cleanNoHyphens = b.replace(/[^A-Z0-9]/g, '');
  const resolvedId = registeredVehicles[b] || registeredVehicles[cleanNoHyphens] || b;
  unlockDashboard(resolvedId);
};

window.handleLoginSubmit = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('gate-ride-id-input');
  const val = input ? input.value.trim().toUpperCase() : 'MH-12-AB-1234';
  window.handleQuickUnlock(val);
};

function initDashboardApp() {
  // 1. Initialize Leaflet Map (Centered on Pune area)
  initMap('map', 18.4529, 73.8553);

  // 2. Subscribe to Firebase Sync
  syncManager.onTelemetryUpdate(handleIncomingTelemetry);
  syncManager.onSosHistoryUpdate(renderSosHistoryList);
  // Render existing local crash history immediately
  renderSosHistoryList([]);

  // Register module-level unlock with the inline handler so clicks before
  // module load still properly trigger syncManager.init() etc.
  window.__appUnlock = unlockDashboard;

  // 3. Check for existing Ride ID (URL parameter or LocalStorage)
  const urlParams = new URLSearchParams(window.location.search);
  const paramRide = urlParams.get('rideId');
  const storedRide = localStorage.getItem('smart_helmet_ride_id');

  if (paramRide) {
    unlockDashboard(paramRide);
  } else if (storedRide) {
    unlockDashboard(storedRide);
  }
  // NOTE: Do NOT show the login gate here — the CSS default hides it.
  // The gate is already hidden via `#login-gate-modal { display:none!important }` in <head>.
  // If user has no saved ride, they can type their bike number into the (hidden) form
  // or use direct URL ?rideId= param. The gate was removed from blocking flow.

  // 5. Login Gate Form Submission
  const loginForm = document.getElementById('login-form');
  const gateInput = document.getElementById('gate-ride-id-input');

  if (loginForm && gateInput) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = gateInput.value.trim().toUpperCase();
      const errEl = document.getElementById('gate-error-msg');
      
      if (!isValidBikeNumber(val)) {
        if (errEl) {
          errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter your bike registration number.';
          errEl.classList.remove('hidden');
          errEl.style.display = 'block';
        }
        return;
      }
      
      if (errEl) {
        errEl.classList.add('hidden');
        errEl.style.display = 'none';
      }
      const cleanNoHyphens = val.replace(/[^A-Z0-9]/g, '');
      const resolvedId = registeredVehicles[val] || 
                         registeredVehicles[val.replace(/\s+/g, '-')] || 
                         registeredVehicles[cleanNoHyphens] || 
                         val;
      unlockDashboard(resolvedId);
    });
  }

  // Wire Quick Demo Rider Buttons
  document.querySelectorAll('.btn-quick-bike').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const b = btn.getAttribute('data-bike') || 'MH-12-AB-1234';
      if (gateInput) gateInput.value = b;
      const cleanNoHyphens = b.replace(/[^A-Z0-9]/g, '');
      const resolvedId = registeredVehicles[b] || registeredVehicles[cleanNoHyphens] || b;
      unlockDashboard(resolvedId);
    });
  });

  // 6. Switch Rider / Logout Button
  const btnSwitchRider = document.getElementById('btn-switch-rider');
  if (btnSwitchRider) {
    btnSwitchRider.addEventListener('click', () => {
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

  // 8. Map Action Buttons & Basemap Switcher
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.getAttribute('data-basemap');
      switchBasemap(style);

      // Update button visual styles
      document.querySelectorAll('.basemap-btn').forEach(b => {
        b.className = 'basemap-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5';
      });
      btn.className = 'basemap-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white transition-all flex items-center gap-1.5 shadow-sm';

      showToast(`Switched map basemap to ${style.toUpperCase()}`);
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

  const btnCenter = document.getElementById('btn-center-map');
  if (btnCenter) {
    btnCenter.addEventListener('click', () => {
      centerOnRider();
      showToast('Map centered on rider');
    });
  }

  const btnTrail = document.getElementById('btn-toggle-trail');
  if (btnTrail) {
    btnTrail.addEventListener('click', () => {
      const isVisible = toggleTrail();
      showToast(isVisible ? 'Path trail enabled' : 'Path trail hidden');
    });
  }

  // 9. Mode Switcher (Viewer / Phone GPS)
  const btnViewer = document.getElementById('mode-viewer');
  const btnTransmitter = document.getElementById('mode-transmitter');
  const modeButtons = [btnViewer, btnTransmitter].filter(Boolean);

  function setMode(mode) {
    currentMode = mode;
    modeButtons.forEach(b => {
      b.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white transition-all flex items-center gap-1';
    });

    if (mode === 'viewer') {
      if (btnViewer) btnViewer.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      stopPhoneGpsBroadcaster();
      showToast('Viewer Mode: Listening for live bike data...');
    } else if (mode === 'transmitter') {
      if (btnTransmitter) btnTransmitter.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      const started = startPhoneGpsBroadcaster((phoneLoc) => {
        // Phone GPS mode: only transmit real location data.
        // Do NOT inject fake sensor values — sensors are only real when BLE helmet is connected.
        // bleConnected=false tells the website to show standby state for all sensor cards.
        const payload = {
          timestamp: phoneLoc.timestamp,
          location: phoneLoc,
          sensors: {
            bleConnected: false,
            helmetWorn: false,
            alcoholAdc: 0,
            alcoholStatus: 'AWAITING HELMET BLE CONNECTION',
            gForceX: 0.0,
            gForceY: 0.0,
            gForceZ: 0.0,
            totalG: 1.0,
            vibrationLevel: 'NORMAL',
            ignitionRelay: false
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

  const btnDismiss = document.getElementById('btn-dismiss-sos');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      dismissEmergencyAlert();
      showToast('Emergency alert dismissed.');
    });
  }

  // Start in Viewer mode to listen for live APK telemetry and crash coordinates
  setMode('viewer');
}

// Ensure startup runs whether DOMContentLoaded is pending or has already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardApp);
} else {
  initDashboardApp();
}

