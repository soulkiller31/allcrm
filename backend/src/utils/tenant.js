import { AppError } from '../middleware/errorHandler.js';

export const requireTenantId = (req) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant context required', 401);
  return tenantId;
};

export const brandingFromTenant = (tenant) => ({
  name: tenant?.name || 'Your Business',
  address: tenant?.address || '',
  phone: tenant?.phone || '',
  gstin: tenant?.gstin || '',
  logoUrl: tenant?.logo_url || '',
});
