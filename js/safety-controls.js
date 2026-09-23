/**
 * Remote Safety Controls & Emergency SOS Modal Management
 * Synthesizes audio warning chimes and handles MPU sensitivity slider synchronization.
 */

let audioCtx = null;
let sosInterval = null;

// Synthesize Emergency Alarm Chime using Web Audio API
function playAlarmChime() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3); // A4

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    console.log('Audio chime not permitted by browser autoplay policy yet:', e);
  }
}

export function initSafetyControls(onConfigChange) {
  const slider = document.getElementById('sensitivity-slider');
  const sliderVal = document.getElementById('slider-g-val');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const syncPill = document.getElementById('sync-pill');

  function updateSensitivity(val) {
    const num = parseFloat(val).toFixed(1);
    slider.value = num;
    sliderVal.textContent = `${num} G`;

    syncPill.textContent = 'Saving...';
    syncPill.className = 'text-[9px] font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-700';

    if (onConfigChange) {
      onConfigChange({
        mpuSensitivityG: parseFloat(num),
        lastUpdatedBy: 'Family / Rental Admin',
        lastUpdatedAt: Date.now()
      });
    }

    setTimeout(() => {
      syncPill.textContent = 'Synced to Bike';
      syncPill.className = 'text-[9px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-700';
    }, 400);
  }

  slider.addEventListener('input', (e) => {
    sliderVal.textContent = `${parseFloat(e.target.value).toFixed(1)} G`;
  });

  slider.addEventListener('change', (e) => {
    updateSensitivity(e.target.value);
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      updateSensitivity(val);
    });
  });
}

export function triggerEmergencyAlert(alertData) {
  const modal = document.getElementById('sos-modal');
  const title = document.getElementById('sos-title');
  const subtitle = document.getElementById('sos-subtitle');
  const coords = document.getElementById('sos-coords');
  const force = document.getElementById('sos-force');
  const countdown = document.getElementById('sos-countdown');
  const gmapsLink = document.getElementById('sos-gmaps-link');
  const callLink = document.getElementById('sos-call-link');

  modal.classList.remove('hidden');
  playAlarmChime();

  const isCrash = alertData.type === 'crash' || alertData.isCrashDetected;
  title.textContent = isCrash ? '🚨 CRASH IMPACT DETECTED!' : '🆘 MANUAL SOS BUTTON PRESSED!';
  subtitle.textContent = isCrash 
    ? 'High G-force impact detected on rider helmet MPU sensor'
    : 'Rider triggered emergency SOS alert directly from helmet switch';

  if (coords && alertData.latitude && alertData.longitude) {
    coords.textContent = `${alertData.latitude.toFixed(5)}° N, ${alertData.longitude.toFixed(5)}° E`;
    gmapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${alertData.latitude},${alertData.longitude}`;
  }

  if (force) {
    force.textContent = alertData.totalG ? `${alertData.totalG} G (Threshold exceeded)` : 'Emergency Broadcast';
  }

  if (callLink && alertData.emergencyContact) {
    callLink.href = `tel:${alertData.emergencyContact}`;
  }

  // 10s Cancellation Countdown
  let remaining = alertData.sosCountdownRemaining || 10;
  if (sosInterval) clearInterval(sosInterval);

  countdown.textContent = `Auto-Dispatching in ${remaining}s`;
  sosInterval = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      countdown.textContent = `Auto-Dispatching in ${remaining}s`;
      playAlarmChime();
    } else {
      countdown.textContent = 'EMERGENCY DISPATCHED TO SERVICES';
      countdown.className = 'font-mono font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-500 animate-pulse';
      clearInterval(sosInterval);
    }
  }, 1000);
}

export function dismissEmergencyAlert() {
  const modal = document.getElementById('sos-modal');
  modal.classList.add('hidden');
  if (sosInterval) clearInterval(sosInterval);
}
