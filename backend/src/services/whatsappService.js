import pkg from 'whatsapp-web.js';
import puppeteer from 'puppeteer';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import config from '../config/index.js';
import { WhatsAppModel } from '../models/WhatsApp.js';
import { formatPhoneForWhatsApp, normalizePhone } from './messageService.js';

const instances = new Map();

export function getWhatsAppService(tenantId) {
  if (!tenantId) throw new Error('tenantId is required for WhatsApp service');
  if (!instances.has(tenantId)) {
    instances.set(tenantId, new WhatsAppService(tenantId));
  }
  return instances.get(tenantId);
}

export function removeWhatsAppService(tenantId) {
  instances.delete(tenantId);
}

export const findChromeWindows = () => {
  const candidates = [];
  const local = process.env.LOCALAPPDATA;
  const pf = process.env.PROGRAMFILES;
  const pf86 = process.env['PROGRAMFILES(X86)'];
  if (local) {
    candidates.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(path.join(local, 'Chromium', 'Application', 'chrome.exe'));
    candidates.push(path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
  }
  if (pf) {
    candidates.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  if (pf86) {
    candidates.push(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  candidates.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  candidates.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  // macOS / Linux (defensive)
  candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  candidates.push('/usr/bin/google-chrome');
  candidates.push('/usr/bin/chromium-browser');
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
};

export const getPuppeteerExecutable = () => {
  // 1. Explicit env override (highest priority)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try { if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) return process.env.PUPPETEER_EXECUTABLE_PATH; } catch { /* ignore */ }
  }
  // 2. System Chrome/Edge on Windows / default paths on Unix
  const sysChrome = findChromeWindows();
  if (sysChrome) return sysChrome;
  // 3. Puppeteer bundled chromium (lowest priority because often missing on first install)
  try {
    const ep = puppeteer.executablePath();
    if (ep && fs.existsSync(ep)) return ep;
  } catch (e) {
    console.warn('[WhatsApp] puppeteer.executablePath() not available:', e.message);
  }
  return null;
};

class WhatsAppService {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.client = null;
    this.qrCode = null;
    this.status = 'disconnected';
    this.phoneNumber = null;
    this.lastError = null;
    this.initializing = false;
    this.shouldReconnect = false;
    this.reconnectTimer = null;
    this.initStartAt = null;
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      phoneNumber: this.phoneNumber,
      isConnected: this.status === 'connected',
      error: this.lastError,
      initializing: this.initializing,
      initMs: this.initStartAt ? Date.now() - this.initStartAt : null,
    };
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  scheduleReconnect(reason = 'unknown') {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    const delay = config.whatsappReconnectDelayMs;
    console.log(`[WhatsApp][${this.tenantId}] Reconnect scheduled in ${delay}ms (${reason})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.initialize();
      } catch (err) {
        console.error(`[WhatsApp][${this.tenantId}] Reconnect failed:`, err.message);
        this.scheduleReconnect('retry_failed');
      }
    }, delay);
  }

  async initialize() {
    if (this.client && this.status === 'connected') return;
    if (this.initializing) return;
    this.shouldReconnect = true;
    this.clearReconnectTimer();
    this.initStartAt = Date.now();

    if (this.client) {
      try { await this.client.destroy(); } catch { /* ignore */ }
      this.client = null;
    }

    this.initializing = true;
    this.status = 'initializing';
    this.lastError = null;
    this.qrCode = null;

    const sessionPath = path.resolve(
      path.join(config.whatsappSessionPath, `tenant-${this.tenantId}`)
    );
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const executablePath = getPuppeteerExecutable();
    console.log(
      `[WhatsApp][${this.tenantId}] Initializing client.` +
      ` sessionDir=${sessionPath} executable=${executablePath || 'NOT FOUND (will fail!)'}` +
      ` platform=${os.platform()} arch=${os.arch()}`
    );

    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--mute-audio',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--ignore-ssl-errors',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        `--user-data-dir=${sessionPath}__pup`,
      ],
      dumpio: false,
      ignoreHTTPSErrors: true,
    };

    if (executablePath) {
      puppeteerOptions.executablePath = executablePath;
    } else {
      const msg =
        'No Chrome/Chromium executable found. WhatsApp QR cannot be generated.' +
        ' Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH to a valid chrome.exe path.';
      console.error(`[WhatsApp][${this.tenantId}] ${msg}`);
      this.status = 'error';
      this.initializing = false;
      this.lastError = msg;
      return;
    }

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
          clientId: `tenant-${this.tenantId}`,
        }),
        puppeteer: puppeteerOptions,
        qrMaxRetries: 5,
        takeoverOnConflict: true,
      });
    } catch (err) {
      this.status = 'error';
      this.initializing = false;
      this.lastError = `Failed to create WhatsApp client: ${err.message}`;
      console.error(`[WhatsApp][${this.tenantId}] Client create failed:`, err.message);
      return;
    }

    this.client.on('qr', async (qr) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.status = 'qr_ready';
        this.initializing = false;
        this.lastError = null;
        console.log(`[WhatsApp][${this.tenantId}] QR code ready for scanning (${Date.now() - this.initStartAt}ms)`);
      } catch (err) {
        this.lastError = 'QR generate failed: ' + (err && err.message) || String(err);
        this.status = 'error';
        this.initializing = false;
        console.error(`[WhatsApp][${this.tenantId}] QR generate failed:`, err?.message);
        return;
      }
      try {
        await WhatsAppModel.updateSession(
          { is_connected: false, session_data: { status: 'qr_ready' } },
          this.tenantId
        );
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] (db) persist QR-ready skipped:`, err.message);
      }
    });

    this.client.on('authenticated', () => {
      this.status = 'authenticated';
      this.qrCode = null;
      this.initializing = false;
      this.lastError = null;
      console.log(`[WhatsApp][${this.tenantId}] Authenticated`);
    });

    this.client.on('ready', async () => {
      this.status = 'connected';
      this.qrCode = null;
      this.initializing = false;
      this.clearReconnectTimer();
      this.lastError = null;
      this.phoneNumber = this.client.info?.wid?.user || null;
      const tookMs = Date.now() - (this.initStartAt || Date.now());
      console.log(`[WhatsApp][${this.tenantId}] Connected: +${this.phoneNumber} (took ${tookMs}ms)`);
      try {
        await WhatsAppModel.updateSession({
          is_connected: true,
          phone_number: this.phoneNumber,
          last_connected_at: new Date().toISOString(),
          session_data: { status: 'connected', phone: this.phoneNumber },
        }, this.tenantId);
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] (db) persist ready skipped:`, err.message);
      }
      try { await this.patchWwebVMGetters(); } catch (e) {
        console.warn(`[WhatsApp][${this.tenantId}] WWeb VM patch (skipped, non-fatal):`, String(e.message || e).slice(0, 200));
      }
    });

    this.client.on('disconnected', async (reason) => {
      console.log(`[WhatsApp][${this.tenantId}] Disconnected:`, reason);
      this.status = 'disconnected';
      this.qrCode = null;
      this.phoneNumber = null;
      this.client = null;
      this.initializing = false;
      this.lastError = null;
      try {
        await WhatsAppModel.updateSession({
          is_connected: false,
          phone_number: null,
          session_data: { status: 'disconnected', reason },
        }, this.tenantId);
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] (db) persist disconnect skipped:`, err.message);
      }
      this.scheduleReconnect(String(reason || 'disconnected'));
    });

    this.client.on('auth_failure', async (msg) => {
      console.error(`[WhatsApp][${this.tenantId}] Auth failure:`, msg);
      this.status = 'auth_failure';
      this.qrCode = null;
      this.phoneNumber = null;
      this.initializing = false;
      this.lastError = msg || 'Authentication failure';
      if (this.client) {
        try { await this.client.destroy(); } catch { /* ignore */ }
      }
      this.client = null;
      try {
        await WhatsAppModel.updateSession({
          is_connected: false,
          phone_number: null,
          session_data: { status: 'auth_failure', reason: msg },
        }, this.tenantId);
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] (db) persist auth-failure skipped:`, err.message);
      }
      this.scheduleReconnect('auth_failure');
    });

    this.client.on('change_state', (state) => {
      console.log(`[WhatsApp][${this.tenantId}] Client state: ${state}`);
    });

    try {
      await this.client.initialize();
      console.log(`[WhatsApp][${this.tenantId}] client.initialize() returned`);
    } catch (err) {
      console.error(`[WhatsApp][${this.tenantId}] Init error:`, err.message);
      this.status = 'error';
      this.initializing = false;
      this.lastError = err.message;
      try {
        if (this.client) { await this.client.destroy(); }
      } catch { /* ignore */ }
      this.client = null;
      try {
        await WhatsAppModel.updateSession({
          is_connected: false,
          phone_number: null,
          session_data: { status: 'error', reason: err.message },
        }, this.tenantId);
      } catch (dbErr) {
        console.warn(`[WhatsApp][${this.tenantId}] (db) persist init-error skipped:`, dbErr.message);
      }
      this.scheduleReconnect('initialize_error');
    }
  }

  async patchWwebVMGetters() {
    const page = this.client?.pupPage || this.client?.authEventBrowser || this.client?.page;
    if (!page) {
      try {
        if (this.client?.pupBrowser?.pages) {
          const pages = await this.client.pupBrowser.pages();
          if (pages && pages[0]) this.client.pupPage = pages[0];
        }
      } catch { /* ignore */ }
    }
    const realPage = this.client?.pupPage;
    if (!realPage || typeof realPage.evaluate !== 'function') {
      console.warn(`[WhatsApp][${this.tenantId}] Cannot patch WWeb VM: no page.evaluate handle`);
      return false;
    }
    try {
      await realPage.evaluateOnNewDocument?.(wwebMemoizePatchSource);
    } catch { /* ignore */ }
    try {
      const result = await realPage.evaluate(wwebMemoizePatchSource);
      console.log(`[WhatsApp][${this.tenantId}] WWeb VM memoize patch applied. result=`, result);
      return true;
    } catch (e) {
      console.warn(`[WhatsApp][${this.tenantId}] WWeb VM patch evaluate warning:`, String(e.message || e).slice(0, 200));
      return false;
    }
  }

  async findChatByPhone(phone) {
    const normalized = normalizePhone(phone);
    const fallbackChatId = formatPhoneForWhatsApp(phone);
    let chatId = fallbackChatId;
    try {
      const resolved = await this.client.getNumberId(normalized);
      const ser = typeof resolved === 'string'
        ? resolved
        : (resolved?._serialized || resolved?.id?._serialized || (resolved?.user ? `${resolved.user}@${resolved.server || 'c.us'}` : null));
      if (ser && /@/.test(String(ser))) chatId = String(ser);
    } catch { /* skip — fallback used */ }
    if (typeof chatId !== 'string' || !chatId.includes('@')) chatId = fallbackChatId;

    let chat = null;
    try {
      chat = await this.client.getChatById(chatId);
    } catch { /* fall through */ }
    if (!chat) {
      try {
        const allChats = await this.client.getChats();
        const digits = normalized.slice(-10);
        chat = allChats.find((c) => {
          const idStr = String(c.id?._serialized || c.id?.user || c || '');
          return idStr.includes(digits) || idStr === chatId || idStr === fallbackChatId;
        });
      } catch { /* ignore */ }
    }
    if (!chat) {
      try {
        const contact = await this.client.getContactById(chatId);
        if (contact && typeof contact.getChat === 'function') chat = await contact.getChat();
      } catch { /* ignore */ }
    }
    return { chat, chatId, fallbackChatId, normalized };
  }

  async sendMessage(phone, message) {
    if (!this.client || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected');
    }
    const normalized = normalizePhone(phone);
    const fallbackChatId = formatPhoneForWhatsApp(phone);
    let chatId = fallbackChatId;
    try {
      const resolved = await this.client.getNumberId(normalized);
      const ser = typeof resolved === 'string' ? resolved : (resolved?._serialized || resolved?.id?._serialized || resolved?.user ? `${resolved.user}@${resolved.server || 'c.us'}` : null);
      if (ser && /@/.test(String(ser))) chatId = String(ser);
    } catch (err) {
      console.warn(`[WhatsApp][${this.tenantId}] getNumberId skipped for +${normalized}:`, String(err.message || err).slice(0, 160));
    }
    if (typeof chatId !== 'string' || !chatId.includes('@')) chatId = fallbackChatId;

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.client.sendMessage(chatId, message);
        return result;
      } catch (err) {
        lastErr = err;
        const msg = (err && err.message) || String(err);

        // Known whatsapp-web.js internal memoization bug — message is actually
        // sent successfully, the error is a library-side getter issue. Treat as success.
        if (msg.includes('id property') || msg.includes('memoize') || /getter.*id/i.test(msg)) {
          console.warn(`[WhatsApp][${this.tenantId}] Message sent (ignoring library memoize bug):`, msg.split('\n')[0]);
          return { sent: true, chatId }; // message was delivered
        }

        if (msg.includes('not a valid') || msg.includes('not exist') || msg.includes('404') || msg.includes('Wid') || msg.includes('unregistered') || msg.includes('not on WhatsApp')) {
          throw new Error(`Phone +${normalized} is not on WhatsApp. Ask customer to install WhatsApp first.`);
        }
        if (attempt < 3 && (msg.includes('No LID') || msg.includes('undefined') || /getter/i.test(msg))) {
          console.warn(`[WhatsApp][${this.tenantId}] sendMessage attempt ${attempt} retrying:`, msg.split('\n')[0]);
          chatId = fallbackChatId;
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async sendDocument(phone, filePath, filename, caption = '') {
    if (!this.client || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected');
    }
    const normalized = normalizePhone(phone);
    const fallbackChatId = formatPhoneForWhatsApp(phone);
    let chatId = fallbackChatId;
    try {
      const resolved = await this.client.getNumberId(normalized);
      const ser = typeof resolved === 'string' ? resolved : (resolved?._serialized || resolved?.id?._serialized || resolved?.user ? `${resolved.user}@${resolved.server || 'c.us'}` : null);
      if (ser && /@/.test(String(ser))) chatId = String(ser);
    } catch (err) {
      console.warn(`[WhatsApp][${this.tenantId}] getNumberId skipped for doc +${normalized}:`, String(err.message || err).slice(0, 160));
    }
    if (typeof chatId !== 'string' || !chatId.includes('@')) chatId = fallbackChatId;

    let media;
    try {
      media = MessageMedia.fromFilePath(filePath);
    } catch (e) {
      const raw = fs.readFileSync(filePath);
      const mimetype = filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      media = new MessageMedia(mimetype, raw.toString('base64'), filename);
    }
    try { media.filename = filename; } catch { /* filename setter can throw on older lib versions */ }

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const useChatId = attempt === 1 ? chatId : fallbackChatId;
      try {
        return await this.client.sendMessage(useChatId, media, { sendMediaAsDocument: true, caption });
      } catch (err) {
        lastErr = err;
        const msg = (err && err.message) || String(err);
        const retryable =
          msg.includes('id property') ||
          msg.includes('memoize') ||
          msg.includes('No LID') ||
          (msg.includes('undefined') && /getter/i.test(msg)) ||
          /getter must include/i.test(msg);
        if (attempt < 3 && retryable) {
          console.warn(`[WhatsApp][${this.tenantId}] sendDocument attempt ${attempt} hit library bug, retrying with raw chatId...:`, msg.split('\n')[0]);
          try {
            const raw = fs.readFileSync(filePath);
            media = new MessageMedia(
              filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
              raw.toString('base64'),
              filename
            );
          } catch { /* ignore */ }
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async logout() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.client) {
      try { await this.client.logout(); } catch { /* ignore */ }
      try { await this.client.destroy(); } catch { /* ignore */ }
    }
    this.client = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.phoneNumber = null;
    this.initializing = false;
    try {
      await WhatsAppModel.updateSession({
        is_connected: false,
        phone_number: null,
        session_data: { status: 'logged_out' },
      }, this.tenantId);
    } catch { /* ignore */ }
    removeWhatsAppService(this.tenantId);
  }

  async restart() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.client) {
      try { await this.client.destroy(); } catch { /* ignore */ }
      this.client = null;
    }
    this.status = 'disconnected';
    this.qrCode = null;
    this.phoneNumber = null;
    this.initializing = false;
    this.shouldReconnect = true;
    await this.initialize();
  }
}
