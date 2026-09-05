import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { templateAPI } from '../services/api';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';

const TEMPLATE_TYPES = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'monthly_offer', label: 'Monthly Offer' },
  { value: 'follow_up_female', label: 'Female Follow-up (15 Days)' },
  { value: 'follow_up_male', label: 'Male Follow-up (75 Days)' },
  { value: 'follow_up', label: 'General Follow-up Fallback' },
];

const TYPE_COLORS = {
  birthday: 'badge-warning',
  anniversary: 'badge-info',
  monthly_offer: 'badge-success',
  follow_up_female: 'badge-danger',
  follow_up_male: 'badge-danger',
  follow_up: 'badge-warning',
};

const emptyForm = { type: 'birthday', name: '', content: '', is_active: true };

const PLACEHOLDERS = '{{name}}, {{phone}}, {{email}}, {{salon_name}}, {{birthday}}, {{anniversary}}, {{last_visit}}';

const formatTypeLabel = (type) => type.split('_').join(' ');

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = filterType ? { type: filterType } : {};
      const { data } = await templateAPI.getAll(params);
      setTemplates(data.data);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [filterType]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (template) => {
    setSelected(template);
    setForm({
      type: template.type,
      name: template.name,
      content: template.content,
      is_active: template.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (selected) {
        await templateAPI.update(selected.id, form);
        toast.success('Template updated');
      } else {
        await templateAPI.create(form);
        toast.success('Template created');
      }
      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await templateAPI.delete(selected.id);
      toast.success('Template deleted');
      setDeleteOpen(false);
      fetchTemplates();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Message Templates</h1>
          <p className="text-dark-400 text-sm mt-1">Manage automated WhatsApp message templates</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Add Template
        </button>
      </div>

      <div className="card mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="sm:w-60">
          <option value="">All Types</option>
          {TEMPLATE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-dark-400">
          <FileText size={32} className="mx-auto mb-3 opacity-50" />
          <p>No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="card hover:border-dark-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={TYPE_COLORS[t.type] || 'badge-info'}>
                    {formatTypeLabel(t.type)}
                  </span>
                  <h3 className="font-semibold text-dark-50 mt-2">{t.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-accent">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => { setSelected(t); setDeleteOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-dark-300 leading-relaxed whitespace-pre-wrap">{t.content}</p>
              <div className="mt-3 pt-3 border-t border-dark-700 flex justify-between items-center">
                <span className={t.is_active ? 'badge-success' : 'badge-danger'}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Template' : 'Add Template'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
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
            <label className="form-label">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
            <p className="text-xs text-dark-500 mt-1">Available placeholders: {PLACEHOLDERS}</p>
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
        title="Delete Template"
        message={`Are you sure you want to delete "${selected?.name}"?`}
        loading={deleting}
      />
    </div>
  );
}
