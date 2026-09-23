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
  updateRiderLocation(loc.latitude, loc.longitude, loc.heading, loc.accuracyMeters, loc.speedKmph, isEmergency);

  // 2. Update HUD
  const activeProfile = riderInfo || getRiderProfile(currentRideId);
  updateTelemetry(telemetry, activeProfile);

  // 3. Handle Emergency Alerts
  if (isEmergency) {
    triggerEmergencyAlert({
      ...telemetry.alerts,
      latitude: loc.latitude,
      longitude: loc.longitude,
      totalG: telemetry.sensors.totalG,
      emergencyContact: activeProfile.emergencyContact
    });
  }
}

function unlockDashboard(rideId) {
  currentRideId = rideId.trim().toUpperCase();
  localStorage.setItem('smart_helmet_ride_id', currentRideId);

  // Update URL Query String without reloading
  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?rideId=${encodeURIComponent(currentRideId)}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  // Update Badge
  document.getElementById('active-ride-badge').textContent = currentRideId;

  // Hide Login Gate
  document.getElementById('login-gate-modal').classList.add('hidden');

  // Initialize Firebase sync for this specific Rider ID
  syncManager.init(currentRideId);

  showToast(`Unlocked live tracking for ${currentRideId}`);
}

function lockDashboard() {
  localStorage.removeItem('smart_helmet_ride_id');
  currentRideId = '';
  document.getElementById('login-gate-modal').classList.remove('hidden');
  document.getElementById('gate-ride-id-input').value = '';
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
    document.getElementById('login-gate-modal').classList.remove('hidden');
  }

  // 5. Login Gate Form Submission
  const loginForm = document.getElementById('login-form');
  const gateInput = document.getElementById('gate-ride-id-input');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = gateInput.value.trim();
    if (val) {
      unlockDashboard(val);
    }
  });

  // Quick Demo Buttons on Login Gate
  document.querySelectorAll('.quick-id-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-id');
      gateInput.value = val;
      unlockDashboard(val);
    });
  });

  // 6. Switch Rider / Logout Button
  document.getElementById('btn-switch-rider').addEventListener('click', () => {
    lockDashboard();
  });

  // 7. Copy Shareable Live Link
  document.getElementById('btn-copy-link').addEventListener('click', () => {
    if (!currentRideId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?rideId=${encodeURIComponent(currentRideId)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Live Tracking Link copied to clipboard!');
    }).catch(() => {
      prompt('Copy your Live Tracking link:', shareUrl);
    });
  });

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

  document.getElementById('btn-center-map').addEventListener('click', () => {
    centerOnRider();
    showToast('Map centered on rider');
  });

  document.getElementById('btn-toggle-trail').addEventListener('click', () => {
    const isVisible = toggleTrail();
    showToast(isVisible ? 'Path trail enabled' : 'Path trail hidden');
  });

  // 9. Mode Switcher (Viewer / Phone GPS / Demo Simulator)
  const btnViewer = document.getElementById('mode-viewer');
  const btnTransmitter = document.getElementById('mode-transmitter');
  

  function setMode(mode) {
    currentMode = mode;
    [btnViewer, btnTransmitter].forEach(b => {
      b.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white transition-all flex items-center gap-1';
    });

    if (mode === 'viewer') {
      btnViewer.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      stopPhoneGpsBroadcaster();
      
      showToast('Viewer Mode: Listening for live bike data...');
    } else if (mode === 'transmitter') {
      btnTransmitter.className = 'px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1';
      
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
    } );
      showToast('Demo Simulator active: Driving virtual route...');
    }
  }

  btnViewer.addEventListener('click', () => setMode('viewer'));
  btnTransmitter.addEventListener('click', () => setMode('transmitter'));
  

  

