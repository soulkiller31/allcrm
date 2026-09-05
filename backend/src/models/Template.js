import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'message_templates';

const DEFAULT_TEMPLATES = [
  { type: 'birthday', name: 'Birthday Wishes', content: 'Happy Birthday {{name}}! Wishing you a wonderful day from {{salon_name}}.' },
  { type: 'anniversary', name: 'Anniversary Wishes', content: 'Happy Anniversary {{name}}! Celebrate with us at {{salon_name}}.' },
  { type: 'monthly_offer', name: 'Monthly Offer', content: 'Hi {{name}}! {{salon_name}} has exciting offers this month. Visit us!' },
  { type: 'follow_up_female', name: 'Female Follow Up (15 Days)', content: 'Hi {{name}}! It has been 15 days since your visit to {{salon_name}}. We would love to welcome you back.' },
  { type: 'follow_up_male', name: 'Male Follow Up (75 Days)', content: 'Hi {{name}}! It has been some time since your last visit to {{salon_name}}. Book whenever you are ready.' },
  { type: 'follow_up', name: 'General Follow Up', content: 'Hi {{name}}! It has been a while since your last visit to {{salon_name}}. We miss you!' },
];

export const TemplateModel = {
  async findAll({ tenantId, type, isActive } = {}) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    let q = supabase.from(TABLE).select('*').eq('tenant_id', tenantId).order('type').order('name');
    if (type) q = q.eq('type', type);
    if (isActive !== undefined) q = q.eq('is_active', isActive);
    const { data, error } = await q;
    if (error) throw new AppError('Failed to fetch templates', 500);
    return data || [];
  },

  async findById(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (error) throw new AppError('Template not found', 404);
    return data;
  },

  async findActiveByType(type, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase
      .from(TABLE).select('*').eq('type', type).eq('is_active', true).eq('tenant_id', tenantId).limit(1).maybeSingle();
    if (error) throw new AppError('Failed to fetch template', 500);
    return data;
  },

  async findFirstActiveByTypes(types = [], tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    if (!types.length) return null;
    const { data, error } = await supabase.from(TABLE).select('*').in('type', types).eq('is_active', true).eq('tenant_id', tenantId);
    if (error) throw new AppError('Failed to fetch template', 500);
    return types.map((type) => (data || []).find((t) => t.type === type)).find(Boolean) || null;
  },

  async create(template) {
    if (!template.tenant_id) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).insert(template).select().single();
    if (error) throw new AppError('Failed to create template', 500);
    return data;
  },

  async update(id, updates, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { tenant_id, ...safe } = updates;
    const { data, error } = await supabase.from(TABLE).update(safe).eq('id', id).eq('tenant_id', tenantId).select().single();
    if (error) throw new AppError('Failed to update template', 500);
    return data;
  },

  async delete(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) throw new AppError('Failed to delete template', 500);
  },

  async seedDefaults(tenantId) {
    if (!tenantId) return;
    const rows = DEFAULT_TEMPLATES.map((t) => ({ ...t, tenant_id: tenantId, is_active: true }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) console.warn('[Templates] Seed failed:', error.message);
  },
};
