import { useEffect, useState } from 'react';
import { MessageSquare, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { messageLogAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_BADGES = {
  sent: 'badge-success',
  failed: 'badge-danger',
  pending: 'badge-warning',
};

const TYPE_LABELS = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  monthly_offer: 'Monthly Offer',
  follow_up_female: 'Female Follow-up',
  follow_up_male: 'Male Follow-up',
  follow_up: 'General Follow-up',
  manual: 'Manual',
};

export default function MessageLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [stats, setStats] = useState(null);
  const limit = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await messageLogAPI.getAll({ status, type, page, limit });
      setLogs(data.data.data);
      setTotal(data.data.total);
    } catch {
      toast.error('Failed to load message logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await messageLogAPI.getStats();
      setStats(data.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [status, type, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Message Logs</h1>
          <p className="text-dark-400 text-sm mt-1">{total} total messages logged</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-dark-100' },
            { label: 'Sent', value: stats.sent, color: 'text-emerald-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
            { label: 'Today', value: stats.today, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-dark-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-44">
            <option value="">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="sm:w-44">
            <option value="">All Types</option>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="monthly_offer">Monthly Offer</option>
            <option value="follow_up_female">Female Follow-up</option>
            <option value="follow_up_male">Male Follow-up</option>
            <option value="follow_up">General Follow-up</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
            <p>No message logs found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Phone</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-sm whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleString()}
                  </td>
                  <td className="font-mono text-sm">{log.phone}</td>
                  <td>{log.customers?.name || '—'}</td>
                  <td>
                    <span className="badge-info">{TYPE_LABELS[log.type] || log.type}</span>
                  </td>
                  <td>
                    <span className={STATUS_BADGES[log.status] || 'badge-warning'}>
                      {log.status}
                    </span>
                  </td>
                  <td>
                    <p className="text-sm text-dark-300 max-w-xs truncate" title={log.message}>
                      {log.message}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-400 mt-0.5">{log.error_message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-dark-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
