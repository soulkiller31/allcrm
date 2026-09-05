import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const migrationHint = 'Database schema is not ready. Run the SQL from supabase/migrations/001_initial_schema.sql in Supabase SQL Editor.';

function toDatabaseError(error) {
  const code = error?.code;
  const message = error?.message || '';

  if (code === 'PGRST205' || code === '42P01' || message.includes('Could not find the table') || message.includes('does not exist')) {
    return new AppError(migrationHint, 500);
  }

  return new AppError('Database error', 500);
}

export const AdminModel = {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw toDatabaseError(error);
    }
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('admins')
      .select('id, email, name, created_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new AppError('Admin not found', 404);
      throw toDatabaseError(error);
    }
    return data;
  },

  async create({ email, passwordHash, name, tenantId, firebaseUid }) {
    const { data, error } = await supabase
      .from('admins')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash || null,
        name,
        tenant_id: tenantId || null,
        firebase_uid: firebaseUid || null,
      })
      .select('id, email, name, created_at, tenant_id, firebase_uid')
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError('Email already exists', 409);
      throw toDatabaseError(error);
    }
    return data;
  },

  async findByTenantId(tenantId) {
    const { data, error } = await supabase
      .from('admins')
      .select('id, email, name, created_at, tenant_id, firebase_uid')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (error) throw toDatabaseError(error);
    return data;
  },
};
