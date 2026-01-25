const { ethers } = require('ethers');
const externalFaucetService = require('./externalFaucetService');

/**
 * Faucet Service - Handles faucet requests
 * Can use our own backend wallet to send ETH, or fall back to external APIs
 */

class FaucetService {
  constructor() {
    this.googleCloudFaucetUrl = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';
    this.quickNodeFaucetUrl = 'https://faucet.quicknode.com/ethereum/sepolia';
    
    // Rate limiting tracking
    this.lastRequest = {};
    this.requestCooldown = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Faucet wallet configuration
    // Default: 0.002 ETH (enough for 1 approval transaction with buffer)
    // Approval typically costs ~0.0008-0.0015 ETH on Sepolia
    this.provider = null;
    this.faucetWallet = null;
    this.isInitialized = false;
    this.faucetAmountEth = parseFloat(process.env.FAUCET_AMOUNT_ETH || '0.002'); // Just enough for approval
    this.minFaucetBalance = parseFloat(process.env.MIN_FAUCET_BALANCE || '0.01'); // Minimum balance to keep
    
    // Initialize on construction
    this.initialize();
  }

  /**
   * Initialize the faucet wallet from environment variables
   */
  initialize() {
    try {
      const network = process.env.NETWORK || 'amoy';
      let rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc-amoy.polygon.technology/';
      
      // Smart detection: If RPC is configured for Amoy but NETWORK variable isn't set
      if (rpcUrl.includes('polygon') || rpcUrl.includes('amoy') || rpcUrl.includes('80002')) {
         network = 'amoy';
      }

      if (network === 'amoy') {
        rpcUrl = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/';
      }

      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

      // Use dedicated faucet wallet or fall back to sponsor wallet
      const faucetPrivateKey = process.env.FAUCET_WALLET_PRIVATE_KEY || process.env.SPONSOR_WALLET_PRIVATE_KEY;
      
      if (!faucetPrivateKey) {
        console.warn('⚠️ FAUCET_WALLET_PRIVATE_KEY or SPONSOR_WALLET_PRIVATE_KEY not set. Self-hosted faucet disabled.');
        return { success: false, error: 'Faucet wallet not configured' };
      }

      this.faucetWallet = new ethers.Wallet(faucetPrivateKey, this.provider);
      
      console.log(`✅ Faucet Service initialized for ${network}`);
      console.log(`   Faucet wallet: ${this.faucetWallet.address}`);
      console.log(`   Amount per request: ${this.faucetAmountEth} (Native Token)`);
      
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to initialize Faucet Service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get faucet wallet balance
   */
  async getFaucetBalance() {
    try {
      if (!this.isInitialized || !this.faucetWallet || !this.provider) {
        const initResult = this.initialize();
        if (!initResult.success) {
          return { success: false, error: initResult.error };
        }
      }

      const balance = await this.provider.getBalance(this.faucetWallet.address);
      return {
        success: true,
        balance: balance.toString(),
        balanceEth: ethers.utils.formatEther(balance),
        address: this.faucetWallet.address
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send ETH from our own faucet wallet to user
   * @param {string} toAddress - User's wallet address
   * @returns {Promise<{success: boolean, message: string, txHash?: string}>}
   */
  async sendFromOurFaucet(toAddress) {
    try {
      if (!this.isInitialized || !this.faucetWallet) {
        const initResult = this.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: 'Faucet wallet not initialized. Please configure FAUCET_WALLET_PRIVATE_KEY in backend .env'
          };
        }
      }

      // Validate address
      if (!toAddress || !toAddress.startsWith('0x') || toAddress.length !== 42) {
        throw new Error('Invalid wallet address format');
      }

      // Check rate limiting
      const lastReq = this.lastRequest[toAddress];
      if (lastReq && Date.now() - lastReq < this.requestCooldown) {
        const hoursLeft = Math.ceil((this.requestCooldown - (Date.now() - lastReq)) / (60 * 60 * 1000));
        throw new Error(`Rate limit: Please wait ${hoursLeft} hours before requesting again`);
      }

      // Check faucet balance
      const balanceCheck = await this.getFaucetBalance();
      if (!balanceCheck.success) {
        throw new Error('Failed to check faucet balance');
      }

      const balanceEth = parseFloat(balanceCheck.balanceEth);
      const requiredBalance = this.faucetAmountEth + this.minFaucetBalance;
      
      if (balanceEth < requiredBalance) {
        return {
          success: false,
          error: `Faucet wallet has insufficient ETH (${balanceEth.toFixed(6)} ETH). Minimum ${requiredBalance.toFixed(6)} ETH required. Please fund the faucet wallet.`
        };
      }

      console.log(`💧 Sending ${this.faucetAmountEth} ETH from faucet to ${toAddress}`);
      console.log(`   Faucet balance: ${balanceEth.toFixed(6)} ETH`);
      console.log(`   Amount: ${this.faucetAmountEth} ETH (enough for token approval)`);

      // Convert ETH amount to wei
      const amountWei = ethers.utils.parseEther(this.faucetAmountEth.toString());

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas({
        to: toAddress,
        value: amountWei
      });

      const gasPrice = await this.provider.getGasPrice();
      const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer

      // Send transaction
      const tx = {
        to: toAddress,
        value: amountWei,
        gasLimit: gasLimit,
        gasPrice: gasPrice
      };

      const txResponse = await this.faucetWallet.sendTransaction(tx);
      console.log(`   Transaction sent: ${txResponse.hash}`);

      // Wait for confirmation
      const receipt = await txResponse.wait();
      console.log(`   Transaction confirmed in block ${receipt.blockNumber}`);

      // Update last request time
      this.lastRequest[toAddress] = Date.now();

      return {
        success: true,
        message: `Successfully sent ${this.faucetAmountEth} ETH to your wallet`,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        amount: this.faucetAmountEth.toString(),
        provider: 'self-hosted'
      };
    } catch (error) {
      console.error('❌ Error sending from our faucet:', error);
      return {
        success: false,
        error: error.message || 'Failed to send ETH from faucet'
      };
    }
  }

  /**
   * Check if our self-hosted faucet is available
   */
  isSelfHostedFaucetAvailable() {
    if (!this.isInitialized) {
      const result = this.initialize();
      return result.success;
    }
    return this.isInitialized && this.faucetWallet !== null;
  }

  /**
   * Request Sepolia ETH from Google Cloud Web3 Faucet
   * Note: The actual Google Cloud Web3 Faucet API might require authentication or have a different format
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{success: boolean, message: string, txHash?: string}>}
   */
  async requestFromGoogleCloud(walletAddress) {
    try {
      // Validate address format
      if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        throw new Error('Invalid wallet address format');
      }

      // Check rate limiting
      const lastReq = this.lastRequest[walletAddress];
      if (lastReq && Date.now() - lastReq < this.requestCooldown) {
        const hoursLeft = Math.ceil((this.requestCooldown - (Date.now() - lastReq)) / (60 * 60 * 1000));
        throw new Error(`Rate limit: Please wait ${hoursLeft} hours before requesting again`);
      }

      console.log(`🚰 Requesting Sepolia ETH from Google Cloud Faucet for ${walletAddress}`);

      // Note: Google Cloud Web3 Faucet might require authentication or use a different endpoint
      // The URL might need to be adjusted based on actual API documentation
      const apiKey = process.env.GOOGLE_CLOUD_WEB3_API_KEY;
      
      // Try different possible endpoint formats
      const possibleEndpoints = [
        this.googleCloudFaucetUrl,
        'https://faucet.quicknode.com/ethereum/sepolia',
        'https://sepoliafaucet.com/api/v1/faucet'
      ];

      let lastError = null;

      for (const endpoint of possibleEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
              ...(apiKey && { 'X-API-Key': apiKey })
            },
            body: JSON.stringify({
              wallet_address: walletAddress,
              address: walletAddress,
              walletAddress: walletAddress
            }),
            timeout: 10000 // 10 second timeout
          });

          // Check if response is HTML (error page) - means wrong endpoint
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            console.warn(`⚠️ Endpoint ${endpoint} returned HTML (likely wrong URL), trying next...`);
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            
            // Handle specific error cases
            if (response.status === 429) {
              throw new Error('Rate limit exceeded. Please try again later.');
            }
            if (response.status === 401 || response.status === 403) {
              throw new Error('Faucet authentication failed. API key may be required.');
            }
            
            lastError = new Error(`Faucet request failed: ${response.status}`);
            continue;
          }

          const result = await response.json().catch(() => {
            // If not JSON, might be a different format
            throw new Error('Invalid response format from faucet');
          });
          
          // Update last request time
          this.lastRequest[walletAddress] = Date.now();

          console.log('✅ Faucet request successful:', result);

          return {
            success: true,
            message: 'Faucet request submitted successfully',
            txHash: result.txHash || result.transaction_hash || result.hash || null,
            amount: result.amount || '0.1',
            provider: 'google-cloud'
          };
        } catch (error) {
          lastError = error;
          continue; // Try next endpoint
        }
      }

      // If all endpoints failed, throw the last error
      throw lastError || new Error('All faucet endpoints failed');

    } catch (error) {
      console.error('❌ Google Cloud Faucet error:', error);
      return {
        success: false,
        error: error.message || 'Failed to request from faucet. Please use an external faucet.'
      };
    }
  }

  /**
   * Request Sepolia ETH from QuickNode Faucet (fallback)
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{success: boolean, message: string, txHash?: string}>}
   */
  async requestFromQuickNode(walletAddress) {
    try {
      // Validate address format
      if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        throw new Error('Invalid wallet address format');
      }

      console.log(`🚰 Requesting Sepolia ETH from QuickNode Faucet for ${walletAddress}`);

      const response = await fetch(this.quickNodeFaucetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: walletAddress,
          network: 'sepolia'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QuickNode Faucet failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ QuickNode Faucet request successful:', result);

      return {
        success: true,
        message: 'Faucet request submitted successfully',
        txHash: result.txHash || result.transaction_hash || null,
        amount: result.amount || '0.1',
        provider: 'quicknode'
      };
    } catch (error) {
      console.error('❌ QuickNode Faucet error:', error);
      return {
        success: false,
        error: error.message || 'Failed to request from QuickNode faucet'
      };
    }
  }

  /**
   * Request from a specific provider
   * @param {string} walletAddress - User's wallet address
   * @param {string} providerId - Provider ID (self-hosted, chainstack, alchemy, etc.)
   * @returns {Promise<{success: boolean, message: string, txHash?: string}>}
   */
  async requestSepoliaETHWithProvider(walletAddress, providerId) {
    // Self-hosted
    if (providerId === 'self-hosted') {
      if (this.isSelfHostedFaucetAvailable()) {
        return await this.sendFromOurFaucet(walletAddress);
      }
      return {
        success: false,
        error: 'Self-hosted faucet not available. Please configure FAUCET_WALLET_PRIVATE_KEY.'
      };
    }

    // External providers
    const externalResult = await externalFaucetService.requestFromAnyProvider(walletAddress, providerId);
    if (externalResult.success) {
      return {
        success: true,
        message: `Successfully requested from ${externalResult.providerName} faucet`,
        txHash: externalResult.txHash,
        amount: externalResult.amount,
        provider: externalResult.provider
      };
    }

    return externalResult;
  }

  /**
   * Request from multiple faucets (try self-hosted first, then external APIs)
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{success: boolean, message: string, txHash?: string}>}
   */
  async requestSepoliaETH(walletAddress) {
    // Try self-hosted faucet first (most reliable)
    if (this.isSelfHostedFaucetAvailable()) {
      console.log('💧 Using self-hosted faucet...');
      const selfHostedResult = await this.sendFromOurFaucet(walletAddress);
      if (selfHostedResult.success) {
        return selfHostedResult;
      }
      console.log('⚠️ Self-hosted faucet failed:', selfHostedResult.error);
    }

    // Fallback to external APIs (Chainstack, Alchemy, etc.)
    console.log('⚠️ Self-hosted faucet not available, trying external APIs...');
    
    const externalResult = await externalFaucetService.requestFromAnyProvider(walletAddress);
    if (externalResult.success) {
      return {
        success: true,
        message: `Successfully requested from ${externalResult.providerName} faucet`,
        txHash: externalResult.txHash,
        amount: externalResult.amount,
        provider: externalResult.provider
      };
    }

    // Fallback to legacy external APIs
    const googleResult = await this.requestFromGoogleCloud(walletAddress);
    if (googleResult.success) {
      return googleResult;
    }

    // Only try QuickNode if it's configured
    const quickNodeApiKey = process.env.QUICKNODE_API_KEY;
    if (quickNodeApiKey) {
      console.log('⚠️ Other faucets failed, trying QuickNode...');
      const quickNodeResult = await this.requestFromQuickNode(walletAddress);
      if (quickNodeResult.success) {
        return quickNodeResult;
      }
    }

    // If all fail, return helpful error message
    return {
      success: false,
      error: externalResult.error || googleResult.error || 'Faucet request failed. Please use an external faucet like https://sepoliafaucet.com/'
    };
  }

  /**
   * Check if user can request (rate limit check)
   * @param {string} walletAddress - User's wallet address
   * @returns {boolean}
   */
  canRequest(walletAddress) {
    const lastReq = this.lastRequest[walletAddress];
    if (!lastReq) return true;
    return Date.now() - lastReq >= this.requestCooldown;
  }

  /**
   * Get time until next request is allowed
   * @param {string} walletAddress - User's wallet address
   * @returns {number} Milliseconds until next request
   */
  getTimeUntilNextRequest(walletAddress) {
    const lastReq = this.lastRequest[walletAddress];
    if (!lastReq) return 0;
    const timeLeft = this.requestCooldown - (Date.now() - lastReq);
    return Math.max(0, timeLeft);
  }
}

const faucetService = new FaucetService();

module.exports = faucetService;

