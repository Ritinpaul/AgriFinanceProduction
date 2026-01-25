import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import QRCodeScanner from '../components/QRCodeScanner';

const Marketplace = () => {
  const { account, isConnected } = useWeb3();
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    fetchMarketplaceBatches();
    if (user?.id) {
      fetchUserBalance();
    }
  }, [user]);

  const fetchUserBalance = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/wallet', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      if (data.wallet) {
        setUserBalance(parseFloat(data.wallet.balance_wei) / 1000000); // Convert wei to KRSI
      }
    } catch (error) {
      console.error('Error fetching user balance:', error);
    }
  };

  const fetchMarketplaceBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/marketplace/listings`);
      const data = await response.json();
      
      if (data.success) {
        setBatches(data.listings);
      }
    } catch (error) {
      console.error('Error fetching marketplace listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (qrData) => {
    try {
      const parsedData = JSON.parse(qrData);
      if (parsedData.type === 'batch_traceability' && parsedData.url) {
        window.open(parsedData.url, '_blank');
      }
    } catch (error) {
      console.error('Error parsing QR data:', error);
    }
    setShowScanner(false);
  };

  const handleQRError = (error) => {
    console.error('QR scan error:', error);
  };

  const handlePurchase = async (product) => {
    if (!user?.id) {
      alert('Please log in to purchase products');
      return;
    }

    if (!isConnected) {
      alert('Please connect your wallet to purchase products');
      return;
    }

    setSelectedProduct(product);
    setPurchaseQuantity(1);
    setShowPurchaseModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !user?.id) return;

    setPurchasing(true);
    try {
      const totalPrice = selectedProduct.price_per_unit * purchaseQuantity;
      
      // Check if user has sufficient balance
      if (userBalance < totalPrice) {
        alert(`Insufficient balance. You have ${userBalance.toFixed(2)} KRSI, but need ${totalPrice.toFixed(2)} KRSI.`);
        setPurchasing(false);
        return;
      }

      // Check if product has sufficient quantity
      if (selectedProduct.quantity < purchaseQuantity) {
        alert(`Insufficient quantity. Only ${selectedProduct.quantity} ${selectedProduct.unit} available.`);
        setPurchasing(false);
        return;
      }

      // Create purchase order
      const purchaseData = {
        batchId: selectedProduct.id,
        quantity: purchaseQuantity,
        unitPrice: selectedProduct.price_per_unit,
        totalPrice: totalPrice,
        buyerId: user.id,
        farmerId: selectedProduct.farmer_id
      };

      const response = await fetch('http://localhost:3001/api/marketplace/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(purchaseData)
      });

      const result = await response.json();

      if (result.success) {
        alert(`Purchase successful! You bought ${purchaseQuantity} ${selectedProduct.unit} of ${selectedProduct.product_name} for ${totalPrice.toFixed(2)} KRSI.`);
        
        // Refresh data
        await fetchMarketplaceBatches();
        await fetchUserBalance();
        
        // Close modal
        setShowPurchaseModal(false);
        setSelectedProduct(null);
      } else {
        // Handle specific error cases
        if (result.code === 'SAME_USER_PURCHASE') {
          alert('❌ Cannot purchase your own products!\n\nPlease buy from other farmers to support the marketplace economy.');
        } else {
          alert('Purchase failed: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const getGradeColor = (grade) => {
    switch (grade.toLowerCase()) {
      case 'premium':
        return 'text-purple-400 bg-purple-900/30 dark:text-purple-400 dark:bg-purple-900/30';
      case 'standard':
        return 'text-blue-400 bg-blue-900/30 dark:text-blue-400 dark:bg-blue-900/30';
      case 'basic':
        return 'text-gray-400 bg-gray-800 dark:text-gray-400 dark:bg-gray-800';
      default:
        return 'text-gray-400 bg-gray-800 dark:text-gray-400 dark:bg-gray-800';
    }
  };

  const getReputationColor = (reputation) => {
    if (reputation >= 90) return 'text-green-400 dark:text-green-400';
    if (reputation >= 80) return 'text-yellow-400 dark:text-yellow-400';
    return 'text-red-400 dark:text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Product Marketplace</h1>
              <p className="text-gray-400">Browse and purchase verified agricultural products</p>
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan QR Code
            </button>
          </div>
        </div>

        {/* Batches Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading marketplace products...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No Products Available</h3>
            <p className="text-gray-400">No products are currently available in the marketplace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((listing) => (
              <div key={listing.id} className="bg-gray-800 rounded-lg shadow-sm overflow-hidden">
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
                      <h3 className="text-lg font-semibold text-white">{listing.product_name}</h3>
                      <div className="flex items-center space-x-2">
                        {listing.grade && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(listing.grade)}`}>
                            {listing.grade}
                          </span>
                        )}
                        {listing.farmer_id === user?.id && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
                            Your Product
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">
                      {listing.quantity} {listing.unit}
                    </p>
                    <p className="text-lg font-bold text-green-400">
                      {listing.price_per_unit} {listing.currency} per {listing.unit}
                    </p>
                    {listing.product_description && (
                      <p className="text-gray-300 text-sm mt-2">{listing.product_description}</p>
                    )}
                  </div>

                  {/* Seller Info */}
                  <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-white mb-1">
                      {listing.first_name} {listing.last_name}
                    </h4>
                    <p className="text-gray-400 text-sm mb-1">
                      {listing.region}, {listing.state}
                    </p>
                    {listing.organic_certified && (
                      <div className="flex items-center">
                        <span className="text-sm text-green-400 mr-1">🌱</span>
                        <span className="text-sm text-green-400 font-medium">Organic Certified</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => handlePurchase(listing)}
                      disabled={!isConnected || !user?.id || listing.farmer_id === user?.id}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {!isConnected || !user?.id ? 'Login to Purchase' : 
                       listing.farmer_id === user?.id ? 'Your Product' : 'Purchase Product'}
                    </button>
                    <button
                      className="w-full bg-gray-700 text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      View Details
                    </button>
                  </div>

                  {/* Verification Badge */}
                  <div className="mt-4 flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/30 text-green-400">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QR Scanner Modal */}
        {showScanner && (
          <QRCodeScanner
            onScan={handleQRScan}
            onError={handleQRError}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
      {/* Purchase Modal */}
      {showPurchaseModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Purchase {selectedProduct.product_name}</h3>
            
            {/* Product Info */}
            <div className="mb-4 p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-300 text-sm mb-2">
                Available: {selectedProduct.quantity} {selectedProduct.unit}
              </p>
              <p className="text-gray-300 text-sm mb-2">
                Price: {selectedProduct.price_per_unit} KRSI per {selectedProduct.unit}
              </p>
              <p className="text-gray-300 text-sm">
                Your Balance: {userBalance.toFixed(2)} KRSI
              </p>
            </div>

            {/* Quantity Selection */}
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Quantity ({selectedProduct.unit})
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct.quantity}
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(Math.max(1, Math.min(selectedProduct.quantity, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Total Price */}
            <div className="mb-4 p-3 bg-green-900/30 rounded-lg">
              <p className="text-green-400 font-semibold">
                Total: {(selectedProduct.price_per_unit * purchaseQuantity).toFixed(2)} KRSI
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                disabled={purchasing || userBalance < (selectedProduct.price_per_unit * purchaseQuantity)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {purchasing ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
