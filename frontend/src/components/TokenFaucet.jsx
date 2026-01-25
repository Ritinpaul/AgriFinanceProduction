// frontend/src/components/TokenFaucet.jsx
import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import apiClient from '../lib/api';

const TokenFaucet = ({ className = "" }) => {
  const { account, contract, krishiTokenContract } = useWeb3();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inAppBalance, setInAppBalance] = useState('0');
  const [faucetStatus, setFaucetStatus] = useState({
    canClaim: true,
    nextClaimTime: null,
    hoursRemaining: 0,
    claimAmount: '2',
    totalClaims: 0,
    totalDistributed: '0'
  });

  useEffect(() => {
    if (user?.id) {
      loadInAppBalance();
      loadFaucetStatus();
    }
  }, [user]);

  const loadInAppBalance = async () => {
    try {
      const result = await apiClient.getWallet();
      if (result.data && result.data.wallet) {
        const balanceWei = result.data.wallet.balance_wei || '0';
        const balanceEther = ethers.formatUnits(balanceWei, 6);
        setInAppBalance(balanceEther);
      } else {
        setInAppBalance('0');
      }
    } catch (error) {
      console.error('Error loading in-app balance:', error);
      setInAppBalance('0');
    }
  };

  const loadFaucetStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/krsi/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setFaucetStatus(data);
      }
    } catch (error) {
      console.error('Error loading faucet status:', error);
    }
  };

  const claimTokens = async () => {
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/krsi/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to claim tokens');
      }

      toast.success(result.message || '2 KRSI tokens claimed successfully!');
      loadInAppBalance();
      loadFaucetStatus();
    } catch (error) {
      console.error('Error claiming tokens:', error);
      toast.error(error.message || 'Failed to claim tokens');
    } finally {
      setLoading(false);
    }
  };

  const timeUntilNextClaim = () => {
    if (faucetStatus.hoursRemaining <= 0) return '0';

    const hours = Math.floor(faucetStatus.hoursRemaining);
    const minutes = Math.floor((faucetStatus.hoursRemaining % 1) * 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          KRSI Token Faucet
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Get 2 free KRSI tokens every 24 hours
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Your Balance
          </h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {inAppBalance} KRSI
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Claim Statistics
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Claims:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{faucetStatus.totalClaims}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Received:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {ethers.formatUnits(faucetStatus.totalDistributed || '0', 6)} KRSI
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={claimTokens}
          disabled={loading || !faucetStatus.canClaim || !user?.id}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 shadow-md"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Claiming...
            </span>
          ) : (
            `Claim ${faucetStatus.claimAmount} KRSI`
          )}
        </button>

        {!faucetStatus.canClaim && (
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Next claim available in: {timeUntilNextClaim()}
            </p>
            {faucetStatus.nextClaimTime && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {new Date(faucetStatus.nextClaimTime).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {!user?.id && (
          <div className="text-center text-sm text-yellow-600 dark:text-yellow-400 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            Please sign in to use the token faucet
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenFaucet;