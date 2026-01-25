import React, { useState } from 'react';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';

const GaslessTransaction = ({ contract, method, params = [], value = 0, onSuccess, onError }) => {
  const { 
    smartAccount, 
    smartAccountAddress,
    sendGaslessTransaction,
    sendBatchTransactions,
    estimateGas,
    isLoading,
    error,
    clearError
  } = useAccountAbstraction();
  
  const { contracts } = useWeb3();
  const [gasEstimate, setGasEstimate] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleEstimateGas = async () => {
    if (!contract || !method) return;

    try {
      setIsEstimating(true);
      setError(null);

      // Encode the function call
      const contractInterface = new ethers.Interface(contract.abi);
      const data = contractInterface.encodeFunctionData(method, params);

      const transaction = {
        to: contract.address,
        data: data,
        value: value
      };

      const result = await estimateGas(transaction);
      if (result.success) {
        setGasEstimate(result.gasEstimate);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to estimate gas:', err);
      setError(err.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSendTransaction = async () => {
    if (!contract || !method) return;

    try {
      setError(null);
      setIsSuccess(false);
      setTxHash(null);

      // Encode the function call
      const contractInterface = new ethers.Interface(contract.abi);
      const data = contractInterface.encodeFunctionData(method, params);

      const transaction = {
        to: contract.address,
        data: data,
        value: value
      };

      const result = await sendGaslessTransaction(transaction);
      
      if (result.success) {
        setTxHash(result.txHash);
        setIsSuccess(true);
        if (onSuccess) onSuccess(result);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to send gasless transaction:', err);
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const handleSendBatchTransactions = async (transactions) => {
    try {
      setError(null);
      setIsSuccess(false);
      setTxHash(null);

      const encodedTransactions = transactions.map(tx => {
        const contractInterface = new ethers.Interface(tx.contract.abi);
        const data = contractInterface.encodeFunctionData(tx.method, tx.params);
        
        return {
          to: tx.contract.address,
          data: data,
          value: tx.value || 0
        };
      });

      const result = await sendBatchTransactions(encodedTransactions);
      
      if (result.success) {
        setTxHash(result.txHash);
        setIsSuccess(true);
        if (onSuccess) onSuccess(result);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to send batch gasless transactions:', err);
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const resetState = () => {
    setGasEstimate(null);
    setTxHash(null);
    setIsSuccess(false);
    setError(null);
  };

  if (!smartAccount) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Smart Account Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>You need to create a smart account first to use gasless transactions.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          ⛽ Gasless Transaction
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Smart Account Active</span>
        </div>
      </div>

      {/* Smart Account Info */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Smart Account Address</p>
            <p className="text-xs text-green-600 dark:text-green-400 font-mono">
              {smartAccountAddress ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}` : 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Gas Fees</p>
            <p className="text-xs text-green-600 dark:text-green-400">Sponsored</p>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      {contract && method && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transaction Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contract:</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {contract.address ? `${contract.address.slice(0, 6)}...${contract.address.slice(-4)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Method:</span>
              <span className="font-mono text-gray-900 dark:text-white">{method}</span>
            </div>
            {params.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Parameters:</span>
                <span className="text-gray-900 dark:text-white">{params.length} params</span>
              </div>
            )}
            {value > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Value:</span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {ethers.formatEther(value)} ETH
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gas Estimation */}
      <div className="mb-4">
        <button
          onClick={handleEstimateGas}
          disabled={isEstimating || !contract || !method}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
        >
          {isEstimating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Estimating...</span>
            </>
          ) : (
            <>
              <span>📊</span>
              <span>Estimate Gas</span>
            </>
          )}
        </button>

        {gasEstimate && (
          <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">Estimated Gas:</span> {gasEstimate.toString()}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Gas fees will be sponsored by Biconomy Paymaster
            </p>
          </div>
        )}
      </div>

      {/* Send Transaction */}
      <div className="mb-4">
        <button
          onClick={handleSendTransaction}
          disabled={isLoading || !contract || !method}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 w-full justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Sending Transaction...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Send Gasless Transaction</span>
            </>
          )}
        </button>
      </div>

      {/* Success State */}
      {isSuccess && txHash && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                Transaction Successful!
              </h3>
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                <p>Transaction Hash: <span className="font-mono">{txHash}</span></p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:underline"
                >
                  View on Etherscan →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={clearError}
                  className="text-sm bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-1 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      {(isSuccess || error) && (
        <div className="flex justify-center">
          <button
            onClick={resetState}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default GaslessTransaction;





