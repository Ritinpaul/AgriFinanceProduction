// frontend/src/components/NFTManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useAdminApproval } from '../utils/adminApproval';

const NFTManagement = () => {
  const [activeTab, setActiveTab] = useState('mint');
  const { user } = useAuth();
  const { account } = useWeb3();
  const adminApproval = useAdminApproval({});
  const [nftLands, setNftLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);

  const [formData, setFormData] = useState({
    landArea: '',
    location: '',
    price: '',
    description: ''
  });

  useEffect(() => {
    if (user?.id) {
      loadNFTLands();
    }
  }, [user]);

  const loadNFTLands = async () => {
    setLoading(true);
    try {
      // Simulate loading NFT lands
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNftLands([]);
    } catch (error) {
      console.error('Error loading NFT lands:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!formData.landArea || !formData.location || !formData.price) return;
    
    setMinting(true);
    try {
      // Simulate minting
      await new Promise(resolve => setTimeout(resolve, 2000));
      loadNFTLands();
    } catch (error) {
      console.error('Error minting NFT:', error);
    } finally {
      setMinting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Please sign in to access NFT management
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            NFT Land Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Mint and manage agricultural land NFTs
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('mint')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'mint'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Mint NFT
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Manage NFTs
          </button>
        </div>

        {/* Mint Tab */}
        {activeTab === 'mint' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Mint New Land NFT
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Land Area (acres)
                </label>
                <input
                  type="number"
                  name="landArea"
                  value={formData.landArea}
                  onChange={handleInputChange}
                  placeholder="Enter land area"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Enter location"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price (KRSI)
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="Enter price"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleMint}
                disabled={!formData.landArea || !formData.location || !formData.price || minting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                {minting ? 'Minting...' : 'Mint NFT'}
              </button>
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Your NFT Lands
            </h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Loading NFTs...</p>
              </div>
            ) : nftLands.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  No NFT lands found
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nftLands.map((nft) => (
                  <div key={nft.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Land #{nft.token_id}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {nft.land_area} acres • {nft.location}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {nft.price} KRSI
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        nft.is_for_sale 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {nft.is_for_sale ? 'For Sale' : 'Not for Sale'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTManagement;