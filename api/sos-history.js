// Vercel Serverless Function: GET /api/sos-history
// Returns the SOS + crash event history for a given rideId from Firebase RTDB.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  return initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    try {
      const rideId = (req.query.rideId || 'BIKE-101').toUpperCase();

      getFirebaseApp();
      const db = getDatabase();
      // Get last 20 SOS events, ordered by timestamp descending
      const snapshot = await db.ref(`rides/${rideId}/sos_history`)
        .orderByChild('timestamp')
        .limitToLast(20)
        .once('value');

      const raw = snapshot.val() || {};
      // Convert Firebase object (key → value) to sorted array, newest first
      const history = Object.values(raw).sort((a, b) => b.timestamp - a.timestamp);

      return res.status(200).json({
        success: true,
        rideId,
        count: history.length,
        history
      });
    } catch (error) {
      console.error('[/api/sos-history] Error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
