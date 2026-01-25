// frontend/src/pages/NFTMarketplace.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useBlockchainSync } from '../utils/blockchainSync';
import { useAdminApproval } from '../utils/adminApproval';
import { ethers } from 'ethers';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const NFTMarketplace = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    image_url: '',
    price_krsi: ''
  });
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { account, buyNFT, isConnected, provider } = useWeb3();
  const blockchainSync = useBlockchainSync(provider, {});
  const adminApproval = useAdminApproval({ buyNFT });
  const [allNfts, setAllNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState({});
  const [userApprovals, setUserApprovals] = useState([]);
  const [userPurchases, setUserPurchases] = useState([]);

  useEffect(() => {
    loadNFTs();
    if (user?.id) {
      loadUserApprovals();
      loadUserPurchases();
    }
  }, [user]);

  const loadNFTs = async () => {
    setLoading(true);
    try {
      const result = await apiClient.get('/nfts');
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      
      
      const nfts = result.data?.nfts || [];
      setAllNfts(nfts);
    } catch (error) {
      console.error('❌ Error loading NFTs:', error);
      toast.error('Failed to load NFTs: ' + error.message);
      setAllNfts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserApprovals = async () => {
    if (!user?.id) {
      return;
    }
    
    try {
      const result = await apiClient.get('/admin/approvals/my-approvals');
      
      if (result.error) {
        setUserApprovals([]);
        return;
      }
      
      
      setUserApprovals(result.data?.approvals || []);
    } catch (error) {
      console.error('❌ Error loading user approvals:', error);
      setUserApprovals([]);
    }
  };

  const loadUserPurchases = async () => {
    if (!user?.id) {
      console.log('⚠️ loadUserPurchases: No user ID, skipping');
      return;
    }
    
    console.log(`🔄 loadUserPurchases: Loading purchases for user ${user.id}`);
    
    try {
      // Load NFTs owned by the current user using the dedicated endpoint
      const result = await apiClient.get('/nft/my-purchases');
      console.log('📊 loadUserPurchases: API response:', result);
      
      if (result.data) {
        const nfts = result.data.nfts || [];
        console.log(`📦 loadUserPurchases: Setting ${nfts.length} purchased NFTs:`, nfts.map(nft => nft.name));
        setUserPurchases(nfts);
      } else {
        console.log('⚠️ loadUserPurchases: No data in response');
        setUserPurchases([]);
      }
    } catch (error) {
      console.error('❌ Error loading user purchases:', error);
      setUserPurchases([]);
    }
  };


  const handlePurchase = async (nftId) => {
    if (!user?.id) {
      toast.error('Please sign in to purchase NFTs');
      return;
    }

    // Find the NFT to purchase
    const nftToPurchase = allNfts.find(nft => nft.id === nftId);
    if (!nftToPurchase) {
      toast.error('NFT not found');
      return;
    }

    // Allow purchase if NFT has a price and is not already owned
    if (!nftToPurchase.price_wei || nftToPurchase.price_wei === '0') {
      toast.error('NFT is not available for purchase - no price set');
      return;
    }
    
    if (nftToPurchase.owner_id) {
      toast.error('NFT is not available for purchase - already owned');
      return;
    }

    // Check if user has an in-app wallet
    let userWallet;
    try {
      const walletResult = await apiClient.getWallet();
      if (!walletResult.data || !walletResult.data.wallet) {
        toast.error('No in-app wallet found. Please create a wallet first.');
        return;
      }
      userWallet = walletResult.data.wallet;
    } catch (error) {
      toast.error('Failed to check wallet status');
      return;
    }

    // Check if user has sufficient balance
    const nftPriceWei = nftToPurchase.price_wei || '0';
    const userBalanceWei = userWallet.balance_wei || '0';
    
    if (BigInt(userBalanceWei) < BigInt(nftPriceWei)) {
      const nftPrice = ethers.formatUnits(nftPriceWei, 6);
      const userBalance = ethers.formatUnits(userBalanceWei, 6);
      toast.error(`Insufficient balance. NFT costs ${nftPrice} KRSI, you have ${userBalance} KRSI`);
      return;
    }

    setPurchasing(prev => ({ ...prev, [nftId]: true }));
    try {
      // Execute real NFT purchase
      const purchaseResult = await apiClient.purchaseNFT({
        nftId: nftId,
        buyerId: user.id,
        priceWei: nftPriceWei
      });

      if (purchaseResult.error) {
        throw new Error(purchaseResult.error);
      }

      toast.success('🎉 NFT purchased successfully!');
      
      // Refresh NFT list to show updated ownership
      await loadNFTs();
      
      // Refresh user purchases to show the new NFT
      await loadUserPurchases();
      
    } catch (error) {
      console.error('Error purchasing NFT:', error);
      toast.error('Failed to purchase NFT: ' + error.message);
    } finally {
      setPurchasing(prev => ({ ...prev, [nftId]: false }));
    }
  };

  const filteredNFTs = useMemo(() => {
    // Show all NFTs in browse tab (both listed and drafts)
    return allNfts;
  }, [allNfts]);

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateNFT = async () => {
    if (!createForm.name) {
      toast.error('NFT name is required');
      return;
    }
    
    if (!user?.id) {
      toast.error('Please sign in to create NFTs');
      return;
    }
    
    setCreating(true);
    try {
      const result = await apiClient.createNFT(createForm);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      
      toast.success('🎉 NFT created! Pending admin approval for on-chain minting.');
      
      // Reset form
      setCreateForm({ name: '', description: '', image_url: '', price_krsi: '' });
      
      // Wait a moment for database to sync, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh NFT list and approvals
      await Promise.all([loadNFTs(), loadUserApprovals()]);
      
      // Switch to Approvals tab to show the new approval
      setActiveTab('approvals');
    } catch (err) {
      console.error('❌ Create NFT failed:', err);
      toast.error('Failed to create NFT: ' + (err.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Please sign in to access the NFT marketplace
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            NFT Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Buy and sell agricultural land NFTs
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => {
              setActiveTab('browse');
              loadNFTs(); // Refresh NFTs when clicking tab
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'browse'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Browse NFTs
          </button>
          <button
            onClick={() => {
              setActiveTab('my-purchases');
              loadUserPurchases(); // Refresh purchases when clicking tab
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'my-purchases'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            My Purchases
          </button>
          <button
            onClick={() => {
              setActiveTab('approvals');
              loadUserApprovals(); // Refresh approvals when clicking tab
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'approvals'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Pending Approvals
            {userApprovals.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                {userApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
              activeTab === 'create'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Create NFT
          </button>
        </div>

        {/* Browse NFTs Tab */}
        {activeTab === 'browse' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Available Land NFTs
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => loadNFTs()}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors duration-200"
                >
                  {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Loading NFTs...</p>
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  No NFTs available for purchase
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNFTs.map((nft) => (
                  <div key={nft.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-transparent hover:border-green-500 transition-all duration-200">
                    <div className="relative aspect-w-16 aspect-h-9">
                      <img 
                        src={nft.image_url || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop'} 
                        alt={nft.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop';
                        }}
                      />
                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          nft.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : nft.status === 'minted'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {nft.status || 'draft'}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {nft.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">
                          {nft.description || 'No description provided'}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {nft.price_wei && nft.price_wei !== '0' 
                              ? (() => {
                                  try {
                                    // Use the raw price_wei value directly
                                    return `${ethers.formatUnits(nft.price_wei, 6)} KRSI`;
                                  } catch (e) {
                                    return 'Price TBD';
                                  }
                                })()
                              : 'Price TBD'
                            }
                          </p>
                          {nft.owner_id && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {nft.id.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handlePurchase(nft.id)}
                        disabled={purchasing[nft.id] || !user?.id || nft.owner_id || !nft.price_wei || nft.price_wei === '0'}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                      >
                        {purchasing[nft.id] 
                          ? 'Purchasing...' 
                          : nft.owner_id
                          ? 'Already Owned'
                          : !nft.price_wei || nft.price_wei === '0'
                          ? 'No Price Set'
                          : !user?.id
                          ? 'Sign In Required'
                          : 'Buy NFT'
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Purchases Tab */}
        {activeTab === 'my-purchases' && (
          <div>
            {console.log('🎨 Rendering My Purchases tab. userPurchases:', userPurchases)}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Your Purchased NFTs
            </h2>
            
            {userPurchases.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  No purchased NFTs found
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userPurchases.map((nft) => (
                  <div key={nft.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-transparent hover:border-green-500 transition-all duration-200">
                    <div className="relative aspect-w-16 aspect-h-9">
                      <img 
                        src={nft.image_url || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop'} 
                        alt={nft.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop';
                        }}
                      />
                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          nft.status === 'sold'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : nft.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {nft.status || 'active'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {nft.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">
                        {nft.description || 'No description provided'}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {nft.price_wei && nft.price_wei !== '0' 
                            ? (() => {
                                try {
                                  // Use the raw price_wei value directly
                                  return `${ethers.formatUnits(nft.price_wei, 6)} KRSI`;
                                } catch (e) {
                                  return 'Price TBD';
                                }
                              })()
                            : 'Price TBD'
                          }
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {nft.id.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm font-medium">
                          ✅ Owned by You
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Your Approval Requests
              </h2>
              <button
                onClick={() => loadUserApprovals()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors duration-200"
              >
                🔄 Refresh
              </button>
            </div>
            
            {userApprovals.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No approval requests found
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Create an NFT to see approval requests here
                </p>
                <button
                  onClick={() => loadUserApprovals()}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                >
                  Check Again
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {userApprovals.map((approval) => {
                  const requestData = approval.request_data || {};
                  return (
                    <div key={approval.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                              {approval.approval_type === 'nft_mint' ? '🎨 NFT Minting Request' : approval.approval_type}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              approval.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : approval.status === 'approved'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {approval.status.toUpperCase()}
                            </span>
                          </div>
                          
                          {requestData.name && (
                            <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                              NFT Name: {requestData.name}
                            </p>
                          )}
                          
                          {requestData.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                              {requestData.description}
                            </p>
                          )}
                          
                          {requestData.price_krsi && (
                            <p className="text-green-600 dark:text-green-400 font-semibold">
                              Price: {requestData.price_krsi} KRSI
                            </p>
                          )}
                          
                          <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                            Requested: {new Date(approval.created_at).toLocaleString()}
                          </p>
                          
                          {approval.admin_notes && (
                            <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <strong>Admin Notes:</strong> {approval.admin_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {approval.status === 'pending' && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            ⏳ Your NFT is awaiting admin approval for on-chain minting. You'll be notified once it's processed.
                          </p>
                        </div>
                      )}
                      
                      {approval.status === 'approved' && (
                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                          <p className="text-sm text-green-700 dark:text-green-300">
                            ✅ Approved! Your NFT has been minted on-chain and is now available in the marketplace.
                          </p>
                        </div>
                      )}
                      
                      {approval.status === 'rejected' && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                          <p className="text-sm text-red-700 dark:text-red-300">
                            ❌ Request rejected. Please check admin notes for details.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create NFT Tab */}
        {activeTab === 'create' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Create NFT (Draft)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  placeholder="Enter NFT name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                <input
                  type="text"
                  name="image_url"
                  value={createForm.image_url}
                  onChange={handleCreateChange}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (KRSI)</label>
                <input
                  type="number"
                  step="0.000001"
                  name="price_krsi"
                  value={createForm.price_krsi}
                  onChange={handleCreateChange}
                  placeholder="e.g. 1.25"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  name="description"
                  value={createForm.description}
                  onChange={handleCreateChange}
                  rows={3}
                  placeholder="Enter description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleCreateNFT}
                  disabled={creating || !createForm.name}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                >
                  {creating ? 'Creating...' : 'Create Draft NFT'}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Draft NFTs are stored in the database and require admin approval to be minted on-chain.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTMarketplace;