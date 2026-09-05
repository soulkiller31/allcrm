import * as adminModule from 'firebase-admin';
import { getAuth as firebaseGetAuth } from 'firebase-admin/auth';
import config from './index.js';

// firebase-admin v12+ splits sub-products into separate entry points.
// cert/initializeApp/getApp live on the root; getAuth lives in firebase-admin/auth.
const admin = adminModule.default ?? adminModule;
const certFn = admin.cert ?? admin.credential?.cert;
const initializeApp = admin.initializeApp;
const getApp = admin.getApp ?? admin.app;

let app = null;

const getFirebaseApp = () => {
  if (app) return app;

  if (!config.firebase.projectId) {
    console.warn('[Firebase] FIREBASE_PROJECT_ID not set. Firebase auth features disabled.');
    return null;
  }

  try {
    const serviceAccount = {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey
        ? config.firebase.privateKey.replace(/\\n/g, '\n')
        : undefined,
    };

    if (serviceAccount.privateKey && serviceAccount.clientEmail && certFn) {
      app = initializeApp({
        credential: certFn(serviceAccount),
        projectId: serviceAccount.projectId,
      });
    } else {
      app = initializeApp({
        projectId: serviceAccount.projectId,
      });
    }

    console.log('[Firebase] Admin SDK initialized.');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      app = getApp();
    } else {
      console.error('[Firebase] Failed to initialize Admin SDK:', err.message);
      app = null;
    }
  }

  return app;
};

export const getAuth = () => {
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  return firebaseGetAuth(fbApp);
};

export const verifyIdToken = async (token) => {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Firebase auth not configured');
  }
  try {
    // checkRevoked=false — avoids a Google network round-trip on every request.
    const decoded = await auth.verifyIdToken(token, false);
    return decoded;
  } catch (err) {
    console.error('[Firebase] verifyIdToken failed:', err.code, err.message);
    throw err;
  }
};

export default getFirebaseApp;
