import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import fs from 'fs';

async function testConnection() {
  console.log("⏳ Initializing Firebase Admin with your Service Account...");
  try {
    const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));
    
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: "https://smart-helmet-tracker-bd08a-default-rtdb.asia-southeast1.firebasedatabase.app"
    });

    const db = getDatabase();
    const testRef = db.ref('system_test/connection');

    console.log("⏳ Testing WRITE access to Firebase...");
    await testRef.set({ 
      status: 'Cloud Backend Connected successfully!', 
      timestamp: Date.now() 
    });
    console.log("✅ WRITE successful!");

    console.log("⏳ Testing READ access from Firebase...");
    const snap = await testRef.once('value');
    console.log("✅ READ successful! Data retrieved: ", snap.val());

    console.log("\n🎉 ALL FIREBASE CLOUD CONNECTIONS ARE 100% WORKING!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR: Firebase connection failed.");
    console.error(error.message);
    
    // Try the fallback URL just in case
    if (error.message.includes('URL must be an absolute URL')) {
        console.log("\nTrying fallback US database URL...");
    }
    process.exit(1);
  }
}

testConnection();
