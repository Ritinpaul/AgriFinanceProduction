import React, { useEffect, useState } from 'react';
import { MdCheckCircle, MdError, MdHourglassEmpty, MdOpenInNew } from 'react-icons/md';

/**
 * TransactionStatus Component
 * Shows transaction status (pending → confirmed → error) with Etherscan link
 * Auto-refreshes when transaction is confirmed
 */
const TransactionStatus = ({ txHash, status, type, onConfirmed, network = 'sepolia' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse after 10 seconds if confirmed
  useEffect(() => {
    if (status === 'confirmed') {
      const timer = setTimeout(() => {
        setIsExpanded(false);
        if (onConfirmed) {
          onConfirmed();
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status, onConfirmed]);

  if (!txHash && status !== 'error') {
    return null;
  }

  const explorerBase = network === 'sepolia'
    ? 'https://sepolia.etherscan.io'
    : 'https://etherscan.io';

  const explorerUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <MdHourglassEmpty className="animate-spin" />,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-500',
          text: 'Transaction pending...',
          description: 'Waiting for blockchain confirmation'
        };
      case 'confirmed':
        return {
          icon: <MdCheckCircle />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-500',
          text: 'Transaction confirmed!',
          description: 'Transaction has been confirmed on the blockchain'
        };
      case 'error':
        return {
          icon: <MdError />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-500',
          text: 'Transaction failed',
          description: 'The transaction could not be completed'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const getTypeLabel = () => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'withdraw': return 'Withdrawal';
      case 'create': return 'Loan Creation';
      case 'repay': return 'Loan Repayment';
      default: return 'Transaction';
    }
  };



  return (
    <div className={`${config.bgColor} border-l-4 ${config.borderColor} rounded-lg p-4 mb-4 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`${config.color} text-xl mt-0.5`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`${config.color} font-semibold text-sm mb-1`}>
              {config.text}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {config.description}
            </div>
            {type && (
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                Type: {getTypeLabel()}
              </div>
            )}
            {txHash && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  TX: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
                </span>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${config.color} hover:underline inline-flex items-center gap-1 text-xs`}
                  >
                    View on Etherscan
                    <MdOpenInNew className="text-xs" />
                  </a>
                )}
              </div>
            )}
            {status === 'error' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mt-2 underline"
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
            )}
          </div>
        </div>
        {status === 'confirmed' && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default TransactionStatus;

