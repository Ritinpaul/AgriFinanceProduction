import React from 'react';
import { useTheme } from '../context/ThemeContext';

const SupplyChain = () => {
  const { isDark } = useTheme();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          📦 Supply Chain Tracking
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your produce from farm to market with complete transparency
        </p>
      </div>

      {/* Supply Chain Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-8">
        <div className="p-6">
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Supply Chain Overview
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="agri-card p-6 text-center">
                <div className="text-4xl mb-4">🌱</div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  Farm to Fork
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Complete traceability from seed to consumer
                </p>
              </div>
              
              <div className="agri-card p-6 text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  Blockchain Security
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Immutable records ensure data integrity
                </p>
              </div>
              
              <div className="agri-card p-6 text-center">
                <div className="text-4xl mb-4">📱</div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  QR Code Access
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Instant access to product information
                </p>
              </div>
            </div>

            <div className="agri-card p-6">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                How It Works
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🌾</span>
                  </div>
                  <h5 className="font-semibold text-gray-800 dark:text-white mb-2">1. Harvest</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Farmer harvests and creates batch</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h5 className="font-semibold text-gray-800 dark:text-white mb-2">2. Verify</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Batch gets verified and certified</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🚚</span>
                  </div>
                  <h5 className="font-semibold text-gray-800 dark:text-white mb-2">3. Transport</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tracked through supply chain</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🛒</span>
                  </div>
                  <h5 className="font-semibold text-gray-800 dark:text-white mb-2">4. Purchase</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Buyer purchases verified product</p>
                </div>
              </div>
            </div>

            {/* Navigation Help */}
            <div className="agri-card p-6 bg-blue-50 dark:bg-blue-900/20">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                🚀 Quick Actions
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Use the navigation menu above to access specific supply chain features:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400">🔍</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white">Track Product</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Follow products through the supply chain</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400">✅</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white">Batch Verification</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Verify batch authenticity and quality</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplyChain;
