// Blockchain Service
// Handles blockchain transactions and synchronization with database

const { ethers } = require('ethers');
const pool = require('../server').pool; // Import pool from server

class BlockchainService {
  constructor() {
    this.provider = null;
    this.contracts = {};
    this.contractAddresses = this.loadContractAddresses();
    this.privateKey = process.env.WALLET_PRIVATE_KEY || process.env.SPONSOR_WALLET_PRIVATE_KEY;
    this.initializeProvider();
  }

  loadContractAddresses() {
    try {
      // Prefer explicit env vars if provided
      if (
        process.env.KRISHI_TOKEN_ADDRESS &&
        process.env.NFT_LAND_ADDRESS &&
        process.env.LOAN_CONTRACT_ADDRESS &&
        process.env.SUPPLY_CHAIN_ADDRESS
      ) {
        return {
          krishiToken: process.env.KRISHI_TOKEN_ADDRESS,
          nftLand: process.env.NFT_LAND_ADDRESS,
          loanContract: process.env.LOAN_CONTRACT_ADDRESS,
          supplyChain: process.env.SUPPLY_CHAIN_ADDRESS,
        };
      }

      // Fallback to deployments/amoy.json for local dev
      const path = require('path');
      const fs = require('fs');
      const deploymentsPath = path.resolve(process.cwd(), 'deployments', 'amoy.json');
      if (fs.existsSync(deploymentsPath)) {
        const raw = fs.readFileSync(deploymentsPath, 'utf8');
        const parsed = JSON.parse(raw);
        const addresses = parsed.contracts || {};
        return {
          krishiToken: addresses.KrishiToken,
          nftLand: addresses.NFTLand,
          loanContract: addresses.LoanContract,
          supplyChain: addresses.SupplyChain,
        };
      }

      // Last resort stub addresses to avoid crashes
      return {
        krishiToken: '0x0000000000000000000000000000000000000000',
        nftLand: '0x0000000000000000000000000000000000000000',
        loanContract: '0x0000000000000000000000000000000000000000',
        supplyChain: '0x0000000000000000000000000000000000000000',
      };
    } catch (e) {
      console.error('❌ Failed to load contract addresses:', e);
      return {
        krishiToken: '0x0000000000000000000000000000000000000000',
        nftLand: '0x0000000000000000000000000000000000000000',
        loanContract: '0x0000000000000000000000000000000000000000',
        supplyChain: '0x0000000000000000000000000000000000000000',
      };
    }
  }

  initializeProvider() {
    try {
      // Initialize provider based on environment
      if (process.env.NODE_ENV === 'production') {
        this.provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology');
      } else {
        // Use Polygon Amoy testnet for development
        this.provider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
      }
      
      console.log('🔗 Blockchain provider initialized');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain provider:', error);
    }
  }

