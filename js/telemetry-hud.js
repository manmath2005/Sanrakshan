/**
 * Telemetry HUD Controller
 * Updates gauges, sensor cards, Smart Ignition Interlock, SOS history feed, and Rider Profile.
 */

export function updateTelemetry(telemetry, riderProfile) {
  if (!telemetry) return;

  const loc = telemetry.location || {};
  const sensors = telemetry.sensors || {};
  const alerts = telemetry.alerts || {};

  // 1. Rider Info
  if (riderProfile) {
    const rName = document.getElementById('rider-name');
    const rVeh = document.getElementById('rider-vehicle');
    if (rName) rName.textContent = riderProfile.riderName + (riderProfile.bloodGroup ? ` (${riderProfile.bloodGroup})` : '');
    if (rVeh) rVeh.textContent = riderProfile.vehicleNumber;
  }

  // 2. Synced Contacts List
  let contacts = (riderProfile && riderProfile.emergencyContacts) || [];
  if (contacts.length === 0 && telemetry.emergencyContact) {
    contacts = [{name: 'Emergency Contact', phone: telemetry.emergencyContact, isPrimary: true}];
  }

  if (contacts && contacts.length > 0) {
    const container = document.getElementById('contacts-list-container');
    if (container) {
      container.innerHTML = contacts.map(c => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border ${c.isPrimary ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800'}">
          <div>
            <div class="text-slate-200 font-bold text-[11px]">${c.isPrimary ? '⭐ [PRIMARY] ' : ''}${c.name || 'Contact'}</div>
            <div class="text-[10px] text-slate-400 font-mono">${c.phone}</div>
          </div>
          <a href="tel:${c.phone}" class="px-2 py-1 rounded bg-emerald-600/30 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
            <i class="fa-solid fa-phone text-[9px]"></i> Call
          </a>
        </div>
      `).join('');
    }
  }

  // 3. Map Speed HUD
  const mapSpeed = document.getElementById('map-speed');
  if (mapSpeed) mapSpeed.textContent = Math.round(loc.speedKmph || 0);

  const mapHeadingText = document.getElementById('map-heading-text');
  const headingIcon = document.getElementById('heading-icon');
  if (mapHeadingText && headingIcon) {
    const h = Math.round(loc.heading || 0);
    mapHeadingText.textContent = `Heading ${getCompassDirection(h)} (${h}°)`;
    headingIcon.style.transform = `rotate(${h}deg)`;
  }

  const mapCoordsText = document.getElementById('map-coords-text');
  if (mapCoordsText && loc.latitude && loc.longitude) {
    mapCoordsText.textContent = `${loc.latitude.toFixed(5)}° N, ${loc.longitude.toFixed(5)}° E`;
  }

  // 4. Last Known Pre-Crash Coordinates
  const lastKnown = document.getElementById('last-known-coords');
  const navBtn = document.getElementById('btn-navigate-last-known');
  if (lastKnown && loc.latitude && loc.longitude) {
    lastKnown.textContent = `${loc.latitude.toFixed(5)}° N, ${loc.longitude.toFixed(5)}° E`;
    if (navBtn) navBtn.href = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
  }

  // 5. Helmet Wear Status
  const badgeHelmet = document.getElementById('badge-helmet');
  const interlockText = document.getElementById('helmet-interlock-text');
  if (badgeHelmet && interlockText) {
    if (sensors.helmetWorn) {
      badgeHelmet.className = 'px-2 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-max';
      badgeHelmet.innerHTML = '<i class="fa-solid fa-shield-halved text-[11px]"></i> Worn & Locked';
      interlockText.textContent = 'Authorized';
      interlockText.className = 'text-emerald-400 font-semibold';
    } else {
      badgeHelmet.className = 'px-2 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5 w-max';
      badgeHelmet.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-[11px]"></i> NOT WORN';
      interlockText.textContent = 'IGNITION LOCKED';
      interlockText.className = 'text-red-400 font-semibold';
    }
  }

  // 6. Alcohol BAC & Interlock Decision
  const alcoholVal = sensors.alcoholAdc || 0;
  const isAlcoholDrunk = alcoholVal >= 800 || sensors.alcoholStatus === 'DRUNK' || String(sensors.alcoholStatus || '').includes('LOCKED');
  const isAlcoholSafe = !isAlcoholDrunk;

  const alcoholAdc = document.getElementById('alcohol-adc-val');
  const alcoholBadge = document.getElementById('alcohol-status-badge');
  const alcoholProgress = document.getElementById('alcohol-progress');
  if (alcoholAdc && alcoholBadge && alcoholProgress) {
    alcoholAdc.textContent = alcoholVal;
    alcoholBadge.textContent = isAlcoholSafe ? '0.00% SOBER' : 'ALCOHOL DETECTED!';
    alcoholBadge.className = isAlcoholSafe ? 'text-[10px] font-bold text-emerald-400 uppercase' : 'text-[10px] font-bold text-red-400 uppercase animate-pulse';
    alcoholProgress.style.width = `${Math.min(100, (alcoholVal / 1600) * 100)}%`;
    alcoholProgress.className = isAlcoholSafe ? 'bg-emerald-500 h-1.5 rounded-full transition-all duration-300' : 'bg-red-500 h-1.5 rounded-full transition-all duration-300';
  }

  // 6b. Prominent Smart Ignition & Alcohol Interlock Card
  const cardIgnition = document.getElementById('card-ignition-interlock');
  const ignitionIconBox = document.getElementById('ignition-icon-box');
  const ignitionIcon = document.getElementById('ignition-icon');
  const ignitionBadge = document.getElementById('ignition-badge');
  const ignitionSubtext = document.getElementById('ignition-subtext');
  const alcoholInterlockStatus = document.getElementById('alcohol-interlock-status');

  const isIgnitionUnlocked = sensors.ignitionRelay !== false && isAlcoholSafe && !alerts.isCrashDetected;

  if (cardIgnition && ignitionBadge) {
    if (isIgnitionUnlocked) {
      cardIgnition.className = 'glass-card rounded-xl p-3.5 border border-emerald-500/30 bg-emerald-950/20 transition-all duration-300';
      if (ignitionIconBox) ignitionIconBox.className = 'w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg transition-all';
      if (ignitionIcon) ignitionIcon.className = 'fa-solid fa-key text-emerald-400';
      ignitionBadge.className = 'px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      ignitionBadge.textContent = 'UNLOCKED ✅';
      if (ignitionSubtext) ignitionSubtext.textContent = 'Safe to Ride — Ignition Circuit Active';
      if (alcoholInterlockStatus) {
        alcoholInterlockStatus.textContent = 'DISENGAGED (SAFE)';
        alcoholInterlockStatus.className = 'text-xs font-mono font-bold text-emerald-400';
      }
    } else {
      cardIgnition.className = 'glass-card rounded-xl p-3.5 border border-red-500/60 bg-red-950/30 shadow-lg shadow-red-950/50 animate-pulse transition-all duration-300';
      if (ignitionIconBox) ignitionIconBox.className = 'w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500 text-lg transition-all';
      if (ignitionIcon) ignitionIcon.className = 'fa-solid fa-ban text-red-500';
      ignitionBadge.className = 'px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30';
      ignitionBadge.textContent = 'LOCKED 🛑';
      if (ignitionSubtext) {
        ignitionSubtext.textContent = isAlcoholDrunk 
          ? 'Engine Cut Off — High Breath Alcohol (>800 ADC) Detected!'
          : 'Engine Cut Off — Safety Interlock Engaged';
      }
      if (alcoholInterlockStatus) {
        alcoholInterlockStatus.textContent = isAlcoholDrunk ? 'ENGAGED (ENGINE LOCKED)' : 'LOCKED (SAFETY)';
        alcoholInterlockStatus.className = 'text-xs font-mono font-bold text-red-400';
      }
    }
  }

  // 7. MPU G-Force
  const mpuTotal = document.getElementById('mpu-total-g');
  const vibBadge = document.getElementById('vibration-badge');
  if (mpuTotal && vibBadge) {
    const totalG = sensors.totalG ? sensors.totalG.toFixed(2) : '1.02';
    mpuTotal.textContent = `${totalG} G`;
    if (sensors.vibrationLevel === 'CRASH' || alerts.isCrashDetected) {
      vibBadge.textContent = 'CRASH IMPACT!';
      vibBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse';
    } else {
      vibBadge.textContent = 'NORMAL RIDE';
      vibBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  }

  const mpuX = document.getElementById('mpu-x-val');
  const mpuY = document.getElementById('mpu-y-val');
  const mpuZ = document.getElementById('mpu-z-val');
  if (mpuX && sensors.gForceX !== undefined) mpuX.textContent = `${sensors.gForceX > 0 ? '+' : ''}${sensors.gForceX.toFixed(2)} g`;
  if (mpuY && sensors.gForceY !== undefined) mpuY.textContent = `${sensors.gForceY > 0 ? '+' : ''}${sensors.gForceY.toFixed(2)} g`;
  if (mpuZ && sensors.gForceZ !== undefined) mpuZ.textContent = `${sensors.gForceZ > 0 ? '+' : ''}${sensors.gForceZ.toFixed(2)} g`;

  // 8. Ignition Relay Badge in MPU / Sensor grid
  const relayStatus = document.getElementById('relay-status-text');
  const relayBadge = document.getElementById('relay-badge');
  if (relayStatus && relayBadge) {
    relayStatus.textContent = isIgnitionUnlocked ? 'ENGINE IGNITION ENABLED' : 'IGNITION CUTOFF (LOCKED)';
    relayStatus.className = isIgnitionUnlocked ? 'text-xs font-bold text-emerald-400' : 'text-xs font-bold text-red-400';
    relayBadge.textContent = isIgnitionUnlocked ? 'CLOSED (ON)' : 'OPEN (OFF)';
    relayBadge.className = isIgnitionUnlocked ? 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase' : 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 uppercase';
  }
}

export function renderSosHistoryList(history) {
  const container = document.getElementById('sos-history-feed');
  const countBadge = document.getElementById('sos-history-count');
  if (!container || !history) return;

  if (countBadge) countBadge.textContent = `${history.length} Event${history.length === 1 ? '' : 's'}`;

  if (history.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic text-center py-2">No emergency dispatches recorded yet. Guardian system on standby.</div>`;
    return;
  }

  container.innerHTML = history.map(item => {
    const d = new Date(item.timestamp || Date.now());
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const lat = item.location ? item.location.latitude : 18.4529;
    const lng = item.location ? item.location.longitude : 73.8553;
    const g = item.gForce ? item.gForce.toFixed(1) : '4.0';

    return `
      <div class="p-2.5 rounded-xl bg-slate-900/90 border border-red-500/30 space-y-1 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-red-400 flex items-center gap-1">
            <i class="fa-solid fa-car-burst text-[10px]"></i>
            <span>${item.type === 'MANUAL_SOS' ? 'Manual SOS Alert' : 'Crash Detected (' + g + 'G)'}</span>
          </span>
          <span class="text-[10px] text-slate-400 font-mono">${timeStr}</span>
        </div>
        <div class="text-[11px] text-slate-300 font-mono">
          📍 ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
          <span class="text-emerald-400 font-semibold">
            <i class="fa-solid fa-check-double text-[9px]"></i> SMS & Auto-Call Dispatched
          </span>
          <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" class="text-blue-400 font-bold hover:underline">
            View Pin ↗
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function getCompassDirection(deg) {
  const dirs = ['North (0°)', 'NE (45°)', 'East (90°)', 'SE (135°)', 'South (180°)', 'SW (225°)', 'West (270°)', 'NW (315°)'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}
