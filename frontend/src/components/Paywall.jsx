import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Paywall() {
  const { subscription } = useAuth();
  const isTrial = subscription?.status === 'trial';

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-ink mb-2">
          {isTrial ? 'Trial Expired' : 'Subscription Expired'}
        </h2>
        <p className="text-ink-muted mb-6">
          {isTrial
            ? 'Your 3-day free trial has ended. Subscribe to continue using all features.'
            : 'Your subscription has expired. Renew to continue managing your business.'}
        </p>
        <Link to="/billing" className="btn-primary px-8">
          View Plans &amp; Subscribe
        </Link>
        <p className="text-xs text-ink-subtle mt-4">
          Starting at ₹2,499/month · UPI, Cards, Net Banking
        </p>
      </div>
    </div>
  );
}
