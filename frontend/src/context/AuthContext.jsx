import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tenantAPI, authAPI } from '../services/api';

const AuthContext = createContext(null);

const stored = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const storedRaw = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => stored('admin'));
  const [tenant, setTenant] = useState(() => stored('tenant'));
  const [subscription, setSubscription] = useState(() => stored('subscription'));
  const [loading, setLoading] = useState(true);

  const setAll = (data) => {
    setAdmin(data.admin);
    setTenant(data.tenant);
    setSubscription(data.subscription);
    localStorage.setItem('token', data.token);
    localStorage.setItem('admin', JSON.stringify(data.admin));
    localStorage.setItem('tenant', JSON.stringify(data.tenant));
    localStorage.setItem('subscription', JSON.stringify(data.subscription));
  };

  const verifyAuth = useCallback(async () => {
    const token = storedRaw('token');
    if (!token) {
      setLoading(false);
      return;
    }
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
      setAdmin(null);
      setTenant(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    setAll(data.data);
    return data;
  };

  const signup = async () => {
    throw new Error('Signup is disabled. Only admin@salon.com can login.');
  };

  const loginWithGoogle = async () => {
    throw new Error('Google sign-in is disabled. Please use email and password.');
  };

  const completeGoogleSignup = async () => {
    throw new Error('Signup is disabled.');
  };

  const logout = async () => {
    localStorage.clear();
    setAdmin(null);
    setTenant(null);
    setSubscription(null);
  };

  const clearPendingSignup = () => {};

  const refreshSubscription = async () => {
    try {
      const { data } = await tenantAPI.me();
      setTenant(data.data.tenant);
      setSubscription(data.data.subscription);
      localStorage.setItem('tenant', JSON.stringify(data.data.tenant));
      localStorage.setItem('subscription', JSON.stringify(data.data.subscription));
      return data.data.subscription;
    } catch {
      return subscription;
    }
  };

  const isSubscriptionActive = () => true;

  const daysLeft = () => 365;

  return (
    <AuthContext.Provider
      value={{
        admin,
        tenant,
        subscription,
        loading,
        pendingSignup: null,
        isAuthenticated: !!admin,
        isSubscriptionActive: true,
        daysLeft: 365,
        firebaseConfigured: false,
        login,
        signup,
        loginWithGoogle,
        completeGoogleSignup,
        logout,
        refreshSubscription,
        clearPendingSignup,
        needsOnboarding: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
