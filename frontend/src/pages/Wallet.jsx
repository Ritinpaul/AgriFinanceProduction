// frontend/src/pages/Wallet.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { DecimalUtils, AmountValidation } from '../utils/decimalUtils';
import MobileWalletUtils from '../utils/mobileWalletUtils';

const Wallet = () => {
  const { user } = useAuth();
  const { account, krishiTokenContract, isConnected } = useWeb3();

  const [walletAccount, setWalletAccount] = useState(null);
  const [inAppBalanceWei, setInAppBalanceWei] = useState('0');
  const [metaMaskBalanceWei, setMetaMaskBalanceWei] = useState('0');
  const [loading, setLoading] = useState(true);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  }, [user]);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // Simulate loading wallet data
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInAppBalanceWei('500000000000000000000'); // 500 KRSI in wei
      setMetaMaskBalanceWei('1000000000000000000000'); // 1000 KRSI in wei
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || !transferRecipient) return;
    
    setTransferLoading(true);
    try {
      // Simulate transfer
      await new Promise(resolve => setTimeout(resolve, 2000));
      loadWalletData();
    } catch (error) {
      console.error('Error transferring:', error);
    } finally {
      setTransferLoading(false);
    }
  };

  const inAppBalance = useMemo(() => {
    return DecimalUtils.formatAmount(inAppBalanceWei);
  }, [inAppBalanceWei]);

  const metaMaskBalance = useMemo(() => {
    return DecimalUtils.formatAmount(metaMaskBalanceWei);
  }, [metaMaskBalanceWei]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Please sign in to access your wallet
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Wallet Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your KRSI tokens and transactions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Balance Cards */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                In-App Wallet
              </h2>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {inAppBalance} KRSI
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Available for instant transfers
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                MetaMask Wallet
              </h2>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {metaMaskBalance} KRSI
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {isConnected ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
          </div>

          {/* Transfer Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Transfer Tokens
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (KRSI)
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Enter amount to transfer"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  placeholder="Enter recipient address"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                onClick={handleTransfer}
                disabled={!transferAmount || !transferRecipient || transferLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                {transferLoading ? 'Transferring...' : 'Transfer Tokens'}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading wallet data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;