import { Router } from 'express';
import multer from 'multer';
import * as customerController from '../controllers/customerController.js';
import { authenticate, requireSubscription } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { customerValidation } from '../validators/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : err.message, 400));
    }
    if (err) return next(new AppError(err.message, 400));
    next();
  });
};

router.use(authenticate);
router.use(requireSubscription);

router.get('/stats', customerController.getCustomerStats);
router.get('/export', customerController.exportCustomers);
router.post('/import', handleUpload, customerController.importCustomers);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomer);
router.post('/', customerValidation, validate, customerController.createCustomer);
router.put('/:id', customerValidation, validate, customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

export default router;
