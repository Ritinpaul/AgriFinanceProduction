// frontend/src/lib/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : '/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  // Set auth token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  // Get auth headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      // Keep minimal error propagation without noisy logs
      return { data: null, error: error.message || String(error) };
    }
  }

  // Farmer profile methods
  async getFarmerProfile() {
    return this.get('/farmer/profile');
  }

  async updateFarmerProfile(profileData) {
    return this.put('/farmer/profile', profileData);
  }

  async getFarmerStats() {
    return this.get('/farmer/stats');
  }

  async getFarmerLoans() {
    return this.get('/farmer/loans');
  }

  async getFarmerBatches() {
    return this.get('/farmer/batches');
  }

  async createFarmerBatch(batchData) {
    return this.post('/farmer/batches', batchData);
  }

  // Convenience methods for common HTTP verbs
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth methods
  async signUp(userData) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async signIn(credentials) {
    const result = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (result.data && result.data.token) {
      this.setToken(result.data.token);
    }
    
    return result;
  }

  async signOut() {
    const result = await this.request('/auth/signout', {
      method: 'POST',
    });
    
    this.setToken(null);
    return result;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Profile methods
  async updateProfile(profileData) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async getProfile() {
    return this.request('/profile');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Test connection
  async testConnection() {
    return this.request('/health');
  }

  // Wallet methods
  async syncWallet(walletData) {
    return this.request('/wallet/sync', {
      method: 'POST',
      body: JSON.stringify(walletData),
    });
  }

  async getWallet() {
    return this.request('/wallet');
  }

  async syncWalletBalance() {
    return this.request('/wallet/sync-balance', {
      method: 'POST',
    });
  }

  async updateWalletBalance(balanceData) {
    return this.request('/wallet/balance', {
      method: 'PUT',
      body: JSON.stringify(balanceData),
    });
  }

  async linkMobileNumber(mobileData) {
    return this.request('/wallet/link-mobile', {
      method: 'PUT',
      body: JSON.stringify(mobileData),
    });
  }

  async findWalletByMobile(mobile) {
    return this.request(`/wallet/find-by-mobile/${encodeURIComponent(mobile)}`);
  }

  async createTransaction(transactionData) {
    return this.request('/wallet/transaction', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async getTransactions() {
    return this.request('/wallet/transactions');
  }

  // Hybrid blockchain-database methods
  async transferTokens(transferData) {
    return this.request('/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify(transferData),
    });
  }

  async stakeTokens(stakeData) {
    return this.request('/wallet/stake', {
      method: 'POST',
      body: JSON.stringify(stakeData),
    });
  }

  async syncWithBlockchain() {
    return this.request('/wallet/sync-blockchain', {
      method: 'POST',
    });
  }

  async getStakingData() {
    return this.request('/wallet/staking-data');
  }

  async unstakeTokens(data) {
    return this.request('/wallet/unstake', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async claimStakingRewards() {
    return this.request('/wallet/claim-rewards', {
      method: 'POST',
    });
  }

  async verifyTransaction(txHash) {
    return this.request('/wallet/verify-transaction', {
      method: 'POST',
      body: JSON.stringify({ tx_hash: txHash }),
    });
  }

  // NFT methods
  async createNFT(nftData) {
    return this.request('/nfts', {
      method: 'POST',
      body: JSON.stringify(nftData),
    });
  }
  async purchaseNFT(purchaseData) {
    return this.request('/nft/purchase', {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });
  }

  async transferNFT(transferData) {
    return this.request('/nft/transfer', {
      method: 'POST',
      body: JSON.stringify(transferData),
    });
  }

  async setNFTPrice({ nft_id, token_id, price_wei }) {
    return this.request('/nft/set-price', {
      method: 'POST',
      body: JSON.stringify({ nft_id, token_id, price_wei }),
    });
  }

  async syncNFTWithBlockchain(nftId, tokenId) {
    return this.request('/nft/sync-blockchain', {
      method: 'POST',
      body: JSON.stringify({ nft_id: nftId, token_id: tokenId }),
    });
  }

  // DAO Methods
  async getDAOProposals(params = {}) {
    return this.get('/dao/proposals', params);
  }

  async createDAOProposal(proposalData) {
    return this.post('/dao/proposals', proposalData);
  }

  async voteOnProposal(proposalId, voteData) {
    return this.post(`/dao/proposals/${proposalId}/vote`, voteData);
  }

  async getDAOProfile() {
    return this.get('/dao/profile');
  }

  async updateDAOProfile(profileData) {
    return this.put('/dao/profile', profileData);
  }

  async getDAOMetrics() {
    return this.get('/dao/metrics');
  }

  async getDAOAnalytics(params = {}) {
    return this.get('/dao/analytics', params);
  }

  // Reconciliation methods
  async reconcileWallet() {
    return this.request('/reconciliation/wallet', {
      method: 'POST',
    });
  }

  async reconcileNFTs() {
    return this.request('/reconciliation/nfts', {
      method: 'POST',
    });
  }

  async getReconciliationStatus() {
    return this.request('/reconciliation/status');
  }

  async triggerReconciliation() {
    return this.request('/reconciliation/trigger', {
      method: 'POST',
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export { apiClient as api };
export default apiClient;
