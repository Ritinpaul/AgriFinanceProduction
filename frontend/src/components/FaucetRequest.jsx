import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

/**
 * Faucet Request Component
 * Allows users to request Sepolia ETH directly from the app
 */
export default function FaucetRequest({ walletAddress, onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { canRequest, timeUntilNextRequest, hoursUntilNextRequest }
  const [requestResult, setRequestResult] = useState(null);

  useEffect(() => {
    loadStatus();
  }, [walletAddress]);

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading faucet status:', error);
    }
  };

  const requestFaucet = async () => {
    if (!walletAddress) {
      toast.error('Wallet address not found');
      return;
    }

    setLoading(true);
    setRequestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in to request faucet');
        return;
      }

      toast.loading('Requesting Sepolia ETH from faucet...', { id: 'faucet' });

      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        // Provide helpful error message with fallback options
        let errorMessage = result.error || 'Faucet request failed';
        
        // Add helpful suggestions if API fails
        if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
          errorMessage += '. The faucet API may require configuration. Please use an external faucet.';
        } else if (errorMessage.includes('All faucet endpoints failed')) {
          errorMessage += ' Please try using an external faucet: https://sepoliafaucet.com/';
        }
        
        throw new Error(errorMessage);
      }

      setRequestResult(result);
      toast.success(`Faucet request submitted! ${result.txHash ? `TX: ${result.txHash.substring(0, 10)}...` : ''}`, { id: 'faucet', duration: 5000 });
      
      // Reload status to update rate limit
      await loadStatus();

      // Callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      // Refresh wallet balance after a delay
      setTimeout(() => {
        window.location.reload(); // Simple refresh, or trigger balance update
      }, 3000);
    } catch (error) {
      console.error('Faucet request error:', error);
      toast.error(error.message || 'Failed to request from faucet', { id: 'faucet' });
      setRequestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return null;
  }

  const canRequest = status?.canRequest !== false;
  const hoursLeft = status?.hoursUntilNextRequest || 0;

  return (
    <div className="mt-3 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            💧 Request Sepolia ETH
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {status?.selfHostedAvailable ? (
              <>
                Get free Sepolia ETH from our self-hosted faucet. 
                <span className="font-semibold text-blue-700 dark:text-blue-300"> Amount: ~0.002 ETH (enough for approval transaction)</span>
              </>
            ) : (
              <>
                Get free Sepolia ETH for gas fees directly in the app. Usually arrives within a few minutes.
              </>
            )}
          </p>

          {/* Show faucet balance if self-hosted */}
          {status?.selfHostedAvailable && status?.faucetBalance && (
            <div className="mb-3 p-2 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <div className="font-semibold">Self-Hosted Faucet Available</div>
                <div className="mt-1">
                  Balance: <span className="font-mono">{parseFloat(status.faucetBalance.balance).toFixed(4)} ETH</span>
                </div>
                {parseFloat(status.faucetBalance.balance) < 0.01 && (
                  <div className="mt-1 text-yellow-700 dark:text-yellow-300">
                    ⚠️ Low balance - please fund the faucet wallet
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mb-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your wallet:</div>
            <div className="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded border">
              {walletAddress}
            </div>
          </div>

          {requestResult?.success && (
            <div className="mb-3 p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
              <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Request submitted successfully!</span>
              </div>
              {requestResult.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${requestResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 dark:text-green-300 hover:underline mt-1 block"
                >
                  View transaction →
                </a>
              )}
            </div>
          )}

          {requestResult?.error && (
            <div className="mb-3 p-2 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
              <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{requestResult.error}</span>
              </div>
            </div>
          )}

          {!canRequest && hoursLeft > 0 && (
            <div className="mb-3 p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>You can request again in {hoursLeft} {hoursLeft === 1 ? 'hour' : 'hours'}</span>
              </div>
            </div>
          )}

          <button
            onClick={requestFaucet}
            disabled={loading || !canRequest}
            className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              loading || !canRequest
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Requesting...
              </span>
            ) : (
              'Request Sepolia ETH'
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Powered by Google Cloud Web3 Faucet
          </p>
          
          {/* Fallback links if faucet fails */}
          {requestResult?.error && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="mb-1">Alternative faucets:</div>
              <div className="flex gap-2 justify-center flex-wrap">
                <a href="https://sepoliafaucet.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  SepoliaFaucet.com
                </a>
                <span>•</span>
                <a href="https://faucet.quicknode.com/ethereum/sepolia" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  QuickNode
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

