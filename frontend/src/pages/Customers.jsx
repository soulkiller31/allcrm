import { useEffect, useState, useRef } from 'react';
import {
  Plus, Search, Upload, Download, Pencil, Trash2, ChevronLeft, ChevronRight, Filter, BarChart2, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customerAPI, invoiceAPI } from '../services/api';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';

const emptyForm = {
  name: '', phone: '', email: '', address: '', birthday: '', anniversary: '',
  last_visit: '', gender: '', notes: '', is_active: true,
};

// ---------------------------------------------------------------------------
// BusinessReportView — inline component
// ---------------------------------------------------------------------------
function BusinessReportView() {
  const [filter, setFilter] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const fetchReport = async () => {
    if (filter === 'custom' && (!startDate || !endDate)) {
      setValidationError('Please select both start and end dates');
      return;
    }
    setValidationError(null);
    setLoading(true);
    try {
      const params = { filter };
      if (filter === 'custom') { params.start = startDate; params.end = endDate; }
      const { data } = await invoiceAPI.getBusinessReport(params);
      setReport(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load business report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filter, startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { filter };
      if (filter === 'custom') { params.start = startDate; params.end = endDate; }
      const { data } = await invoiceAPI.exportBusinessReport(params);
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Business report exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const fmt = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      {/* Filter bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-dark-100">Business Report</h3>
          <button
            onClick={handleExport}
            disabled={!report || exporting}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <Download size={13} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
            { key: 'custom', label: 'Custom' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setValidationError(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === key ? 'bg-accent text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {label}
            </button>
          ))}
          {filter === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm py-1 px-2" />
              <span className="text-dark-400 text-sm">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm py-1 px-2" />
            </div>
          )}
        </div>
        {validationError && <p className="text-red-400 text-xs mt-2">{validationError}</p>}
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : !report ? (
        <div className="card text-center py-16 text-dark-400">
          <BarChart2 size={32} className="mx-auto mb-3 opacity-50" />
          <p>No data for the selected period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(report.summary.totalRevenue), icon: '₹', color: 'text-green-400' },
              { label: 'Total Visits', value: report.summary.totalVisits, icon: '🏪', color: 'text-blue-400' },
              { label: 'Unique Customers', value: report.summary.uniqueCustomers, icon: '👤', color: 'text-purple-400' },
              { label: 'Avg per Visit', value: fmt(report.summary.avgPerVisit), icon: '📊', color: 'text-accent' },
              { label: 'Cash Revenue', value: fmt(report.summary.cashRevenue ?? 0), icon: '💵', color: 'text-yellow-400' },
              { label: 'Online Revenue', value: fmt(report.summary.onlineRevenue ?? 0), icon: '📱', color: 'text-blue-300' },
              { label: 'Split Payments', value: report.summary.splitCount ?? 0, icon: '💵📱', color: 'text-purple-400' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="card">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-lg">{icon}</span>
                </div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-dark-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Payment Method Split */}
          {((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0)) > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-dark-100 mb-3">Payment Method Split</h3>
              <div className="space-y-3">
                {/* Cash */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-dark-300 flex items-center gap-1">💵 Cash</span>
                    <span className="text-yellow-400 font-semibold">
                      {report.summary.cashCount ?? 0} payments &nbsp;·&nbsp; {fmt(report.summary.cashRevenue ?? 0)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-dark-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                      style={{
                        width: `${((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0)) > 0
                          ? ((report.summary.cashCount ?? 0) / ((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0))) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                {/* Online */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-dark-300 flex items-center gap-1">📱 Online</span>
                    <span className="text-blue-400 font-semibold">
                      {report.summary.onlineCount ?? 0} payments &nbsp;·&nbsp; {fmt(report.summary.onlineRevenue ?? 0)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-dark-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all duration-500"
                      style={{
                        width: `${((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0)) > 0
                          ? ((report.summary.onlineCount ?? 0) / ((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0))) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                {/* Split */}
                {(report.summary.splitCount ?? 0) > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-300">💵📱 Split</span>
                      <span className="text-purple-400 font-semibold">{report.summary.splitCount} payments</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-dark-700 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-400 transition-all duration-500"
                        style={{ width: `${((report.summary.splitCount ?? 0) / Math.max((report.summary.cashCount ?? 0) + (report.summary.onlineCount ?? 0) + (report.summary.splitCount ?? 0), 1)) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Services */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-700">
                <h3 className="text-sm font-semibold text-dark-100">Top Services</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Service</th>
                      <th className="text-right w-20">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topServices.length === 0 ? (
                      <tr><td colSpan={3} className="text-center text-dark-400 py-6">No services</td></tr>
                    ) : report.topServices.map((s, i) => (
                      <tr key={s.name}>
                        <td className="text-dark-400 text-center">{i + 1}</td>
                        <td className="font-medium text-dark-100 truncate max-w-[180px]" title={s.name}>{s.name}</td>
                        <td className="text-right font-semibold text-accent">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Customers */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-700">
                <h3 className="text-sm font-semibold text-dark-100">Top Customers by Revenue</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Customer</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right w-16">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topCustomers.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-dark-400 py-6">No customers</td></tr>
                    ) : report.topCustomers.map((c, i) => (
                      <tr key={c.phone}>
                        <td className="text-dark-400 text-center">{i + 1}</td>
                        <td>
                          <p className="font-medium text-dark-100">{c.name}</p>
                          <p className="text-xs text-dark-400 font-mono">{c.phone}</p>
                        </td>
                        <td className="text-right font-semibold text-accent">{fmt(c.revenue)}</td>
                        <td className="text-right text-dark-300">{c.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Daily breakdown */}
          {report.dailyBreakdown.length > 1 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-accent" /> Daily Revenue Breakdown
              </h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-0" style={{ minHeight: '80px' }}>
                  {(() => {
                    const max = Math.max(...report.dailyBreakdown.map(d => d.revenue));
                    return report.dailyBreakdown.map((d) => (
                      <div key={d.date} className="flex flex-col items-center gap-1 flex-1 min-w-[28px]">
                        <span className="text-[9px] text-dark-400">{d.revenue >= 1000 ? `${(d.revenue/1000).toFixed(1)}k` : d.revenue}</span>
                        <div
                          className="w-full rounded-t bg-accent opacity-80 hover:opacity-100 transition-opacity"
                          style={{ height: `${max > 0 ? Math.max((d.revenue / max) * 60, 4) : 4}px` }}
                          title={`${d.label}: ₹${d.revenue}`}
                        />
                        <span className="text-[9px] text-dark-400 truncate w-full text-center">{d.label}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomerReportView — inline component
// ---------------------------------------------------------------------------
function CustomerReportView() {
  const [filter, setFilter] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    if (filter === 'custom' && (!startDate || !endDate)) {
      setValidationError('Please select both start and end dates');
      return;
    }
    setValidationError(null);
    setLoading(true);
    try {
      const params = { filter };
      if (filter === 'custom') { params.start = startDate; params.end = endDate; }
      const { data } = await invoiceAPI.getReport(params);
      setRows(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filter, startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { filter };
      if (filter === 'custom') { params.start = startDate; params.end = endDate; }
      const { data } = await invoiceAPI.exportReport(params);
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `visit-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const formatAmount = (v) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      {/* Date filter bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-dark-100">Visit Report</h3>
          <button
            onClick={handleExport}
            disabled={rows.length === 0 || exporting}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <Download size={13} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
            { key: 'custom', label: 'Custom' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setValidationError(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === key ? 'bg-accent text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              {label}
            </button>
          ))}

          {filter === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm py-1 px-2"
              />
              <span className="text-dark-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm py-1 px-2"
              />
            </div>
          )}
        </div>
        {validationError && (
          <p className="text-red-400 text-xs mt-2">{validationError}</p>
        )}
      </div>

      {/* Report table */}
      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-16 text-dark-400">
          <p className="text-lg mb-1">No visits found</p>
          <p className="text-sm">No customer visits found for the selected period</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
            <h3 className="text-sm font-semibold text-dark-100">
              {rows.length} visit{rows.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12">S.No</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>DOB</th>
                  <th>Anniversary</th>
                  <th>Services</th>
                  <th className="text-right">Amount</th>
                  <th>Payment</th>
                  <th>Visit Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.invoice_number}-${index}`}>
                    <td className="text-dark-400 text-center">{index + 1}</td>
                    <td className="font-medium text-dark-100">{row.customer_name}</td>
                    <td className="font-mono text-sm">{row.customer_phone}</td>
                    <td className="text-sm text-dark-300">{formatDate(row.birthday)}</td>
                    <td className="text-sm text-dark-300">{formatDate(row.anniversary)}</td>
                    <td
                      className="text-sm text-dark-300 max-w-[200px] truncate"
                      title={(row.items || []).map((i) => i.description).join(', ')}
                    >
                      {(row.items || []).map((i) => i.description).join(', ') || '—'}
                    </td>
                    <td className="text-right font-semibold text-accent">{formatAmount(row.total)}</td>
                    <td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        row.payment_method === 'online' ? 'bg-blue-900/30 text-blue-400'
                        : row.payment_method === 'split' ? 'bg-purple-900/30 text-purple-400'
                        : 'bg-dark-700 text-yellow-400'
                      }`}>
                        {row.payment_method === 'online' ? '📱 Online' : row.payment_method === 'split' ? '💵📱 Split' : '💵 Cash'}
                      </span>
                    </td>
                    <td className="text-sm text-dark-300">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Customers page
// ---------------------------------------------------------------------------
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [isActive, setIsActive] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');
  const fileInputRef = useRef(null);
  const limit = 15;

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await customerAPI.getAll({
        search, gender, is_active: isActive, page, limit,
      });
      setCustomers(data.data.data);
      setTotal(data.data.total);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search, gender, isActive, page]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setSelected(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      birthday: customer.birthday || '',
      anniversary: customer.anniversary || '',
      last_visit: customer.last_visit || '',
      gender: customer.gender || '',
      notes: customer.notes || '',
      is_active: customer.is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || null,
        address: form.address || null,
        birthday: form.birthday || null,
        anniversary: form.anniversary || null,
        last_visit: form.last_visit || null,
        gender: form.gender || null,
        notes: form.notes || null,
      };

      if (selected) {
        await customerAPI.update(selected.id, payload);
        toast.success('Customer updated');
      } else {
        await customerAPI.create(payload);
        toast.success('Customer created');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await customerAPI.delete(selected.id);
      toast.success('Customer deleted');
      setDeleteOpen(false);
      fetchCustomers();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data } = await customerAPI.import(file);
      toast.success(`Imported ${data.data.imported} customers`);
      if (data.data.errors?.length) {
        toast.error(`${data.data.errors.length} rows had errors`);
      }
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    }
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const { data } = await customerAPI.export();
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-dark-400 text-sm mt-1">{total} total customers</p>
        </div>
        {activeTab === 'customers' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              <Upload size={16} /> Import
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <button onClick={handleExport} className="btn-secondary">
              <Download size={16} /> Export
            </button>
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Add Customer
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-accent text-accent'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          Customers
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'report'
              ? 'border-accent text-accent'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          Visit Report
        </button>
        <button
          onClick={() => setActiveTab('business')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'business'
              ? 'border-accent text-accent'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          Business Report
        </button>
      </div>

      {/* Customers tab */}
      {activeTab === 'customers' && (
        <>
          <div className="card mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, phone, or email..."
                  className="pl-9"
                />
              </div>
              <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} className="sm:w-40">
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className="sm:w-40">
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12 text-dark-400">
                <Filter size={32} className="mx-auto mb-3 opacity-50" />
                <p>No customers found</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Birthday</th>
                    <th>Last Visit</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-dark-100">{c.name}</td>
                      <td className="font-mono text-sm">{c.phone}</td>
                      <td className="text-dark-400">{c.email || '—'}</td>
                      <td>{c.birthday || '—'}</td>
                      <td>{c.last_visit || '—'}</td>
                      <td>
                        <span className={c.is_active ? 'badge-success' : 'badge-danger'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-accent">
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setSelected(c); setDeleteOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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
        </>
      )}

      {/* Report tab */}
      {activeTab === 'report' && <CustomerReportView />}

      {/* Business Report tab */}
      {activeTab === 'business' && <BusinessReportView />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Customer' : 'Add Customer'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group sm:col-span-2">
              <label className="form-label">Address</label>
              <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Birthday</label>
              <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Anniversary</label>
              <input type="date" value={form.anniversary} onChange={(e) => setForm({ ...form, anniversary: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Visit</label>
              <input type="date" value={form.last_visit} onChange={(e) => setForm({ ...form, last_visit: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : selected ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${selected?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
