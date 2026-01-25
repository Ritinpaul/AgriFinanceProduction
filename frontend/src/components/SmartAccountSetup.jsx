import React, { useState, useEffect } from 'react';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { ethers } from 'ethers';
import WalletChoiceModal from './WalletChoiceModal';

const SmartAccountSetup = () => {
  const { 
    smartAccountAddress, 
    isDeployed, 
    balance, 
    isLoading, 
    error,
    createSmartAccount,
    updateBalance,
    isSupported,
    getStatus,
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
    isConnected 
  } = useWeb3();
  
  const { user } = useAuth();
  
  const [setupStep, setSetupStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [guardianAddresses, setGuardianAddresses] = useState(['']);
  const [status, setStatus] = useState(null);
  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [walletPolicy, setWalletPolicy] = useState(null);

  useEffect(() => {
    if (account) {
      setStatus(getStatus());
    }
  }, [account, getStatus]);

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
    if (!account) {
      // Use role-aware wallet initialization
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
      setSetupStep(2);
    }
  };

  const handleAddGuardian = () => {
    setGuardianAddresses([...guardianAddresses, '']);
  };

  const handleGuardianChange = (index, value) => {
    const newGuardians = [...guardianAddresses];
    newGuardians[index] = value;
    setGuardianAddresses(newGuardians);
  };

  const handleRemoveGuardian = (index) => {
    const newGuardians = guardianAddresses.filter((_, i) => i !== index);
    setGuardianAddresses(newGuardians);
  };

  const handleEnableRecovery = async () => {
    const validGuardians = guardianAddresses.filter(addr => addr.trim() !== '');
    const result = await enableSocialRecovery(recoveryEmail, validGuardians);
    if (result.success) {
      setSetupStep(3);
    }
  };

  const formatBalance = (balance) => {
    return parseFloat(balance).toFixed(4);
  };

  if (!isSupported()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Account Abstraction Not Supported
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Account Abstraction requires MetaMask or a compatible wallet. Please install MetaMask to continue.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Wallet Choice Modal */}
      <WalletChoiceModal
        isOpen={showWalletChoice}
        onClose={() => setShowWalletChoice(false)}
        onChooseWallet={handleWalletChoice}
        userRole={user?.role}
      />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            🚀 Smart Account Setup
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set up your gasless smart account for seamless AgriFinance experience
          </p>
        </div>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    setupStep >= step 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      setupStep > step ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Create Account</span>
              <span>Setup Recovery</span>
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

          {/* Step 1: Create Smart Account */}
          {setupStep === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-gray-900/40 border border-blue-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-gray-100 mb-4">
                  Step 1: Create Your Smart Account
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-semibold">1</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-blue-800 dark:text-gray-200 font-medium">Connect Your Wallet</p>
                      <p className="text-blue-600 dark:text-gray-400 text-sm">
                        {user?.role === 'farmer' 
                          ? 'Farmers use in-app wallet only'
                          : 'Connect your wallet to create your smart account'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-semibold">2</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-blue-800 dark:text-gray-200 font-medium">Generate Smart Account</p>
                      <p className="text-blue-600 dark:text-gray-400 text-sm">Create a smart account that can execute gasless transactions</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-semibold">3</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-blue-800 dark:text-gray-200 font-medium">Start Using Gasless Features</p>
                      <p className="text-blue-600 dark:text-gray-400 text-sm">Enjoy seamless transactions without gas fees</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleCreateSmartAccount}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀 Create Smart Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Setup Recovery */}
          {setupStep === 2 && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-4">
                  ✅ Smart Account Created Successfully!
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-green-800 dark:text-green-300 font-medium">Smart Account Address:</span>
                    <span className="text-green-600 dark:text-green-300 font-mono text-sm">
                      {smartAccountAddress ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-800 dark:text-green-300 font-medium">Deployed:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isDeployed ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                    }`}>
                      {isDeployed ? 'Yes' : 'Will deploy on first transaction'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-800 dark:text-green-300 font-medium">Balance:</span>
                    <span className="text-green-600 dark:text-green-300 font-mono">
                      {formatBalance(balance)} ETH
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-gray-900/40 border border-purple-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-gray-100 mb-4">
                  Step 2: Setup Social Recovery
                </h3>
                <p className="text-purple-700 dark:text-gray-300 mb-4">
                  Add recovery options to protect your smart account. You can recover access using your email and guardian addresses.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 dark:text-gray-300 mb-2">
                      Recovery Email
                    </label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="w-full px-3 py-2 border border-purple-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-800 dark:text-gray-300 mb-2">
                      Guardian Addresses
                    </label>
                    <p className="text-purple-600 dark:text-gray-400 text-sm mb-3">
                      Add trusted addresses that can help recover your account
                    </p>
                    {guardianAddresses.map((address, index) => (
                      <div key={index} className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => handleGuardianChange(index, e.target.value)}
                          placeholder="0x..."
                          className="flex-1 px-3 py-2 border border-purple-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                        />
                        {guardianAddresses.length > 1 && (
                          <button
                            onClick={() => handleRemoveGuardian(index)}
                            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-200 rounded-lg"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAddGuardian}
                      className="text-purple-600 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 text-sm font-medium"
                    >
                      + Add Guardian
                    </button>
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleEnableRecovery}
                    disabled={isLoading || !recoveryEmail.trim()}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold"
                  >
                    {isLoading ? 'Setting up...' : '🛡️ Enable Recovery'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {setupStep === 3 && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
                  🎉 Setup Complete!
                </h3>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  Your smart account is ready to use. You can now enjoy gasless transactions and enhanced security features.
                </p>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Account Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Smart Account:</span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {smartAccountAddress ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Recovery Email:</span>
                      <span className="text-gray-900 dark:text-gray-100">{recoveryEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Guardians:</span>
                      <span className="text-gray-900 dark:text-gray-100">{guardianAddresses.filter(addr => addr.trim() !== '').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Balance:</span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">{formatBalance(balance)} ETH</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setSetupStep(1)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Service Status */}
          {status && (
            <div className="mt-8 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Service Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Initialized:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    status.isInitialized ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                  }`}>
                    {status.isInitialized ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Smart Account:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    status.hasSmartAccount ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-200'
                  }`}>
                    {status.hasSmartAccount ? 'Created' : 'Not Created'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Bundler:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{status.bundlerUrl ? 'Connected' : 'Not Connected'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Paymaster:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{status.paymasterUrl ? 'Connected' : 'Not Connected'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartAccountSetup;

