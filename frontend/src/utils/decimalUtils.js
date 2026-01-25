import { ethers } from 'ethers';

/**
 * Decimal Precision Utilities
 * Handles conversion between human-readable decimals and blockchain wei (6 decimals)
 * Prevents precision loss and calculation errors
 */

export class DecimalUtils {
  static DECIMALS = 6; // Changed from 18 to 6
  static WEI_MULTIPLIER = 10n ** BigInt(this.DECIMALS);

  /**
   * Convert human-readable amount to wei (blockchain format)
   * @param {string|number} amount - Human readable amount (e.g., "1.5")
   * @returns {string} - Wei amount as string
   */
  static toWei(amount) {
    try {
      if (amount === null || amount === undefined || amount === '') {
        return '0';
      }
      
      // Convert to string to handle both number and string inputs
      const amountStr = String(amount).trim();
      
      if (amountStr === '0' || amountStr === '') {
        return '0';
      }

      // Use ethers for precise conversion
      return ethers.parseUnits(amountStr, this.DECIMALS).toString();
    } catch (error) {
      console.error('Error converting to wei:', error);
      throw new Error(`Invalid amount format: ${amount}`);
    }
  }

  /**
   * Convert wei (blockchain format) to human-readable amount
   * @param {string|BigInt} weiAmount - Wei amount
   * @param {number} decimals - Number of decimal places to show (default: 4)
   * @returns {string} - Human readable amount
   */
  static fromWei(weiAmount, decimals = 4) {
    try {
      if (!weiAmount || weiAmount === '0' || weiAmount === 0n) {
        return '0.0000';
      }

      // Convert to BigInt if it's a string
      const weiBigInt = typeof weiAmount === 'string' ? BigInt(weiAmount) : weiAmount;
      
      // Use ethers for precise conversion
      const formatted = ethers.formatUnits(weiBigInt, this.DECIMALS);
      
      // Round to specified decimal places
      const num = parseFloat(formatted);
      return num.toFixed(decimals);
    } catch (error) {
      console.error('Error converting from wei:', error);
      return '0.0000';
    }
  }

  /**
   * Add two amounts (handles both wei and human-readable)
   * @param {string} amount1 - First amount
   * @param {string} amount2 - Second amount
   * @param {boolean} isWei - Whether amounts are in wei format
   * @returns {string} - Sum as string
   */
  static add(amount1, amount2, isWei = false) {
    try {
      if (isWei) {
        const sum = BigInt(amount1 || '0') + BigInt(amount2 || '0');
        return sum.toString();
      } else {
        const wei1 = this.toWei(amount1);
        const wei2 = this.toWei(amount2);
        const sum = BigInt(wei1) + BigInt(wei2);
        return this.fromWei(sum.toString());
      }
    } catch (error) {
      console.error('Error adding amounts:', error);
      return isWei ? '0' : '0.0000';
    }
  }

  /**
   * Subtract two amounts (handles both wei and human-readable)
   * @param {string} amount1 - First amount
   * @param {string} amount2 - Second amount
   * @param {boolean} isWei - Whether amounts are in wei format
   * @returns {string} - Difference as string
   */
  static subtract(amount1, amount2, isWei = false) {
    try {
      if (isWei) {
        const diff = BigInt(amount1 || '0') - BigInt(amount2 || '0');
        return diff.toString();
      } else {
        const wei1 = this.toWei(amount1);
        const wei2 = this.toWei(amount2);
        const diff = BigInt(wei1) - BigInt(wei2);
        return this.fromWei(diff.toString());
      }
    } catch (error) {
      console.error('Error subtracting amounts:', error);
      return isWei ? '0' : '0.0000';
    }
  }

  /**
   * Multiply amount by a factor
   * @param {string} amount - Amount to multiply
   * @param {number} factor - Multiplication factor
   * @param {boolean} isWei - Whether amount is in wei format
   * @returns {string} - Product as string
   */
  static multiply(amount, factor, isWei = false) {
    try {
      if (isWei) {
        const product = BigInt(amount || '0') * BigInt(Math.floor(factor * 10000)) / 10000n;
        return product.toString();
      } else {
        const wei = this.toWei(amount);
        const product = BigInt(wei) * BigInt(Math.floor(factor * 10000)) / 10000n;
        return this.fromWei(product.toString());
      }
    } catch (error) {
      console.error('Error multiplying amount:', error);
      return isWei ? '0' : '0.0000';
    }
  }

