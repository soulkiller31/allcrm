import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'message_logs';

export const MessageLogModel = {
  async findAll({ tenantId, status, type, page = 1, limit = 20 }) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    let q = supabase.from(TABLE).select('*, customers(name), message_templates(name)', { count: 'exact' }).eq('tenant_id', tenantId).order('sent_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (type) q = q.eq('type', type);
    const from = (page - 1) * limit;
    q = q.range(from, from + limit - 1);
    const { data, error, count } = await q;
    if (error) throw new AppError('Failed to fetch message logs', 500);
    return { data: data || [], total: count || 0, page, limit };
  },

  async create(log) {
    if (!log.tenant_id) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).insert(log).select().single();
    if (error) throw new AppError('Failed to create message log', 500);
    return data;
  },

  async wasSentToday(customerId, type, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('customer_id', customerId).eq('type', type).eq('status', 'sent').gte('sent_at', `${today}T00:00:00`);
    return error ? false : (count || 0) > 0;
  },

  async wasSentWithinDays(customerId, type, days, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const { count, error } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('customer_id', customerId).eq('type', type).eq('status', 'sent').gte('sent_at', cutoff.toISOString());
    return error ? false : (count || 0) > 0;
  },

  async getStats(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const b = () => supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    const { count: total } = await b();
    const { count: sent } = await b().eq('status', 'sent');
    const { count: failed } = await b().eq('status', 'failed');
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await b().gte('sent_at', `${today}T00:00:00`);
    return { total: total || 0, sent: sent || 0, failed: failed || 0, today: todayCount || 0 };
  },
};
