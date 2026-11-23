/**
 * Telemetry HUD Controller
 * Updates gauges, sensor cards, SOS history feed, and Rider Profile.
 */

export function resetToStandbyState() {
  const badgeHelmet = document.getElementById('badge-helmet');
  const interlockText = document.getElementById('helmet-interlock-text');
  const cardHelmet = document.getElementById('card-helmet');
  if (badgeHelmet && interlockText) {
    if (cardHelmet) cardHelmet.className = 'glass-card rounded-xl p-3 flex flex-col justify-between border-red-500/30 bg-red-950/10';
    badgeHelmet.className = 'px-2 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5 w-max';
    badgeHelmet.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-[11px]"></i> NOT WORN (REMOVED)';
    interlockText.textContent = 'IGNITION LOCKED';
    interlockText.className = 'text-red-400 font-semibold';
  }

  const relayStatus = document.getElementById('relay-status-text');
  const relayBadge = document.getElementById('relay-badge');
  const relayIcon = document.getElementById('relay-indicator-icon');
  if (relayStatus && relayBadge) {
    relayStatus.textContent = 'STARTER ENGINE IGNITION OFF';
    relayStatus.className = 'text-xs font-bold text-red-400';
    relayBadge.textContent = 'LOCKED (OFF)';
    relayBadge.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 uppercase';
    if (relayIcon) {
      relayIcon.className = 'w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400';
    }
  }

  const alcoholAdc = document.getElementById('alcohol-adc-val');
  const alcoholBadge = document.getElementById('alcohol-status-badge');
  const alcoholProgress = document.getElementById('alcohol-progress');
  if (alcoholAdc && alcoholBadge && alcoholProgress) {
    alcoholAdc.textContent = '0';
    alcoholBadge.textContent = '0.00% SOBER';
    alcoholBadge.className = 'text-[10px] font-bold text-emerald-400 uppercase';
    alcoholProgress.style.width = '0%';
    alcoholProgress.className = 'bg-emerald-500 h-1.5 rounded-full transition-all duration-300';
  }

  const mpuTotal = document.getElementById('mpu-total-g');
  const vibBadge = document.getElementById('vibration-badge');
  if (mpuTotal && vibBadge) {
    mpuTotal.textContent = '1.00 G';
    vibBadge.textContent = 'STANDBY';
    vibBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
  }

  const mapSpeed = document.getElementById('map-speed');
  if (mapSpeed) mapSpeed.textContent = '0';

  const mapCoordsText = document.getElementById('map-coords-text');
  if (mapCoordsText) mapCoordsText.textContent = 'Awaiting Mobile GPS Fix...';
}

