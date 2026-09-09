import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  getIdToken,
  updateProfile,
} from 'firebase/auth';
import { tenantAPI } from '../services/api';
import { auth as firebaseAuth, googleProvider, isConfigured as fbConfigured } from '../config/firebase';

const AuthContext = createContext(null);

const stored    = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const storedRaw = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

const mapFirebaseError = (err) => {
  if (!err) return 'Something went wrong';
  const code = err.code || '';
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
      return 'Invalid email or password';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/operation-not-allowed':
      return 'Sign-in provider not enabled for this project.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Popup was blocked. Please allow popups for this site.';
    default:
      return err.message || 'Something went wrong';
  }
};

export function AuthProvider({ children }) {
  const [admin, setAdmin]               = useState(() => stored('admin'));
  const [tenant, setTenant]             = useState(() => stored('tenant'));
  const [subscription, setSubscription] = useState(() => stored('subscription'));
  const [loading, setLoading]           = useState(true);
  const [pendingSignup, setPendingSignup] = useState(() => stored('pendingSignup'));

  const setAll = (data) => {
    setAdmin(data.admin);
    setTenant(data.tenant);
    setSubscription(data.subscription);
    localStorage.setItem('token', data.token);
    localStorage.setItem('admin', JSON.stringify(data.admin));
    localStorage.setItem('tenant', JSON.stringify(data.tenant));
    localStorage.setItem('subscription', JSON.stringify(data.subscription));
    localStorage.removeItem('pendingSignup');
    setPendingSignup(null);
  };

  const verifyAuth = useCallback(async () => {
    const token = storedRaw('token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await tenantAPI.me();
      setAdmin(data.data.admin);
      setTenant(data.data.tenant);
      setSubscription(data.data.subscription);
      localStorage.setItem('admin', JSON.stringify(data.data.admin));
      localStorage.setItem('tenant', JSON.stringify(data.data.tenant));
      localStorage.setItem('subscription', JSON.stringify(data.data.subscription));
    } catch {
      localStorage.clear();
      setAdmin(null); setTenant(null); setSubscription(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { verifyAuth(); }, [verifyAuth]);

  // Keep Firebase ID token fresh in localStorage — but ONLY when the stored
  // token is a raw Firebase RS256 token. Never overwrite a backend HS256 JWT.
  useEffect(() => {
    if (!fbConfigured || !firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) return;
      try {
        const existing = storedRaw('token');
        if (existing) {
          // Safely decode the JWT header — if it fails, assume backend JWT and leave alone
          let alg = 'HS256';
          try {
            const parts = existing.split('.');
            if (parts.length === 3) {
              const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
              alg = JSON.parse(headerJson).alg || 'HS256';
            }
          } catch (_) {
            alg = 'HS256'; // parse failed — treat as backend JWT, don't overwrite
          }
          if (alg !== 'RS256') return; // backend JWT — leave it alone
        }
        // Only reaches here if no token stored OR existing token is RS256 (Firebase)
        const freshToken = await getIdToken(user, false);
        localStorage.setItem('token', freshToken);
      } catch (_) {}
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    if (!fbConfigured || !firebaseAuth) {
      const { data } = await tenantAPI.login({ email, password });
      setAll(data.data);
      return data;
    }
    try {
      const cred  = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await getIdToken(cred.user, true);
      const { data } = await tenantAPI.login({ idToken });
      if (data?.signupRequired) {
        const info = data.data?.firebase || { uid: data.firebaseUid, email };
        localStorage.setItem('pendingSignup', JSON.stringify(info));
        setPendingSignup(info);
        return data;
      }
      setAll(data.data);
      return data;
    } catch (err) {
      const msg = mapFirebaseError(err);
      const wrapped = new Error(msg);
      wrapped.response = { data: { message: msg } };
      throw wrapped;
    }
  };

  const signup = async (payload) => {
    const { email, password, name, businessName, businessType, phone } = payload;

    if (!fbConfigured || !firebaseAuth) {
      const { data } = await tenantAPI.signup(payload);
      setAll(data.data);
      return data;
    }
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (name && cred.user?.displayName !== name) {
        try { await updateProfile(cred.user, { displayName: name }); } catch (_) {}
      }
      const idToken = await getIdToken(cred.user, true);
      const { data } = await tenantAPI.signup({ idToken, name, businessName, businessType, phone });
      setAll(data.data);
      return data;
    } catch (err) {
      const msg = mapFirebaseError(err);
      const wrapped = new Error(msg);
      wrapped.response = { data: { message: msg } };
      throw wrapped;
    }
  };

  const loginWithGoogle = async () => {
    if (!fbConfigured || !firebaseAuth || !googleProvider) {
      throw new Error('Google sign-in is not configured.');
    }
    try {
      const result  = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await getIdToken(result.user, true);
      const { data } = await tenantAPI.login({ idToken });
      if (data?.signupRequired) {
        const info = data.data?.firebase || {
          uid: data.firebaseUid,
          email: result.user?.email,
          name:  result.user?.displayName,
        };
        localStorage.setItem('pendingSignup', JSON.stringify(info));
        setPendingSignup(info);
        return data;
      }
      setAll(data.data);
      return data;
    } catch (err) {
      const msg = mapFirebaseError(err);
      const wrapped = new Error(msg);
      wrapped.response = { data: { message: msg } };
      throw wrapped;
    }
  };

  // Called after Google sign-in returned signupRequired=true.
  // The user is already authenticated with Google — just need business info.
  // Uses firebaseAuth.currentUser to get a fresh idToken without re-authenticating.
  const completeGoogleSignup = async ({ name, businessName, businessType, phone }) => {
    const user = firebaseAuth?.currentUser;
    if (!user) {
      throw new Error('Google session expired. Please click "Continue with Google" again.');
    }
    try {
      const idToken = await getIdToken(user, true);
      const { data } = await tenantAPI.signup({ idToken, name, businessName, businessType, phone });
      setAll(data.data);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Signup failed';
      const wrapped = new Error(msg);
      wrapped.response = err.response || { data: { message: msg } };
      throw wrapped;
    }
  };

  const logout = async () => {
    if (fbConfigured && firebaseAuth) {
      try { await signOut(firebaseAuth); } catch (_) {}
    }
    localStorage.clear();
    setAdmin(null); setTenant(null); setSubscription(null); setPendingSignup(null);
  };

  const clearPendingSignup = () => {
    localStorage.removeItem('pendingSignup');
    setPendingSignup(null);
  };

  const refreshSubscription = async () => {
    try {
      const { data } = await tenantAPI.me();
      setTenant(data.data.tenant);
      setSubscription(data.data.subscription);
      localStorage.setItem('tenant', JSON.stringify(data.data.tenant));
      localStorage.setItem('subscription', JSON.stringify(data.data.subscription));
      return data.data.subscription;
    } catch { return subscription; }
  };

  const isSubscriptionActive = () => {
    if (!subscription) return false;
    const now = new Date();
    if (subscription.status === 'trial') return subscription.trialEndsAt && new Date(subscription.trialEndsAt) > now;
    if (subscription.status === 'active') return subscription.paidUntil && new Date(subscription.paidUntil) > now;
    return false;
  };

  const daysLeft = () => {
    if (!subscription) return 0;
    const now = new Date();
    const end = subscription.status === 'trial' ? subscription.trialEndsAt : subscription.paidUntil;
    if (!end) return 0;
    return Math.max(0, Math.ceil((new Date(end) - now) / 86400000));
  };

  return (
    <AuthContext.Provider value={{
      admin, tenant, subscription, loading, pendingSignup,
      isAuthenticated: !!admin,
      isSubscriptionActive: isSubscriptionActive(),
      daysLeft: daysLeft(),
      firebaseConfigured: fbConfigured,
      login, signup, loginWithGoogle, completeGoogleSignup, logout,
      refreshSubscription, clearPendingSignup,
      needsOnboarding: !!admin && !tenant?.name,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
