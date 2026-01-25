// frontend/src/components/LenderProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LenderProfile = () => {
  const { user, updateProfile, loading } = useAuth();
  const [form, setForm] = useState({
    institution_name: '',
    institution_type: 'bank',
    license_number: '',
    max_loan_amount: '',
    min_loan_amount: '',
    preferred_interest_rate_min: '',
    preferred_interest_rate_max: '',
    preferred_loan_term_min: '',
    preferred_loan_term_max: '',
    risk_tolerance: 'medium',
    preferred_regions: [],
    preferred_crops: [],
    minimum_credit_score: '',
    collateral_required: true,
    kyc_verified: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      // Load lender profile data if available
      fetchLenderProfile();
    }
  }, [user]);

  const fetchLenderProfile = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/lender/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.profile) {
        setForm({
          institution_name: data.profile.institution_name || '',
          institution_type: data.profile.institution_type || 'bank',
          license_number: data.profile.license_number || '',
          max_loan_amount: data.profile.max_loan_amount || '',
          min_loan_amount: data.profile.min_loan_amount || '',
          preferred_interest_rate_min: data.profile.preferred_interest_rate_min || '',
          preferred_interest_rate_max: data.profile.preferred_interest_rate_max || '',
          preferred_loan_term_min: data.profile.preferred_loan_term_min || '',
          preferred_loan_term_max: data.profile.preferred_loan_term_max || '',
          risk_tolerance: data.profile.risk_tolerance || 'medium',
          preferred_regions: data.profile.preferred_regions || [],
          preferred_crops: data.profile.preferred_crops || [],
          minimum_credit_score: data.profile.minimum_credit_score || '',
          collateral_required: data.profile.collateral_required !== false,
          kyc_verified: data.profile.kyc_verified || false
        });
      }
    } catch (error) {
      console.error('Error fetching lender profile:', error);
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
      const response = await fetch('http://localhost:3001/api/lender/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Lender profile updated successfully!');
      } else {
        toast.error('Failed to update lender profile');
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-purple-600 rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">🏦</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Lender Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your lender profile to access lending features
            </p>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            {/* Institution Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="institution_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  id="institution_name"
                  name="institution_name"
                  value={form.institution_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="Enter institution name"
                  required
                />
              </div>
              <div>
                <label htmlFor="institution_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Institution Type
                </label>
                <select
                  id="institution_type"
                  name="institution_type"
                  value={form.institution_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  required
                >
                  <option value="bank">Bank</option>
                  <option value="credit_union">Credit Union</option>
                  <option value="individual">Individual</option>
                  <option value="microfinance">Microfinance</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="license_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                License Number
              </label>
              <input
                type="text"
                id="license_number"
                name="license_number"
                value={form.license_number}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                placeholder="Enter license number"
              />
            </div>

            {/* Loan Amounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="min_loan_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Loan Amount (₹)
                </label>
                <input
                  type="number"
                  id="min_loan_amount"
                  name="min_loan_amount"
                  value={form.min_loan_amount}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 50000"
                />
              </div>
              <div>
                <label htmlFor="max_loan_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Loan Amount (₹)
                </label>
                <input
                  type="number"
                  id="max_loan_amount"
                  name="max_loan_amount"
                  value={form.max_loan_amount}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 500000"
                />
              </div>
            </div>

            {/* Interest Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="preferred_interest_rate_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  id="preferred_interest_rate_min"
                  name="preferred_interest_rate_min"
                  value={form.preferred_interest_rate_min}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 8.5"
                />
              </div>
              <div>
                <label htmlFor="preferred_interest_rate_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  id="preferred_interest_rate_max"
                  name="preferred_interest_rate_max"
                  value={form.preferred_interest_rate_max}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 15.0"
                />
              </div>
            </div>

            {/* Loan Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="preferred_loan_term_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Loan Term (Days)
                </label>
                <input
                  type="number"
                  id="preferred_loan_term_min"
                  name="preferred_loan_term_min"
                  value={form.preferred_loan_term_min}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 90"
                />
              </div>
              <div>
                <label htmlFor="preferred_loan_term_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Loan Term (Days)
                </label>
                <input
                  type="number"
                  id="preferred_loan_term_max"
                  name="preferred_loan_term_max"
                  value={form.preferred_loan_term_max}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 365"
                />
              </div>
            </div>

            {/* Risk and Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="risk_tolerance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Risk Tolerance
                </label>
                <select
                  id="risk_tolerance"
                  name="risk_tolerance"
                  value={form.risk_tolerance}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label htmlFor="minimum_credit_score" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Credit Score
                </label>
                <input
                  type="number"
                  id="minimum_credit_score"
                  name="minimum_credit_score"
                  value={form.minimum_credit_score}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                  placeholder="e.g., 600"
                />
              </div>
            </div>

            {/* Preferences */}
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                placeholder="e.g., Punjab, Maharashtra, Gujarat"
              />
            </div>

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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200"
                placeholder="e.g., Rice, Wheat, Cotton"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="collateral_required"
                  name="collateral_required"
                  checked={form.collateral_required}
                  onChange={handleChange}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="collateral_required" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Collateral required
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="kyc_verified"
                  name="kyc_verified"
                  checked={form.kyc_verified}
                  onChange={handleChange}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="kyc_verified" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  KYC verified
                </label>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={saving} 
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Lender Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LenderProfile;