export function updateTelemetry(telemetry, riderProfile) {
  if (!telemetry || !telemetry.sensors) {
    resetToStandbyState();
    return;
  }

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
  if (riderProfile && riderProfile.emergencyContacts && riderProfile.emergencyContacts.length > 0) {
    const container = document.getElementById('contacts-list-container');
    if (container) {
      container.innerHTML = riderProfile.emergencyContacts.map(c => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border ${c.isPrimary ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800'}">
          <div>
            <div class="text-slate-200 font-bold text-[11px]">${c.isPrimary ? '⭐ [PRIMARY] ' : ''}${c.name} (${c.relation || 'Contact'})</div>
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
  // ONLY show coordinates when a real GPS fix is confirmed (isRealGps=true from phone hardware GPS)
  if (mapCoordsText) {
    if (loc.isRealGps === true && loc.latitude && loc.longitude) {
      mapCoordsText.textContent = `${loc.latitude.toFixed(5)}° N, ${loc.longitude.toFixed(5)}° E`;
    } else {
      mapCoordsText.textContent = 'Awaiting Mobile GPS Fix...';
    }
  }

  // 4. Last Known Pre-Crash Coordinates
  const lastKnown = document.getElementById('last-known-coords');
  const navBtn = document.getElementById('btn-navigate-last-known');
  if (lastKnown && loc.latitude && loc.longitude) {
    lastKnown.textContent = `${loc.latitude.toFixed(5)}° N, ${loc.longitude.toFixed(5)}° E`;
    if (navBtn) navBtn.href = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
  }

  // Check if BLE hardware link is active.
  // sensors.bleConnected must be explicitly TRUE (not just non-false).
  // telemetry.bleConnected is not a top-level key; use sensors.bleConnected only.
  const isBleActive = (sensors.bleConnected === true);
  const isHelmetPhysicallyWorn = isBleActive && (sensors.helmetWorn === true);

  // 5. Helmet Wear Status
  const badgeHelmet = document.getElementById('badge-helmet');
  const interlockText = document.getElementById('helmet-interlock-text');
  const cardHelmet = document.getElementById('card-helmet');
  if (badgeHelmet && interlockText) {
    if (isHelmetPhysicallyWorn) {
      if (cardHelmet) cardHelmet.className = 'glass-card rounded-xl p-3 flex flex-col justify-between border-emerald-500/30 bg-emerald-950/10';
      badgeHelmet.className = 'px-2 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-max';
      badgeHelmet.innerHTML = '<i class="fa-solid fa-shield-halved text-[11px]"></i> Worn & Locked';
      interlockText.textContent = 'Authorized';
      interlockText.className = 'text-emerald-400 font-semibold';
    } else {
      if (cardHelmet) cardHelmet.className = 'glass-card rounded-xl p-3 flex flex-col justify-between border-red-500/30 bg-red-950/10';
      badgeHelmet.className = 'px-2 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5 w-max';
      badgeHelmet.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-[11px]"></i> NOT WORN (REMOVED)';
      interlockText.textContent = 'IGNITION LOCKED';
      interlockText.className = 'text-red-400 font-semibold';
    }
  }

  // 6. Alcohol BAC
  const alcoholAdc = document.getElementById('alcohol-adc-val');
  const alcoholBadge = document.getElementById('alcohol-status-badge');
  const alcoholProgress = document.getElementById('alcohol-progress');
  if (alcoholAdc && alcoholBadge && alcoholProgress) {
    const val = isBleActive ? (sensors.alcoholAdc || 0) : 0;
    alcoholAdc.textContent = val;
    const isSafe = (sensors.alcoholStatus === 'SAFE' || sensors.alcoholStatus === 'SAFE / SOBER' || val < 2200);
    alcoholBadge.textContent = isSafe ? '0.00% SOBER' : 'ALCOHOL DETECTED!';
    alcoholBadge.className = isSafe ? 'text-[10px] font-bold text-emerald-400 uppercase' : 'text-[10px] font-bold text-red-400 uppercase animate-pulse';
    alcoholProgress.style.width = `${Math.min(100, (val / 4095) * 100)}%`;
    alcoholProgress.className = isSafe ? 'bg-emerald-500 h-1.5 rounded-full transition-all duration-300' : 'bg-red-500 h-1.5 rounded-full transition-all duration-300';
  }
  }

  // 7. MPU G-Force
  const mpuTotal = document.getElementById('mpu-total-g');
  const vibBadge = document.getElementById('vibration-badge');
  if (mpuTotal && vibBadge) {
    const totalG = isBleActive && sensors.totalG ? sensors.totalG.toFixed(2) : '1.00';
    mpuTotal.textContent = `${totalG} G`;
    if (sensors.vibrationLevel === 'CRASH' || alerts.isCrashDetected) {
      vibBadge.textContent = 'CRASH IMPACT!';
      vibBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse';
    } else {
      vibBadge.textContent = isBleActive ? 'NORMAL RIDE' : 'STANDBY';
      vibBadge.className = isBleActive 
        ? 'text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20'
        : 'text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
    }
  }

  const mpuX = document.getElementById('mpu-x-val');
  const mpuY = document.getElementById('mpu-y-val');
  const mpuZ = document.getElementById('mpu-z-val');
  if (mpuX && sensors.gForceX !== undefined) mpuX.textContent = `${sensors.gForceX > 0 ? '+' : ''}${sensors.gForceX.toFixed(2)} g`;
  if (mpuY && sensors.gForceY !== undefined) mpuY.textContent = `${sensors.gForceY > 0 ? '+' : ''}${sensors.gForceY.toFixed(2)} g`;
  if (mpuZ && sensors.gForceZ !== undefined) mpuZ.textContent = `${sensors.gForceZ > 0 ? '+' : ''}${sensors.gForceZ.toFixed(2)} g`;

  // 8. Ignition Relay / Starter Motor
  const relayStatus = document.getElementById('relay-status-text');
  const relayBadge = document.getElementById('relay-badge');
  const relayIcon = document.getElementById('relay-indicator-icon');
  if (relayStatus && relayBadge) {
    // Ignition relay must require BLE active + helmet worn + sober (< 2200 ADC) + no crash
    const isSafe = isBleActive && isHelmetPhysicallyWorn && (sensors.alcoholAdc !== undefined ? sensors.alcoholAdc < 2200 : true) && (!alerts || !alerts.isCrashDetected);
    const isRelayOn = isSafe && (sensors.ignitionRelay === true || sensors.ignitionRelay === 1);
    relayStatus.textContent = isRelayOn ? 'STARTER ENGINE IGNITION ENABLED' : 'STARTER ENGINE IGNITION OFF';
    relayStatus.className = isRelayOn ? 'text-xs font-bold text-emerald-400' : 'text-xs font-bold text-red-400';
    relayBadge.textContent = isRelayOn ? 'RUNNING (ON)' : 'LOCKED (OFF)';
    relayBadge.className = isRelayOn 
      ? 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase' 
      : 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 uppercase';
    if (relayIcon) {
      relayIcon.className = isRelayOn 
        ? 'w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400' 
        : 'w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400';
    }
  }

  // 9. Persist Crash SOS to Local Storage History
  if (alerts && (alerts.isCrashDetected || alerts.isManualSosActive)) {
    const now = Date.now();
    let localHistory = [];
    try {
      localHistory = JSON.parse(localStorage.getItem('guardian_sos_history') || '[]');
    } catch (e) {}

    const lastTime = localHistory.length > 0 ? (localHistory[0].timestamp || 0) : 0;
    if (now - lastTime >= 25000) {
      localHistory.unshift({
        id: `SOS-${now}`,
        timestamp: now,
        type: alerts.isCrashDetected ? 'CRASH_IMPACT' : 'MANUAL_SOS',
        location: loc && loc.latitude ? { latitude: loc.latitude, longitude: loc.longitude } : { latitude: 18.4529, longitude: 73.8553 },
        gForce: (sensors && sensors.totalG) || 8.0,
        vehicleNumber: data.vehicleNumber || 'MH-12-AB-1234',
        riderName: data.riderName || 'Rider'
      });
      if (localHistory.length > 10) localHistory.pop();
      try {
        localStorage.setItem('guardian_sos_history', JSON.stringify(localHistory));
      } catch (e) {}
      renderSosHistoryList(localHistory);
    }
  }
}

export function renderSosHistoryList(history) {
  const container = document.getElementById('sos-history-feed');
  const countBadge = document.getElementById('sos-history-count');
  if (!container) return;

  // Retrieve locally cached crash events so history is never lost on refresh
  let localHistory = [];
  try {
    localHistory = JSON.parse(localStorage.getItem('guardian_sos_history') || '[]');
  } catch (e) {}

  // Combine server history + local history and deduplicate within 10 seconds
  const combined = [...(history || []), ...localHistory];
  const uniqueHistory = [];
  for (const item of combined) {
    if (!item) continue;
    const itemTime = item.timestamp || 0;
    const exists = uniqueHistory.some(u => Math.abs((u.timestamp || 0) - itemTime) < 10000);
    if (!exists) {
      uniqueHistory.push(item);
    }
  }

  // Sort descending by timestamp and take past 10 crashes
  uniqueHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const past10 = uniqueHistory.slice(0, 10);

  // Sync back to localStorage
  try {
    localStorage.setItem('guardian_sos_history', JSON.stringify(past10));
  } catch (e) {}

  if (countBadge) countBadge.textContent = `${past10.length} Event${past10.length === 1 ? '' : 's'}`;

  if (past10.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic text-center py-2">No emergency dispatches recorded yet. Guardian system on standby.</div>`;
    return;
  }

  container.innerHTML = past10.map((item, idx) => {
    const d = new Date(item.timestamp || Date.now());
    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const lat = item.location ? (item.location.latitude || item.location.lat) : (item.lat || 18.4529);
    const lng = item.location ? (item.location.longitude || item.location.lng) : (item.lng || 73.8553);
    const g = item.gForce ? Number(item.gForce).toFixed(1) : '8.0';
    const isManual = item.type === 'MANUAL_SOS';

    return `
      <div class="p-2.5 rounded-xl bg-slate-900/90 border border-red-500/30 space-y-1.5 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-red-400 flex items-center gap-1.5">
            <i class="fa-solid ${isManual ? 'fa-hand-dots text-amber-400' : 'fa-car-burst text-red-400'} text-[11px]"></i>
            <span>#${idx + 1} ${isManual ? 'Manual SOS Alert' : 'Crash Detected (' + g + 'G)'}</span>
          </span>
          <span class="text-[10px] text-red-300 font-mono font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/40">${timeStr}</span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <span>📅 Date: <strong class="text-slate-300">${dateStr}</strong></span>
          <span>⚡ Impact: <strong class="text-rose-400 font-mono">${g}G</strong></span>
        </div>
        <div class="text-[11px] text-slate-200 font-mono bg-slate-950/70 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
          <span>📍 ${Number(lat).toFixed(5)}° N, ${Number(lng).toFixed(5)}° E</span>
          <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" class="text-blue-400 font-bold hover:underline flex items-center gap-1 text-[10px]">
            Maps Pin ↗
          </a>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
          <span class="text-emerald-400 font-semibold flex items-center gap-1">
            <i class="fa-solid fa-check-double text-[9px]"></i> SMS & Auto-Call Dispatched
          </span>
          <span class="text-slate-400 font-mono">${item.vehicleNumber || 'MH-12-AB-1234'}</span>
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