  /**
   * Compare two amounts
   * @param {string} amount1 - First amount
   * @param {string} amount2 - Second amount
   * @param {boolean} isWei - Whether amounts are in wei format
   * @returns {number} - -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
   */
  static compare(amount1, amount2, isWei = false) {
    try {
      if (isWei) {
        const big1 = BigInt(amount1 || '0');
        const big2 = BigInt(amount2 || '0');
        return big1 < big2 ? -1 : big1 > big2 ? 1 : 0;
      } else {
        const wei1 = this.toWei(amount1);
        const wei2 = this.toWei(amount2);
        const big1 = BigInt(wei1);
        const big2 = BigInt(wei2);
        return big1 < big2 ? -1 : big1 > big2 ? 1 : 0;
      }
    } catch (error) {
      console.error('Error comparing amounts:', error);
      return 0;
    }
  }

  /**
   * Validate amount format
   * @param {string} amount - Amount to validate
   * @param {number} maxDecimals - Maximum decimal places allowed
   * @returns {boolean} - Whether amount is valid
   */
  static isValidAmount(amount, maxDecimals = 6) {
    try {
      if (!amount || amount === '') return false;
      
      const amountStr = String(amount).trim();
      const regex = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
      
      if (!regex.test(amountStr)) return false;
      
      const num = parseFloat(amountStr);
      return !isNaN(num) && num >= 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format amount for display with proper precision
   * @param {string} amount - Amount to format
   * @param {number} decimals - Decimal places to show
   * @param {boolean} isWei - Whether amount is in wei format
   * @returns {string} - Formatted amount
   */
  static formatDisplay(amount, decimals = 4, isWei = false) {
    try {
      const displayAmount = isWei ? this.fromWei(amount, decimals) : amount;
      const num = parseFloat(displayAmount);
      
      if (isNaN(num)) return '0.0000';
      
      // Add thousand separators
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } catch (error) {
      console.error('Error formatting amount:', error);
      return '0.0000';
    }
  }

  /**
   * Convert database DECIMAL to wei string
   * @param {string|number} dbAmount - Database amount
   * @returns {string} - Wei amount as string
   */
  static dbToWei(dbAmount) {
    return this.toWei(dbAmount);
  }

  /**
   * Convert wei string to database DECIMAL format
   * @param {string} weiAmount - Wei amount
   * @returns {string} - Database DECIMAL format
   */
  static weiToDb(weiAmount) {
    return this.fromWei(weiAmount, 18);
  }

  /**
   * Get maximum safe amount for a given precision
   * @param {number} decimals - Decimal precision
   * @returns {string} - Maximum safe amount
   */
  static getMaxSafeAmount(decimals = 6) {
    const maxWei = BigInt(2) ** BigInt(256) - 1n;
    return this.fromWei(maxWei.toString(), decimals);
  }
}

/**
 * React hook for decimal utilities
 */
export const useDecimalUtils = () => {
  return DecimalUtils;
};

/**
 * Validation helpers
 */
export const AmountValidation = {
  /**
   * Validate form input amount
   */
  validateInput: (value, maxDecimals = 6) => {
    if (!value || value === '') return { valid: true, error: null };
    
    const trimmed = value.trim();
    
    // Check for valid number format
    if (!DecimalUtils.isValidAmount(trimmed, maxDecimals)) {
      return { 
        valid: false, 
        error: `Invalid amount format. Use numbers only with up to ${maxDecimals} decimal places.` 
      };
    }
    
    // Check for reasonable range
    const num = parseFloat(trimmed);
    if (num < 0) {
      return { valid: false, error: 'Amount cannot be negative.' };
    }
    
    if (num > 1000000) {
      return { valid: false, error: 'Amount too large. Maximum is 1,000,000.' };
    }
    
    return { valid: true, error: null };
  },

  /**
   * Format input value for display
   */
  formatInput: (value) => {
    if (!value) return '';
    
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  }
};
