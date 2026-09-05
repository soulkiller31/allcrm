import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.2 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.1 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.6l6.2 5.2C40.9 35.8 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

export default function Login() {
  const [mode, setMode] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, signup, loginWithGoogle, completeGoogleSignup, firebaseConfigured, pendingSignup, clearPendingSignup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '', password: '', name: '', businessName: '', businessType: 'general', phone: '',
  });

  useEffect(() => {
    if (pendingSignup && mode !== 'signup') {
      setMode('signup');
      setForm((f) => ({
        ...f,
        email: pendingSignup.email || f.email,
        name: pendingSignup.name || f.name,
      }));
      toast('Almost done — finish creating your business account', {
        icon: '✍️',
        duration: 4000,
      });
    }
  }, [pendingSignup, mode]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back!');
        navigate('/');
      } else if (pendingSignup) {
        // Google user completing business setup — already authenticated,
        // no password needed, use their existing Firebase session.
        await completeGoogleSignup({
          name: form.name,
          businessName: form.businessName,
          businessType: form.businessType,
          phone: form.phone,
        });
        toast.success('Account created! 3-day free trial started.');
        navigate('/onboarding');
      } else {
        // Normal email/password signup
        if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        await signup(form);
        toast.success('Account created! 3-day free trial started.');
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result?.signupRequired) {
        setMode('signup');
        const info = pendingSignup || result.data?.firebase || {};
        setForm((f) => ({
          ...f,
          email: info.email || f.email,
          name: info.name || f.name,
        }));
        toast('Almost done — finish creating your business account', {
          icon: '✍️',
          duration: 4000,
        });
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Google sign-in failed');
    } finally { setGoogleLoading(false); }
  };

  const switchMode = (nextMode) => {
    if (nextMode === 'login' && pendingSignup) clearPendingSignup();
    setMode(nextMode);
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 relative overflow-hidden">
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-accent-soft text-accent">
              <Scissors size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">CRM Pro</h1>
              <p className="text-xs text-ink-muted">Business Management</p>
            </div>
          </div>
        </div>

        <div className="card rounded-2xl" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-ink mb-1">
              {mode === 'login' ? 'Welcome back' : pendingSignup ? 'Almost done!' : 'Create your account'}
            </h2>
            <p className="text-sm text-ink-muted">
              {mode === 'login'
                ? 'Sign in to continue to your dashboard'
                : pendingSignup
                ? 'Fill in your business details to complete sign-up.'
                : 'Start your 3-day free trial. No credit card needed.'}
            </p>
            {pendingSignup && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                <GoogleIcon size={14} />
                Signing up as {pendingSignup.email}
              </div>
            )}
          </div>

          <div className="flex mb-6 border-b border-surface-border">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                  mode === m
                    ? 'border-accent text-accent'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          {firebaseConfigured && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-surface-border bg-white hover:bg-surface transition-colors text-ink font-medium disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <GoogleIcon size={18} />
                )}
                <span className="text-sm">
                  {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </span>
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-surface-border" />
                <span className="text-xs text-ink-muted uppercase tracking-wide">
                  or continue with email
                </span>
                <div className="flex-1 h-px bg-surface-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="form-group">
                  <label className="form-label">Your Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Business Name *</label>
                  <input
                    value={form.businessName}
                    onChange={(e) => set('businessName', e.target.value)}
                    placeholder="My Salon / Shop"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select
                      value={form.businessType}
                      onChange={(e) => set('businessType', e.target.value)}
                    >
                      <option value="general">General</option>
                      <option value="salon">Salon</option>
                      <option value="spa">Spa</option>
                      <option value="clinic">Clinic</option>
                      <option value="retail">Retail</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="gym">Gym</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@business.com"
                required
                readOnly={!!pendingSignup}
                className={pendingSignup ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>

            {/* Hide password field for Google sign-up — no password needed */}
            {!pendingSignup && (
              <div className="form-group">
                <label className="form-label">Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* For login mode, password is always shown via the !pendingSignup guard above */}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Please wait...
                </>
              ) : mode === 'login'
                ? 'Login with Email'
                : 'Create Account — Start Free Trial'}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-ink-muted text-center mt-4">
              3-day free trial. Then ₹2,499/month. No credit card needed for trial.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
