import { Router } from 'express';
import * as invoiceController from '../controllers/invoiceController.js';
import { authenticate, requireSubscription } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { invoiceSaveValidation } from '../validators/index.js';

const router = Router();

router.use(authenticate);
router.use(requireSubscription);

router.get('/next-number', invoiceController.getNextInvoiceNumber);
router.get('/', invoiceController.getInvoices);
router.get('/report', invoiceController.getInvoiceReport);
router.get('/report/export', invoiceController.exportVisitReport);
router.get('/business-report', invoiceController.getBusinessReport);
router.get('/business-report/export', invoiceController.exportBusinessReport);
router.get('/:id/pdf', invoiceController.downloadInvoicePdf);
router.post('/:id/resend', invoiceController.resendInvoicePdf);
router.get('/:id', invoiceController.getInvoice);
router.post('/save-and-send', invoiceSaveValidation, validate, invoiceController.saveCustomerAndSendWhatsApp);

export default router;
