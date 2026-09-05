import { Router } from 'express';
import * as whatsappController from '../controllers/whatsappController.js';
import { authenticate, requireSubscription } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { testMessageValidation, manualMessageValidation } from '../validators/index.js';

const router = Router();

router.use(authenticate);
router.use(requireSubscription);

router.get('/dashboard', whatsappController.getDashboardStats);
router.get('/settings', whatsappController.getSettings);
router.put('/settings', whatsappController.updateSettings);

router.get('/status', whatsappController.getWhatsAppStatus);
router.post('/initialize', whatsappController.initializeWhatsApp);
router.post('/logout', whatsappController.logoutWhatsApp);
router.post('/restart', whatsappController.restartWhatsApp);
router.post('/test-message', testMessageValidation, validate, whatsappController.sendTestMessage);
router.post('/send-message', manualMessageValidation, validate, whatsappController.sendManualMessage);
router.post('/cron/:job', whatsappController.triggerCronJob);

export default router;
