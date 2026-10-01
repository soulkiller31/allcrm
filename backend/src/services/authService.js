import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

async function getTenantAndAdmin() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const t = await client.query(`
    SELECT t.*,
      (SELECT row_to_json(a) FROM (
        SELECT id, email, name, tenant_id, password_hash, firebase_uid
        FROM admins WHERE email = t.owner_email OR tenant_id = t.id ORDER BY created_at LIMIT 1
      ) a) AS admin,
      (SELECT row_to_json(s) FROM (
        SELECT * FROM subscriptions WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
      ) s) AS subscription
    FROM tenants t ORDER BY t.created_at ASC LIMIT 1
  `);
  await client.end();
  if (t.rows.length === 0) return null;
  return t.rows[0];
}

function daysLeft(s) {
  if (!s) return 3;
  const now = new Date();
  if (s.status === 'trial' && s.trial_ends_at) return Math.max(0, Math.ceil((new Date(s.trial_ends_at) - now) / 86400000));
  if (s.status === 'active' && s.paid_until) return Math.max(0, Math.ceil((new Date(s.paid_until) - now) / 86400000));
  return 0;
}
function isActive(s) {
  if (!s) return true;
  const now = new Date();
  if (s.status === 'trial') return s.trial_ends_at && new Date(s.trial_ends_at) > now;
  if (s.status === 'active') return s.paid_until && new Date(s.paid_until) > now;
  return false;
}

export const AuthService = {
  async login(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) throw new AppError('Email and password are required', 400);

    const business = await getTenantAndAdmin();
    if (!business) throw new AppError('Database not initialized. Run migrations first.', 500);

    const tenant = business;
    const admin = business.admin;
    const sub = business.subscription;

    const fallbackEmail = (config.admin.email || 'admin@salon.com').toLowerCase();
    const fallbackPass = config.admin.password || 'Admin@123456';

    let valid = false;
    if (admin && normalizedEmail === (admin.email || '').toLowerCase()) {
      if (admin.password_hash) {
        valid = await bcrypt.compare(password, admin.password_hash);
      } else {
        valid = password === fallbackPass;
      }
    }
    if (!valid && normalizedEmail === fallbackEmail && password === fallbackPass) {
      valid = true;
    }
    if (!valid) throw new AppError('Invalid email or password', 401);

    const adminId = admin?.id || 'admin-1';
    const adminName = admin?.name || config.admin.name || 'Salon Admin';
    const adminEmail = admin?.email || fallbackEmail;

    const plan = sub?.plan || 'trial';

    const token = jwt.sign(
      {
        id: adminId,
        email: adminEmail,
        name: adminName,
        tenantId: tenant.id,
        plan,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return {
      token,
      admin: {
        id: adminId,
        email: adminEmail,
        name: adminName,
        tenantId: tenant.id,
        tenant_id: tenant.id,
        firebase_uid: admin?.firebase_uid,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        businessType: tenant.business_type,
        business_type: tenant.business_type,
        ownerEmail: tenant.owner_email,
        ownerName: tenant.owner_name,
        phone: tenant.phone || '',
        address: tenant.address || '',
        gstin: tenant.gstin || '',
        logoUrl: tenant.logo_url || '',
        is_active: tenant.is_active !== false,
        firebase_uid: tenant.firebase_uid,
      },
      subscription: {
        id: sub?.id,
        tenantId: tenant.id,
        tenant_id: tenant.id,
        plan,
        status: sub?.status || 'trial',
        trial_ends_at: sub?.trial_ends_at,
        trialEndsAt: sub?.trial_ends_at,
        paid_from: sub?.paid_from,
        paid_until: sub?.paid_until,
        paidUntil: sub?.paid_until,
        cashfree_order_id: sub?.cashfree_order_id,
        cashfree_payment_id: sub?.cashfree_payment_id,
        amount_paid: sub?.amount_paid,
        daysLeft: daysLeft(sub),
        isActive: isActive(sub),
        is_active: isActive(sub),
      },
    };
  },

  async getProfile(adminId) {
    try {
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      const r = await client.query('SELECT id, email, name, firebase_uid FROM admins WHERE id = $1 LIMIT 1', [adminId]);
      await client.end();
      if (r.rows.length) return r.rows[0];
    } catch {}
    return { id: adminId, email: config.admin.email, name: config.admin.name };
  },

  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  },
};
