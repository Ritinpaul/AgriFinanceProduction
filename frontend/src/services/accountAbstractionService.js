import { 
  BiconomySmartAccountV2, 
  DEFAULT_ENTRYPOINT_ADDRESS 
} from "@biconomy/account";
import { 
  Bundler 
} from "@biconomy/bundler";
import { 
  BiconomyPaymaster 
} from "@biconomy/paymaster";
import { ethers } from "ethers";

class AccountAbstractionService {
  constructor() {
    this.smartAccount = null;
    this.bundler = null;
    this.paymaster = null;
    this.provider = null;
    this.signer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the AA service with Biconomy configuration
   */
  async initialize() {
    try {
      console.log('🔐 Initializing Account Abstraction service...');

      // Get provider from window.ethereum
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        // capture signer for smart account creation
        try {
          this.signer = await this.provider.getSigner();
        } catch (e) {
          console.warn('Unable to get signer from provider:', e?.message || e);
        }
      } else {
        console.warn('MetaMask not found - Account Abstraction features will be limited');
        throw new Error('MetaMask not found');
      }

      // Initialize Bundler
      this.bundler = new Bundler({
        bundlerUrl: "https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44", // Sepolia testnet
        chainId: 11155111,
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
      });

      // Initialize Paymaster
      this.paymaster = new BiconomyPaymaster({
        paymasterUrl: "https://paymaster.biconomy.io/api/v1/11155111/5Hy8D3zN-.8c6c3a0f-41bd-af80-6877f74b8f44", // Sepolia testnet
      });

      this.isInitialized = true;
      console.log('✅ Account Abstraction service initialized successfully!');
      
    } catch (error) {
      console.error('❌ Failed to initialize AA service:', error);
      throw error;
    }
  }

  /**
   * Create a smart account for the user
   */
  async createSmartAccount(userAddress) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🏗️ Creating smart account for:', userAddress);

