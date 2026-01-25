import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import QRCodeScanner from '../components/QRCodeScanner';

const VerifyBatch = () => {
  const { account, isConnected } = useWeb3();
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState({});
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [batchIdInput, setBatchIdInput] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('batchId'); // 'batchId' or 'qr'

  useEffect(() => {
    fetchAllBatches();
  }, []);

  const fetchAllBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/batch/marketplace');
      const data = await response.json();
      
      if (data.success) {
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBatch = async (batchId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/batch/verify/${batchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          verifierAddress: account,
          verifierRole: user?.role
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setVerificationStatus(prev => ({
          ...prev,
          [batchId]: 'verified'
        }));
        alert('Batch verified successfully!');
        fetchAllBatches(); // Refresh the list
      } else {
        alert('Failed to verify batch: ' + data.error);
      }
    } catch (error) {
      console.error('Error verifying batch:', error);
      alert('Failed to verify batch');
    }
  };

  const handleQRScan = (qrData) => {
    try {
      const parsedData = JSON.parse(qrData);
      if (parsedData.batchId) {
        // Find the batch by ID
        const batch = batches.find(b => b.batchId === parsedData.batchId);
        if (batch) {
          setSelectedBatch(batch);
          setShowVerificationModal(true);
        } else {
          alert('Batch not found for this QR code');
        }
      } else if (parsedData.type === 'batch_traceability' && parsedData.url) {
        // Handle traceability QR codes
        window.open(parsedData.url, '_blank');
      } else {
        alert('Invalid QR code format');
      }
    } catch (error) {
      console.error('Error parsing QR data:', error);
      alert('Invalid QR code');
    }
    setShowQRScanner(false);
  };

  const handleQRError = (error) => {
    console.error('QR scan error:', error);
    alert('Failed to scan QR code');
    setShowQRScanner(false);
  };

  const handleBatchIdVerification = () => {
    if (!batchIdInput.trim()) {
      alert('Please enter a batch ID');
      return;
    }

    const batchId = parseInt(batchIdInput);
    const batch = batches.find(b => b.batchId === batchId);
    
    if (batch) {
      setSelectedBatch(batch);
      setShowVerificationModal(true);
    } else {
      alert('Batch not found with ID: ' + batchIdInput);
    }
  };

  const filteredBatches = batches.filter(batch =>
    batch.product.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.farmer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.product.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (batch) => {
    const isVerified = verificationStatus[batch.batchId] === 'verified' || batch.isVerified;
    
    if (isVerified) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Verified
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Pending Verification
      </span>
    );
  };

  const getGradeColor = (grade) => {
    switch (grade?.toLowerCase()) {
      case 'premium':
      case 'a+':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'a':
      case 'export':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'standard':
      case 'b':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Batch Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Verify agricultural batches and products for quality, authenticity, and compliance using batch ID or QR codes
          </p>
        </div>

        {/* Verification Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Verification Methods
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Batch ID Verification */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Batch ID Verification</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Enter a batch ID to verify the authenticity and quality of agricultural products
              </p>
              <div className="space-y-3">
                <input
                  type="number"
                  placeholder="Enter batch ID (e.g., 1, 2, 3...)"
                  value={batchIdInput}
                  onChange={(e) => setBatchIdInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={handleBatchIdVerification}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Verify by Batch ID
                </button>
              </div>
            </div>

            {/* QR Code Verification */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">QR Code Verification</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Scan QR codes on products or packaging for instant verification
              </p>
              <button
                onClick={() => setShowQRScanner(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Scan QR Code
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Batches
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by product, farmer, or grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchAllBatches}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Batches Grid */}
        {filteredBatches.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No batches found' : 'No batches available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'No agricultural batches are currently available for verification'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.map((batch) => (
              <div key={batch.batchId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                {/* Product Image Placeholder */}
                <div className="h-48 bg-gradient-to-br from-green-900/50 to-green-800/50 flex items-center justify-center">
                  <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>

                <div className="p-6">
                  {/* Product Info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{batch.product.type}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(batch.product.grade)}`}>
                        {batch.product.grade}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      Quantity: {batch.product.quantity} units
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {batch.product.pricePerUnit} KRSI per unit
                    </p>
                  </div>

                  {/* Farmer Info */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{batch.farmer.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{batch.farmer.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Reputation:</span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-3 h-3 ${i < Math.floor(batch.farmer.reputation / 20) ? 'text-yellow-400' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{batch.farmer.reputation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between">
                    <div>
                      {getStatusBadge(batch)}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDetails(batch)}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        Details
                      </button>
                      {verificationStatus[batch.batchId] !== 'verified' && !batch.isVerified && (
                        <button
                          onClick={() => handleVerifyBatch(batch.batchId)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verification Modal */}
        {showVerificationModal && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Batch Details
                </h3>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Type</label>
                    <p className="text-gray-900 dark:text-white">{selectedBatch.product.type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grade</label>
                    <p className="text-gray-900 dark:text-white">{selectedBatch.product.grade}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                    <p className="text-gray-900 dark:text-white">{selectedBatch.product.quantity} units</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price per Unit</label>
                    <p className="text-gray-900 dark:text-white">{selectedBatch.product.pricePerUnit} KRSI</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Farmer Information</label>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-900 dark:text-white font-medium">{selectedBatch.farmer.name}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{selectedBatch.farmer.location}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Reputation: {selectedBatch.farmer.reputation}/100</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Traceability</label>
                  <div className="mt-2">
                    <a
                      href={selectedBatch.traceabilityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-400 hover:underline"
                    >
                      View Full Traceability Report →
                    </a>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowVerificationModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  {verificationStatus[selectedBatch.batchId] !== 'verified' && !selectedBatch.isVerified && (
                    <button
                      onClick={() => {
                        handleVerifyBatch(selectedBatch.batchId);
                        setShowVerificationModal(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Verify Batch
                    </button>
                  )}
                </div>
              </div>
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

export default VerifyBatch;
