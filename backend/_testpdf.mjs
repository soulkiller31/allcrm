import { generateInvoicePdf } from './src/services/invoicePdfService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fakeInvoice = {
  invoice_number: 1,
  created_at: new Date().toISOString(),
  customer_name: 'Test Customer',
  customer_phone: '9876543210',
  customer_address: '123 Test Street',
  items: [{ description: 'Haircut', quantity: 1, price: 500 }],
  subtotal: 500,
  discount: 0,
  tax: 0,
  total: 500,
  notes: 'Test invoice',
};

console.log('PUPPETEER_EXECUTABLE_PATH in env:', process.env.PUPPETEER_EXECUTABLE_PATH || '(not set)');
console.log('LOCALAPPDATA:', process.env.LOCALAPPDATA || '(n/a)');
console.log('PROGRAMFILES(X86):', process.env['PROGRAMFILES(X86)'] || '(n/a)');
console.log('Edge at common x86 path exists?',
  fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'));
console.log('Edge at common PF path exists?',
  fs.existsSync('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'));

console.log('\nGenerating PDF...');
const start = Date.now();
try {
  const buf = await generateInvoicePdf(fakeInvoice, 'Test Salon', '123 Street', '9876543210', '', '');
  const out = path.join(os.tmpdir(), 'test-invoice.pdf');
  fs.writeFileSync(out, buf);
  console.log(`SUCCESS PDF: ${out} - size=${buf.length} bytes, took=${Date.now()-start}ms`);
} catch (e) {
  console.log('PDF FAIL:', e.name, e.message);
  console.log('STACK:', e.stack ? e.stack.split('\n').slice(0,8).join('\n') : 'no stack');
  process.exit(1);
}
