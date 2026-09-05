import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AdminModel } from '../models/Admin.js';
import { TenantModel } from '../models/Tenant.js';
import { AppError } from '../middleware/errorHandler.js';

export const AuthService = {
  async login(email, password) {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPassword = password;

    let admin = null;

    try {
      admin = await AdminModel.findByEmail(normalizedEmail);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        throw error;
      }

      console.error('[Auth] Database lookup failed:', error.message);
      if (config.nodeEnv === 'production') {
        throw new AppError('Authentication service temporarily unavailable', 503);
      }
    }

    if (admin) {
      const isValid = await bcrypt.compare(normalizedPassword, admin.password_hash);
      if (!isValid) {
        throw new AppError('Invalid email or password', 401);
      }

      // Resolve tenantId so the issued JWT is accepted by authenticateTenant middleware
      let tenantId = admin.tenant_id;
      if (!tenantId) {
        try {
          const tenant = await TenantModel.findByEmail(normalizedEmail);
          tenantId = tenant?.id || null;
        } catch (_) {}
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, name: admin.name, tenantId },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name },
      };
    }

    if (config.nodeEnv !== 'production' &&
      normalizedEmail === config.admin.email?.trim().toLowerCase() &&
      normalizedPassword === config.admin.password
    ) {
      const token = jwt.sign(
        { id: 'fallback-admin', email: config.admin.email, name: config.admin.name, tenantId: null },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token,
        admin: { id: 'fallback-admin', email: config.admin.email, name: config.admin.name },
      };
    }

    throw new AppError('Invalid email or password', 401);
  },

  async getProfile(adminId) {
    return AdminModel.findById(adminId);
  },

  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  },
};
