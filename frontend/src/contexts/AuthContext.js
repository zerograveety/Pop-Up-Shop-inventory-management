import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { authAPI, managerAPI } from '../api';

// Ensure a consistent API base URL for any direct axios usage in this context
if (!axios.defaults.baseURL) {
  axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Check if user is authenticated on app load
  useEffect(() => {
    const initializeAuth = async () => {
      // Dev bypass detection: attempt a lightweight verify; if 401 then treat normally; if 200 success or AUTH_DISABLED header returned without stored token, create fake user
      try {
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            setIsAuthenticated(true);
            setLoading(false);
            return;
          } catch (e) {
            localStorage.removeItem('auth_user');
          }
        }

        // Default unauthenticated
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = async (arg1, arg2) => {
    try {
      // Support both (token, user) and (user) signatures — token is ignored now
      const userData = arg2 || arg1;
      if (!userData) return { success: false, error: 'No user data provided' };
      localStorage.setItem('auth_user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Failed to login' };
    }
  };

  const logout = async () => {
    try {
      // Clear localStorage
      localStorage.removeItem('auth_user');
      
      // Clear state
      setUser(null);
      setIsAuthenticated(false);
      
      // Remove axios default header
      delete axios.defaults.headers.common['Authorization'];
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Failed to logout' };
    }
  };

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData };
    setUser(newUserData);
    localStorage.setItem('auth_user', JSON.stringify(newUserData));
  };

  // Role-based permission checks
  const hasRole = (requiredRole) => {
    if (!user || !user.role) return false;
    const roleHierarchy = { 'Admin': 2, 'Manager': 1 };
    if (!(requiredRole in roleHierarchy)) return false;
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole];
    return userLevel >= requiredLevel;
  };

  // Strict helpers for equality checks in UI logic
  const isAdmin = () => user?.role === 'Admin';
  const isManager = () => user?.role === 'Manager';
  // Cashier role removed; always false for compatibility
  const isCashier = () => false;

  // Permission checks for specific actions
  const canAccessAdminPanel = () => isAdmin();
  const canManageUsers = () => isAdmin();
  const canManageProducts = () => hasRole('Manager');
  const canViewReports = () => hasRole('Manager');
  const canCreateOrders = () => hasRole('Manager');
  const canProcessRefunds = () => hasRole('Manager');

  const value = {
  // State
  user,
  loading,
  isAuthenticated,
    
    // Actions
    login,
    logout,
    updateUser,
    
    // Role checks
    hasRole,
    isAdmin,
    isManager,
    isCashier,
    
    // Permission checks
    canAccessAdminPanel,
    canManageUsers,
    canManageProducts,
    canViewReports,
    canCreateOrders,
    canProcessRefunds
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };