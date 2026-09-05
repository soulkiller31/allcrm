import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { TenantModel } from '../models/Tenant.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { ServiceModel } from '../models/Service.js';
import { TemplateModel } from '../models/Template.js';
import { AdminModel } from '../models/Admin.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { verifyIdToken } from '../config/firebase.js';

const publicTenant = (tenant) => ({
  id: tenant.id,
  name: tenant.name,
  businessType: tenant.business_type,
  phone: tenant.phone,
  address: tenant.address,
  gstin: tenant.gstin,
  logoUrl: tenant.logo_url,
});

const signToken = (admin, tenant) =>
  jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name, tenantId: tenant.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

const subscriptionPayload = (subscription) => subscription ? {
  plan: subscription.plan,
  status: subscription.status,
  trialEndsAt: subscription.trial_ends_at,
  paidUntil: subscription.paid_until,
  daysLeft: SubscriptionModel.daysLeft(subscription),
  isActive: SubscriptionModel.isActive(subscription),
} : null;

const firebaseEnabled = () => !!config.firebase.projectId;

const seedDefaultsForTenant = async (tenant, businessType) => {
  if (['salon', 'spa'].includes((businessType || 'general').toLowerCase())) {
    await ServiceModel.seedDefaults(tenant.id);
  }
  await TemplateModel.seedDefaults(tenant.id);
  try {
    const { SettingsModel } = await import('../models/WhatsApp.js');
    await SettingsModel.set('salon_name', tenant.name, tenant.id);
  } catch (err) {
    console.warn('[Signup] settings seed failed:', err.message);
  }
};

const createTenantAndAdmin = async ({
  email, password, name, businessName, businessType, phone, firebaseUid,
}) => {
  const tenant = await TenantModel.create({
    name: businessName.trim(),
    businessType: businessType || 'general',
    ownerEmail: email.trim(),
    ownerName: name.trim(),
    phone: phone || null,
    firebaseUid,
  });

  // Firebase-only users have no password — use a locked placeholder hash
  // so the NOT NULL constraint is satisfied but email+password login is impossible.
  // They can set a real password later via Settings → Security.
  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : await bcrypt.hash('firebase-oauth-locked-' + Date.now() + Math.random(), 10);
  const admin = await AdminModel.create({
    email: email.trim(),
    passwordHash,
    name: name.trim(),
    tenantId: tenant.id,
    firebaseUid,
  });

  return { tenant, admin };
};

