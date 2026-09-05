import { Router } from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';
import templateRoutes from './templateRoutes.js';
import messageLogRoutes from './messageLogRoutes.js';
import whatsappRoutes from './whatsappRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import tenantRoutes from './tenantRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import serviceRoutes from './serviceRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'CRM API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/tenant', tenantRoutes);
router.use('/payment', paymentRoutes);
router.use('/services', serviceRoutes);
router.use('/customers', customerRoutes);
router.use('/templates', templateRoutes);
router.use('/message-logs', messageLogRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/invoices', invoiceRoutes);

export default router;
