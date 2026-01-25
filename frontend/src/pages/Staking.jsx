// frontend/src/pages/Staking.jsx
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const Staking = () => {
  const { user } = useAuth();
  
  // Add safety check for Web3 context
  let web3Data = { account: null, isConnected: false, initializeWallet: () => {}, walletType: null };
  try {
    const web3 = useWeb3();
    web3Data = web3;
  } catch (error) {
    console.warn('Web3 context not available yet:', error.message);
  }
  
  const { account, isConnected, initializeWallet, walletType } = web3Data;
  const { userRole, getCurrentWalletPolicy } = useAccountAbstraction();

  const [positions, setPositions] = useState([]);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [lockDays, setLockDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stakingData, setStakingData] = useState(null);
  const [walletBalance, setWalletBalance] = useState('0');
  const [creditScore, setCreditScore] = useState(null);
  const [walletPolicy, setWalletPolicy] = useState(null);

  // Add loading state if Web3 context is not ready
  if (!web3Data.account && !web3Data.isConnected && user?.role) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing wallet...</p>
        </div>
      </div>
    );
  }

  // Initialize wallet based on user role
  useEffect(() => {
    if (user?.role && !isConnected) {
      const policy = getCurrentWalletPolicy(user.role);
      setWalletPolicy(policy);
      initializeWallet(user.role);
    }
  }, [user?.role, isConnected, initializeWallet, getCurrentWalletPolicy]);

  const loadStakingData = async () => {
    setLoading(true);
    try {
      // Load staking data from backend
      const result = await apiClient.getStakingData();
      
      if (result.data && result.data.success) {
        setStakingData(result.data);
        setPositions(result.data.stakes || []);
      } else {
        console.error('Failed to load staking data:', result.error);
        setPositions([]);
      }

      // Load wallet balance
      const walletResult = await apiClient.getWallet();
      if (walletResult.data && walletResult.data.wallet) {
        setWalletBalance(walletResult.data.wallet.balance_wei);
      }

      // Load credit score for enhanced staking terms
      if (account) {
        try {
          const scoreResp = await fetch('http://localhost:3001/api/ai/credit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAddress: account })
          });
          const scoreData = await scoreResp.json();
          if (scoreData && scoreData.score) {
            setCreditScore(scoreData.score);
          }
        } catch (err) {
          console.log('Credit score not available for staking');
        }
      }
    } catch (error) {
      console.error('Error loading staking data:', error);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && isConnected) {
      loadStakingData();
    }
  }, [user, isConnected, account]);

  const handleStake = async () => {
    if (!amount || amountError) return;
    
    setIsSubmitting(true);
    try {
      // Convert amount to wei
      const amountWei = ethers.parseUnits(amount, 6).toString();
      const lockPeriodSeconds = lockDays * 24 * 60 * 60;
      
      // Enhanced staking with credit score consideration
      const stakeData = {
        amount_wei: amountWei,
        lock_period_seconds: lockPeriodSeconds,
        credit_score: creditScore,
        wallet_type: walletType,
        user_role: user?.role
      };
      
      const result = await apiClient.stakeTokens(stakeData);

      if (result.data) {
        toast.success('Tokens staked successfully!');
        await loadStakingData();
        setAmount('');
        setAmountError('');
      } else {
        toast.error(result.error || 'Staking failed');
      }
    } catch (error) {
      console.error('Error staking:', error);
      toast.error('Staking failed: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnstake = async (stakeIndex) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.unstakeTokens({ stakeIndex });
      
      if (result.data) {
        toast.success('Tokens unstaked successfully!');
        await loadStakingData();
      } else {
        toast.error(result.error || 'Unstaking failed');
      }
    } catch (error) {
      console.error('Error unstaking:', error);
      toast.error('Unstaking failed: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimRewards = async () => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.claimStakingRewards();
      
      if (result.data) {
        toast.success('Rewards claimed successfully!');
        await loadStakingData();
      } else {
        toast.error(result.error || 'Claiming rewards failed');
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error('Claiming rewards failed: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncWithBlockchain = async () => {
    try {
      const result = await apiClient.syncWithBlockchain();
      
      if (result.data) {
        toast.success('Wallet synced with blockchain!');
        await loadStakingData();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Sync failed: ' + error.message);
    }
  };

  const validateAmount = (value) => {
    if (!value) {
      setAmountError('');
      return false;
    }

    const amountWei = ethers.parseUnits(value, 6).toString();
    const currentBalance = BigInt(walletBalance);
    const stakeAmount = BigInt(amountWei);
    
    if (stakeAmount > currentBalance) {
      setAmountError(`Insufficient balance. You have ${ethers.formatUnits(BigInt(walletBalance || '0'), 6)} KRSI`);
      return false;
    }
    
    const minimumStake = BigInt('1000000'); // 1 KRSI with 6 decimals
    if (stakeAmount < minimumStake) {
      setAmountError('Minimum staking amount is 1 KRSI');
      return false;
    }
    
    setAmountError('');
    return true;
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    validateAmount(value);
  };

  const getAPYForPeriod = (days) => {
    const baseAPY = {
      30: 5,
      90: 8,
      180: 12,
      365: 15
    };
    
    // Enhanced APY based on credit score
    if (creditScore) {
      const creditMultiplier = Math.min(1 + (creditScore - 300) / 1000, 1.5); // Up to 50% bonus
      return (baseAPY[days] * creditMultiplier).toFixed(1);
    }
    
    return baseAPY[days];
  };

  const getScoreColor = (score) => {
    if (score >= 750) return 'text-green-400';
    if (score >= 650) return 'text-yellow-400';
    if (score >= 550) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    return 'Poor';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">
              Please sign in to access staking
            </h1>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">
              Please connect your wallet to access staking
            </h1>
            <p className="text-gray-400 mb-4">
              {walletPolicy?.description || 'Connect your wallet to start staking'}
            </p>
            <button
              onClick={() => initializeWallet(user.role)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            Staking Dashboard
          </h1>
          <p className="text-gray-400">
            Stake your KRSI tokens and earn rewards
          </p>
          
          {/* Sync Button */}
          <button
            onClick={handleSyncWithBlockchain}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center mx-auto"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync with Blockchain
          </button>
        </div>

        {/* Credit Score Display */}
        {creditScore && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Your Credit Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-400">Credit Score</p>
                <p className={`text-3xl font-bold ${getScoreColor(creditScore)}`}>{creditScore}</p>
                <p className="text-sm text-gray-300">({getScoreLabel(creditScore)})</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Staking Bonus</p>
                <p className="text-2xl font-bold text-green-400">
                  +{Math.min(((creditScore - 300) / 1000) * 50, 50).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-300">APY Enhancement</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Wallet Type</p>
                <p className="text-lg font-medium text-blue-400 capitalize">{walletType}</p>
                <p className="text-sm text-gray-300">Role: {user?.role}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stake Form */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Stake Tokens
            </h2>
            
            <div className="space-y-4">
              {/* Balance Display */}
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">
                    Available Balance:
                  </span>
                  <span className="text-lg font-bold text-green-400">
                    {ethers.formatUnits(BigInt(walletBalance || '0'), 6)} KRSI
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Amount (KRSI)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount to stake"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-700 text-white"
                />
                {amountError && (
                  <p className="text-red-400 text-sm mt-1">{amountError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Lock Period (Days)
                </label>
                <select
                  value={lockDays}
                  onChange={(e) => setLockDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-700 text-white"
                >
                  <option value={30}>30 days ({getAPYForPeriod(30)}% APY)</option>
                  <option value={90}>90 days ({getAPYForPeriod(90)}% APY)</option>
                  <option value={180}>180 days ({getAPYForPeriod(180)}% APY)</option>
                  <option value={365}>365 days ({getAPYForPeriod(365)}% APY)</option>
                </select>
              </div>

              <button
                onClick={handleStake}
                disabled={!amount || amountError || isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {isSubmitting ? 'Staking...' : 'Stake Tokens'}
              </button>

              <div className="text-center">
                <button
                  onClick={handleClaimRewards}
                  disabled={isSubmitting || !stakingData?.totalRewards || stakingData.totalRewards === '0'}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {isSubmitting ? 'Claiming...' : `Claim Rewards (${stakingData?.totalRewards && stakingData.totalRewards !== '0' && stakingData.totalRewards !== '0.00' ? stakingData.totalRewards : '0'} KRSI)`}
                </button>
              </div>
            </div>
          </div>

          {/* Positions */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Your Positions
            </h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading positions...</p>
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  No staking positions found
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position, index) => (
                  <div key={index} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-white">
                          {position.amount} KRSI
                        </p>
                        <p className="text-sm text-gray-400">
                          Lock Period: {Math.floor(Number(position.lockPeriod) / (24 * 60 * 60))} days
                        </p>
                        <p className="text-sm text-gray-400">
                          Started: {new Date(Number(position.startTime) * 1000).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-400">
                          APY: {position.apy || getAPYForPeriod(Math.floor(Number(position.lockPeriod) / (24 * 60 * 60)))}%
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        position.isActive 
                          ? 'bg-green-900 text-green-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {position.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => handleUnstake(index)}
                        disabled={isSubmitting || !position.isActive}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm py-1 px-3 rounded transition-colors duration-200"
                      >
                        Unstake
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Staking Information */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Staking Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-green-400 mb-2">Benefits</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Earn competitive APY on your KRSI tokens</li>
                <li>• Credit score bonus increases your rewards</li>
                <li>• Longer lock periods offer higher returns</li>
                <li>• Support the AgriFinance ecosystem</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-400 mb-2">Terms</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Minimum stake: 1 KRSI</li>
                <li>• Tokens are locked for the selected period</li>
                <li>• Rewards are calculated daily</li>
                <li>• Early unstaking may incur penalties</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staking;