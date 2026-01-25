import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import { useBlockchainSync } from '../utils/blockchainSync';

const TransactionHistory = () => {
  const { user } = useAuth();
  
  // Add safety check for Web3 context
  let web3Data = { provider: null, isConnected: false, initializeWallet: () => {}, walletType: null };
  try {
    const web3 = useWeb3();
    web3Data = web3;
  } catch (error) {
    console.warn('Web3 context not available yet:', error.message);
  }
  
  const { provider, isConnected, initializeWallet, walletType } = web3Data;
  const { userRole, getCurrentWalletPolicy } = useAccountAbstraction();
  const blockchainSync = useBlockchainSync(provider, {});
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Initialize wallet based on user role
  useEffect(() => {
    if (user?.role && !isConnected) {
      initializeWallet(user.role);
    }
  }, [user?.role, isConnected, initializeWallet]);

  useEffect(() => {
    if (user?.id) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/transactions/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.transactions) {
        setTransactions(result.transactions);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const syncTransactions = async () => {
    setSyncing(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      // Trigger indexer scan if available
      try {
        await fetch(`${API_BASE_URL}/indexer/scan-loanvault`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (e) {
        console.warn('Could not trigger indexer:', e);
      }
      await loadTransactions();
    } catch (error) {
      console.error('Error syncing transactions:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (!isConnected) {
    const walletPolicy = getCurrentWalletPolicy(user?.role);
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Transaction History</h2>
            <p className="text-gray-400 mb-4">Please connect your wallet to view transaction history.</p>
            <p className="text-sm text-gray-500 mb-4">
              {walletPolicy?.description || 'Connect your wallet to access transaction history'}
            </p>
            <button
              onClick={() => initializeWallet(user?.role)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group transactions by type
  const transactionsByType = {
    all: transactions,
    liquidity_deposit: transactions.filter(tx => tx.type === 'liquidity_deposit'),
    liquidity_withdrawal: transactions.filter(tx => tx.type === 'liquidity_withdrawal'),
    loan_created: transactions.filter(tx => tx.type === 'loan_created'),
    loan_repaid: transactions.filter(tx => tx.type === 'loan_repaid'),
    general: transactions.filter(tx => !['liquidity_deposit', 'liquidity_withdrawal', 'loan_created', 'loan_repaid'].includes(tx.type))
  };

  const filteredTransactions = transactionsByType[selectedCategory] || [];

  const getTypeIcon = (type) => {
    switch(type) {
      case 'liquidity_deposit':
        return '💰';
      case 'liquidity_withdrawal':
        return '💸';
      case 'loan_created':
        return '📝';
      case 'loan_repaid':
        return '✅';
      default:
        return '🔗';
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'liquidity_deposit':
        return 'bg-green-500/10 border-green-500/30';
      case 'liquidity_withdrawal':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'loan_created':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'loan_repaid':
        return 'bg-purple-500/10 border-purple-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Transaction History</h2>
            <p className="text-gray-600 dark:text-gray-400">View all your blockchain transactions</p>
          </div>
          <button 
            onClick={syncTransactions}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition"
          >
            {syncing ? 'Syncing...' : 'Sync with Blockchain'}
          </button>
        </div>

        {/* Category Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Transactions', count: transactions.length },
            { key: 'liquidity_deposit', label: 'Deposits', count: transactionsByType.liquidity_deposit.length },
            { key: 'liquidity_withdrawal', label: 'Withdrawals', count: transactionsByType.liquidity_withdrawal.length },
            { key: 'loan_created', label: 'Loans Created', count: transactionsByType.loan_created.length },
            { key: 'loan_repaid', label: 'Loans Repaid', count: transactionsByType.loan_repaid.length },
            { key: 'general', label: 'Other', count: transactionsByType.general.length }
          ].map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                selectedCategory === cat.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Cards by Category */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-600 dark:text-gray-400">
          Loading transactions...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-600 dark:text-gray-400">
          No transactions found{selectedCategory !== 'all' ? ` in this category` : ''}
        </div>
      ) : (
        <>
          {/* Liquidity Deposits Card */}
          {selectedCategory === 'all' && transactionsByType.liquidity_deposit.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <span>💰</span> Liquidity Deposits ({transactionsByType.liquidity_deposit.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transactionsByType.liquidity_deposit.slice(0, 6).map((tx) => (
                  <div key={tx.id} className={`p-4 rounded-lg border ${getTypeColor(tx.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tx.typeLabel}
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                        +{tx.formattedAmount} {tx.token_symbol}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    {tx.blockExplorerUrl && (
                      <a
                        href={tx.blockExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {transactionsByType.liquidity_deposit.length > 6 && (
                <button className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all {transactionsByType.liquidity_deposit.length} deposits →
                </button>
              )}
            </div>
          )}

          {/* Liquidity Withdrawals Card */}
          {selectedCategory === 'all' && transactionsByType.liquidity_withdrawal.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <span>💸</span> Liquidity Withdrawals ({transactionsByType.liquidity_withdrawal.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transactionsByType.liquidity_withdrawal.slice(0, 6).map((tx) => (
                  <div key={tx.id} className={`p-4 rounded-lg border ${getTypeColor(tx.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tx.typeLabel}
                      </span>
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">
                        -{tx.formattedAmount} {tx.token_symbol}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    {tx.blockExplorerUrl && (
                      <a
                        href={tx.blockExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {transactionsByType.liquidity_withdrawal.length > 6 && (
                <button className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all {transactionsByType.liquidity_withdrawal.length} withdrawals →
                </button>
              )}
            </div>
          )}

          {/* Loan Creations Card */}
          {selectedCategory === 'all' && transactionsByType.loan_created.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <span>📝</span> Loans Created ({transactionsByType.loan_created.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transactionsByType.loan_created.slice(0, 6).map((tx) => (
                  <div key={tx.id} className={`p-4 rounded-lg border ${getTypeColor(tx.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tx.typeLabel}
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        {tx.formattedAmount} {tx.token_symbol}
                      </span>
                    </div>
                    {tx.metadata?.loanId && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Loan #{tx.metadata.loanId}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    {tx.blockExplorerUrl && (
                      <a
                        href={tx.blockExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {transactionsByType.loan_created.length > 6 && (
                <button className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all {transactionsByType.loan_created.length} loans →
                </button>
              )}
            </div>
          )}

          {/* Loan Repayments Card */}
          {selectedCategory === 'all' && transactionsByType.loan_repaid.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <span>✅</span> Loans Repaid ({transactionsByType.loan_repaid.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transactionsByType.loan_repaid.slice(0, 6).map((tx) => (
                  <div key={tx.id} className={`p-4 rounded-lg border ${getTypeColor(tx.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tx.typeLabel}
                      </span>
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                        {tx.formattedAmount} {tx.token_symbol}
                      </span>
                    </div>
                    {tx.metadata?.loanId && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Loan #{tx.metadata.loanId}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    {tx.blockExplorerUrl && (
                      <a
                        href={tx.blockExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {transactionsByType.loan_repaid.length > 6 && (
                <button className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all {transactionsByType.loan_repaid.length} repayments →
                </button>
              )}
            </div>
          )}

          {/* Filtered View (when a specific category is selected) */}
          {selectedCategory !== 'all' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className={`p-4 rounded-lg border ${getTypeColor(tx.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <span>{getTypeIcon(tx.type)}</span>
                        {tx.typeLabel}
                      </span>
                      <span className={`text-xs font-semibold ${
                        tx.type === 'liquidity_deposit' ? 'text-green-600 dark:text-green-400' :
                        tx.type === 'liquidity_withdrawal' ? 'text-yellow-600 dark:text-yellow-400' :
                        tx.type === 'loan_created' ? 'text-blue-600 dark:text-blue-400' :
                        tx.type === 'loan_repaid' ? 'text-purple-600 dark:text-purple-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {tx.type === 'liquidity_deposit' ? '+' : tx.type === 'liquidity_withdrawal' ? '-' : ''}
                        {tx.formattedAmount} {tx.token_symbol}
                      </span>
                    </div>
                    {tx.metadata?.loanId && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Loan #{tx.metadata.loanId}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tx.statusColor}`}>
                        {tx.status || 'confirmed'}
                      </span>
                    </div>
                    {tx.blockExplorerUrl && (
                      <a
                        href={tx.blockExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                      >
                        View on Etherscan →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransactionHistory;
