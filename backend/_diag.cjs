const http = require('http');

const req = (opts, body) => new Promise((resolve) => {
  const r = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(opts.headers || {}),
      },
    },
    (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }
  );
  r.on('error', (e) => resolve({ status: 0, body: e.message }));
  if (body) r.write(body);
  r.setTimeout(15000, () => { r.destroy(new Error('TIMEOUT')); });
  r.end();
});

const j = (s) => { try { return JSON.parse(s); } catch { return s; } };

(async () => {
  console.log('=== 1) LOGIN (new JWT_SECRET) ===');
  const l = await req(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ email: 'admin@salon.com', password: 'Admin@123456' })
  );
  const lData = j(l.body);
  console.log('HTTP:', l.status, 'tokenSet:', !!lData?.data?.token);
  const token = lData?.data?.token;
  if (!token) { console.log('LOGIN FAILED, aborting:', l.body.slice(0, 300)); process.exit(1); }
  const h = { Authorization: 'Bearer ' + token };

  console.log('\n=== 2) GET services (tests Supabase REST API via tenant) ===');
  const g = await req({ path: '/api/services', method: 'GET', headers: h });
  const gData = j(g.body);
  console.log('HTTP:', g.status, 'count:', gData?.data?.length);
  if (gData?.data?.length > 0) {
    const s = gData.data[0];
    console.log('Sample Supabase service: id=' + s.id + ' cat=' + s.category + ' name=' + s.name + ' price=' + s.price);
  } else {
    console.log('Empty services list — likely Supabase works but no rows seeded yet. Will create one...');
    const c = await req(
      { path: '/api/services', method: 'POST', headers: h },
      JSON.stringify({ category: 'Haircut', name: 'Mens Haircut Supabase Test', price: 300 })
    );
    const cData = j(c.body);
    console.log('Create test svc HTTP:', c.status, 'id:', cData?.data?.id);
  }

  console.log('\n=== 3) WhatsApp STATUS (before init) ===');
  const wa1 = await req({ path: '/api/whatsapp/status', method: 'GET', headers: h });
  const wa1Data = j(wa1.body);
  console.log('HTTP:', wa1.status, 'status:', wa1Data?.data?.status, 'isConnected:', wa1Data?.data?.isConnected, 'qrSet:', !!wa1Data?.data?.qrCode, 'error:', wa1Data?.data?.error || 'none', 'dbError:', wa1Data?.data?.dbError || 'none');

  console.log('\n=== 4) WhatsApp INITIALIZE ===');
  const init = await req({ path: '/api/whatsapp/initialize', method: 'POST', headers: h });
  const initData = j(init.body);
  console.log('HTTP:', init.status, 'msg:', initData?.message || 'n/a', 'status:', initData?.data?.status);

  console.log('\n=== 5) WhatsApp STATUS poll (3x at 2s, 8s, 15s — gives Chrome/QR time) ===');
  const polls = [2000, 8000, 15000];
  for (let i = 0; i < polls.length; i++) {
    await new Promise((r) => setTimeout(r, polls[i]));
    const p = await req({ path: '/api/whatsapp/status', method: 'GET', headers: h });
    const pd = j(p.body);
    const initMs = pd?.data?.initMs != null ? ` initMs=${pd.data.initMs}` : '';
    console.log(`[poll ${i + 1}] HTTP:${p.status} status=${pd?.data?.status} qr=${!!pd?.data?.qrCode} connected=${pd?.data?.isConnected} error=${pd?.data?.error || 'none'}${initMs}`);
    if (pd?.data?.qrCode) {
      const base64Len = (pd.data.qrCode || '').length;
      console.log('   ✅ QR base64 data URL length:', base64Len, 'bytes (looks valid if > 10k)');
      break;
    }
    if (pd?.data?.isConnected) {
      console.log('   ✅ Already connected to WhatsApp number:', pd?.data?.phoneNumber);
      break;
    }
  }

  console.log('\n=== DONE ===');
  process.exit(0);
})().catch((e) => { console.error('Test script crashed:', e); process.exit(1); });
