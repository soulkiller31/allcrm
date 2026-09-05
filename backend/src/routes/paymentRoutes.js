import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticateTenant } from '../middleware/tenant.js';

const router = Router();

// Public
router.get('/plans', paymentController.getPlans);
router.post('/webhook', paymentController.webhook);

// Authenticated
router.post('/create-order', authenticateTenant, paymentController.createOrder);
router.post('/verify', authenticateTenant, paymentController.verifyPayment);

export default router;
