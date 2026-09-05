import { Router } from 'express';
import * as messageLogController from '../controllers/messageLogController.js';
import { authenticate, requireSubscription } from '../middleware/tenant.js';

const router = Router();

router.use(authenticate);
router.use(requireSubscription);

router.get('/stats', messageLogController.getMessageLogStats);
router.get('/', messageLogController.getMessageLogs);

export default router;
