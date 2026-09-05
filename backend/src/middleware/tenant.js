import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import { TenantModel } from '../models/Tenant.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { AdminModel } from '../models/Admin.js';
import { verifyIdToken } from '../config/firebase.js';

const buildAdminPayload = (admin, tenant) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  tenantId: tenant.id,
});

const resolveTenantAndAdmin = async (firebaseUid, emailFromToken) => {
  let tenant = null;
  if (firebaseUid) {
    tenant = await TenantModel.findByFirebaseUid(firebaseUid);
  }
  if (!tenant && emailFromToken) {
    tenant = await TenantModel.findByEmail(emailFromToken);
  }
  if (!tenant) return null;

  let admin = await AdminModel.findByTenantId(tenant.id);
  if (!admin && emailFromToken) {
    admin = await AdminModel.findByEmail(emailFromToken);
  }
  if (!admin) return null;

  return { tenant, admin };
};

const authenticateWithFirebase = async (token) => {
  try {
    const decoded = await verifyIdToken(token);
    const firebaseUid = decoded.uid;
    const email = decoded.email;
    const name = decoded.name || '';

    const resolved = await resolveTenantAndAdmin(firebaseUid, email);
    if (!resolved) {
      return { type: 'signup_required', firebaseUid, email, name };
    }

    const { tenant, admin } = resolved;
    if (!tenant.is_active) throw new AppError('Account disabled.', 401);

    if (!tenant.firebase_uid && firebaseUid) {
      try { await TenantModel.update(tenant.id, { firebase_uid: firebaseUid }); }
      catch (_e) { /* ignore */ }
    }
    if (!admin.firebase_uid && firebaseUid) {
      try {
        const { default: supabase } = await import('../config/supabase.js');
        await supabase.from('admins').update({ firebase_uid: firebaseUid }).eq('id', admin.id);
      } catch (_e) { /* ignore */ }
    }

    const subscription = await SubscriptionModel.findByTenantId(tenant.id);
    return {
      type: 'ok',
      admin: buildAdminPayload({ ...admin, name: admin.name || name }, tenant),
      tenant,
      subscription,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    return { type: 'invalid', error: err };
  }
};

const authenticateWithLegacyJwt = (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError('Token expired. Please login again.', 401);
    return { type: 'invalid' };
  }
  return { type: 'jwt', decoded };
};

export const authenticateTenant = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    let admin = null;
    let tenant = null;
    let subscription = null;

    const firebaseEnabled = !!config.firebase.projectId;

    // A Firebase ID token is always a JWT whose header encodes { alg: "RS256" }.
    // Our own legacy JWTs use HS256. We detect Firebase tokens by decoding the
    // header without verification so we know which path owns this token.
    const looksLikeFirebaseToken = (() => {
      try {
        const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
        return header.alg === 'RS256';
      } catch {
        return false;
      }
    })();

    if (firebaseEnabled) {
      const fbResult = await authenticateWithFirebase(token);
      if (fbResult.type === 'ok') {
        admin = fbResult.admin;
        tenant = fbResult.tenant;
        subscription = fbResult.subscription;
      } else if (fbResult.type === 'signup_required') {
        throw new AppError(
          'Account not registered. Please complete signup first.',
          403
        );
      } else if (fbResult.type === 'invalid') {
        // If the token header says RS256 it was definitely sent as a Firebase
        // token — surface the real error rather than silently falling through
        // to the legacy JWT path (which would give a misleading "Invalid token").
        if (looksLikeFirebaseToken) {
          const reason = fbResult.error?.message || 'Firebase token verification failed';
          throw new AppError(`Authentication failed: ${reason}`, 401);
        }
        // Otherwise it might be a legacy JWT — fall through to the JWT path below.
      } else {
        throw fbResult.error || new AppError('Authentication failed.', 401);
      }
    }

    if (!admin) {
      const legacy = authenticateWithLegacyJwt(token);
      if (legacy.type !== 'jwt') {
        throw new AppError('Invalid token.', 401);
      }
      const decoded = legacy.decoded;
      if (!decoded.tenantId) {
        throw new AppError('Invalid token: missing tenant context. Please login again.', 401);
      }
      tenant = await TenantModel.findById(decoded.tenantId);
      if (!tenant || !tenant.is_active) throw new AppError('Account not found or disabled.', 401);
      subscription = await SubscriptionModel.findByTenantId(tenant.id);
      admin = { id: decoded.id, email: decoded.email, name: decoded.name, tenantId: tenant.id };
    }

    req.admin = admin;
    req.tenant = tenant;
    req.subscription = subscription;
    next();
  } catch (err) {
    next(err);
  }
};

// Checks that tenant has an active trial or paid subscription
export const requireSubscription = async (req, res, next) => {
  try {
    if (!req.tenant) {
      return next(new AppError('Tenant context required', 401));
    }

    const { subscription } = req;
    if (!subscription || !SubscriptionModel.isActive(subscription)) {
      return next(new AppError('Subscription expired. Please renew your plan.', 402));
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Backward-compat alias so existing routes using authenticate still work
export const authenticate = authenticateTenant;
