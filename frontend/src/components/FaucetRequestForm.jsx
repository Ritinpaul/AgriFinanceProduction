import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import FaucetRequest from './FaucetRequest';

/**
 * Enhanced Faucet Request Form with Provider Selection
 * Allows users to choose which faucet provider to use
 */
export default function FaucetRequestForm({ walletAddress, onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('self-hosted');
  const [requestResult, setRequestResult] = useState(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/providers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);

        // Add Automatic option (default)
        const automaticProvider = {
          id: 'automatic',
          name: 'Automatic (Recommended)',
          enabled: true,
          amount: data.providers?.find(p => p.id === 'self-hosted')?.amount || '0.002', // Estimate
          description: 'Try self-hosted faucet first, then fall back to external providers automatically.'
        };

        const allProviders = [automaticProvider, ...(data.providers || [])];
        setProviders(allProviders);
        setSelectedProvider('automatic');
      }
    } catch (error) {
      console.error('Error loading faucet providers:', error);
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

      const providerName = providers.find(p => p.id === selectedProvider)?.name || 'faucet';
      toast.loading(`Requesting from ${providerName}...`, { id: 'faucet' });

      // If automatic, send null so backend uses smart fallback logic
      const providerToSend = selectedProvider === 'automatic' ? null : selectedProvider;

      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/faucet/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: providerToSend
        })
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = result.error || 'Faucet request failed';

        if (errorMessage.includes('requires login') || errorMessage.includes('web interface')) {
          const provider = providers.find(p => p.id === selectedProvider);
          errorMessage += `. Please visit ${provider?.url || 'the faucet website'} directly.`;
        }

        throw new Error(errorMessage);
      }

      setRequestResult(result);
      toast.success(`Request submitted! ${result.txHash ? `TX: ${result.txHash.substring(0, 10)}...` : ''}`, { id: 'faucet', duration: 5000 });

      if (onSuccess) {
        onSuccess(result);
      }

      // Refresh balance after a delay
      setTimeout(() => {
        window.location.reload();
      }, 5000);
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

  const selectedProviderInfo = providers.find(p => p.id === selectedProvider);

  // If only self-hosted is available, use the simpler component
  if (providers.length === 1 && providers[0].id === 'self-hosted') {
    return <FaucetRequest walletAddress={walletAddress} onSuccess={onSuccess} />;
  }

  return (
    <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="text-blue-500">💧</span> Request Sepolia ETH
          </h3>

          {/* Provider Selection */}
          {providers.length > 1 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                Choose Faucet Provider:
              </label>
              <div className="relative">
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none appearance-none transition-all"
                  disabled={loading}
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id} disabled={!provider.enabled}>
                      {provider.name} {!provider.enabled ? '(Not Available)' : ''}
                      {provider.amount && ` - ${provider.amount} ETH`}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Provider Info */}
              {selectedProviderInfo && (
                <div className="mt-3 text-xs">
                  {selectedProviderInfo.id === 'automatic' && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Smart Routing
                      </div>
                      <div className="mt-1 text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
                        Trying internal faucet first (fastest), then external providers.
                      </div>
                    </div>
                  )}
                  {selectedProviderInfo.id === 'self-hosted' && selectedProviderInfo.balance && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                      <div className="font-semibold text-blue-800 dark:text-blue-400">Self-Hosted Faucet</div>
                      <div className="mt-1 text-blue-700/80 dark:text-blue-300/80 flex justify-between items-center">
                        <span>Balance: <span className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-900 dark:text-blue-200">{parseFloat(selectedProviderInfo.balance.balance).toFixed(4)} ETH</span></span>
                        <span>Amt: <strong>{selectedProviderInfo.amount}</strong></span>
                      </div>
                    </div>
                  )}
                  {selectedProviderInfo.id !== 'self-hosted' && selectedProviderInfo.id !== 'automatic' && (
                    <div className="text-slate-500 dark:text-slate-400">
                      {selectedProviderInfo.requiresLogin && '⚠️ May require login'}
                      {selectedProviderInfo.requiresApiKey && '⚠️ Requires API key configuration'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Recipient Wallet:</div>
            <div className="font-mono text-[11px] bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 truncate tracking-tight">
              {walletAddress}
            </div>
          </div>

          {requestResult?.success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
              <div className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="font-medium">Success!</span>
                  {requestResult.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${requestResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-700 dark:text-green-400 hover:text-green-600 hover:underline mt-1 block truncate max-w-[200px]"
                    >
                      TX: {requestResult.txHash}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {requestResult?.error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{requestResult.error}</span>
              </div>
            </div>
          )}

          <button
            onClick={requestFaucet}
            disabled={loading || !selectedProviderInfo?.enabled}
            className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm ${loading || !selectedProviderInfo?.enabled
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-md hover:shadow-blue-900/20 border border-transparent'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Request...
              </span>
            ) : (
              `Request ${selectedProviderInfo?.amount ? selectedProviderInfo.amount + ' ETH' : ''}`
            )}
          </button>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2.5 text-center flex items-center justify-center gap-1.5">
            <span>Powered by {selectedProviderInfo?.id === 'self-hosted' ? 'Internal Pool' : selectedProviderInfo?.name || 'AgriFinance'}</span>
            {selectedProviderInfo?.id === 'automatic' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
          </p>

          {/* Fallback links */}
          {requestResult?.error && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 text-xs text-center">
              <span className="text-slate-500 dark:text-slate-400">Emergency Links:</span>
              <div className="flex gap-3 justify-center mt-1">
                <a href="https://sepoliafaucet.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-500 transition-colors">
                  Alchemy
                </a>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <a href="https://faucet.chainstack.com/sepolia" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-500 transition-colors">
                  Chainstack
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

