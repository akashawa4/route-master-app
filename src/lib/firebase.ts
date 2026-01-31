// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBe12v3ULPNlAxapSZ1zu5eFoxxHzpY-rU",
  authDomain: "college-bus-tracking-903e7.firebaseapp.com",
  projectId: "college-bus-tracking-903e7",
  storageBucket: "college-bus-tracking-903e7.firebasestorage.app",
  messagingSenderId: "898454276553",
  appId: "1:898454276553:web:bfcb5f6d305696cc4d4018",
  measurementId: "G-GMN49YD0EM",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Initialize Realtime Database (for GPS location tracking)
const database = getDatabase(app);

// Initialize Firestore (for driver, routes, stops, bus data)
const firestore = getFirestore(app);

// Initialize Auth
const auth = getAuth(app);

/** Web Push (VAPID) public key – use in Firebase Messaging getToken({ vapidKey }) for web push */
export const FCM_VAPID_KEY =
  "BGinVDFTAtjjdew-FgbaItj_umBrX7jVLhurnQjBQojPE_mRb5jCGlqh8zlmKNs4vUTnke9bVvvM-RzfvWDXIlA";

export { app, analytics, database, firestore, auth };
