// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

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
  const authCheckedRef = useRef(false);

  // Check authentication status on app initialization
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    // Prevent multiple simultaneous calls
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    
    try {
      setLoading(true);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      const result = await apiClient.getCurrentUser();
      
      if (result.data && result.data.user) {
        setUser(result.data.user);
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
      // Reset the ref after 5 seconds to allow future calls
      setTimeout(() => {
        authCheckedRef.current = false;
      }, 5000);
    }
  };

  const signUp = async (userData) => {
    try {
      setLoading(true);
      
      const result = await apiClient.signUp(userData);
      
      if (result.data && result.data.token) {
        apiClient.setToken(result.data.token);
        setUser(result.data.user);
        toast.success('Account created successfully!');
        return { success: true, user: result.data.user };
      } else {
        toast.error(result.error || 'Signup failed');
        return { success: false, error: result.error || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Signup failed: ' + error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (credentials) => {
    try {
      setLoading(true);
      
      const result = await apiClient.signIn(credentials);
      
      if (result.data && result.data.token) {
        apiClient.setToken(result.data.token);
        setUser(result.data.user);
        toast.success('Welcome back!');
        return { success: true, user: result.data.user };
      } else {
        toast.error(result.error || 'Sign in failed');
        return { success: false, error: result.error || 'Sign in failed' };
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Sign in failed: ' + error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    apiClient.setToken(null);
    setUser(null);
    toast.success('Signed out successfully');
  };

  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      
      const result = await apiClient.updateProfile(profileData);
      
      if (result.data && result.data.user) {
        setUser(result.data.user);
        toast.success('Profile updated successfully!');
        return { success: true, user: result.data.user };
      } else {
        toast.error(result.error || 'Profile update failed');
        return { success: false, error: result.error || 'Profile update failed' };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Profile update failed: ' + error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const result = await apiClient.testConnection();
      
      if (result.data) {
        toast.success('API connection successful!');
        return { success: true, data: result.data };
      } else {
        toast.error('API connection failed');
        return { success: false, error: result.error || 'API connection failed' };
      }
    } catch (error) {
      toast.error('Connection test failed: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    testConnection,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
