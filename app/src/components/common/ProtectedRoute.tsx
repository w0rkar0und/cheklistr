import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { authUser, profile, isLoading, isInitialised } = useAuthStore();

  // Still loading auth state
  if (!isInitialised || isLoading) {
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
  if (requiredRole && profile.role !== requiredRole) {
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
