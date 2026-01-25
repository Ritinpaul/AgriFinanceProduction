import React, { useState } from 'react';
import { WalletIcon, ShieldCheckIcon, KeyIcon } from '@heroicons/react/24/outline';

const WalletChoiceModal = ({ isOpen, onClose, onChooseWallet, userRole }) => {
  const [selectedChoice, setSelectedChoice] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedChoice) {
      onChooseWallet(selectedChoice);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-100 dark:text-gray-100">
              Choose Your Wallet
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-gray-400 dark:text-gray-400 mb-6">
            As a {userRole}, you can choose between using our secure in-app wallet or connecting your MetaMask wallet.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* In-App Wallet Option */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedChoice === 'inapp' 
                  ? 'border-blue-500 bg-blue-900/20' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setSelectedChoice('inapp')}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedChoice === 'inapp' ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  <ShieldCheckIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-100 dark:text-gray-100">
                    In-App Wallet
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                    Secure wallet managed by AgriFinance. No external wallet needed.
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Encrypted with WebCrypto API
                    </div>
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      No MetaMask installation required
                    </div>
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Gasless transactions supported
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MetaMask Wallet Option */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedChoice === 'metamask' 
                  ? 'border-orange-500 bg-orange-900/20' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setSelectedChoice('metamask')}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedChoice === 'metamask' ? 'bg-orange-600' : 'bg-gray-600'
                }`}>
                  <WalletIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-100 dark:text-gray-100">
                    MetaMask Wallet
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                    Connect your existing MetaMask wallet for full control.
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Full control of private keys
                    </div>
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Compatible with other dApps
                    </div>
                    <div className="flex items-center text-xs text-gray-300">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Hardware wallet support
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedChoice}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WalletChoiceModal;
