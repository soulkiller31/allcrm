import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'invoices';

export const InvoiceModel = {
  async getNextNumber(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase
      .from(TABLE)
      .select('invoice_number')
      .eq('tenant_id', tenantId)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError('Failed to fetch next invoice number', 500);
    return (data?.invoice_number || 0) + 1;
  },

  async findAll({ tenantId, page = 1, limit = 20 } = {}) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const from = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new AppError('Failed to fetch invoices', 500);
    return { data: data || [], total: count || 0, page, limit };
  },

  async findById(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (error) throw new AppError('Invoice not found', 404);
    return data;
  },

  async create(invoice) {
    if (!invoice.tenant_id) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).insert(invoice).select().single();
    if (error) throw new AppError(error.message || 'Failed to create invoice', 500);
    return data;
  },

  async markWhatsAppSent(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase
      .from(TABLE)
      .update({ whatsapp_sent: true })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new AppError('Failed to update invoice', 500);
    return data;
  },

  async getReport({ tenantId, filter = 'month', start, end } = {}) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    let query = supabase.from(TABLE).select(`
      invoice_number, customer_name, customer_phone, items, total, created_at,
      payment_method, cash_amount, online_amount,
      customers!customer_id (birthday, anniversary)
    `).eq('tenant_id', tenantId).order('created_at', { ascending: false });

    const now = new Date();
    if (filter === 'today') {
      const d = now.toISOString().split('T')[0];
      query = query.gte('created_at', `${d}T00:00:00.000Z`).lte('created_at', `${d}T23:59:59.999Z`);
    } else if (filter === 'month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const last = new Date(y, now.getMonth() + 1, 0).getDate();
      query = query.gte('created_at', `${y}-${m}-01T00:00:00.000Z`).lte('created_at', `${y}-${m}-${String(last).padStart(2, '0')}T23:59:59.999Z`);
    } else if (filter === 'custom') {
      query = query.gte('created_at', `${start}T00:00:00.000Z`).lte('created_at', `${end}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Failed to fetch report: ${error.message}`, 500);

    return (data || []).map((row) => ({
      invoice_number: row.invoice_number,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      items: row.items || [],
      total: row.total,
      created_at: row.created_at,
      payment_method: row.payment_method || 'cash',
      cash_amount: row.cash_amount ?? null,
      online_amount: row.online_amount ?? null,
      birthday: row.customers?.birthday ?? null,
      anniversary: row.customers?.anniversary ?? null,
    }));
  },
};
