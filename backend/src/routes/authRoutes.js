import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginValidation } from '../validators/index.js';

const router = Router();

router.post('/login', loginValidation, validate, authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.get('/verify', authenticate, authController.verifyToken);

export default router;
