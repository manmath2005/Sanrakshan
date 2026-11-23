// In-memory telemetry cache for active sessions
let telemetryCache = {};

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
    telemetryCache = {};
    return res.status(200).json({ success: true, message: 'Telemetry cache reset to clean standby.' });
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rideId = (data.rideId || 'BIKE-101').toUpperCase();
      
      if (data.action === 'reset' || data.reset === true) {
        delete telemetryCache[rideId];
        return res.status(200).json({ success: true, message: `Cache cleared for ${rideId}` });
      }

      // Hardware safety interlock guard: if BLE is not active, helmet and relay cannot be active
      if (data.sensors) {
        if (data.sensors.bleConnected === false || data.bleConnected === false) {
          data.sensors.helmetWorn = false;
          data.sensors.ignitionRelay = false;
          data.sensors.alcoholAdc = 0;
        }
      }

      telemetryCache[rideId] = {
        ...data,
        receivedAt: Date.now()
      };

      if (data.vehicleNumber) {
        const vClean = String(data.vehicleNumber).toUpperCase().trim();
        telemetryCache[vClean] = telemetryCache[rideId];
        telemetryCache[vClean.replace(/[^A-Z0-9]/g, '')] = telemetryCache[rideId];
      }

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
            vehicleNumber: data.vehicleNumber || rideId,
            riderName: data.riderName || 'Rider',
            status: 'DISPATCHED_SMS_AND_CALLS'
          });
          if (global.__GUARDIAN_SOS_HISTORY__.length > 25) {
            global.__GUARDIAN_SOS_HISTORY__.pop();
          }
        }
      }

      return res.status(200).json({ success: true, rideId });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  if (req.method === 'GET') {
    const rawReqId = (req.query.rideId || 'BIKE-101').toUpperCase().trim();
    const cleanReqId = rawReqId.replace(/[^A-Z0-9]/g, '');

    let data = telemetryCache[rawReqId] || telemetryCache[cleanReqId];

    // Fallback: If specific ID not directly found, check for ANY live telemetry streaming right now
    if (!data) {
      const allKeys = Object.keys(telemetryCache);
      for (const k of allKeys) {
        const item = telemetryCache[k];
        if (item && item.sensors && (Date.now() - (item.receivedAt || item.timestamp || 0) <= 8000)) {
          data = item;
          break;
        }
      }
    }

    if (!data) {
      return res.status(200).json({ 
        hasData: false, 
        isLive: false, 
        message: 'No telemetry received yet. System in standby.' 
      });
    }

    // Check staleness: if no packet arrived in last 8 seconds, consider connection offline/standby
    const ageMs = Date.now() - (data.receivedAt || data.timestamp || 0);
    const isLive = ageMs <= 8000;

    if (!isLive) {
      return res.status(200).json({
        hasData: false,
        isLive: false,
        ageMs: ageMs,
        message: 'Telemetry offline / signal lost. Reverted to safe standby.'
      });
    }

    return res.status(200).json({
      hasData: true,
      isLive: true,
      ageMs: ageMs,
      telemetry: data
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
