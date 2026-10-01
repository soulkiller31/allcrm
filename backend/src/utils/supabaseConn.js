import supabase from '../config/supabase.js';

let _tried = false;
let _unreachable = false;
let _lastCheck = 0;
const TTL_MS = 30_000;

export const isSupabaseDown = async () => {
  const now = Date.now();
  if (_tried && now - _lastCheck < TTL_MS) return _unreachable;

  try {
    const { error } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
    _tried = true;
    _lastCheck = now;
    if (error) {
      const m = (error.message || '').toLowerCase();
      const netErr =
        m.includes('econnrefused') ||
        m.includes('enotfound') ||
        m.includes('network') ||
        m.includes('failed to fetch') ||
        m.includes('getaddrinfo') ||
        m.includes('timeout') ||
        m.includes('etimedout') ||
        m.includes('socket hang up');
      if (netErr) {
        _unreachable = true;
        return true;
      }
    }
    _unreachable = false;
    return false;
  } catch (err) {
    const m = (err?.message || '').toLowerCase();
    const netErr =
      m.includes('econnrefused') ||
      m.includes('enotfound') ||
      m.includes('network') ||
      m.includes('failed to fetch') ||
      m.includes('getaddrinfo') ||
      m.includes('timeout') ||
      m.includes('etimedout') ||
      m.includes('socket hang up');
    _tried = true;
    _lastCheck = now;
    _unreachable = !!netErr;
    return _unreachable;
  }
};

export const resetSupabaseConnCache = () => { _tried = false; _unreachable = false; _lastCheck = 0; };

export const handleDbError = (error, fallbackFn, label = 'database') => {
  const m = (error?.message || '').toLowerCase();
  const netErr =
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('network') ||
    m.includes('failed to fetch') ||
    m.includes('getaddrinfo') ||
    m.includes('timeout') ||
    m.includes('etimedout') ||
    m.includes('socket hang up');
  if (netErr) {
    console.warn(`[DB] ${label} Supabase unreachable (${m || error.message}). Using memory fallback.`);
    _unreachable = true;
    _tried = true;
    _lastCheck = Date.now();
    return fallbackFn();
  }
  throw error;
};
