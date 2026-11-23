global.__GUARDIAN_SOS_HISTORY__ = global.__GUARDIAN_SOS_HISTORY__ || [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const item = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const record = {
        id: item.id || `SOS-${Date.now()}`,
        timestamp: item.timestamp || Date.now(),
        type: item.type || 'CRASH_IMPACT',
        location: item.location || {
          latitude: item.lat || item.latitude || 18.4529,
          longitude: item.lng || item.longitude || 73.8553
        },
        gForce: item.gForce || item.force || 8.0,
        vehicleNumber: item.vehicleNumber || item.vehicle || 'MH-12-AB-1234',
        riderName: item.riderName || 'Rider',
        status: item.status || 'DISPATCHED_SMS_AND_CALLS'
      };

      // Debounce if identical event within 15 seconds
      const exists = global.__GUARDIAN_SOS_HISTORY__.some(e => 
        Math.abs(e.timestamp - record.timestamp) < 15000
      );

      if (!exists) {
        global.__GUARDIAN_SOS_HISTORY__.unshift(record);
        if (global.__GUARDIAN_SOS_HISTORY__.length > 25) {
          global.__GUARDIAN_SOS_HISTORY__.pop();
        }
      }

      return res.status(200).json({ success: true, count: global.__GUARDIAN_SOS_HISTORY__.length, record });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      success: true, 
      count: global.__GUARDIAN_SOS_HISTORY__.length,
      history: global.__GUARDIAN_SOS_HISTORY__.slice(0, 10) 
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
