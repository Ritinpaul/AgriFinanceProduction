// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Usage: <ProtectedRoute roles={["farmer"]}><FarmerDashboard /></ProtectedRoute>
const ProtectedRoute = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-600 dark:text-gray-300">Checking access…</div>
    );
  }

  if (!user?.id) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0) {
    const role = user?.role || 'user';
    if (!roles.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;