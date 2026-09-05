import { ServiceModel } from '../models/Service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

// GET /api/services
export const getServices = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  const services = await ServiceModel.findAll(tenantId);
  res.json({ success: true, data: services });
});

// GET /api/services/categories
export const getCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  const categories = await ServiceModel.getCategories(tenantId);
  res.json({ success: true, data: categories });
});

// POST /api/services
export const createService = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  const { category, name, price, sortOrder } = req.body;
  if (!category || !name) throw new AppError('category and name are required', 400);
  const service = await ServiceModel.create(tenantId, { category, name, price, sortOrder });
  res.status(201).json({ success: true, data: service });
});

// PUT /api/services/:id
export const updateService = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  const service = await ServiceModel.update(req.params.id, tenantId, req.body);
  res.json({ success: true, data: service });
});

// DELETE /api/services/:id
export const deleteService = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  await ServiceModel.delete(req.params.id, tenantId);
  res.json({ success: true, message: 'Service deleted' });
});

// POST /api/services/bulk — create multiple at once
export const bulkCreate = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new AppError('Tenant required', 400);
  const { services } = req.body;
  if (!Array.isArray(services) || !services.length) throw new AppError('services array required', 400);
  const results = await Promise.all(
    services.map((s, i) => ServiceModel.create(tenantId, { ...s, sortOrder: i }))
  );
  res.status(201).json({ success: true, data: results });
});