  // Initialize contracts
  async initializeContracts() {
    try {
      // KrishiToken contract ABI (simplified)
      const krishiTokenABI = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function transferFrom(address from, address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)",
        "function mint(address to, uint256 amount)",
        "function stake(uint256 amount, uint256 lockPeriod)",
        "function unstake(uint256 stakeIndex)",
        "function claimRewards()",
        "function getUserStakes(address user) view returns (tuple(uint256 amount, uint256 startTime, uint256 lockPeriod, bool isActive, uint256 rewardRate)[])",
        "function getTotalStakingRewards(address user) view returns (uint256)",
        "event TokensStaked(address indexed user, uint256 amount, uint256 lockPeriod)",
        "event TokensUnstaked(address indexed user, uint256 amount, uint256 reward)",
        "event Transfer(address indexed from, address indexed to, uint256 value)"
      ];

      // NFTLand contract ABI (simplified)
      const nftLandABI = [
        "function mint(address to, uint256 tokenId, string memory tokenURI)",
        "function transferFrom(address from, address to, uint256 tokenId)",
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function tokenURI(uint256 tokenId) view returns (string)",
        "function setTokenPrice(uint256 tokenId, uint256 price)",
        "function buyToken(uint256 tokenId) payable",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        "event TokenPriceSet(uint256 indexed tokenId, uint256 price)"
      ];

      this.contracts.krishiToken = new ethers.Contract(
        this.contractAddresses.krishiToken,
        krishiTokenABI,
        this.provider
      );

      this.contracts.nftLand = new ethers.Contract(
        this.contractAddresses.nftLand,
        nftLandABI,
        this.provider
      );

      console.log('📋 Smart contracts initialized');
    } catch (error) {
      console.error('❌ Failed to initialize contracts:', error);
    }
  }

  // Execute token transfer on blockchain
  async executeTokenTransfer(fromAddress, toAddress, amountWei, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.krishiToken.connect(wallet);
      
      const tx = await contract.transfer(toAddress, amountWei);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ Token transfer failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute staking on blockchain
  async executeStaking(userAddress, amountWei, lockPeriodSeconds, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.krishiToken.connect(wallet);
      
      const tx = await contract.stake(amountWei, lockPeriodSeconds);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ Staking failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute unstaking on blockchain
  async executeUnstaking(userAddress, stakeIndex, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.krishiToken.connect(wallet);
      
      const tx = await contract.unstake(stakeIndex);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ Unstaking failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get blockchain balance
  async getBlockchainBalance(address) {
    try {
      const contract = this.contracts.krishiToken;
      const balance = await contract.balanceOf(address);
      return {
        success: true,
        balance: balance.toString()
      };
    } catch (error) {
      console.error('❌ Failed to get blockchain balance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get blockchain staking data
  async getBlockchainStakingData(address) {
    try {
      const contract = this.contracts.krishiToken;
      const [stakes, rewards] = await Promise.all([
        contract.getUserStakes(address),
        contract.getTotalStakingRewards(address)
      ]);
      
      return {
        success: true,
        stakes: stakes.map(stake => ({
          amount: stake.amount.toString(),
          startTime: stake.startTime.toString(),
          lockPeriod: stake.lockPeriod.toString(),
          isActive: stake.isActive,
          rewardRate: stake.rewardRate.toString()
        })),
        totalRewards: rewards.toString()
      };
    } catch (error) {
      console.error('❌ Failed to get blockchain staking data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sync database with blockchain
  async syncWithBlockchain(userId, walletAddress) {
    try {
      console.log(`🔄 Syncing user ${userId} wallet ${walletAddress} with blockchain`);
      
      // Get blockchain data
      const [balanceResult, stakingResult] = await Promise.all([
        this.getBlockchainBalance(walletAddress),
        this.getBlockchainStakingData(walletAddress)
      ]);

      if (!balanceResult.success) {
        throw new Error(`Failed to get blockchain balance: ${balanceResult.error}`);
      }

      // Update database with blockchain data
      const updateResult = await pool.query(
        `UPDATE wallet_accounts 
         SET balance_wei = $1::bigint, updated_at = NOW()
         WHERE user_id = $2 AND address = $3`,
        [balanceResult.balance, userId, walletAddress]
      );

      // Sync staking data if available
      if (stakingResult.success) {
        // Store staking data in database (you might want to create a staking_positions table)
        console.log('📊 Staking data synced:', stakingResult);
      }

      return {
        success: true,
        message: 'Blockchain sync completed',
        data: {
          balance: balanceResult.balance,
          stakingData: stakingResult.success ? stakingResult : null
        }
      };
    } catch (error) {
      console.error('❌ Blockchain sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify transaction on blockchain
  async verifyTransaction(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      return {
        success: true,
        confirmed: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ Transaction verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute NFT purchase on blockchain
  async executeNFTPurchase(buyerAddress, tokenId, priceWei, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.nftLand.connect(wallet);
      
      const tx = await contract.buyToken(tokenId, { value: priceWei });
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ NFT purchase failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute NFT transfer on blockchain
  async executeNFTTransfer(fromAddress, toAddress, tokenId, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.nftLand.connect(wallet);
      
      const tx = await contract.transferFrom(fromAddress, toAddress, tokenId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ NFT transfer failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute NFT price setting on blockchain
  async executeSetNFTPrice(tokenId, priceWei, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = this.contracts.nftLand.connect(wallet);
      
      const tx = await contract.setTokenPrice(tokenId, priceWei);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        data: receipt
      };
    } catch (error) {
      console.error('❌ NFT price setting failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Mint tokens to an address (requires MINTER_ROLE on contract)
  async mintTokens(toAddress, amountWei) {
    try {
      if (!this.privateKey) {
        throw new Error('PRIVATE_KEY not set. Cannot mint tokens.');
      }

      if (!this.contracts.krishiToken) {
        await this.initializeContracts();
      }

      const wallet = new ethers.Wallet(this.privateKey, this.provider);
      const krishiTokenWithSigner = this.contracts.krishiToken.connect(wallet);
      
      console.log(`🎯 Minting ${amountWei} tokens to ${toAddress}`);
      
      const tx = await krishiTokenWithSigner.mint(toAddress, amountWei);
      const receipt = await tx.wait();
      
      console.log(`✅ Minted ${amountWei} tokens to ${toAddress}, tx: ${receipt.hash}`);
      
      return receipt.hash;
    } catch (error) {
      console.error('❌ Error minting tokens:', error);
      throw error;
    }
  }

  // Get NFT owner from blockchain
  async getNFTOwner(tokenId) {
    try {
      const contract = this.contracts.nftLand;
      const owner = await contract.ownerOf(tokenId);
      return {
        success: true,
        owner: owner
      };
    } catch (error) {
      console.error('❌ Failed to get NFT owner:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get NFT metadata from blockchain
  async getNFTMetadata(tokenId) {
    try {
      const contract = this.contracts.nftLand;
      const tokenURI = await contract.tokenURI(tokenId);
      return {
        success: true,
        tokenURI: tokenURI
      };
    } catch (error) {
      console.error('❌ Failed to get NFT metadata:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sync NFT data with database
  async syncNFTWithBlockchain(nftId, tokenId) {
    try {
      console.log(`🔄 Syncing NFT ${nftId} (tokenId: ${tokenId}) with blockchain`);
      
      // Get blockchain data
      const [ownerResult, metadataResult] = await Promise.all([
        this.getNFTOwner(tokenId),
        this.getNFTMetadata(tokenId)
      ]);

      if (!ownerResult.success) {
        throw new Error(`Failed to get NFT owner: ${ownerResult.error}`);
      }

      // Update database with blockchain data
      const updateResult = await pool.query(
        `UPDATE nfts 
         SET owner_id = (
           SELECT id FROM users WHERE wallet_address = $1
         ), updated_at = NOW()
         WHERE id = $2`,
        [ownerResult.owner, nftId]
      );

      return {
        success: true,
        message: 'NFT blockchain sync completed',
        data: {
          owner: ownerResult.owner,
          metadata: metadataResult.success ? metadataResult : null
        }
      };
    } catch (error) {
      console.error('❌ NFT blockchain sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Listen for blockchain events
  async startEventListening() {
    try {
      if (!this.contracts.krishiToken) {
        await this.initializeContracts();
      }

      // Listen for Token Transfer events
      this.contracts.krishiToken.on('Transfer', async (from, to, value, event) => {
        console.log(`🔄 Token Transfer event detected: ${from} -> ${to}, amount: ${value.toString()}`);
        
        // Sync affected wallets
        if (from !== ethers.constants.AddressZero) {
          await this.syncWalletByAddress(from);
        }
        if (to !== ethers.constants.AddressZero) {
          await this.syncWalletByAddress(to);
        }
      });

      // Listen for Staking events
      this.contracts.krishiToken.on('TokensStaked', async (user, amount, lockPeriod, event) => {
        console.log(`🥩 Staking event detected: ${user}, amount: ${amount.toString()}`);
        await this.syncWalletByAddress(user);
      });

      // Listen for NFT Transfer events
      this.contracts.nftLand.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`🖼️ NFT Transfer event detected: ${from} -> ${to}, tokenId: ${tokenId.toString()}`);
        
        // Sync NFT ownership in database
        await this.syncNFTByTokenId(tokenId.toString());
      });

      // Listen for NFT Price Setting events
      this.contracts.nftLand.on('TokenPriceSet', async (tokenId, price, event) => {
        console.log(`💰 NFT Price Set event detected: tokenId: ${tokenId.toString()}, price: ${price.toString()}`);
        
        // Sync NFT price in database
        await this.syncNFTPriceByTokenId(tokenId.toString(), price.toString());
      });

      console.log('👂 Blockchain event listening started');
    } catch (error) {
      console.error('❌ Failed to start event listening:', error);
    }
  }

  // Sync NFT by token ID
  async syncNFTByTokenId(tokenId) {
    try {
      const result = await pool.query(
        'SELECT id FROM nfts WHERE token_id = $1',
        [tokenId]
      );

      if (result.rows.length > 0) {
        const nftId = result.rows[0].id;
        await this.syncNFTWithBlockchain(nftId, tokenId);
      }
    } catch (error) {
      console.error('❌ Failed to sync NFT by token ID:', error);
    }
  }

  // Sync NFT price by token ID
  async syncNFTPriceByTokenId(tokenId, priceWei) {
    try {
      await pool.query(
        `UPDATE nfts 
         SET price_wei = $1::bigint, updated_at = NOW()
         WHERE token_id = $2`,
        [priceWei, tokenId]
      );
    } catch (error) {
      console.error('❌ Failed to sync NFT price by token ID:', error);
    }
  }

  // Sync wallet by address
  async syncWalletByAddress(address) {
    try {
      const result = await pool.query(
        'SELECT user_id FROM wallet_accounts WHERE address = $1',
        [address]
      );

      if (result.rows.length > 0) {
        const userId = result.rows[0].user_id;
        await this.syncWithBlockchain(userId, address);
      }
    } catch (error) {
      console.error('❌ Failed to sync wallet by address:', error);
    }
  }
}

module.exports = BlockchainService;
