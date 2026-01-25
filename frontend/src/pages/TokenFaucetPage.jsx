import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import TokenFaucet from '../components/TokenFaucet';
import { toast } from 'react-hot-toast';

const TokenFaucetPage = () => {
  const { account, krishiTokenContract } = useWeb3();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [faucetStats, setFaucetStats] = useState({
    totalDistributed: '0', // wei
    totalUsers: 0,
    dailyLimit: (2n * 10n ** 18n).toString(), // 2 KRSI in wei
    remainingToday: (2n * 10n ** 18n).toString()
  });

  // Load faucet statistics (client-side aggregation fallback)
  useEffect(() => {
    loadFaucetStats();
  }, [krishiTokenContract]);

  const loadFaucetStats = async () => {
    try {
      // In a production setup, replace this with contract reads or a serverless API.
      // Client-side fallback: aggregate from localStorage history maintained by the faucet UI.
      const raw = localStorage.getItem('faucetClaimHistory');
      const history = raw ? JSON.parse(raw) : [];

      const uniqueUsers = new Set(history.map((h) => h.address));
      const totalDistributedWei = history.reduce((acc, h) => acc + BigInt(h.amount || '0'), 0n);

      // Remaining today: if user claimed within cooldown, 0 else dailyLimit
      const nowSec = Math.floor(Date.now() / 1000);
      const lastClaim = localStorage.getItem(`lastClaim_${account || ''}`);
      const claimedInWindow = lastClaim ? (nowSec - parseInt(lastClaim, 10) < 24 * 60 * 60) : false;
      const remainingWei = claimedInWindow ? 0n : 2n * 10n ** 18n;

      setFaucetStats({
        totalDistributed: totalDistributedWei.toString(),
        totalUsers: uniqueUsers.size,
        dailyLimit: (2n * 10n ** 18n).toString(),
        remainingToday: remainingWei.toString()
      });
    } catch (error) {
      console.error("Error loading faucet stats:", error);
    }
  };

  const formatTokenAmount = (amount) => {
    try {
      const wei = BigInt(amount || '0');
      const whole = wei / 10n ** 18n;
      const frac = wei % 10n ** 18n;
      const fracStr = (frac + 10n ** 18n).toString().slice(1).slice(0, 2);
      return `${whole.toString()}.${fracStr}`;
    } catch {
      return '0.00';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            KRSI Token Faucet
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Get free KRSI tokens to test the AgriFinance platform. Claim up to 2 KRSI tokens per day for testing purposes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Faucet */}
          <div>
            <TokenFaucet />
          </div>

          {/* Statistics & Info */}
          <div className="space-y-6">
            {/* Faucet Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Faucet Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Distributed</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatTokenAmount(faucetStats.totalDistributed)} KRSI
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Users</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {faucetStats.totalUsers}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Daily Limit</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatTokenAmount(faucetStats.dailyLimit)} KRSI
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Remaining Today</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatTokenAmount(faucetStats.remainingToday)} KRSI
                  </span>
                </div>
              </div>
            </div>

            {/* Network Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Network Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Network</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Polygon Amoy</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Chain ID</span>
                  <span className="font-semibold text-gray-900 dark:text-white">80002</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">RPC URL</span>
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
                    https://rpc-amoy.polygon.technology/
                  </span>
                </div>
              </div>
            </div>

            {/* Token Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                KRSI Token Info
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Symbol</span>
                  <span className="font-semibold text-gray-900 dark:text-white">KRSI</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Name</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Krishi Token</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Decimals</span>
                  <span className="font-semibold text-gray-900 dark:text-white">18</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Supply</span>
                  <span className="font-semibold text-gray-900 dark:text-white">100M KRSI</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => window.open('https://faucet.polygon.technology/', '_blank')}
                  className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Get MATIC for Gas
                </button>
                <button
                  onClick={() => window.open('https://amoy.polygonscan.com/', '_blank')}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  View on PolygonScan
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(krishiTokenContract?.target || '');
                    toast.success('Contract address copied!');
                  }}
                  className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Copy Contract Address
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            How to Use the Faucet
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">Step 1: Connect Wallet</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.role === 'farmer'
                  ? 'Farmers use in-app wallet only. Your AgriFinance wallet is already connected.'
                  : 'Connect your wallet to the Polygon Amoy testnet. Make sure you have some MATIC for gas fees.'
                }
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">Step 2: Claim Tokens</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click the "Claim" button to receive 2 KRSI tokens. You can claim once every 24 hours.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">Step 3: Add to Wallet</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.role === 'farmer'
                  ? 'Your KRSI tokens are automatically managed in your in-app wallet.'
                  : 'Click "Add to MetaMask" to add KRSI tokens to your wallet for easy viewing and management.'
                }
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">Step 4: Start Testing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use your KRSI tokens to test the AgriFinance platform features like loans, supply chain, and NFTs.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Important Disclaimer</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                KRSI tokens from this faucet are for testing purposes only and have no real value.
                They are distributed on the Polygon Amoy testnet and cannot be exchanged for real money or other cryptocurrencies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenFaucetPage;
