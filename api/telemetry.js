import fs from 'fs';
import path from 'path';

// Persistent telemetry cache across requests
global.__GUARDIAN_TELEMETRY_CACHE__ = global.__GUARDIAN_TELEMETRY_CACHE__ || {};
let telemetryCache = global.__GUARDIAN_TELEMETRY_CACHE__;

const TMP_FILE = path.join('/tmp', 'sanrakshan_telemetry.json');

function saveToTmp(data) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data));
  } catch (e) {}
}

function loadFromTmp() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Clear / Reset cache on request
  if (req.query.reset === 'true' || req.query.clear === 'true') {
    global.__GUARDIAN_TELEMETRY_CACHE__ = {};
    global.__GUARDIAN_TELEMETRY_LATEST__ = null;
    try { if (fs.existsSync(TMP_FILE)) fs.unlinkSync(TMP_FILE); } catch (e) {}
    return res.status(200).json({ success: true, message: 'Telemetry cache reset to clean standby.' });
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rawRideId = (data.rideId || 'BIKE-101').toUpperCase().trim();
      const cleanRideId = rawRideId.replace(/[^A-Z0-9]/g, '');

      if (data.action === 'reset' || data.reset === true) {
        delete telemetryCache[rawRideId];
        delete telemetryCache[cleanRideId];
        return res.status(200).json({ success: true, message: `Cache cleared for ${rawRideId}` });
      }

      // Safety guard: if BLE is not active, helmet cannot be worn and relay cannot be active
      if (data.sensors) {
        if (data.sensors.bleConnected === false || data.bleConnected === false) {
          data.sensors.helmetWorn = false;
          data.sensors.ignitionRelay = false;
          data.sensors.alcoholAdc = 0;
        }
      }

      const packet = {
        ...data,
        receivedAt: Date.now()
      };

      // Store under all possible search keys
      telemetryCache[rawRideId] = packet;
      telemetryCache[cleanRideId] = packet;

      if (data.vehicleNumber) {
        const vClean = String(data.vehicleNumber).toUpperCase().trim();
        const vAlpha = vClean.replace(/[^A-Z0-9]/g, '');
        telemetryCache[vClean] = packet;
        telemetryCache[vAlpha] = packet;
      }

      global.__GUARDIAN_TELEMETRY_LATEST__ = packet;
      saveToTmp(packet);

      // Automatically register any crash event into SOS History
      if (data.alerts && (data.alerts.isCrashDetected || data.alerts.isManualSosActive)) {
        global.__GUARDIAN_SOS_HISTORY__ = global.__GUARDIAN_SOS_HISTORY__ || [];
        const now = Date.now();
        const exists = global.__GUARDIAN_SOS_HISTORY__.some(e => Math.abs(e.timestamp - now) < 20000);
        if (!exists) {
          global.__GUARDIAN_SOS_HISTORY__.unshift({
            id: `CRASH-${now}`,
            timestamp: now,
            type: data.alerts.isCrashDetected ? 'CRASH_IMPACT' : 'MANUAL_SOS',
            location: data.location || { latitude: 18.4529, longitude: 73.8553 },
            gForce: (data.sensors && data.sensors.totalG) || 8.0,
            vehicleNumber: data.vehicleNumber || rawRideId,
            riderName: data.riderName || 'Rider',
            status: 'DISPATCHED_SMS_AND_CALLS'
          });
          if (global.__GUARDIAN_SOS_HISTORY__.length > 25) {
            global.__GUARDIAN_SOS_HISTORY__.pop();
          }
        }
      }

      return res.status(200).json({ success: true, rideId: rawRideId });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  if (req.method === 'GET') {
    const rawReqId = (req.query.rideId || 'BIKE-101').toUpperCase().trim();
    const cleanReqId = rawReqId.replace(/[^A-Z0-9]/g, '');

    // 1. Direct memory match
    let data = telemetryCache[rawReqId] || telemetryCache[cleanReqId];

    // 2. Cross-vehicle alias mapping
    if (!data) {
      if (cleanReqId === 'MH12AB1234') data = telemetryCache['BIKE-101'] || telemetryCache['BIKE101'];
      else if (cleanReqId === 'BIKE101') data = telemetryCache['MH-12-AB-1234'] || telemetryCache['MH12AB1234'];
    }

    // 3. Fallback to latest global in-memory packet
    if (!data && global.__GUARDIAN_TELEMETRY_LATEST__) {
      data = global.__GUARDIAN_TELEMETRY_LATEST__;
    }

    // 4. Fallback to /tmp disk cache
    if (!data) {
      const diskData = loadFromTmp();
      if (diskData) {
        data = diskData;
        telemetryCache[rawReqId] = diskData;
      }
    }

    // 5. Fallback: Check any key in cache
    if (!data) {
      const allKeys = Object.keys(telemetryCache);
      if (allKeys.length > 0) {
        data = telemetryCache[allKeys[0]];
      }
    }

    if (!data) {
      return res.status(200).json({ 
        hasData: false, 
        isLive: false, 
        message: 'No telemetry received yet. System in standby.' 
      });
    }

    // Check staleness window:
    // Packet is considered actively live within 60 seconds
    const ageMs = Date.now() - (data.receivedAt || data.timestamp || 0);
    const isLive = ageMs <= 60000;

    return res.status(200).json({
      hasData: true,
      isLive: isLive,
      isBuffered: !isLive,
      ageMs: ageMs,
      telemetry: data
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
