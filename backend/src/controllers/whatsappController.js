import whatsappService from '../services/whatsappService.js';
import { WhatsAppModel } from '../models/WhatsApp.js';
import { CustomerModel } from '../models/Customer.js';
import { TemplateModel } from '../models/Template.js';
import { MessageLogModel } from '../models/MessageLog.js';
import { SettingsModel } from '../models/WhatsApp.js';
import { interpolateTemplate } from '../services/messageService.js';
import { requireTenantId, brandingFromTenant } from '../utils/tenant.js';
import { restartCronJobs } from '../cron/scheduler.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const getWhatsAppStatus = asyncHandler(async (req, res) => {
  const status = whatsappService.getStatus();
  let session = null;
  let dbError = null;

  try {
    session = await WhatsAppModel.getSession(req.tenant?.id);
  } catch (err) {
    dbError = (err && err.message) || 'Failed to fetch WhatsApp session';
  }

  res.json({
    success: true,
    data: {
      ...status,
      dbSession: session,
      dbError,
    },
  });
});

export const initializeWhatsApp = asyncHandler(async (_req, res) => {
  await whatsappService.initialize();

  res.json({
    success: true,
    message: 'WhatsApp initialization started. Scan QR code when ready.',
    data: whatsappService.getStatus(),
  });
});

export const logoutWhatsApp = asyncHandler(async (_req, res) => {
  await whatsappService.logout();

  res.json({
    success: true,
    message: 'WhatsApp logged out successfully',
    data: whatsappService.getStatus(),
  });
});

export const restartWhatsApp = asyncHandler(async (_req, res) => {
  await whatsappService.restart();

  res.json({
    success: true,
    message: 'WhatsApp restart initiated',
    data: whatsappService.getStatus(),
  });
});

export const sendTestMessage = asyncHandler(async (req, res) => {
  const { phone, message } = req.body;

  if (!whatsappService.getStatus().isConnected) {
    throw new AppError('WhatsApp is not connected', 400);
  }

  const tenantId = requireTenantId(req);
  await whatsappService.sendMessage(phone, message);

  await MessageLogModel.create({
    tenant_id: tenantId,
    phone,
    message,
    type: 'manual',
    status: 'sent',
  });

  res.json({ success: true, message: 'Message sent successfully' });
});

export const sendManualMessage = asyncHandler(async (req, res) => {
  const { customer_id, template_id } = req.body;

  if (!whatsappService.getStatus().isConnected) {
    throw new AppError('WhatsApp is not connected', 400);
  }

  const tenantId = requireTenantId(req);
  const customer = await CustomerModel.findById(customer_id, tenantId);
  const template = await TemplateModel.findById(template_id, tenantId);
  const branding = brandingFromTenant(req.tenant);
  const salonSetting = await SettingsModel.getString('salon_name', branding.name, tenantId);
  const salonName = salonSetting || branding.name;

  const message = interpolateTemplate(template.content, customer, salonName);

  try {
    await whatsappService.sendMessage(customer.phone, message);
    const log = await MessageLogModel.create({
      tenant_id: tenantId,
      customer_id: customer.id,
      template_id: template.id,
      phone: customer.phone,
      message,
      type: template.type,
      status: 'sent',
    });

    res.json({ success: true, message: 'Message sent', data: log });
  } catch (err) {
    const log = await MessageLogModel.create({
      tenant_id: tenantId,
      customer_id: customer.id,
      template_id: template.id,
      phone: customer.phone,
      message,
      type: template.type,
      status: 'failed',
      error_message: err.message,
    });

    throw new AppError(`Failed to send message: ${err.message}`, 500);
  }
});

export const getSettings = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const settings = await SettingsModel.getAll(tenantId);
  const formatted = {};
  settings.forEach((s) => { formatted[s.key] = s.value; });

  res.json({ success: true, data: formatted });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const updates = req.body;

  for (const [key, value] of Object.entries(updates)) {
    await SettingsModel.set(key, value, tenantId);
  }

  await restartCronJobs();

  res.json({ success: true, message: 'Settings updated' });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const tenantId = requireTenantId(req);
  const [customerStats, messageStats, whatsappStatus] = await Promise.all([
    CustomerModel.getStats(tenantId),
    MessageLogModel.getStats(tenantId),
    Promise.resolve(whatsappService.getStatus()),
  ]);

  res.json({
    success: true,
    data: {
      customers: customerStats,
      messages: messageStats,
      whatsapp: whatsappStatus,
    },
  });
});

export const triggerCronJob = asyncHandler(async (req, res) => {
  const { job } = req.params;
  const { CronJobs } = await import('../cron/jobs.js');

  const jobs = {
    birthday: CronJobs.sendBirthdayMessages,
    anniversary: CronJobs.sendAnniversaryMessages,
    monthly_offer: CronJobs.sendMonthlyOffers,
    follow_up: CronJobs.sendFollowUpMessages,
    follow_up_female: CronJobs.sendFemaleFollowUpMessages,
    follow_up_male: CronJobs.sendMaleFollowUpMessages,
  };

  if (!jobs[job]) {
    throw new AppError('Invalid cron job type', 400);
  }

  const result = await jobs[job]();
  res.json({ success: true, message: `${job} job executed`, data: result });
});
