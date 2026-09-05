import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Builds the full HTML string for the Cut N Culture invoice.
 * Uses the Canva layout design.
 */
function buildInvoiceHtml(invoice, salonName, salonAddress, salonPhone, salonGstin, logoUrl) {
  const invoiceNo = `CNCS/2025/${String(invoice.invoice_number).padStart(4, '0')}`;
  const invoiceDate = new Date(invoice.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const itemRows = (invoice.items || []).map((item, i) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const amount = qty * price;
    return `
      <tr>
        <td class="border border-[#e8e0d8] text-center">${i + 1}.</td>
        <td class="border border-[#e8e0d8]">${item.description || ''}</td>
        <td class="border border-[#e8e0d8] text-right">₹${amount.toFixed(2)}</td>
      </tr>`;
  }).join('');

  // Fill remaining rows up to 8 total
  const fillerRows = Array.from({ length: Math.max(0, 8 - (invoice.items || []).length) }).map((_, i) => `
      <tr>
        <td class="border border-[#e8e0d8] text-center">${(invoice.items || []).length + i + 1}.</td>
        <td class="border border-[#e8e0d8]">&nbsp;</td>
        <td class="border border-[#e8e0d8]">&nbsp;</td>
      </tr>`).join('');

  const discountRow = Number(invoice.discount) > 0
    ? `<tr><td class="border border-[#e8e0d8] text-center"></td><td class="text-right border border-[#e8e0d8]">Discount</td><td class="text-right border border-[#e8e0d8]">-₹${Number(invoice.discount).toFixed(2)}</td></tr>`
    : '';
  const taxRow = Number(invoice.tax) > 0
    ? `<tr><td class="border border-[#e8e0d8] text-center"></td><td class="text-right border border-[#e8e0d8]">Tax</td><td class="text-right border border-[#e8e0d8]">₹${Number(invoice.tax).toFixed(2)}</td></tr>`
    : '';

  const gstinRow = salonGstin ? `<p><span class="font-medium">GSTIN</span> : ${salonGstin}</p>` : '';
  const customerAddress = invoice.customer_address ? `<p><span class="font-medium">Address</span> : ${invoice.customer_address}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${salonName} Invoice</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@400;700&family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'DM Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .serif { font-family: 'Playfair Display', serif; }
    .script { font-family: 'Dancing Script', cursive; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 10px; }
    .leaf-accent { color: #7a9b6d; opacity: 0.6; }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4" style="background: rgb(249, 245, 240);">
  <main class="relative w-full max-w-[650px] bg-white rounded-2xl overflow-hidden shadow-lg" style="aspect-ratio: 7/10;">

    <!-- Decorative pink blobs -->
    <div class="absolute top-0 left-0 w-36 h-36 rounded-full opacity-30" style="background: radial-gradient(circle, #f4c6c6 0%, transparent 70%); transform: translate(-30%, -30%);"></div>
    <div class="absolute bottom-0 right-0 w-44 h-44 rounded-full opacity-20" style="background: radial-gradient(circle, #f4c6c6 0%, transparent 70%); transform: translate(30%, 30%);"></div>

    <!-- Full floral edge motif left -->
    <svg class="absolute -left-5 top-[18%] h-44 w-16 leaf-accent" viewBox="0 0 64 176" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M42 170 Q20 140 28 110 Q34 132 46 145 Z" fill="currentColor" opacity="0.3"></path>
      <path d="M36 154 Q16 122 22 88 Q32 112 40 128 Z" fill="currentColor" opacity="0.22"></path>
      <path d="M30 112 Q12 82 20 52 Q30 72 36 92 Z" fill="currentColor" opacity="0.28"></path>
      <path d="M32 168 Q24 116 23 48" stroke-linecap="round"></path>
      <path d="M25 98 Q12 88 8 72" stroke-linecap="round" opacity="0.55"></path>
      <path d="M27 125 Q42 110 50 94" stroke-linecap="round" opacity="0.5"></path>
    </svg>

    <!-- Full floral edge motif right -->
    <svg class="absolute -right-5 top-[22%] h-40 w-14 leaf-accent transform scale-x-[-1]" viewBox="0 0 64 160" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M42 154 Q20 124 28 94 Q34 116 46 129 Z" fill="currentColor" opacity="0.3"></path>
      <path d="M36 138 Q16 106 22 72 Q32 96 40 112 Z" fill="currentColor" opacity="0.22"></path>
      <path d="M30 96 Q12 66 20 36 Q30 56 36 76 Z" fill="currentColor" opacity="0.28"></path>
      <path d="M32 152 Q24 100 23 32" stroke-linecap="round"></path>
      <path d="M25 82 Q12 72 8 56" stroke-linecap="round" opacity="0.55"></path>
      <path d="M27 109 Q42 94 50 78" stroke-linecap="round" opacity="0.5"></path>
    </svg>

    <!-- Bottom floral -->
    <svg class="absolute -bottom-5 left-1/2 h-16 w-52 -translate-x-1/2 leaf-accent rotate-180" viewBox="0 0 208 64" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M18 48 Q42 22 70 30 Q48 40 28 54 Z" fill="currentColor" opacity="0.25"></path>
      <path d="M76 42 Q104 14 132 25 Q108 34 84 48 Z" fill="currentColor" opacity="0.25"></path>
      <path d="M138 44 Q166 18 194 28 Q170 38 146 50 Z" fill="currentColor" opacity="0.25"></path>
      <path d="M18 48 Q104 26 194 28" stroke-linecap="round"></path>
      <path d="M70 30 Q62 18 66 8 M132 25 Q126 13 132 5 M194 28 Q188 16 194 8" stroke-linecap="round" opacity="0.5"></path>
    </svg>

    <div class="relative z-10 px-9 py-7 flex flex-col h-full">

      <!-- Header -->
      <header class="relative mb-1">
        <svg class="absolute -top-2 -left-4 w-16 h-16 leaf-accent" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M10 70 Q25 40 50 30 Q35 50 20 60 Z" fill="currentColor" opacity="0.3"></path>
          <path d="M15 65 Q30 35 55 25" stroke-linecap="round"></path>
          <path d="M20 60 Q32 42 48 35" stroke-linecap="round" opacity="0.5"></path>
        </svg>
        <svg class="absolute -top-2 -right-4 w-16 h-16 leaf-accent transform scale-x-[-1]" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M10 70 Q25 40 50 30 Q35 50 20 60 Z" fill="currentColor" opacity="0.3"></path>
          <path d="M15 65 Q30 35 55 25" stroke-linecap="round"></path>
          <path d="M20 60 Q32 42 48 35" stroke-linecap="round" opacity="0.5"></path>
        </svg>
        <div class="flex items-start">
          <div class="w-20 flex items-center justify-center">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="max-h-16 max-w-20 object-contain" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="flex-1 text-center pt-2">
            <h1 class="serif tracking-[0.22em]" style="color: rgb(45,45,45); font-weight:700; font-size:24px; letter-spacing:0.18rem;">${salonName.toUpperCase()}</h1>
            <p class="tracking-[0.35em] text-[10px] mt-0.5" style="color: rgb(107,124,94); font-weight:500; font-size:11px;">UNISEX SALON</p>
            <div class="flex items-center justify-center gap-1 mt-1 opacity-40">
              <span class="block w-6 h-px bg-[#7a9b6d]"></span>
              <span class="text-[#7a9b6d] text-xs">✂</span>
              <span class="block w-6 h-px bg-[#7a9b6d]"></span>
            </div>
            ${salonAddress ? `<p class="text-[9px] mt-0.5" style="color:#666;">${salonAddress}</p>` : ''}
            ${salonPhone ? `<p class="text-[9px]" style="color:#666;">📞 ${salonPhone}</p>` : ''}
          </div>
          <div class="text-right pt-3 w-32">
            <p class="script" style="color:rgb(58,58,58); font-size:13px;"></p>
          </div>
        </div>
      </header>

      <!-- Hearts decoration -->
      <div class="flex justify-center gap-1 my-1">
        <span class="text-[#e8a0a0] text-[10px]">♥</span>
        <span class="text-[#e8a0a0] text-[8px]">♥</span>
      </div>

      <!-- Invoice Title -->
      <div class="text-center my-2">
        <h2 class="serif" style="color:rgb(176,139,106); font-weight:700; font-size:20px; letter-spacing:0.3rem;">INVOICE</h2>
      </div>

      <!-- Details Section -->
      <div class="flex justify-between mt-2 gap-4 text-[10.5px] text-[#3d3d3d]">
        <div class="flex-1 rounded-lg px-4 py-3 space-y-1.5" style="background: rgb(253,249,245);">
          <p><span class="font-medium">Name</span> : ${invoice.customer_name || ''}</p>
          <p><span class="font-medium">Mobile No</span> : ${invoice.customer_phone || ''}</p>
          ${customerAddress}
          ${gstinRow}
        </div>
        <div class="rounded-lg px-4 py-3 space-y-1.5 text-right" style="background: rgb(253,249,245);">
          <p><span class="font-medium">Invoice No.</span> : ${invoiceNo}</p>
          <p><span class="font-medium">Invoice Date</span> : ${invoiceDate}</p>
        </div>
      </div>

      <!-- Table -->
      <div class="mt-3 flex-1">
        <table class="text-[10.5px]">
          <thead>
            <tr style="background: rgb(245,240,234);">
              <th class="w-7 text-center font-semibold border border-[#e0d8cf] py-[6px]">SL.</th>
              <th class="text-center font-semibold border border-[#e0d8cf] py-[6px]">DESCRIPTION</th>
              <th class="w-28 text-right font-semibold border border-[#e0d8cf] py-[6px]">AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            ${fillerRows}
          </tbody>
          <tfoot>
            ${discountRow}
            ${taxRow}
            <tr style="background: rgb(245,240,234);" class="font-bold">
              <td class="border border-[#e0d8cf]"></td>
              <td class="text-right border border-[#e0d8cf] font-bold">TOTAL</td>
              <td class="text-right border border-[#e0d8cf]">₹${Number(invoice.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Note & Thank You -->
      <div class="flex justify-between items-end mt-3">
        <div class="max-w-[55%]">
          ${invoice.notes ? `
          <span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-1" style="background:rgb(252,232,228); color:rgb(160,64,64);">NOTE</span>
          <p class="text-[9.5px] leading-tight" style="color:rgb(85,85,85);">${invoice.notes}</p>` : ''}
        </div>
        <div class="text-right">
          <p class="script" style="color:rgb(45,45,45); font-weight:700; font-size:24px;">Thank You!</p>
          <p class="text-[10px] mt-0.5" style="color:rgb(85,85,85); font-style:italic;">For choosing ${salonName}</p>
        </div>
      </div>

      <!-- Footer -->
      <footer class="mt-3 -mx-9 -mb-7 px-6 py-2.5 flex justify-between items-center text-[8px]" style="background: rgb(238,242,235);">
        <span class="text-[#5a6b50]">🤍 Thank you for trusting us with your special moments.</span>
        <span class="text-[#5a6b50]">✨ We don't just style, we care.</span>
        <span class="font-bold tracking-wider" style="color:rgb(176,139,106);">BEAUTY | CONFIDENCE | CULTURE</span>
      </footer>

    </div>
  </main>
</body>
</html>`;
}

/**
 * Generates a PDF buffer from invoice data using Puppeteer.
 * Uses a unique per-render userDataDir so it never conflicts with
 * the WhatsApp Chrome session which holds a lock on .wwebjs_auth.
 */
export async function generateInvoicePdf(invoice, salonName, salonAddress, salonPhone, salonGstin, logoUrl) {
  const html = buildInvoiceHtml(invoice, salonName, salonAddress, salonPhone, salonGstin, logoUrl);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  // Create a unique temp dir for this Chrome instance so it never
  // conflicts with the WhatsApp Chrome profile lock.
  const userDataDir = path.join(os.tmpdir(), `pdf-chrome-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const launchOptions = {
    headless: true,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
    ],
  };

  if (executablePath && fs.existsSync(executablePath)) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      width: '650px',
      height: '929px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
    // Clean up the temp Chrome profile
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
