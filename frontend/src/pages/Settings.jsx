import { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Save, Sun, Moon, Palette, Store, Phone, MapPin, FileText, Loader2, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { tenantAPI } from '../services/api';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
  { key: 'dark',  label: 'Dark',  icon: Moon, desc: 'Easy on eyes' },
];

const fileToDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function Settings() {
  const { tenant, refreshSubscription } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  const [businessName, setBusinessName] = useState(tenant?.name || '');
  const [businessType, setBusinessType] = useState(tenant?.businessType || 'general');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [address, setAddress] = useState(tenant?.address || '');
  const [gstin, setGstin] = useState(tenant?.gstin || '');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || '');
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const fileRef = useRef(null);

  const pendingLogoPreview = logoFile ? logoUrl : (tenant?.logoUrl || '');

  const handlePickLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    try {
      const dataUrl = await fileToDataURL(file);
      setLogoUrl(dataUrl);
      setLogoFile(file);
    } catch { toast.error('Failed to read image'); }
  };

  const handleRemoveLogo = async () => {
    setRemovingLogo(true);
    try {
      await tenantAPI.update({ logoUrl: '' });
      setLogoUrl('');
      setLogoFile(null);
      await refreshSubscription();
      toast.success('Logo removed');
    } catch { toast.error('Failed to remove logo'); }
    finally { setRemovingLogo(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) { toast.error('Business name is required'); return; }
    setSaving(true);
    try {
      await tenantAPI.update({
        businessName: businessName.trim(),
        businessType,
        phone: phone || '',
        address: address || '',
        gstin: gstin || '',
        logoUrl: logoUrl || '',
      });
      await refreshSubscription();
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Customize your workspace, business info & branding</p>
        </div>
        <button type="submit" form="settings-form" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <form id="settings-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branding / Logo section */}
        <section className="card lg:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="text-accent" />
            <h2 className="settings-section-title">Branding</h2>
          </div>
          <p className="settings-section-desc">Your logo will appear on invoices, receipts and the sidebar</p>

          <div className="flex flex-col items-center gap-4 mb-6 p-4 rounded-xl" style={{ background: 'var(--surface-soft)', border: '1px dashed var(--surface-border)' }}>
            <div className="w-28 h-28 rounded-xl flex items-center justify-center overflow-hidden"
                 style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {pendingLogoPreview ? (
                <img src={pendingLogoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center flex flex-col items-center gap-1" style={{ color: 'var(--ink-subtle)' }}>
                  <ImagePlus size={28} />
                  <span className="text-[11px]">No logo</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary flex-1 text-xs py-2">
                <Upload size={14} /> {pendingLogoPreview ? 'Change' : 'Upload Logo'}
              </button>
              {pendingLogoPreview && (
                <button type="button" onClick={handleRemoveLogo} disabled={removingLogo}
                        className="btn-danger text-xs py-2 px-3" title="Remove logo">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickLogo} />
            <p className="text-[11px] text-center" style={{ color: 'var(--ink-subtle)' }}>
              PNG, JPG, SVG up to 2MB. Square shape works best.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
              <Sun size={14} className="text-amber-500" /> Appearance
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {THEME_OPTIONS.map(({ key, label, icon: Icon, desc }) => {
                const active = (key === 'dark' && isDark) || (key === 'light' && !isDark);
                return (
                  <button type="button" key={key} onClick={() => setTheme(key)}
                    className={`group relative p-3 rounded-xl border text-left transition-all ${active
                      ? 'border-accent shadow-glow' : ''}`}
                    style={{
                      background: active ? 'var(--accent-soft)' : 'var(--surface-soft)',
                      borderColor: active ? '#10b981' : 'var(--surface-border)',
                    }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} style={{ color: active ? '#10b981' : 'var(--ink-muted)' }} />
                      <span className="text-sm font-semibold" style={{ color: active ? '#10b981' : 'var(--ink)' }}>{label}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--ink-subtle)' }}>{desc}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between p-3 rounded-xl"
                 style={{ background: 'var(--surface-soft)', border: '1px solid var(--surface-border)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Quick toggle</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-subtle)' }}>Switch between light & dark</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </section>

        {/* Business Profile section */}
        <section className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Store size={18} className="text-accent" />
            <h2 className="settings-section-title">Business Profile</h2>
          </div>
          <p className="settings-section-desc">This information appears on invoices and customer communications</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group md:col-span-2">
              <label className="form-label">Business Name *</label>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                placeholder="My Awesome Salon" required />
            </div>
            <div className="form-group">
              <label className="form-label">Business Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                <option value="salon">Salon</option>
                <option value="spa">Spa & Wellness</option>
                <option value="clinic">Clinic</option>
                <option value="retail">Retail Shop</option>
                <option value="restaurant">Restaurant</option>
                <option value="gym">Gym & Fitness</option>
                <option value="general">Other Business</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label flex items-center gap-1.5">
                <Phone size={13} /> Phone / Contact
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <MapPin size={13} /> Address
              </label>
              <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address, shown on invoices" />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <FileText size={13} /> GSTIN <span style={{ color: 'var(--ink-subtle)' }}>(optional)</span>
              </label>
              <input value={gstin} onChange={(e) => setGstin(e.target.value)}
                placeholder="22AAAAA0000A1Z5" />
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
      <div className="theme-toggle-knob">
        {isDark ? <Moon size={11} /> : <Sun size={11} />}
      </div>
    </button>
  );
}
