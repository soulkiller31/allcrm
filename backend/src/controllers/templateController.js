import { TemplateModel } from '../models/Template.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireTenantId } from '../utils/tenant.js';

export const getTemplates = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const { type, is_active } = req.query;
  const isActive = is_active !== undefined ? is_active === 'true' : undefined;

  const templates = await TemplateModel.findAll({ tenantId, type, isActive });
  res.json({ success: true, data: templates });
});

export const getTemplate = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const template = await TemplateModel.findById(req.params.id, tenantId);
  res.json({ success: true, data: template });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const template = await TemplateModel.create({ ...req.body, tenant_id: tenantId });
  res.status(201).json({ success: true, message: 'Template created', data: template });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const template = await TemplateModel.update(req.params.id, req.body, tenantId);
  res.json({ success: true, message: 'Template updated', data: template });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  await TemplateModel.delete(req.params.id, tenantId);
  res.json({ success: true, message: 'Template deleted' });
});
