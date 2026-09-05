import { useEffect, useState, useCallback } from 'react';
import {
  Smartphone, QrCode, LogOut, RefreshCw, Send, Play, CheckCircle, XCircle, Loader, Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const CRON_JOBS = [
  { key: 'birthday', label: 'Birthday Messages', desc: 'Send to customers with birthday today' },
  { key: 'anniversary', label: 'Anniversary Messages', desc: 'Send to customers with anniversary today' },
  { key: 'monthly_offer', label: 'Monthly Offers', desc: 'Send monthly offers to all active customers' },
  { key: 'follow_up', label: 'All Follow-ups', desc: 'Run both female 15-day and male 75-day follow-up automation' },
  { key: 'follow_up_female', label: 'Female Follow-ups', desc: 'Send to female customers 15+ days after last visit' },
  { key: 'follow_up_male', label: 'Male Follow-ups', desc: 'Send to male customers 75+ days after last visit' },
];

export default function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Salon CRM!');
  const [settings, setSettings] = useState(null);
  const [salonName, setSalonName] = useState('');
  const [cronEnabled, setCronEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await whatsappAPI.getStatus();
      setStatus(data.data);
    } catch {
      toast.error('Failed to load WhatsApp status');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await whatsappAPI.getSettings();
      setSettings(data.data);
      setSalonName(typeof data.data.salon_name === 'string' ? data.data.salon_name : 'Your Salon');
      setCronEnabled(data.data.cron_enabled !== false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSettings]);

  const handleAction = async (action, apiFn) => {
    setActionLoading(action);
    try {
      const { data } = await apiFn();
      toast.success(data.message);
      await fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || `${action} failed`);
    } finally {
      setActionLoading('');
    }
  };

  const handleTestMessage = async (e) => {
    e.preventDefault();
    setActionLoading('test');
    try {
      await whatsappAPI.sendTest({ phone: testPhone, message: testMessage });
      toast.success('Test message sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test message');
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await whatsappAPI.updateSettings({
        salon_name: salonName,
        cron_enabled: cronEnabled,
      });
      toast.success('Settings saved');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerCron = async (job) => {
    setActionLoading(job);
    try {
      const { data } = await whatsappAPI.triggerCron(job);
      const summary = `${job}: sent ${data.data.sent}, failed ${data.data.failed}${data.data.skipped ? `, skipped ${data.data.skipped}` : ''}`;
      const breakdown = data.data.breakdown
        ? ` | female ${data.data.breakdown.follow_up_female.sent}/${data.data.breakdown.follow_up_female.failed}/${data.data.breakdown.follow_up_female.skipped} | male ${data.data.breakdown.follow_up_male.sent}/${data.data.breakdown.follow_up_male.failed}/${data.data.breakdown.follow_up_male.skipped}`
        : '';
      toast.success(`${summary}${breakdown}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Job failed');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isConnected = status?.isConnected;
  const showQR = status?.qrCode && !isConnected;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp</h1>
          <p className="text-dark-400 text-sm mt-1">Connect and manage WhatsApp messaging</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isConnected && (
            <button
              onClick={() => handleAction('initialize', whatsappAPI.initialize)}
              disabled={!!actionLoading}
              className="btn-primary"
            >
              {actionLoading === 'initialize' ? <Loader size={16} className="animate-spin" /> : <QrCode size={16} />}
              {status?.status === 'qr_ready' ? 'Refresh QR' : 'Connect WhatsApp'}
            </button>
          )}
          {isConnected && (
            <>
              <button
                onClick={() => handleAction('restart', whatsappAPI.restart)}
                disabled={!!actionLoading}
                className="btn-secondary"
              >
                <RefreshCw size={16} /> Restart
              </button>
              <button
                onClick={() => handleAction('logout', whatsappAPI.logout)}
                disabled={!!actionLoading}
                className="btn-danger"
              >
                <LogOut size={16} /> Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Smartphone size={18} className="text-accent" />
            Connection Status
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-dark-800/50">
              {isConnected ? (
                <CheckCircle size={24} className="text-emerald-400" />
              ) : (
                <XCircle size={24} className="text-red-400" />
              )}
              <div>
                <p className="font-medium text-dark-100 capitalize">{status?.status || 'disconnected'}</p>
                {status?.phoneNumber && (
                  <p className="text-sm text-dark-400 font-mono">+{status.phoneNumber}</p>
                )}
                {status?.error && (
                  <p className="text-sm text-red-400">{status.error}</p>
                )}
              </div>
            </div>

            {showQR && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-dark-800/50">
                <p className="text-sm text-dark-300 text-center">
                  Scan this QR code with WhatsApp on your phone
                </p>
                <img src={status.qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg" />
                <p className="text-xs text-dark-500">Open WhatsApp → Linked Devices → Link a Device</p>
              </div>
            )}

            {!isConnected && !showQR && status?.status !== 'initializing' && (
              <p className="text-sm text-dark-400 text-center py-4">
                Click "Connect WhatsApp" to generate a QR code
              </p>
            )}

            {status?.status === 'initializing' && (
              <div className="flex items-center justify-center gap-2 py-8 text-dark-400">
                <Loader size={20} className="animate-spin" />
                Initializing WhatsApp client...
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Send size={18} className="text-accent" />
            Send Test Message
          </h3>
          <form onSubmit={handleTestMessage} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9876543210"
                required
                disabled={!isConnected}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                required
                disabled={!isConnected}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={!isConnected || actionLoading === 'test'}>
              {actionLoading === 'test' ? 'Sending...' : 'Send Test Message'}
            </button>
          </form>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
          <Settings size={18} className="text-accent" />
          App Settings
        </h3>
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Salon Name</label>
            <input
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="Your Salon"
              required
            />
            <p className="text-xs text-dark-500 mt-1">Used in message templates as {'{{salon_name}}'}</p>
          </div>
          <div className="form-group">
            <label className="form-label">Automated Messages</label>
            <select value={cronEnabled} onChange={(e) => setCronEnabled(e.target.value === 'true')}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
            <p className="text-xs text-dark-500 mt-1">Toggle scheduled birthday, anniversary, offer, and follow-up jobs</p>
          </div>
          {settings && (
            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                ['Birthday', settings.birthday_cron],
                ['Anniversary', settings.anniversary_cron],
                ['Monthly Offer', settings.monthly_offer_cron],
                ['Follow-up', settings.follow_up_cron],
              ].map(([label, cron]) => (
                <div key={label} className="p-3 rounded-lg bg-dark-800/50 border border-dark-700">
                  <p className="text-dark-400">{label}</p>
                  <p className="font-mono text-dark-200 mt-1">{cron || '—'}</p>
                </div>
              ))}
            </div>
          )}
          <div className="sm:col-span-2 text-xs text-dark-500">
            Female follow-ups go out every 15 days after the last visit. Male follow-ups go out every 75 days after the last visit.
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
          <Play size={18} className="text-accent" />
          Manual Cron Triggers
        </h3>
        <p className="text-sm text-dark-400 mb-4">
          Manually trigger automated message jobs for testing. These also run automatically on schedule.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CRON_JOBS.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => handleTriggerCron(key)}
              disabled={!!actionLoading}
              className="flex flex-col items-start p-4 rounded-lg bg-dark-800/50 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 transition-colors text-left"
            >
              <span className="font-medium text-dark-100 flex items-center gap-2">
                {actionLoading === key ? <Loader size={14} className="animate-spin" /> : <Play size={14} className="text-accent" />}
                {label}
              </span>
              <span className="text-xs text-dark-400 mt-1">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
