import { CustomerModel } from '../models/Customer.js';
import { TemplateModel } from '../models/Template.js';
import { MessageLogModel } from '../models/MessageLog.js';
import { SettingsModel } from '../models/WhatsApp.js';
import { SubscriptionModel } from '../models/Subscription.js';
import whatsappService from '../services/whatsappService.js';
import { interpolateTemplate } from '../services/messageService.js';
import { TenantModel } from '../models/Tenant.js';

const FOLLOW_UP_RULES = {
  female: {
    type: 'follow_up_female',
    minDaysSinceVisit: 15,
    templateTypes: ['follow_up_female', 'follow_up'],
    label: 'female follow-up',
  },
  male: {
    type: 'follow_up_male',
    minDaysSinceVisit: 75,
    templateTypes: ['follow_up_male', 'follow_up'],
    label: 'male follow-up',
  },
};

const shouldSkipCustomer = async (customer, type, skipWindowDays, tenantId) => {
  if (type === 'birthday' || type === 'anniversary') {
    return MessageLogModel.wasSentToday(customer.id, type, tenantId);
  }
  if (skipWindowDays) {
    return MessageLogModel.wasSentWithinDays(customer.id, type, skipWindowDays, tenantId);
  }
  if (type === 'monthly_offer') {
    return MessageLogModel.wasSentWithinDays(customer.id, type, 28, tenantId);
  }
  return false;
};

const sendBulkMessages = async (customers, type, options = {}) => {
  const tenantId = options.tenantId;
  const template = await TemplateModel.findFirstActiveByTypes(options.templateTypes || [type], tenantId);
  if (!template) {
    console.log(`[Cron] No active template for type: ${type} tenant ${tenantId}`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let salonName = options.salonName;
  if (!salonName) {
    try {
      const tenant = await TenantModel.findById(tenantId);
      salonName = await SettingsModel.getString('salon_name', tenant.name, tenantId);
    } catch {
      salonName = 'Your Business';
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const customer of customers) {
    if (await shouldSkipCustomer(customer, type, options.skipWindowDays, tenantId)) {
      skipped++;
      continue;
    }

    const message = interpolateTemplate(template.content, customer, salonName);

    try {
      if (whatsappService.getStatus().isConnected) {
        await whatsappService.sendMessage(customer.phone, message);
        await MessageLogModel.create({
          tenant_id: tenantId,
          customer_id: customer.id,
          template_id: template.id,
          phone: customer.phone,
          message,
          type,
          status: 'sent',
        });
        sent++;
      } else {
        await MessageLogModel.create({
          tenant_id: tenantId,
          customer_id: customer.id,
          template_id: template.id,
          phone: customer.phone,
          message,
          type,
          status: 'failed',
          error_message: 'WhatsApp not connected',
        });
        failed++;
      }

      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      await MessageLogModel.create({
        tenant_id: tenantId,
        customer_id: customer.id,
        template_id: template.id,
        phone: customer.phone,
        message,
        type,
        status: 'failed',
        error_message: err.message,
      });
      failed++;
    }
  }

  return { sent, failed, skipped };
};

const forEachActiveTenant = async (runner) => {
  const tenantIds = await SubscriptionModel.findActiveTenants();
  const totals = { sent: 0, failed: 0, skipped: 0, tenants: tenantIds.length };
  for (const tenantId of tenantIds) {
    const result = await runner(tenantId);
    totals.sent += result.sent || 0;
    totals.failed += result.failed || 0;
    totals.skipped += result.skipped || 0;
  }
  return totals;
};

export const CronJobs = {
  async sendBirthdayMessages() {
    console.log('[Cron] Running birthday messages...');
    return forEachActiveTenant(async (tenantId) => {
      const customers = await CustomerModel.findBirthdaysToday(tenantId);
      return sendBulkMessages(customers, 'birthday', { tenantId });
    });
  },

  async sendAnniversaryMessages() {
    console.log('[Cron] Running anniversary messages...');
    return forEachActiveTenant(async (tenantId) => {
      const customers = await CustomerModel.findAnniversariesToday(tenantId);
      return sendBulkMessages(customers, 'anniversary', { tenantId });
    });
  },

  async sendMonthlyOffers() {
    console.log('[Cron] Running monthly offer messages...');
    return forEachActiveTenant(async (tenantId) => {
      const customers = await CustomerModel.findAllActive(tenantId);
      return sendBulkMessages(customers, 'monthly_offer', { tenantId });
    });
  },

  async sendFollowUpMessages() {
    const femaleResult = await this.sendFemaleFollowUpMessages();
    const maleResult = await this.sendMaleFollowUpMessages();
    return {
      sent: femaleResult.sent + maleResult.sent,
      failed: femaleResult.failed + maleResult.failed,
      skipped: femaleResult.skipped + maleResult.skipped,
      breakdown: {
        follow_up_female: femaleResult,
        follow_up_male: maleResult,
      },
    };
  },

  async sendFemaleFollowUpMessages() {
    const rule = FOLLOW_UP_RULES.female;
    return forEachActiveTenant(async (tenantId) => {
      const customers = await CustomerModel.findFollowUpDue({
        tenantId,
        gender: 'female',
        minDaysSinceVisit: rule.minDaysSinceVisit,
      });
      return sendBulkMessages(customers, rule.type, {
        tenantId,
        templateTypes: rule.templateTypes,
        skipWindowDays: rule.minDaysSinceVisit,
      });
    });
  },

  async sendMaleFollowUpMessages() {
    const rule = FOLLOW_UP_RULES.male;
    return forEachActiveTenant(async (tenantId) => {
      const customers = await CustomerModel.findFollowUpDue({
        tenantId,
        gender: 'male',
        minDaysSinceVisit: rule.minDaysSinceVisit,
      });
      return sendBulkMessages(customers, rule.type, {
        tenantId,
        templateTypes: rule.templateTypes,
        skipWindowDays: rule.minDaysSinceVisit,
      });
    });
  },
};
