import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

/**
 * Safety timeout: if loading is stuck for more than 5 seconds AFTER
 * initialisation, force loading to false.  This prevents the infinite
 * spinner caused by race conditions in the auth state listener.
 */
const LOADING_SAFETY_TIMEOUT = 5000;

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { authUser, profile, isLoading, isInitialised } = useAuthStore();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Only start safety timer once initialised but still loading
    if (isInitialised && isLoading && !timedOut) {
      const timer = setTimeout(() => {
        console.warn('[ProtectedRoute] Loading stuck — forcing recovery');
        useAuthStore.getState().setLoading(false);
        setTimedOut(true);
      }, LOADING_SAFETY_TIMEOUT);
      return () => clearTimeout(timer);
    }
    // Reset timeout flag when loading finishes
    if (!isLoading) {
      setTimedOut(false);
    }
  }, [isInitialised, isLoading, timedOut]);

  // Only block on initial load (before initialisation completes)
  if (!isInitialised) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated
  if (!authUser || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  // super_admin passes all role checks (including 'admin')
  if (requiredRole && profile.role !== requiredRole && profile.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  // Check account is active
  if (!profile.is_active) {
    return (
      <div className="error-screen">
        <h2>Account Deactivated</h2>
        <p>Your account has been deactivated. Please contact an administrator.</p>
      </div>
    );
  }

  return <>{children}</>;
}
