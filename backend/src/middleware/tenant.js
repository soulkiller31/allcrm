import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import pg from 'pg';

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000;

async function getDefaultBusiness() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;
  try {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const t = await client.query(`
      SELECT t.*,
        (SELECT row_to_json(a) FROM (
          SELECT id, email, name, tenant_id, firebase_uid FROM admins WHERE tenant_id = t.id OR email = t.owner_email LIMIT 1
        ) a) AS admin,
        (SELECT row_to_json(s) FROM (
          SELECT * FROM subscriptions WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
        ) s) AS subscription
      FROM tenants t ORDER BY t.created_at ASC LIMIT 1
    `);
    await client.end();
    if (t.rows.length === 0) throw new Error('No tenant row in DB');
    const row = t.rows[0];
    _cache = { tenant: row, admin: row.admin, subscription: row.subscription };
    _cacheAt = now;
    return _cache;
  } catch (e) {
    console.warn('[tenant] getDefaultBusiness failed:', e.message);
    if (_cache) return _cache;
    throw e;
  }
}

function daysLeft(s) {
  if (!s) return 0;
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

export const authenticateTenant = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError('Token expired. Please login again.', 401);
      throw new AppError('Invalid token.', 401);
    }
    if (!decoded) throw new AppError('Invalid token.', 401);

    const data = await getDefaultBusiness();
    const tenant = data.tenant;
    const admin = data.admin || { id: decoded.id, email: decoded.email, name: decoded.name, tenant_id: tenant.id };
    const sub = data.subscription;
    const plan = sub?.plan || 'trial';

    req.admin = {
      id: admin.id || decoded.id,
      email: admin.email || decoded.email,
      name: admin.name || decoded.name,
      tenantId: tenant.id,
      tenant_id: tenant.id,
      firebase_uid: admin.firebase_uid,
    };

    req.tenant = {
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
    };

    req.subscription = {
      id: sub?.id,
      tenantId: tenant.id,
      tenant_id: tenant.id,
      plan: decoded.plan || plan,
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
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const requireSubscription = async (_req, _res, next) => {
  next();
};

export const authenticate = authenticateTenant;
