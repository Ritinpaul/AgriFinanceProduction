// Admin Approval Service
// Handles admin approval workflows for NFT purchases and minting

import { api } from '../lib/api';

class AdminApprovalService {
  constructor(web3Context) {
    this.web3Context = web3Context;
  }

  // Get pending approvals
  async getPendingApprovals() {
    try {
      const response = await api.get('/admin/approvals/pending');
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Create approval request
  async createApprovalRequest(userId, approvalType, requestData) {
    try {
      const response = await api.post('/admin/approvals/create', {
        userId,
        approvalType,
        requestData
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Approve request
  async approveRequest(approvalId, adminNotes = '') {
    try {
      const response = await api.post(`/admin/approvals/${approvalId}/approve`, {
        adminNotes
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Reject request
  async rejectRequest(approvalId, adminNotes = '') {
    try {
      const response = await api.post(`/admin/approvals/${approvalId}/reject`, {
        adminNotes
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Get user approvals
  async getUserApprovals(userId) {
    try {
      const response = await api.get(`/admin/approvals/user/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Process NFT purchase approval
  async processNFTPurchaseApproval(approvalId, nftId, buyerId) {
    try {
      const response = await api.post(`/admin/approvals/${approvalId}/process-nft-purchase`, {
        nftId,
        buyerId
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Process NFT minting approval
  async processNFTMintingApproval(approvalId, nftData, ownerId) {
    try {
      const response = await api.post(`/admin/approvals/${approvalId}/process-nft-minting`, {
        nftData,
        ownerId
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Process loan approval
  async processLoanApproval(approvalId, loanId) {
    try {
      const response = await api.post(`/admin/approvals/${approvalId}/process-loan`, {
        loanId
      });
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Get approval statistics
  async getApprovalStats() {
    try {
      const response = await api.get('/admin/approvals/stats');
      
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

export const useAdminApproval = (web3Context) => {
  return new AdminApprovalService(web3Context);
};

export default AdminApprovalService;