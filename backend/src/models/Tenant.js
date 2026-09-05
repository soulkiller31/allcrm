import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const TenantModel = {
  async findById(id) {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
    if (error) throw new AppError('Tenant not found', 404);
    return data;
  },

  async findByEmail(email) {
    const { data, error } = await supabase.from('tenants').select('*').eq('owner_email', email.toLowerCase()).maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  async findBySupabaseUserId(uid) {
    const { data, error } = await supabase.from('tenants').select('*').eq('supabase_user_id', uid).maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  async findByFirebaseUid(firebaseUid) {
    const { data, error } = await supabase.from('tenants').select('*').eq('firebase_uid', firebaseUid).maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  async create({ name, businessType, ownerEmail, ownerName, phone, address, gstin, supabaseUserId, firebaseUid }) {
    const { data, error } = await supabase.from('tenants').insert({
      name,
      business_type: businessType || 'general',
      owner_email: ownerEmail.toLowerCase(),
      owner_name: ownerName || '',
      phone: phone || null,
      address: address || null,
      gstin: gstin || null,
      supabase_user_id: supabaseUserId || null,
      firebase_uid: firebaseUid || null,
    }).select().single();
    if (error) throw new AppError(error.message || 'Failed to create tenant', 500);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase.from('tenants').update(updates).eq('id', id).select().single();
    if (error) throw new AppError('Failed to update tenant', 500);
    return data;
  },
};
