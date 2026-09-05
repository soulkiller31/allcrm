import { AuthService } from '../services/authService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await AuthService.login(email, password);

  res.json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const admin = await AuthService.getProfile(req.admin.id);

  res.json({
    success: true,
    data: admin,
  });
});

export const verifyToken = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.admin,
  });
});
