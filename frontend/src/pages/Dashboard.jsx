import { useEffect, useState } from 'react';
import { Users, MessageSquare, Cake, Clock, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { whatsappAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function StatCard({ icon: Icon, label, value, color = 'accent' }) {
  const colors = {
    accent: 'bg-accent/10 text-accent',
    blue: 'bg-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/10 text-amber-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-dark-50">{value ?? '—'}</p>
        <p className="text-sm text-dark-400">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await whatsappAPI.getDashboard();
        setStats(data.data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const { customers, messages, whatsapp } = stats || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-dark-400 text-sm mt-1">Overview of your salon CRM</p>
        </div>
        <div className="flex items-center gap-2">
          {whatsapp?.isConnected ? (
            <span className="badge-success flex items-center gap-1.5">
              <CheckCircle size={12} /> WhatsApp Connected
            </span>
          ) : (
            <span className="badge-danger flex items-center gap-1.5">
              <XCircle size={12} /> WhatsApp Disconnected
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Customers" value={customers?.total} color="accent" />
        <StatCard icon={Users} label="Active Customers" value={customers?.active} color="blue" />
        <StatCard icon={Cake} label="Birthdays Today" value={customers?.birthdaysToday} color="amber" />
        <StatCard icon={Clock} label="Follow-ups Due" value={customers?.followUpDue} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-accent" />
            Message Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-dark-800/50">
              <p className="text-2xl font-bold text-emerald-400">{messages?.sent ?? 0}</p>
              <p className="text-xs text-dark-400 mt-1">Sent</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800/50">
              <p className="text-2xl font-bold text-red-400">{messages?.failed ?? 0}</p>
              <p className="text-xs text-dark-400 mt-1">Failed</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800/50">
              <p className="text-2xl font-bold text-blue-400">{messages?.today ?? 0}</p>
              <p className="text-xs text-dark-400 mt-1">Today</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-800/50">
              <p className="text-2xl font-bold text-dark-100">{messages?.total ?? 0}</p>
              <p className="text-xs text-dark-400 mt-1">Total</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Smartphone size={18} className="text-accent" />
            WhatsApp Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-dark-700">
              <span className="text-dark-400 text-sm">Status</span>
              <span className={`badge ${whatsapp?.isConnected ? 'badge-success' : 'badge-danger'}`}>
                {whatsapp?.status || 'disconnected'}
              </span>
            </div>
            {whatsapp?.phoneNumber && (
              <div className="flex justify-between items-center py-2 border-b border-dark-700">
                <span className="text-dark-400 text-sm">Phone</span>
                <span className="text-dark-100 text-sm font-mono">+{whatsapp.phoneNumber}</span>
              </div>
            )}
            <div className="pt-2">
              <p className="text-xs text-dark-500">
                Automated messages run for birthdays, anniversaries, monthly offers, female 15-day follow-ups, and male 75-day follow-ups.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
