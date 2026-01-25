// Mobile Wallet Utility Functions
// Handles UPI-style mobile number wallet operations

import { api } from '../lib/api';

export class MobileWalletUtils {
  // Format mobile number for wallet ID
  static formatMobileWalletId(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add + if not present and starts with country code
    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
      }
    }
    
    return cleaned;
  }

  // Auto-format phone number input with +91 prefix
  static autoFormatPhoneInput(value) {
    // If already has +91 prefix, don't add it again
    if (value.includes('+91')) {
      // Extract digits after +91
      const afterPrefix = value.replace(/^\+91\s*/, '');
      const cleanDigits = afterPrefix.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = cleanDigits.slice(0, 10);
      return '+91 ' + limitedDigits;
    }
    
    // Remove all non-digit characters
    let digits = value.replace(/\D/g, '');
    
    // If empty, return empty
    if (!digits) return '';
    
    // If starts with 91 and has 12 digits, format as +91
    if (digits.startsWith('91') && digits.length === 12) {
      return '+91 ' + digits.slice(2);
    }
    
    // If has 10 digits, add +91 prefix
    if (digits.length === 10) {
      return '+91 ' + digits;
    }
    
    // Otherwise, limit to 10 digits and add +91
    const limitedDigits = digits.slice(0, 10);
    return '+91 ' + limitedDigits;
  }

  // Create a new mobile wallet
  static async createMobileWallet(userId, phoneNumber) {
    try {
      const response = await api.post('/wallet/create-mobile', {
        userId,
        phoneNumber
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

  // Find wallet by mobile number
  static async findWalletByMobile(phoneNumber) {
    try {
      const response = await api.get(`/wallet/find-by-mobile/${phoneNumber}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Process mobile transfer
  static async processMobileTransfer(fromUserId, toPhoneNumber, amountWei) {
    try {
      const response = await api.post('/wallet/mobile-transfer', {
        fromUserId,
        toPhoneNumber,
        amountWei
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

  // Get wallet balance
  static async getWalletBalance(userId) {
    try {
      const response = await api.get(`/wallet/balance/${userId}`);
      
      if (response.success) {
        return { data: response.data, error: null };
      } else {
        return { data: null, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      return { data: null, error: error.message || String(error) };
    }
  }

  // Get wallet transactions
  static async getWalletTransactions(userId) {
    try {
      const response = await api.get(`/wallet/transactions/${userId}`);
      
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

export default MobileWalletUtils;