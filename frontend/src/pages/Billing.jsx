import { useEffect, useState } from 'react';
import { CheckCircle, Zap, Calendar, CreditCard, AlertTriangle, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PLAN_COLORS = {
  monthly:    'border-blue-500 bg-blue-500/10',
  halfyearly: 'border-accent bg-accent/10',
  yearly:     'border-green-500 bg-green-500/10',
};
const PLAN_BADGE = {
  halfyearly: 'Most Popular',
  yearly:     'Best Value',
};

export default function Billing() {
  const { subscription, refreshSubscription } = useAuth();
  const [plans, setPlans]               = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('halfyearly');
  const [loading, setLoading]           = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [verifying, setVerifying]       = useState(false);

  useEffect(() => {
    paymentAPI.getPlans()
      .then(({ data }) => setPlans(data.data || []))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  // Handle Cashfree return redirect: /billing?order_id=...&plan=...
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const plan    = params.get('plan');
    if (orderId && plan) {
      window.history.replaceState({}, '', '/billing');
      handleVerify(orderId, plan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (orderId, plan) => {
    setVerifying(true);
    try {
      const { data } = await paymentAPI.verifyPayment({ orderId, plan });
      toast.success(data.message || 'Subscription activated!');
      await refreshSubscription();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment verification failed. Contact support if amount was deducted.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data } = await paymentAPI.createOrder(selectedPlan);
      const { paymentSessionId } = data.data;

      if (!window.Cashfree) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const cashfree = await window.Cashfree({
        mode: import.meta.env.VITE_CASHFREE_MODE || (import.meta.env.PROD ? 'production' : 'sandbox'),
      });
      cashfree.checkout({ paymentSessionId, redirectTarget: '_self' });
      // Don't setLoading(false) — page redirects to Cashfree
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  // Derived state
  const isTrial  = subscription?.status === 'trial';
  const isActive = subscription?.status === 'active';
  const isExpired = subscription && !isTrial && !isActive;
  const daysLeft  = subscription?.daysLeft ?? 0;
  const lowDays   = daysLeft <= 1 && daysLeft > 0;

  const statusColor = isActive ? 'text-green-400'
    : isTrial  ? 'text-yellow-400'
    : 'text-red-400';

  const selectedPlanPrice = plans.find(p => p.key === selectedPlan)?.price;

  if (verifying) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="animate-spin text-accent" />
        <p className="text-lg font-semibold text-ink">Confirming your payment…</p>
        <p className="text-sm text-ink-muted">Please wait, do not close this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing &amp; Subscription</h1>
          <p className="page-subtitle">Manage your plan and payment</p>
        </div>
      </div>

      {/* Trial expiring soon warning */}
      {isTrial && lowDays && (
        <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30">
          <Clock size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-400">
              Trial ends today!
            </p>
            <p className="text-sm text-ink-muted mt-0.5">
              Subscribe now to keep your data and avoid any interruption.
            </p>
          </div>
        </div>
      )}

      {/* Expired banner */}
      {isExpired && (
        <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-400">Your subscription has expired</p>
            <p className="text-sm text-ink-muted mt-0.5">
              All CRM features are paused. Choose a plan below to reactivate instantly.
            </p>
          </div>
        </div>
      )}

      {/* Current subscription status */}
      {subscription && (
        <div className="card mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Current Plan</p>
            <p className={`text-2xl font-bold capitalize mt-1 ${statusColor}`}>
              {isTrial   ? '🎯 Free Trial (3 days)'
               : subscription.plan === 'monthly'    ? '📅 Monthly'
               : subscription.plan === 'halfyearly' ? '📆 6 Months'
               : subscription.plan === 'yearly'     ? '🏆 Yearly'
               : '❌ Expired'}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              {isTrial && subscription.trialEndsAt
                ? `Trial ends: ${new Date(subscription.trialEndsAt).toLocaleDateString('en-IN')}`
                : subscription.paidUntil
                  ? `Active until: ${new Date(subscription.paidUntil).toLocaleDateString('en-IN')}`
                  : 'No active plan'}
              {daysLeft > 0 && (
                <span className={`ml-2 font-medium ${statusColor}`}>
                  · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className={statusColor} />
            <span className={`font-semibold capitalize ${statusColor}`}>
              {isExpired ? 'Expired' : isTrial ? 'Trial Active' : 'Active'}
            </span>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <h2 className="text-lg font-semibold text-ink mb-1">
        {isActive ? 'Extend or Upgrade Your Plan' : isTrial ? 'Subscribe before your trial ends' : 'Choose a Plan'}
      </h2>
      <p className="text-sm text-ink-muted mb-5">
        All plans include full feature access — customers, invoices, WhatsApp automation and reports.
      </p>

      {loadingPlans ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-44" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {plans.map(plan => (
            <div key={plan.key}
              onClick={() => setSelectedPlan(plan.key)}
              className={`card relative transition-all border-2 cursor-pointer ${
                selectedPlan === plan.key
                  ? PLAN_COLORS[plan.key] || 'border-accent bg-accent/10'
                  : 'border-surface-border hover:border-accent/40'
              }`}
            >
              {PLAN_BADGE[plan.key] && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs px-3 py-0.5 rounded-full font-semibold">
                  {PLAN_BADGE[plan.key]}
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                {plan.key === 'monthly'    ? <Calendar   size={18} className="text-blue-400" />  :
                 plan.key === 'halfyearly' ? <Zap        size={18} className="text-accent" />     :
                                             <CreditCard  size={18} className="text-green-400" />}
                <span className="font-semibold text-ink">{plan.label}</span>
              </div>
              <p className="text-3xl font-bold text-ink">₹{plan.price.toLocaleString('en-IN')}</p>
              <p className="text-sm text-ink-muted mt-1">{plan.days} days access</p>
              {plan.key === 'yearly'     && <p className="text-xs text-green-400 mt-1 font-medium">Best value — save vs monthly</p>}
              {plan.key === 'halfyearly' && <p className="text-xs text-accent mt-1 font-medium">Save vs monthly billing</p>}
              {selectedPlan === plan.key && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-accent">
                  <CheckCircle size={13} /> Selected
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={loading || loadingPlans || !selectedPlanPrice}
        className="btn-primary px-8 min-w-48"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Redirecting…</>
        ) : (
          `Pay ₹${selectedPlanPrice?.toLocaleString('en-IN') ?? '…'} via Cashfree`
        )}
      </button>

      <p className="text-xs text-ink-muted mt-3">
        Secure payment via Cashfree · UPI, Cards, Net Banking · Instant activation
      </p>
    </div>
  );
}
