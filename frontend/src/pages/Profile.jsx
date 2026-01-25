// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BuyerProfile from '../components/BuyerProfile';
import FarmerProfile from '../components/FarmerProfile';
import LenderProfile from '../components/LenderProfile';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateProfile, loading } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await updateProfile(form);
      if (result.success) {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };


  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show message if no user (this should not happen due to ProtectedRoute)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Profile</h2>
          <p className="text-gray-600 dark:text-gray-400">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  // Render role-specific profile components
  const renderRoleSpecificProfile = () => {
    switch (user?.role) {
      case 'farmer':
        return <FarmerProfile />;
      case 'buyer':
        return <BuyerProfile />;
      case 'lender':
        return <LenderProfile />;
      default:
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Profile</h2>
              <p className="text-gray-600 dark:text-gray-400">Please complete your profile setup to access role-specific features.</p>
            </div>
          </div>
        );
    }
  };

  return renderRoleSpecificProfile();
};

export default Profile;