// POST /api/tenant/signup — Firebase idToken + business info (or legacy email+password)
export const signup = asyncHandler(async (req, res) => {
  const { idToken, email, password, name, businessName, businessType, phone } = req.body;

  let resolvedEmail = email;
  let resolvedName = name;
  let resolvedFirebaseUid = null;
  let signupMode = 'legacy';

  if (idToken && firebaseEnabled()) {
    try {
      const decoded = await verifyIdToken(idToken);
      if (!decoded.email) throw new AppError('Firebase account has no email. Please use an email-based sign-in method.', 400);
      resolvedEmail = decoded.email;
      resolvedName = decoded.name || name || '';
      resolvedFirebaseUid = decoded.uid;
      signupMode = 'firebase';
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Invalid Firebase token: ${err.message || 'verification failed'}`, 401);
    }
  }

  if (!resolvedEmail || !resolvedName || !businessName) {
    throw new AppError('email, name and businessName are required', 400);
  }
  if (signupMode === 'legacy') {
    if (!password) throw new AppError('password is required', 400);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);
  }

  const existing = await TenantModel.findByEmail(resolvedEmail);
  if (existing) throw new AppError('An account with this email already exists', 409);

  const { tenant, admin } = await createTenantAndAdmin({
    email: resolvedEmail,
    password: signupMode === 'legacy' ? password : null,
    name: resolvedName,
    businessName,
    businessType,
    phone,
    firebaseUid: resolvedFirebaseUid,
  });

  // Create a pending subscription — user must pay ₹1 to activate the 7-day trial.
  // No free trial is granted automatically on signup.
  const subscription = await SubscriptionModel.createPending(tenant.id);
  await seedDefaultsForTenant(tenant, businessType);

  const legacyToken = signToken(admin, tenant);

  res.status(201).json({
    success: true,
    message: 'Account created. Pay ₹1 to start your 7-day free trial.',
    data: {
      token: legacyToken,
      authMode: signupMode,
      firebaseUid: resolvedFirebaseUid,
      admin: { id: admin.id, email: admin.email, name: admin.name },
      tenant: publicTenant(tenant),
      subscription: subscriptionPayload(subscription),
    },
  });
});

// POST /api/tenant/login — Firebase idToken OR legacy email+password
export const login = asyncHandler(async (req, res) => {
  const { idToken, email, password } = req.body;

  let resolvedEmail = null;
  let resolvedFirebaseUid = null;
  let loginMode = 'legacy';

  if (idToken && firebaseEnabled()) {
    try {
      const decoded = await verifyIdToken(idToken);
      if (!decoded.email && !decoded.uid) {
        throw new AppError('Firebase token missing email/uid.', 401);
      }
      resolvedEmail = decoded.email;
      resolvedFirebaseUid = decoded.uid;
      loginMode = 'firebase';
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Invalid Firebase token: ${err.message || 'verification failed'}`, 401);
    }
  }

  let tenant = null;
  let adminData = null;

  if (loginMode === 'firebase') {
    if (resolvedFirebaseUid) {
      tenant = await TenantModel.findByFirebaseUid(resolvedFirebaseUid);
    }
    if (!tenant && resolvedEmail) {
      tenant = await TenantModel.findByEmail(resolvedEmail);
    }
    if (!tenant) {
      return res.status(200).json({
        success: false,
        message: 'Authenticated with Firebase, but no business account found. Please complete signup first.',
        signupRequired: true,
        authMode: 'firebase',
        firebaseUid: resolvedFirebaseUid,
        data: {
          firebase: {
            uid: resolvedFirebaseUid,
            email: resolvedEmail,
          },
        },
      });
    }
    adminData = await AdminModel.findByTenantId(tenant.id);
    if (!adminData && resolvedEmail) {
      adminData = await AdminModel.findByEmail(resolvedEmail);
    }

    if (!tenant.is_active) throw new AppError('Account disabled.', 401);
    if (!adminData) {
      adminData = {
        id: `fb-${resolvedFirebaseUid}`,
        email: resolvedEmail,
        name: tenant.owner_name || '',
      };
    }

    if (resolvedFirebaseUid) {
      if (!tenant.firebase_uid) {
        try { await TenantModel.update(tenant.id, { firebase_uid: resolvedFirebaseUid }); } catch (_e) {}
      }
      if (!adminData.firebase_uid) {
        try {
          const { default: supabase } = await import('../config/supabase.js');
          await supabase.from('admins').update({ firebase_uid: resolvedFirebaseUid }).eq('id', adminData.id);
        } catch (_e) {}
      }
    }
  } else {
    if (!email || !password) throw new AppError('Email and password are required', 400);
    const normalizedEmail = email?.trim().toLowerCase();
    tenant = await TenantModel.findByEmail(normalizedEmail);
    let passwordValid = false;
    if (tenant) {
      const { default: supabase } = await import('../config/supabase.js');
      const { data: row } = await supabase
        .from('admins').select('*').eq('tenant_id', tenant.id).maybeSingle();
      adminData = row;
      if (adminData) {
        passwordValid = adminData.password_hash ? await bcrypt.compare(password, adminData.password_hash) : false;
      }
    }

    if (!tenant || !adminData || !passwordValid) {
      if (config.nodeEnv !== 'production' &&
        normalizedEmail === config.admin.email?.trim().toLowerCase() &&
        password === config.admin.password
      ) {
        tenant = await TenantModel.findByEmail(normalizedEmail);
        if (!tenant) {
          try {
            tenant = await TenantModel.create({
              name: config.salonName || 'Default Tenant',
              businessType: 'general',
              ownerEmail: normalizedEmail,
              ownerName: config.admin.name || 'Admin',
            });
            try { await SubscriptionModel.createPending(tenant.id); } catch (_) {}
          } catch (_) {
            tenant = { id: 'dev-fallback-tenant', name: config.salonName || 'Dev', business_type: 'general', owner_email: normalizedEmail, owner_name: config.admin.name || 'Admin', is_active: true };
          }
        }
        if (!adminData) {
          adminData = {
            id: 'dev-fallback-admin',
            email: normalizedEmail,
            name: config.admin.name || 'Admin',
            tenant_id: tenant.id,
          };
        }
        if (config.nodeEnv !== 'production') {
          console.warn('[Auth] Using DEV fallback admin credentials — do NOT rely on this in production.');
        }
      } else {
        throw new AppError('Invalid email or password', 401);
      }
    }
  }

  const subscription = await SubscriptionModel.findByTenantId(tenant.id);
  const legacyToken = signToken(adminData, tenant);

  res.json({
    success: true,
    message: 'Login successful',
    authMode: loginMode,
    data: {
      token: legacyToken,
      firebaseUid: resolvedFirebaseUid,
      admin: { id: adminData.id, email: adminData.email, name: adminData.name },
      tenant: publicTenant(tenant),
      subscription: subscriptionPayload(subscription),
    },
  });
});

// GET /api/tenant/me — get current tenant + subscription status
export const getMe = asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  const subscription = req.subscription;

  res.json({
    success: true,
    data: {
      admin: req.admin,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        businessType: tenant.business_type,
        phone: tenant.phone,
        address: tenant.address,
        gstin: tenant.gstin,
        logoUrl: tenant.logo_url,
      },
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        trialEndsAt: subscription.trial_ends_at,
        paidUntil: subscription.paid_until,
        daysLeft: SubscriptionModel.daysLeft(subscription),
        isActive: SubscriptionModel.isActive(subscription),
      } : null,
    },
  });
});

// PUT /api/tenant/me — update business name/type/logo
export const updateMe = asyncHandler(async (req, res) => {
  const { businessName, businessType, phone, address, gstin, logoUrl } = req.body;
  const updates = {};
  if (businessName) updates.name = businessName.trim();
  if (businessType) updates.business_type = businessType;
  if (phone !== undefined) updates.phone = phone || null;
  if (address !== undefined) updates.address = address || null;
  if (gstin !== undefined) updates.gstin = gstin || null;
  if (logoUrl !== undefined) updates.logo_url = logoUrl || null;

  const tenant = await TenantModel.update(req.tenant.id, updates);
  res.json({ success: true, data: { tenant } });
});

// PUT /api/tenant/me/password — set or change password for the current admin
// Google users call this to set their first CRM password.
// Email users must supply currentPassword to change it.
export const setPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const { default: supabase } = await import('../config/supabase.js');
  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, password_hash')
    .eq('id', req.admin.id)
    .maybeSingle();

  if (!adminRow) throw new AppError('Admin not found', 404);

  // If a password already exists, require the current one for verification
  if (adminRow.password_hash) {
    if (!currentPassword) throw new AppError('Current password is required to set a new one', 400);
    const valid = await bcrypt.compare(currentPassword, adminRow.password_hash);
    if (!valid) throw new AppError('Current password is incorrect', 401);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await supabase.from('admins').update({ password_hash: newHash }).eq('id', adminRow.id);

  res.json({ success: true, message: 'Password updated successfully' });
});
