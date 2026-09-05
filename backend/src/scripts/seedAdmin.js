import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { pathToFileURL } from 'url';
import config from '../config/index.js';
import { AdminModel } from '../models/Admin.js';
import { AuthService } from '../services/authService.js';
import { runMigration } from './runMigration.js';

export async function seedAdmin({ logger = console, skipIfNoDatabaseUrl = false } = {}) {
  try {
    if (process.env.DATABASE_URL) {
      await runMigration({ logger, databaseUrl: process.env.DATABASE_URL });
    } else if (!skipIfNoDatabaseUrl) {
      logger.warn('Missing DATABASE_URL in backend/.env; skipping database-backed admin seeding.');
      return false;
    } else {
      logger.info('DATABASE_URL not set; using config-based auth fallback for now.');
      return false;
    }

    const existing = await AdminModel.findByEmail(config.admin.email);

    if (existing) {
      logger.log('Admin already exists:', config.admin.email);
      return true;
    }

    const passwordHash = await AuthService.hashPassword(config.admin.password);
    const admin = await AdminModel.create({
      email: config.admin.email,
      passwordHash,
      name: config.admin.name,
    });

    logger.log('Admin created successfully:');
    logger.log('  Email:', admin.email);
    logger.log('  Name:', admin.name);
    logger.log('  Password:', config.admin.password);
    return true;
  } catch (error) {
    logger.error('Seed failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await seedAdmin();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
