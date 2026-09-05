import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Paywall() {
  const { subscription } = useAuth();
  const isPending = !subscription || subscription.status === 'pending';
  const isTrial   = subscription?.status === 'trial';

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-ink mb-2">
          {isPending ? 'Activate Your Account'
           : isTrial  ? 'Trial Expired'
           : 'Subscription Expired'}
        </h2>
        <p className="text-ink-muted mb-6">
          {isPending
            ? 'Pay just ₹1 to unlock your 7-day free trial with full access to all features.'
            : isTrial
            ? 'Your 7-day trial has ended. Subscribe to continue managing your business.'
            : 'Your subscription has expired. Renew to continue managing your business.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/billing" className="btn-primary px-8">
            {isPending ? 'Start Trial for ₹1 →' : 'View Plans & Subscribe'}
          </Link>
        </div>
        <p className="text-xs text-ink-subtle mt-4">
          {isPending ? '7-day full access · Then from ₹2,499/month' : 'Starting at ₹2,499/month · UPI, Cards, Net Banking'}
        </p>
      </div>
    </div>
  );
}
