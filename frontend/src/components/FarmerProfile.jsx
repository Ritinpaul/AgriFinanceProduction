// frontend/src/components/FarmerProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const FarmerProfile = () => {
  const { user, updateProfile, loading } = useAuth();
  const [form, setForm] = useState({
    land_area_acres: '',
    farming_experience_years: '',
    primary_crops: [],
    farming_method: 'traditional',
    irrigation_type: 'rainfed',
    soil_type: 'alluvial',
    region: '',
    village: '',
    state: '',
    country: 'India',
    phone_number: '',
    emergency_contact: '',
    certifications: [],
    organic_certified: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      // Load farmer profile data if available
      fetchFarmerProfile();
    }
  }, [user]);

  const fetchFarmerProfile = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/farmer/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.profile) {
        setForm({
          land_area_acres: data.profile.land_area_acres || '',
          farming_experience_years: data.profile.farming_experience_years || '',
          primary_crops: data.profile.primary_crops || [],
          farming_method: data.profile.farming_method || 'traditional',
          irrigation_type: data.profile.irrigation_type || 'rainfed',
          soil_type: data.profile.soil_type || 'alluvial',
          region: data.profile.region || '',
          village: data.profile.village || '',
          state: data.profile.state || '',
          country: data.profile.country || 'India',
          phone_number: data.profile.phone_number || '',
          emergency_contact: data.profile.emergency_contact || '',
          certifications: data.profile.certifications || [],
          organic_certified: data.profile.organic_certified || false
        });
      }
    } catch (error) {
      console.error('Error fetching farmer profile:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleArrayChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value.split(',').map(item => item.trim()).filter(item => item)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('http://localhost:3001/api/farmer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Farmer profile updated successfully!');
      } else {
        toast.error('Failed to update farmer profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">🌾</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Farmer Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your farmer profile to access farming features
            </p>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            {/* Land Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="land_area_acres" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Land Area (Acres)
                </label>
                <input
                  type="number"
                  step="0.01"
                  id="land_area_acres"
                  name="land_area_acres"
                  value={form.land_area_acres}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="e.g., 5.5"
                  required
                />
              </div>
              <div>
                <label htmlFor="farming_experience_years" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Farming Experience (Years)
                </label>
                <input
                  type="number"
                  id="farming_experience_years"
                  name="farming_experience_years"
                  value={form.farming_experience_years}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="e.g., 10"
                  required
                />
              </div>
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="village" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Village
                </label>
                <input
                  type="text"
                  id="village"
                  name="village"
                  value={form.village}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="Enter village name"
                  required
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="Enter state"
                  required
                />
              </div>
              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Region
                </label>
                <input
                  type="text"
                  id="region"
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="Enter region"
                />
              </div>
            </div>

            {/* Farming Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="farming_method" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Farming Method
                </label>
                <select
                  id="farming_method"
                  name="farming_method"
                  value={form.farming_method}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                >
                  <option value="traditional">Traditional</option>
                  <option value="modern">Modern</option>
                  <option value="organic">Organic</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label htmlFor="irrigation_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Irrigation Type
                </label>
                <select
                  id="irrigation_type"
                  name="irrigation_type"
                  value={form.irrigation_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                >
                  <option value="rainfed">Rainfed</option>
                  <option value="irrigated">Irrigated</option>
                  <option value="drip">Drip Irrigation</option>
                  <option value="sprinkler">Sprinkler</option>
                </select>
              </div>
              <div>
                <label htmlFor="soil_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Soil Type
                </label>
                <select
                  id="soil_type"
                  name="soil_type"
                  value={form.soil_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                >
                  <option value="alluvial">Alluvial</option>
                  <option value="black">Black Soil</option>
                  <option value="red">Red Soil</option>
                  <option value="sandy">Sandy</option>
                  <option value="clay">Clay</option>
                </select>
              </div>
            </div>

            {/* Crops and Contact */}
            <div>
              <label htmlFor="primary_crops" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Crops (comma-separated)
              </label>
              <input
                type="text"
                id="primary_crops"
                name="primary_crops"
                value={form.primary_crops.join(', ')}
                onChange={(e) => handleArrayChange('primary_crops', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                placeholder="e.g., Rice, Wheat, Cotton"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
              <div>
                <label htmlFor="emergency_contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="tel"
                  id="emergency_contact"
                  name="emergency_contact"
                  value={form.emergency_contact}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            {/* Certifications */}
            <div>
              <label htmlFor="certifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Certifications (comma-separated)
              </label>
              <input
                type="text"
                id="certifications"
                name="certifications"
                value={form.certifications.join(', ')}
                onChange={(e) => handleArrayChange('certifications', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                placeholder="e.g., Organic, Fair Trade, FSSAI"
              />
            </div>

            {/* Organic Certified */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="organic_certified"
                name="organic_certified"
                checked={form.organic_certified}
                onChange={handleChange}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="organic_certified" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Organic certified
              </label>
            </div>
            
            <button 
              type="submit" 
              disabled={saving} 
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Farmer Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FarmerProfile;
