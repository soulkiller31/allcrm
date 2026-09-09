import pkg from 'whatsapp-web.js';
import puppeteer from 'puppeteer';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';
import { WhatsAppModel } from '../models/WhatsApp.js';
import { formatPhoneForWhatsApp, normalizePhone } from './messageService.js';

// ─── Per-tenant instance map ──────────────────────────────────────────────────
// Each tenant gets their own WhatsAppService instance, their own Puppeteer
// browser process, and their own isolated session directory.
const instances = new Map(); // tenantId → WhatsAppService

export function getWhatsAppService(tenantId) {
  if (!tenantId) throw new Error('tenantId is required for WhatsApp service');
  if (!instances.has(tenantId)) {
    instances.set(tenantId, new WhatsAppService(tenantId));
  }
  return instances.get(tenantId);
}

// Remove a tenant instance (called on logout so memory is freed)
export function removeWhatsAppService(tenantId) {
  instances.delete(tenantId);
}

// ─── Per-tenant service class ─────────────────────────────────────────────────
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
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      phoneNumber: this.phoneNumber,
      isConnected: this.status === 'connected',
      error: this.lastError,
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

    if (this.client) {
      try { await this.client.destroy(); } catch { /* ignore */ }
      this.client = null;
    }

    this.initializing = true;
    this.status = 'initializing';
    this.lastError = null;

    // Each tenant gets their own subdirectory — completely isolated
    const sessionPath = path.resolve(
      path.join(config.whatsappSessionPath, `tenant-${this.tenantId}`)
    );
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--ignore-ssl-errors',
        '--memory-pressure-off',
        '--max_old_space_size=256',
      ],
      dumpio: false,
      ignoreHTTPSErrors: true,
    };

    let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      try { executablePath = puppeteer.executablePath(); } catch { executablePath = undefined; }
    }
    if (executablePath && fs.existsSync(executablePath)) {
      puppeteerOptions.executablePath = executablePath;
    }

    // clientId is unique per tenant — prevents session/lock conflicts
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionPath,
        clientId: `tenant-${this.tenantId}`,
      }),
      puppeteer: puppeteerOptions,
    });

    this.client.on('qr', async (qr) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.status = 'qr_ready';
        this.initializing = false;
        this.lastError = null;
      } catch (err) {
        this.lastError = (err && err.message) || String(err);
        this.status = 'error';
        this.initializing = false;
        return;
      }
      try {
        await WhatsAppModel.updateSession(
          { is_connected: false, session_data: { status: 'qr_ready' } },
          this.tenantId
        );
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] Failed to persist QR-ready:`, err.message);
      }
    });

    this.client.on('authenticated', () => {
      this.status = 'authenticated';
      this.qrCode = null;
      this.initializing = false;
      this.lastError = null;
    });

    this.client.on('ready', async () => {
      this.status = 'connected';
      this.qrCode = null;
      this.initializing = false;
      this.clearReconnectTimer();
      this.lastError = null;
      this.phoneNumber = this.client.info?.wid?.user || null;
      console.log(`[WhatsApp][${this.tenantId}] Ready:`, this.phoneNumber);
      try {
        await WhatsAppModel.updateSession({
          is_connected: true,
          phone_number: this.phoneNumber,
          last_connected_at: new Date().toISOString(),
          session_data: { status: 'connected', phone: this.phoneNumber },
        }, this.tenantId);
      } catch (err) {
        console.warn(`[WhatsApp][${this.tenantId}] Failed to persist ready:`, err.message);
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
        console.warn(`[WhatsApp][${this.tenantId}] Failed to persist disconnect:`, err.message);
      }
      this.scheduleReconnect(reason);
    });

    this.client.on('auth_failure', async (msg) => {
      console.error(`[WhatsApp][${this.tenantId}] Auth failure:`, msg);
      this.status = 'auth_failure';
      this.qrCode = null;
      this.phoneNumber = null;
      this.initializing = false;
      this.lastError = msg || null;
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
        console.warn(`[WhatsApp][${this.tenantId}] Failed to persist auth-failure:`, err.message);
      }
      this.scheduleReconnect('auth_failure');
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error(`[WhatsApp][${this.tenantId}] Init error:`, err.message);
      this.status = 'error';
      this.initializing = false;
      this.lastError = err.message;
      this.client = null;
      try {
        await WhatsAppModel.updateSession({
          is_connected: false,
          phone_number: null,
          session_data: { status: 'error', reason: err.message },
        }, this.tenantId);
      } catch (dbErr) {
        console.warn(`[WhatsApp][${this.tenantId}] Failed to persist init-error:`, dbErr.message);
      }
      this.scheduleReconnect('initialize_error');
    }
  }

  async sendMessage(phone, message) {
    if (!this.client || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected');
    }
    const normalized = normalizePhone(phone);
    let chatId = null;
    try {
      const resolved = await this.client.getNumberId(normalized);
      if (resolved?._serialized) chatId = resolved._serialized;
    } catch (err) {
      console.warn(`[WhatsApp][${this.tenantId}] getNumberId failed for`, normalized, ':', err.message);
    }
    if (!chatId) chatId = formatPhoneForWhatsApp(phone);
    try {
      return await this.client.sendMessage(chatId, message);
    } catch (err) {
      const msg = (err && err.message) || String(err);
      if (msg.includes('not a valid') || msg.includes('not exist') || msg.includes('404') || msg.includes('Wid') || msg.includes('unregistered')) {
        throw new Error(`Phone +${normalized} is not on WhatsApp. Ask customer to install WhatsApp first.`);
      }
      throw err;
    }
  }

  async sendDocument(phone, filePath, filename, caption = '') {
    if (!this.client || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected');
    }
    const normalized = normalizePhone(phone);
    let chatId = null;
    try {
      const resolved = await this.client.getNumberId(normalized);
      if (resolved?._serialized) chatId = resolved._serialized;
    } catch (err) {
      console.warn(`[WhatsApp][${this.tenantId}] getNumberId failed:`, err.message);
    }
    if (!chatId) chatId = formatPhoneForWhatsApp(phone);
    const media = MessageMedia.fromFilePath(filePath);
    media.filename = filename;
    return await this.client.sendMessage(chatId, media, { sendMediaAsDocument: true, caption });
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
    // Remove from map so a fresh instance is created next time
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
