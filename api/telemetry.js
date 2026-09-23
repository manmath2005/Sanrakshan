// Vercel Serverless Function: POST /api/telemetry
// Receives live GPS + sensor data from Smart Helmet Android APK over the internet.
// Writes to Firebase Realtime Database so the web dashboard updates in real-time.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin SDK (runs once per cold start)
function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
  );

  return initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

export default async function handler(req, res) {
  // Handle CORS preflight from APK or browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // --- POST: APK sends telemetry data ---
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

      if (!payload || !payload.rideId) {
        return res.status(400).json({ success: false, error: 'Missing rideId' });
      }

      const rideId = payload.rideId.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
      const timestamp = payload.timestamp || Date.now();

      getFirebaseApp();
      const db = getDatabase();

      // 1. Write latest telemetry (replaces previous — always freshest location)
      const latestRef = db.ref(`rides/${rideId}/latest`);
      await latestRef.set({
        ...payload,
        rideId,
        serverTimestamp: Date.now()
      });

      // 2. If crash or SOS — append to history log
      const alerts = payload.alerts || {};
      if (alerts.isCrashDetected || alerts.isManualSosActive) {
        const sosRef = db.ref(`rides/${rideId}/sos_history`);
        const sosRecord = {
          timestamp,
          rideId,
          riderName: payload.riderName || 'Rider',
          vehicleNumber: payload.vehicleNumber || 'Unknown',
          bloodGroup: payload.bloodGroup || 'Unknown',
          location: payload.location || {},
          gForce: (payload.sensors || {}).totalG || 0,
          type: alerts.isCrashDetected ? 'CRASH_ACCIDENT' : 'MANUAL_SOS',
          contacts: payload.emergencyContacts || []
        };
        // Push generates a unique key for each SOS event
        await sosRef.push(sosRecord);
      }

      return res.status(200).json({
        success: true,
        message: 'Telemetry received & synced to Firebase'
      });

    } catch (error) {
      console.error('[/api/telemetry] Error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- GET: Dashboard polls for latest telemetry (fallback if Firebase SDK unavailable) ---
  if (req.method === 'GET') {
    try {
      const rideId = (req.query.rideId || 'BIKE-101').toUpperCase();

      getFirebaseApp();
      const db = getDatabase();
      const snapshot = await db.ref(`rides/${rideId}/latest`).once('value');
      const data = snapshot.val();

      return res.status(200).json({
        success: true,
        rideId,
        hasData: data !== null,
        telemetry: data
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
