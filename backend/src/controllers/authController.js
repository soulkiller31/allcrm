import { AuthService } from '../services/authService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await AuthService.login(email, password);

  res.json({
    success: true,
    message: 'Login successful',
    authMode: 'legacy',
    signupRequired: false,
    data: {
      token: result.token,
      admin: result.admin,
      tenant: result.tenant,
      subscription: result.subscription,
    },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.admin,
  });
});

export const verifyToken = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      admin: req.admin,
      tenant: req.tenant,
      subscription: req.subscription,
    },
  });
});
