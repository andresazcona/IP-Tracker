import React from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/Device';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

const getRoleName = (role: Role | string | undefined): string | undefined => {
  if (!role) {
    return undefined;
  }
  if (typeof role === 'string') {
    return role;
  }
  return role.name;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const roleName = getRoleName(user?.role);
    if (!roleName || !allowedRoles.includes(roleName)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
