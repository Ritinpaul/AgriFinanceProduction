import React, { useState, useEffect } from 'react';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { ethers } from 'ethers';
import WalletChoiceModal from './WalletChoiceModal';

const GaslessOnboarding = () => {
  const { 
    smartAccountAddress,
    createSmartAccount,
    sendGaslessTransaction,
    isLoading,
    error,
    clearError,
    userRole,
    walletChoice,
    getCurrentWalletPolicy
  } = useAccountAbstraction();
  
  const { 
    account, 
    connectWallet, 
    initializeWallet,
    walletType,
    isConnected,
    contracts 
  } = useWeb3();
  
  const { user } = useAuth();
  
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    role: 'farmer',
    location: '',
    phone: ''
  });
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [walletPolicy, setWalletPolicy] = useState(null);

  useEffect(() => {
    if (account && !smartAccountAddress) {
      // Auto-create smart account when wallet connects
      handleCreateSmartAccount();
    }
  }, [account]);

  // Initialize wallet based on user role
  useEffect(() => {
    const initializeUserWallet = async () => {
      if (user?.role && !isConnected) {
        const result = await initializeWallet(user.role);
        
        if (result.success && result.needsChoice) {
          setWalletPolicy(result.policy);
          setShowWalletChoice(true);
        }
      }
    };

    initializeUserWallet();
  }, [user?.role, isConnected, initializeWallet]);

  const handleWalletChoice = async (choice) => {
    try {
      if (choice === 'inapp') {
        await initializeWallet('buyer'); // Force in-app wallet
      } else {
        await initializeWallet('buyer'); // Force MetaMask wallet
      }
      setShowWalletChoice(false);
    } catch (error) {
      console.error('Wallet choice error:', error);
    }
  };

  const handleCreateSmartAccount = async () => {
    // For farmers, skip smart account creation entirely
    if (user?.role === 'farmer') {
      console.log('👨‍🌾 Farmer detected - skipping smart account creation');
      setOnboardingStep(2); // Go directly to profile setup
      return;
    }

    if (!account) {
      // Use role-aware wallet initialization for non-farmers
      if (user?.role) {
        const result = await initializeWallet(user.role);
        if (result.success && result.needsChoice) {
          setWalletPolicy(result.policy);
          setShowWalletChoice(true);
          return;
        }
      } else {
        await connectWallet();
      }
      return;
    }

    const result = await createSmartAccount(account);
    if (result.success) {
      setOnboardingStep(2);
    }
  };

  const handleProfileChange = (field, value) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompleteProfile = () => {
    const requiredFields = ['name', 'email', 'role', 'location'];
    const isComplete = requiredFields.every(field => userProfile[field].trim() !== '');
    setIsProfileComplete(isComplete);
    
    if (isComplete) {
      // For farmers, skip NFT minting and go directly to completion
      if (user?.role === 'farmer') {
        setOnboardingStep(5); // Go to completion step
      } else {
        setOnboardingStep(3); // Go to NFT minting
      }
    }
  };

  const handleMintLandNFT = async () => {
    if (!contracts.landNFTv2) return;

    try {
      const landId = `land_${Date.now()}`;
      const location = userProfile.location;
      const area = Math.floor(Math.random() * 100) + 10; // Random area between 10-110 acres
      const coordinates = `${Math.random() * 180 - 90},${Math.random() * 360 - 180}`;
      const documentHash = ethers.keccak256(ethers.toUtf8Bytes(`${landId}_${location}_${Date.now()}`));
      const metadataURI = `https://api.agrifinance.com/metadata/land/${landId}`;

      const result = await sendGaslessTransaction({
        contract: contracts.landNFTv2,
        method: 'mintLand',
        params: [account, landId, location, area, coordinates, documentHash, metadataURI]
      });

      if (result.success) {
        setOnboardingStep(4);
      }
    } catch (err) {
      console.error('Failed to mint land NFT:', err);
    }
  };

  const handleCreateFirstBatch = async () => {
    if (!contracts.supplyChain) return;

    try {
      const batchId = `batch_${Date.now()}`;
      const productType = 'Wheat';
      const quantity = Math.floor(Math.random() * 1000) + 100;
      const qrHash = ethers.keccak256(ethers.toUtf8Bytes(`${batchId}_${Date.now()}`));

      const result = await sendGaslessTransaction({
        contract: contracts.supplyChain,
        method: 'createBatch',
        params: [batchId, productType, quantity, qrHash]
      });

      if (result.success) {
        setOnboardingStep(5);
      }
    } catch (err) {
      console.error('Failed to create batch:', err);
    }
  };

  const handleCompleteOnboarding = () => {
    // Store onboarding completion
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.setItem('user_profile', JSON.stringify(userProfile));
    
    // Redirect based on user role
    if (user?.role === 'farmer') {
      window.location.href = '/farmer-dashboard';
    } else {
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* Wallet Choice Modal */}
      <WalletChoiceModal
        isOpen={showWalletChoice}
        onClose={() => setShowWalletChoice(false)}
        onChooseWallet={handleWalletChoice}
        userRole={user?.role}
      />
      
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🌱 Welcome to AgriFinance
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Let's set up your gasless smart account and get you started
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  onboardingStep >= step 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 5 && (
                  <div className={`w-16 h-1 mx-2 ${
                    onboardingStep > step ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{user?.role === 'farmer' ? 'Welcome' : 'Connect'}</span>
            <span>Profile</span>
            <span>{user?.role === 'farmer' ? 'Setup' : 'Land NFT'}</span>
            <span>{user?.role === 'farmer' ? 'Ready' : 'First Batch'}</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300/80">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={clearError}
                    className="text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-200 px-3 py-1 rounded"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Connect Wallet */}
        {onboardingStep === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-6">
                <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {user?.role === 'farmer' ? 'Welcome, Farmer!' : 'Connect Your Wallet'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                {user?.role === 'farmer' 
                  ? 'Your AgriFinance in-app wallet is ready! Let\'s set up your profile and get started.'
                  : 'Connect your wallet to create a smart account and start using gasless transactions'
                }
              </p>
              
              <button
                onClick={handleCreateSmartAccount}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center space-x-3 mx-auto"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>{user?.role === 'farmer' ? '🌱' : '🔗'}</span>
                    <span>
                      {user?.role === 'farmer' 
                        ? 'Continue to Profile Setup' 
                        : 'Connect Wallet & Create Smart Account'
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Complete Profile */}
        {onboardingStep === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-6">
                <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {user?.role === 'farmer' ? 'Complete Your Farmer Profile' : 'Complete Your Profile'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {user?.role === 'farmer' 
                  ? 'Tell us about your farming operation to get personalized AgriFinance features'
                  : 'Tell us about yourself to personalize your AgriFinance experience'
                }
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role *
                </label>
                <select
                  value={userProfile.role}
                  onChange={(e) => handleProfileChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="farmer">Farmer</option>
                  <option value="buyer">Buyer</option>
                  <option value="lender">Lender</option>
                  <option value="processor">Processor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={userProfile.location}
                  onChange={(e) => handleProfileChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="City, State, Country"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={userProfile.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={handleCompleteProfile}
                disabled={!isProfileComplete}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold"
              >
                {isProfileComplete ? 'Continue' : 'Complete Required Fields'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Mint Land NFT */}
        {onboardingStep === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900 mb-6">
                <svg className="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Mint Your Land NFT
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Create your first land NFT to represent your agricultural property. This will be minted gaslessly!
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-4">Land Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-purple-700 dark:text-purple-300">Location:</span>
                  <span className="ml-2 text-purple-900 dark:text-purple-100">{userProfile.location}</span>
                </div>
                <div>
                  <span className="text-purple-700 dark:text-purple-300">Area:</span>
                  <span className="ml-2 text-purple-900 dark:text-purple-100">Random (10-110 acres)</span>
                </div>
                <div>
                  <span className="text-purple-700 dark:text-purple-300">Coordinates:</span>
                  <span className="ml-2 text-purple-900 dark:text-purple-100">Auto-generated</span>
                </div>
                <div>
                  <span className="text-purple-700 dark:text-purple-300">Gas Fee:</span>
                  <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">FREE</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleMintLandNFT}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Minting...</span>
                  </>
                ) : (
                  <>
                    <span>🏞️</span>
                    <span>Mint Land NFT (Gasless)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Create First Batch */}
        {onboardingStep === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900 mb-6">
                <svg className="h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Create Your First Batch
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Create your first product batch to start tracking your agricultural products
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-4">Batch Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-orange-700 dark:text-orange-300">Product:</span>
                  <span className="ml-2 text-orange-900 dark:text-orange-100">Wheat</span>
                </div>
                <div>
                  <span className="text-orange-700 dark:text-orange-300">Quantity:</span>
                  <span className="ml-2 text-orange-900 dark:text-orange-100">Random (100-1100 kg)</span>
                </div>
                <div>
                  <span className="text-orange-700 dark:text-orange-300">QR Code:</span>
                  <span className="ml-2 text-orange-900 dark:text-orange-100">Auto-generated</span>
                </div>
                <div>
                  <span className="text-orange-700 dark:text-orange-300">Gas Fee:</span>
                  <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">FREE</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCreateFirstBatch}
                disabled={isLoading}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>📦</span>
                    <span>Create First Batch (Gasless)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {onboardingStep === 5 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-6">
                <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {user?.role === 'farmer' ? '🎉 Welcome to AgriFinance!' : '🎉 Onboarding Complete!'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                {user?.role === 'farmer' 
                  ? 'Your farmer profile is set up and your AgriFinance wallet is ready to use!'
                  : 'You\'re all set! Your smart account is ready and you\'ve completed your first gasless transactions.'
                }
              </p>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-green-900 dark:text-green-200 mb-4">What You've Accomplished</h3>
                <div className="space-y-3 text-sm text-left">
                  {user?.role === 'farmer' ? (
                    <>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Set up your farmer profile</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">AgriFinance wallet is ready</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Ready to start farming operations</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Created gasless smart account</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Completed your profile</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Minted your first land NFT</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">Created your first product batch</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 dark:text-green-200">All transactions were gasless!</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleCompleteOnboarding}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold text-lg"
                >
                  {user?.role === 'farmer' ? '🌱 Go to Farmer Dashboard' : '🚀 Go to Dashboard'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GaslessOnboarding;

