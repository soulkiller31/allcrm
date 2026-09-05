import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { serviceAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = { category: '', name: '', price: '' };

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Group by category
  const grouped = services.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await serviceAPI.getAll();
      setServices(data.data);
    } catch { toast.error('Failed to load services'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.category.trim() || !form.name.trim()) { toast.error('Category and name required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await serviceAPI.update(editingId, { category: form.category, name: form.name, price: Number(form.price) || 0 });
        toast.success('Service updated');
      } else {
        await serviceAPI.create({ category: form.category, name: form.name, price: Number(form.price) || 0 });
        toast.success('Service added');
      }
      setForm(emptyForm); setEditingId(null); setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleEdit = (s) => {
    setForm({ category: s.category, name: s.name, price: String(s.price) });
    setEditingId(s.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await serviceAPI.delete(deleteId);
      toast.success('Service deleted');
      setDeleteId(null); load();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  // Get unique categories for datalist
  const categories = [...new Set(services.map(s => s.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="text-dark-400 text-sm mt-1">{services.length} services · Edit your service catalogue</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(v => !v); }} className="btn-primary">
          <Plus size={16} /> Add Service
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-dark-100">{editingId ? 'Edit Service' : 'Add New Service'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="text-dark-400 hover:text-dark-100">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <input list="cats" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Haircuts" required />
              <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Service Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Full Body Wax" required />
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹)</label>
              <input type="number" min="0" step="0.01" value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="500" />
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                <Save size={15} />{saving ? 'Saving...' : editingId ? 'Update' : 'Add Service'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services list grouped by category */}
      {loading ? <div className="flex justify-center py-16"><LoadingSpinner /></div> :
       services.length === 0 ? (
        <div className="card text-center py-16 text-dark-400">
          <p className="text-lg mb-2">No services yet</p>
          <p className="text-sm">Add your first service using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, svcs]) => (
            <div key={cat} className="card p-0 overflow-hidden">
              <div className="px-4 py-3 bg-dark-800 border-b border-dark-700">
                <h3 className="font-semibold text-dark-100">{cat}
                  <span className="ml-2 text-xs text-dark-400 font-normal">({svcs.length})</span>
                </h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Service</th><th className="text-right">Price</th><th className="text-right w-24">Actions</th></tr>
                </thead>
                <tbody>
                  {svcs.map(s => (
                    <tr key={s.id}>
                      <td className="font-medium text-dark-100">{s.name}</td>
                      <td className="text-right font-semibold text-accent">₹{Number(s.price).toLocaleString('en-IN')}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-accent">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Service" message="Remove this service from your catalogue?" loading={deleting} />
    </div>
  );
}
