// Enhanced Blockchain Service - Blockchain-First Approach
// This service handles all blockchain interactions as the primary source of truth

const { ethers } = require('ethers');
const { Pool } = require('pg');

class EnhancedBlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.krishiToken = null;
        this.creditOracle = null;
        this.loanContract = null;
        this.db = null;
        this.readOnly = false;
        
        // Initialize in separate method
        this.initialized = false;
    }

    /**
     * Initialize the blockchain service
     */
    async initialize() {
        try {
            console.log('🔗 Initializing Enhanced Blockchain Service...');
            
            // Set up provider
            const network = process.env.NETWORK || 'sepolia';
            const rpcUrl = this.getRPCUrl(network);
            // Use ethers v5-compatible provider construction
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            
            // Set up signer with private key if available; otherwise run in read-only mode
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                this.readOnly = true;
                console.warn('⚠️  PRIVATE_KEY not set. Running blockchain service in READ-ONLY mode.');
                this.signer = this.provider; // provider-only contract (read methods only)
            } else {
                this.signer = new ethers.Wallet(privateKey, this.provider);
            }
            
            // Load contract addresses from environment
            const krishiTokenAddress = process.env.KRSI_CONTRACT_ADDRESS;
            if (!krishiTokenAddress) {
                throw new Error('KRSI_CONTRACT_ADDRESS environment variable not set');
            }
            
            // Load contract ABIs
            const krishiTokenABI = require('../../artifacts/contracts/KrishiToken.sol/KrishiToken.json').abi;
            
            // Initialize contracts
            this.krishiToken = new ethers.Contract(krishiTokenAddress, krishiTokenABI, this.signer);
            
            console.log('✅ Blockchain Service initialized');
            console.log(`📍 Network: ${network}`);
            console.log(`📍 KrishiToken: ${krishiTokenAddress}`);
            if (this.readOnly) {
                console.log('🔒 Mode: READ-ONLY (no on-chain writes until PRIVATE_KEY is set)');
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ Error initializing blockchain service:', error);
            throw error;
        }
    }

    /**
     * Get RPC URL based on network
     */
    getRPCUrl(network) {
        const rpcUrls = {
            sepolia: 'https://ethereum-sepolia.publicnode.com',
            mainnet: 'https://eth.llamarpc.com',
            amoy: 'https://polygon-amoy.publicnode.com',
            hardhat: 'http://localhost:8545'
        };
        
        return rpcUrls[network] || rpcUrls.sepolia;
    }

    /**
     * Set up blockchain event listeners
     */
    setupEventListeners() {
        console.log('👂 Setting up blockchain event listeners...');
        
        // Listen to Transfer events
        this.krishiToken.on('Transfer', async (from, to, value, event) => {
            console.log(`📥 Transfer event: ${from} → ${to}, value: ${value.toString()}`);
            
            // Index the event to database
            await this.indexTransferEvent({
                from,
                to,
                value: value.toString(),
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                logIndex: event.logIndex
            });
        });
        
        // Listen to other events
        this.krishiToken.on('TokensStaked', async (user, amount, event) => {
            console.log(`📌 Staking event: ${user} staked ${amount.toString()}`);
            await this.indexEvent('TokensStaked', user, { amount: amount.toString() }, event);
        });
        
        this.krishiToken.on('TokensBurned', async (burner, amount, event) => {
            console.log(`🔥 Burn event: ${burner} burned ${amount.toString()}`);
            await this.indexEvent('TokensBurned', burner, { amount: amount.toString() }, event);
        });
    }

    /**
     * Transfer tokens on blockchain (blockchain-first approach)
     */
    async transferTokens(fromAddress, toAddress, amount) {
        try {
            if (this.readOnly) {
                throw new Error('Service is in read-only mode. Set PRIVATE_KEY to enable transfers.');
            }
            console.log(`🔄 Initiating blockchain transfer: ${amount} from ${fromAddress} to ${toAddress}`);
            
            // Check balance on blockchain
            const balance = await this.krishiToken.balanceOf(fromAddress);
            const amountBN = ethers.BigNumber.from(String(amount));
            if (balance.lt(amountBN)) {
                throw new Error(`Insufficient balance: ${balance.toString()} < ${amountBN.toString()}`);
            }
            
            // Execute transfer on blockchain
            const tx = await this.krishiToken.transfer(toAddress, amountBN);
            console.log(`📝 Transaction submitted: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed: ${receipt.blockNumber}`);
            
            // Return transaction hash
            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                from: fromAddress,
                to: toAddress,
                amount: amount.toString(),
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('❌ Error in blockchain transfer:', error);
            throw error;
        }
    }

    /**
     * Get balance from blockchain (source of truth)
     */
    async getBalance(address) {
        try {
            const balance = await this.krishiToken.balanceOf(address);
            return balance.toString();
        } catch (error) {
            console.error('❌ Error getting balance from blockchain:', error);
            throw error;
        }
    }

    /**
     * Mint tokens (only for authorized roles)
     */
    async mintTokens(toAddress, amount) {
        try {
            if (this.readOnly) {
                throw new Error('Service is in read-only mode. Set PRIVATE_KEY to enable minting.');
            }
            console.log(`🎯 Minting ${amount} tokens to ${toAddress}`);
            
            const tx = await this.krishiToken.mint(toAddress, amount);
            await tx.wait();
            
            console.log(`✅ Minted ${amount} tokens to ${toAddress}`);
            return tx.hash;
        } catch (error) {
            console.error('❌ Error minting tokens:', error);
            throw error;
        }
    }

    /**
     * Index Transfer event to database
     */
    async indexTransferEvent(eventData) {
        if (!this.db) return;
        
        try {
            // Insert event to database
            await this.db.query(`
                INSERT INTO blockchain_transactions (
                    tx_hash, block_number, from_address, to_address, 
                    value_wei, event_name, status, indexed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (tx_hash) DO NOTHING
            `, [
                eventData.txHash,
                eventData.blockNumber,
                eventData.from,
                eventData.to,
                eventData.value,
                'Transfer',
                'confirmed'
            ]);
            
            console.log(`📊 Indexed transfer event: ${eventData.txHash}`);
        } catch (error) {
            console.error('❌ Error indexing transfer event:', error);
        }
    }

    /**
     * Index any blockchain event to database
     */
    async indexEvent(eventName, user, eventData, blockchainEvent) {
        if (!this.db) return;
        
        try {
            await this.db.query(`
                INSERT INTO blockchain_events (
                    tx_hash, contract_address, event_name, 
                    event_data, block_number, log_index, indexed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT DO NOTHING
            `, [
                blockchainEvent.transactionHash,
                blockchainEvent.address,
                eventName,
                JSON.stringify(eventData),
                blockchainEvent.blockNumber,
                blockchainEvent.logIndex
            ]);
            
            console.log(`📊 Indexed ${eventName} event: ${blockchainEvent.transactionHash}`);
        } catch (error) {
            console.error('❌ Error indexing event:', error);
        }
    }

    /**
     * Set database connection for indexing
     */
    setDatabase(db) {
        this.db = db;
    }

    /**
     * Sync database with blockchain state
     */
    async syncDatabaseWithBlockchain(userAddress) {
        try {
            // Get balance from blockchain (source of truth)
            const blockchainBalance = await this.getBalance(userAddress);
            
            // Update database to match blockchain
            if (this.db) {
                await this.db.query(`
                    UPDATE wallet_accounts 
                    SET balance_wei = $1, last_synced = NOW()
                    WHERE user_address = $2
                `, [blockchainBalance, userAddress]);
            }
            
            console.log(`🔄 Synced balance for ${userAddress}: ${blockchainBalance}`);
            return blockchainBalance;
        } catch (error) {
            console.error('❌ Error syncing database:', error);
            throw error;
        }
    }

    /**
     * Get voting power for governance
     */
    async getVotingPower(address) {
        try {
            const votingPower = await this.krishiToken.votingPower(address);
            return votingPower.toString();
        } catch (error) {
            console.error('❌ Error getting voting power:', error);
            throw error;
        }
    }

    /**
     * Distribute harvest rewards to farmers
     */
    async distributeHarvestRewards(farmers, amounts) {
        try {
            if (this.readOnly) {
                throw new Error('Service is in read-only mode. Set PRIVATE_KEY to enable reward distribution.');
            }
            console.log(`🌾 Distributing harvest rewards to ${farmers.length} farmers`);
            
            const tx = await this.krishiToken.distributeHarvestRewards(farmers, amounts);
            const receipt = await tx.wait();
            
            console.log(`✅ Harvest rewards distributed: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Error distributing harvest rewards:', error);
            throw error;
        }
    }
}

// Export singleton instance
let instance = null;

function getInstance() {
    if (!instance) {
        instance = new EnhancedBlockchainService();
    }
    return instance;
}

module.exports = { EnhancedBlockchainService, getInstance };


