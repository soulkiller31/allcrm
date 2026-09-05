import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app = null;
let auth = null;
let googleProvider = null;
let isConfigured = false;

if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    isConfigured = true;
    console.log('[Firebase] Client SDK initialized. Auth:', !!auth, 'Provider:', !!googleProvider);
  } catch (err) {
    // Log the full error so we can diagnose initialization failures
    console.error('[Firebase] Failed to initialize client SDK:', err);
    app = null;
    auth = null;
    googleProvider = null;
    isConfigured = false;
  }
} else {
  console.warn('[Firebase] VITE_FIREBASE_API_KEY not set. Firebase client features disabled — using legacy auth.');
}

export { app, auth, googleProvider, isConfigured };
