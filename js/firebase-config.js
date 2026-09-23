/**
 * Firebase Realtime Database Configuration
 *
 * SETUP: Replace ALL placeholder values below with the real values from
 * your Firebase project console: https://console.firebase.google.com/
 *
 * Steps:
 *  1. Open Firebase Console → Your Project
 *  2. Click the gear icon → Project Settings
 *  3. Under "Your apps" → Web app → click "</>  Config"
 *  4. Copy the firebaseConfig object and paste the values below.
 */

export const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_API_KEY", // Still needs to be updated
  authDomain: "smart-helmet-tracker-bd08a.firebaseapp.com",
  databaseURL: "https://smart-helmet-tracker-bd08a-default-rtdb.asia-southeast1.firebasedatabase.app", // or firebaseio.com
  projectId: "smart-helmet-tracker-bd08a",
  storageBucket: "smart-helmet-tracker-bd08a.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// Production Vercel URL — update after deploying to Vercel
// The APK should use this URL in its "Server URL" field.
export const VERCEL_API_BASE = "https://smart-helmet-tracker.vercel.app";
