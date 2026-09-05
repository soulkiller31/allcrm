import { Router } from 'express';
import * as templateController from '../controllers/templateController.js';
import { authenticate, requireSubscription } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { templateValidation } from '../validators/index.js';

const router = Router();

router.use(authenticate);
router.use(requireSubscription);

router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplate);
router.post('/', templateValidation, validate, templateController.createTemplate);
router.put('/:id', templateValidation, validate, templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

export default router;
