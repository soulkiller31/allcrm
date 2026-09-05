import { Router } from 'express';
import * as tenantController from '../controllers/tenantController.js';
import { authenticateTenant } from '../middleware/tenant.js';

const router = Router();

router.post('/signup', tenantController.signup);
router.post('/login', tenantController.login);
router.get('/me', authenticateTenant, tenantController.getMe);
router.put('/me', authenticateTenant, tenantController.updateMe);

export default router;
