import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { isSupabaseDown, handleDbError, resetSupabaseConnCache } from '../utils/supabaseConn.js';

// ─── In-memory stores (fallback when Supabase is unreachable) ────────────────
const _waMem = {}; // tenantId -> session object
const _setMem = {}; // tenantId -> { key: value }

const getWA = (tenantId) => {
  if (!_waMem[tenantId]) _waMem[tenantId] = null;
  return _waMem[tenantId];
};
const setWA = (tenantId, obj) => {
  if (!obj) { _waMem[tenantId] = null; return; }
  _waMem[tenantId] = {
    ...(_waMem[tenantId] || { id: 'mem-' + tenantId, tenant_id: tenantId }),
    ...obj,
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };
  return _waMem[tenantId];
};

const getSET = (tenantId) => {
  if (!_setMem[tenantId]) _setMem[tenantId] = {};
  return _setMem[tenantId];
};

export const WhatsAppModel = {
  async getSession(tenantId) {
    if (!tenantId) return null;
    if (await isSupabaseDown()) return getWA(tenantId);
    resetSupabaseConnCache();
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new AppError(error.message || 'Failed to fetch WhatsApp session', 500);
      if (data) _waMem[tenantId] = data;
      return data;
    } catch (err) {
      return handleDbError(err, () => getWA(tenantId), 'WhatsAppModel.getSession');
    }
  },

  async updateSession(updates, tenantId) {
    if (!tenantId) return null;
    if (await isSupabaseDown()) return setWA(tenantId, updates);
    resetSupabaseConnCache();
    try {
      const existing = await this.getSession(tenantId);
      const payload = { ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };
      let data;
      if (existing) {
        const { data: upd, error } = await supabase
          .from('whatsapp_sessions')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw new AppError(error.message || 'Failed to update WhatsApp session', 500);
        data = upd;
      } else {
        const { data: ins, error } = await supabase
          .from('whatsapp_sessions')
          .insert(payload)
          .select()
          .single();
        if (error) throw new AppError(error.message || 'Failed to create WhatsApp session', 500);
        data = ins;
      }
      if (data) _waMem[tenantId] = data;
      return data;
    } catch (err) {
      return handleDbError(err, () => setWA(tenantId, updates), 'WhatsAppModel.updateSession');
    }
  },
};

export const SettingsModel = {
  async get(key, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    if (await isSupabaseDown()) {
      const v = getSET(tenantId)[key];
      return v === undefined ? undefined : v;
    }
    resetSupabaseConnCache();
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new AppError(error.message || 'Failed to fetch setting', 500);
      if (data?.value !== undefined) getSET(tenantId)[key] = data.value;
      return data?.value;
    } catch (err) {
      return handleDbError(
        err,
        () => {
          const v = getSET(tenantId)[key];
          return v === undefined ? undefined : v;
        },
        'SettingsModel.get'
      );
    }
  },

  async getString(key, fallback = '', tenantId) {
    const v = await this.get(key, tenantId);
    if (v === undefined || v === null) return fallback;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && typeof v.v === 'string') return v.v;
    return String(v);
  },

  async getBoolean(key, fallback = true, tenantId) {
    const v = await this.get(key, tenantId);
    if (v === undefined || v === null) return fallback;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v !== 'false';
    return Boolean(v);
  },

  async set(key, value, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    if (await isSupabaseDown()) {
      getSET(tenantId)[key] = value;
      return { id: 'mem-' + key, tenant_id: tenantId, key, value, updated_at: new Date().toISOString() };
    }
    resetSupabaseConnCache();
    try {
      const payload = { key, value, tenant_id: tenantId, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'tenant_id,key' })
        .select()
        .single();
      if (error) throw new AppError(error.message || 'Failed to update setting', 500);
      getSET(tenantId)[key] = value;
      return data;
    } catch (err) {
      return handleDbError(
        err,
        () => {
          getSET(tenantId)[key] = value;
          return { id: 'mem-' + key, tenant_id: tenantId, key, value, updated_at: new Date().toISOString() };
        },
        'SettingsModel.set'
      );
    }
  },

  async getAll(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    if (await isSupabaseDown()) {
      return Object.entries(getSET(tenantId)).map(([k, v]) => ({
        id: 'mem-' + k, tenant_id: tenantId, key: k, value: v, updated_at: new Date().toISOString(),
      }));
    }
    resetSupabaseConnCache();
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw new AppError(error.message || 'Failed to fetch settings', 500);
      (data || []).forEach((s) => { getSET(tenantId)[s.key] = s.value; });
      return data || [];
    } catch (err) {
      return handleDbError(
        err,
        () => Object.entries(getSET(tenantId)).map(([k, v]) => ({
          id: 'mem-' + k, tenant_id: tenantId, key: k, value: v, updated_at: new Date().toISOString(),
        })),
        'SettingsModel.getAll'
      );
    }
  },
};
