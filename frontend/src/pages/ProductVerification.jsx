import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useTheme } from '../context/ThemeContext';
import QRCodeScanner from '../components/QRCodeScanner';
import { toast } from 'react-hot-toast';

const ProductVerification = () => {
  const { contract, account } = useWeb3();
  const { isDark } = useTheme();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationHistory, setVerificationHistory] = useState([]);

  // Load verification history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('verificationHistory');
    if (history) {
      setVerificationHistory(JSON.parse(history));
    }
  }, []);

  // Handle QR deep-link: ?qr=<encodedProductId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qr = params.get('qr');
    if (qr && !productData && !loading) {
      // Auto-verify when arriving via share link
      handleScanSuccess(qr, null);
    }
  }, [productData, loading]);

  // Save verification to history
  const saveToHistory = (productId, result) => {
    const newEntry = {
      id: Date.now(),
      productId,
      result,
      timestamp: new Date().toISOString(),
      verified: result !== null
    };
    
    const updatedHistory = [newEntry, ...verificationHistory.slice(0, 9)]; // Keep last 10
    setVerificationHistory(updatedHistory);
    localStorage.setItem('verificationHistory', JSON.stringify(updatedHistory));
  };

  // Handle QR scan success
  const handleScanSuccess = async (productId, decodedResult) => {
    setLoading(true);
    setProductData(null);
    
    try {
      // Verify product using smart contract
      const result = await verifyProduct(productId);
      setProductData(result);
      saveToHistory(productId, result);
      
      if (result) {
        toast.success("Product verified successfully!");
      } else {
        toast.error("Product not found or invalid");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Failed to verify product");
      saveToHistory(productId, null);
    } finally {
      setLoading(false);
    }
  };

  // Handle scan error
  const handleScanError = (error) => {
    console.error("Scan error:", error);
    toast.error("Failed to scan QR code");
  };

  // Verify product using smart contract
  const verifyProduct = async (productId) => {
    if (!contract) {
      throw new Error("Contract not connected");
    }

    try {
      // Call the verifyBatchByQR function from SupplyChain contract
      const batchId = await contract.verifyBatchByQR(productId);
      
      if (batchId.toString() === '0') {
        return null; // Product not found
      }

      // Get batch details
      const batchDetails = await contract.getBatchDetails(batchId);
      const traceability = await contract.getBatchTraceability(batchId);
      
      return {
        batchId: batchId.toString(),
        productType: batchDetails.productType,
        quantity: batchDetails.quantity.toString(),
        pricePerUnit: batchDetails.pricePerUnit.toString(),
        totalValue: batchDetails.totalValue.toString(),
        location: batchDetails.location,
        harvestDate: new Date(parseInt(batchDetails.harvestDate) * 1000).toLocaleDateString(),
        certification: batchDetails.certification,
        isVerified: batchDetails.isVerified,
        isSold: batchDetails.isSold,
        farmer: batchDetails.farmer,
        buyer: batchDetails.buyer,
        saleTimestamp: batchDetails.saleTimestamp.toString(),
        qrCodeHash: batchDetails.qrCodeHash,
        traceability
      };
    } catch (error) {
      console.error("Contract call error:", error);
      throw error;
    }
  };

  // Clear current verification
  const clearVerification = () => {
    setProductData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Product Verification
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Scan QR codes or enter product IDs to verify agricultural products and view their complete supply chain journey from farm to table.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Scanner */}
          <div>
            <QRCodeScanner
              onScanSuccess={handleScanSuccess}
              onScanError={handleScanError}
              className="mb-6"
            />
          </div>

          {/* Verification Results */}
          <div>
            {loading && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <span className="text-gray-600 dark:text-gray-400">Verifying product...</span>
                </div>
              </div>
            )}

            {productData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Product Details
                  </h3>
                  <button
                    onClick={clearVerification}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Product Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Product Type</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{productData.productType}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Quantity</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{productData.quantity} units</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Price per Unit</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{productData.pricePerUnit} KRSI</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Total Value</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{productData.totalValue} KRSI</p>
                    </div>
                  </div>

                  {/* Location & Dates */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Location</label>
                        <p className="text-gray-900 dark:text-white">{productData.location}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Harvest Date</label>
                        <p className="text-gray-900 dark:text-white">{productData.harvestDate}</p>
                      </div>
                    </div>
                  </div>

                  {/* Certification */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Certification</label>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        productData.certification ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {productData.certification || 'No certification'}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Verification Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        productData.isVerified ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      }`}>
                        {productData.isVerified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sale Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        productData.isSold ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {productData.isSold ? 'Sold' : 'Available'}
                      </span>
                    </div>
                  </div>

                  {/* Supply Chain Journey */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Supply Chain Journey</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Farm: {productData.traceability.farmer}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Location: {productData.traceability.location}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Harvest: {productData.traceability.harvestDate}</span>
                      </div>
                      {productData.traceability.buyer !== '0x0000000000000000000000000000000000000000' && (
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">Buyer: {productData.traceability.buyer}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shareable link */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Shareable Verification Link</span>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/verify-product?qr=${encodeURIComponent(productData.qrCodeHash || productData.batchId)}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Verification link copied!');
                        }}
                        className="agri-button"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Verification History */}
            {verificationHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Recent Verifications
                </h3>
                <div className="space-y-3">
                  {verificationHistory.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Product ID: {entry.productId}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.verified ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {entry.verified ? 'Verified' : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductVerification;
