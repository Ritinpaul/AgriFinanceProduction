// frontend/src/components/ProfileCompletion.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ProfileCompletion = ({ user, onComplete }) => {
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    role: 'farmer'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        role: user.role || 'farmer'
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.role) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      // First update basic user profile
      const basicProfileData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        profile_completed: true
      };
      
      const basicResult = await updateProfile(basicProfileData);
      
      if (basicResult.success) {
        // Then create role-specific profile
        const roleProfileData = {
          // Basic fields that all roles need
          phone_number: formData.phone
        };

        let roleApiEndpoint = '';
        switch (formData.role) {
          case 'farmer':
            roleApiEndpoint = '/api/farmer/profile';
            break;
          case 'buyer':
            roleApiEndpoint = '/api/buyer/profile';
            break;
          case 'lender':
            roleApiEndpoint = '/api/lender/profile';
            break;
          default:
            throw new Error('Invalid role');
        }

        const roleResponse = await fetch(`http://localhost:3001${roleApiEndpoint}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify(roleProfileData)
        });

        const roleResult = await roleResponse.json();
        
        if (roleResult.success) {
          toast.success('Profile completed successfully! Redirecting to home...');
          
          // Redirect to home page after successful profile completion
          setTimeout(() => {
            navigate('/');
          }, 1500);
          
          // Call onComplete to close modal if it exists
          if (onComplete) {
            onComplete();
          }
        } else {
          toast.error('Failed to create role-specific profile');
        }
      } else {
        toast.error('Failed to complete basic profile');
      }
    } catch (error) {
      console.error('Profile completion error:', error);
      toast.error('An error occurred while completing your profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Complete Your Profile
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please provide some additional information to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
            placeholder="+1 (555) 123-4567"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
            required
          >
            <option value="farmer">Farmer</option>
            <option value="lender">Lender</option>
            <option value="buyer">Buyer</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
        >
          {loading ? 'Completing...' : 'Complete Profile'}
        </button>
      </form>
    </div>
  );
};

export default ProfileCompletion;