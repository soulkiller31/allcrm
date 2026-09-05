import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const WhatsAppModel = {
  async getSession(tenantId) {
    if (!tenantId) return null;
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError('Failed to fetch WhatsApp session', 500);
    return data;
  },

  async updateSession(updates, tenantId) {
    if (!tenantId) return null;
    const existing = await this.getSession(tenantId);
    const payload = { ...updates, tenant_id: tenantId, updated_at: new Date().toISOString() };

    if (existing) {
      const { data, error } = await supabase.from('whatsapp_sessions').update(payload).eq('id', existing.id).select().single();
      if (error) throw new AppError('Failed to update WhatsApp session', 500);
      return data;
    }
    const { data, error } = await supabase.from('whatsapp_sessions').insert(payload).select().single();
    if (error) throw new AppError('Failed to create WhatsApp session', 500);
    return data;
  },
};

export const SettingsModel = {
  async get(key, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).eq('tenant_id', tenantId).maybeSingle();
    if (error) throw new AppError('Failed to fetch setting', 500);
    return data?.value;
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
    const payload = { key, value, tenant_id: tenantId, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'tenant_id,key' })
      .select()
      .single();
    if (error) throw new AppError('Failed to update setting', 500);
    return data;
  },

  async getAll(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from('app_settings').select('*').eq('tenant_id', tenantId);
    if (error) throw new AppError('Failed to fetch settings', 500);
    return data || [];
  },
};
