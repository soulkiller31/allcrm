import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const signup = asyncHandler(async (_req, res) => {
  throw new AppError('Signup is disabled. Only admin@salon.com can login.', 403);
});

export const login = asyncHandler(async (_req, _res) => {
  throw new AppError('Please use /api/auth/login instead.', 410);
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      admin: req.admin,
      tenant: req.tenant,
      subscription: req.subscription,
    },
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { businessName, businessType, phone, address, gstin, logoUrl } = req.body;
  const t = { ...req.tenant };
  if (businessName) t.name = businessName.trim();
  if (businessType) { t.businessType = businessType; t.business_type = businessType; }
  if (phone !== undefined) t.phone = phone || '';
  if (address !== undefined) t.address = address || '';
  if (gstin !== undefined) t.gstin = gstin || '';
  if (logoUrl !== undefined) t.logoUrl = logoUrl || '';
  res.json({
    success: true,
    data: {
      tenant: {
        id: t.id,
        name: t.name,
        businessType: t.businessType,
        phone: t.phone,
        address: t.address,
        gstin: t.gstin,
        logoUrl: t.logoUrl,
      },
    },
  });
});

export const setPassword = asyncHandler(async (_req, res) => {
  throw new AppError('Password change is disabled. Default password is in backend/.env', 403);
});
