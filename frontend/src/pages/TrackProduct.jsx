import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import QRCodeScanner from '../components/QRCodeScanner';
import toast from 'react-hot-toast';

const TrackProduct = () => {
  const { account, isConnected } = useWeb3();
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const sampleTraceability = {
    batchId: 'BATCH-001',
    productType: 'Organic Wheat',
    farmer: 'Rajesh Kumar',
    farmerLocation: 'Punjab, India',
    farmerReputation: 95,
    harvestDate: '2024-01-10',
    certification: 'Organic Certified',
    quantity: 1000,
    pricePerUnit: 25,
    status: 'verified',
    qrHash: 'wheat_qr_hash_001',
    traceabilityUrl: 'http://localhost:5173/traceability/wheat_qr_hash_001',
    timeline: [
      { step: 'Planting', date: '2023-10-15', status: 'completed', location: 'Farm Field A1' },
      { step: 'Growing', date: '2023-11-20', status: 'completed', location: 'Farm Field A1' },
      { step: 'Harvesting', date: '2024-01-10', status: 'completed', location: 'Farm Field A1' },
      { step: 'Processing', date: '2024-01-12', status: 'completed', location: 'Processing Plant B2' },
      { step: 'Packaging', date: '2024-01-14', status: 'completed', location: 'Packaging Facility C3' },
      { step: 'Transportation', date: '2024-01-16', status: 'in-progress', location: 'Route to Distribution Center' },
      { step: 'Delivery', date: '2024-01-18', status: 'pending', location: 'Distribution Center D4' }
    ]
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      toast.error('Please enter a QR code hash or batch ID');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call - in real implementation, this would call the backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, show sample data if search matches
      if (searchInput.toLowerCase().includes('batch') || searchInput.toLowerCase().includes('wheat')) {
        setTrackingData(sampleTraceability);
        toast.success('Product tracking information found!');
      } else {
        toast.error('No tracking information found for this product');
        setTrackingData(null);
      }
    } catch (error) {
      console.error('Error searching for product:', error);
      toast.error('Failed to search for product');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (qrData) => {
    try {
      const parsedData = JSON.parse(qrData);
      if (parsedData.batchId || parsedData.qrHash) {
        setSearchInput(parsedData.batchId || parsedData.qrHash);
        setTrackingData(sampleTraceability);
        toast.success('QR code scanned successfully!');
      } else if (parsedData.type === 'batch_traceability' && parsedData.url) {
        // Handle traceability QR codes
        window.open(parsedData.url, '_blank');
      } else {
        toast.error('Invalid QR code format');
      }
    } catch (error) {
      console.error('Error parsing QR data:', error);
      toast.error('Invalid QR code');
    }
    setShowQRScanner(false);
  };

  const handleQRError = (error) => {
    console.error('QR scan error:', error);
    toast.error('Failed to scan QR code');
    setShowQRScanner(false);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: '✓' },
      'in-progress': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: '⏳' },
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: '○' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔍 Track Product
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track agricultural products through the complete supply chain using QR codes or batch IDs
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Product Search
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manual Search */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  QR Code Hash or Batch ID
                </label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter QR code hash or batch ID"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search Product'}
              </button>
            </div>

            {/* QR Scanner */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  QR Code Scanner
                </label>
                <button
                  onClick={() => setShowQRScanner(true)}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📱 Scan QR Code
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Scan QR codes on product packaging for instant tracking
              </p>
            </div>
          </div>
        </div>

        {/* Tracking Results */}
        {trackingData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Product Tracking Information
            </h2>
            
            {/* Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Batch ID</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.batchId}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Product Type</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.productType}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Certification</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.certification}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Farmer</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.farmer}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Location</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.farmerLocation}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Reputation</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.farmerReputation}/100</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Quantity</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.quantity} units</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Price per Unit</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.pricePerUnit} KRSI</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Harvest Date</div>
                <div className="font-medium text-gray-900 dark:text-white">{trackingData.harvestDate}</div>
              </div>
            </div>

            {/* Supply Chain Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Supply Chain Timeline
              </h3>
              <div className="space-y-3">
                {trackingData.timeline.map((step, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'in-progress' ? 'bg-blue-500' :
                      'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      {step.status === 'completed' ? '✓' :
                       step.status === 'in-progress' ? '⏳' : '○'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-white">{step.step}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{step.date}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{step.location}</div>
                    </div>
                    <div>
                      {getStatusBadge(step.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => window.open(trackingData.traceabilityUrl, '_blank')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                📄 View Full Traceability Report
              </button>
              <button
                onClick={() => setTrackingData(null)}
                className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                🔄 Search Another Product
              </button>
            </div>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showQRScanner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Scan QR Code
                </h3>
                <button
                  onClick={() => setShowQRScanner(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <QRCodeScanner
                onScan={handleQRScan}
                onError={handleQRError}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackProduct;
