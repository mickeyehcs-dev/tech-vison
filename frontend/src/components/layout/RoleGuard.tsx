import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { LoadingState } from '../common/EmptyState';

export interface RoleGuardProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, loading, role, firstLogin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <LoadingState message="Verifying authentication session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Intercept first login requirement
  if (firstLogin && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to respective role home
    if (role === 'admin') return <Navigate to="/admin/overview" replace />;
    if (role === 'sender') return <Navigate to="/sender/overview" replace />;
    if (role === 'driver') return <Navigate to="/driver/overview" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
