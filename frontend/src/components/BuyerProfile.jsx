// frontend/src/components/BuyerProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const BuyerProfile = () => {
  const { user, updateProfile, loading } = useAuth();
  const [form, setForm] = useState({
    buyer_type: 'individual', // 'individual' or 'enterprise'
    business_name: '',
    business_type: 'retailer',
    business_license: '',
    preferred_crops: [],
    preferred_regions: [],
    quality_requirements: [],
    organic_preference: false,
    max_order_quantity: '',
    min_order_quantity: '',
    payment_terms: 'immediate',
    delivery_preferences: [],
    certification_requirements: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      // Load buyer profile data if available
      fetchBuyerProfile();
    }
  }, [user]);

  const fetchBuyerProfile = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/buyer/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.profile) {
        setForm({
          buyer_type: data.profile.buyer_type || 'individual',
          business_name: data.profile.business_name || '',
          business_type: data.profile.business_type || 'retailer',
          business_license: data.profile.business_license || '',
          preferred_crops: data.profile.preferred_crops || [],
          preferred_regions: data.profile.preferred_regions || [],
          quality_requirements: data.profile.quality_requirements || [],
          organic_preference: data.profile.organic_preference || false,
          max_order_quantity: data.profile.max_order_quantity || '',
          min_order_quantity: data.profile.min_order_quantity || '',
          payment_terms: data.profile.payment_terms || 'immediate',
          delivery_preferences: data.profile.delivery_preferences || [],
          certification_requirements: data.profile.certification_requirements || []
        });
      }
    } catch (error) {
      console.error('Error fetching buyer profile:', error);
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
      const response = await fetch('http://localhost:3001/api/buyer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Buyer profile updated successfully!');
      } else {
        toast.error('Failed to update buyer profile');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">🛒</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Buyer Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your buyer profile to access marketplace features
            </p>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            {/* Buyer Type Selection */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <label htmlFor="buyer_type" className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                Buyer Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="individual"
                    name="buyer_type"
                    value="individual"
                    checked={form.buyer_type === 'individual'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="individual" className="ml-3 block text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">Individual Buyer</span>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Personal grocery shopping</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="enterprise"
                    name="buyer_type"
                    value="enterprise"
                    checked={form.buyer_type === 'enterprise'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="enterprise" className="ml-3 block text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">Enterprise Buyer</span>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Business bulk purchasing</p>
                  </label>
                </div>
              </div>
            </div>

            {/* Business Information - Only show for Enterprise */}
            {form.buyer_type === 'enterprise' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="business_name"
                      name="business_name"
                      value={form.business_name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                      placeholder="Enter your business name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="business_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Business Type
                    </label>
                    <select
                      id="business_type"
                      name="business_type"
                      value={form.business_type}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                      required
                    >
                      <option value="retailer">Retailer</option>
                      <option value="wholesaler">Wholesaler</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="processor">Processor</option>
                      <option value="exporter">Exporter</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="business_license" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Business License Number
                  </label>
                  <input
                    type="text"
                    id="business_license"
                    name="business_license"
                    value={form.business_license}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    placeholder="Enter your business license number"
                  />
                </div>
              </>
            )}

            {/* Order Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="min_order_quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {form.buyer_type === 'individual' ? 'Minimum Order Quantity (kg)' : 'Minimum Order Quantity (kg)'}
                </label>
                <input
                  type="number"
                  id="min_order_quantity"
                  name="min_order_quantity"
                  value={form.min_order_quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder={form.buyer_type === 'individual' ? 'e.g., 1' : 'e.g., 100'}
                />
              </div>
              <div>
                <label htmlFor="max_order_quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {form.buyer_type === 'individual' ? 'Maximum Order Quantity (kg)' : 'Maximum Order Quantity (kg)'}
                </label>
                <input
                  type="number"
                  id="max_order_quantity"
                  name="max_order_quantity"
                  value={form.max_order_quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder={form.buyer_type === 'individual' ? 'e.g., 10' : 'e.g., 1000'}
                />
              </div>
            </div>

            {/* Preferences */}
            <div>
              <label htmlFor="preferred_crops" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Crops (comma-separated)
              </label>
              <input
                type="text"
                id="preferred_crops"
                name="preferred_crops"
                value={form.preferred_crops.join(', ')}
                onChange={(e) => handleArrayChange('preferred_crops', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="e.g., Rice, Wheat, Cotton"
              />
            </div>

            <div>
              <label htmlFor="preferred_regions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Regions (comma-separated)
              </label>
              <input
                type="text"
                id="preferred_regions"
                name="preferred_regions"
                value={form.preferred_regions.join(', ')}
                onChange={(e) => handleArrayChange('preferred_regions', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="e.g., Punjab, Maharashtra, Gujarat"
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label htmlFor="payment_terms" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Terms
              </label>
              <select
                id="payment_terms"
                name="payment_terms"
                value={form.payment_terms}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <option value="immediate">Immediate Payment</option>
                <option value="net_30">Net 30 Days</option>
                <option value="net_60">Net 60 Days</option>
              </select>
            </div>

            {/* Organic Preference */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="organic_preference"
                name="organic_preference"
                checked={form.organic_preference}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="organic_preference" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Prefer organic products
              </label>
            </div>
            
            <button 
              type="submit" 
              disabled={saving} 
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Buyer Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BuyerProfile;
