import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './authService.js';
import { AdminModel } from '../models/Admin.js';
import config from '../config/index.js';

test('falls back to configured admin credentials when the database lookup fails', async () => {
  const originalFindByEmail = AdminModel.findByEmail;

  AdminModel.findByEmail = async () => {
    throw new Error('Database error');
  };

  try {
    const result = await AuthService.login(config.admin.email, config.admin.password);

    assert.ok(result.token, 'login should return a token');
    assert.equal(result.admin.email, config.admin.email.toLowerCase());
    assert.equal(result.admin.name, config.admin.name);
  } finally {
    AdminModel.findByEmail = originalFindByEmail;
  }
});
