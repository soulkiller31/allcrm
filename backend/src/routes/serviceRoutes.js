import { Router } from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { authenticateTenant, requireSubscription } from '../middleware/tenant.js';

const router = Router();
router.use(authenticateTenant);
router.use(requireSubscription);

router.get('/categories', serviceController.getCategories);
router.get('/', serviceController.getServices);
router.post('/bulk', serviceController.bulkCreate);
router.post('/', serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

export default router;
