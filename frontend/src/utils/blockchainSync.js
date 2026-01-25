// Blockchain Sync Service
// Handles synchronization between blockchain and database

import { api } from '../lib/api';

class BlockchainSync {
  constructor(provider, contractAddresses) {
    this.provider = provider;
    this.contractAddresses = contractAddresses;
  }

  // Sync wallet transactions
  async syncWalletTransactions(userId) {
    try {
      const response = await api.post(`/blockchain/sync-wallet/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Sync NFT transactions
  async syncNFTTransactions(userId) {
    try {
      const response = await api.post(`/blockchain/sync-nft/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Sync loan transactions
  async syncLoanTransactions(userId) {
    try {
      const response = await api.post(`/blockchain/sync-loan/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Get pending transactions
  async getPendingTransactions(userId) {
    try {
      const response = await api.get(`/blockchain/pending/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Process pending transaction
  async processPendingTransaction(transactionId) {
    try {
      const response = await api.post(`/blockchain/process/${transactionId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Get transaction history
  async getTransactionHistory(userId, type = 'all') {
    try {
      const response = await api.get(`/blockchain/history/${userId}?type=${type}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Sync all user data
  async syncAllUserData(userId) {
    try {
      const response = await api.post(`/blockchain/sync-all/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }
}

export const useBlockchainSync = (provider, contractAddresses) => {
  return new BlockchainSync(provider, contractAddresses);
};

export default BlockchainSync;