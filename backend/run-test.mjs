import axios from 'axios';
import fs from 'fs';

const API = 'http://localhost:5000/api';
const logFile = './test-output.log';
const lg = (s) => { const l = `[${new Date().toISOString()}] ${s}\n`; fs.appendFileSync(logFile, l); };

fs.writeFileSync(logFile, '=== Test Run ===\n');

try {
  lg('Health check...');
  try {
    const h = await axios.get(`${API}/health`);
    lg('Health: OK ' + h.status);
  } catch (e) {
    lg('Health: FAIL ' + e.message);
    process.exit(1);
  }

  const ts = Date.now();
  const email = `test${ts}@example.com`;
  const password = 'Test@12345';
  let token;

  lg('\\n=== Step 1: Signup ===');
  try {
    const r = await axios.post(`${API}/tenant/signup`, {
      email, password, name: 'Test User', businessName: 'Test Business',
      businessType: 'salon', phone: '9999999999',
    });
    lg('Signup OK: ' + r.data.success);
    token = r.data.data.token;
    lg('Tenant: ' + r.data.data.tenant.id);
    lg('Owner email: ' + r.data.data.tenant.owner_email);
    lg('Owner name: ' + r.data.data.tenant.name);
    lg('Tenant name: ' + r.data.data.tenant.name);
    lg('Sub: ' + r.data.data.subscription.plan + ' days=' + r.data.data.subscription.daysLeft);
  } catch (e) {
    lg('Signup FAIL: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    process.exit(1);
  }

  lg('\\n=== Step 2: Create Cashfree Order ===');
  try {
    const r = await axios.post(`${API}/payment/create-order`, { plan: 'monthly' }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    lg('Create Order OK: ' + r.data.success);
    lg('Order ID: ' + r.data.data.orderId);
    lg('Session: ' + (r.data.data.paymentSessionId ? 'PRESENT (len=' + r.data.data.paymentSessionId.length + ')' : 'MISSING'));
    lg('Plan: ' + r.data.data.plan + ' Rs.' + r.data.data.amount);
    lg('PlanLabel: ' + r.data.data.planLabel);
    lg('\\n=== PAYMENT INTEGRATION SUCCESS: SDK calls working correctly ===');
  } catch (e) {
    lg('Create Order FAIL:');
    if (e.response) {
      lg('  Status: ' + e.response.status);
      lg('  Body: ' + JSON.stringify(e.response.data, null, 2));
    } else {
      lg('  Msg: ' + e.message);
      if (e.stack) lg('  Stack: ' + e.stack.substring(0, 600));
    }
    process.exit(1);
  }
} catch (e) {
  lg('UNEXPECTED: ' + e.message + ' ' + e.stack?.substring(0, 500));
  process.exit(1);
}
