import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import Paywall from './Paywall';

export default function ProtectedRoute({ children, requireSub = true }) {
  const { isAuthenticated, loading, isSubscriptionActive, subscription } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requireSub && subscription !== null && subscription !== undefined && !isSubscriptionActive) {
    return <Paywall />;
  }
  return children;
}
