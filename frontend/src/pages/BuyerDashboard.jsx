import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const BuyerDashboard = () => {
  const { account, isConnected, inAppWallet } = useWeb3();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('browse');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const dashboardFetchedRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    // Prevent multiple simultaneous calls
    if (dashboardFetchedRef.current) return;
    dashboardFetchedRef.current = true;
    
    setLoading(true);
    try {
      // Ensure API client has the current token
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
      }

      // Fetch dashboard data
      const dashboardResult = await apiClient.request('/buyer/dashboard');
      if (dashboardResult.data && dashboardResult.data.success) {
        setDashboardData(dashboardResult.data.data);
      }
    } catch (error) {
      console.error('Error fetching buyer dashboard data:', error);
      toast.error('Failed to load buyer dashboard data');
    } finally {
      setLoading(false);
      // Reset the ref after 5 seconds to allow future calls
      setTimeout(() => {
        dashboardFetchedRef.current = false;
      }, 5000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'in-transit': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'processing': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'pending': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const tabs = [
    { id: 'browse', label: 'Browse Batches', icon: '🛒' },
    { id: 'purchases', label: 'My Purchases', icon: '📦' },
    { id: 'traceability', label: 'Traceability', icon: '🔍' }
  ];

  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            Authentication Required
          </h2>
          <p className="text-yellow-700 dark:text-yellow-300 mb-4 text-sm">
            Please sign in to access the buyer dashboard.
          </p>
          <button 
            onClick={() => window.location.href = '/signin'}
            className="agri-button"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="agri-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              🛒 Buyer Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Welcome back, Buyer!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Wallet: {(isConnected ? account : (inAppWallet ? inAppWallet.address : 'Not connected'))?.slice(0, 6)}...{(isConnected ? account : (inAppWallet ? inAppWallet.address : ''))?.slice(-4)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">
              {dashboardData?.stats?.totalPurchases || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Total Purchases</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stats-card">
          <div className="stats-number">{dashboardData?.stats?.availableBatches || 0}</div>
          <div className="stats-label">Available Batches</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{dashboardData?.stats?.totalPurchases || 0}</div>
          <div className="stats-label">My Purchases</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">
            {dashboardData?.stats?.totalSpent ? `${dashboardData.stats.totalSpent.toFixed(2)} KRSI` : '0 KRSI'}
          </div>
          <div className="stats-label">Total Spent</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{dashboardData?.stats?.verificationRate || 0}%</div>
          <div className="stats-label">Verified Products</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'browse' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                Available Batches
              </h3>
              
              <div className="space-y-4">
                {dashboardData?.availableBatches && dashboardData.availableBatches.length > 0 ? (
                  dashboardData.availableBatches.map((batch) => (
                    <div key={batch.id} className="agri-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
                            {batch.product_name} Batch #{batch.id.slice(-8)}
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400">
                            {batch.farmer_first_name && batch.farmer_last_name 
                              ? `${batch.farmer_first_name} ${batch.farmer_last_name}` 
                              : batch.farmer_email} • {batch.region}, {batch.state}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {batch.price_per_unit} {batch.currency}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {batch.quantity} {batch.unit}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Price per Unit</div>
                          <div className="font-medium text-gray-900 dark:text-white">{batch.price_per_unit} {batch.currency}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Available Quantity</div>
                          <div className="font-medium text-gray-900 dark:text-white">{batch.quantity} {batch.unit}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Certification</div>
                          <div className="font-medium text-gray-900 dark:text-white">{batch.organic_certified ? 'Organic' : 'Standard'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Location</div>
                          <div className="font-medium text-gray-900 dark:text-white">{batch.region}, {batch.state}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Product: {batch.product_description || 'No description available'}
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => window.location.href = `/marketplace`}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => window.location.href = `/marketplace`}
                            className="agri-button"
                          >
                            Purchase
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading available batches...' : 'No batches available for purchase.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                My Purchases
              </h3>
              
              <div className="space-y-4">
                {dashboardData?.purchases && dashboardData.purchases.length > 0 ? (
                  dashboardData.purchases.map((purchase) => (
                    <div key={purchase.id} className="agri-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
                            {purchase.product_name} Purchase #{purchase.id.slice(-8)}
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400">
                            Farmer: {purchase.farmer_first_name && purchase.farmer_last_name 
                              ? `${purchase.farmer_first_name} ${purchase.farmer_last_name}` 
                              : purchase.farmer_email}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                          {purchase.status?.toUpperCase() || 'PENDING'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Quantity</div>
                          <div className="font-medium text-gray-900 dark:text-white">{purchase.quantity} {purchase.unit}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Price per Unit</div>
                          <div className="font-medium text-gray-900 dark:text-white">{purchase.unit_price} {purchase.currency}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Total Value</div>
                          <div className="font-medium text-gray-900 dark:text-white">{purchase.total_amount} {purchase.currency}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Purchase Date</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Product: {purchase.product_description || 'No description available'}
                        </div>
                        <button
                          onClick={() => window.location.href = `/traceability`}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Track Package
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading your purchases...' : 'No purchases found. Start shopping to see your purchases here.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'traceability' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                Product Traceability
              </h3>
              
              <div className="agri-card p-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Scan QR Code for Traceability
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📱</div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Scan QR code to view complete product traceability</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Or Enter QR Code Hash</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter QR code hash"
                    />
                  </div>
                  <button className="agri-button">
                    View Traceability
                  </button>
                </div>
              </div>

              <div className="agri-card p-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Sample Traceability Report
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">Farm Location</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Punjab, India</div>
                    </div>
                    <div className="text-green-600 dark:text-green-400 font-medium">✓ Verified</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">Harvest Date</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">January 10, 2024</div>
                    </div>
                    <div className="text-green-600 dark:text-green-400 font-medium">✓ Verified</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">Certification</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Organic</div>
                    </div>
                    <div className="text-green-600 dark:text-green-400 font-medium">✓ Verified</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">Storage Conditions</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Temperature controlled</div>
                    </div>
                    <div className="text-green-600 dark:text-green-400 font-medium">✓ Verified</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
