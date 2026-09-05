import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Store, Heart, ShoppingBag, Coffee, Dumbbell, Stethoscope, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BUSINESS_TYPES = [
  { key: 'salon', label: 'Salon', icon: Scissors },
  { key: 'spa', label: 'Spa & Wellness', icon: Sparkles },
  { key: 'clinic', label: 'Clinic', icon: Stethoscope },
  { key: 'retail', label: 'Retail Shop', icon: ShoppingBag },
  { key: 'restaurant', label: 'Restaurant', icon: Coffee },
  { key: 'gym', label: 'Gym & Fitness', icon: Dumbbell },
  { key: 'general', label: 'Other Business', icon: Store },
];

export default function Onboarding() {
  const { tenant, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState(tenant?.businessType || 'general');
  const [businessName, setBusinessName] = useState(tenant?.name || '');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [address, setAddress] = useState(tenant?.address || '');
  const [gstin, setGstin] = useState(tenant?.gstin || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) { toast.error('Business name is required'); return; }
    setSaving(true);
    try {
      await tenantAPI.update({ businessName, businessType, phone, address, gstin });
      await refreshSubscription();
      toast.success('Business profile saved!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 relative overflow-hidden">
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink mb-2">Welcome! 🎉</h1>
          <p className="text-ink-muted">Let's set up your business profile. Takes 30 seconds.</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-group">
              <label className="form-label">Business Name *</label>
              <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder="My Awesome Business" required />
            </div>

            <div>
              <label className="form-label mb-3 block">What type of business?</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BUSINESS_TYPES.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setBusinessType(key)}
                    className={`chip flex-col !rounded-xl !py-3 !px-2 gap-2 ${
                      businessType === key ? 'active' : ''
                    }`}>
                    <Icon size={22} />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Business Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" />
            </div>

            <div className="form-group">
              <label className="form-label">Business Address</label>
              <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Shown on invoices" />
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input value={gstin} onChange={e => setGstin(e.target.value)} placeholder="Optional, printed on invoices" />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : "Let's Go →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