      // Ensure provider + signer exist (request accounts if needed)
      if (!this.provider || !this.signer) {
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
          } catch (e) {
            console.warn('Failed to obtain signer from MetaMask:', e?.message || e);
          }
        }
      }

      if (!this.signer || typeof this.signer.getAddress !== 'function') {
        throw new Error('No connected EOA signer available. Please connect MetaMask.');
      }

      const config = {
        chainId: 11155111, // Sepolia
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
        bundler: this.bundler,
        paymaster: this.paymaster,
        rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/" + (import.meta.env.VITE_ALCHEMY_API_KEY || "demo"),
        signer: this.signer,
      };

      this.smartAccount = new BiconomySmartAccountV2(config);
      // Initialize the smart account properly
      await this.smartAccount.init();

      console.log('✅ Smart account created:', await this.smartAccount.getAccountAddress());
      
      return {
        success: true,
        smartAccountAddress: await this.smartAccount.getAccountAddress(),
        smartAccount: this.smartAccount
      };

    } catch (error) {
      console.error('❌ Failed to create smart account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get or create smart account (handles initialization properly)
   */
  async getSmartAccount(userAddress) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.smartAccount) {
        return await this.createSmartAccount(userAddress);
      }

      return {
        success: true,
        smartAccountAddress: await this.smartAccount.getAccountAddress(),
        smartAccount: this.smartAccount
      };
    } catch (error) {
      console.error('❌ Failed to get smart account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send a gasless transaction
   */
  async sendGaslessTransaction(transaction) {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      console.log('⛽ Sending gasless transaction...');

      // Build the transaction
      const tx = {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0,
      };

      // Send the transaction
      const userOpResponse = await this.smartAccount.sendTransaction(tx);
      const txHash = await userOpResponse.wait();

      console.log('✅ Gasless transaction sent:', txHash);

      return {
        success: true,
        txHash: txHash,
        userOpHash: userOpResponse.userOpHash
      };

    } catch (error) {
      console.error('❌ Failed to send gasless transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send multiple transactions in a batch (gasless)
   */
  async sendBatchTransactions(transactions) {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      console.log('📦 Sending batch gasless transactions...');

      // Build transaction array
      const txArray = transactions.map(tx => ({
        to: tx.to,
        data: tx.data,
        value: tx.value || 0,
      }));

      // Send batch transaction
      const userOpResponse = await this.smartAccount.sendTransaction(txArray);
      const txHash = await userOpResponse.wait();

      console.log('✅ Batch gasless transactions sent:', txHash);

      return {
        success: true,
        txHash: txHash,
        userOpHash: userOpResponse.userOpHash
      };

    } catch (error) {
      console.error('❌ Failed to send batch gasless transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get smart account address
   */
  async getSmartAccountAddress() {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      return await this.smartAccount.getAccountAddress();
    } catch (error) {
      console.error('❌ Failed to get smart account address:', error);
      return null;
    }
  }

  /**
   * Check if smart account is deployed
   */
  async isSmartAccountDeployed() {
    try {
      if (!this.smartAccount) {
        return false;
      }

      return await this.smartAccount.isAccountDeployed();
    } catch (error) {
      console.error('❌ Failed to check smart account deployment:', error);
      return false;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance() {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      const address = await this.smartAccount.getAccountAddress();
      const balance = await this.provider.getBalance(address);
      
      return {
        success: true,
        balance: ethers.formatEther(balance),
        address: address
      };
    } catch (error) {
      console.error('❌ Failed to get account balance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction) {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      const tx = {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0,
      };

      const gasEstimate = await this.smartAccount.estimateUserOperationGas(tx);
      
      return {
        success: true,
        gasEstimate: gasEstimate
      };
    } catch (error) {
      console.error('❌ Failed to estimate gas:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a session key for the smart account
   */
  async createSessionKey(permissions = {}) {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      console.log('🔑 Creating session key...');

      // Default permissions for AgriFinance
      const defaultPermissions = {
        maxValue: ethers.parseEther("1"), // 1 ETH max per session
        validUntil: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        permissions: [
          "mintLand", // Land NFT minting
          "createLoan", // Loan creation
          "voteProposal", // DAO voting
          "createBatch", // Supply chain batch creation
        ]
      };

      const sessionPermissions = { ...defaultPermissions, ...permissions };

      // Create session key (simplified implementation)
      const sessionKey = {
        key: ethers.Wallet.createRandom().privateKey,
        permissions: sessionPermissions,
        createdAt: Date.now()
      };

      console.log('✅ Session key created');

      return {
        success: true,
        sessionKey: sessionKey
      };

    } catch (error) {
      console.error('❌ Failed to create session key:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enable social recovery for the smart account
   */
  async enableSocialRecovery(recoveryEmail, guardianAddresses = []) {
    try {
      if (!this.smartAccount) {
        throw new Error('Smart account not initialized');
      }

      console.log('🛡️ Enabling social recovery...');

      // This would integrate with a recovery service
      // For now, we'll store recovery info locally
      const recoveryInfo = {
        email: recoveryEmail,
        guardians: guardianAddresses,
        enabledAt: Date.now(),
        smartAccountAddress: await this.smartAccount.getAccountAddress()
      };

      // Store recovery info (in production, this would be encrypted and stored securely)
      localStorage.setItem('aa_recovery_info', JSON.stringify(recoveryInfo));

      console.log('✅ Social recovery enabled');

      return {
        success: true,
        recoveryInfo: recoveryInfo
      };

    } catch (error) {
      console.error('❌ Failed to enable social recovery:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get recovery information
   */
  getRecoveryInfo() {
    try {
      const recoveryInfo = localStorage.getItem('aa_recovery_info');
      return recoveryInfo ? JSON.parse(recoveryInfo) : null;
    } catch (error) {
      console.error('❌ Failed to get recovery info:', error);
      return null;
    }
  }

  /**
   * Check if AA is supported
   */
  isSupported() {
    return typeof window !== 'undefined' && 
           window.ethereum && 
           this.isInitialized;
  }

  /**
   * Check if user role allows in-app wallet
   */
  canUseInAppWallet(userRole) {
    const allowedRoles = ['farmer', 'buyer'];
    return allowedRoles.includes(userRole?.toLowerCase());
  }

  /**
   * Check if user role requires MetaMask
   */
  requiresMetaMask(userRole) {
    return userRole?.toLowerCase() === 'lender';
  }

  /**
   * Check if user role can choose wallet type
   */
  canChooseWalletType(userRole) {
    return userRole?.toLowerCase() === 'buyer';
  }

  /**
   * Get wallet policy for user role
   */
  getWalletPolicy(userRole) {
    const role = userRole?.toLowerCase();
    
    switch (role) {
      case 'farmer':
        return {
          allowedWallets: ['inapp'],
          requiredWallet: 'inapp',
          canChoose: false,
          description: 'Farmers use in-app wallet only'
        };
      case 'lender':
        return {
          allowedWallets: ['metamask'],
          requiredWallet: 'metamask',
          canChoose: false,
          description: 'Lenders must use MetaMask wallet'
        };
      case 'buyer':
        return {
          allowedWallets: ['inapp', 'metamask'],
          requiredWallet: null,
          canChoose: true,
          description: 'Buyers can choose between in-app wallet or MetaMask'
        };
      default:
        return {
          allowedWallets: ['metamask'],
          requiredWallet: 'metamask',
          canChoose: false,
          description: 'Default: MetaMask wallet required'
        };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasSmartAccount: !!this.smartAccount,
      isSupported: this.isSupported(),
      bundlerUrl: this.bundler?.bundlerUrl,
      paymasterUrl: this.paymaster?.paymasterUrl
    };
  }
}

// Create singleton instance
const aaService = new AccountAbstractionService();

export default aaService;
