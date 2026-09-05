import { Link } from 'react-router-dom';
import { Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TrialBanner() {
  const { subscription, isSubscriptionActive } = useAuth();
  if (!subscription) return null;

  const daysLeft = (() => {
    if (!subscription) return 0;
    const now = new Date();
    const end = subscription.status === 'trial' ? subscription.trialEndsAt : subscription.paidUntil;
    if (!end) return 0;
    return Math.max(0, Math.ceil((new Date(end) - now) / 86400000));
  })();

  if (!isSubscriptionActive) return null;
  if (subscription.status === 'active' && daysLeft > 7) return null;

  const isTrial = subscription.status === 'trial';
  const isExpiringSoon = daysLeft <= 3;

  const bgClass = isExpiringSoon
    ? 'bg-red-500/10 border-red-500/30 text-red-600'
    : 'bg-amber-500/10 border-amber-500/30 text-amber-700';

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm border-b ${bgClass}`}>
      <div className="flex items-center gap-2">
        {isExpiringSoon ? <AlertTriangle size={14} /> : <Clock size={14} />}
        <span>
          {isTrial
            ? `Free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
            : `Subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
          {' '}Upgrade to keep access.
        </span>
      </div>
      <Link to="/billing" className="ml-4 shrink-0 px-3 py-1 rounded-lg btn-primary text-xs font-semibold">
        Upgrade Now
      </Link>
    </div>
  );
}
