// Transaction Reconciliation Service
// Monitors and reconciles blockchain and database transactions

const { ethers } = require('ethers');
const pool = require('../server').pool; // Import pool from server

class TransactionReconciliationService {
  constructor(blockchainService) {
    this.blockchainService = blockchainService;
    this.reconciliationInterval = null;
    this.isRunning = false;
  }

  // Start automatic reconciliation
  startReconciliation(intervalMinutes = 5) {
    if (this.isRunning) {
      console.log('⚠️ Reconciliation service is already running');
      return;
    }

    console.log(`🔄 Starting transaction reconciliation service (every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    this.reconciliationInterval = setInterval(async () => {
      try {
        await this.performReconciliation();
      } catch (error) {
        console.error('❌ Reconciliation error:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Perform initial reconciliation
    this.performReconciliation();
  }

  // Stop automatic reconciliation
  stopReconciliation() {
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Transaction reconciliation service stopped');
  }

  // Perform full reconciliation
  async performReconciliation() {
    console.log('🔍 Starting transaction reconciliation...');
    
    try {
      const results = {
        walletsChecked: 0,
        walletsSynced: 0,
        nftsChecked: 0,
        nftsSynced: 0,
        discrepancies: [],
        errors: []
      };

      // Reconcile wallet balances
      const walletResults = await this.reconcileWalletBalances();
      results.walletsChecked = walletResults.checked;
      results.walletsSynced = walletResults.synced;
      results.discrepancies.push(...walletResults.discrepancies);
      results.errors.push(...walletResults.errors);

      // Reconcile NFT ownership
      const nftResults = await this.reconcileNFTOwnership();
      results.nftsChecked = nftResults.checked;
      results.nftsSynced = nftResults.synced;
      results.discrepancies.push(...nftResults.discrepancies);
      results.errors.push(...nftResults.errors);

      // Log reconciliation results
      console.log('📊 Reconciliation Results:', {
        walletsChecked: results.walletsChecked,
        walletsSynced: results.walletsSynced,
        nftsChecked: results.nftsChecked,
        nftsSynced: results.nftsSynced,
        totalDiscrepancies: results.discrepancies.length,
        totalErrors: results.errors.length
      });

      // Alert on discrepancies
      if (results.discrepancies.length > 0) {
        console.warn('⚠️ Discrepancies found:', results.discrepancies);
        await this.alertOnDiscrepancies(results.discrepancies);
      }

      return results;
    } catch (error) {
      console.error('❌ Reconciliation failed:', error);
      throw error;
    }
  }

  // Reconcile wallet balances
  async reconcileWalletBalances() {
    const results = {
      checked: 0,
      synced: 0,
      discrepancies: [],
      errors: []
    };

    try {
      // Get all wallets
      const walletsResult = await pool.query(
        'SELECT * FROM wallet_accounts WHERE wallet_type = $1',
        ['agrifinance']
      );

      for (const wallet of walletsResult.rows) {
        results.checked++;
        
        try {
          // Get blockchain balance
          const blockchainResult = await this.blockchainService.getBlockchainBalance(wallet.address);
          
          if (blockchainResult.success) {
            const blockchainBalance = blockchainResult.balance;
            const databaseBalance = wallet.balance_wei;
            
            // Check for discrepancies
            if (blockchainBalance !== databaseBalance) {
              const discrepancy = {
                type: 'wallet_balance',
                walletId: wallet.id,
                address: wallet.address,
                databaseBalance: databaseBalance,
                blockchainBalance: blockchainBalance,
                difference: (BigInt(blockchainBalance) - BigInt(databaseBalance)).toString(),
                timestamp: new Date().toISOString()
              };
              
              results.discrepancies.push(discrepancy);
              
              // Auto-sync if discrepancy is small (within 1% tolerance)
              const tolerance = BigInt(databaseBalance) / BigInt(100); // 1% tolerance
              const difference = BigInt(discrepancy.difference);
              
              if (difference.abs() <= tolerance) {
                console.log(`🔄 Auto-syncing wallet ${wallet.address} (small discrepancy)`);
                await this.blockchainService.syncWithBlockchain(wallet.user_id, wallet.address);
                results.synced++;
              } else {
                console.warn(`⚠️ Large discrepancy detected for wallet ${wallet.address}:`, discrepancy);
              }
            }
          } else {
            results.errors.push({
              type: 'blockchain_balance_fetch',
              walletId: wallet.id,
              address: wallet.address,
              error: blockchainResult.error
            });
          }
        } catch (error) {
          results.errors.push({
            type: 'wallet_reconciliation',
            walletId: wallet.id,
            address: wallet.address,
            error: error.message
          });
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'wallet_reconciliation_batch',
        error: error.message
      });
    }

    return results;
  }

  // Reconcile NFT ownership
  async reconcileNFTOwnership() {
    const results = {
      checked: 0,
      synced: 0,
      discrepancies: [],
      errors: []
    };

    try {
      // Get all NFTs with token IDs
      const nftsResult = await pool.query(
        'SELECT * FROM nfts WHERE token_id IS NOT NULL'
      );

      for (const nft of nftsResult.rows) {
        results.checked++;
        
        try {
          // Get blockchain owner
          const blockchainResult = await this.blockchainService.getNFTOwner(nft.token_id);
          
          if (blockchainResult.success) {
            const blockchainOwner = blockchainResult.owner;
            
            // Find database owner's wallet address
            const ownerResult = await pool.query(
              'SELECT wa.address FROM wallet_accounts wa WHERE wa.user_id = $1',
              [nft.owner_id]
            );
            
            const databaseOwner = ownerResult.rows.length > 0 ? ownerResult.rows[0].address : null;
            
            // Check for discrepancies
            if (blockchainOwner !== databaseOwner) {
              const discrepancy = {
                type: 'nft_ownership',
                nftId: nft.id,
                tokenId: nft.token_id,
                databaseOwner: databaseOwner,
                blockchainOwner: blockchainOwner,
                timestamp: new Date().toISOString()
              };
              
              results.discrepancies.push(discrepancy);
              
              // Auto-sync NFT ownership
              console.log(`🔄 Auto-syncing NFT ${nft.token_id} ownership`);
              await this.blockchainService.syncNFTWithBlockchain(nft.id, nft.token_id);
              results.synced++;
            }
          } else {
            results.errors.push({
              type: 'blockchain_nft_owner_fetch',
              nftId: nft.id,
              tokenId: nft.token_id,
              error: blockchainResult.error
            });
          }
        } catch (error) {
          results.errors.push({
            type: 'nft_reconciliation',
            nftId: nft.id,
            tokenId: nft.token_id,
            error: error.message
          });
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'nft_reconciliation_batch',
        error: error.message
      });
    }

    return results;
  }

  // Alert on discrepancies
  async alertOnDiscrepancies(discrepancies) {
    try {
      // Log discrepancies to a dedicated table for monitoring
      for (const discrepancy of discrepancies) {
        await pool.query(
          `INSERT INTO reconciliation_alerts 
           (type, data, severity, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [
            discrepancy.type,
            JSON.stringify(discrepancy),
            'warning',
            new Date()
          ]
        );
      }
    } catch (error) {
      console.error('❌ Failed to log discrepancies:', error);
    }
  }

  // Manual reconciliation for specific wallet
  async reconcileWallet(walletId) {
    try {
      const walletResult = await pool.query(
        'SELECT * FROM wallet_accounts WHERE id = $1',
        [walletId]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = walletResult.rows[0];
      const syncResult = await this.blockchainService.syncWithBlockchain(wallet.user_id, wallet.address);
      
      return {
        success: true,
        walletId: walletId,
        address: wallet.address,
        syncResult: syncResult
      };
    } catch (error) {
      return {
        success: false,
        walletId: walletId,
        error: error.message
      };
    }
  }

  // Manual reconciliation for specific NFT
  async reconcileNFT(nftId) {
    try {
      const nftResult = await pool.query(
        'SELECT * FROM nfts WHERE id = $1',
        [nftId]
      );

      if (nftResult.rows.length === 0) {
        throw new Error('NFT not found');
      }

      const nft = nftResult.rows[0];
      const syncResult = await this.blockchainService.syncNFTWithBlockchain(nftId, nft.token_id);
      
      return {
        success: true,
        nftId: nftId,
        tokenId: nft.token_id,
        syncResult: syncResult
      };
    } catch (error) {
      return {
        success: false,
        nftId: nftId,
        error: error.message
      };
    }
  }

  // Get reconciliation status
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.reconciliationInterval ? 5 : null, // Default interval
      lastRun: new Date().toISOString()
    };
  }
}

module.exports = TransactionReconciliationService;
