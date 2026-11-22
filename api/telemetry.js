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

      telemetryCache[rideId] = {
        ...data,
        receivedAt: Date.now()
      };

      return res.status(200).json({ success: true, rideId });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  if (req.method === 'GET') {
    const rideId = (req.query.rideId || 'BIKE-101').toUpperCase();
    const data = telemetryCache[rideId];

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
