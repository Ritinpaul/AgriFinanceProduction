import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import LoanApplication from '../components/LoanApplication';
import BatchManagement from '../components/BatchManagement';
import NFTManagement from '../components/NFTManagement';
import FarmerProfileSetup from '../components/FarmerProfileSetup';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const FarmerDashboard = () => {
  const { account, isConnected } = useWeb3();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [farmerData, setFarmerData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  // Debug flags for data availability (avoid referencing out-of-scope vars in render)
  const [hasFarmerProfile, setHasFarmerProfile] = useState(false);
  const [hasFarmerStats, setHasFarmerStats] = useState(false);
  const farmerDataFetchedRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchFarmerData();
    }
  }, [user]);

  const fetchFarmerData = async () => {
    // Prevent multiple simultaneous calls
    if (farmerDataFetchedRef.current) return;
    farmerDataFetchedRef.current = true;

    setLoading(true);
    try {
      // Ensure API client has the current token
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
      }

      console.log('Fetching farmer data with token:', token ? 'Present' : 'Missing');

      // Fetch user profile data
      const profileResult = await apiClient.getCurrentUser();
      const userProfile = profileResult.data?.user;

      // Fetch wallet data
      const walletResult = await apiClient.getWallet();
      const wallet = walletResult.data?.wallet;

      // Fetch farmer profile directly to check completion status
      const farmerProfileResult = await apiClient.getFarmerProfile();
      const farmerProfile = farmerProfileResult.data?.profile;
      setHasFarmerProfile(!!farmerProfile);

      // Fetch farmer statistics from database
      const farmerStatsResult = await apiClient.getFarmerStats();
      const farmerStats = farmerStatsResult.data?.stats;
      setHasFarmerStats(!!farmerStats);

      // Debug logging
      console.log('FarmerProfile API Result:', farmerProfileResult);
      console.log('FarmerProfile Data:', farmerProfile);
      console.log('FarmerStats API Result:', farmerStatsResult);
      console.log('FarmerStats Data:', farmerStats);
      console.log('API Client Token:', apiClient.token);
      console.log('User ID from Auth:', user?.id);

      // Combine all data - use farmer profile data as fallback if stats are not available
      const profileData = farmerProfile || farmerStats;
      const combinedData = {
        name: userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : userProfile?.email || 'Farmer',
        email: userProfile?.email,
        location: profileData?.region || 'Not specified',
        totalLoans: farmerStats?.total_loans || 0,
        activeLoans: farmerStats?.active_loans || 0,
        completedLoans: farmerStats?.completed_loans || 0,
        totalBatches: farmerStats?.total_batches || 0,
        verifiedBatches: farmerStats?.verified_batches || 0,
        totalArea: profileData?.land_area_acres || 0, // Use profile data as fallback
        nftLands: farmerStats?.land_nfts || 0,
        walletBalance: wallet?.balance_wei ? parseFloat(wallet.balance_wei) / 1000000 : 0, // Convert from wei to KRSI (6 decimals)
        walletAddress: wallet?.address || account,
        farmingExperience: profileData?.farming_experience_years || 0, // Use profile data as fallback
        primaryCrops: profileData?.primary_crops || [], // Use profile data as fallback
        recentActivity: [], // This would be populated from actual activity logs
        isProfileComplete: profileData?.profile_completed || false
      };

      setFarmerData(combinedData);
      setWalletData(wallet);

      // Check if profile needs completion - Use farmer profile data if available, fallback to stats
      console.log('Checking profile completion - profileData:', profileData);
      console.log('land_area_acres:', profileData?.land_area_acres);
      console.log('profile_completed:', profileData?.profile_completed);
      console.log('Raw farmerStatsResult:', JSON.stringify(farmerStatsResult, null, 2));
      console.log('Raw farmerProfileResult:', JSON.stringify(farmerProfileResult, null, 2));

      if (profileData && (
        (profileData.profile_completed === true) ||
        (profileData.land_area_acres && profileData.land_area_acres > 0)
      )) {
        console.log('Profile is complete - hiding form');
        setShowProfileSetup(false);
      } else {
        console.log('Profile needs completion - showing form');
        setShowProfileSetup(true);
      }
    } catch (error) {
      console.error('Error fetching farmer data:', error);
      toast.error('Failed to load farmer data');

      // Don't set fallback data that would interfere with profile completion logic
      // Just set basic user info and let the profile completion logic handle the rest
      setFarmerData({
        name: user?.email || 'Farmer',
        email: user?.email,
        location: 'Not specified',
        totalLoans: 0,
        activeLoans: 0,
        completedLoans: 0,
        totalBatches: 0,
        verifiedBatches: 0,
        totalArea: 0,
        nftLands: 0,
        walletBalance: 0,
        walletAddress: account,
        farmingExperience: 0,
        primaryCrops: [],
        recentActivity: []
      });

      // If there's an error, assume profile needs completion
      console.log('Error occurred - assuming profile needs completion');
      setShowProfileSetup(true);
    } finally {
      setLoading(false);
      // Reset the ref after 5 seconds to allow future calls
      setTimeout(() => {
        farmerDataFetchedRef.current = false;
      }, 5000);
    }
  };

  const handleProfileComplete = (profile) => {
    console.log('Profile completed, received profile:', profile);
    setShowProfileSetup(false);
    fetchFarmerData(); // Refresh data after profile completion
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'batches', label: 'Batches', icon: '📦' },
    { id: 'nft', label: 'Land NFTs', icon: '🧾' }
  ];

  if (!user) {
    return (
      <div className="text-center py-20">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-yellow-800 mb-4">
            Authentication Required
          </h2>
          <p className="text-yellow-700 mb-6">
            Please sign in to access the farmer dashboard.
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
      {/* Debug Panel removed for production cleanliness */}

      {/* Show Profile Setup if needed */}
      {showProfileSetup && (
        <div className="mb-6">
          <FarmerProfileSetup onComplete={handleProfileComplete} />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading farmer data...</p>
        </div>
      )}

      {/* Header */}
      <div className="agri-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              👨‍🌾 Farmer Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Welcome back, {farmerData?.name || 'Farmer'}!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {farmerData?.walletAddress ? (
                <>Wallet: {farmerData.walletAddress.slice(0, 6)}...{farmerData.walletAddress.slice(-4)}</>
              ) : (
                <>No wallet connected</>
              )}
            </p>
            {farmerData?.walletBalance !== undefined && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Balance: {farmerData.walletBalance.toFixed(4)} KRSI
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Farmer Profile
            </div>
            <button
              onClick={fetchFarmerData}
              disabled={loading}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              🔄 Refresh Data
            </button>
            <div className="text-xs text-gray-400 mt-1">
              {showProfileSetup ? 'Profile Incomplete' : 'Profile Complete'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stats-card">
          <div className="stats-number">{farmerData?.activeLoans || 0}</div>
          <div className="stats-label">Active Loans</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{farmerData?.totalBatches || 0}</div>
          <div className="stats-label">Total Batches</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{farmerData?.totalArea || 0} acres</div>
          <div className="stats-label">Total Land Area</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{farmerData?.nftLands || 0}</div>
          <div className="stats-label">Land NFTs</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="agri-card mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-6 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === tab.id
                  ? 'border-green-500 dark:border-green-400 text-green-600 dark:text-green-400'
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
          {activeTab === 'overview' && (
            <div>
              <h3 className="card-title mb-4">
                Recent Activity
              </h3>
              {farmerData?.recentActivity?.length > 0 ? (
                <div className="space-y-3">
                  {farmerData.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          {activity.type === 'loan' && '💰'}
                          {activity.type === 'batch' && '📦'}
                          {activity.type === 'nft' && '🧾'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                            {activity.type === 'loan' && `Loan of $${activity.amount}`}
                            {activity.type === 'batch' && `${activity.product} Batch (${activity.quantity} kg)`}
                            {activity.type === 'nft' && `Land NFT #${activity.tokenId} ${activity.action}`}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">{activity.date}</div>
                        </div>
                      </div>
                      <div className={`status-badge ${activity.status === 'active' ? 'status-active' :
                        activity.status === 'verified' ? 'status-verified' :
                          'status-pending'
                        }`}>
                        {activity.status || 'completed'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400 mb-4">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-lg font-medium">No Recent Activity</p>
                    <p className="text-sm">Complete your farmer profile to start tracking your agricultural activities.</p>
                  </div>
                  {!farmerData?.isProfileComplete && (
                    <button
                      onClick={() => setShowProfileSetup(true)}
                      className="agri-button"
                    >
                      Complete Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loans moved to Finance → Loans. Provide quick CTA here. */}
          {activeTab === 'overview' && (
            <div className="mt-6">
              <button
                onClick={() => window.location.href = '/loans'}
                className="agri-button"
              >
                Go to Loans
              </button>
            </div>
          )}
          {activeTab === 'batches' && <BatchManagement />}
          {activeTab === 'nft' && <NFTManagement />}
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;
