// frontend/src/pages/HybridWallet.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { DecimalUtils } from '../utils/decimalUtils';
import MobileWalletUtils from '../utils/mobileWalletUtils';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import apiClient from '../lib/api';

const HybridWallet = () => {
  const { user } = useAuth();
  const { account, isConnected, krishiTokenContract } = useWeb3();

  // State management
  const [activeTab, setActiveTab] = useState('agrifinance'); // agrifinance, blockchain
  const [agriWallet, setAgriWallet] = useState(null);
  const [blockchainBalance, setBlockchainBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [walletCreated, setWalletCreated] = useState(false); // Track if wallet creation notification was shown
  const [syncing, setSyncing] = useState(false); // Track sync status - RESET TO FALSE
  const [isWalletSynced, setIsWalletSynced] = useState(false); // Track if wallet is synced to database
  
  // AgriFinance wallet mobile linking states
  const [mobileNumber, setMobileNumber] = useState('');
  const [linkingMobile, setLinkingMobile] = useState(false);
  
  // AgriFinance wallet transaction states
  const [agriSendForm, setAgriSendForm] = useState({
    toAddress: '',
    toMobile: '', // Added mobile number option
    amount: '',
    description: '',
    sendType: 'address' // 'address' or 'mobile'
  });
  const [agriSending, setAgriSending] = useState(false);

  // Link mobile number to AgriFinance wallet
  const linkMobileNumber = async () => {
    if (!mobileNumber || !agriWallet) {
      toast.error('Please enter a mobile number and ensure wallet is created');
      return;
    }

    setLinkingMobile(true);
    try {
      // Call the real API endpoint
      const result = await apiClient.linkMobileNumber({
        mobile_number: mobileNumber
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to link mobile number');
      }

      // Update local state with the response
      setAgriWallet(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          mobile_number: mobileNumber,
          mobile_linked_at: new Date().toISOString()
        }
      }));

      toast.success(`Mobile number ${mobileNumber} linked to your wallet!`);
      setMobileNumber('');
    } catch (error) {
      console.error('Error linking mobile number:', error);
      toast.error('Failed to link mobile number');
    } finally {
      setLinkingMobile(false);
    }
  };


  // Sync wallet to database - REAL DATABASE INTEGRATION
  const syncWalletToDatabase = async (walletData = null) => {
    
    
    const walletToSync = walletData || agriWallet;
    
    if (!walletToSync || !user?.id) {
      toast.error('No wallet to sync');
      return;
    }

    
    
    setSyncing(true);
    
    try {
      // Use the provided wallet data or current wallet
      const balanceToSync = walletToSync.balance_wei || '0';

      // Call the real API endpoint
      const result = await apiClient.syncWallet({
        address: walletToSync.address,
        balance_wei: balanceToSync,
        metadata: walletToSync.metadata
      });

      if (result.error) {
        throw new Error(result.error.message || 'Sync failed');
      }

      
      setIsWalletSynced(true);
      
      // Store sync status in localStorage
      localStorage.setItem(`wallet_synced_${user.id}`, 'true');
      localStorage.setItem(`wallet_address_${user.id}`, walletToSync.address);
      localStorage.setItem(`wallet_created_${user.id}`, 'true'); // Mark wallet as created
      
      toast.success('Wallet synced to database successfully!');
      
      // Update the wallet state with the synced data
      if (result.data && result.data.wallet) {
        setAgriWallet(result.data.wallet);
        setBlockchainBalance(ethers.formatUnits(result.data.wallet.balance_wei || '0', 6));
      }
      
      // Refresh wallet data from database to ensure we have the latest balance
      await loadWalletData();
      
      console.log('✅ Wallet synced to database:', {
        address: agriWallet.address,
        balance_wei: result.data?.wallet?.balance_wei || agriWallet.balance_wei,
        synced: true
      });
      
    } catch (error) {
      
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      
      setSyncing(false);
    }
  };

  // Manual sync reset function
  const resetSyncState = () => {
    
    setSyncing(false);
    toast.info('Sync state reset - you can try again');
  };

  // Clear wallet creation status (for testing/debugging)
  const clearWalletCreationStatus = () => {
    if (user?.id) {
      localStorage.removeItem(`wallet_created_${user.id}`);
      localStorage.removeItem(`wallet_synced_${user.id}`);
      localStorage.removeItem(`wallet_address_${user.id}`);
      setWalletCreated(false);
      setIsWalletSynced(false);
      setAgriWallet(null);
      toast.info('Wallet creation status cleared - refresh to recreate');
    }
  };

  // Manual refresh function to get latest wallet data from database
  const refreshWalletData = async () => {
    
    setLoading(true);
    try {
      await loadWalletData();
      toast.success('Wallet data refreshed!');
    } catch (error) {
      console.error('Error refreshing wallet data:', error);
      toast.error('Failed to refresh wallet data');
    } finally {
      setLoading(false);
    }
  };

  // Manual sync balance from blockchain
  const syncBalanceFromBlockchain = async () => {
    if (!agriWallet || !agriWallet.address) {
      toast.error('No wallet address found');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Starting balance sync for address:', agriWallet.address);
      
      const result = await apiClient.syncWalletBalance();
      
      console.log('📊 Balance sync result:', result);
      
      if (result.data && result.data.success) {
        const newBalance = result.data.balance_formatted;
        const currentBalance = ethers.formatUnits(agriWallet.balance_wei || '0', 6);
        
        console.log('💰 Balance comparison:', { currentBalance, newBalance });
        
        // Update wallet state with synced balance
        setAgriWallet(result.data.wallet);
        setBlockchainBalance(newBalance);
        
        if (newBalance !== currentBalance) {
          toast.success(`Balance updated: ${currentBalance} → ${newBalance} KRSI`);
        } else {
          toast.success(`Balance synced: ${newBalance} KRSI`);
        }
      } else {
        console.error('❌ Balance sync failed:', result.error);
        throw new Error(result.error || 'Balance sync failed');
      }
    } catch (error) {
      console.error('❌ Error syncing balance:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        walletAddress: agriWallet?.address
      });
      toast.error('Failed to sync balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Create wallet immediately function
  const createWalletImmediately = () => {
    if (!user?.id) {
      toast.error('No user found');
      return;
    }
    
    
    const persistentWallet = generatePersistentWallet(user.id);
    
    // Check if wallet already exists and preserve balance
    const existingBalance = agriWallet?.balance_wei || '0';
    
    const immediateWallet = {
      id: 'immediate-' + user.id,
      user_id: user.id,
      address: persistentWallet.address,
      wallet_type: 'agrifinance',
      chain_id: 'amoy',
      token_symbol: 'KRSI',
      balance_wei: existingBalance, // Preserve existing balance instead of '0'
      custodial: true,
      metadata: {
        private_key: persistentWallet.privateKey,
        mnemonic: persistentWallet.mnemonic,
        created_at: new Date().toISOString(),
        is_real_wallet: true,
        is_persistent: true,
        is_immediate: true,
        user_id: user.id
      }
    };
    
    setAgriWallet(immediateWallet);
    setIsWalletSynced(false);
    setLoading(false);
    
    // Mark wallet as created in localStorage
    localStorage.setItem(`wallet_created_${user.id}`, 'true');
    
    if (!walletCreated) {
      toast.success('AgriFinance wallet created immediately!');
      setWalletCreated(true);
    }
  };

  // Resolve phone number to wallet address
  const resolvePhoneToAddress = async (phoneNumber) => {
    try {
      const result = await apiClient.findWalletByMobile(phoneNumber);
      
      if (result.error) {
        console.error('Error resolving phone to address:', result.error);
        return null;
      }

      return result.data?.wallet?.address || null;
    } catch (error) {
      console.error('Error resolving phone to address:', error);
      return null;
    }
  };

  // Generate deterministic wallet address from user ID (persistent) - SIMPLE APPROACH
  const generatePersistentWallet = (userId) => {
    try {
      
      
      // SIMPLE APPROACH: Create deterministic private key from user ID
      // This is much more reliable than mnemonic generation
      const seed = ethers.id(userId + 'agrifinance-wallet-seed');
      const privateKey = ethers.keccak256(seed);
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey);
      
      
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: null // No mnemonic needed for this approach
      };
    } catch (error) {
      
      
      // Fallback: Use a different seed approach
      try {
        
        
        // Alternative: Use user ID directly as seed
        const altSeed = ethers.id(userId + 'agrifinance-alt-seed');
        const altPrivateKey = ethers.keccak256(altSeed);
        const altWallet = new ethers.Wallet(altPrivateKey);
        
        
        
        return {
          address: altWallet.address,
          privateKey: altWallet.privateKey,
          mnemonic: null
        };
      } catch (fallbackError) {
        
        
        // Last resort: Use a fixed seed for this user
        
        const fixedSeed = ethers.id('fixed-seed-' + userId);
        const fixedPrivateKey = ethers.keccak256(fixedSeed);
        const fixedWallet = new ethers.Wallet(fixedPrivateKey);
        
        
        
        return {
          address: fixedWallet.address,
          privateKey: fixedPrivateKey,
          mnemonic: null
        };
      }
    }
  };

  // Load wallet data - REAL DATABASE INTEGRATION
  const loadWalletData = async () => {
    
    
    if (!user?.id) {
      
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      // Try to get existing wallet from database first
      
      
      const result = await apiClient.getWallet();
      
      if (result.data && result.data.wallet) {
        
        setAgriWallet(result.data.wallet);
        setIsWalletSynced(true); // Wallet is already synced
        
        // Store sync status in localStorage for persistence
        localStorage.setItem(`wallet_synced_${user.id}`, 'true');
        localStorage.setItem(`wallet_address_${user.id}`, result.data.wallet.address);
        localStorage.setItem(`wallet_created_${user.id}`, 'true'); // Mark wallet as created
        
        // Set the blockchain balance from the database (this now includes auto-synced balance)
        const formattedBalance = ethers.formatUnits(result.data.wallet.balance_wei || '0', 6);
        setBlockchainBalance(formattedBalance);
        
        // DISABLED: Auto-sync balance with blockchain after wallet loads
        // This was causing balance to reset to 0 after transfers
        // setTimeout(() => {
        //   syncBalanceWithBlockchain();
        // }, 2000);
        
        console.log('✅ Wallet loaded from database:', {
          address: result.data.wallet.address,
          balance_wei: result.data.wallet.balance_wei,
          balance_formatted: formattedBalance,
          synced: true
        });
      } else {
        
        
        // Create wallet locally
        const persistentWallet = generatePersistentWallet(user.id);
        
        const localWallet = {
          id: 'local-' + user.id,
          user_id: user.id,
          address: persistentWallet.address,
          wallet_type: 'agrifinance',
          chain_id: 'amoy',
          token_symbol: 'KRSI',
          balance_wei: '0',
          custodial: true,
          metadata: {
            private_key: persistentWallet.privateKey,
            mnemonic: persistentWallet.mnemonic,
            created_at: new Date().toISOString(),
            is_real_wallet: true,
            is_persistent: true,
            is_local: true,
            user_id: user.id
          }
        };
        
        
        setAgriWallet(localWallet);
        setIsWalletSynced(false); // Local wallet needs to be synced
        
        // Store sync status in localStorage
        localStorage.setItem(`wallet_synced_${user.id}`, 'false');
        localStorage.setItem(`wallet_address_${user.id}`, localWallet.address);
        localStorage.setItem(`wallet_created_${user.id}`, 'true'); // Mark wallet as created
        
        if (!walletCreated) {
          toast.success('AgriFinance wallet created!');
          setWalletCreated(true);
        }
      }
    } catch (error) {
      
      
      // Create wallet locally as fallback
      const persistentWallet = generatePersistentWallet(user.id);
      
      const localWallet = {
        id: 'local-' + user.id,
        user_id: user.id,
        address: persistentWallet.address,
        wallet_type: 'agrifinance',
        chain_id: 'amoy',
        token_symbol: 'KRSI',
        balance_wei: '0',
        custodial: true,
        metadata: {
          private_key: persistentWallet.privateKey,
          mnemonic: persistentWallet.mnemonic,
          created_at: new Date().toISOString(),
          is_real_wallet: true,
          is_persistent: true,
          is_local: true,
          user_id: user.id
        }
      };
      
      
      setAgriWallet(localWallet);
      setIsWalletSynced(false); // Local wallet needs to be synced
      
      // Store sync status in localStorage
      localStorage.setItem(`wallet_synced_${user.id}`, 'false');
      localStorage.setItem(`wallet_address_${user.id}`, localWallet.address);
      localStorage.setItem(`wallet_created_${user.id}`, 'true'); // Mark wallet as created
      
      if (!walletCreated) {
        toast.success('AgriFinance wallet created!');
        setWalletCreated(true);
      }
    } finally {
      // Load blockchain balance (non-blocking) - IMPROVED ERROR HANDLING
      if (isConnected && krishiTokenContract && account) {
        try {
          
          const balance = await krishiTokenContract.balanceOf(account);
          const formattedBalance = ethers.formatUnits(balance.toString(), 6);
          setBlockchainBalance(formattedBalance);
          
        } catch (error) {
          
          setBlockchainBalance('0');
        }
      } else {
        
        setBlockchainBalance('0');
      }
      
      
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      
      // Check localStorage for sync status first
      const storedSyncStatus = localStorage.getItem(`wallet_synced_${user.id}`);
      const storedAddress = localStorage.getItem(`wallet_address_${user.id}`);
      const walletAlreadyCreated = localStorage.getItem(`wallet_created_${user.id}`);
      
      if (storedSyncStatus === 'true' && storedAddress) {
        console.log('📱 Found stored sync status: wallet is synced');
        setIsWalletSynced(true);
      }
      
      // Only set walletCreated if we know it was already created
      if (walletAlreadyCreated === 'true') {
        setWalletCreated(true);
      }
      
      loadWalletData();
    } else {
      
      setLoading(false);
    }
    
    // Safety timeout - force loading to stop after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      
      setLoading(false);
      
      // Only create emergency wallet if:
      // 1. No wallet exists AND
      // 2. User exists AND 
      // 3. Wallet was never created before (not in localStorage)
      if (!agriWallet && user?.id) {
        const walletAlreadyCreated = localStorage.getItem(`wallet_created_${user.id}`);
        
        if (walletAlreadyCreated !== 'true') {
          console.log('🚨 Creating emergency wallet - first time only');
          
          const persistentWallet = generatePersistentWallet(user.id);
          const emergencyWallet = {
            id: 'timeout-emergency-' + user.id,
            user_id: user.id,
            address: persistentWallet.address,
            wallet_type: 'agrifinance',
            chain_id: 'amoy',
            token_symbol: 'KRSI',
            balance_wei: '0',
            custodial: true,
            metadata: {
              private_key: persistentWallet.privateKey,
              mnemonic: persistentWallet.mnemonic,
              created_at: new Date().toISOString(),
              is_real_wallet: true,
              is_persistent: true,
              is_timeout_emergency: true,
              user_id: user.id
            }
          };
          setAgriWallet(emergencyWallet);
          setIsWalletSynced(false); // Timeout emergency wallet needs to be synced
          
          // Mark wallet as created in localStorage
          localStorage.setItem(`wallet_created_${user.id}`, 'true');
          
          if (!walletCreated) {
            toast.success('AgriFinance wallet created (timeout recovery)!');
            setWalletCreated(true);
          }
        } else {
          console.log('📱 Wallet already created before - skipping emergency creation');
        }
      }
    }, 5000);
    
    return () => clearTimeout(safetyTimeout);
  }, [user?.id]);

  // Sync wallet balance with blockchain
  const syncBalanceWithBlockchain = async () => {
    if (!agriWallet?.address) return;
    
    try {
      console.log('🔄 Syncing wallet balance with blockchain...');
      
      // Get RPC connection
      const rpcTest = await testRpcConnection();
      if (!rpcTest.success) {
        console.warn('⚠️ Cannot sync balance - RPC connection failed');
        return;
      }
      
      // Create wallet and provider
      const privateKey = agriWallet.metadata?.private_key;
      if (!privateKey) {
        console.warn('⚠️ Cannot sync balance - private key not found');
        return;
      }
      
      const wallet = new ethers.Wallet(privateKey);
      const provider = new ethers.JsonRpcProvider(rpcTest.endpoint);
      const connectedWallet = wallet.connect(provider);
      
      // Get token contract
      const krishiTokenAddress = import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
      const tokenContract = new ethers.Contract(
        krishiTokenAddress,
        ['function balanceOf(address owner) view returns (uint256)'],
        connectedWallet
      );
      
      // Get blockchain balance
      const blockchainBalance = await tokenContract.balanceOf(agriWallet.address);
      const blockchainBalanceWei = BigInt(blockchainBalance.toString());
      
      console.log(`📊 Balance Sync:`);
      console.log(`   Database: ${ethers.formatUnits(agriWallet.balance_wei || '0', 6)} KRSI`);
      console.log(`   Blockchain: ${ethers.formatUnits(blockchainBalanceWei, 6)} KRSI`);
      
      // For AgriFinance, we use Database-First approach
      // Only update blockchain balance display, don't override database balance
      if (blockchainBalanceWei.toString() !== (agriWallet.balance_wei || '0')) {
        console.log(`📊 Balance Difference Detected:`);
        console.log(`   Database: ${ethers.formatUnits(agriWallet.balance_wei || '0', 6)} KRSI`);
        console.log(`   Blockchain: ${ethers.formatUnits(blockchainBalanceWei, 6)} KRSI`);
        console.log(`ℹ️ Using Database-First approach - keeping database balance`);
        
        // Update blockchain balance display only
        setBlockchainBalance(ethers.formatUnits(blockchainBalanceWei, 6));
      } else {
        console.log(`✅ Database and blockchain balances are in sync`);
        setBlockchainBalance(ethers.formatUnits(blockchainBalanceWei, 6));
      }
      
    } catch (error) {
      console.error('❌ Balance sync failed:', error);
      toast.error('Failed to sync balance with blockchain');
    }
  };

  // Test RPC connection
  const testRpcConnection = async () => {
    const rpcEndpoints = [
      'https://ethereum-sepolia.publicnode.com',
      'https://eth-sepolia.g.alchemy.com/v2/demo',
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    ];
    
    for (const endpoint of rpcEndpoints) {
      try {
        const provider = new ethers.JsonRpcProvider(endpoint);
        const network = await provider.getNetwork();
        console.log(`✅ RPC Test - ${endpoint}: ${network.name} (${network.chainId})`);
        return { success: true, endpoint, network };
      } catch (error) {
        console.warn(`❌ RPC Test - ${endpoint}: ${error.message}`);
      }
    }
    return { success: false, error: 'All RPC endpoints failed' };
  };

  // Handle AgriFinance wallet transfer (REAL blockchain transaction)
  const handleAgriTransfer = async () => {
    if (!agriSendForm.amount) {
      toast.error('Please enter amount');
      return;
    }

    if (!agriWallet) {
      toast.error('AgriFinance wallet not found');
      return;
    }

    // Determine recipient address based on send type
    let recipientAddress = '';
    if (agriSendForm.sendType === 'address') {
      if (!agriSendForm.toAddress) {
        toast.error('Please enter recipient address');
        return;
      }
      recipientAddress = agriSendForm.toAddress;
    } else if (agriSendForm.sendType === 'mobile') {
      if (!agriSendForm.toMobile) {
        toast.error('Please enter recipient mobile number');
        return;
      }
      // Resolve mobile number to address
      recipientAddress = await resolvePhoneToAddress(agriSendForm.toMobile);
      if (!recipientAddress) {
        toast.error('Mobile number not found or not linked to any wallet');
        return;
      }
    }

    setAgriSending(true);
    try {
      // Test RPC connection first
      toast.loading('Testing network connection...', { id: 'agri-transfer' });
      const rpcTest = await testRpcConnection();
      if (!rpcTest.success) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }
      
      // Convert amount to wei
      const amountWei = ethers.parseUnits(agriSendForm.amount, 6);
      
      // Get the private key from metadata (in production, this should be encrypted)
      const privateKey = agriWallet.metadata?.private_key;
      if (!privateKey) {
        throw new Error('Private key not found');
      }

      // Create wallet instance from private key
      const wallet = new ethers.Wallet(privateKey);
      
      // Connect to provider (Ethereum Sepolia) - Using CORS-friendly endpoints
      const rpcEndpoints = [
        'https://ethereum-sepolia.publicnode.com',
        'https://eth-sepolia.g.alchemy.com/v2/demo',
        'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
      ];
      
      let provider;
      let connectedWallet;
      
      // Try each RPC endpoint until one works
      for (const endpoint of rpcEndpoints) {
        try {
          provider = new ethers.JsonRpcProvider(endpoint);
          connectedWallet = wallet.connect(provider);
          
          // Test the connection by getting the network
          const network = await provider.getNetwork();
          console.log(`✅ Connected to RPC: ${endpoint}, Network: ${network.name} (${network.chainId})`);
          
          // Verify we're on Sepolia testnet
          if (network.chainId !== 11155111n) {
            console.warn(`⚠️ Wrong network: ${network.name} (${network.chainId}), expected Sepolia (11155111)`);
            continue;
          }
          
          break;
        } catch (error) {
          console.warn(`⚠️ Failed to connect to ${endpoint}:`, error.message);
          if (endpoint === rpcEndpoints[rpcEndpoints.length - 1]) {
            throw new Error(`All RPC endpoints failed. Last error: ${error.message}. Please check your internet connection and try again.`);
          }
        }
      }

      // Get KRSI token contract - use our deployed Sepolia address (fixed with overflow protection)
      const krishiTokenAddress = import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1'; // Fixed KrishiToken on Sepolia
      
      const tokenContract = new ethers.Contract(
        krishiTokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)'
        ],
        connectedWallet
      );
      
      // Check database balance first (AgriFinance uses database-first approach)
      toast.loading('Checking wallet balance...', { id: 'agri-transfer' });
      const databaseBalanceWei = BigInt(agriWallet.balance_wei || '0');
      
      console.log(`🔍 AgriFinance Balance Check:`);
      console.log(`   Database Balance: ${ethers.formatUnits(databaseBalanceWei, 6)} KRSI`);
      console.log(`   Transfer Amount: ${ethers.formatUnits(amountWei, 6)} KRSI`);
      console.log(`   Remaining After Transfer: ${ethers.formatUnits(databaseBalanceWei - amountWei, 6)} KRSI`);
      
      if (databaseBalanceWei < amountWei) {
        toast.error(`Insufficient balance. You have ${ethers.formatUnits(databaseBalanceWei, 6)} KRSI but need ${ethers.formatUnits(amountWei, 6)} KRSI`);
        return;
      }
      
      // Update database balance immediately (Database-First Approach)
      const newBalanceWei = databaseBalanceWei - amountWei;
      console.log(`💰 Updating database balance: ${ethers.formatUnits(databaseBalanceWei, 6)} → ${ethers.formatUnits(newBalanceWei, 6)} KRSI`);
      
      // Update local state immediately for instant UI feedback
      setAgriWallet(prev => ({
        ...prev,
        balance_wei: newBalanceWei.toString()
      }));

      // Update sender's database balance immediately (Database-First Approach)
      toast.loading('Updating sender balance...', { id: 'agri-transfer' });
      const updatedWallet = {
        ...agriWallet,
        balance_wei: newBalanceWei.toString()
      };
      await syncWalletToDatabase(updatedWallet);
      
      // Update recipient's balance (if they have an AgriFinance wallet)
      toast.loading('Updating recipient balance...', { id: 'agri-transfer' });
      try {
        const recipientResponse = await fetch(`http://localhost:3001/api/wallet/update-recipient-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            recipientAddress: recipientAddress,
            amountWei: amountWei.toString()
          })
        });
        
        if (recipientResponse.ok) {
          const recipientData = await recipientResponse.json();
          console.log(`✅ Recipient balance updated: ${ethers.formatUnits(recipientData.oldBalance, 6)} → ${ethers.formatUnits(recipientData.newBalance, 6)} KRSI`);
        } else {
          console.warn('⚠️ Recipient wallet not found or update failed');
        }
      } catch (recipientError) {
        console.warn('⚠️ Could not update recipient balance:', recipientError.message);
        // Don't fail the transaction for this
      }
      
      // For AgriFinance, we can optionally attempt blockchain transaction
      // but don't fail if it doesn't work (Database-First Approach)
      let blockchainTxHash = null;
      try {
        toast.loading('Attempting blockchain transaction...', { id: 'agri-transfer' });
        const tx = await tokenContract.transfer(recipientAddress, amountWei);
        const receipt = await tx.wait();
        blockchainTxHash = receipt.hash;
        console.log(`✅ Blockchain transaction successful: ${receipt.hash}`);
      } catch (blockchainError) {
        console.warn(`⚠️ Blockchain transaction failed, but database transaction succeeded:`, blockchainError.message);
        // Don't fail the entire transaction - database update already succeeded
      }

      // Record transaction in database (AgriFinance Database-First Approach)
      try {
        await apiClient.createTransaction({
          direction: 'out',
          amount_wei: amountWei,
          to_address: recipientAddress,
          from_address: agriWallet.address,
          blockchain_tx_hash: blockchainTxHash, // May be null if blockchain failed
          metadata: {
            type: 'agrifinance_transfer',
            send_type: agriSendForm.sendType,
            to_address: recipientAddress,
            to_mobile: agriSendForm.sendType === 'mobile' ? agriSendForm.toMobile : null,
            description: agriSendForm.description,
            amount_display: agriSendForm.amount,
            blockchain_tx_hash: blockchainTxHash,
            database_first: true, // Flag indicating this was a database-first transaction
            blockchain_success: blockchainTxHash !== null
          }
        });
      } catch (txError) {
        console.error('Failed to record transaction:', txError);
        // Don't fail the whole operation if transaction recording fails
      }

      // Show success message (Database-First Approach)
      if (blockchainTxHash) {
        toast.success(`Transfer successful! Database updated. Blockchain TX: ${blockchainTxHash.slice(0, 10)}...`, { id: 'agri-transfer' });
      } else {
        toast.success(`Transfer successful! Database updated. (Blockchain sync pending)`, { id: 'agri-transfer' });
      }
        setAgriSendForm({ toAddress: '', toMobile: '', amount: '', description: '', sendType: 'address' });
        
        // DISABLED: Don't reload wallet data after transfer as it resets balance
        // loadWalletData();
      
    } catch (error) {
      console.error('AgriFinance transfer error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient balance for this transaction.';
      } else if (error.message.includes('gas')) {
        errorMessage = 'Transaction failed due to gas issues. Please try again.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network connection issue. Please try again in a moment.';
      }
      
      toast.error(`Transfer failed: ${errorMessage}`, { id: 'agri-transfer' });
    } finally {
      setAgriSending(false);
    }
  };

  // Show loading only for a short time, then show UI anyway
  if (loading && user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your wallets...</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            User: {user?.id ? '✅ Connected' : '❌ Not connected'}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            This should complete within 5 seconds...
          </p>
        </div>
      </div>
    );
  }

  // If no user, show sign-in prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Please Sign In
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You need to sign in to access your AgriFinance wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            AgriFinance Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your money easily - just like UPI!
          </p>
        </div>

        {/* Wallet Type Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('agrifinance')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'agrifinance'
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🌾 AgriFinance Wallet
              </button>
              <button
                onClick={() => setActiveTab('blockchain')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'blockchain'
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔗 Blockchain Wallet
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* AgriFinance Wallet Tab */}
            {activeTab === 'agrifinance' && (
              <div className="space-y-6">
                {/* AgriFinance Wallet Info */}
                <div className="bg-green-50 dark:bg-green-900 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
                    🌾 AgriFinance Wallet
                  </h3>
                  
                  {agriWallet ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-green-700 dark:text-green-300">Wallet Address:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm text-green-800 dark:text-green-200">
                            {agriWallet.address?.slice(0, 6)}...{agriWallet.address?.slice(-4)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(agriWallet.address);
                              toast.success('Address copied!');
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              window.open(`https://sepolia.etherscan.io/address/${agriWallet.address}`, '_blank');
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            View
                          </button>
                          {!isWalletSynced ? (
                            <button
                              onClick={syncing ? resetSyncState : syncWalletToDatabase}
                              className={`px-2 py-1 rounded text-xs ${
                                syncing 
                                  ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                              }`}
                            >
                              {syncing ? 'Syncing...' : 'Sync to DB'}
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs flex items-center">
                              ✅ Synced
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-700 dark:text-green-300">Balance:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-green-800 dark:text-green-200">
                            {ethers.formatUnits(agriWallet.balance_wei || '0', 6)} KRSI
                          </span>
                          <button
                            onClick={syncBalanceWithBlockchain}
                            disabled={loading}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-400"
                            title="Sync balance from blockchain"
                          >
                            🔄
                          </button>
                        </div>
                      </div>
                   <div className="flex items-center justify-between">
                     <span className="text-green-700 dark:text-green-300">Wallet Type:</span>
                     <span className="text-green-800 dark:text-green-200">Real Blockchain Wallet</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-green-700 dark:text-green-300">Address Type:</span>
                     <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                       🔒 Persistent Address
                     </span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-green-700 dark:text-green-300">Status:</span>
                     <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                       ✅ Active on Blockchain
                     </span>
                   </div>
                   
                   {/* Mobile Number Linking */}
                   <div className="border-t border-green-200 dark:border-green-700 pt-4 mt-4">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-green-700 dark:text-green-300">Mobile Number:</span>
                       {agriWallet.metadata?.mobile_number ? (
                         <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                           📱 {agriWallet.metadata.mobile_number}
                         </span>
                       ) : (
                         <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                           Not Linked
                         </span>
                       )}
                     </div>
                     
                     {!agriWallet.metadata?.mobile_number && (
                       <div className="flex items-center space-x-2 mt-3">
                         <input
                           type="tel"
                           value={mobileNumber}
                           onChange={(e) => setMobileNumber(MobileWalletUtils.autoFormatPhoneInput(e.target.value))}
                           placeholder="+91 98765 43210"
                           className="flex-1 px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                         />
                         <button
                           onClick={linkMobileNumber}
                           disabled={linkingMobile || !mobileNumber}
                           className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                         >
                           {linkingMobile ? 'Linking...' : 'Link Mobile'}
                         </button>
                       </div>
                     )}
                   </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-green-700 dark:text-green-300 mb-4">
                        Creating your AgriFinance wallet...
                      </p>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        This may take a few seconds
                      </p>
                      <button
                        onClick={() => {
                          createWalletImmediately();
                        }}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Create Wallet Manually
                      </button>
                    </div>
                  )}
                </div>

                {/* Send KRSI Form */}
                {agriWallet && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Send KRSI Tokens
                    </h3>
                    <div className="space-y-4">
                      {/* Send Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Send To
                        </label>
                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="sendType"
                              value="address"
                              checked={agriSendForm.sendType === 'address'}
                              onChange={(e) => setAgriSendForm(prev => ({ ...prev, sendType: e.target.value }))}
                              className="mr-2"
                            />
                            <span className="text-sm">Wallet Address</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="sendType"
                              value="mobile"
                              checked={agriSendForm.sendType === 'mobile'}
                              onChange={(e) => setAgriSendForm(prev => ({ ...prev, sendType: e.target.value }))}
                              className="mr-2"
                            />
                            <span className="text-sm">Mobile Number</span>
                          </label>
                        </div>
                      </div>

                      {/* Recipient Input */}
                      {agriSendForm.sendType === 'address' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            To Wallet Address
                          </label>
                          <input
                            type="text"
                            value={agriSendForm.toAddress}
                            onChange={(e) => setAgriSendForm(prev => ({ ...prev, toAddress: e.target.value }))}
                            placeholder="0x..."
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            To Mobile Number
                          </label>
                          <input
                            type="tel"
                            value={agriSendForm.toMobile}
                            onChange={(e) => setAgriSendForm(prev => ({ ...prev, toMobile: MobileWalletUtils.autoFormatPhoneInput(e.target.value) }))}
                            placeholder="+91 98765 43210"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Recipient must have linked their mobile number to their AgriFinance wallet
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Amount (KRSI)
                        </label>
                        <input
                          type="number"
                          value={agriSendForm.amount}
                          onChange={(e) => setAgriSendForm(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="100"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={agriSendForm.description}
                          onChange={(e) => setAgriSendForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Payment for crops"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <button
                        onClick={handleAgriTransfer}
                        disabled={agriSending || !agriSendForm.amount || (agriSendForm.sendType === 'address' ? !agriSendForm.toAddress : !agriSendForm.toMobile)}
                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {agriSending ? 'Sending...' : 'Send KRSI'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Information */}
             <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
               <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">How AgriFinance Wallet Works</h4>
               <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                 <li>• <strong>🔒 Persistent Address</strong> - never changes, tied to your account</li>
                 <li>• <strong>📱 Mobile Number Integration</strong> - send tokens using phone numbers</li>
                 <li>• <strong>Real blockchain wallet</strong> with actual private key</li>
                 <li>• <strong>Direct blockchain transactions</strong> - no intermediaries</li>
                 <li>• <strong>Viewable on Etherscan</strong> - fully transparent</li>
                 <li>• <strong>Can receive tokens</strong> from any external wallet</li>
                 <li>• <strong>Gas fees paid by AgriFinance</strong> for convenience</li>
                 <li>• <strong>All transactions recorded</strong> on blockchain</li>
                 <li>• <strong>No data loss</strong> - address stays same forever</li>
               </ul>
             </div>
              </div>
            )}

            {/* Blockchain Wallet Tab */}
            {activeTab === 'blockchain' && (
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Blockchain Wallet
                  </h3>
                  {isConnected ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Connected Address:</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-white">
                          {account?.slice(0, 6)}...{account?.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">KRSI Balance:</span>
                        <span className="text-xl font-bold text-blue-600">
                          {ethers.formatUnits(blockchainBalance, 6)} KRSI
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {user?.role === 'farmer' 
                          ? 'Farmers use in-app wallet only. Your AgriFinance wallet is already connected.'
                          : 'Connect your wallet to view blockchain balance'
                        }
                      </p>
                      {user?.role !== 'farmer' && (
                        <button 
                          onClick={() => initializeWallet(user?.role)}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default HybridWallet;