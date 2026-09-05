import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'customers';

const sameMonthDay = (dateValue, month, day) => {
  if (!dateValue) return false;
  const parts = String(dateValue).split('-');
  return parts.length === 3 && parts[1] === month && parts[2] === day;
};

const normalizeGender = (gender) => String(gender || '').trim().toLowerCase();

const daysSinceDate = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
};

const isFollowUpDue = (customer, gender, minDays) => {
  const days = daysSinceDate(customer.last_visit);
  return normalizeGender(customer.gender) === gender && days !== null && days >= minDays;
};

export const CustomerModel = {
  async findAll({ tenantId, search, gender, isActive, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' }) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    let q = supabase.from(TABLE).select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    if (gender) q = q.eq('gender', gender);
    if (isActive !== undefined && isActive !== '') q = q.eq('is_active', isActive === 'true' || isActive === true);
    const field = ['name', 'phone', 'created_at', 'last_visit', 'birthday'].includes(sortBy) ? sortBy : 'created_at';
    q = q.order(field, { ascending: sortOrder === 'asc' });
    const from = (page - 1) * limit;
    q = q.range(from, from + limit - 1);
    const { data, error, count } = await q;
    if (error) throw new AppError('Failed to fetch customers', 500);
    return { data: data || [], total: count || 0, page, limit };
  },

  async findById(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (error) throw new AppError('Customer not found', 404);
    return data;
  },

  async findByPhone(phone, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('phone', phone).eq('tenant_id', tenantId).maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  async create(customer) {
    if (!customer.tenant_id) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).insert(customer).select().single();
    if (error) throw new AppError(error.message || 'Failed to create customer', 500);
    return data;
  },

  async update(id, updates, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { tenant_id, id: _id, ...safe } = updates;
    const { data, error } = await supabase.from(TABLE).update(safe).eq('id', id).eq('tenant_id', tenantId).select().single();
    if (error) throw new AppError(error.message || 'Failed to update customer', 500);
    return data;
  },

  async delete(id, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) throw new AppError('Failed to delete customer', 500);
  },

  async getStats(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { count: total } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    const { count: active } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true);
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const { data: cust } = await supabase.from(TABLE).select('birthday,last_visit,gender').eq('tenant_id', tenantId).eq('is_active', true);
    const birthdaysToday = (cust || []).filter((c) => sameMonthDay(c.birthday, month, day)).length;
    const followUpDue = (cust || []).filter((c) => isFollowUpDue(c, 'female', 15) || isFollowUpDue(c, 'male', 75)).length;
    return { total: total || 0, active: active || 0, birthdaysToday, followUpDue };
  },

  async findBirthdaysToday(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const { data, error } = await supabase.from(TABLE).select('*').eq('tenant_id', tenantId).eq('is_active', true);
    if (error) throw new AppError('Failed to fetch birthday customers', 500);
    return (data || []).filter((c) => sameMonthDay(c.birthday, month, day));
  },

  async findAnniversariesToday(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const { data, error } = await supabase.from(TABLE).select('*').eq('tenant_id', tenantId).eq('is_active', true);
    if (error) throw new AppError('Failed to fetch anniversary customers', 500);
    return (data || []).filter((c) => sameMonthDay(c.anniversary, month, day));
  },

  async findFollowUpDue({ tenantId, gender, minDaysSinceVisit }) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('tenant_id', tenantId).eq('is_active', true).not('last_visit', 'is', null);
    if (error) throw new AppError('Failed to fetch follow-up customers', 500);
    return (data || []).filter((c) => isFollowUpDue(c, gender, minDaysSinceVisit));
  },

  async findAllActive(tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const { data, error } = await supabase.from(TABLE).select('*').eq('tenant_id', tenantId).eq('is_active', true);
    if (error) throw new AppError('Failed to fetch customers', 500);
    return data || [];
  },
};
