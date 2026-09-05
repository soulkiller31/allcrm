import axios from 'axios';

const API = 'http://localhost:5000/api';

async function test() {
  const ts = Date.now();
  const email = `test${ts}@example.com`;
  const password = 'Test@12345';
  let token;

  console.log('=== Step 1: Signup ===');
  try {
    const r = await axios.post(`${API}/tenant/signup`, {
      email,
      password,
      name: 'Test User',
      businessName: 'Test Business',
      businessType: 'salon',
      phone: '9999999999',
    });
    console.log('Signup OK:', r.data.success);
    token = r.data.data.token;
    console.log('Tenant ID:', r.data.data.tenant.id);
    console.log('Sub plan:', r.data.data.subscription.plan, r.data.data.subscription.daysLeft, 'days');
  } catch (e) {
    console.error('Signup FAILED:', e.response?.data || e.message);
    process.exit(1);
  }

  console.log('\n=== Step 2: Create Cashfree Order ===');
  try {
    const r = await axios.post(`${API}/payment/create-order`, { plan: 'monthly' }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Create Order OK:', r.data.success);
    console.log('Order ID:', r.data.data.orderId);
    console.log('Session ID present:', !!r.data.data.paymentSessionId);
    console.log('Plan:', r.data.data.plan, '₹' + r.data.data.amount);
  } catch (e) {
    console.error('Create Order FAILED:');
    if (e.response) {
      console.log('  Status:', e.response.status);
      console.log('  Data:', JSON.stringify(e.response.data, null, 2));
    } else {
      console.log('  Message:', e.message);
      console.log('  Stack:', e.stack);
    }
    process.exit(1);
  }

  console.log('\n=== All Payment Tests Passed (Cashfree SDK integration OK) ===');
}

test().catch(console.error);
