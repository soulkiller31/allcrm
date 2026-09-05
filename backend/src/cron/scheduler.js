import cron from 'node-cron';
import config from '../config/index.js';
import { SettingsModel } from '../models/WhatsApp.js';
import { CronJobs } from './jobs.js';

let scheduledTasks = [];

const wrapScheduledJob = (label, job) => async () => {
  try {
    await job();
  } catch (err) {
    console.error(`[Cron] ${label} failed:`, err.message);
  }
};

const getCronSetting = async (key, defaultValue) => {
  try {
    const value = await SettingsModel.getString(key, '');
    return value || defaultValue;
  } catch {
    return defaultValue;
  }
};

const isCronEnabled = async () => {
  try {
    return await SettingsModel.getBoolean('cron_enabled', true);
  } catch {
    return true;
  }
};

export const startCronJobs = async () => {
  stopCronJobs();

  const enabled = await isCronEnabled();
  if (!enabled) {
    console.log('[Cron] Scheduled jobs are disabled');
    return;
  }

  const timezone = config.cronTimezone;

  const birthdayCron = await getCronSetting('birthday_cron', '0 9 * * *');
  const anniversaryCron = await getCronSetting('anniversary_cron', '0 9 * * *');
  const monthlyOfferCron = await getCronSetting('monthly_offer_cron', '0 10 1 * *');
  const followUpCron = await getCronSetting('follow_up_cron', '0 10 * * *');

  scheduledTasks = [
    cron.schedule(birthdayCron, wrapScheduledJob('birthday', CronJobs.sendBirthdayMessages), { timezone }),
    cron.schedule(anniversaryCron, wrapScheduledJob('anniversary', CronJobs.sendAnniversaryMessages), { timezone }),
    cron.schedule(monthlyOfferCron, wrapScheduledJob('monthly_offer', CronJobs.sendMonthlyOffers), { timezone }),
    cron.schedule(followUpCron, wrapScheduledJob('follow_up', CronJobs.sendFollowUpMessages), { timezone }),
  ];

  console.log('[Cron] Scheduled jobs started');
  console.log(`  Birthday: ${birthdayCron}`);
  console.log(`  Anniversary: ${anniversaryCron}`);
  console.log(`  Monthly Offer: ${monthlyOfferCron}`);
  console.log(`  Follow-up: ${followUpCron}`);
  console.log(`  Timezone: ${timezone}`);
};

export const stopCronJobs = () => {
  scheduledTasks.forEach((task) => task.stop());
  scheduledTasks = [];
};

export const restartCronJobs = async () => {
  await startCronJobs();
};
