import { CustomerModel } from '../models/Customer.js';
import { ExcelService } from '../services/excelService.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const normalizeGender = (g) => (g === undefined ? undefined : g === null || g === '' ? null : String(g).trim().toLowerCase());

export const getCustomers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant context required', 401);
  const { search, gender, is_active, page, limit, sort_by, sort_order } = req.query;
  const result = await CustomerModel.findAll({
    tenantId, search, gender, isActive: is_active,
    page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 20,
    sortBy: sort_by, sortOrder: sort_order,
  });
  res.json({ success: true, data: result });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  const customer = await CustomerModel.findById(req.params.id, tenantId);
  res.json({ success: true, data: customer });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant context required', 401);
  const existing = await CustomerModel.findByPhone(req.body.phone, tenantId);
  if (existing) throw new AppError('Customer with this phone number already exists', 409);
  const customer = await CustomerModel.create({ ...req.body, gender: normalizeGender(req.body.gender), tenant_id: tenantId });
  res.status(201).json({ success: true, message: 'Customer created', data: customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (req.body.phone) {
    const existing = await CustomerModel.findByPhone(req.body.phone, tenantId);
    if (existing && existing.id !== req.params.id) throw new AppError('Phone number already in use', 409);
  }
  const customer = await CustomerModel.update(req.params.id, { ...req.body, gender: normalizeGender(req.body.gender) }, tenantId);
  res.json({ success: true, message: 'Customer updated', data: customer });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  await CustomerModel.delete(req.params.id, tenantId);
  res.json({ success: true, message: 'Customer deleted' });
});

export const importCustomers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant context required', 401);
  if (!req.file) throw new AppError('No file uploaded', 400);
  const result = await ExcelService.importCustomers(req.file.buffer, tenantId);
  res.json({ success: true, message: 'Import completed', data: result });
});

export const exportCustomers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  const { data } = await CustomerModel.findAll({ tenantId, limit: 10000 });
  const buffer = ExcelService.exportCustomers(data);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');
  res.send(buffer);
});

export const getCustomerStats = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  const stats = await CustomerModel.getStats(tenantId);
  res.json({ success: true, data: stats });
});
