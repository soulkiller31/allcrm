import { MessageLogModel } from '../models/MessageLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireTenantId } from '../utils/tenant.js';

export const getMessageLogs = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const { status, type, page, limit } = req.query;

  const result = await MessageLogModel.findAll({
    tenantId,
    status,
    type,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });

  res.json({ success: true, data: result });
});

export const getMessageLogStats = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const stats = await MessageLogModel.getStats(tenantId);
  res.json({ success: true, data: stats });
});
