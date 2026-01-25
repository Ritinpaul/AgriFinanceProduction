import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';

const BatchManagement = () => {
  const { account, isConnected, contracts } = useWeb3();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBatch, setNewBatch] = useState({
    productType: '',
    grade: '',
    quantity: '',
    pricePerUnit: '',
    certifications: '',
    photos: '',
    logs: ''
  });

  const [qrCode, setQrCode] = useState(null);
  const [traceabilityUrl, setTraceabilityUrl] = useState('');

  useEffect(() => {
    if (isConnected && account) {
      fetchFarmerBatches();
    }
  }, [isConnected, account]);

  const fetchFarmerBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/batch/farmer/${account}`);
      const data = await response.json();
      
      if (data.success) {
        setBatches(data.batches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newBatch,
          farmerAddress: account
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setQrCode(data.qrCode);
        setTraceabilityUrl(data.traceabilityUrl);
        setBatches([...batches, data.batch]);
        setShowCreateForm(false);
        setNewBatch({
          productType: '',
          grade: '',
          quantity: '',
          pricePerUnit: '',
          certifications: '',
          photos: '',
          logs: ''
        });
      } else {
        alert('Failed to create batch: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      alert('Failed to create batch');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBatch = async (batchId) => {
    try {
      const response = await fetch(`/api/batch/verify/${batchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          verifierAddress: account
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Batch verified successfully!');
        fetchFarmerBatches();
      } else {
        alert('Failed to verify batch: ' + data.error);
      }
    } catch (error) {
      console.error('Error verifying batch:', error);
      alert('Failed to verify batch');
    }
  };

  const getStatusBadge = (batch) => {
    if (batch.isSold) {
      return <span className="px-2 py-1 bg-blue-900/30 text-blue-300 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs">Sold</span>;
    } else if (batch.isVerified) {
      return <span className="px-2 py-1 bg-green-900/30 text-green-300 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs">Verified</span>;
    } else {
      return <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full text-xs">Pending</span>;
    }
  };

  const getGradeColor = (grade) => {
    switch (grade.toLowerCase()) {
      case 'premium':
        return 'text-purple-400 dark:text-purple-400';
      case 'standard':
        return 'text-blue-400 dark:text-blue-400';
      case 'basic':
        return 'text-gray-400 dark:text-gray-400';
      default:
        return 'text-gray-400 dark:text-gray-400';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-100 dark:text-gray-100 mb-4">Batch Management</h1>
            <p className="text-gray-400 dark:text-gray-400 mb-8">Please connect your wallet to manage your product batches</p>
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-200 dark:text-yellow-200">Connect your wallet to access batch management features</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 dark:text-gray-100 mb-2">Batch Management</h1>
          <p className="text-gray-400 dark:text-gray-400">Create and manage your product batches with QR code traceability</p>
        </div>

        {/* Create Batch Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Batch
          </button>
        </div>

        {/* QR Code Display */}
        {qrCode && (
          <div className="mb-6 bg-gray-800 dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100 dark:text-gray-100 mb-4">QR Code Generated</h3>
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <img src={qrCode} alt="Batch QR Code" className="w-32 h-32" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 dark:text-gray-400 mb-2">Scan this QR code to view batch traceability information</p>
                <a
                  href={traceabilityUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 underline"
                >
                  View Traceability Page
                </a>
                <button
                  onClick={() => {
                    setQrCode(null);
                    setTraceabilityUrl('');
                  }}
                  className="ml-4 text-gray-400 hover:text-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Batch Form */}
        {showCreateForm && (
          <div className="mb-6 bg-gray-800 dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100 dark:text-gray-100 mb-4">Create New Batch</h3>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Product Type</label>
                  <input
                    type="text"
                    value={newBatch.productType}
                    onChange={(e) => setNewBatch({...newBatch, productType: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                    placeholder="e.g., Organic Tomatoes"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Grade</label>
                  <select
                    value={newBatch.grade}
                    onChange={(e) => setNewBatch({...newBatch, grade: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100"
                    required
                  >
                    <option value="">Select Grade</option>
                    <option value="Premium">Premium</option>
                    <option value="Standard">Standard</option>
                    <option value="Basic">Basic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newBatch.quantity}
                    onChange={(e) => setNewBatch({...newBatch, quantity: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                    placeholder="e.g., 1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Price per Unit (ETH)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBatch.pricePerUnit}
                    onChange={(e) => setNewBatch({...newBatch, pricePerUnit: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                    placeholder="e.g., 0.0025"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Certifications (IPFS Hash)</label>
                <input
                  type="text"
                  value={newBatch.certifications}
                  onChange={(e) => setNewBatch({...newBatch, certifications: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                  placeholder="QmHash..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Photos (IPFS Hash)</label>
                <input
                  type="text"
                  value={newBatch.photos}
                  onChange={(e) => setNewBatch({...newBatch, photos: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                  placeholder="QmHash..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">Production Logs (IPFS Hash)</label>
                <input
                  type="text"
                  value={newBatch.logs}
                  onChange={(e) => setNewBatch({...newBatch, logs: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-100 dark:text-gray-100 placeholder-gray-400"
                  placeholder="QmHash..."
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Batch'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-600 text-gray-200 px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Batches List */}
        <div className="bg-gray-800 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100 dark:text-gray-100">Your Batches</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-2 text-gray-400 dark:text-gray-400">Loading batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="p-6 text-center text-gray-400 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p>No batches created yet. Create your first batch to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {batches.map((batch) => (
                <div key={batch.batchId} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-100 dark:text-gray-100">{batch.productType}</h4>
                        <span className={`text-sm font-medium ${getGradeColor(batch.grade)}`}>
                          {batch.grade}
                        </span>
                        {getStatusBadge(batch)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400 dark:text-gray-400">
                        <div>
                          <span className="font-medium text-gray-300 dark:text-gray-300">Quantity:</span> {batch.quantity}
                        </div>
                        <div>
                          <span className="font-medium text-gray-300 dark:text-gray-300">Price:</span> {batch.pricePerUnit} ETH/unit
                        </div>
                        <div>
                          <span className="font-medium text-gray-300 dark:text-gray-300">Created:</span> {new Date(batch.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium text-gray-300 dark:text-gray-300">QR Hash:</span> {batch.qrHash}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {!batch.isVerified && (
                        <button
                          onClick={() => handleVerifyBatch(batch.batchId)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Verify
                        </button>
                      )}
                      <a
                        href={`/traceability/${batch.qrHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        View Traceability
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchManagement;