import app from './app.js';
import config from './config/index.js';
import { startCronJobs } from './cron/scheduler.js';
import { seedAdmin } from './scripts/seedAdmin.js';
import whatsappService from './services/whatsappService.js';

const PORT = config.port;

const server = app.listen(PORT, async () => {
  console.log(`Salon CRM API running on port ${PORT} [${config.nodeEnv}]`);

  try {
    await seedAdmin({ skipIfNoDatabaseUrl: true });
  } catch (err) {
    console.error('[DB] Initial admin seed check failed:', err.message);
  }

  try {
    await startCronJobs();
  } catch (err) {
    console.error('[Cron] Failed to start:', err.message);
  }

  if (config.autoInitWhatsApp) {
    try {
      await whatsappService.initialize();
    } catch (err) {
      console.error('[WhatsApp] Auto-init failed:', err.message);
    }
  }
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
