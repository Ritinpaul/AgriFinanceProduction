// Sponsored Transaction Service
// Sponsors gas fees for farmer transactions using a backend wallet

const { ethers } = require('ethers');

class SponsoredTransactionService {
  constructor() {
    this.provider = null;
    this.sponsorWallet = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the service with a sponsor wallet
   */
  initialize() {
    try {
      // Initialize provider (Sepolia testnet)
      // NOTE: Using ethers v5 syntax (ethers.providers.JsonRpcProvider)
      const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com';
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

      // Get sponsor wallet private key from environment
      // IMPORTANT: This wallet must have Sepolia ETH for gas
      const sponsorPrivateKey = process.env.SPONSOR_WALLET_PRIVATE_KEY;
      
      if (!sponsorPrivateKey) {
        console.warn('⚠️ SPONSOR_WALLET_PRIVATE_KEY not set. Sponsored transactions disabled.');
        return { success: false, error: 'Sponsor wallet not configured' };
      }

      // Create sponsor wallet (ethers v5 syntax)
      this.sponsorWallet = new ethers.Wallet(sponsorPrivateKey, this.provider);
      
      console.log('✅ Sponsored Transaction Service initialized');
      console.log(`   Sponsor wallet: ${this.sponsorWallet.address}`);
      
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to initialize Sponsored Transaction Service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check sponsor wallet balance
   */
  async getSponsorBalance() {
    try {
      if (!this.isInitialized || !this.sponsorWallet) {
        await this.initialize();
      }

      const balance = await this.provider.getBalance(this.sponsorWallet.address);
      return {
        success: true,
        balance: balance.toString(),
        balanceEth: ethers.utils.formatEther(balance), // ethers v5: ethers.utils.formatEther
        address: this.sponsorWallet.address
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a sponsored transaction on behalf of a user
   * @param {Object} params - Transaction parameters
   * @param {string} params.to - Contract address
   * @param {string} params.data - Encoded function call data
   * @param {string} params.value - Value to send (in wei, optional)
   * @param {string} params.fromAddress - Original user's address (for logging/validation)
   */
  async executeSponsoredTransaction({ to, data, value = '0', fromAddress, userAddress, userId }) {
    try {
      if (!this.isInitialized || !this.sponsorWallet) {
        const initResult = this.initialize(); // Don't await - it's synchronous
        if (!initResult.success) {
          throw new Error(
            'Sponsored transaction service not initialized. ' +
            'Please set SPONSOR_WALLET_PRIVATE_KEY in backend .env file and restart the server.'
          );
        }
      }

      // Validate inputs
      if (!to || !data) {
        throw new Error('Missing required parameters: to, data');
      }

      // For token approvals (0x095ea7b3 is approve function selector), 
      // we need to ensure the transaction comes from the user's address
      // Check if this is an approval transaction
      const isApprovalTx = data.substring(0, 10) === '0x095ea7b3'; // approve(address,uint256)
      
      if (isApprovalTx && userAddress) {
        // For approval transactions, we need the user to have tokens
        // Check user's token balance if we can
        try {
          const krishiTokenAddress = '0xFbF589d08d3bea0F67Ad3AAa7A39bd9f8FB2eAe2';
          const tokenContract = new ethers.Contract(
            krishiTokenAddress,
            ['function balanceOf(address account) view returns (uint256)'],
            this.provider
          );
          const userBalance = await tokenContract.balanceOf(userAddress);
          
          if (userBalance.eq(0)) {
            throw new Error(
              `User wallet (${userAddress.substring(0, 10)}...) has 0 KRSI tokens. ` +
              `Please claim tokens from the faucet or obtain KRSI tokens before depositing.`
            );
          }
          
          console.log(`✅ User balance check: ${ethers.utils.formatUnits(userBalance, 6)} KRSI`);
        } catch (balanceError) {
          if (balanceError.message.includes('0 KRSI')) {
            throw balanceError;
          }
          console.warn('Could not check user balance:', balanceError.message);
        }
        
        // For approval, we need to execute as the user, not the sponsor
        // This is a limitation - we can't approve on behalf of someone else
        // The transaction will fail because sponsor wallet doesn't own the tokens
        console.warn('⚠️ Approval transaction detected. This may fail if sponsor wallet does not own tokens.');
      }

      // Check sponsor balance
      const balanceCheck = await this.getSponsorBalance();
      if (!balanceCheck.success) {
        throw new Error('Failed to check sponsor balance');
      }

      const balanceEth = parseFloat(balanceCheck.balanceEth);
      if (balanceEth < 0.01) {
        throw new Error(`Sponsor wallet has insufficient ETH (${balanceEth.toFixed(6)} ETH). Minimum 0.01 ETH required.`);
      }

      console.log(`💸 Executing sponsored transaction for ${fromAddress || 'user'}`);
      console.log(`   To: ${to}`);
      console.log(`   Sponsor: ${this.sponsorWallet.address} (${balanceEth.toFixed(6)} ETH)`);

      // Estimate gas (ethers v5 syntax)
      const gasEstimate = await this.provider.estimateGas({
        to: to,
        data: data,
        value: value
      });

      // Get current gas price (ethers v5)
      const gasPrice = await this.provider.getGasPrice();

      // Create and send transaction using sponsor wallet
      // ethers v5 uses BigNumber, not native BigInt
      const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer
      
      const tx = {
        to: to,
        data: data,
        value: value || '0',
        gasLimit: gasLimit,
        gasPrice: gasPrice
      };

      const txResponse = await this.sponsorWallet.sendTransaction(tx);
      console.log(`   Transaction sent: ${txResponse.hash}`);

      // Wait for confirmation
      const receipt = await txResponse.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        receipt: receipt
      };
    } catch (error) {
      console.error('❌ Sponsored transaction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    // Try to initialize if not already done
    if (!this.isInitialized) {
      const result = this.initialize();
      return result.success;
    }
    return this.isInitialized && this.sponsorWallet !== null;
  }
}

// Create singleton instance
const sponsoredTransactionService = new SponsoredTransactionService();

module.exports = sponsoredTransactionService;

