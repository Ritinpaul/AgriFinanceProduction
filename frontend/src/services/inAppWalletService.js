import { ethers } from 'ethers';

class InAppWalletService {
  constructor() {
    this.wallet = null;
    this.isInitialized = false;
    this.storageKey = 'inapp_wallet_data';
  }

  /**
   * Initialize in-app wallet service
   */
  async initialize() {
    try {
      console.log('🔐 Initializing in-app wallet service...');
      
      // Check if WebCrypto is available
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('WebCrypto API not available');
      }

      // Try to load existing wallet
      await this.loadWallet();
      
      this.isInitialized = true;
      console.log('✅ In-app wallet service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize in-app wallet service:', error);
      throw error;
    }
  }

  /**
   * Generate a new wallet using simple random generation
   */
  async generateWallet() {
    try {
      console.log('🔑 Generating new in-app wallet...');

      // Generate random bytes for private key using crypto.getRandomValues
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);

      // Convert to hex string
      const privateKeyHex = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Create ethers wallet
      const wallet = new ethers.Wallet('0x' + privateKeyHex);

      // Store wallet (no encryption for now to avoid WebCrypto issues)
      this.wallet = wallet;
      localStorage.setItem('inapp_wallet', JSON.stringify({
        address: wallet.address,
        privateKey: wallet.privateKey,
        created_at: Date.now()
      }));

      console.log('✅ In-app wallet generated:', wallet.address);

      return {
        success: true,
        address: wallet.address,
        wallet: wallet
      };

    } catch (error) {
      console.error('❌ Failed to generate wallet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load existing wallet from storage
   */
  async loadWallet() {
    try {
      const walletData = localStorage.getItem('inapp_wallet');
      if (!walletData) {
        console.log('No existing wallet found');
        return null;
      }

      console.log('🔓 Loading existing wallet...');
      
      const parsedData = JSON.parse(walletData);
      
      if (parsedData && parsedData.privateKey) {
        this.wallet = new ethers.Wallet(parsedData.privateKey);
        console.log('✅ Wallet loaded:', this.wallet.address);
        return this.wallet;
      }

      return null;

    } catch (error) {
      console.error('❌ Failed to load wallet:', error);
      return null;
    }
  }

  /**
   * Encrypt and store wallet data
   */
  async encryptAndStoreWallet(wallet) {
    try {
      const walletData = {
        privateKey: wallet.privateKey,
        address: wallet.address,
        createdAt: Date.now()
      };

      // Create a simple encryption key from user's browser fingerprint
      const key = await this.generateEncryptionKey();
      
      // Encrypt the data
      const encryptedData = await this.encryptData(JSON.stringify(walletData), key);
      
      // Store encrypted data
      localStorage.setItem(this.storageKey, encryptedData);
      
      console.log('✅ Wallet encrypted and stored');

    } catch (error) {
      console.error('❌ Failed to encrypt and store wallet:', error);
      throw error;
    }
  }

  /**
   * Decrypt wallet data
   */
  async decryptWalletData(encryptedData) {
    try {
      const key = await this.generateEncryptionKey();
      const decryptedData = await this.decryptData(encryptedData, key);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('❌ Failed to decrypt wallet data:', error);
      throw error;
    }
  }

  /**
   * Generate encryption key from browser fingerprint
   */
  async generateEncryptionKey() {
    try {
      // Create a deterministic key from browser characteristics
      const fingerprint = this.getBrowserFingerprint();
      
      // Use PBKDF2 to derive key from fingerprint
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(fingerprint),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode('agrifinance-wallet-salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      return key;

    } catch (error) {
      console.error('❌ Failed to generate encryption key:', error);
      throw error;
    }
  }

  /**
   * Get browser fingerprint for encryption
   */
  getBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('AgriFinance Wallet', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    return fingerprint;
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encryptData(data, key) {
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        new TextEncoder().encode(data)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));

    } catch (error) {
      console.error('❌ Failed to encrypt data:', error);
      throw error;
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decryptData(encryptedData, key) {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);

    } catch (error) {
      console.error('❌ Failed to decrypt data:', error);
      throw error;
    }
  }

  /**
   * Get current wallet
   */
  getWallet() {
    return this.wallet;
  }

  /**
   * Get wallet address
   */
  getAddress() {
    return this.wallet?.address || null;
  }

  /**
   * Check if wallet exists
   */
  hasWallet() {
    return !!this.wallet;
  }

  /**
   * Create a transaction
   */
  async createTransaction(to, value, data = '0x') {
    try {
      if (!this.wallet) {
        throw new Error('No wallet available');
      }

      const transaction = {
        to: to,
        value: ethers.parseEther(value.toString()),
        data: data,
        gasLimit: 21000, // Default gas limit
      };

      return {
        success: true,
        transaction: transaction
      };

    } catch (error) {
      console.error('❌ Failed to create transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(transaction) {
    try {
      if (!this.wallet) {
        throw new Error('No wallet available');
      }

      const signedTx = await this.wallet.signTransaction(transaction);
      
      return {
        success: true,
        signedTransaction: signedTx
      };

    } catch (error) {
      console.error('❌ Failed to sign transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message) {
    try {
      if (!this.wallet) {
        throw new Error('No wallet available');
      }

      const signature = await this.wallet.signMessage(message);
      
      return {
        success: true,
        signature: signature
      };

    } catch (error) {
      console.error('❌ Failed to sign message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get wallet balance (requires provider)
   */
  async getBalance(provider) {
    try {
      if (!this.wallet || !provider) {
        throw new Error('No wallet or provider available');
      }

      const balance = await provider.getBalance(this.wallet.address);
      
      return {
        success: true,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString()
      };

    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export wallet (for backup)
   */
  async exportWallet() {
    try {
      if (!this.wallet) {
        throw new Error('No wallet available');
      }

      // Return wallet data (in production, this should be encrypted)
      return {
        success: true,
        walletData: {
          address: this.wallet.address,
          privateKey: this.wallet.privateKey,
          mnemonic: this.wallet.mnemonic?.phrase || null
        }
      };

    } catch (error) {
      console.error('❌ Failed to export wallet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear wallet from storage
   */
  clearWallet() {
    try {
      localStorage.removeItem(this.storageKey);
      this.wallet = null;
      this.isInitialized = false;
      
      console.log('✅ Wallet cleared from storage');
      
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to clear wallet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasWallet: this.hasWallet(),
      address: this.getAddress(),
      storageKey: this.storageKey
    };
  }
}

// Create singleton instance
const inAppWalletService = new InAppWalletService();

export default inAppWalletService;
