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

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rideId = (data.rideId || 'BIKE-101').toUpperCase();
      
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

    if (data) {
      return res.status(200).json({ hasData: true, telemetry: data });
    } else {
      return res.status(200).json({ hasData: false, message: 'No telemetry received yet' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
