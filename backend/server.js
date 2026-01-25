const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const ZKIntegrationService = require('./services/zkIntegrationService');
const SimpleZKVerificationService = require('./services/simpleZKService');
const {
  apiLimits,
  securityHeaders,
  corsOptions,
  requestSigning,
  inputValidation,
  sqlInjectionProtection,
  xssProtection,
  requestLogging,
  errorHandler,
  healthCheck
} = require('./middleware/security');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Kubernetes/Nginx)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const { getInstance: getBlockchain } = require('./services/enhancedBlockchainService');
const { scanEscrow, scanLoanVault, ensureIndexerTables } = require('./services/indexerService');
const OracleService = require('./services/oracleService');
const { getTransactionHistory } = require('./services/transactionBackend');

// Load deployed addresses as fallback if env not set
try {
  const fs = require('fs');
  const path = require('path');
  const networkName = process.env.NETWORK || 'sepolia';
  const depPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  if (!process.env.ESCROW_CONTRACT_ADDRESS && fs.existsSync(depPath)) {
    const dep = JSON.parse(fs.readFileSync(depPath, 'utf8'));
    if (dep?.EscrowLoan?.address) {
      process.env.ESCROW_CONTRACT_ADDRESS = dep.EscrowLoan.address;
      console.log(`🔗 ESCROW_CONTRACT_ADDRESS loaded from deployments: ${dep.EscrowLoan.address}`);
    }
  }
} catch (_) {}

// Security middleware (order matters!)
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(requestLogging);
app.use(sqlInjectionProtection);
app.use(xssProtection);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all routes
app.use('/api', apiLimits.general);

// Database connection
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/agrifinance',
    ssl: {
      rejectUnauthorized: false
    }
  });
} catch (error) {
  console.error('❌ Database connection error:', error.message);
  console.log('💡 Please ensure PostgreSQL is installed and running, or check your DATABASE_URL');
  process.exit(1);
}

// Initialize ZK Integration Service with simplified version
const zkIntegrationService = new SimpleZKVerificationService();

// Initialize Enhanced Blockchain Service
const blockchainService = getBlockchain();
(async () => {
  try {
    await blockchainService.initialize();
    blockchainService.setDatabase(pool);
    console.log('✅ Enhanced Blockchain Service ready');
  } catch (err) {
    console.error('❌ Failed to initialize blockchain service:', err.message);
  }
})();

// Initialize Oracle Service (Chainlink price feeds)
const oracleService = new OracleService(process.env.RPC_SEPOLIA);
console.log('✅ Oracle Service initialized');

// IPFS Document APIs (Phase 2)
const ipfsService = require('./services/ipfsService');

// Upload a document to IPFS
app.post('/api/docs/upload', authenticateToken, async (req, res) => {
  try {
    const { fileBase64, filename, title, mimeType, metadata } = req.body || {};
    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 is required' });
    }
    const buffer = Buffer.from(fileBase64, 'base64');
    const up = await ipfsService.uploadBuffer(buffer, filename || 'document.bin', metadata || {});

    const result = await pool.query(
      `INSERT INTO documents (owner_id, title, mime_type, cid, ipfs_url, gateway_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, cid, ipfs_url, gateway_url`,
      [req.user.id, title || filename || null, mimeType || null, up.cid, up.url, up.gatewayUrl, metadata || {}]
    );

    res.json({
      success: true,
      document: result.rows[0]
    });
  } catch (error) {
    console.error('IPFS upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Lender metrics: auto-repayments from marketplace and loan health
app.get('/api/lender/metrics', authenticateToken, async (req, res) => {
  try {
    const last30 = await pool.query(
      `SELECT COALESCE(SUM(amount_wei),0)::numeric AS sum
       FROM transactions
       WHERE transaction_type='auto_repay_marketplace' AND created_at > NOW() - INTERVAL '30 day'`
    );
    const activeLoans = await pool.query("SELECT COUNT(*)::int AS c FROM protocol_loans WHERE status='active'");
    const delinquent = await pool.query("SELECT COUNT(*)::int AS c FROM protocol_loans WHERE status='active' AND delinquent = true");
    res.json({ autoRepayLast30Wei: last30.rows[0].sum, activeLoans: activeLoans.rows[0].c, delinquentLoans: delinquent.rows[0].c });
  } catch (e) {
    console.error('Lender metrics error:', e.message);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

async function enforceSlashingForLoan(loanId) {
  await ensureCommitteeTables();
  const grace = Number(process.env.DELINQUENCY_GRACE_DAYS || 14);
  const slashBps = Number(process.env.SLASH_PERCENT_BPS || 500); // 5%
  const lr = await pool.query('SELECT next_due_date, delinquent, status FROM protocol_loans WHERE id=$1', [loanId]);
  if (lr.rows.length === 0) return { skipped: 'loan not found' };
  const loan = lr.rows[0];
  if (loan.status === 'repaid') return { skipped: 'already repaid' };
  if (!loan.delinquent || !loan.next_due_date) return { skipped: 'not delinquent' };
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - grace);
  const nextDue = new Date(loan.next_due_date);
  if (!(nextDue < cutoff)) return { skipped: 'within grace' };
  // find linked request and approvals
  const link = await pool.query('SELECT request_id FROM loan_request_links WHERE loan_id=$1', [loanId]);
  if (link.rows.length === 0) return { skipped: 'no link' };
  const requestId = link.rows[0].request_id;
  const approvals = await pool.query("SELECT member_id FROM loan_request_votes WHERE request_id=$1 AND decision='approve'", [requestId]);
  if (approvals.rows.length === 0) return { skipped: 'no approvers' };
  // slash each approver by percentage of their current stake
  for (const row of approvals.rows) {
    const memberId = row.member_id;
    const m = await pool.query('SELECT staked_wei FROM committee_members WHERE user_id=$1', [memberId]);
    if (m.rows.length === 0) continue;
    const staked = BigInt(m.rows[0].staked_wei);
    const slash = (staked * BigInt(slashBps)) / 10000n;
    const newStake = staked > slash ? (staked - slash) : 0n;
    await pool.query('UPDATE committee_members SET staked_wei=$2 WHERE user_id=$1', [memberId, newStake.toString()]);
    await pool.query('INSERT INTO slashing_events (loan_id, member_id, amount_wei, reason) VALUES ($1,$2,$3,$4)', [loanId, memberId, slash.toString(), 'Delinquent beyond grace']);
  }
  return { success: true, slashed: approvals.rows.length };
}

// Admin endpoint to enforce slashing for a specific loan
app.post('/api/admin/enforce-slashing', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { loanId } = req.body || {};
    if (!loanId) return res.status(400).json({ error: 'loanId required' });
    const result = await enforceSlashingForLoan(loanId);
    res.json(result);
  } catch (e) {
    console.error('Enforce slashing error:', e.message);
    res.status(500).json({ error: 'Failed to enforce slashing' });
  }
});

// View slashing history for current member
app.get('/api/committee/slashes', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const rows = await pool.query('SELECT id, loan_id, amount_wei, reason, created_at FROM slashing_events WHERE member_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ slashes: rows.rows });
  } catch (e) {
    console.error('Get slashes error:', e.message);
    res.status(500).json({ error: 'Failed to fetch slashes' });
  }
});

// Get schedule for a specific loan
app.get('/api/loans/:loanId/schedule', authenticateToken, async (req, res) => {
  try {
    await ensureLoanScheduleTables();
    const { loanId } = req.params;
  const own = await pool.query('SELECT id FROM protocol_loans WHERE id=$1 AND borrower_id_text=$2', [loanId, String(req.user.id)]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const rows = await pool.query('SELECT id, due_date, amount_wei, paid_wei, status FROM loan_payments WHERE loan_id=$1 ORDER BY due_date ASC, id ASC', [loanId]);
    res.json({ schedule: rows.rows });
  } catch (e) {
    console.error('Get schedule error:', e.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// List repaid loans for current user
app.get('/api/loans/repaid', authenticateToken, async (req, res) => {
  try {
    await ensureLoanScheduleTables();
    
    // Query repaid loans by user ID (borrower_id_text)
    const rows = await pool.query(
      `SELECT id, principal_wei, interest_bps, duration_days, status, repaid_wei, created_at, repaid_at, 
              tx_hash, loanvault_loan_id, on_chain_loan_id, repayment_tx_hash
       FROM protocol_loans
       WHERE borrower_id_text = $1 AND status = 'repaid'
       ORDER BY repaid_at DESC, id DESC`,
      [String(req.user.id)]
    );
    
    res.json({ loans: rows.rows });
  } catch (e) {
    console.error('List repaid loans error:', e.message);
    res.status(500).json({ error: 'Failed to list repaid loans' });
  }
});

// List active loans for current user
app.get('/api/loans/active', authenticateToken, async (req, res) => {
  try {
    await ensureLoanScheduleTables();
    
    // First, get user's wallet address to check if loans exist on-chain that aren't in DB
    let walletAddress = null;
    try {
      const walletResult = await pool.query(
        'SELECT address FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 ORDER BY created_at DESC LIMIT 1',
        [req.user.id, 'agrifinance']
      );
      if (walletResult.rows.length > 0) {
        walletAddress = walletResult.rows[0].address;
      }
    } catch (walletErr) {
      console.warn('Could not fetch wallet address:', walletErr);
    }
    
    // Query loans by user ID (borrower_id_text)
    const rows = await pool.query(
      `SELECT id, principal_wei, interest_bps, duration_days, status, repaid_wei, created_at, next_due_date, delinquent, 
              tx_hash, loanvault_loan_id, on_chain_loan_id
       FROM protocol_loans
       WHERE borrower_id_text = $1 AND status <> 'repaid'
       ORDER BY id DESC`,
      [String(req.user.id)]
    );
    
    // ALWAYS check blockchain for any missing loans (even if we have some in DB)
    // This ensures all on-chain loans are synced to the database
    if (walletAddress) {
      console.log(`🔍 Checking blockchain for all loans for ${walletAddress}...`);
      
      try {
        const fs = require('fs');
        const path = require('path');
        const networkName = process.env.NETWORK || 'sepolia';
        const depPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
        let deployments = {};
        if (fs.existsSync(depPath)) {
          deployments = JSON.parse(fs.readFileSync(depPath, 'utf8'));
        }
        
        const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
        const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
        
        // Scan for LoanCreated events for this wallet
        const loanVaultABI = ['event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate)'];
        const iface = new ethers.utils.Interface(loanVaultABI);
        const topic0 = iface.getEventTopic('LoanCreated');
        const borrowerTopic = ethers.utils.hexZeroPad(walletAddress.toLowerCase(), 32);
        
        const currentBlock = await provider.getBlockNumber();
        // Scan further back to catch older loans (last 200k blocks, ~1 month on Sepolia)
        const fromBlock = Math.max(0, currentBlock - 200000);
        
        const logs = await provider.getLogs({
          address: loanVaultAddress.toLowerCase(),
          fromBlock,
          toBlock: 'latest',
          topics: [topic0, null, borrowerTopic]
        });
        
        if (logs.length > 0) {
          console.log(`✅ Found ${logs.length} on-chain LoanCreated event(s) for ${walletAddress}`);
          
          // Get current on-chain loan IDs that we already have in DB
          const existingOnChainIds = new Set(
            rows.rows
              .map(r => r.loanvault_loan_id || r.on_chain_loan_id)
              .filter(Boolean)
              .map(id => String(id))
          );
          
          // Parse events and sync any missing loans
          for (const log of logs) {
            try {
              const parsed = iface.parseLog(log);
              const onChainLoanId = parsed.args.loanId.toString();
              const amount = parsed.args.amount.toString();
              const interestRate = parsed.args.interestRate.toString();
              const amountKRSI = (Number(amount) / 1_000_000).toFixed(2);
              
              console.log(`   📋 Processing on-chain loan ${onChainLoanId}: ${amountKRSI} KRSI, TX: ${log.transactionHash}`);
              
              // Check if we already have this loan in database
              const existing = await pool.query(
                `SELECT * FROM protocol_loans 
                 WHERE (loanvault_loan_id = $1 OR on_chain_loan_id = $1 OR tx_hash = $2)
                   AND borrower_id_text = $3`,
                [onChainLoanId, log.transactionHash, String(req.user.id)]
              );
              
              if (existing.rows.length === 0) {
                // Loan doesn't exist in DB - create it
                console.log(`   ➕ Creating missing database record for on-chain loan ${onChainLoanId}...`);
                
                // Get loan details from contract to get accurate info
                try {
                  const loanVaultABI = ['function loans(uint256) view returns (uint256 loanId, address borrower, uint256 amount, uint256 interestRate, uint256 termDays, uint256 collateralValue, uint256 creditScore, uint256 createdAt, uint256 dueDate, bool isActive, bool isRepaid, bool isDefaulted)'];
                  const loanVaultIface = new ethers.utils.Interface(loanVaultABI);
                  const loanVaultContract = new ethers.Contract(loanVaultAddress, loanVaultABI, provider);
                  const loanDetails = await loanVaultContract.loans(onChainLoanId);
                  
                  const termDays = Number(loanDetails.termDays) || 180;
                  const interestBps = Number(loanDetails.interestRate) || 800; // Fixed at 8%
                  const status = loanDetails.isRepaid ? 'repaid' : (loanDetails.isActive ? 'active' : 'defaulted');
                  
                  // Ensure repaid_at column exists
                  await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMP WITH TIME ZONE`);
                  
                  const newLoan = await pool.query(
                    `INSERT INTO protocol_loans(borrower_id_text, principal_wei, interest_bps, duration_days, status, tx_hash, loanvault_loan_id, on_chain_loan_id, repaid_wei, repaid_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                    [
                      String(req.user.id), 
                      amount, 
                      interestBps, 
                      termDays,
                      status,
                      log.transactionHash, 
                      onChainLoanId, 
                      onChainLoanId,
                      loanDetails.isRepaid ? amount : '0', // If repaid, mark as fully repaid
                      loanDetails.isRepaid ? new Date().toISOString() : null // Set repaid_at if already repaid
                    ]
                  );
                  
                  console.log(`   ✅ Created database record for loan ${onChainLoanId} (DB ID: ${newLoan.rows[0].id})`);
                  
                  // Add to results if active
                  if (status === 'active') {
                    rows.rows.push(newLoan.rows[0]);
                  }
                } catch (contractErr) {
                  console.warn(`   ⚠️ Could not fetch loan details from contract, using event data:`, contractErr.message);
                  // Fallback: create with event data
                  const newLoan = await pool.query(
                    `INSERT INTO protocol_loans(borrower_id_text, principal_wei, interest_bps, duration_days, status, tx_hash, loanvault_loan_id, on_chain_loan_id)
                     VALUES ($1, $2, $3, $4, 'active', $5, $6, $7) RETURNING *`,
                    [String(req.user.id), amount, Number(interestRate) || 800, 180, log.transactionHash, onChainLoanId, onChainLoanId] // Fixed at 8%
                  );
                  rows.rows.push(newLoan.rows[0]);
                }
              } else {
                // Loan exists - update it to ensure it's linked correctly
                const existingLoan = existing.rows[0];
                const needsUpdate = !existingLoan.loanvault_loan_id || 
                                   !existingLoan.on_chain_loan_id || 
                                   existingLoan.borrower_id_text !== String(req.user.id) ||
                                   existingLoan.tx_hash !== log.transactionHash;
                
                if (needsUpdate) {
                  console.log(`   🔄 Updating existing record (DB ID: ${existingLoan.id}) to link with on-chain loan ${onChainLoanId}...`);
                  
                  // Check if loan is repaid on-chain
                  try {
                    const loanVaultABI = ['function loans(uint256) view returns (uint256 loanId, address borrower, uint256 amount, uint256 interestRate, uint256 termDays, uint256 collateralValue, uint256 creditScore, uint256 createdAt, uint256 dueDate, bool isActive, bool isRepaid, bool isDefaulted)'];
                    const loanVaultContract = new ethers.Contract(loanVaultAddress, loanVaultABI, provider);
                    const onChainLoan = await loanVaultContract.loans(onChainLoanId);
                    
                    // Ensure repaid_at column exists
                    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMP WITH TIME ZONE`);
                    
                    await pool.query(
                      `UPDATE protocol_loans 
                       SET borrower_id_text = $1, 
                           loanvault_loan_id = $2, 
                           on_chain_loan_id = $2, 
                           tx_hash = COALESCE(tx_hash, $3),
                           status = CASE 
                             WHEN $5 = true THEN 'repaid'
                             WHEN status = 'repaid' THEN 'repaid' 
                             ELSE 'active' 
                           END,
                           repaid_at = CASE 
                             WHEN $5 = true AND repaid_at IS NULL THEN NOW()
                             ELSE repaid_at
                           END,
                           repaid_wei = CASE 
                             WHEN $5 = true THEN principal_wei
                             ELSE repaid_wei
                           END
                       WHERE id = $4 RETURNING *`,
                      [String(req.user.id), onChainLoanId, log.transactionHash, existingLoan.id, onChainLoan.isRepaid]
                    );
                    
                    if (onChainLoan.isRepaid && existingLoan.status !== 'repaid') {
                      console.log(`   ✅ Loan ${onChainLoanId} marked as repaid based on on-chain state`);
                    }
                  } catch (onChainCheckErr) {
                    console.warn(`   ⚠️ Could not check on-chain repayment status:`, onChainCheckErr.message);
                    // Fallback update without on-chain check
                    await pool.query(
                      `UPDATE protocol_loans 
                       SET borrower_id_text = $1, 
                           loanvault_loan_id = $2, 
                           on_chain_loan_id = $2, 
                           tx_hash = COALESCE(tx_hash, $3),
                           status = CASE WHEN status = 'repaid' THEN 'repaid' ELSE 'active' END
                       WHERE id = $4 RETURNING *`,
                      [String(req.user.id), onChainLoanId, log.transactionHash, existingLoan.id]
                    );
                  }
                  
                  // Re-fetch to include in results if active
                  const updated = await pool.query(
                    'SELECT * FROM protocol_loans WHERE id = $1 AND status <> $2', 
                    [existingLoan.id, 'repaid']
                  );
                  if (updated.rows.length > 0) {
                    // Remove old entry and add updated one
                    const oldIndex = rows.rows.findIndex(r => r.id === existingLoan.id);
                    if (oldIndex >= 0) {
                      rows.rows[oldIndex] = updated.rows[0];
                    } else {
                      rows.rows.push(updated.rows[0]);
                    }
                  }
                } else {
                  console.log(`   ✓ Loan ${onChainLoanId} already synced (DB ID: ${existingLoan.id})`);
                }
              }
            } catch (parseErr) {
              console.warn(`   Could not parse event:`, parseErr);
            }
          }
          
          console.log(`✅ Synced ${logs.length} on-chain loan(s) for ${walletAddress}`);
        } else {
          console.log(`📋 No on-chain LoanCreated events found for ${walletAddress}`);
        }
      } catch (blockchainErr) {
        console.warn('Could not check blockchain for missing loans:', blockchainErr.message);
      }
    }
    
    res.json({ loans: rows.rows });
  } catch (e) {
    console.error('List active loans error:', e.message);
    res.status(500).json({ error: 'Failed to list loans' });
  }
});

// Start streaming repayments
app.post('/api/loans/:loanId/stream/start', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { rateWeiPerSec } = req.body || {};
    if (!rateWeiPerSec) return res.status(400).json({ error: 'rateWeiPerSec required' });
    const own = await pool.query('SELECT id FROM protocol_loans WHERE id=$1 AND borrower_id_text=$2', [loanId, String(req.user.id)]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });
    await ensureStreamingTables();
    await pool.query(`
      INSERT INTO repayment_streams (loan_id, rate_wei_per_sec)
      VALUES ($1, $2)
      ON CONFLICT (loan_id) DO UPDATE SET rate_wei_per_sec = EXCLUDED.rate_wei_per_sec, status = 'active', last_accrued_at = NOW()
    `, [loanId, rateWeiPerSec]);
    res.json({ success: true });
  } catch (e) {
    console.error('Stream start error:', e.message);
    res.status(500).json({ error: 'Failed to start streaming' });
  }
});

// Stop streaming repayments
app.post('/api/loans/:loanId/stream/stop', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;
    const own = await pool.query('SELECT id FROM protocol_loans WHERE id=$1 AND borrower_id_text=$2', [loanId, String(req.user.id)]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });
    await ensureStreamingTables();
    await pool.query('UPDATE repayment_streams SET status = $2 WHERE loan_id=$1', [loanId, 'stopped']);
    res.json({ success: true });
  } catch (e) {
    console.error('Stream stop error:', e.message);
    res.status(500).json({ error: 'Failed to stop streaming' });
  }
});

// Accrue streaming into loan/schedule
app.post('/api/loans/stream/accrue', authenticateToken, async (req, res) => {
  try {
    await ensureStreamingTables();
    await ensureLoanScheduleTables();
    const streams = await pool.query("SELECT * FROM repayment_streams WHERE status='active'");
    let totalAccrued = 0n;
    for (const s of streams.rows) {
      const last = new Date(s.last_accrued_at);
      const now = new Date();
      const secs = BigInt(Math.floor((now.getTime() - last.getTime()) / 1000));
      if (secs <= 0n) continue;
      const rate = BigInt(s.rate_wei_per_sec);
      const amount = rate * secs;
      // Apply to schedule like standard repay
      let remaining = amount;
      const dues = await pool.query(`SELECT * FROM loan_payments WHERE loan_id=$1 AND status <> 'paid' ORDER BY due_date ASC, id ASC`, [s.loan_id]);
      for (const row of dues.rows) {
        if (remaining === 0n) break;
        const due = BigInt(row.amount_wei);
        const paid = BigInt(row.paid_wei);
        const owed = due - paid;
        const pay = remaining >= owed ? owed : remaining;
        const newPaid = (paid + pay).toString();
        const newStatus = (paid + pay) >= due ? 'paid' : 'partial';
        await pool.query('UPDATE loan_payments SET paid_wei=$1, status=$2 WHERE id=$3', [newPaid, newStatus, row.id]);
        remaining -= pay;
      }
      await pool.query(
        `UPDATE protocol_loans SET repaid_wei = repaid_wei + $1,
          status = CASE WHEN (repaid_wei + $1) >= principal_wei THEN 'repaid' ELSE status END,
          next_due_date = (
            SELECT due_date FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' ORDER BY due_date ASC LIMIT 1
          ),
          delinquent = EXISTS (
            SELECT 1 FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' AND due_date < CURRENT_DATE
          )
         WHERE id = $2`, [amount.toString(), s.loan_id]
      );
      await pool.query('UPDATE repayment_streams SET last_accrued_at = NOW() WHERE loan_id=$1', [s.loan_id]);
      await pool.query('UPDATE liquidity_pools SET total_borrows_wei = GREATEST(total_borrows_wei - $1, 0)', [amount.toString()]);
      totalAccrued += amount;
    }
    res.json({ success: true, accruedWei: totalAccrued.toString() });
  } catch (e) {
    console.error('Stream accrue error:', e.message);
    res.status(500).json({ error: 'Failed to accrue streams' });
  }
});

// Link a document to an NFT
app.post('/api/docs/link-to-nft', authenticateToken, async (req, res) => {
  try {
    const { nftId, documentId } = req.body || {};
    if (!nftId || !documentId) {
      return res.status(400).json({ error: 'nftId and documentId are required' });
    }
    await pool.query(
      `INSERT INTO nft_documents (nft_id, document_id) VALUES ($1, $2)
       ON CONFLICT (nft_id, document_id) DO NOTHING`,
      [nftId, documentId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Link document error:', error.message);
    res.status(500).json({ error: 'Failed to link document to NFT' });
  }
});

// List current user's documents
app.get('/api/docs/mine', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, mime_type, cid, ipfs_url, gateway_url, metadata, created_at
       FROM documents WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Fetch my docs error:', error.message);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ===== Phase 3: Liquidity & Loans (DB-first with on-chain sync later) =====
// ===== Adopt-next: Committee staking and unsecured loan requests =====

// Ensure committee-related tables exist
async function ensureCommitteeTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS committee_members (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      staked_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
      slashed_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_requests (
      id SERIAL PRIMARY KEY,
      borrower_id UUID REFERENCES users(id) ON DELETE CASCADE,
      principal_wei DECIMAL(78,0) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approvals INTEGER NOT NULL DEFAULT 0,
      rejections INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Optional metadata columns for richer requests
  await pool.query(`
    ALTER TABLE loan_requests
    ADD COLUMN IF NOT EXISTS loan_term_days INTEGER,
    ADD COLUMN IF NOT EXISTS loan_category TEXT,
    ADD COLUMN IF NOT EXISTS reason_text TEXT,
    ADD COLUMN IF NOT EXISTS is_agri BOOLEAN;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_request_votes (
      request_id INTEGER REFERENCES loan_requests(id) ON DELETE CASCADE,
      member_id UUID REFERENCES users(id) ON DELETE CASCADE,
      decision TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (request_id, member_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_request_links (
      loan_id INTEGER UNIQUE REFERENCES protocol_loans(id) ON DELETE CASCADE,
      request_id INTEGER REFERENCES loan_requests(id) ON DELETE CASCADE
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS slashing_events (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES protocol_loans(id) ON DELETE CASCADE,
      member_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount_wei DECIMAL(78,0) NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function ensureLoanScheduleTables() {
  await pool.query(`
    ALTER TABLE IF EXISTS protocol_loans
    ADD COLUMN IF NOT EXISTS next_due_date DATE,
    ADD COLUMN IF NOT EXISTS delinquent BOOLEAN NOT NULL DEFAULT false;
  `);
  // Ensure loan_payments has integer loan_id (not uuid from older schema)
  await pool.query('DROP TABLE IF EXISTS loan_payments');
  await pool.query(`
    CREATE TABLE loan_payments (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES protocol_loans(id) ON DELETE CASCADE,
      due_date DATE NOT NULL,
      amount_wei DECIMAL(78,0) NOT NULL,
      paid_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'due',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function ensureStreamingTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repayment_streams (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER UNIQUE REFERENCES protocol_loans(id) ON DELETE CASCADE,
      rate_wei_per_sec DECIMAL(78,0) NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_accrued_at TIMESTAMP NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'active'
    );
  `);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

async function generateLoanSchedule(loanId, principalWei, durationDays, interestBps) {
  await ensureLoanScheduleTables();
  const n = Math.max(1, Math.ceil((Number(durationDays||180)) / 30));
  const principal = BigInt(principalWei);
  const aprBps = BigInt(interestBps || 0);
  // simple interest pro-rated by durationDays
  const interest = aprBps === 0n ? 0n : (principal * aprBps * BigInt(Number(durationDays||180))) / (BigInt(10000) * BigInt(365));
  const total = principal + interest;
  const per = total / BigInt(n);
  let remainder = total - per * BigInt(n);
  const today = new Date();
  const entries = [];
  for (let i=1;i<=n;i++) {
    let amt = per;
    if (i===n) amt = per + remainder; // last installment absorbs remainder
    const due = addDays(today, i*30);
    entries.push({ loanId, dueDate: due, amount: amt.toString() });
  }
  for (const e of entries) {
    await pool.query(
      `INSERT INTO loan_payments (loan_id, due_date, amount_wei) VALUES ($1, $2, $3)`,
      [loanId, e.dueDate, e.amount]
    );
  }
  await pool.query(
    `UPDATE protocol_loans SET next_due_date = $2 WHERE id = $1`,
    [loanId, entries[0].dueDate]
  );
}

// Committee: stake
app.post('/api/committee/stake', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const { amountWei } = req.body || {};
    if (!amountWei) return res.status(400).json({ error: 'amountWei is required' });
    await pool.query(`
      INSERT INTO committee_members (user_id, staked_wei)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET staked_wei = committee_members.staked_wei + EXCLUDED.staked_wei
    `, [req.user.id, amountWei]);
    const row = await pool.query('SELECT * FROM committee_members WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, member: row.rows[0] });
  } catch (e) {
    console.error('Committee stake error:', e.message);
    res.status(500).json({ error: 'Failed to stake' });
  }
});

// Committee: list members
app.get('/api/committee/members', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const rows = await pool.query('SELECT * FROM committee_members ORDER BY staked_wei DESC');
    res.json({ members: rows.rows });
  } catch (e) {
    console.error('Committee members error:', e.message);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Unsecured loan request: create
app.post('/api/loans/request-unsecured', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const { principalWei, loanTermDays, loanCategory, reasonText, isAgri } = req.body || {};
    if (!principalWei) return res.status(400).json({ error: 'principalWei is required' });
    const r = await pool.query(
      `INSERT INTO loan_requests (borrower_id, principal_wei, loan_term_days, loan_category, reason_text, is_agri)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, principalWei, loanTermDays || null, loanCategory || null, reasonText || null, isAgri === true]
    );
    res.json({ success: true, request: r.rows[0] });
  } catch (e) {
    console.error('Create loan request error:', e.message);
    res.status(500).json({ error: 'Failed to create loan request' });
  }
});

// Unsecured loan request: member vote (approve/reject)
app.post('/api/loans/approve-request', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const { requestId, decision } = req.body || {};
    if (!requestId || !['approve','reject'].includes(decision)) {
      return res.status(400).json({ error: 'requestId and decision (approve|reject) required' });
    }
    // Must be a committee member to vote
    const member = await pool.query('SELECT * FROM committee_members WHERE user_id = $1', [req.user.id]);
    if (member.rows.length === 0) {
      return res.status(403).json({ error: 'Not a committee member' });
    }
    // Record vote (idempotent)
    await pool.query(`
      INSERT INTO loan_request_votes (request_id, member_id, decision)
      VALUES ($1, $2, $3)
      ON CONFLICT (request_id, member_id) DO UPDATE SET decision = EXCLUDED.decision
    `, [requestId, req.user.id, decision]);
    // Recount
    const tally = await pool.query(
      `SELECT 
        SUM(CASE WHEN decision='approve' THEN 1 ELSE 0 END) AS approvals,
        SUM(CASE WHEN decision='reject' THEN 1 ELSE 0 END) AS rejections
       FROM loan_request_votes WHERE request_id = $1`, [requestId]
    );
    const approvals = Number(tally.rows[0].approvals || 0);
    const rejections = Number(tally.rows[0].rejections || 0);
    await pool.query('UPDATE loan_requests SET approvals=$2, rejections=$3 WHERE id=$1', [requestId, approvals, rejections]);
    const updated = await pool.query('SELECT * FROM loan_requests WHERE id=$1', [requestId]);
    res.json({ success: true, request: updated.rows[0] });
  } catch (e) {
    console.error('Approve loan request error:', e.message);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Unsecured loan request: finalize (creates protocol loan if approvals >= threshold)
app.post('/api/loans/finalize-request', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'requestId required' });
    const r = await pool.query('SELECT * FROM loan_requests WHERE id=$1', [requestId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = r.rows[0];
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    const threshold = Number(process.env.COMMITTEE_APPROVALS_THRESHOLD || 2);
    if (Number(request.approvals) < threshold) {
      return res.status(400).json({ error: `Not enough approvals (need ${threshold})` });
    }
    // Enforce minimum credit score for unsecured finalize
    const minScore = Number(process.env.MIN_CREDIT_SCORE || 300);
    await ensureCreditTables();
    const borrowerScore = await computeScore(request.borrower_id);
    if (borrowerScore < minScore) {
      return res.status(400).json({ error: `Credit score ${borrowerScore} below minimum ${minScore}` });
    }
    
    // Phase 8: Check if borrowing is paused
    const pauseCheck = await checkBorrowingPause();
    if (pauseCheck.paused) {
      return res.status(503).json({ error: pauseCheck.reason || 'Borrowing is temporarily paused due to market volatility' });
    }
    
    // Ensure pool exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS protocol_loans (
        id SERIAL PRIMARY KEY,
        borrower_id_text TEXT,
        principal_wei DECIMAL(78,0) NOT NULL,
        interest_bps INTEGER NOT NULL DEFAULT 800,
        duration_days INTEGER NOT NULL DEFAULT 180,
        status TEXT NOT NULL DEFAULT 'active',
        repaid_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS borrower_id_text TEXT`);
    await pool.query(`ALTER TABLE protocol_loans DROP COLUMN IF EXISTS borrower_id`);
    // Ensure leftover FKs from older schema are removed
    await pool.query(`ALTER TABLE protocol_loans DROP CONSTRAINT IF EXISTS protocol_loans_borrower_id_fkey`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pools (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL DEFAULT 'KRSI',
        total_deposits_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        total_borrows_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        apy_bps INTEGER NOT NULL DEFAULT 800,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Strategy columns for Phase 6
    await pool.query(`
      ALTER TABLE liquidity_pools
      ADD COLUMN IF NOT EXISTS strategy_name TEXT,
      ADD COLUMN IF NOT EXISTS strategy_apr_bps INTEGER;
    `);
    // Create loan and update pool borrows
    const loan = await pool.query(
      `INSERT INTO protocol_loans (borrower_id_text, principal_wei) VALUES ($1, $2) RETURNING *`,
      [String(request.borrower_id), request.principal_wei]
    );
    await pool.query('UPDATE loan_requests SET status=$2 WHERE id=$1', [requestId, 'approved']);
    await pool.query('UPDATE liquidity_pools SET total_borrows_wei = total_borrows_wei + $1', [request.principal_wei]);
    // Link request to loan
    await pool.query('INSERT INTO loan_request_links (loan_id, request_id) VALUES ($1, $2) ON CONFLICT (loan_id) DO NOTHING', [loan.rows[0].id, requestId]);
    res.json({ success: true, loan: loan.rows[0] });
  } catch (e) {
    console.error('Finalize loan request error:', e.message);
    res.status(500).json({ error: 'Failed to finalize request' });
  }
});

// List loan requests (for committee/admin)
app.get('/api/loans/requests', authenticateToken, async (req, res) => {
  try {
    await ensureCommitteeTables();
    const { status } = req.query || {};
    const q = status ? 'WHERE status = $1' : '';
    const rows = await pool.query(`SELECT * FROM loan_requests ${q} ORDER BY created_at DESC`, status ? [status] : []);
    res.json({ requests: rows.rows });
  } catch (e) {
    console.error('List loan requests error:', e.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ===== Credit scoring (lightweight, computed from existing signals) =====
async function ensureCreditTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_scores (
      user_id TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 0,
      last_updated TIMESTAMP DEFAULT NOW()
    );
  `);
  // Normalize schema without DO blocks for wider DB support
  // Drop legacy FK constraints that force UUID type
  await pool.query(`ALTER TABLE credit_scores DROP CONSTRAINT IF EXISTS credit_scores_user_id_fkey`);
  await pool.query(`ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS id UUID`);
  await pool.query(`ALTER TABLE credit_scores ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
  await pool.query(`ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE credit_scores ALTER COLUMN user_id TYPE TEXT USING user_id::text`);
  await pool.query(`ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS factors JSONB`);
  await pool.query(`ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS risk_level TEXT`);
  await pool.query(`ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS source TEXT`);
  // Ensure upsert key on user_id exists
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS credit_scores_user_id_idx ON credit_scores(user_id)`);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

async function computeScore(userId) {
  // Signals
  const docs = await pool.query('SELECT COUNT(*)::int AS c FROM documents WHERE owner_id::text = $1', [String(userId)]);
  const repayments = await pool.query('SELECT COALESCE(SUM(repaid_wei),0)::numeric AS s FROM protocol_loans WHERE borrower_id_text = $1', [String(userId)]);
  const approvals = await pool.query("SELECT COALESCE(SUM(approvals),0)::int AS a FROM loan_requests WHERE borrower_id = $1 AND status = 'approved'", [String(userId)]);
  const purchases = await pool.query('SELECT COUNT(*)::int AS c FROM nfts WHERE owner_id::text = $1', [String(userId)]);

  const wDocs = Number(process.env.CS_W_DOCS || 5);
  const wRepay = Number(process.env.CS_W_REPAY || 1);
  const wApprovals = Number(process.env.CS_W_APPROVALS || 10);
  const wPurch = Number(process.env.CS_W_PURCHASES || 2);

  const scoreRaw = wDocs * Number(docs.rows[0].c)
    + wRepay * Number(repayments.rows[0].s)
    + wApprovals * Number(approvals.rows[0].a)
    + wPurch * Number(purchases.rows[0].c);

  // Normalize into 0–1000 window (very rough; can be replaced later)
  const normalized = clamp(Math.floor(scoreRaw / 1_000_000), 0, 1000);
  return normalized;
}

async function computeScoreDetails(userId) {
  const docs = await pool.query('SELECT COUNT(*)::int AS c FROM documents WHERE owner_id::text = $1', [String(userId)]);
  const repayments = await pool.query('SELECT COALESCE(SUM(repaid_wei),0)::numeric AS s FROM protocol_loans WHERE borrower_id_text = $1', [String(userId)]);
  const approvals = await pool.query("SELECT COALESCE(SUM(approvals),0)::int AS a FROM loan_requests WHERE borrower_id = $1 AND status = 'approved'", [String(userId)]);
  const purchases = await pool.query('SELECT COUNT(*)::int AS c FROM nfts WHERE owner_id::text = $1', [String(userId)]);

  const w = {
    DOCS: Number(process.env.CS_W_DOCS || 5),
    REPAY: Number(process.env.CS_W_REPAY || 1),
    APPROVALS: Number(process.env.CS_W_APPROVALS || 10),
    PURCHASES: Number(process.env.CS_W_PURCHASES || 2)
  };

  const components = {
    docs: { count: Number(docs.rows[0].c), weight: w.DOCS, value: w.DOCS * Number(docs.rows[0].c) },
    repayments: { amountWei: Number(repayments.rows[0].s), weight: w.REPAY, value: w.REPAY * Number(repayments.rows[0].s) },
    approvals: { count: Number(approvals.rows[0].a), weight: w.APPROVALS, value: w.APPROVALS * Number(approvals.rows[0].a) },
    purchases: { count: Number(purchases.rows[0].c), weight: w.PURCHASES, value: w.PURCHASES * Number(purchases.rows[0].c) }
  };
  const scoreRaw = components.docs.value + components.repayments.value + components.approvals.value + components.purchases.value;
  const total = clamp(Math.floor(scoreRaw / 1_000_000), 0, 1000);
  return { total, components };
}

// Get current user's credit score
app.get('/api/credit/score', authenticateToken, async (req, res) => {
  try {
    await ensureCreditTables();
    const score = await computeScore(req.user.id);
    await pool.query(
      `INSERT INTO credit_scores (user_id, score, last_updated)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET score = EXCLUDED.score, last_updated = NOW()`,
      [req.user.id, score]
    );
    res.json({ userId: req.user.id, score });
  } catch (e) {
    console.error('Credit score error:', e.message);
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

// Cached score: return last computed score without forcing recompute
app.get('/api/credit/score/cached', authenticateToken, async (req, res) => {
  try {
    await ensureCreditTables();
    const r = await pool.query('SELECT score, last_updated FROM credit_scores WHERE user_id = $1', [String(req.user.id)]);
    if (r.rows.length > 0) {
      return res.json({ userId: req.user.id, score: r.rows[0].score, cached: true, lastUpdated: r.rows[0].last_updated });
    }
    // No score yet; return 200 with null so UI can render a prompt
    res.json({ userId: req.user.id, score: null, cached: true });
  } catch (e) {
    console.error('Credit score cached error:', e.message);
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

// Recompute and persist score on-demand
app.post('/api/credit/score/recompute', authenticateToken, async (req, res) => {
  try {
    await ensureCreditTables();
    const score = await computeScore(req.user.id);
    await pool.query(
      `INSERT INTO credit_scores (user_id, score, last_updated, source)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id) DO UPDATE SET score = EXCLUDED.score, last_updated = NOW(), source = EXCLUDED.source`,
      [String(req.user.id), score, 'enhanced_ai_service_v2']
    );
    res.json({ userId: req.user.id, score, updated: true });
  } catch (e) {
    console.error('Credit score recompute error:', e.message);
    res.status(500).json({ error: 'Failed to recompute score' });
  }
});

// Get score for a given user (admin/lender scope in future)
app.get('/api/credit/score/:userId', authenticateToken, async (req, res) => {
  try {
    await ensureCreditTables();
    const { userId } = req.params;
    const score = await computeScore(userId);
    await pool.query(
      `INSERT INTO credit_scores (user_id, score, last_updated)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET score = EXCLUDED.score, last_updated = NOW()`,
      [userId, score]
    );
    res.json({ userId, score });
  } catch (e) {
    console.error('Credit score (by user) error:', e.message);
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

// Score explanation for current user including components and policy
app.get('/api/credit/score/explain', authenticateToken, async (req, res) => {
  try {
    await ensureCreditTables();
    const data = await computeScoreDetails(req.user.id);
    res.json({
      score: data.total,
      components: data.components,
      policy: {
        minScore: Number(process.env.MIN_CREDIT_SCORE || 300),
        approvalsThreshold: Number(process.env.COMMITTEE_APPROVALS_THRESHOLD || 2),
        weights: {
          docs: Number(process.env.CS_W_DOCS || 5),
          repayments: Number(process.env.CS_W_REPAY || 1),
          approvals: Number(process.env.CS_W_APPROVALS || 10),
          purchases: Number(process.env.CS_W_PURCHASES || 2)
        }
      }
    });
  } catch (e) {
    console.error('Credit explanation error:', e.message);
    res.status(500).json({ error: 'Failed to explain score' });
  }
});

// Public policy info for UIs
app.get('/api/credit/policy', (req, res) => {
  res.json({
    minScore: Number(process.env.MIN_CREDIT_SCORE || 300),
    approvalsThreshold: Number(process.env.COMMITTEE_APPROVALS_THRESHOLD || 2)
  });
});


// Get pool state
app.get('/api/liquidity/pool', authenticateToken, async (req, res) => {
  try {
    // Ensure tables exist (robust if migration not executed)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pools (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL DEFAULT 'KRSI',
        total_deposits_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        total_borrows_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        apy_bps INTEGER NOT NULL DEFAULT 800,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      ALTER TABLE liquidity_pools
      ADD COLUMN IF NOT EXISTS strategy_name TEXT,
      ADD COLUMN IF NOT EXISTS strategy_apr_bps INTEGER;
    `);
    const poolRow = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    if (poolRow.rows.length === 0) {
      const created = await pool.query('INSERT INTO liquidity_pools DEFAULT VALUES RETURNING *');
      return res.json({ pool: created.rows[0] });
    }
    
    // CRITICAL: Sync from blockchain - LoanVault.totalLiquidity() is current available liquidity
    // Also verify against actual token balance for accuracy
    try {
      const fs = require('fs');
      const path = require('path');
      const networkName = process.env.NETWORK || 'sepolia';
      const depPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
      let deployments = {};
      if (fs.existsSync(depPath)) {
        deployments = JSON.parse(fs.readFileSync(depPath, 'utf8'));
      }
      
      const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
      const krishiTokenAddress = deployments.KrishiToken || process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
      
      const loanVaultABI = [
        'function totalLiquidity() view returns (uint256)'
      ];
      
      const tokenABI = [
        'function balanceOf(address account) view returns (uint256)'
      ];
      
      const loanVault = new ethers.Contract(loanVaultAddress, loanVaultABI, provider);
      const krishiToken = new ethers.Contract(krishiTokenAddress, tokenABI, provider);
      
      // Get both totalLiquidity() (what contract says is available) and actual token balance
      const [onChainTotalLiquidity, actualTokenBalance] = await Promise.all([
        loanVault.totalLiquidity(),
        krishiToken.balanceOf(loanVaultAddress)
      ]);
      
      const onChainTotalLiquidityStr = onChainTotalLiquidity.toString();
      const actualTokenBalanceStr = actualTokenBalance.toString();
      
      const dbTotalDeposits = poolRow.rows[0].total_deposits_wei || '0';
      
      // Log for debugging
      console.log(`📊 LoanVault Balance Check:`);
      console.log(`   totalLiquidity(): ${onChainTotalLiquidityStr} wei (${(Number(onChainTotalLiquidityStr) / 1_000_000).toFixed(2)} KRSI)`);
      console.log(`   Actual Token Balance: ${actualTokenBalanceStr} wei (${(Number(actualTokenBalanceStr) / 1_000_000).toFixed(2)} KRSI)`);
      console.log(`   Database total_deposits_wei: ${dbTotalDeposits} wei (${(Number(dbTotalDeposits) / 1_000_000).toFixed(2)} KRSI)`);
      
      // Use totalLiquidity() as it accounts for loans taken out, BUT cap at actualTokenBalance for solvency
      // If there's a fee-on-transfer (e.g. 2%), totalLiquidity (accounting) will be higher than actual balance (physical)
      // We must trust the PHYSICAL balance for what can be withdrawn/borrowed.
      
      const accountingVal = BigInt(onChainTotalLiquidityStr);
      const physicalVal = BigInt(actualTokenBalanceStr);
      
      // Determine the "True" liquidity to show in UI
      // If accounting is much higher (drift/fees), we use physical to avoid promising phantom funds
      let syncValueStr = onChainTotalLiquidityStr;
      let mismatchDetected = false;
      
      if (accountingVal > physicalVal) {
        console.warn(`⚠️  Insolvency detected: Contract thinks it has ${onChainTotalLiquidityStr} but actually holds ${actualTokenBalanceStr}`);
        console.warn(`   Diff: ${accountingVal - physicalVal} wei (Requires Top-Up or Fee Accounting)`);
        
        // Check if it looks like a ~2% fee (common tax)
        // 1021499852 / 51055000000 = 0.02
        const ratio = Number(accountingVal - physicalVal) / Number(accountingVal);
        if (ratio > 0.015 && ratio < 0.025) {
          console.warn('   💡 Likely Cause: 2% Transfer Tax on KRSI token');
        }
        
        // Fix: Use physical balance as the source of truth for the DB/UI
        syncValueStr = actualTokenBalanceStr;
        mismatchDetected = true;
      }

      if (BigInt(syncValueStr) !== BigInt(dbTotalDeposits) || mismatchDetected) {
        console.log(`🔄 Syncing pool total deposits from blockchain (Using ${mismatchDetected ? 'PHYSICAL BALANCE' : 'Accounting Value'}):`);
        console.log(`   Old DB Value: ${dbTotalDeposits} wei`);
        console.log(`   New DB Value: ${syncValueStr} wei`);
        
        await pool.query(
          'UPDATE liquidity_pools SET total_deposits_wei = $1 WHERE id = $2',
          [syncValueStr, poolRow.rows[0].id]
        );
        
        console.log(`✅ Pool total deposits synced to ${syncValueStr} wei`);
        poolRow.rows[0].total_deposits_wei = syncValueStr;
      }
    } catch (syncError) {
      console.warn('⚠️  Could not sync pool total deposits from blockchain:', syncError.message);
      // Continue with database value if blockchain sync fails
    }
    
    // Recompute active borrows to avoid drift
    const active = await pool.query(`SELECT COALESCE(SUM(principal_wei - repaid_wei),0)::numeric AS active FROM protocol_loans WHERE status='active'`);
    const poolObj = poolRow.rows[0];
    if (poolObj) {
      const activeWei = active.rows[0].active || 0;
      // Keep stored value in sync for dashboards
      await pool.query('UPDATE liquidity_pools SET total_borrows_wei = $1 WHERE id = $2', [activeWei, poolObj.id]);
      poolObj.total_borrows_wei = activeWei;
      
      // Phase 8: Calculate dynamic APY based on volatility
      try {
        const priceData = await oracleService.getKRSIPrice();
        if (priceData && priceData.isValid) {
          const baseAPY = Number(poolObj.apy_bps || 800);
          const volatility = priceData.volatility || 0;
          
          // Adjust APY: +10% per 5% volatility above baseline (risk premium)
          // Min: base APY, Max: base APY * 2.5 (cap at 250% increase)
          const volatilityAdjustment = Math.min(volatility / 5 * 10, 250); // Cap at 250% increase
          const dynamicAPY = Math.round(baseAPY * (1 + volatilityAdjustment / 100));
          
          poolObj.apy_bps = dynamicAPY;
          poolObj.base_apy_bps = baseAPY;
          poolObj.volatility = volatility;
          poolObj.apy_adjustment_pct = volatilityAdjustment;
        }
      } catch (e) {
        // If oracle fails, use stored APY
        console.warn('Oracle APY calculation failed, using stored:', e.message);
      }
    }
    res.json({ pool: poolObj });
  } catch (e) {
    console.error('Pool fetch error:', e.message);
    res.status(500).json({ error: 'Failed to fetch pool' });
  }
});

// Sponsored transaction endpoint for farmers (gasless transactions)
const sponsoredTransactionService = require('./services/sponsoredTransactionService');

// Faucet service for requesting Sepolia ETH
const faucetService = require('./services/faucetService');

// Initialize sponsored transaction service on server start
sponsoredTransactionService.initialize();

app.post('/api/transactions/sponsored', authenticateToken, async (req, res) => {
  try {
    // Only allow for farmers
    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (!userRow.rows.length || userRow.rows[0].role !== 'farmer') {
      return res.status(403).json({ error: 'Sponsored transactions only available for farmers' });
    }

    const { to, data, value } = req.body;
    if (!to || !data) {
      return res.status(400).json({ error: 'to and data are required' });
    }

    // Get user's wallet address for logging and balance checks
    const walletRow = await pool.query(
      'SELECT address FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 LIMIT 1',
      [req.user.id, 'agrifinance']
    );
    const userAddress = walletRow.rows[0]?.address || null;

    // Check if sponsored transaction service is available
    if (!sponsoredTransactionService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Sponsored transaction service not initialized. Please set SPONSOR_WALLET_PRIVATE_KEY in backend .env file and restart the server.',
        details: 'The backend sponsor wallet is not configured. Gasless transactions require a sponsor wallet with Sepolia ETH.'
      });
    }

    // Execute sponsored transaction
    const result = await sponsoredTransactionService.executeSponsoredTransaction({
      to,
      data,
      value: value || '0',
      fromAddress: userAddress,
      userAddress: userAddress,
      userId: req.user.id
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed
    });
  } catch (e) {
    console.error('Sponsored transaction error:', e.message);
    res.status(500).json({ error: 'Failed to execute sponsored transaction' });
  }
});

// Get sponsor wallet status (for monitoring)
app.get('/api/transactions/sponsor/status', authenticateToken, async (req, res) => {
  try {
    // Only allow for admins or farmers
    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (!userRow.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const role = userRow.rows[0].role;
    if (role !== 'admin' && role !== 'farmer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const balanceCheck = await sponsoredTransactionService.getSponsorBalance();
    res.json({
      available: sponsoredTransactionService.isAvailable(),
      balance: balanceCheck
    });
  } catch (e) {
    console.error('Sponsor status error:', e.message);
    res.status(500).json({ error: 'Failed to get sponsor status' });
  }
});

// Deposit into pool (records; syncs user balance from blockchain)
app.post('/api/liquidity/deposit', authenticateToken, async (req, res) => {
  try {
    const { amountWei, txHash } = req.body || {};
    if (!amountWei) return res.status(400).json({ error: 'amountWei is required' });
    
    // Get user's wallet to sync balance
    const walletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    const wallet = walletResult.rows[0];
    
    // CRITICAL: Sync user's wallet balance from blockchain after deposit
    // The deposit happened on-chain, so tokens left the wallet - database needs to reflect this
    try {
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
      const krishiTokenAddress = process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
      
      const tokenContract = new ethers.Contract(
        krishiTokenAddress,
        ['function balanceOf(address account) view returns (uint256)'],
        provider
      );
      
      // Get actual on-chain balance (after deposit)
      const onChainBalanceWei = await tokenContract.balanceOf(wallet.address);
      const onChainBalanceStr = onChainBalanceWei.toString();
      
      console.log(`🔄 Syncing wallet balance after deposit: ${wallet.address}`);
      console.log(`   Database: ${wallet.balance_wei || '0'} wei`);
      console.log(`   On-chain: ${onChainBalanceStr} wei`);
      
      // Update wallet balance to match on-chain (blockchain is source of truth)
      await pool.query(
        `UPDATE wallet_accounts 
         SET balance_wei = $1, updated_at = NOW()
         WHERE user_id = $2 AND address = $3`,
        [onChainBalanceStr, req.user.id, wallet.address]
      );
      
      console.log(`✅ Wallet balance synced to ${onChainBalanceStr} wei after deposit`);
    } catch (balanceError) {
      console.warn('⚠️  Could not sync wallet balance from blockchain:', balanceError.message);
      // Continue anyway - deposit record is still created
    }
    
    // Ensure dependent tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_deposits (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_wei DECIMAL(78,0) NOT NULL,
        tx_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pools (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL DEFAULT 'KRSI',
        total_deposits_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        total_borrows_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        apy_bps INTEGER NOT NULL DEFAULT 800,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Record deposit in liquidity_deposits table
    await pool.query('INSERT INTO liquidity_deposits(user_id, amount_wei, tx_hash) VALUES ($1, $2, $3)', 
      [req.user.id, amountWei, txHash || null]);
    
    // Update liquidity pool total
    await pool.query('UPDATE liquidity_pools SET total_deposits_wei = (total_deposits_wei + $1)', [amountWei]);

    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    
    // Get updated wallet info
    const updatedWallet = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    res.json({ 
      success: true, 
      pool: state.rows[0],
      walletSynced: updatedWallet.rows.length > 0,
      balanceUpdated: updatedWallet.rows.length > 0 ? updatedWallet.rows[0].balance_wei : null
    });
  } catch (e) {
    console.error('Deposit error:', e.message);
    res.status(500).json({ error: 'Failed to deposit', details: e.message });
  }
});

// Withdraw from pool (syncs user balance from blockchain after withdrawal)
app.post('/api/liquidity/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amountWei, txHash } = req.body || {};
    if (!amountWei) return res.status(400).json({ error: 'amountWei is required' });
    
    // Get user's wallet to sync balance
    const walletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    const wallet = walletResult.rows[0];
    
    // CRITICAL: Sync user's wallet balance from blockchain after withdrawal
    // The withdrawal happened on-chain, so tokens came back to the wallet - database needs to reflect this
    try {
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
      const krishiTokenAddress = process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
      
      const tokenContract = new ethers.Contract(
        krishiTokenAddress,
        ['function balanceOf(address account) view returns (uint256)'],
        provider
      );
      
      // Get actual on-chain balance (after withdrawal)
      const onChainBalanceWei = await tokenContract.balanceOf(wallet.address);
      const onChainBalanceStr = onChainBalanceWei.toString();
      
      console.log(`🔄 Syncing wallet balance after withdrawal: ${wallet.address}`);
      console.log(`   Database: ${wallet.balance_wei || '0'} wei`);
      console.log(`   On-chain: ${onChainBalanceStr} wei`);
      
      // Update wallet balance to match on-chain (blockchain is source of truth)
      await pool.query(
        `UPDATE wallet_accounts 
         SET balance_wei = $1, updated_at = NOW()
         WHERE user_id = $2 AND address = $3`,
        [onChainBalanceStr, req.user.id, wallet.address]
      );
      
      console.log(`✅ Wallet balance synced to ${onChainBalanceStr} wei after withdrawal`);
    } catch (balanceError) {
      console.warn('⚠️  Could not sync wallet balance from blockchain:', balanceError.message);
      // Continue anyway - withdrawal record is still created
    }
    
    await ensureCommitteeTables();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_deposits (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_wei DECIMAL(78,0) NOT NULL,
        tx_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Strategy buffer enforcement
    const poolRow = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    const p = poolRow.rows[0];
    const enabled = (p && p.strategy_name && (process.env.STRATEGY_ENABLED || 'true') === 'true');
    if (enabled) {
      const bufferBps = Number(process.env.STRATEGY_BUFFER_BPS || 500); // 5%
      const deposits = BigInt(p.total_deposits_wei || '0');
      const borrows = BigInt(p.total_borrows_wei || '0');
      const available = deposits > borrows ? deposits - borrows : 0n;
      const buffer = (deposits * BigInt(bufferBps)) / 10000n;
      const requested = BigInt(amountWei);
      if (available <= buffer || requested > (available - buffer)) {
        return res.status(400).json({ error: 'Withdraw limited by strategy buffer/SLA. Try a smaller amount or accrue/disable strategy.' });
      }
    }

    // Record as negative deposit
    await pool.query('INSERT INTO liquidity_deposits(user_id, amount_wei, tx_hash) VALUES ($1, $2, $3)', 
      [req.user.id, (-BigInt(amountWei)).toString(), txHash || null]);
    await pool.query('UPDATE liquidity_pools SET total_deposits_wei = GREATEST(total_deposits_wei - $1, 0)', [amountWei]);
    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    
    // Get updated wallet info
    const updatedWallet = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    res.json({ 
      success: true, 
      pool: state.rows[0],
      walletSynced: updatedWallet.rows.length > 0,
      balanceUpdated: updatedWallet.rows.length > 0 ? updatedWallet.rows[0].balance_wei : null
    });
  } catch (e) {
    console.error('Withdraw error:', e.message);
    res.status(500).json({ error: 'Failed to withdraw', details: e.message });
  }
});

// Get user's aggregate deposits (synced from blockchain)
app.get('/api/liquidity/my', authenticateToken, async (req, res) => {
  try {
    // Get user's wallet address
    const walletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    if (walletResult.rows.length === 0) {
      console.log(`⚠️ /api/liquidity/my: No wallet found for user ${req.user.id}`);
      return res.json({ totalDepositedWei: '0' });
    }
    
    const wallet = walletResult.rows[0];
    const userAddress = wallet.address;
    
    console.log(`🔍 Checking liquidity for user ${req.user.id} (${userAddress})`);
    
    // CRITICAL: Sync user's position from blockchain (LoanVault is source of truth)
    try {
      const fs = require('fs');
      const path = require('path');
      const networkName = process.env.NETWORK || 'sepolia';
      const depPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
      let deployments = {};
      if (fs.existsSync(depPath)) {
        deployments = JSON.parse(fs.readFileSync(depPath, 'utf8'));
      }
      
      const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
      
      console.log(`   🔗 Connecting to LoanVault at ${loanVaultAddress} via ${process.env.SEPOLIA_RPC_URL || 'default RPC'}`);
      
      const loanVaultABI = [
        'function lenders(address) view returns (address lenderAddress, uint256 totalDeposited, uint256 totalWithdrawn, uint256 lpShares, uint256 lastDepositTime, bool isActive)'
      ];
      
      const loanVault = new ethers.Contract(loanVaultAddress, loanVaultABI, provider);
      
      // Add timeout to contract call to prevent hanging
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Blockchain timeout')), 5000));
      const lenderInfoPromise = loanVault.lenders(userAddress);
      
      const lenderInfo = await Promise.race([lenderInfoPromise, timeoutPromise]);
      
      // User's current position is their lpShares (current stake in the pool)
      // This is more accurate than totalDeposited - totalWithdrawn because it reflects actual current position
      const currentPositionWei = lenderInfo.lpShares.toString();
      
      console.log(`📊 User position from blockchain for ${userAddress}:`);
      console.log(`   Total Deposited: ${lenderInfo.totalDeposited.toString()} wei`);
      console.log(`   Total Withdrawn: ${lenderInfo.totalWithdrawn.toString()} wei`);
      console.log(`   Current Position (LP Shares): ${currentPositionWei} wei`);
      console.log(`   Active: ${lenderInfo.isActive}`);
      
      return res.json({ totalDepositedWei: currentPositionWei });
    } catch (blockchainError) {
      console.warn('⚠️  Could not sync user position from blockchain, falling back to database:', blockchainError.message);
      
      // Fallback to database if blockchain sync fails
      await pool.query(`
        CREATE TABLE IF NOT EXISTS liquidity_deposits (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount_wei DECIMAL(78,0) NOT NULL,
          tx_hash TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      const sum = await pool.query('SELECT COALESCE(SUM(amount_wei),0)::numeric AS total FROM liquidity_deposits WHERE user_id=$1', [req.user.id]);
      const dbTotal = sum.rows[0].total;
      console.log(`   💾 DB Fallback Total: ${dbTotal} wei`);
      return res.json({ totalDepositedWei: dbTotal });
    }
  } catch (e) {
    console.error('My liquidity error:', e.message);
    res.status(500).json({ error: 'Failed to fetch my liquidity' });
  }
});

// Admin seed liquidity for demos
app.post('/api/admin/seed-liquidity', authenticateToken, async (req, res) => {
  try {
    // Testing-mode: allow any authenticated user to seed demo liquidity
    const { amountWei } = req.body || {};
    const amt = amountWei || '100000000'; // default 100 KRSI (6 decimals)
    await pool.query('INSERT INTO liquidity_deposits(user_id, amount_wei) VALUES ($1,$2)', [req.user.id, amt]);
    await pool.query('UPDATE liquidity_pools SET total_deposits_wei = total_deposits_wei + $1', [amt]);
    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    res.json({ success: true, pool: state.rows[0] });
  } catch (e) {
    console.error('Seed liquidity error:', e.message);
    res.status(500).json({ error: 'Failed to seed liquidity' });
  }
});

// KRSI Token Faucet - Claim 2 KRSI every 24 hours
app.post('/api/faucet/krsi/claim', authenticateToken, async (req, res) => {
  try {
    // Create faucet_claims table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faucet_claims (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_wei DECIMAL(78,0) NOT NULL,
        claimed_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_faucet_claims_user_time ON faucet_claims(user_id, claimed_at DESC);
    `);

    // Check last claim time (24-hour cooldown)
    const lastClaimResult = await pool.query(
      'SELECT claimed_at FROM faucet_claims WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
      [req.user.id]
    );

    if (lastClaimResult.rows.length > 0) {
      const lastClaim = lastClaimResult.rows[0].claimed_at;
      const hoursSinceLastClaim = (Date.now() - new Date(lastClaim).getTime()) / (1000 * 60 * 60);
      
      // TEMPORARY BYPASS FOR TESTING
      // if (hoursSinceLastClaim < 24) {
      //   const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
      //   return res.status(429).json({ 
      //     error: `Please wait ${hoursRemaining} hours before claiming again`,
      //     nextClaimTime: new Date(new Date(lastClaim).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      //     hoursRemaining
      //   });
      // }
    }

    // Get user's wallet
    const walletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found. Please create a wallet first.' });
    }

    const wallet = walletResult.rows[0];
    const claimAmountWei = '2000000'; // 2 KRSI with 6 decimals
    const currentBalanceWei = wallet.balance_wei || '0';
    const newBalanceWei = (BigInt(currentBalanceWei) + BigInt(claimAmountWei)).toString();

    // Update wallet balance in DB first (optimistic UI)
    await pool.query(
      'UPDATE wallet_accounts SET balance_wei = $1 WHERE id = $2',
      [newBalanceWei, wallet.id]
    );

    // Record the claim
    await pool.query(
      'INSERT INTO faucet_claims (user_id, amount_wei) VALUES ($1, $2)',
      [req.user.id, claimAmountWei]
    );

    // ---------------------------------------------------------
    // SEND TOKENS ON BLOCKCHAIN
    // ---------------------------------------------------------
    try {
      const privateKey = process.env.SPONSOR_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
      
      if (privateKey) {
        console.log(`💧 Faucet: Initiating on-chain transfer of 2 KRSI to ${wallet.address}`);
        // Default to Amoy if variable is missing, as frontend is on Amoy
        const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://rpc-amoy.polygon.technology/');
        const signer = new ethers.Wallet(privateKey, provider);
        const krishiTokenAddress = process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
        
        const tokenContract = new ethers.Contract(
            krishiTokenAddress, 
            ['function transfer(address to, uint256 amount) external returns (bool)'], 
            signer
        );
        
        // Send tx (fire and forget to not block UI, or await if critical)
        // We'll await the hash but not the confirmation to keep it snappy
        const tx = await tokenContract.transfer(wallet.address, claimAmountWei);
        console.log(`✅ Faucet On-Chain Tx Sent: ${tx.hash}`);
      } else {
         console.warn("⚠️  Skipping on-chain faucet transfer: SPONSOR_WALLET_PRIVATE_KEY not set in .env");
      }
    } catch (err) {
      console.error("❌ On-chain faucet transfer failed:", err.message);
      // We don't revert the DB change because this is a testnet demo app and we want the UI to "work" even if chain fails
    }

    console.log(`💧 KRSI Faucet: User ${req.user.id} claimed ${claimAmountWei} wei (2 KRSI)`);

    res.json({
      success: true,
      amount: '2',
      amountWei: claimAmountWei,
      newBalance: newBalanceWei,
      message: 'Successfully claimed 2 KRSI tokens!',
      nextClaimTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (e) {
    console.error('KRSI faucet error:', e.message);
    res.status(500).json({ error: 'Failed to claim tokens', details: e.message });
  }
});

// Get KRSI faucet status for a user
app.get('/api/faucet/krsi/status', authenticateToken, async (req, res) => {
  try {
    // Get last claim time
    const lastClaimResult = await pool.query(
      'SELECT claimed_at, amount_wei FROM faucet_claims WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
      [req.user.id]
    );

    let canClaim = true;
    let nextClaimTime = null;
    let hoursRemaining = 0;
    let lastClaimAmount = '0';

    if (lastClaimResult.rows.length > 0) {
      const lastClaim = lastClaimResult.rows[0].claimed_at;
      lastClaimAmount = lastClaimResult.rows[0].amount_wei;
      const hoursSinceLastClaim = (Date.now() - new Date(lastClaim).getTime()) / (1000 * 60 * 60);
      
      // TEMPORARY BYPASS FOR TESTING
      // if (hoursSinceLastClaim < 24) {
      //   canClaim = false;
      //   hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
      //   nextClaimTime = new Date(new Date(lastClaim).getTime() + 24 * 60 * 60 * 1000).toISOString();
      // }
    }

    // Get total claims stats
    const statsResult = await pool.query(
      'SELECT COUNT(*) as total_claims, COALESCE(SUM(amount_wei), 0) as total_distributed FROM faucet_claims WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      canClaim,
      nextClaimTime,
      hoursRemaining,
      claimAmount: '2',
      claimAmountWei: '2000000',
      cooldownHours: 24,
      lastClaimAmount,
      totalClaims: parseInt(statsResult.rows[0].total_claims),
      totalDistributed: statsResult.rows[0].total_distributed
    });
  } catch (e) {
    console.error('KRSI faucet status error:', e.message);
    res.status(500).json({ error: 'Failed to get faucet status' });
  }
});

// Reset test pool: zero borrows and optionally set deposits
app.post('/api/admin/pool/reset', authenticateToken, async (req, res) => {
  try {
    const { depositsWei } = req.body || {};
    // Testing mode: allow any signed-in user
    if (depositsWei) {
      await pool.query('UPDATE liquidity_pools SET total_deposits_wei = $1', [depositsWei]);
    }
    await pool.query("UPDATE protocol_loans SET repaid_wei = principal_wei, status = 'repaid'");
    await pool.query('UPDATE liquidity_pools SET total_borrows_wei = 0');
    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    res.json({ success: true, pool: state.rows[0] });
  } catch (e) {
    console.error('Pool reset error:', e.message);
    res.status(500).json({ error: 'Failed to reset pool' });
  }
});

// Set or update strategy (testing/open to any user for now)
app.post('/api/liquidity/strategy', authenticateToken, async (req, res) => {
  try {
    const { name, aprBps } = req.body || {};
    await ensureCommitteeTables();
    await pool.query(`
      UPDATE liquidity_pools SET strategy_name = $1, strategy_apr_bps = $2
      WHERE id = (SELECT id FROM liquidity_pools LIMIT 1)
    `, [name || 'demo_strategy', aprBps || 500]);
    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    res.json({ success: true, pool: state.rows[0] });
  } catch (e) {
    console.error('Set strategy error:', e.message);
    res.status(500).json({ error: 'Failed to set strategy' });
  }
});

app.post('/api/liquidity/strategy/disable', authenticateToken, async (req, res) => {
  try {
    await pool.query(`UPDATE liquidity_pools SET strategy_name = NULL, strategy_apr_bps = NULL WHERE id = (SELECT id FROM liquidity_pools LIMIT 1)`);
    const state = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    res.json({ success: true, pool: state.rows[0] });
  } catch (e) {
    console.error('Disable strategy error:', e.message);
    res.status(500).json({ error: 'Failed to disable strategy' });
  }
});

// Strategy registry (allowlist)
app.get('/api/liquidity/strategy/registry', authenticateToken, async (req, res) => {
  try {
    const registry = [
      { name: 'ConservativeFund', aprBps: 400, withdrawSlaDays: 1 },
      { name: 'BalancedFund', aprBps: 800, withdrawSlaDays: 3 },
      { name: 'GrowthFund', aprBps: 1200, withdrawSlaDays: 7 }
    ];
    res.json({ strategies: registry, enabled: (process.env.STRATEGY_ENABLED || 'true') === 'true', bufferBps: Number(process.env.STRATEGY_BUFFER_BPS || 500) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch registry' });
  }
});

// Accrue strategy yield (simple monthly accrual approximation)
app.post('/api/liquidity/accrue', authenticateToken, async (req, res) => {
  try {
    const row = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    if (row.rows.length === 0) return res.status(400).json({ error: 'Pool not initialized' });
    const p = row.rows[0];
    const aprBps = Number(p.strategy_apr_bps || 0);
    if (!aprBps) return res.json({ success: true, pool: p });
    const monthlyBps = aprBps / 12;
    const interest = (BigInt(p.total_deposits_wei || '0') * BigInt(Math.round(monthlyBps))) / 10000n;
    const updated = await pool.query('UPDATE liquidity_pools SET total_deposits_wei = (total_deposits_wei + $1) RETURNING *', [interest.toString()]);
    res.json({ success: true, accruedWei: interest.toString(), pool: updated.rows[0] });
  } catch (e) {
    console.error('Accrue error:', e.message);
    res.status(500).json({ error: 'Failed to accrue strategy yield' });
  }
});

// Create a loan from pool
app.post('/api/loans/create', authenticateToken, async (req, res) => {
  try {
    const { principalWei, durationDays, interestBps, txHash, loanId, category, reason, isAgri } = req.body || {};
    if (!principalWei) return res.status(400).json({ error: 'principalWei is required' });
    
    // Phase 8: Check if borrowing is paused (unless transaction already happened on-chain)
    if (!txHash) {
      const pauseCheck = await checkBorrowingPause();
      if (pauseCheck.paused) {
        return res.status(503).json({ error: pauseCheck.reason || 'Borrowing is temporarily paused due to market volatility' });
      }
    }
    
    // Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS protocol_loans (
        id SERIAL PRIMARY KEY,
        principal_wei DECIMAL(78,0) NOT NULL,
        interest_bps INTEGER NOT NULL DEFAULT 800,
        duration_days INTEGER NOT NULL DEFAULT 180,
        status TEXT NOT NULL DEFAULT 'active',
        repaid_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS borrower_id_text TEXT`);
    await pool.query(`ALTER TABLE protocol_loans DROP CONSTRAINT IF EXISTS protocol_loans_borrower_id_fkey`);
    await pool.query(`ALTER TABLE protocol_loans DROP COLUMN IF EXISTS borrower_id`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS tx_hash TEXT`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS loanvault_loan_id BIGINT`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS on_chain_loan_id BIGINT`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS category TEXT`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS reason TEXT`);
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS is_agri BOOLEAN DEFAULT false`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pools (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL DEFAULT 'KRSI',
        total_deposits_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        total_borrows_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        apy_bps INTEGER NOT NULL DEFAULT 800,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    let poolState = await pool.query('SELECT * FROM liquidity_pools LIMIT 1');
    let p = poolState.rows[0];
    if (!p) {
      const created = await pool.query('INSERT INTO liquidity_pools DEFAULT VALUES RETURNING *');
      p = created.rows[0];
    }

    // If txHash is provided, loan was already created on-chain - skip liquidity check and just record it
    // Otherwise, do the availability check (for backward compatibility)
    if (!txHash) {
      // Simple availability check
      const active = await pool.query(`SELECT COALESCE(SUM(principal_wei - repaid_wei),0)::numeric AS active FROM protocol_loans WHERE status='active'`);
      const depositsWei = BigInt(p.total_deposits_wei || '0');
      const borrowsWei = BigInt(active.rows[0].active || 0);
      const available = depositsWei > borrowsWei ? (depositsWei - borrowsWei) : 0n;
      if (available < BigInt(principalWei)) {
        return res.status(400).json({ error: 'Insufficient pool liquidity' });
      }
    }

    // Store on-chain loan ID (from LoanVault contract) if provided
    const onChainLoanId = loanId || null;
    const loanvaultLoanId = loanId || null; // Same value, different field names for compatibility

    const loan = await pool.query(
      `INSERT INTO protocol_loans(borrower_id_text, principal_wei, interest_bps, duration_days, tx_hash, loanvault_loan_id, on_chain_loan_id, category, reason, is_agri)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [String(req.user.id), principalWei, interestBps || 800, durationDays || 180, txHash || null, loanvaultLoanId, onChainLoanId, category || null, reason || null, isAgri || false] // Fixed APR at 8%
    );

    // Update pool borrows only if this is a new DB record (not synced from indexer)
    // If txHash exists, the indexer will handle pool updates
    if (!txHash) {
      const active = await pool.query(`SELECT COALESCE(SUM(principal_wei - repaid_wei),0)::numeric AS active FROM protocol_loans WHERE status='active'`);
      const newBorrowTotal = active.rows[0].active || '0';
      await pool.query('UPDATE liquidity_pools SET total_borrows_wei = $1', [newBorrowTotal]);
    }

    // Generate schedule
    await ensureLoanScheduleTables();
    await generateLoanSchedule(loan.rows[0].id, principalWei, durationDays || 180, interestBps || 0);

    res.json({ success: true, loan: loan.rows[0] });
  } catch (e) {
    console.error('Create loan error:', e);
    res.status(500).json({ error: 'Failed to create loan', details: String(e && e.message || e) });
  }
});

// Repay a loan (now supports on-chain repayments with txHash)
app.post('/api/loans/repay', authenticateToken, async (req, res) => {
  try {
    const { loanId, amountWei, txHash } = req.body || {};
    if (!loanId || !amountWei) return res.status(400).json({ error: 'loanId and amountWei required' });

    const loan = await pool.query('SELECT * FROM protocol_loans WHERE id = $1 AND borrower_id_text=$2', [loanId, String(req.user.id)]);
    if (loan.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });
    await ensureLoanScheduleTables();

    // If txHash is provided, repayment already happened on-chain - just update DB
    // Otherwise, apply repayment logic (for backward compatibility)
    let remaining = BigInt(amountWei);
    
    if (!txHash) {
      // Apply to schedule from oldest due forward (DB-only mode)
      const dues = await pool.query(
        `SELECT * FROM loan_payments WHERE loan_id = $1 AND status <> 'paid' ORDER BY due_date ASC, id ASC`,
        [loanId]
      );
      for (const row of dues.rows) {
        if (remaining === 0n) break;
        const due = BigInt(row.amount_wei);
        const paid = BigInt(row.paid_wei);
        const owed = due - paid;
        const pay = remaining >= owed ? owed : remaining;
        const newPaid = (paid + pay).toString();
        const newStatus = (paid + pay) >= due ? 'paid' : 'partial';
        await pool.query(`UPDATE loan_payments SET paid_wei=$1, status=$2 WHERE id=$3`, [newPaid, newStatus, row.id]);
        remaining -= pay;
      }
    } else {
      // On-chain repayment: mark all payments as paid if full repayment
      const principalWei = BigInt(loan.rows[0].principal_wei || '0');
      if (BigInt(amountWei) >= principalWei) {
        // Full repayment - mark all as paid
        await pool.query(
          `UPDATE loan_payments SET paid_wei = amount_wei, status = 'paid' WHERE loan_id = $1`,
          [loanId]
        );
      }
    }

    // Ensure tx_hash column exists
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS repayment_tx_hash TEXT`);

    // Update loan aggregates
    const currentRepaid = BigInt(loan.rows[0].repaid_wei || '0');
    const newRepaid = currentRepaid + BigInt(amountWei);
    const principalWei = BigInt(loan.rows[0].principal_wei || '0');
    const isFullyRepaid = newRepaid >= principalWei;

    // Ensure repaid_at column exists
    await pool.query(`ALTER TABLE protocol_loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMP WITH TIME ZONE`);
    
    const updated = await pool.query(
      `UPDATE protocol_loans SET 
        repaid_wei = $1,
        status = CASE WHEN $1 >= principal_wei THEN 'repaid' ELSE status END,
        repaid_at = CASE WHEN $1 >= principal_wei AND repaid_at IS NULL THEN NOW() ELSE repaid_at END,
        repayment_tx_hash = COALESCE(repayment_tx_hash, $3),
        next_due_date = CASE 
          WHEN $1 >= principal_wei THEN NULL
          ELSE (
            SELECT due_date FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' ORDER BY due_date ASC LIMIT 1
          )
        END,
        delinquent = CASE 
          WHEN $1 >= principal_wei THEN false
          ELSE EXISTS (
            SELECT 1 FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' AND due_date < CURRENT_DATE
          )
        END
       WHERE id = $2 RETURNING *`,
      [newRepaid.toString(), loanId, txHash || null]
    );

    // Update pool borrows only if not synced from indexer (txHash means indexer will handle it)
    if (!txHash) {
      await pool.query('UPDATE liquidity_pools SET total_borrows_wei = GREATEST(total_borrows_wei - $1, 0)', [amountWei]);
    }

    res.json({ success: true, loan: updated.rows[0] });
  } catch (e) {
    console.error('Repay loan error:', e.message);
    res.status(500).json({ error: 'Failed to repay loan' });
  }
});

// Sync loan ID from transaction hash or provided loan ID
app.post('/api/loans/:loanId/sync-loan-id', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { loanvaultLoanId, txHash } = req.body || {};
    
    if (!loanvaultLoanId && !txHash) {
      return res.status(400).json({ error: 'loanvaultLoanId or txHash required' });
    }

    const loan = await pool.query('SELECT * FROM protocol_loans WHERE id = $1 AND borrower_id_text = $2', [loanId, String(req.user.id)]);
    if (loan.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    let onChainLoanId = loanvaultLoanId;

    // If txHash provided but no loanId, try to extract from transaction
    if (txHash && !onChainLoanId) {
      try {
        const fs = require('fs');
        const path = require('path');
        const networkName = process.env.NETWORK || 'sepolia';
        const depPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
        let deployments = {};
        if (fs.existsSync(depPath)) {
          deployments = JSON.parse(fs.readFileSync(depPath, 'utf8'));
        }
        
        const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
        const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
        
        const loanVaultABI = ['event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate)'];
        const iface = new ethers.utils.Interface(loanVaultABI);
        const topic0 = iface.getEventTopic('LoanCreated');
        
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          for (const log of receipt.logs) {
            if (log.topics && log.topics[0] === topic0 && log.topics.length >= 2) {
              // topics[1] is the indexed loanId
              onChainLoanId = BigInt(log.topics[1]).toString();
              console.log(`✅ Extracted loan ID ${onChainLoanId} from transaction ${txHash}`);
              break;
            }
          }
        }
      } catch (extractError) {
        console.warn('Could not extract loan ID from transaction:', extractError);
      }
    }

    if (!onChainLoanId) {
      return res.status(400).json({ error: 'Could not determine on-chain loan ID' });
    }

    // Update loan with on-chain ID
    await pool.query(
      `UPDATE protocol_loans 
       SET loanvault_loan_id = $1, on_chain_loan_id = $1, tx_hash = COALESCE(tx_hash, $2)
       WHERE id = $3 RETURNING *`,
      [onChainLoanId, txHash || null, loanId]
    );

    const updated = await pool.query('SELECT * FROM protocol_loans WHERE id = $1', [loanId]);
    res.json({ success: true, loan: updated.rows[0] });
  } catch (e) {
    console.error('Sync loan ID error:', e.message);
    res.status(500).json({ error: 'Failed to sync loan ID' });
  }
});

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Trust the token for identity to avoid DB UUID casting during auth
    req.user = {
      id: String(decoded.userId),
      email: decoded.email || null,
      role: decoded.role || 'user'
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Admin signup status endpoint
app.get('/api/admin/signup-open', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role='admin'");
    const existingAdmins = rows[0]?.c ?? 0;
    const openFlag = String(process.env.ADMIN_SIGNUP_OPEN || '').toLowerCase() === 'true';
    const allowed = existingAdmins === 0 || openFlag;
    res.json({ allowed, existingAdmins });
  } catch (e) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Auth endpoints with specific rate limiting
app.post('/api/auth/signup', apiLimits.auth, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role = 'user' } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // If requesting admin role, enforce one-time policy
    if (role === 'admin') {
      const { rows: adminCountRows } = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role='admin'");
      const existingAdmins = adminCountRows[0]?.c ?? 0;
      const openFlag = String(process.env.ADMIN_SIGNUP_OPEN || '').toLowerCase() === 'true';
      const tokenHeader = req.headers['x-admin-signup-token'] || req.headers['x-admin-token'];
      const requiredToken = process.env.ADMIN_SIGNUP_TOKEN || '';
      const tokenOk = requiredToken ? tokenHeader === requiredToken : false;
      const allowed = existingAdmins === 0 || openFlag || tokenOk;
      if (!allowed) {
        return res.status(403).json({ error: 'Admin signup is closed' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, profile_completed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, profile_completed',
      [email, hashedPassword, first_name, last_name, role, true]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_completed: user.profile_completed
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signin', apiLimits.auth, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_completed: user.profile_completed
      },
      token
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signout', (req, res) => {
  res.json({ success: true, message: 'Signed out successfully' });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id::text = $1', [String(req.user.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
  res.json({
    success: true,
    user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_completed: user.profile_completed,
        phone: user.phone,
        address: user.address,
        kyc_status: user.kyc_status,
        credit_score: user.credit_score,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Profile endpoints
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id::text = $1', [String(req.user.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_completed: user.profile_completed,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, profile_completed } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, phone = $3, profile_completed = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [first_name, last_name, phone, profile_completed, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        profile_completed: user.profile_completed
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Wallet endpoints
app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user.id, 'agrifinance']
    );

    if (result.rows.length === 0) {
      return res.json({ wallet: null });
    }

    const wallet = result.rows[0];
    
    // For agrifinance wallets, return the database balance directly
    // No need to sync from blockchain as these are in-app wallets
    console.log(`📊 Returning agrifinance wallet for user ${req.user.id}:`, {
      address: wallet.address,
      balance_wei: wallet.balance_wei,
      wallet_type: wallet.wallet_type
    });
    
    res.json({ wallet });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Transaction History Endpoint - Aggregates all transaction types
app.get('/api/transactions/history', authenticateToken, async (req, res) => {
  try {
    // Get user's wallet address
    let walletAddress = null;
    try {
      const walletResult = await pool.query(
        'SELECT address FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 ORDER BY created_at DESC LIMIT 1',
        [req.user.id, 'agrifinance']
      );
      if (walletResult.rows.length > 0) {
        walletAddress = walletResult.rows[0].address;
      }
    } catch (walletErr) {
      console.warn('Could not fetch wallet address:', walletErr);
    }

    // Use the transaction service to get all transactions
    const transactions = await getTransactionHistory(pool, req.user.id, walletAddress);

    res.json({ transactions });
  } catch (e) {
    console.error('Transaction history error:', e.message);
    res.status(500).json({ error: 'Failed to fetch transaction history', details: e.message });
  }
});

app.get('/api/wallet/blockchain-balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    const wallet = result.rows[0];
    if (!wallet.address) {
      return res.status(400).json({ error: 'Wallet address not found' });
    }
    const balanceWei = await blockchainService.getBalance(wallet.address);
    res.json({ address: wallet.address, balance_wei: balanceWei });
  } catch (error) {
    console.error('Blockchain balance error:', error.message);
    res.status(500).json({ error: 'Failed to fetch blockchain balance' });
  }
});

// Transfer using blockchain-first approach
app.post('/api/wallet/transfer', authenticateToken, async (req, res) => {
  try {
    const { toAddress, amountWei } = req.body;
    if (!toAddress || !amountWei) {
      return res.status(400).json({ error: 'toAddress and amountWei are required' });
    }
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    const wallet = result.rows[0];
    if (!wallet.address) {
      return res.status(400).json({ error: 'Wallet address not found' });
    }
    const tx = await blockchainService.transferTokens(wallet.address, toAddress, amountWei);
    res.json({ success: true, tx });
  } catch (error) {
    console.error('Blockchain transfer error:', error.message);
    res.status(500).json({ error: 'Blockchain transfer failed' });
  }
});

// Sync wallet balance from blockchain
app.post('/api/wallet/sync-balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's wallet
    const walletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];
    
    if (!wallet.address) {
      return res.status(400).json({ error: 'Wallet address not found' });
    }

    // Connect to Ethereum Sepolia testnet (where the contract is deployed)
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
    
    // KRSI token contract address - using Sepolia deployment
    const krishiTokenAddress = process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
    
    console.log(`🔄 Syncing balance FROM blockchain TO database for ${wallet.address}`);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(
      krishiTokenAddress,
      ['function balanceOf(address account) view returns (uint256)'],
      provider
    );
    
    // Get actual on-chain balance
    let onChainBalanceWei = '0';
    try {
      const balance = await tokenContract.balanceOf(wallet.address);
      onChainBalanceWei = balance.toString();
      console.log(`📊 On-chain balance for ${wallet.address}: ${onChainBalanceWei} wei`);
    } catch (error) {
      console.error('❌ Failed to get on-chain balance:', error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch on-chain balance',
        details: error.message
      });
    }
    
    const onChainBalanceFormatted = ethers.utils.formatUnits(onChainBalanceWei, 6);
    const dbBalanceWei = wallet.balance_wei || '0';
    const dbBalanceFormatted = ethers.utils.formatUnits(dbBalanceWei, 6);
    
    console.log(`📊 Database: ${dbBalanceFormatted} KRSI, On-chain: ${onChainBalanceFormatted} KRSI`);
    
    // Update database with blockchain balance (blockchain is source of truth)
    await pool.query(
      `UPDATE wallet_accounts 
       SET balance_wei = $1, updated_at = NOW()
       WHERE user_id = $2 AND address = $3`,
      [onChainBalanceWei, userId, wallet.address]
    );
    
    console.log(`✅ Database updated to match on-chain balance: ${onChainBalanceFormatted} KRSI`);
    
    res.json({ 
      success: true, 
      wallet: {
        ...wallet,
        balance_wei: onChainBalanceWei
      },
      balance_formatted: onChainBalanceFormatted,
      previous_balance: dbBalanceFormatted,
      message: `Database updated from ${dbBalanceFormatted} to ${onChainBalanceFormatted} KRSI (blockchain balance)`,
      source: 'blockchain'
    });
  } catch (error) {
    console.error('❌ Balance sync error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Try to get wallet info for error response
    let errorDetails = {};
    try {
      const walletResult = await pool.query(
        'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (walletResult.rows.length > 0) {
        errorDetails.wallet = walletResult.rows[0];
      }
    } catch (e) {
      console.error('Failed to get wallet for error response:', e);
    }
    
    res.status(500).json({ 
      error: 'Failed to sync balance from blockchain',
      details: error.message,
      message: 'Please check backend logs for more details. The error may be due to network issues or contract access problems.'
    });
  }
});

// Update recipient balance (for transfers)
app.post('/api/wallet/update-recipient-balance', authenticateToken, async (req, res) => {
  try {
    const { recipientAddress, amountWei } = req.body;
    
    if (!recipientAddress || !amountWei) {
      return res.status(400).json({ error: 'Recipient address and amount are required' });
    }

    // Find recipient's wallet
    const recipientWallet = await pool.query(
      'SELECT * FROM wallet_accounts WHERE address = $1 AND wallet_type = $2',
      [recipientAddress, 'agrifinance']
    );

    if (recipientWallet.rows.length > 0) {
      // Update recipient's balance
      const currentBalance = BigInt(recipientWallet.rows[0].balance_wei || '0');
      const newBalance = currentBalance + BigInt(amountWei);
      
      console.log(`💰 Updating recipient ${recipientAddress}: ${currentBalance} → ${newBalance}`);
      
      const result = await pool.query(
        'UPDATE wallet_accounts SET balance_wei = $1, updated_at = NOW() WHERE address = $2 AND wallet_type = $3 RETURNING *',
        [newBalance.toString(), recipientAddress, 'agrifinance']
      );
      
      res.json({ 
        success: true, 
        wallet: result.rows[0],
        oldBalance: currentBalance.toString(),
        newBalance: newBalance.toString()
      });
    } else {
      res.status(404).json({ error: 'Recipient wallet not found' });
    }
  } catch (error) {
    console.error('Error updating recipient balance:', error);
    res.status(500).json({ error: 'Failed to update recipient balance' });
  }
});

app.post('/api/wallet/sync', authenticateToken, async (req, res) => {
  try {
    let { address, balance_wei, wallet_type, metadata } = req.body;
    const userId = req.user.id;
    
    // If address missing, deterministically derive a persistent address for the user (server-side safety)
    if (!address) {
      try {
        const seed = ethers.utils.id(String(userId) + 'agrifinance-wallet-seed');
        const privateKey = ethers.utils.keccak256(seed);
        const wallet = new ethers.Wallet(privateKey);
        address = wallet.address;
      } catch (e) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
    }

    // Check if wallet already exists
    const existingWallet = await pool.query(
      'SELECT id, balance_wei FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2',
      [userId, wallet_type || 'agrifinance']
    );

    if (existingWallet.rows.length > 0) {
      // Update existing wallet - use the provided balance (Database-First Approach)
      const balanceToUse = balance_wei || existingWallet.rows[0].balance_wei;
      
      console.log(`🔄 Updating wallet balance for user ${userId}: ${existingWallet.rows[0].balance_wei} → ${balanceToUse}`);
      
      const result = await pool.query(
        'UPDATE wallet_accounts SET address = $1, balance_wei = $2, metadata = $3, updated_at = NOW() WHERE user_id = $4 AND wallet_type = $5 RETURNING *',
        [address, balanceToUse, metadata, userId, wallet_type || 'agrifinance']
      );
      res.json({ wallet: result.rows[0] });
    } else {
      // Create new wallet - use the same network as contracts (sepolia)
      const networkChainId = process.env.NETWORK || 'sepolia';
      const result = await pool.query(
        'INSERT INTO wallet_accounts (user_id, address, wallet_type, chain_id, token_symbol, balance_wei, custodial, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [userId, address, wallet_type || 'agrifinance', networkChainId, 'KRSI', balance_wei || '0', true, metadata]
      );
      res.json({ wallet: result.rows[0] });
    }
  } catch (error) {
    console.error('Wallet sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/api/wallet/link-mobile', authenticateToken, async (req, res) => {
  try {
    const { mobile_number } = req.body;
    const userId = req.user.id;

    if (!mobile_number) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Update wallet metadata with mobile number
    const result = await pool.query(
      'UPDATE wallet_accounts SET metadata = COALESCE(metadata, \'{}\') || $1 WHERE user_id = $2 RETURNING *',
      [JSON.stringify({ mobile_number, mobile_linked_at: new Date().toISOString() }), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({ success: true, wallet: result.rows[0] });
  } catch (error) {
    console.error('Mobile link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/wallet/find-by-mobile/:mobile', async (req, res) => {
  try {
    const { mobile } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM wallet_accounts WHERE metadata->>\'mobile_number\' = $1',
      [mobile]
    );

    if (result.rows.length === 0) {
      return res.json({ wallet: null });
    }

    res.json({ wallet: result.rows[0] });
  } catch (error) {
    console.error('Mobile wallet find error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NFT endpoints
app.get('/api/nfts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM nfts ORDER BY created_at DESC'
    );
    res.json({ nfts: result.rows });
  } catch (error) {
    console.error('NFTs fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/nfts', authenticateToken, async (req, res) => {
  try {
    const { name, description, image_url, price_krsi } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'NFT name is required' });
    }

    const priceWei = price_krsi ? ethers.utils.parseUnits(price_krsi, 6).toString() : '0';

    const result = await pool.query(
      'INSERT INTO nfts (owner_id, name, description, image_url, price_wei, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, name, description, image_url, priceWei, 'draft']
    );

    res.json({ nft: result.rows[0] });
  } catch (error) {
    console.error('NFT creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's purchased NFTs
app.get('/api/nft/my-purchases', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`📦 Fetching purchased NFTs for user ${userId}`);

    const result = await pool.query(
      `SELECT * FROM nfts WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${result.rows.length} purchased NFTs for user ${userId}`);
    res.json({ nfts: result.rows });
  } catch (error) {
    console.error('❌ Error fetching user purchases:', error);
    res.status(500).json({ error: 'Failed to fetch user purchases' });
  }
});

// Add test NFTs for testing purposes
app.post('/api/nft/add-test-nfts', authenticateToken, async (req, res) => {
  try {
    console.log('🎨 Adding 2 new test NFTs...');
    
    // Convert KRSI to wei (6 decimals)
    const price2KRSI = (2 * 1000000).toString(); // 2 KRSI = 2000000 wei
    const price3KRSI = (3 * 1000000).toString(); // 3 KRSI = 3000000 wei
    
    const testNFTs = [
      {
        name: 'Karnataka Coffee Plantation',
        description: 'Premium coffee plantation in Karnataka with organic certification and modern processing facilities.',
        price_wei: price2KRSI,
        image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop',
        status: 'minted',
        owner_id: null
      },
      {
        name: 'Tamil Nadu Spice Garden',
        description: 'Traditional spice garden in Tamil Nadu growing cardamom, pepper, and turmeric with sustainable farming practices.',
        price_wei: price3KRSI,
        image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop',
        status: 'minted',
        owner_id: null
      }
    ];
    
    const createdNFTs = [];
    
    for (const nft of testNFTs) {
      const result = await pool.query(`
        INSERT INTO nfts (
          name, 
          description, 
          price_wei, 
          image_url, 
          status, 
          owner_id,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, name, price_wei
      `, [
        nft.name,
        nft.description,
        nft.price_wei,
        nft.image_url,
        nft.status,
        nft.owner_id
      ]);
      
      const createdNFT = result.rows[0];
      const priceInKRSI = (BigInt(createdNFT.price_wei) / BigInt(1000000)).toString();
      
      createdNFTs.push({
        id: createdNFT.id,
        name: createdNFT.name,
        price_wei: createdNFT.price_wei,
        price_krsi: priceInKRSI
      });
      
      console.log(`✅ Created NFT: ${createdNFT.name} - ${priceInKRSI} KRSI`);
    }
    
    console.log('🎉 Successfully added 2 test NFTs!');
    
    res.json({ 
      success: true, 
      message: 'Successfully added 2 test NFTs',
      createdNFTs
    });
  } catch (error) {
    console.error('❌ Error adding test NFTs:', error);
    res.status(500).json({ error: 'Failed to add test NFTs' });
  }
});

// Fix NFT prices - Correct price_wei values in database
app.post('/api/nft/fix-prices', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Fixing NFT prices...');
    
    // Get all NFTs with their current prices
    const nftsResult = await pool.query(`
      SELECT id, name, price_wei, created_at
      FROM nfts 
      WHERE price_wei IS NOT NULL 
      AND price_wei != '0'
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${nftsResult.rows.length} NFTs with prices`);
    
    let fixedCount = 0;
    const fixedNFTs = [];
    
    for (const nft of nftsResult.rows) {
      const currentPrice = nft.price_wei.toString();
      console.log(`   ${nft.name}: Current price = ${currentPrice}`);
      
      // Check if price is too large (likely has extra zeros)
      if (currentPrice.length > 10) {
        // Convert to proper wei format (6 decimals)
        // If price is like "1200000" and should be "1.2 KRSI", convert to "1200000" wei
        // If price is like "1200000000000" (wrong), convert to "1200000" wei
        
        let correctedPrice;
        if (currentPrice.length === 13) {
          // Likely "1200000000000" -> should be "1200000" (1.2 KRSI)
          correctedPrice = currentPrice.slice(0, -6);
        } else if (currentPrice.length === 12) {
          // Likely "120000000000" -> should be "1200000" (1.2 KRSI)  
          correctedPrice = currentPrice.slice(0, -6);
        } else {
          // Keep as is if it's reasonable
          correctedPrice = currentPrice;
        }
        
        if (correctedPrice !== currentPrice) {
          await pool.query(
            'UPDATE nfts SET price_wei = $1, updated_at = NOW() WHERE id = $2',
            [correctedPrice, nft.id]
          );
          
          fixedNFTs.push({
            id: nft.id,
            name: nft.name,
            oldPrice: currentPrice,
            newPrice: correctedPrice
          });
          
          fixedCount++;
          console.log(`     ✅ Fixed: ${currentPrice} -> ${correctedPrice}`);
        }
      }
    }
    
    console.log(`✅ Fixed prices for ${fixedCount} NFTs`);
    
    res.json({ 
      success: true, 
      message: `Fixed prices for ${fixedCount} NFTs`,
      fixedCount,
      fixedNFTs
    });
  } catch (error) {
    console.error('❌ Error fixing NFT prices:', error);
    res.status(500).json({ error: 'Failed to fix NFT prices' });
  }
});

// Fix NFT ownership - Reset ownership for NFTs that should be available
app.post('/api/nft/reset-ownership', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Resetting NFT ownership...');
    
    // Reset ownership for NFTs that have prices but are marked as owned
    const updateResult = await pool.query(`
      UPDATE nfts 
      SET owner_id = NULL, updated_at = NOW()
      WHERE owner_id IS NOT NULL
      AND price_wei IS NOT NULL 
      AND price_wei != '0'
      RETURNING id, name, owner_id
    `);
    
    console.log(`✅ Reset ownership for ${updateResult.rows.length} NFTs`);
    
    res.json({ 
      success: true, 
      message: `Reset ownership for ${updateResult.rows.length} NFTs`,
      updatedNFTs: updateResult.rows
    });
  } catch (error) {
    console.error('❌ Error resetting NFT ownership:', error);
    res.status(500).json({ error: 'Failed to reset NFT ownership' });
  }
});

app.post('/api/nft/purchase', authenticateToken, async (req, res) => {
  try {
    const { nftId, buyerId, priceWei } = req.body;
    const userId = req.user.id;

    if (!nftId || !priceWei) {
      return res.status(400).json({ error: 'NFT ID and price are required' });
    }

    // Get NFT details
    const nftResult = await pool.query('SELECT * FROM nfts WHERE id = $1', [nftId]);
    if (nftResult.rows.length === 0) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    const nft = nftResult.rows[0];
    
    // Allow purchase if NFT has a price and is not already owned
    if (!nft.price_wei || nft.price_wei === '0') {
      return res.status(400).json({ error: 'NFT is not available for purchase - no price set' });
    }
    
    if (nft.owner_id) {
      return res.status(400).json({ error: 'NFT is not available for purchase - already owned' });
    }

    // Get buyer wallet
    const buyerWalletResult = await pool.query(
      'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (buyerWalletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer wallet not found' });
    }

    const buyerWallet = buyerWalletResult.rows[0];

    // Check balance
    if (BigInt(buyerWallet.balance_wei || '0') < BigInt(priceWei)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Calculate fee split
    const feeBps = parseInt(process.env.FEE_BPS || '200', 10);
    const feeWei = (BigInt(priceWei) * BigInt(feeBps)) / BigInt(10000);
    const netWei = BigInt(priceWei) - feeWei;

    // Resolve recipients
    const treasuryAddress = process.env.MARKETPLACE_TREASURY_ADDRESS || buyerWallet.address;
    let sellerAddress = null;
    if (nft.owner_id) {
      const sellerWalletRes = await pool.query('SELECT address FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [nft.owner_id]);
      if (sellerWalletRes.rows.length > 0) {
        sellerAddress = sellerWalletRes.rows[0].address;
      }
    }

    // Attempt on-chain transfer if enabled: send fee to treasury and net to seller (if any)
    const onchainEnabled = (process.env.ONCHAIN_MARKETPLACE || 'true') === 'true';
    let onchainTx = { feeTx: null, sellerTx: null };
    if (onchainEnabled) {
      try {
        if (feeWei > 0n) {
          onchainTx.feeTx = await blockchainService.transferTokens(
            buyerWallet.address,
            treasuryAddress,
            feeWei.toString()
          );
        }
        if (sellerAddress && netWei > 0n) {
          onchainTx.sellerTx = await blockchainService.transferTokens(
            buyerWallet.address,
            sellerAddress,
            netWei.toString()
          );
        }
      } catch (err) {
        console.warn('⚠️ On-chain transfer failed or read-only:', err.message);
      }
    }

    // Always update DB balances to keep UX responsive; mark status by on-chain result
    const newBuyerBalance = (BigInt(buyerWallet.balance_wei || '0') - BigInt(priceWei)).toString();
    await pool.query('UPDATE wallet_accounts SET balance_wei = $1 WHERE id = $2', [newBuyerBalance, buyerWallet.id]);

    // Get seller wallet and update balance (only if there's a seller)
    if (nft.owner_id) {
      const sellerWalletResult = await pool.query(
        'SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [nft.owner_id]
      );

      if (sellerWalletResult.rows.length > 0) {
        const sellerWallet = sellerWalletResult.rows[0];
        // Auto-repay a portion of seller proceeds toward any active loan
        const repayBps = parseInt(process.env.MARKETPLACE_REPAY_BPS || '1000', 10); // 10%
        const autoRepayWei = (netWei * BigInt(repayBps)) / 10000n;
        let creditedWei = netWei;
        if (autoRepayWei > 0n) {
          // Find active loan for seller
          const active = await pool.query(
            `SELECT id FROM protocol_loans WHERE borrower_id=$1 AND status='active' ORDER BY created_at ASC LIMIT 1`,
            [nft.owner_id]
          );
          if (active.rows.length > 0) {
            const loanId = active.rows[0].id;
            // Apply repayment using same logic as /loans/repay
            let remaining = autoRepayWei;
            await ensureLoanScheduleTables();
            const dues = await pool.query(
              `SELECT * FROM loan_payments WHERE loan_id = $1 AND status <> 'paid' ORDER BY due_date ASC, id ASC`,
              [loanId]
            );
            for (const row of dues.rows) {
              if (remaining === 0n) break;
              const due = BigInt(row.amount_wei);
              const paid = BigInt(row.paid_wei);
              const owed = due - paid;
              const pay = remaining >= owed ? owed : remaining;
              const newPaid = (paid + pay).toString();
              const newStatus = (paid + pay) >= due ? 'paid' : 'partial';
              await pool.query(`UPDATE loan_payments SET paid_wei=$1, status=$2 WHERE id=$3`, [newPaid, newStatus, row.id]);
              remaining -= pay;
            }
            await pool.query(
              `UPDATE protocol_loans SET repaid_wei = repaid_wei + $1,
                status = CASE WHEN (repaid_wei + $1) >= principal_wei THEN 'repaid' ELSE status END,
                next_due_date = (
                  SELECT due_date FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' ORDER BY due_date ASC LIMIT 1
                ),
                delinquent = EXISTS (
                  SELECT 1 FROM loan_payments WHERE loan_id = $2 AND status <> 'paid' AND due_date < CURRENT_DATE
                )
               WHERE id = $2`,
              [autoRepayWei.toString(), loanId]
            );
            await pool.query('UPDATE liquidity_pools SET total_borrows_wei = GREATEST(total_borrows_wei - $1, 0)', [autoRepayWei.toString()]);
            // Record auto-repay transaction for seller
            await pool.query(
              `INSERT INTO transactions (user_id, direction, amount_wei, transaction_type, metadata, status)
               VALUES ($1, 'out', $2, 'auto_repay_marketplace', $3, 'completed')`,
              [nft.owner_id, autoRepayWei.toString(), JSON.stringify({ loanId, nftId })]
            );
            creditedWei = netWei - autoRepayWei;
          }
        }
        const newSellerBalance = (BigInt(sellerWallet.balance_wei || '0') + (creditedWei > 0n ? creditedWei : 0n)).toString();
        await pool.query(
          'UPDATE wallet_accounts SET balance_wei = $1 WHERE id = $2',
          [newSellerBalance, sellerWallet.id]
        );
        console.log(`💰 Updated seller balance: ${nft.owner_id} +${creditedWei.toString()} wei (after fee and auto-repay)`);
      }
    } else {
      console.log('ℹ️ No seller to pay - NFT was not previously owned');
    }

    // Update NFT ownership
    await pool.query(
      'UPDATE nfts SET owner_id = $1, status = $2 WHERE id = $3',
      [userId, 'sold', nftId]
    );

    // Record transaction with on-chain status
    await pool.query(
      `INSERT INTO transactions (user_id, direction, amount_wei, to_address, from_address, transaction_type, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        'out',
        priceWei,
        nft.owner_id,
        buyerWallet.address,
        'nft_purchase',
        JSON.stringify({ nftId, nftName: nft.name, feeWei: feeWei.toString(), netWei: netWei.toString(), onchainTx }),
        (onchainTx && (onchainTx.feeTx || onchainTx.sellerTx)) ? 'confirmed' : (onchainEnabled ? 'pending_onchain' : 'completed')
      ]
    );

    res.json({ success: true, message: 'NFT purchased successfully', onchain: Boolean(onchainTx), tx: onchainTx });
  } catch (error) {
    console.error('NFT purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin approval endpoints
app.get('/api/admin/approvals/pending', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!(await isAdminRequest(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT 
        aa.*,
        n.name as nft_name,
        n.description as nft_description,
        n.image_url as nft_image_url,
        n.token_id as nft_token_id,
        n.owner_id as nft_owner,
        n.price_wei as nft_price_wei,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM admin_approvals aa
      LEFT JOIN nfts n ON (aa.request_data->>'nft_id')::uuid = n.id
      LEFT JOIN users u ON aa.user_id = u.id
      WHERE aa.status = 'pending' 
      ORDER BY aa.created_at DESC`
    );
    res.json({ approvals: result.rows });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/approvals/my-approvals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM admin_approvals WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ approvals: result.rows });
  } catch (error) {
    console.error('Error fetching user approvals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/approvals/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user.id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update approval status
    const result = await pool.query(
      `UPDATE admin_approvals 
       SET status = 'approved', 
           admin_notes = $1, 
           approved_by = $2, 
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [admin_notes || 'Approved by admin', adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    const approval = result.rows[0];
    const nftId = approval.request_data?.nft_id;
    if (approval.approval_type === 'nft_mint' && nftId) {
      await pool.query(
        `UPDATE nfts SET status = 'minted' WHERE id = $1`,
        [nftId]
      );
    }

    res.json({ success: true, approval: approval });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/approvals/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user.id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update approval status
    const result = await pool.query(
      `UPDATE admin_approvals 
       SET status = 'rejected', 
           admin_notes = $1, 
           approved_by = $2, 
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [admin_notes || 'Rejected by admin', adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    res.json({ success: true, approval: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create approval request
app.post('/api/admin/approvals', authenticateToken, async (req, res) => {
  try {
    const { approval_type, request_data } = req.body;
    const userId = req.user.id;

    if (!approval_type) {
      return res.status(400).json({ error: 'Approval type is required' });
    }

    const result = await pool.query(
      'INSERT INTO admin_approvals (user_id, approval_type, request_data) VALUES ($1, $2, $3) RETURNING *',
      [userId, approval_type, request_data]
    );

    res.json({ approval: result.rows[0] });
  } catch (error) {
    console.error('Error creating approval request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database schema
const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing enhanced database schema...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        profile_completed BOOLEAN DEFAULT FALSE,
        phone VARCHAR(20),
        address TEXT,
        kyc_status VARCHAR(20) DEFAULT 'pending',
        credit_score INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create wallet_accounts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        address VARCHAR(255) NOT NULL,
        wallet_type VARCHAR(50) DEFAULT 'agrifinance',
        chain_id VARCHAR(20) DEFAULT 'sepolia',
        token_symbol VARCHAR(10) DEFAULT 'KRSI',
        balance_wei VARCHAR(255) DEFAULT '0',
        custodial BOOLEAN DEFAULT TRUE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create nfts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nfts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID REFERENCES users(id),
        token_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        price_wei VARCHAR(255) DEFAULT '0',
        status VARCHAR(50) DEFAULT 'draft',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create admin_approvals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        approval_type VARCHAR(100) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        request_data JSONB,
        admin_notes TEXT,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        direction VARCHAR(10) NOT NULL,
        amount_wei VARCHAR(255) NOT NULL,
        to_address VARCHAR(255),
        from_address VARCHAR(255),
        transaction_type VARCHAR(50),
        blockchain_tx_hash VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create loans table for analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        borrower_id UUID REFERENCES users(id),
        lender_id UUID REFERENCES users(id),
        amount_wei VARCHAR(255) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        duration_days INTEGER NOT NULL,
        purpose TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        collateral_nft_id UUID REFERENCES nfts(id),
        credit_score INTEGER,
        risk_assessment JSONB,
        approved_at TIMESTAMP WITH TIME ZONE,
        disbursed_at TIMESTAMP WITH TIME ZONE,
        repaid_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create loan_payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loan_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID REFERENCES loans(id),
        amount_wei VARCHAR(255) NOT NULL,
        payment_type VARCHAR(20) DEFAULT 'installment',
        due_date DATE,
        paid_at TIMESTAMP WITH TIME ZONE,
        transaction_id UUID REFERENCES transactions(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create supply_chain_batches table (enhanced with marketplace functionality)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supply_chain_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES users(id),
        product_name VARCHAR(255) NOT NULL,
        product_type VARCHAR(100) NOT NULL,
        product_description TEXT,
        grade VARCHAR(50) NOT NULL,
        quantity DECIMAL(15,2) NOT NULL,
        unit VARCHAR(20) NOT NULL, -- 'kg', 'tons', 'pieces', 'acres'
        price_per_unit DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KRSI',
        region VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        certifications TEXT[],
        organic_certified BOOLEAN DEFAULT false,
        images TEXT[],
        qr_hash VARCHAR(255) UNIQUE,
        traceability_url TEXT,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'active', 'sold', 'cancelled', 'expired'
        marketplace_status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'sold', 'cancelled'
        verified_at TIMESTAMP WITH TIME ZONE,
        verified_by UUID REFERENCES users(id),
        sold_at TIMESTAMP WITH TIME ZONE,
        buyer_id UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create credit_scores table for tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        score INTEGER NOT NULL,
        factors JSONB,
        risk_level VARCHAR(20),
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        source VARCHAR(50) DEFAULT 'ai',
        metadata JSONB
      );
    `);

    // Create platform_analytics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(15,2) NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        date_recorded DATE DEFAULT CURRENT_DATE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create user_activity_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        activity_type VARCHAR(50) NOT NULL,
        activity_data JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create farmer_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        land_area_acres DECIMAL(10,2),
        farming_experience_years INTEGER,
        primary_crops TEXT[],
        farming_method VARCHAR(50),
        irrigation_type VARCHAR(50),
        soil_type VARCHAR(50),
        region VARCHAR(100),
        village VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        phone_number VARCHAR(20),
        emergency_contact VARCHAR(20),
        certifications TEXT[],
        organic_certified BOOLEAN DEFAULT false,
        profile_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create lender_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lender_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        institution_name VARCHAR(255),
        institution_type VARCHAR(50), -- 'bank', 'credit_union', 'individual', 'microfinance'
        license_number VARCHAR(100),
        max_loan_amount DECIMAL(15,2),
        min_loan_amount DECIMAL(15,2),
        preferred_interest_rate_min DECIMAL(5,2),
        preferred_interest_rate_max DECIMAL(5,2),
        preferred_loan_term_min INTEGER, -- days
        preferred_loan_term_max INTEGER, -- days
        risk_tolerance VARCHAR(20), -- 'low', 'medium', 'high'
        preferred_regions TEXT[],
        preferred_crops TEXT[],
        minimum_credit_score INTEGER,
        collateral_required BOOLEAN DEFAULT true,
        kyc_verified BOOLEAN DEFAULT false,
        profile_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create buyer_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyer_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        buyer_type VARCHAR(20) DEFAULT 'individual', -- 'individual' or 'enterprise'
        business_name VARCHAR(255),
        business_type VARCHAR(50), -- 'retailer', 'wholesaler', 'restaurant', 'processor', 'exporter'
        business_license VARCHAR(100),
        preferred_crops TEXT[],
        preferred_regions TEXT[],
        quality_requirements TEXT[],
        organic_preference BOOLEAN DEFAULT false,
        max_order_quantity DECIMAL(15,2),
        min_order_quantity DECIMAL(15,2),
        payment_terms VARCHAR(50), -- 'immediate', 'net_30', 'net_60'
        delivery_preferences TEXT[],
        certification_requirements TEXT[],
        profile_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create processor_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processor_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        company_name VARCHAR(255),
        processing_capacity DECIMAL(15,2), -- tons per day
        processing_types TEXT[], -- 'drying', 'milling', 'packaging', 'canning', 'freezing'
        certifications TEXT[],
        equipment_list TEXT[],
        quality_standards TEXT[],
        region VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        contact_person VARCHAR(255),
        phone_number VARCHAR(20),
        email VARCHAR(255),
        profile_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create governance_proposals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS governance_proposals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposer_id UUID REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        proposal_type VARCHAR(50), -- 'platform_policy', 'crop_pricing', 'loan_terms', 'feature_request', 'fund_allocation', 'emergency_action'
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'executed', 'rejected', 'expired'
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        for_votes INTEGER DEFAULT 0,
        against_votes INTEGER DEFAULT 0,
        abstain_votes INTEGER DEFAULT 0,
        total_votes INTEGER DEFAULT 0,
        execution_time TIMESTAMP WITH TIME ZONE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create governance_votes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS governance_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id UUID REFERENCES governance_proposals(id),
        voter_id UUID REFERENCES users(id),
        vote_type VARCHAR(10), -- 'for', 'against', 'abstain'
        voting_power DECIMAL(20,2),
        transaction_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(proposal_id, voter_id)
      );
    `);

    // Marketplace functionality now integrated into supply_chain_batches table

    // Create marketplace_orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID REFERENCES supply_chain_batches(id),
        buyer_id UUID REFERENCES users(id),
        seller_id UUID REFERENCES users(id),
        quantity DECIMAL(15,2),
        unit_price DECIMAL(15,2),
        total_amount DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'KRSI',
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
        payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
        delivery_address TEXT,
        delivery_date TIMESTAMP WITH TIME ZONE,
        tracking_number VARCHAR(100),
        transaction_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create staking_pools table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staking_pools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_name VARCHAR(255) NOT NULL UNIQUE,
        pool_type VARCHAR(50), -- 'fixed', 'flexible', 'governance'
        apy_percentage DECIMAL(5,2),
        min_stake_amount DECIMAL(20,2),
        max_stake_amount DECIMAL(20,2),
        lock_period_days INTEGER,
        total_staked DECIMAL(20,2) DEFAULT 0,
        total_rewards_paid DECIMAL(20,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create user_stakes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_stakes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        pool_id UUID REFERENCES staking_pools(id),
        stake_amount DECIMAL(20,2),
        reward_rate DECIMAL(5,2),
        lock_start_time TIMESTAMP WITH TIME ZONE,
        lock_end_time TIMESTAMP WITH TIME ZONE,
        total_rewards DECIMAL(20,2) DEFAULT 0,
        claimed_rewards DECIMAL(20,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'unlocked', 'claimed'
        transaction_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create credit_assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        assessment_type VARCHAR(50), -- 'initial', 'periodic', 'loan_specific'
        credit_score INTEGER,
        risk_level VARCHAR(20), -- 'low', 'medium', 'high'
        factors JSONB, -- JSON object containing assessment factors
        ai_model_version VARCHAR(50),
        assessment_data JSONB, -- Raw data used for assessment
        approved_by UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(50), -- 'loan_approved', 'payment_due', 'marketplace_order', 'governance_vote', 'system'
        title VARCHAR(255),
        message TEXT,
        data JSONB, -- Additional data for the notification
        is_read BOOLEAN DEFAULT false,
        priority VARCHAR(10) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create audit_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50), -- 'user', 'loan', 'nft', 'transaction', 'governance'
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes for performance
    console.log('Creating indexes...');
    
    // User indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);');
    
    // Wallet indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_address ON wallet_accounts(address);');
    
    // NFT indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status);');
    
    // Transaction indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);');
    
    // Loan indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans(created_at);');
    
    // Supply chain indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_batches_farmer ON supply_chain_batches(farmer_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_batches_status ON supply_chain_batches(status);');
    
    // Credit score indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_scores_user ON credit_scores(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_scores_calculated_at ON credit_scores(calculated_at);');
    
    // Analytics indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON platform_analytics(metric_name);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_date ON platform_analytics(date_recorded);');
    
    // Activity log indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON user_activity_logs(activity_type);');
    
    // Farmer profiles indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_farmer_profiles_user_id ON farmer_profiles(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_farmer_profiles_profile_completed ON farmer_profiles(profile_completed);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_farmer_profiles_region ON farmer_profiles(region);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_farmer_profiles_state ON farmer_profiles(state);');
    
    // Lender profiles indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_lender_profiles_user_id ON lender_profiles(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_lender_profiles_institution_type ON lender_profiles(institution_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_lender_profiles_risk_tolerance ON lender_profiles(risk_tolerance);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_lender_profiles_profile_completed ON lender_profiles(profile_completed);');
    
    // Buyer profiles indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user_id ON buyer_profiles(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_buyer_profiles_business_type ON buyer_profiles(business_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_buyer_profiles_organic_preference ON buyer_profiles(organic_preference);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_buyer_profiles_profile_completed ON buyer_profiles(profile_completed);');
    
    // Processor profiles indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_processor_profiles_user_id ON processor_profiles(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_processor_profiles_region ON processor_profiles(region);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_processor_profiles_profile_completed ON processor_profiles(profile_completed);');
    
    // Governance indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposer_id ON governance_proposals(proposer_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposal_type ON governance_proposals(proposal_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_proposals_end_time ON governance_proposals(end_time);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal_id ON governance_votes(proposal_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_governance_votes_voter_id ON governance_votes(voter_id);');
    
    // Marketplace indexes
    // Marketplace indexes now handled by supply_chain_batches table
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON marketplace_orders(buyer_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_id ON marketplace_orders(seller_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payment_status ON marketplace_orders(payment_status);');
    
    // Staking indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_staking_pools_pool_type ON staking_pools(pool_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_staking_pools_is_active ON staking_pools(is_active);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_stakes_user_id ON user_stakes(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_stakes_pool_id ON user_stakes(pool_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_stakes_status ON user_stakes(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_stakes_lock_end_time ON user_stakes(lock_end_time);');
    
    // Credit assessments indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_assessments_user_id ON credit_assessments(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_assessments_assessment_type ON credit_assessments(assessment_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_assessments_status ON credit_assessments(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_assessments_risk_level ON credit_assessments(risk_level);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_credit_assessments_expires_at ON credit_assessments(expires_at);');
    
    // Notifications indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);');
    
    // Audit logs indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);');

    console.log('✅ Enhanced database schema initialized successfully!');
    console.log('📊 Tables created: users, wallet_accounts, nfts, admin_approvals, transactions, loans, loan_payments, supply_chain_batches, credit_scores, platform_analytics, user_activity_logs, farmer_profiles, lender_profiles, buyer_profiles, processor_profiles, governance_proposals, governance_votes, marketplace_orders, staking_pools, user_stakes, credit_assessments, notifications, audit_logs');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// ==================== FARMER PROFILE ENDPOINTS ====================

// Get farmer profile
app.get('/api/farmer/profile', authenticateToken, async (req, res) => {
  try {
    console.log('Farmer profile request for user ID:', req.user.id);
    
    const result = await pool.query(`
      SELECT fp.*, u.first_name, u.last_name, u.email, u.role
      FROM farmer_profiles fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.user_id = $1
    `, [req.user.id]);

    console.log('Farmer profile query result:', result.rows);

    if (result.rows.length === 0) {
      console.log('No farmer profile found for user:', req.user.id);
      return res.json({ success: true, profile: null });
    }

    console.log('Returning farmer profile:', result.rows[0]);
    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get farmer profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update farmer profile
app.put('/api/farmer/profile', authenticateToken, async (req, res) => {
  try {
    const {
      land_area_acres,
      farming_experience_years,
      primary_crops,
      farming_method,
      irrigation_type,
      soil_type,
      region,
      village,
      state,
      country,
      phone_number,
      emergency_contact
    } = req.body;
    
    console.log('Received farmer profile update request:', JSON.stringify(req.body, null, 2));

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM farmer_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await pool.query(`
        UPDATE farmer_profiles SET
          land_area_acres = $2,
          farming_experience_years = $3,
          primary_crops = $4,
          farming_method = $5,
          irrigation_type = $6,
          soil_type = $7,
          region = $8,
          village = $9,
          state = $10,
          country = $11,
          phone_number = $12,
          emergency_contact = $13,
          profile_completed = true,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `, [
        req.user.id,
        land_area_acres,
        farming_experience_years,
        primary_crops,
        farming_method,
        irrigation_type,
        soil_type,
        region,
        village,
        state,
        country,
        phone_number,
        emergency_contact
      ]);
    } else {
      // Create new profile
      result = await pool.query(`
        INSERT INTO farmer_profiles (
          user_id, land_area_acres, farming_experience_years, primary_crops,
          farming_method, irrigation_type, soil_type, region, village,
          state, country, phone_number, emergency_contact, profile_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
        RETURNING *
      `, [
        req.user.id,
        land_area_acres,
        farming_experience_years,
        primary_crops,
        farming_method,
        irrigation_type,
        soil_type,
        region,
        village,
        state,
        country,
        phone_number,
        emergency_contact
      ]);
    }

    // Also update the main users table with phone and address if provided
    if (phone_number || region) {
      await pool.query(`
        UPDATE users SET
          phone = COALESCE($2, phone),
          address = COALESCE($3, address),
          updated_at = NOW()
        WHERE id = $1
      `, [req.user.id, phone_number, `${village}, ${region}, ${state}, ${country}`.replace(/^, |, $/g, '')]);
    }

    console.log('Farmer profile update result:', result.rows[0]);
    res.json({ 
      success: true, 
      message: 'Farmer profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update farmer profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get farmer stats
app.get('/api/farmer/stats', authenticateToken, async (req, res) => {
  try {
    console.log('Farmer stats request for user ID:', req.user.id);
    
    const result = await pool.query(`
      SELECT 
        fp.land_area_acres,
        fp.farming_experience_years,
        fp.primary_crops,
        fp.region,
        fp.state,
        COUNT(DISTINCT l.id) as total_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'repaid' THEN l.id END) as completed_loans,
        COUNT(DISTINCT scb.id) as total_batches,
        COUNT(DISTINCT CASE WHEN scb.status = 'verified' THEN scb.id END) as verified_batches,
        COUNT(DISTINCT n.id) as land_nfts
      FROM farmer_profiles fp
      LEFT JOIN loans l ON fp.user_id = l.borrower_id
      LEFT JOIN supply_chain_batches scb ON fp.user_id = scb.farmer_id
      LEFT JOIN nfts n ON fp.user_id = n.owner_id AND n.type = 'land'
      WHERE fp.user_id = $1
      GROUP BY fp.id, fp.land_area_acres, fp.farming_experience_years, fp.primary_crops, fp.region, fp.state
    `, [req.user.id]);

    console.log('Farmer stats query result:', result.rows);

    if (result.rows.length === 0) {
      console.log('No farmer profile found for user:', req.user.id);
      return res.json({ success: true, stats: null });
    }

    console.log('Returning farmer stats:', result.rows[0]);
    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error('Get farmer stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== LENDER PROFILE ENDPOINTS ====================

// Get lender profile
app.get('/api/lender/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lp.*, u.first_name, u.last_name, u.email, u.role
      FROM lender_profiles lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, profile: null });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get lender profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lender profile
app.put('/api/lender/profile', authenticateToken, async (req, res) => {
  try {
    const {
      institution_name,
      institution_type,
      license_number,
      max_loan_amount,
      min_loan_amount,
      preferred_interest_rate_min,
      preferred_interest_rate_max,
      preferred_loan_term_min,
      preferred_loan_term_max,
      risk_tolerance,
      preferred_regions,
      preferred_crops,
      minimum_credit_score,
      collateral_required,
      kyc_verified
    } = req.body;

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM lender_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await pool.query(`
        UPDATE lender_profiles SET
          institution_name = $2,
          institution_type = $3,
          license_number = $4,
          max_loan_amount = $5,
          min_loan_amount = $6,
          preferred_interest_rate_min = $7,
          preferred_interest_rate_max = $8,
          preferred_loan_term_min = $9,
          preferred_loan_term_max = $10,
          risk_tolerance = $11,
          preferred_regions = $12,
          preferred_crops = $13,
          minimum_credit_score = $14,
          collateral_required = $15,
          kyc_verified = $16,
          profile_completed = true,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `, [
        req.user.id,
        institution_name,
        institution_type,
        license_number,
        max_loan_amount,
        min_loan_amount,
        preferred_interest_rate_min,
        preferred_interest_rate_max,
        preferred_loan_term_min,
        preferred_loan_term_max,
        risk_tolerance,
        preferred_regions,
        preferred_crops,
        minimum_credit_score,
        collateral_required,
        kyc_verified
      ]);
    } else {
      // Create new profile
      result = await pool.query(`
        INSERT INTO lender_profiles (
          user_id, institution_name, institution_type, license_number,
          max_loan_amount, min_loan_amount, preferred_interest_rate_min,
          preferred_interest_rate_max, preferred_loan_term_min, preferred_loan_term_max,
          risk_tolerance, preferred_regions, preferred_crops, minimum_credit_score,
          collateral_required, kyc_verified, profile_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
        RETURNING *
      `, [
        req.user.id,
        institution_name,
        institution_type,
        license_number,
        max_loan_amount,
        min_loan_amount,
        preferred_interest_rate_min,
        preferred_interest_rate_max,
        preferred_loan_term_min,
        preferred_loan_term_max,
        risk_tolerance,
        preferred_regions,
        preferred_crops,
        minimum_credit_score,
        collateral_required,
        kyc_verified
      ]);
    }

    res.json({ 
      success: true, 
      message: 'Lender profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update lender profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== LENDER DASHBOARD ENDPOINTS ====================

// Get lender dashboard stats
app.get('/api/lender/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get lender profile info
    const lenderProfile = await pool.query(`
      SELECT lp.*, u.first_name, u.last_name, u.email
      FROM lender_profiles lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.user_id = $1
    `, [userId]);

    // Get pool statistics (aggregate data from all lenders)
    const poolStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.id) as total_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'repaid' THEN l.id END) as repaid_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'defaulted' THEN l.id END) as defaulted_loans,
        COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.amount ELSE 0 END), 0) as total_active_amount,
        COALESCE(SUM(CASE WHEN l.status = 'repaid' THEN l.amount ELSE 0 END), 0) as total_repaid_amount,
        COALESCE(AVG(CASE WHEN l.status = 'active' THEN l.interest_rate END), 0) as average_interest_rate,
        COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.amount ELSE 0 END) / NULLIF(SUM(l.amount), 0) * 100, 0) as utilization_rate
      FROM loans l
    `);

    // Get lender's specific stats
    const lenderStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.id) as my_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as my_active_loans,
        COUNT(DISTINCT CASE WHEN l.status = 'repaid' THEN l.id END) as my_repaid_loans,
        COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.amount ELSE 0 END), 0) as my_active_amount,
        COALESCE(SUM(CASE WHEN l.status = 'repaid' THEN l.amount ELSE 0 END), 0) as my_repaid_amount,
        COALESCE(SUM(CASE WHEN l.status = 'repaid' THEN l.amount * l.interest_rate / 100 ELSE 0 END), 0) as my_total_earnings
      FROM loans l
      WHERE l.lender_id = $1
    `, [userId]);

    // Get lender's staking data
    const stakingData = await pool.query(`
      SELECT 
        COALESCE(SUM(us.stake_amount), 0) as total_staked,
        COALESCE(SUM(us.stake_amount * sp.apy_percentage / 100), 0) as staking_earnings,
        COUNT(DISTINCT us.id) as staking_positions
      FROM user_stakes us
      LEFT JOIN staking_pools sp ON us.pool_id = sp.id
      WHERE us.user_id = $1
    `, [userId]);

    // Get recent loans funded by this lender
    const recentLoans = await pool.query(`
      SELECT 
        l.id,
        l.amount,
        l.interest_rate,
        l.status,
        l.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM loans l
      JOIN users u ON l.borrower_id = u.id
      WHERE l.lender_id = $1
      ORDER BY l.created_at DESC
      LIMIT 10
    `, [userId]);

    res.json({
      success: true,
      data: {
        profile: lenderProfile.rows[0] || null,
        poolStats: poolStats.rows[0],
        lenderStats: lenderStats.rows[0],
        stakingData: stakingData.rows[0],
        recentLoans: recentLoans.rows
      }
    });
  } catch (error) {
    console.error('Lender dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch lender dashboard data' });
  }
});

// Get lender's active loans
app.get('/api/lender/loans', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'all', limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE l.lender_id = $1';
    let params = [userId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND l.status = $${paramCount}`;
      params.push(status);
    }

    const result = await pool.query(`
      SELECT 
        l.id,
        l.amount,
        l.interest_rate,
        l.status,
        l.created_at,
        l.due_date,
        u.first_name,
        u.last_name,
        u.email,
        fp.region,
        fp.farming_experience_years
      FROM loans l
      JOIN users u ON l.borrower_id = u.id
      LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({ success: true, loans: result.rows });
  } catch (error) {
    console.error('Lender loans error:', error);
    res.status(500).json({ error: 'Failed to fetch lender loans' });
  }
});

// ==================== TEMPORARY: POPULATE SAMPLE LENDER DATA ====================

// Populate sample loans for testing
app.post('/api/admin/populate-sample-loans', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you can modify this check as needed)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get some users to use as borrowers and lenders
    const users = await pool.query('SELECT id FROM users LIMIT 5');
    if (users.rows.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 users to create sample loans' });
    }

    const sampleLoans = [
      {
        borrower_id: users.rows[0].id,
        lender_id: users.rows[1].id,
        amount: 5000,
        interest_rate: 8.5,
        term_months: 12,
        status: 'active',
        due_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      },
      {
        borrower_id: users.rows[1].id,
        lender_id: users.rows[0].id,
        amount: 3500,
        interest_rate: 12.0,
        term_months: 6,
        status: 'repaid',
        due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 1 month ago
      },
      {
        borrower_id: users.rows[0].id,
        lender_id: users.rows[1].id,
        amount: 7500,
        interest_rate: 10.5,
        term_months: 18,
        status: 'active',
        due_date: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000) // 18 months from now
      }
    ];

    for (const loan of sampleLoans) {
      await pool.query(`
        INSERT INTO loans (
          borrower_id, lender_id, amount, interest_rate, term_months, 
          status, due_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [
        loan.borrower_id,
        loan.lender_id,
        loan.amount,
        loan.interest_rate,
        loan.term_months,
        loan.status,
        loan.due_date
      ]);
    }

    res.json({ 
      success: true, 
      message: 'Sample loans created successfully',
      loansCreated: sampleLoans.length
    });
  } catch (error) {
    console.error('Error populating sample loans:', error);
    res.status(500).json({ error: 'Failed to populate sample loans' });
  }
});

// ==================== BUYER DASHBOARD ENDPOINTS ====================

// Get buyer dashboard data
app.get('/api/buyer/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get buyer profile info
    const buyerProfile = await pool.query(`
      SELECT bp.*, u.first_name, u.last_name, u.email
      FROM buyer_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.user_id = $1
    `, [userId]);

    // Get buyer's purchase history - Simplified query first
    const purchases = await pool.query(`
      SELECT 
        mo.id,
        mo.quantity,
        mo.unit_price,
        mo.total_amount,
        mo.status,
        mo.payment_status,
        mo.created_at as purchase_date,
        mo.batch_id,
        mo.buyer_id,
        mo.seller_id
      FROM marketplace_orders mo
      WHERE mo.buyer_id = $1
      ORDER BY mo.created_at DESC
    `, [userId]);


    // Now get product details for each purchase
    const purchasesWithDetails = [];
    for (const purchase of purchases.rows) {
      try {
        const productDetails = await pool.query(`
          SELECT 
            scb.product_name,
            scb.product_description,
            scb.unit,
            scb.currency,
            scb.region,
            scb.state,
            scb.organic_certified,
            u.first_name as farmer_first_name,
            u.last_name as farmer_last_name,
            u.email as farmer_email
          FROM supply_chain_batches scb
          JOIN users u ON scb.farmer_id = u.id
          WHERE scb.id = $1
        `, [purchase.batch_id]);

        if (productDetails.rows.length > 0) {
          purchasesWithDetails.push({
            ...purchase,
            ...productDetails.rows[0]
          });
        } else {
          // If no product details found, still include the purchase
          purchasesWithDetails.push({
            ...purchase,
            product_name: 'Unknown Product',
            product_description: 'Product details not available',
            unit: 'kg',
            currency: 'KRSI',
            region: 'Unknown',
            state: 'Unknown',
            organic_certified: false,
            farmer_first_name: 'Unknown',
            farmer_last_name: 'Farmer',
            farmer_email: 'unknown@example.com'
          });
        }
      } catch (error) {
        console.error('Error fetching product details for purchase:', purchase.id, error);
        // Still include the purchase with default values
        purchasesWithDetails.push({
          ...purchase,
          product_name: 'Unknown Product',
          product_description: 'Product details not available',
          unit: 'kg',
          currency: 'KRSI',
          region: 'Unknown',
          state: 'Unknown',
          organic_certified: false,
          farmer_first_name: 'Unknown',
          farmer_last_name: 'Farmer',
          farmer_email: 'unknown@example.com'
        });
      }
    }

    // Get available batches (products available for purchase)
    const availableBatches = await pool.query(`
      SELECT 
        scb.id,
        scb.product_name,
        scb.product_description,
        scb.quantity,
        scb.price_per_unit,
        scb.unit,
        scb.currency,
        scb.region,
        scb.state,
        scb.organic_certified,
        scb.marketplace_status,
        u.first_name as farmer_first_name,
        u.last_name as farmer_last_name,
        u.email as farmer_email
      FROM supply_chain_batches scb
      JOIN users u ON scb.farmer_id = u.id
      WHERE scb.marketplace_status = 'active' 
        AND scb.quantity > 0
        AND scb.farmer_id != $1
      ORDER BY scb.created_at DESC
    `, [userId]);

    // Calculate stats
    const totalSpent = purchasesWithDetails.reduce((sum, purchase) => sum + parseFloat(purchase.total_amount || 0), 0);
    const totalPurchases = purchasesWithDetails.length;
    const verifiedProducts = purchasesWithDetails.filter(p => p.organic_certified).length;
    const verificationRate = totalPurchases > 0 ? (verifiedProducts / totalPurchases * 100) : 0;

    res.json({
      success: true,
      data: {
        profile: buyerProfile.rows[0] || null,
        purchases: purchasesWithDetails,
        availableBatches: availableBatches.rows,
        stats: {
          totalPurchases,
          totalSpent,
          availableBatches: availableBatches.rows.length,
          verificationRate: Math.round(verificationRate)
        }
      }
    });
  } catch (error) {
    console.error('Buyer dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch buyer dashboard data' });
  }
});

// ==================== BUYER PROFILE ENDPOINTS ====================

// Get buyer profile
app.get('/api/buyer/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bp.*, u.first_name, u.last_name, u.email, u.role
      FROM buyer_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, profile: null });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get buyer profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update buyer profile
app.put('/api/buyer/profile', authenticateToken, async (req, res) => {
  try {
    const {
      buyer_type,
      business_name,
      business_type,
      business_license,
      preferred_crops,
      preferred_regions,
      quality_requirements,
      organic_preference,
      max_order_quantity,
      min_order_quantity,
      payment_terms,
      delivery_preferences,
      certification_requirements
    } = req.body;

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM buyer_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await pool.query(`
        UPDATE buyer_profiles SET
          buyer_type = $2,
          business_name = $3,
          business_type = $4,
          business_license = $5,
          preferred_crops = $6,
          preferred_regions = $7,
          quality_requirements = $8,
          organic_preference = $9,
          max_order_quantity = $10,
          min_order_quantity = $11,
          payment_terms = $12,
          delivery_preferences = $13,
          certification_requirements = $14,
          profile_completed = true,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `, [
        req.user.id,
        buyer_type,
        business_name,
        business_type,
        business_license,
        preferred_crops,
        preferred_regions,
        quality_requirements,
        organic_preference,
        max_order_quantity,
        min_order_quantity,
        payment_terms,
        delivery_preferences,
        certification_requirements
      ]);
    } else {
      // Create new profile
      result = await pool.query(`
        INSERT INTO buyer_profiles (
          user_id, buyer_type, business_name, business_type, business_license,
          preferred_crops, preferred_regions, quality_requirements,
          organic_preference, max_order_quantity, min_order_quantity,
          payment_terms, delivery_preferences, certification_requirements, profile_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
        RETURNING *
      `, [
        req.user.id,
        buyer_type,
        business_name,
        business_type,
        business_license,
        preferred_crops,
        preferred_regions,
        quality_requirements,
        organic_preference,
        max_order_quantity,
        min_order_quantity,
        payment_terms,
        delivery_preferences,
        certification_requirements
      ]);
    }

    res.json({ 
      success: true, 
      message: 'Buyer profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update buyer profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== PROCESSOR PROFILE ENDPOINTS ====================

// Get processor profile
app.get('/api/processor/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pp.*, u.first_name, u.last_name, u.email, u.role
      FROM processor_profiles pp
      JOIN users u ON pp.user_id = u.id
      WHERE pp.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, profile: null });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get processor profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update processor profile
app.put('/api/processor/profile', authenticateToken, async (req, res) => {
  try {
    const {
      company_name,
      processing_capacity,
      processing_types,
      certifications,
      equipment_list,
      quality_standards,
      region,
      state,
      country,
      contact_person,
      phone_number,
      email
    } = req.body;

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM processor_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await pool.query(`
        UPDATE processor_profiles SET
          company_name = $2,
          processing_capacity = $3,
          processing_types = $4,
          certifications = $5,
          equipment_list = $6,
          quality_standards = $7,
          region = $8,
          state = $9,
          country = $10,
          contact_person = $11,
          phone_number = $12,
          email = $13,
          profile_completed = true,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `, [
        req.user.id,
        company_name,
        processing_capacity,
        processing_types,
        certifications,
        equipment_list,
        quality_standards,
        region,
        state,
        country,
        contact_person,
        phone_number,
        email
      ]);
    } else {
      // Create new profile
      result = await pool.query(`
        INSERT INTO processor_profiles (
          user_id, company_name, processing_capacity, processing_types,
          certifications, equipment_list, quality_standards, region,
          state, country, contact_person, phone_number, email, profile_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
        RETURNING *
      `, [
        req.user.id,
        company_name,
        processing_capacity,
        processing_types,
        certifications,
        equipment_list,
        quality_standards,
        region,
        state,
        country,
        contact_person,
        phone_number,
        email
      ]);
    }

    res.json({ 
      success: true, 
      message: 'Processor profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update processor profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== WALLET PROVISIONING ENDPOINTS ====================

// Staking Endpoints
app.get('/api/wallet/staking-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's staking positions
    const stakesResult = await pool.query(`
      SELECT us.*, sp.pool_name, sp.apy_percentage, sp.pool_type
      FROM user_stakes us
      LEFT JOIN staking_pools sp ON us.pool_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
      ORDER BY us.lock_start_time DESC
    `, [userId]);
    
    // Calculate total rewards
    const rewardsResult = await pool.query(`
      SELECT COALESCE(SUM(total_rewards), 0) as total_rewards
      FROM user_stakes
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    const stakes = stakesResult.rows.map(stake => ({
      id: stake.id,
      amount: stake.stake_amount,
      lockPeriod: Math.floor((new Date(stake.lock_end_time) - new Date(stake.lock_start_time)) / 1000),
      startTime: Math.floor(new Date(stake.lock_start_time).getTime() / 1000),
      isActive: stake.status === 'active',
      apy: stake.apy_percentage,
      poolName: stake.pool_name,
      poolType: stake.pool_type
    }));
    
    res.json({
      success: true,
      stakes,
      totalRewards: rewardsResult.rows[0].total_rewards || '0'
    });
  } catch (error) {
    console.error('Error fetching staking data:', error);
    res.status(500).json({ error: 'Failed to fetch staking data' });
  }
});

app.post('/api/wallet/stake', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount_wei, lock_period_seconds, credit_score, wallet_type, user_role } = req.body;
    
    console.log('Staking request:', { userId, amount_wei, lock_period_seconds, credit_score, wallet_type, user_role });
    
    if (!amount_wei || !lock_period_seconds) {
      return res.status(400).json({ error: 'Amount and lock period are required' });
    }
    
    // Get or create a staking pool based on lock period
    const lockDays = Math.floor(lock_period_seconds / (24 * 60 * 60));
    const baseAPY = { 30: 5, 90: 8, 180: 12, 365: 15 };
    const apy = baseAPY[lockDays] || 5;
    
    // Enhanced APY based on credit score
    let enhancedAPY = apy;
    if (credit_score) {
      const creditMultiplier = Math.min(1 + (credit_score - 300) / 1000, 1.5);
      enhancedAPY = apy * creditMultiplier;
    }
    
    console.log('Calculated APY:', { lockDays, baseAPY: apy, enhancedAPY });
    
    // Create staking pool if it doesn't exist
    let poolId;
    const poolName = `${lockDays}-day-pool`;
    
    // First, try to find existing pool
    const existingPool = await pool.query(`
      SELECT id FROM staking_pools WHERE pool_name = $1
    `, [poolName]);
    
    if (existingPool.rows.length > 0) {
      // Pool exists, update APY
      poolId = existingPool.rows[0].id;
      await pool.query(`
        UPDATE staking_pools 
        SET apy_percentage = $1, updated_at = NOW()
        WHERE id = $2
      `, [enhancedAPY, poolId]);
      console.log('Pool updated:', poolId);
    } else {
      // Pool doesn't exist, create new one
      const poolResult = await pool.query(`
        INSERT INTO staking_pools (pool_name, pool_type, apy_percentage, min_stake_amount, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
      `, [poolName, 'fixed', enhancedAPY, 1]);
      poolId = poolResult.rows[0].id;
      console.log('Pool created:', poolId);
    }
    
    // Convert amount from wei to decimal
    const stakeAmount = ethers.utils.formatUnits(amount_wei, 6);
    console.log('Stake amount:', stakeAmount);
    
    // Check if user has sufficient balance
    const walletResult = await pool.query(`
      SELECT balance_wei FROM wallet_accounts 
      WHERE user_id = $1 AND wallet_type = 'agrifinance'
    `, [userId]);
    
    if (walletResult.rows.length === 0) {
      return res.status(400).json({ error: 'Wallet not found' });
    }
    
    const currentBalanceWei = walletResult.rows[0].balance_wei;
    const stakeAmountWei = BigInt(amount_wei);
    const currentBalanceBigInt = BigInt(currentBalanceWei || '0');
    
    if (currentBalanceBigInt < stakeAmountWei) {
      return res.status(400).json({ 
        error: `Insufficient balance. You have ${ethers.utils.formatUnits(currentBalanceWei, 6)} KRSI, trying to stake ${ethers.utils.formatUnits(amount_wei, 6)} KRSI` 
      });
    }
    
    // Deduct the staked amount from wallet balance
    const newBalanceWei = (currentBalanceBigInt - stakeAmountWei).toString();
    await pool.query(`
      UPDATE wallet_accounts 
      SET balance_wei = $1, updated_at = NOW()
      WHERE user_id = $2 AND wallet_type = 'agrifinance'
    `, [newBalanceWei, userId]);
    
    console.log(`💰 Balance updated: ${ethers.utils.formatUnits(currentBalanceWei, 6)} → ${ethers.utils.formatUnits(newBalanceWei, 6)} KRSI`);
    
    // Create user stake
    const stakeResult = await pool.query(`
      INSERT INTO user_stakes (user_id, pool_id, stake_amount, reward_rate, lock_start_time, lock_end_time, status)
      VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '${lock_period_seconds} seconds', 'active')
      RETURNING *
    `, [userId, poolId, stakeAmount, enhancedAPY]);
    
    console.log('Stake created:', stakeResult.rows[0]);
    
    res.json({
      success: true,
      stake: stakeResult.rows[0],
      message: 'Tokens staked successfully'
    });
  } catch (error) {
    console.error('Error staking tokens:', error);
    res.status(500).json({ error: 'Failed to stake tokens: ' + error.message });
  }
});

app.post('/api/wallet/unstake', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { stakeIndex } = req.body;
    
    // Get user's stake by index
    const stakesResult = await pool.query(`
      SELECT * FROM user_stakes
      WHERE user_id = $1 AND status = 'active'
      ORDER BY lock_start_time DESC
      LIMIT 1 OFFSET $2
    `, [userId, stakeIndex]);
    
    if (stakesResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stake not found' });
    }
    
    const stake = stakesResult.rows[0];
    
    // Check if lock period has ended
    const now = new Date();
    const lockEnd = new Date(stake.lock_end_time);
    
    if (now < lockEnd) {
      return res.status(400).json({ error: 'Stake is still locked' });
    }
    
    // Convert stake amount back to wei and add to wallet balance
    const stakeAmountWei = ethers.utils.parseUnits(stake.stake_amount.toString(), 6).toString();
    
    // Get current wallet balance
    const walletResult = await pool.query(`
      SELECT balance_wei FROM wallet_accounts 
      WHERE user_id = $1 AND wallet_type = 'agrifinance'
    `, [userId]);
    
    if (walletResult.rows.length === 0) {
      return res.status(400).json({ error: 'Wallet not found' });
    }
    
    const currentBalanceWei = walletResult.rows[0].balance_wei;
    const currentBalanceBigInt = BigInt(currentBalanceWei || '0');
    const stakeAmountBigInt = BigInt(stakeAmountWei);
    const newBalanceWei = (currentBalanceBigInt + stakeAmountBigInt).toString();
    
    // Update wallet balance
    await pool.query(`
      UPDATE wallet_accounts 
      SET balance_wei = $1, updated_at = NOW()
      WHERE user_id = $2 AND wallet_type = 'agrifinance'
    `, [newBalanceWei, userId]);
    
    console.log(`💰 Balance restored: ${ethers.utils.formatUnits(currentBalanceWei, 6)} → ${ethers.utils.formatUnits(newBalanceWei, 6)} KRSI`);
    
    // Update stake status
    await pool.query(`
      UPDATE user_stakes
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [stake.id]);
    
    res.json({
      success: true,
      message: 'Tokens unstaked successfully'
    });
  } catch (error) {
    console.error('Error unstaking tokens:', error);
    res.status(500).json({ error: 'Failed to unstake tokens' });
  }
});

app.post('/api/wallet/claim-rewards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total claimable rewards
    const rewardsResult = await pool.query(`
      SELECT COALESCE(SUM(total_rewards), 0) as total_rewards
      FROM user_stakes
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    const totalRewards = rewardsResult.rows[0].total_rewards;
    
    if (totalRewards <= 0) {
      return res.status(400).json({ error: 'No rewards to claim' });
    }
    
    // Reset rewards to 0 (simulate claiming)
    await pool.query(`
      UPDATE user_stakes
      SET total_rewards = 0
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    res.json({
      success: true,
      claimedAmount: totalRewards,
      message: 'Rewards claimed successfully'
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({ error: 'Failed to claim rewards' });
  }
});

// Provision wallet for user
app.post('/api/wallet/provision', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, walletType, encryptedPrivateKey } = req.body;
    const userId = req.user.id;

    // Validate wallet type
    if (!['inapp', 'metamask'].includes(walletType)) {
      return res.status(400).json({ error: 'Invalid wallet type' });
    }

    // Check if user already has a wallet of this type
    const existingWallet = await pool.query(
      'SELECT id FROM wallets WHERE user_id = $1 AND wallet_type = $2',
      [userId, walletType]
    );

    if (existingWallet.rows.length > 0) {
      return res.status(400).json({ error: 'Wallet of this type already exists for user' });
    }

    // Create wallet record
    const result = await pool.query(
      `INSERT INTO wallets (user_id, address, wallet_type, encrypted_private_key, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING id, address, wallet_type, is_active, created_at`,
      [userId, walletAddress, walletType, encryptedPrivateKey]
    );

    res.json({ 
      success: true, 
      wallet: result.rows[0],
      message: 'Wallet provisioned successfully'
    });

  } catch (error) {
    console.error('Wallet provisioning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lookup user wallets
app.get('/api/wallet/lookup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletType } = req.query;

    let query = 'SELECT id, address, wallet_type, is_active, created_at FROM wallets WHERE user_id = $1';
    let params = [userId];

    if (walletType) {
      query += ' AND wallet_type = $2';
      params.push(walletType);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({ 
      success: true, 
      wallets: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Wallet lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate wallet
app.put('/api/wallet/:walletId/activate', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.id;

    // Verify wallet belongs to user
    const walletCheck = await pool.query(
      'SELECT id FROM wallets WHERE id = $1 AND user_id = $2',
      [walletId, userId]
    );

    if (walletCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Deactivate all other wallets of the same type
    const wallet = await pool.query(
      'SELECT wallet_type FROM wallets WHERE id = $1',
      [walletId]
    );

    await pool.query(
      'UPDATE wallets SET is_active = false WHERE user_id = $1 AND wallet_type = $2',
      [userId, wallet[0].wallet_type]
    );

    // Activate the specified wallet
    const result = await pool.query(
      'UPDATE wallets SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING id, address, wallet_type, is_active',
      [walletId]
    );

    res.json({ 
      success: true, 
      wallet: result.rows[0],
      message: 'Wallet activated successfully'
    });

  } catch (error) {
    console.error('Wallet activation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete wallet
app.delete('/api/wallet/:walletId', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.id;

    // Verify wallet belongs to user
    const walletCheck = await pool.query(
      'SELECT id FROM wallets WHERE id = $1 AND user_id = $2',
      [walletId, userId]
    );

    if (walletCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Soft delete the wallet
    await pool.query(
      'UPDATE wallets SET is_active = false, deleted_at = NOW() WHERE id = $1',
      [walletId]
    );

    res.json({ 
      success: true,
      message: 'Wallet deleted successfully'
    });

  } catch (error) {
    console.error('Wallet deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ADMIN ANALYTICS ENDPOINTS ====================

async function isAdminRequest(req) {
  try {
    if (req.user?.role === 'admin') return true;
    const r = await pool.query('SELECT role FROM users WHERE id::text = $1', [String(req.user?.id || '')]);
    return r.rows[0]?.role === 'admin';
  } catch (e) {
    return false;
  }
}

// Admin analytics dashboard data
app.get('/api/admin/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!(await isAdminRequest(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user statistics (safe)
    let userStats;
    try { userStats = await pool.query(`
      SELECT 
        COALESCE(COUNT(*),0) as total_users,
        COALESCE(COUNT(CASE WHEN role = 'admin' THEN 1 END),0) as admin_users,
        COALESCE(COUNT(CASE WHEN profile_completed = true THEN 1 END),0) as active_users,
        COALESCE(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END),0) as new_users_30d
      FROM users
    `); } catch { userStats = { rows: [{ total_users: 0, admin_users: 0, active_users: 0, new_users_30d: 0 }] }; }

    // Get loan statistics (prefer protocol_loans if present)
    let loanStats;
    try {
      loanStats = await pool.query(`
        SELECT 
          COUNT(*) as total_loans,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
          COUNT(CASE WHEN status = 'repaid' THEN 1 END) as repaid_loans,
          SUM(CASE WHEN status = 'active' THEN CAST(principal_wei AS NUMERIC) ELSE 0 END) as total_active_amount
        FROM protocol_loans
      `);
    } catch (e) {
      // Fallback to legacy loans table
      loanStats = await pool.query(`
        SELECT 
          COUNT(*) as total_loans,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
          COUNT(CASE WHEN status = 'repaid' THEN 1 END) as repaid_loans,
          SUM(CASE WHEN status = 'active' THEN CAST(amount_wei AS NUMERIC) ELSE 0 END) as total_active_amount
        FROM loans
      `);
    }

    // Get NFT statistics (sold via marketplace_orders when available)
    // NFT counts – be tolerant to schema differences
    let nftCount;
    try {
      const totalRes = await pool.query(`SELECT COALESCE(COUNT(*),0) as total_nfts FROM nfts`);
      // Treat token_id presence as "minted" to avoid relying on a specific verified column
      const mintedRes = await pool.query(`SELECT COALESCE(COUNT(*),0) as minted_nfts FROM nfts WHERE token_id IS NOT NULL`);
      nftCount = { rows: [{ total_nfts: totalRes.rows[0].total_nfts, minted_nfts: mintedRes.rows[0].minted_nfts }] };
    } catch {
      nftCount = { rows: [{ total_nfts: 0, minted_nfts: 0 }] };
    }
    let soldAgg = { rows: [{ sold_nfts: 0, total_sales_value: 0 }] };
    try {
      soldAgg = await pool.query(`
        SELECT 
          COALESCE(COUNT(*),0) as sold_nfts, 
          COALESCE(SUM(CAST(COALESCE(total_price_wei, price_wei, 0) AS NUMERIC)),0) as total_sales_value
        FROM marketplace_orders
        WHERE 
          (status IN ('sold','completed') OR buyer_id IS NOT NULL OR sold_at IS NOT NULL)
      `);
      if (Number(soldAgg.rows[0]?.sold_nfts || 0) === 0) {
        const fallback = await pool.query(`SELECT COALESCE(COUNT(*),0) as c FROM nfts WHERE LOWER(status)='sold'`);
        soldAgg = { rows: [{ sold_nfts: fallback.rows[0]?.c || 0, total_sales_value: 0 }] };
      }
    } catch (e) {
      try {
        const fallback = await pool.query(`SELECT COALESCE(COUNT(*),0) as c FROM nfts WHERE LOWER(status)='sold'`);
        soldAgg = { rows: [{ sold_nfts: fallback.rows[0]?.c || 0, total_sales_value: 0 }] };
      } catch {}
    }
    const nftStats = { rows: [{
      total_nfts: nftCount.rows[0]?.total_nfts || 0,
      minted_nfts: nftCount.rows[0]?.minted_nfts || 0,
      sold_nfts: soldAgg.rows[0]?.sold_nfts || 0,
      total_sales_value: soldAgg.rows[0]?.total_sales_value || 0
    }]};

    // Get transaction statistics
    let transactionStats;
    try { transactionStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as transactions_7d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as transactions_30d,
        SUM(CASE WHEN direction = 'in' THEN CAST(amount_wei AS NUMERIC) ELSE 0 END) as total_inflow,
        SUM(CASE WHEN direction = 'out' THEN CAST(amount_wei AS NUMERIC) ELSE 0 END) as total_outflow
      FROM transactions
    `); } catch { transactionStats = { rows: [{ total_transactions: 0, transactions_7d: 0, transactions_30d: 0, total_inflow: 0, total_outflow: 0 }] }; }

    // Get supply chain statistics
    let supplyChainStats;
    try { supplyChainStats = await pool.query(`
      SELECT 
        COUNT(*) as total_batches,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_batches,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_batches,
        COUNT(CASE WHEN sold_at IS NOT NULL THEN 1 END) as sold_batches
      FROM supply_chain_batches
    `); } catch { supplyChainStats = { rows: [{ total_batches: 0, verified_batches: 0, pending_batches: 0, sold_batches: 0 }] }; }

    // Get recent activity
    let recentActivity;
    try { recentActivity = await pool.query(`
      SELECT 
        'user_registration' as activity_type,
        u.first_name || ' ' || u.last_name as user_name,
        u.email,
        u.created_at as timestamp,
        'User registered' as description
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'loan_application' as activity_type,
        u.first_name || ' ' || u.last_name as user_name,
        u.email,
        l.created_at as timestamp,
        'Applied for loan of ' || ROUND(CAST(l.amount_wei AS NUMERIC) / 1000000, 2) || ' KRSI' as description
      FROM loans l
      JOIN users u ON l.borrower_id = u.id
      WHERE l.created_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'nft_creation' as activity_type,
        u.first_name || ' ' || u.last_name as user_name,
        u.email,
        n.created_at as timestamp,
        'Created NFT: ' || n.name as description
      FROM nfts n
      JOIN users u ON n.owner_id = u.id
      WHERE n.created_at >= NOW() - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT 20
    `); } catch { recentActivity = { rows: [] }; }

    res.json({
      success: true,
      analytics: {
        users: userStats.rows[0],
        loans: loanStats.rows[0],
        nfts: nftStats.rows[0],
        transactions: transactionStats.rows[0],
        supplyChain: supplyChainStats.rows[0],
        recentActivity: recentActivity.rows
      }
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.json({ success: true, analytics: { users: { total_users: 0, admin_users: 0, active_users: 0, new_users_30d: 0 }, loans: { total_loans: 0, active_loans: 0, pending_loans: 0, repaid_loans: 0, total_active_amount: 0 }, nfts: { total_nfts: 0, minted_nfts: 0, sold_nfts: 0, total_sales_value: 0 }, transactions: { total_transactions: 0, transactions_7d: 0, transactions_30d: 0, total_inflow: 0, total_outflow: 0 }, supplyChain: { total_batches: 0, verified_batches: 0, pending_batches: 0, sold_batches: 0 }, recentActivity: [] } });
  }
});

// Admin users management
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        u.*,
        w.address as wallet_address,
        w.balance_wei,
        COUNT(l.id) as loan_count,
        COUNT(n.id) as nft_count
      FROM users u
      LEFT JOIN wallet_accounts w ON u.id = w.user_id
      LEFT JOIN loans l ON u.id = l.borrower_id
      LEFT JOIN nfts n ON u.id = n.owner_id
      GROUP BY u.id, w.address, w.balance_wei
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin loans management
app.get('/api/admin/loans', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        l.*,
        b.first_name || ' ' || b.last_name as borrower_name,
        b.email as borrower_email,
        lender.first_name || ' ' || lender.last_name as lender_name,
        lender.email as lender_email,
        n.name as collateral_nft_name
      FROM loans l
      LEFT JOIN users b ON l.borrower_id = b.id
      LEFT JOIN users lender ON l.lender_id = lender.id
      LEFT JOIN nfts n ON l.collateral_nft_id = n.id
      ORDER BY l.created_at DESC
    `);

    res.json({ success: true, loans: result.rows });
  } catch (error) {
    console.error('Admin loans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin supply chain management
app.get('/api/admin/supply-chain', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        scb.*,
        f.first_name || ' ' || f.last_name as farmer_name,
        f.email as farmer_email,
        buyer.first_name || ' ' || buyer.last_name as buyer_name,
        buyer.email as buyer_email
      FROM supply_chain_batches scb
      LEFT JOIN users f ON scb.farmer_id = f.id
      LEFT JOIN users buyer ON scb.buyer_id = buyer.id
      ORDER BY scb.created_at DESC
    `);

    res.json({ success: true, batches: result.rows });
  } catch (error) {
    console.error('Admin supply chain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin platform metrics
app.get('/api/admin/metrics', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { period = '30d' } = req.query;
    
    let interval;
    switch (period) {
      case '7d':
        interval = '7 days';
        break;
      case '30d':
        interval = '30 days';
        break;
      case '90d':
        interval = '90 days';
        break;
      default:
        interval = '30 days';
    }

    // Get daily metrics for the specified period
    const dailyMetrics = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as daily_users,
        (SELECT COUNT(*) FROM loans WHERE DATE(created_at) = DATE(u.created_at)) as daily_loans,
        (SELECT COUNT(*) FROM nfts WHERE DATE(created_at) = DATE(u.created_at)) as daily_nfts,
        (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = DATE(u.created_at)) as daily_transactions
      FROM users u
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get revenue metrics
    const revenueMetrics = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN direction = 'in' THEN CAST(amount_wei AS NUMERIC) ELSE 0 END) as daily_revenue,
        SUM(CASE WHEN direction = 'out' THEN CAST(amount_wei AS NUMERIC) ELSE 0 END) as daily_expenses
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      metrics: {
        daily: dailyMetrics.rows,
        revenue: revenueMetrics.rows,
        period: period
      }
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Credit Scoring endpoints
const aiService = require('./services/aiService');

// Endpoint for Chainlink Functions to call
app.post('/api/ai/credit-score', async (req, res) => {
  try {
    const { userAddress, timestamp, additionalData } = req.body || {};
    
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress is required' });
    }

    const scoreData = await aiService.getCreditScore(userAddress, additionalData);
    
    res.json({
      success: true,
      score: scoreData.score,
      confidence: scoreData.confidence,
      factors: scoreData.factors,
      timestamp: scoreData.timestamp,
      source: scoreData.source
    });
  } catch (e) {
    console.error('AI credit score error:', e?.message || e);
    res.status(500).json({ error: 'Failed to calculate credit score' });
  }
});

// Get cached credit score (frontend endpoint)
app.get('/api/credit/score/cached', authenticateToken, async (req, res) => {
  try {
    // Get user's wallet address
    const userId = req.user.id;
    const walletQuery = await pool.query(
      'SELECT address, balance_wei FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (!walletQuery.rows || walletQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found for user' });
    }
    
    const walletAddress = walletQuery.rows[0].address;
    
    // Calculate credit score using AI service
    const scoreData = await aiService.getCreditScore(walletAddress);
    
    console.log(`[SERVER DEBUG] /api/credit/score/cached result for ${walletAddress}:`, JSON.stringify(scoreData));

    // Verify AI Service response
    // console.log(`[SERVER DEBUG] AI Service returned for ${walletAddress}:`, scoreData);

    res.json({
      success: true,
      score: scoreData.score,
      lastUpdated: new Date().toISOString(),
      source: scoreData.source,
      confidence: scoreData.confidence
    });
  } catch (e) {
    console.error('Error fetching cached credit score:', e?.message || e);
    res.status(500).json({ error: 'Failed to fetch credit score' });
  }
});

// Recompute credit score (force refresh)
app.post('/api/credit/score/recompute', authenticateToken, async (req, res) => {
  try {
    // Get user's wallet address
    const userId = req.user.id;
    const walletQuery = await pool.query(
      'SELECT address FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (!walletQuery.rows || walletQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found for user' });
    }
    
    const walletAddress = walletQuery.rows[0].address;
    
    // Force recalculation by passing forceRefresh flag
    const scoreData = await aiService.getCreditScore(walletAddress, { forceRefresh: true });
    
    console.log(`[SERVER DEBUG] /api/credit/score/recompute result for ${userId} (${walletAddress}):`, JSON.stringify(scoreData));
    
    res.json({
      success: true,
      score: scoreData.score,
      timestamp: new Date().toISOString(),
      factors: scoreData.factors,
      confidence: scoreData.confidence
    });
  } catch (e) {
    console.error('Error recomputing credit score:', e?.message || e);
    res.status(500).json({ error: 'Failed to recompute credit score' });
  }
});

// Manual credit score trigger (for testing)
app.post('/api/ai/trigger-score-update', authenticateToken, async (req, res) => {
  try {
    const { userAddress } = req.body || {};
    
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress is required' });
    }

    // Calculate score
    const scoreData = await aiService.getCreditScore(userAddress);
    
    // TODO: Call CreditProtocol.updateScore() once deployed
    // const creditContract = new ethers.Contract(CREDIT_PROTOCOL_ADDRESS, CREDIT_PROTOCOL_ABI, adminSigner);
    // await creditContract.updateScore(userAddress, scoreData.score, scoreData.source);
    
    console.log(`Credit score updated for ${userAddress}:`, scoreData);
    
    res.json({
      success: true,
      message: 'Credit score updated successfully',
      userAddress,
      scoreData
    });
  } catch (e) {
    console.error('Manual score update error:', e?.message || e);
    res.status(500).json({ error: 'Failed to update credit score' });
  }
});

// Enhanced AI endpoints
app.post('/api/ai/batch-credit-scores', authenticateToken, async (req, res) => {
  try {
    const { userAddresses, additionalData } = req.body || {};
    
    if (!userAddresses || !Array.isArray(userAddresses)) {
      return res.status(400).json({ error: 'userAddresses array is required' });
    }

    if (userAddresses.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 addresses per batch' });
    }

    const results = await aiService.getBatchCreditScores(userAddresses, additionalData);
    
    res.json({
      success: true,
      results: results,
      count: results.length,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('Batch credit score error:', e?.message || e);
    res.status(500).json({ error: 'Failed to calculate batch credit scores' });
  }
});

app.post('/api/ai/predict-score', authenticateToken, async (req, res) => {
  try {
    const { userAddress, scenario } = req.body || {};
    
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress is required' });
    }

    if (!scenario) {
      return res.status(400).json({ error: 'scenario is required' });
    }

    const prediction = await aiService.predictCreditScore(userAddress, { scenario });
    
    res.json({
      success: true,
      prediction: prediction,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('Score prediction error:', e?.message || e);
    res.status(500).json({ error: 'Failed to predict credit score' });
  }
});

app.get('/api/ai/score-factors', authenticateToken, async (req, res) => {
  try {
    const { userAddress } = req.query;
    
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress is required' });
    }

    const scoreData = await aiService.getCreditScore(userAddress);
    
    res.json({
      success: true,
      factors: scoreData.factors,
      weights: scoreData.weights,
      riskAssessment: scoreData.riskAssessment,
      metadata: scoreData.metadata,
      timestamp: scoreData.timestamp
    });
  } catch (e) {
    console.error('Score factors error:', e?.message || e);
    res.status(500).json({ error: 'Failed to get score factors' });
  }
});

app.get('/api/ai/health', async (req, res) => {
  try {
    // Test AI service with a dummy address
    const testAddress = '0x0000000000000000000000000000000000000000';
    const startTime = Date.now();
    
    const scoreData = await aiService.getCreditScore(testAddress);
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      status: 'healthy',
      version: scoreData.metadata?.algorithmVersion || 'unknown',
      processingTime: processingTime,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('AI health check error:', e?.message || e);
    res.status(500).json({ 
      success: false,
      status: 'unhealthy',
      error: 'AI service not responding'
    });
  }
});

// QR Code and Batch Management endpoints
const QRCodeService = require('./services/qrCodeService');
const qrService = new QRCodeService();

// Generate QR code for batch
app.post('/api/qr/generate-batch', authenticateToken, apiLimits.qrGeneration, async (req, res) => {
  try {
    const { batchData } = req.body;
    
    if (!batchData) {
      return res.status(400).json({ error: 'batchData is required' });
    }

    const qrResult = await qrService.generateBatchQR(batchData);
    
    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      hash: qrResult.hash,
      url: qrResult.url,
      payload: qrResult.payload
    });
  } catch (e) {
    console.error('QR generation error:', e?.message || e);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR code for product
app.post('/api/qr/generate-product', authenticateToken, async (req, res) => {
  try {
    const { productData } = req.body;
    
    if (!productData) {
      return res.status(400).json({ error: 'productData is required' });
    }

    const qrResult = await qrService.generateProductQR(productData);
    
    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      hash: qrResult.hash,
      url: qrResult.url,
      payload: qrResult.payload
    });
  } catch (e) {
    console.error('Product QR generation error:', e?.message || e);
    res.status(500).json({ error: 'Failed to generate product QR code' });
  }
});

// Generate QR code for farmer
app.post('/api/qr/generate-farmer', authenticateToken, async (req, res) => {
  try {
    const { farmerData } = req.body;
    
    if (!farmerData) {
      return res.status(400).json({ error: 'farmerData is required' });
    }

    const qrResult = await qrService.generateFarmerQR(farmerData);
    
    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      hash: qrResult.hash,
      url: qrResult.url,
      payload: qrResult.payload
    });
  } catch (e) {
    console.error('Farmer QR generation error:', e?.message || e);
    res.status(500).json({ error: 'Failed to generate farmer QR code' });
  }
});

// Parse QR code data
app.post('/api/qr/parse', async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ error: 'qrData is required' });
    }

    const parseResult = qrService.parseQRData(qrData);
    
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error });
    }
    
    res.json({
      success: true,
      data: parseResult.data,
      type: parseResult.type,
      hash: parseResult.hash,
      url: parseResult.url
    });
  } catch (e) {
    console.error('QR parsing error:', e?.message || e);
    res.status(500).json({ error: 'Failed to parse QR code' });
  }
});

// Batch Management endpoints
app.post('/api/batch/create', authenticateToken, apiLimits.batchCreation, async (req, res) => {
  try {
    const { 
      productType, 
      grade, 
      quantity, 
      pricePerUnit, 
      certifications, 
      photos, 
      logs,
      farmerAddress 
    } = req.body;
    
    if (!productType || !grade || !quantity || !pricePerUnit || !farmerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate QR code for the batch
    const batchData = {
      farmer: farmerAddress,
      productType,
      grade,
      quantity,
      timestamp: Date.now()
    };
    
    const qrResult = await qrService.generateBatchQR(batchData);
    
    // Store batch data (in production, this would be stored in database)
    const batchInfo = {
      batchId: Date.now(), // In production, use proper ID generation
      farmer: farmerAddress,
      productType,
      grade,
      quantity,
      pricePerUnit,
      certifications: certifications || '',
      photos: photos || '',
      logs: logs || '',
      qrHash: qrResult.hash,
      qrCode: qrResult.qrCode,
      traceabilityUrl: qrResult.url,
      createdAt: new Date().toISOString(),
      isVerified: false,
      isSold: false
    };
    
    res.json({
      success: true,
      batch: batchInfo,
      qrCode: qrResult.qrCode,
      traceabilityUrl: qrResult.url
    });
  } catch (e) {
    console.error('Batch creation error:', e?.message || e);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Get batch traceability information
app.get('/api/batch/traceability/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' });
    }

    // In production, fetch from database using hash
    // For now, return mock data
    const traceabilityData = {
      hash,
      batchId: Date.now(),
      farmer: {
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Farmer',
        location: 'California, USA',
        certifications: ['Organic', 'Fair Trade']
      },
      product: {
        type: 'Organic Tomatoes',
        grade: 'Premium',
        quantity: 1000,
        harvestDate: '2024-01-15',
        location: 'Farm A, California'
      },
      certifications: {
        organic: true,
        fairTrade: true,
        gmoFree: true,
        certificates: ['USDA Organic', 'Fair Trade Certified']
      },
      photos: [
        'ipfs://QmHash1/photo1.jpg',
        'ipfs://QmHash2/photo2.jpg'
      ],
      logs: [
        {
          date: '2024-01-01',
          action: 'Seeding',
          details: 'Seeds planted in greenhouse'
        },
        {
          date: '2024-01-15',
          action: 'Harvest',
          details: 'Tomatoes harvested and sorted'
        }
      ],
      verification: {
        isVerified: true,
        verifiedBy: 'AgriFinance DAO',
        verifiedAt: '2024-01-16T10:00:00Z'
      },
      sale: {
        isSold: false,
        buyer: null,
        soldAt: null
      }
    };
    
    res.json({
      success: true,
      traceability: traceabilityData
    });
  } catch (e) {
    console.error('Traceability error:', e?.message || e);
    res.status(500).json({ error: 'Failed to get traceability data' });
  }
});

// Verify batch (admin/DAO only) - updated to update database
app.post('/api/batch/verify/:batchId', authenticateToken, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { verifierAddress, verifierRole } = req.body;
    
    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID is required' });
    }

    // Update the batch verification status in database
    const updateResult = await pool.query(`
      UPDATE batches 
      SET 
        is_verified = true,
        verified_at = NOW(),
        verifier_address = $1
      WHERE batch_id = $2
      RETURNING batch_id, farmer_name, product_type, product_grade
    `, [verifierAddress || req.user?.address, parseInt(batchId)]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = updateResult.rows[0];
    
    res.json({
      success: true,
      message: 'Batch verified successfully',
      batchId: batchId,
      batch: {
        batchId: batch.batch_id,
        farmerName: batch.farmer_name,
        productType: batch.product_type,
        productGrade: batch.product_grade
      },
      verifier: verifierAddress || req.user?.address,
      verifiedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Batch verification error:', e?.message || e);
    res.status(500).json({ error: 'Failed to verify batch' });
  }
});

// Get all batches for a farmer
app.get('/api/batch/farmer/:farmerAddress', async (req, res) => {
  try {
    const { farmerAddress } = req.params;
    
    if (!farmerAddress) {
      return res.status(400).json({ error: 'Farmer address is required' });
    }

    // In production, fetch from database
    // For now, return mock data
    const batches = [
      {
        batchId: 1,
        productType: 'Organic Tomatoes',
        grade: 'Premium',
        quantity: 1000,
        pricePerUnit: 3.0, // Standardized Premium price
        qrHash: 'abc123def456',
        isVerified: true,
        isSold: false,
        createdAt: '2024-01-15T10:00:00Z'
      },
      {
        batchId: 2,
        productType: 'Organic Lettuce',
        grade: 'Standard',
        quantity: 500,
        pricePerUnit: 2.0, // Standardized Standard price
        qrHash: 'def456ghi789',
        isVerified: false,
        isSold: false,
        createdAt: '2024-01-16T14:30:00Z'
      }
    ];
    
    res.json({
      success: true,
      batches: batches,
      count: batches.length
    });
  } catch (e) {
    console.error('Farmer batches error:', e?.message || e);
    res.status(500).json({ error: 'Failed to get farmer batches' });
  }
});

// Get marketplace products (now using enhanced supply_chain_batches)
app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const { page = 1, limit = 20, productType, grade } = req.query;
    
    let query = `
      SELECT 
        scb.*,
        u.first_name,
        u.last_name,
        u.email
      FROM supply_chain_batches scb
      LEFT JOIN users u ON scb.farmer_id = u.id
      WHERE scb.marketplace_status = 'active' AND scb.status = 'verified'
    `;
    
    const queryParams = [];
    let paramCount = 0;
    
    // Add filters
    if (productType && productType !== 'All Products') {
      paramCount++;
      query += ` AND scb.product_type = $${paramCount}`;
      queryParams.push(productType);
    }
    
    if (grade && grade !== 'All Grades') {
      paramCount++;
      query += ` AND scb.grade = $${paramCount}`;
      queryParams.push(grade);
    }
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    paramCount++;
    query += ` ORDER BY scb.created_at DESC LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(offset);
    
    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM supply_chain_batches scb
      WHERE scb.marketplace_status = 'active' AND scb.status = 'verified'
    `;
    
    const countParams = [];
    let countParamCount = 0;
    
    if (productType && productType !== 'All Products') {
      countParamCount++;
      countQuery += ` AND scb.product_type = $${countParamCount}`;
      countParams.push(productType);
    }
    
    if (grade && grade !== 'All Grades') {
      countParamCount++;
      countQuery += ` AND scb.grade = $${countParamCount}`;
      countParams.push(grade);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      listings: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Marketplace listings error:', error);
    res.status(500).json({ error: 'Failed to get marketplace listings' });
  }
});

// Pricing standardization function
function getStandardizedPrice(grade) {
  const pricingTiers = {
    'Premium': 3.0,    // Premium products: 3.0 KRSI
    'A+': 2.8,         // A+ grade: 2.8 KRSI  
    'Export': 2.5,     // Export grade: 2.5 KRSI
    'Standard': 2.0,   // Standard products: 2.0 KRSI
    'A': 1.8,         // A grade: 1.8 KRSI
    'Basic': 1.5       // Basic products: 1.5 KRSI
  };
  
  return pricingTiers[grade] || 2.0; // Default to Standard price if grade not found
}

// Get marketplace batches (verified and available for sale) - updated to fetch from database
app.get('/api/batch/marketplace', async (req, res) => {
  try {
    const { page = 1, limit = 20, productType, grade } = req.query;
    
    // Fetch from batches table
    let query = `
      SELECT 
        batch_id as "batchId",
        farmer_address as "farmer.address",
        farmer_name as "farmer.name", 
        farmer_location as "farmer.location",
        farmer_reputation as "farmer.reputation",
        product_type as "product.type",
        product_grade as "product.grade",
        product_quantity as "product.quantity",
        product_price_per_unit as "product.pricePerUnit",
        qr_hash as "qrHash",
        traceability_url as "traceabilityUrl",
        created_at as "createdAt",
        verified_at as "verifiedAt",
        is_verified as "isVerified"
      FROM batches
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;
    
    // Add filters
    if (productType && productType !== 'All Products') {
      paramCount++;
      query += ` AND product_type = $${paramCount}`;
      queryParams.push(productType);
    }
    
    if (grade && grade !== 'All Grades') {
      paramCount++;
      query += ` AND product_grade = $${paramCount}`;
      queryParams.push(grade);
    }
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    paramCount++;
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(offset);
    
    const result = await pool.query(query, queryParams);
    
    // Transform to match expected format
    const batches = result.rows.map(row => ({
      batchId: row.batchId,
      farmer: {
        address: row.farmer.address,
        name: row.farmer.name,
        location: row.farmer.location,
        reputation: row.farmer.reputation
      },
      product: {
        type: row.product.type,
        grade: row.product.grade,
        quantity: row.product.quantity,
        pricePerUnit: getStandardizedPrice(row.product.grade) // Use standardized pricing
      },
      qrHash: row.qrHash,
      traceabilityUrl: row.traceabilityUrl,
      createdAt: row.createdAt,
      verifiedAt: row.verifiedAt,
      isVerified: row.isVerified
    }));
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM batches
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 0;
    
    if (productType && productType !== 'All Products') {
      countParamCount++;
      countQuery += ` AND product_type = $${countParamCount}`;
      countParams.push(productType);
    }
    
    if (grade && grade !== 'All Grades') {
      countParamCount++;
      countQuery += ` AND product_grade = $${countParamCount}`;
      countParams.push(grade);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      batches: batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Marketplace batches error:', error);
    res.status(500).json({ error: 'Failed to get marketplace batches' });
  }
});

// ==================== ZK PROOF INTEGRATION ENDPOINTS ====================

// Generate ZK proof for land document verification
app.post('/api/zk/generate-proof', authenticateToken, apiLimits.zkProofGeneration, async (req, res) => {
  try {
    const { landDocument, privateInputs, metadata } = req.body;
    
    if (!landDocument || !privateInputs) {
      return res.status(400).json({ 
        success: false, 
        error: 'Land document and private inputs are required' 
      });
    }

    const result = await zkIntegrationService.generateMockProof(
      landDocument,
      privateInputs
    );

    res.json(result);
  } catch (error) {
    console.error('ZK proof generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate ZK proof' 
    });
  }
});

// Verify ZK proof on-chain
app.post('/api/zk/verify-proof', authenticateToken, async (req, res) => {
  try {
    const { proof, publicSignals, commitment } = req.body;
    
    if (!proof || !publicSignals || !commitment) {
      return res.status(400).json({ 
        success: false, 
        error: 'Proof, public signals, and commitment are required' 
      });
    }

    const result = await zkIntegrationService.verifyProofOnChain(
      proof,
      publicSignals,
      commitment
    );

    res.json(result);
  } catch (error) {
    console.error('ZK proof verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify ZK proof' 
    });
  }
});

// Link ZK proof to LandNFT
app.post('/api/zk/link-to-landnft', authenticateToken, async (req, res) => {
  try {
    const { tokenId, proofResult } = req.body;
    
    if (!tokenId || !proofResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID and proof result are required' 
      });
    }

    const result = await zkIntegrationService.linkProofToLandNFT(
      tokenId,
      proofResult
    );

    res.json(result);
  } catch (error) {
    console.error('ZK proof linking error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to link ZK proof to LandNFT' 
    });
  }
});

// Check land ZK verification status
app.get('/api/zk/land-verification/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }

    const result = await zkIntegrationService.checkLandZKVerification(tokenId);

    res.json(result);
  } catch (error) {
    console.error('ZK verification check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check ZK verification status' 
    });
  }
});

// Retrieve proof from IPFS
app.get('/api/zk/retrieve-proof/:cid', authenticateToken, async (req, res) => {
  try {
    const { cid } = req.params;
    
    if (!cid) {
      return res.status(400).json({ 
        success: false, 
        error: 'IPFS CID is required' 
      });
    }

    const result = await zkIntegrationService.retrieveAndVerifyProof(cid);

    res.json(result);
  } catch (error) {
    console.error('Proof retrieval error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve proof from IPFS' 
    });
  }
});

// Generate sample data for testing
app.get('/api/zk/sample-data', authenticateToken, async (req, res) => {
  try {
    const result = await zkIntegrationService.generateSampleData();
    res.json(result);
  } catch (error) {
    console.error('Sample data generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate sample data' 
    });
  }
});

// Get ZK system status
app.get('/api/zk/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'operational',
      services: {
        proverService: 'active',
        ipfsStorage: 'active',
        onChainVerification: 'active'
      },
      contracts: {
        zkVerifier: process.env.ZK_VERIFIER_ADDRESS || 'not deployed',
        landNFT: process.env.LAND_NFT_ADDRESS || 'not deployed'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('ZK status check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get ZK system status' 
    });
  }
});

// Health check endpoint
app.get('/api/health', healthCheck);

// Chain info endpoint (Phase 5)
app.get('/api/chain/info', async (req, res) => {
  try {
    res.json({
      network: process.env.NETWORK || 'sepolia',
      l2Enabled: process.env.L2_ENABLED === 'true',
      rpc: {
        sepolia: process.env.RPC_SEPOLIA || 'https://ethereum-sepolia.publicnode.com',
        polygon: process.env.RPC_POLYGON || 'https://polygon-rpc.com',
        amoy: process.env.RPC_AMOY || 'https://polygon-amoy.publicnode.com'
      },
      contracts: {
        krsi: process.env.KRSI_CONTRACT_ADDRESS || 'not set'
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get chain info' });
  }
});

// Phase 9: On-chain escrow indexer scan (admin only)
app.post('/api/indexer/scan', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { fromBlock, toBlock } = req.body || {};
    const result = await scanEscrow(pool, { fromBlock, toBlock });
    return res.json(result);
  } catch (e) {
    console.error('Indexer scan error:', e.message);
    return res.status(500).json({ error: 'Indexer scan failed' });
  }
});

// Admin: scan LoanVault events and sync to database
app.post('/api/indexer/scan-loanvault', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { fromBlock, toBlock } = req.body || {};
    console.log('📊 Starting LoanVault indexer scan...');
    const result = await scanLoanVault(pool, { fromBlock, toBlock });
    console.log(`✅ LoanVault scan complete: ${result.inserted} events indexed, ${result.synced} synced to database`);
    return res.json(result);
  } catch (e) {
    console.error('LoanVault indexer scan error:', e.message);
    return res.status(500).json({ error: 'LoanVault indexer scan failed', details: e.message });
  }
});

// Admin: get indexer status and recent events
app.get('/api/indexer/status', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdminRequest(req))) return res.status(403).json({ error: 'admin only' });
    await ensureIndexerTables(pool);
    const escrowCursor = await pool.query('SELECT value FROM indexer_state WHERE name=$1', ['escrow_last_block']);
    const loanVaultCursor = await pool.query('SELECT value FROM indexer_state WHERE name=$1', ['loanvault_last_block']);
    const escrowLastBlock = escrowCursor.rows[0]?.value ? Number(escrowCursor.rows[0].value) : null;
    const loanVaultLastBlock = loanVaultCursor.rows[0]?.value ? Number(loanVaultCursor.rows[0].value) : null;
    const events = await pool.query('SELECT * FROM blockchain_events ORDER BY id DESC LIMIT 25');
    res.json({ 
      escrow: { lastBlock: escrowLastBlock },
      loanVault: { lastBlock: loanVaultLastBlock },
      events: events.rows 
    });
  } catch (e) {
    res.json({ 
      escrow: { lastBlock: null },
      loanVault: { lastBlock: null },
      events: [] 
    });
  }
});

// ==================== PHASE 8: ORACLE & PRICE-GUARD RAILS ====================

// Ensure borrowing_pause table exists
async function ensureBorrowingPauseTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS borrowing_pause (
      id SERIAL PRIMARY KEY,
      is_paused BOOLEAN DEFAULT false,
      reason TEXT,
      paused_by TEXT,
      paused_at TIMESTAMP DEFAULT NOW(),
      volatility_threshold DECIMAL(10,2) DEFAULT 50.0,
      current_volatility DECIMAL(10,2),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Ensure single row
  const exists = await pool.query('SELECT id FROM borrowing_pause LIMIT 1');
  if (exists.rows.length === 0) {
    await pool.query('INSERT INTO borrowing_pause (is_paused) VALUES (false)');
  }
}

// Get KRSI price and volatility (public)
app.get('/api/oracle/price', async (req, res) => {
  try {
    const priceData = await oracleService.getKRSIPrice();
    res.json({ success: true, ...priceData });
  } catch (error) {
    console.error('Oracle price error:', error);
    res.json({ success: false, price: 0, volatility: 0, isValid: false });
  }
});

// Get ETH price (public)
app.get('/api/oracle/eth-price', async (req, res) => {
  try {
    const ethPrice = await oracleService.getETHPrice();
    if (ethPrice) {
      res.json({ success: true, ...ethPrice });
    } else {
      res.json({ success: false, price: 0, isValid: false });
    }
  } catch (error) {
    console.error('ETH price error:', error);
    res.json({ success: false, price: 0, isValid: false });
  }
});

// Admin: Get borrowing status and price metrics
app.get('/api/admin/borrowing-status', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdminRequest(req))) return res.status(403).json({ error: 'Admin only' });
    
    await ensureBorrowingPauseTable();
    const [pauseStatus, krsiPrice, ethPrice] = await Promise.all([
      pool.query('SELECT * FROM borrowing_pause ORDER BY id DESC LIMIT 1'),
      oracleService.getKRSIPrice(),
      oracleService.getETHPrice()
    ]);

    const pause = pauseStatus.rows[0] || { is_paused: false, volatility_threshold: 50.0 };
    
    // Update current volatility if we have price data
    if (krsiPrice && krsiPrice.isValid) {
      await pool.query(
        'UPDATE borrowing_pause SET current_volatility = $1, updated_at = NOW() WHERE id = $2',
        [krsiPrice.volatility || 0, pause.id]
      );
      pause.current_volatility = krsiPrice.volatility || 0;
    }

    res.json({
      success: true,
      borrowing: {
        isPaused: pause.is_paused || false,
        reason: pause.reason || null,
        pausedBy: pause.paused_by || null,
        pausedAt: pause.paused_at || null,
        volatilityThreshold: Number(pause.volatility_threshold || 50.0),
        currentVolatility: Number(pause.current_volatility || 0),
        shouldPause: Number(pause.current_volatility || 0) >= Number(pause.volatility_threshold || 50.0)
      },
      prices: {
        krsi: krsiPrice || { price: 0, volatility: 0, isValid: false },
        eth: ethPrice || { price: 0, isValid: false }
      }
    });
  } catch (error) {
    console.error('Borrowing status error:', error);
    res.status(500).json({ error: 'Failed to get borrowing status' });
  }
});

// Admin: Pause/unpause borrowing
app.post('/api/admin/pause-borrowing', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdminRequest(req))) return res.status(403).json({ error: 'Admin only' });
    
    const { isPaused, reason, volatilityThreshold } = req.body;
    await ensureBorrowingPauseTable();

    const pause = await pool.query('SELECT id FROM borrowing_pause ORDER BY id DESC LIMIT 1');
    const pauseId = pause.rows[0]?.id || 1;

    await pool.query(
      `UPDATE borrowing_pause 
       SET is_paused = $1, reason = $2, paused_by = $3, paused_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           volatility_threshold = COALESCE($4, volatility_threshold), updated_at = NOW()
       WHERE id = $5`,
      [isPaused || false, reason || null, req.user.email || req.user.id, volatilityThreshold, pauseId]
    );

    res.json({ success: true, isPaused: isPaused || false });
  } catch (error) {
    console.error('Pause borrowing error:', error);
    res.status(500).json({ error: 'Failed to update borrowing status' });
  }
});

// Check borrowing pause before loan creation
async function checkBorrowingPause() {
  try {
    await ensureBorrowingPauseTable();
    const result = await pool.query('SELECT is_paused, reason FROM borrowing_pause ORDER BY id DESC LIMIT 1');
    const pause = result.rows[0];
    if (pause && pause.is_paused) {
      return { paused: true, reason: pause.reason || 'Borrowing is temporarily paused' };
    }
    return { paused: false };
  } catch {
    return { paused: false };
  }
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    // ===== Phase 4: Simple DAO APIs (DB-backed, chain-ready) =====
    // Create proposal
    app.post('/api/dao/proposals', authenticateToken, async (req, res) => {
      try {
        const { title, description, actions } = req.body || {};
        if (!title) return res.status(400).json({ error: 'title is required' });
        const minTokens = BigInt(process.env.DAO_PROPOSE_THRESHOLD_WEI || '1000000'); // 1 KRSI default
        // Check voting power via token balance
        let canPropose = true;
        try {
          const w = await pool.query('SELECT address FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
          if (w.rows.length > 0) {
            const bal = await blockchainService.getBalance(w.rows[0].address);
            if (BigInt(bal) < minTokens) canPropose = false;
          }
        } catch (e) {
          // If read-only, allow proposals in DB (testnet)
        }
        if (!canPropose) {
          return res.status(403).json({ error: 'Insufficient voting power to propose' });
        }
        const result = await pool.query(
          `INSERT INTO governance_proposals (proposer_id, title, description, actions, status, created_at)
           VALUES ($1, $2, $3, $4, 'active', NOW()) RETURNING *`,
          [req.user.id, title, description || '', JSON.stringify(actions || [])]
        );
        res.json({ success: true, proposal: result.rows[0] });
      } catch (e) {
        console.error('Create proposal error:', e.message);
        res.status(500).json({ error: 'Failed to create proposal' });
      }
    });

    // ===== Phase 5: Bridge stubs (placeholders for L2 readiness) =====
    app.post('/api/bridge/krsi/deposit', authenticateToken, async (req, res) => {
      try {
        if (process.env.L2_ENABLED !== 'true') return res.status(400).json({ error: 'L2 not enabled' });
        const { amountWei } = req.body || {};
        if (!amountWei) return res.status(400).json({ error: 'amountWei required' });
        // Placeholder: record intent; execution can be wired to bridge SDK later
        res.json({ success: true, status: 'queued', amountWei });
      } catch (e) {
        res.status(500).json({ error: 'Bridge deposit failed' });
      }
    });
    
    app.post('/api/bridge/krsi/withdraw', authenticateToken, async (req, res) => {
      try {
        if (process.env.L2_ENABLED !== 'true') return res.status(400).json({ error: 'L2 not enabled' });
        const { amountWei } = req.body || {};
        if (!amountWei) return res.status(400).json({ error: 'amountWei required' });
        res.json({ success: true, status: 'queued', amountWei });
      } catch (e) {
        res.status(500).json({ error: 'Bridge withdraw failed' });
      }
    });

    // List proposals
    app.get('/api/dao/proposals', authenticateToken, async (req, res) => {
      try {
        const rows = await pool.query(`SELECT * FROM governance_proposals ORDER BY created_at DESC LIMIT 100`);
        res.json({ proposals: rows.rows });
      } catch (e) {
        console.error('List proposals error:', e.message);
        res.status(500).json({ error: 'Failed to list proposals' });
      }
    });

    // Vote on proposal
    app.post('/api/dao/proposals/:id/vote', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { support } = req.body || {};
        if (typeof support !== 'boolean') return res.status(400).json({ error: 'support boolean required' });
        const prop = await pool.query('SELECT * FROM governance_proposals WHERE id = $1', [id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
        if (prop.rows[0].status !== 'active') return res.status(400).json({ error: 'Proposal not active' });
        const existing = await pool.query('SELECT * FROM governance_votes WHERE proposal_id = $1 AND voter_id = $2', [id, req.user.id]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Already voted' });

        // Weight = on-chain balance (best-effort), else 1
        let weight = 1n;
        try {
          const w = await pool.query('SELECT address FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
          if (w.rows.length > 0) {
            const bal = await blockchainService.getBalance(w.rows[0].address);
            weight = BigInt(bal);
          }
        } catch {}

        await pool.query(
          `INSERT INTO governance_votes (proposal_id, voter_id, support, weight, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [id, req.user.id, support, weight.toString()]
        );

        // Update tallies
        if (support) {
          await pool.query('UPDATE governance_proposals SET votes_for = COALESCE(votes_for,0) + $1 WHERE id = $2', [weight.toString(), id]);
        } else {
          await pool.query('UPDATE governance_proposals SET votes_against = COALESCE(votes_against,0) + $1 WHERE id = $2', [weight.toString(), id]);
        }
        res.json({ success: true });
      } catch (e) {
        console.error('Vote error:', e.message);
        res.status(500).json({ error: 'Failed to vote' });
      }
    });

    // Execute proposal (DB-side marker; chain execution can be wired later)
    app.post('/api/dao/proposals/:id/execute', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        const prop = await pool.query('SELECT * FROM governance_proposals WHERE id = $1', [id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
        if (prop.rows[0].status !== 'active') return res.status(400).json({ error: 'Proposal not active' });
        // Simple rule: majority of votes_for over votes_against
        const forW = BigInt(prop.rows[0].votes_for || '0');
        const againstW = BigInt(prop.rows[0].votes_against || '0');
        if (forW <= againstW) return res.status(400).json({ error: 'Proposal did not pass' });
        await pool.query('UPDATE governance_proposals SET status = $1, executed_at = NOW() WHERE id = $2', ['executed', id]);
        res.json({ success: true });
      } catch (e) {
        console.error('Execute proposal error:', e.message);
        res.status(500).json({ error: 'Failed to execute proposal' });
      }
    });
    // Sync database balance to on-chain (mint tokens if needed)
    app.post('/api/wallet/sync-to-blockchain', authenticateToken, async (req, res) => {
      try {
        const network = process.env.NETWORK || 'sepolia';
        if (network === 'mainnet') {
          return res.status(403).json({ error: 'Auto-sync is disabled on mainnet' });
        }

        // Get user wallet
        const w = await pool.query('SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
        if (w.rows.length === 0) return res.status(404).json({ error: 'Wallet not found' });
        const wallet = w.rows[0];

        const dbBalanceWei = BigInt(wallet.balance_wei || '0');
        
        // Get on-chain balance
        let onChainBalanceWei = 0n;
        try {
          const onChainBalance = await blockchainService.getBlockchainBalance(wallet.address);
          if (onChainBalance.success) {
            onChainBalanceWei = BigInt(onChainBalance.balance || '0');
          }
        } catch (e) {
          console.warn('Could not get on-chain balance:', e.message);
        }

        // Calculate difference
        const differenceWei = dbBalanceWei - onChainBalanceWei;
        
        if (differenceWei <= 0n) {
          return res.json({ 
            success: true, 
            message: 'Balance already synced',
            dbBalance: dbBalanceWei.toString(),
            onChainBalance: onChainBalanceWei.toString(),
            synced: true
          });
        }

        console.log(`🔄 Syncing balance: DB=${dbBalanceWei.toString()}, On-chain=${onChainBalanceWei.toString()}, Need to mint=${differenceWei.toString()}`);

        // Mint the difference to sync balances
        try {
          const txHash = await blockchainService.mintTokens(wallet.address, differenceWei.toString());
          
          console.log(`✅ Minted ${differenceWei.toString()} tokens to ${wallet.address}, tx: ${txHash}`);
          
          return res.json({ 
            success: true, 
            txHash,
            mintedAmount: differenceWei.toString(),
            dbBalance: dbBalanceWei.toString(),
            onChainBalance: (onChainBalanceWei + differenceWei).toString(),
            message: `Synced ${(Number(differenceWei) / 1_000_000).toFixed(2)} KRSI to blockchain`
          });
        } catch (e) {
          console.error('Mint error:', e.message);
          return res.status(400).json({ 
            error: e.message || 'Failed to sync balance to blockchain',
            details: 'Backend may not have MINTER_ROLE. Contact admin to sync tokens.'
          });
        }
      } catch (e) {
        console.error('Sync to blockchain error:', e.message);
        res.status(500).json({ error: 'Failed to sync balance to blockchain' });
      }
    });

    // Test LoanVault deposit (for debugging - tests if contract works)
    app.post('/api/test/loanvault-deposit', authenticateToken, async (req, res) => {
      try {
        const { userAddress } = req.body;
        const network = process.env.NETWORK || 'sepolia';
        
        if (network === 'mainnet') {
          return res.status(403).json({ error: 'Test endpoint disabled on mainnet' });
        }

        // Load contract addresses
        const fs = require('fs');
        const path = require('path');
        const depPath = path.join(__dirname, '..', 'deployments', `${network}.json`);
        const deployments = fs.existsSync(depPath) 
          ? JSON.parse(fs.readFileSync(depPath, 'utf8'))
          : {};
        
        const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
        const krishiTokenAddress = deployments.KrishiToken || process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
        
        const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
        const backendWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`🧪 Testing LoanVault deposit from backend`);
        console.log(`   LoanVault: ${loanVaultAddress}`);
        console.log(`   Backend Wallet: ${backendWallet.address}`);
        console.log(`   User Address (reference): ${userAddress || 'N/A'}`);
        
        // Get contracts
        const krishiTokenABI = [
          'function balanceOf(address) view returns (uint256)',
          'function approve(address, uint256) returns (bool)',
          'function decimals() view returns (uint8)'
        ];
        const loanVaultABI = [
          'function depositLiquidity(uint256)',
          'function totalLiquidity() view returns (uint256)',
          'function lenders(address) view returns (address, uint256, uint256, uint256, uint256, bool)'
        ];
        
        const krishiToken = new ethers.Contract(krishiTokenAddress, krishiTokenABI, backendWallet);
        const loanVault = new ethers.Contract(loanVaultAddress, loanVaultABI, backendWallet);
        
        // Check backend wallet balance
        // IMPORTANT: Use 6 decimals (hardcoded) because contract reports 18 but tokens use 6
        const decimals = 6; // Hardcoded to match actual token storage format
        const backendBalance = await krishiToken.balanceOf(backendWallet.address);
        const depositAmount = ethers.utils.parseUnits('10', decimals);
        
        console.log(`   Backend balance: ${ethers.utils.formatUnits(backendBalance, decimals)} KRSI`);
        console.log(`   Test deposit amount: ${ethers.utils.formatUnits(depositAmount, decimals)} KRSI`);
        
        if (backendBalance.lt(depositAmount)) {
          // Check if backend has MINTER_ROLE to mint tokens
          const MINTER_ROLE = await krishiToken.MINTER_ROLE();
          const hasRole = await krishiToken.hasRole(MINTER_ROLE, backendWallet.address);
          
          if (hasRole) {
            console.log(`   Minting ${ethers.utils.formatUnits(depositAmount, decimals)} KRSI...`);
            const mintTx = await krishiToken.mint(backendWallet.address, depositAmount);
            await mintTx.wait();
            console.log(`   ✅ Minted successfully`);
          } else {
            return res.status(400).json({ 
              error: 'Backend wallet has insufficient tokens',
              backendBalance: ethers.utils.formatUnits(backendBalance, decimals),
              required: ethers.utils.formatUnits(depositAmount, decimals),
              hasMinterRole: false
            });
          }
        }
        
        // Approve LoanVault
        const allowance = await krishiToken.allowance(backendWallet.address, loanVaultAddress);
        if (allowance.lt(depositAmount)) {
          console.log(`   Approving LoanVault...`);
          const approveTx = await krishiToken.approve(loanVaultAddress, ethers.constants.MaxUint256);
          await approveTx.wait();
          console.log(`   ✅ Approved`);
        }
        
        // Try gas estimation
        console.log(`   Estimating gas...`);
        let gasEstimate;
        try {
          gasEstimate = await loanVault.estimateGas.depositLiquidity(depositAmount);
          console.log(`   ✅ Gas estimate: ${gasEstimate.toString()}`);
        } catch (estimateError) {
          console.log(`   ❌ Gas estimation failed: ${estimateError.message}`);
          return res.status(400).json({
            success: false,
            error: 'Gas estimation failed - contract has an issue',
            details: estimateError.message,
            reason: estimateError.reason || 'Unknown',
            contractWorks: false,
            message: 'The deposit function fails during gas estimation. This means the contract code has an issue, not the frontend.'
          });
        }
        
        // Try actual deposit
        console.log(`   Executing deposit transaction...`);
        let txHash, receipt;
        try {
          const depositTx = await loanVault.depositLiquidity(depositAmount);
          txHash = depositTx.hash;
          console.log(`   Transaction hash: ${txHash}`);
          receipt = await depositTx.wait();
          console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
        } catch (txError) {
          console.log(`   ❌ Transaction failed: ${txError.message}`);
          return res.status(400).json({
            success: false,
            error: 'Transaction failed',
            details: txError.message,
            reason: txError.reason || 'Unknown',
            contractWorks: false
          });
        }
        
        // Verify state
        const newTotalLiquidity = await loanVault.totalLiquidity();
        const lenderInfo = await loanVault.lenders(backendWallet.address);
        
        console.log(`   ✅ Deposit successful!`);
        console.log(`   New total liquidity: ${ethers.utils.formatUnits(newTotalLiquidity, decimals)} KRSI`);
        console.log(`   Backend wallet deposited: ${ethers.utils.formatUnits(lenderInfo.totalDeposited, decimals)} KRSI`);
        
        // If user address provided, sync their balance
        let userSyncResult = null;
        if (userAddress) {
          try {
            const userWallet = await pool.query(
              'SELECT * FROM wallet_accounts WHERE address = $1 LIMIT 1',
              [userAddress.toLowerCase()]
            );
            
            if (userWallet.rows.length > 0) {
              const userBalance = await krishiToken.balanceOf(userAddress);
              await pool.query(
                'UPDATE wallet_accounts SET balance_wei = $1, updated_at = NOW() WHERE address = $2',
                [userBalance.toString(), userAddress.toLowerCase()]
              );
              userSyncResult = {
                synced: true,
                newBalance: ethers.utils.formatUnits(userBalance, decimals)
              };
            }
          } catch (syncError) {
            console.warn('Could not sync user balance:', syncError.message);
          }
        }
        
        res.json({
          success: true,
          contractWorks: true,
          message: 'Deposit successful - contract works correctly!',
          transaction: {
            hash: txHash,
            blockNumber: receipt.blockNumber
          },
          state: {
            totalLiquidity: ethers.utils.formatUnits(newTotalLiquidity, decimals),
            backendDeposited: ethers.utils.formatUnits(lenderInfo.totalDeposited, decimals)
          },
          userSync: userSyncResult,
          conclusion: 'The contract works correctly. If frontend still fails, the issue is in frontend code (ABI, connection, or transaction parameters).'
        });
        
      } catch (error) {
        console.error('Test deposit error:', error);
        res.status(500).json({
          error: 'Test failed',
          details: error.message
        });
      }
    });

    // Deposit from specific user address (uses private key from database)
    app.post('/api/test/deposit-from-address', authenticateToken, async (req, res) => {
      try {
        const { userAddress, amountKRSI = 10 } = req.body;
        const network = process.env.NETWORK || 'amoy';
        
        if (network === 'mainnet') {
          return res.status(403).json({ error: 'Test endpoint disabled on mainnet' });
        }

        if (!userAddress) {
          return res.status(400).json({ error: 'userAddress is required' });
        }

        // Load contract addresses
        const fs = require('fs');
        const path = require('path');
        const depPath = path.join(__dirname, '..', 'deployments', `${network}.json`);
        const deployments = fs.existsSync(depPath) 
          ? JSON.parse(fs.readFileSync(depPath, 'utf8'))
          : {};
        
        const loanVaultAddress = deployments.LoanVault || process.env.LOAN_VAULT_ADDRESS || '0xb3c84011492b4126337798E53aE5e483FD2933A8';
        const krishiTokenAddress = deployments.KrishiToken || process.env.KRSI_CONTRACT_ADDRESS || '0x41ef54662509D66715C237c6e1d025DBC6a9D8d1';
        
        const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/';
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        // Get private key from database
        const walletResult = await pool.query(
          'SELECT metadata FROM wallet_accounts WHERE address = $1 LIMIT 1',
          [userAddress.toLowerCase()]
        );
        
        if (walletResult.rows.length === 0) {
          return res.status(404).json({ error: 'Wallet not found in database', userAddress });
        }
        
        const metadata = walletResult.rows[0].metadata;
        if (!metadata || !metadata.private_key) {
          return res.status(400).json({ 
            error: 'Private key not found in wallet metadata',
            hint: 'Wallet exists but private_key is not stored in metadata'
          });
        }
        
        const userWallet = new ethers.Wallet(metadata.private_key, provider);
        
        console.log(`💰 Depositing from user address: ${userAddress}`);
        console.log(`   Wallet from DB: ${userWallet.address}`);
        
        if (userWallet.address.toLowerCase() !== userAddress.toLowerCase()) {
          return res.status(400).json({ 
            error: 'Private key address mismatch',
            expected: userAddress,
            actual: userWallet.address
          });
        }
        
        // Get contracts
        const krishiTokenABI = [
          'function balanceOf(address) view returns (uint256)',
          'function approve(address, uint256) returns (bool)',
          'function allowance(address, address) view returns (uint256)'
        ];
        const loanVaultABI = [
          'function depositLiquidity(uint256)',
          'function totalLiquidity() view returns (uint256)',
          'function lenders(address) view returns (address, uint256, uint256, uint256, uint256, bool)'
        ];
        
        const krishiToken = new ethers.Contract(krishiTokenAddress, krishiTokenABI, userWallet);
        const loanVault = new ethers.Contract(loanVaultAddress, loanVaultABI, userWallet);
        
        const decimals = 6; // Hardcoded - tokens use 6 decimals
        const depositAmount = ethers.utils.parseUnits(amountKRSI.toString(), decimals);
        
        // Check balance
        const balanceBefore = await krishiToken.balanceOf(userAddress);
        const balanceBeforeKRSI = ethers.utils.formatUnits(balanceBefore, decimals);
        
        console.log(`   Balance before: ${balanceBeforeKRSI} KRSI`);
        console.log(`   Deposit amount: ${amountKRSI} KRSI`);
        
        if (balanceBefore.lt(depositAmount)) {
          return res.status(400).json({
            error: 'Insufficient balance',
            balance: balanceBeforeKRSI,
            required: amountKRSI.toString()
          });
        }
        
        // Approve if needed
        const allowance = await krishiToken.allowance(userAddress, loanVaultAddress);
        if (allowance.lt(depositAmount)) {
          console.log(`   Approving LoanVault...`);
          const approveTx = await krishiToken.approve(loanVaultAddress, ethers.constants.MaxUint256);
          await approveTx.wait();
          console.log(`   ✅ Approved`);
        }
        
        // Execute deposit
        console.log(`   Depositing ${amountKRSI} KRSI...`);
        const depositTx = await loanVault.depositLiquidity(depositAmount);
        const receipt = await depositTx.wait();
        console.log(`   ✅ Deposit confirmed in block ${receipt.blockNumber}`);
        
        // Check balance after
        const balanceAfter = await krishiToken.balanceOf(userAddress);
        const balanceAfterKRSI = ethers.utils.formatUnits(balanceAfter, decimals);
        
        // Update database
        await pool.query(
          'UPDATE wallet_accounts SET balance_wei = $1, updated_at = NOW() WHERE address = $2',
          [balanceAfter.toString(), userAddress.toLowerCase()]
        );
        
        // Get LoanVault state
        const totalLiquidity = await loanVault.totalLiquidity();
        const lenderInfo = await loanVault.lenders(userAddress);
        
        res.json({
          success: true,
          message: 'Deposit successful',
          transaction: {
            hash: depositTx.hash,
            blockNumber: receipt.blockNumber
          },
          balance: {
            before: balanceBeforeKRSI,
            after: balanceAfterKRSI,
            expected: (parseFloat(balanceBeforeKRSI) - amountKRSI).toFixed(6)
          },
          loanVault: {
            totalLiquidity: ethers.utils.formatUnits(totalLiquidity, decimals),
            userDeposited: ethers.utils.formatUnits(lenderInfo.totalDeposited, decimals),
            userLpShares: ethers.utils.formatUnits(lenderInfo.lpShares, decimals)
          }
        });
        
      } catch (error) {
        console.error('Deposit from address error:', error);
        res.status(500).json({
          error: 'Deposit failed',
          details: error.message,
          reason: error.reason || 'Unknown'
        });
      }
    });

    // Get available faucet providers
    app.get('/api/faucet/providers', authenticateToken, async (req, res) => {
      try {
        const externalFaucetService = require('./services/externalFaucetService');
        const providers = externalFaucetService.getAvailableProviders();
        
        // Add self-hosted status
        const selfHostedAvailable = faucetService.isSelfHostedFaucetAvailable();
        let faucetBalance = null;
        if (selfHostedAvailable) {
          const balanceCheck = await faucetService.getFaucetBalance();
          if (balanceCheck.success) {
            faucetBalance = {
              balance: balanceCheck.balanceEth,
              address: balanceCheck.address
            };
          }
        }

        res.json({
          providers: [
            {
              id: 'self-hosted',
              name: 'Self-Hosted Faucet',
              enabled: selfHostedAvailable,
              amount: process.env.FAUCET_AMOUNT_ETH || '0.002',
              balance: faucetBalance
            },
            ...providers.map(p => ({
              ...p,
              amount: '0.1' // External faucets typically give 0.1 ETH
            }))
          ]
        });
      } catch (error) {
        console.error('Error getting faucet providers:', error);
        res.status(500).json({ error: 'Failed to get faucet providers' });
      }
    });

    // ===== Faucet Integration: Request Sepolia ETH =====
    app.post('/api/faucet/request', authenticateToken, async (req, res) => {
      try {
        const network = process.env.NETWORK || 'sepolia';
        if (network === 'mainnet') {
          return res.status(403).json({ error: 'Faucet is disabled on mainnet' });
        }

        // Get user's wallet address
        const walletRow = await pool.query(
          'SELECT address FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 LIMIT 1',
          [req.user.id, 'agrifinance']
        );

        if (!walletRow.rows.length || !walletRow.rows[0].address) {
          return res.status(404).json({ error: 'Wallet not found. Please create a wallet first.' });
        }

        const walletAddress = walletRow.rows[0].address;
        const { provider } = req.body || {}; // Optional: preferred provider

        // Check rate limiting (only for self-hosted, external faucets have their own limits)
        if (!provider || provider === 'self-hosted') {
          // TEMPORARY BYPASS FOR TESTING
          // if (!faucetService.canRequest(walletAddress)) {
          //   const timeLeft = faucetService.getTimeUntilNextRequest(walletAddress);
          //   const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
          //   return res.status(429).json({
          //     error: `Rate limit: You can request again in ${hoursLeft} hours`,
          //     timeLeft: timeLeft
          //   });
          // }
        }

        // Request from faucet (with optional provider preference)
        const result = provider && provider !== 'self-hosted'
          ? await faucetService.requestSepoliaETHWithProvider(walletAddress, provider)
          : await faucetService.requestSepoliaETH(walletAddress);

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({
          success: true,
          message: result.message,
          txHash: result.txHash,
          amount: result.amount,
          provider: result.provider,
          walletAddress: walletAddress
        });
      } catch (error) {
        console.error('Faucet request error:', error);
        res.status(500).json({ error: 'Failed to process faucet request' });
      }
    });

    // Check faucet status (rate limit, eligibility)
    app.get('/api/faucet/status', authenticateToken, async (req, res) => {
      try {
        const walletRow = await pool.query(
          'SELECT address FROM wallet_accounts WHERE user_id = $1 AND wallet_type = $2 LIMIT 1',
          [req.user.id, 'agrifinance']
        );

        if (!walletRow.rows.length || !walletRow.rows[0].address) {
          return res.json({
            canRequest: false,
            reason: 'No wallet found'
          });
        }

        const walletAddress = walletRow.rows[0].address;
        const canRequest = faucetService.canRequest(walletAddress);
        const timeLeft = faucetService.getTimeUntilNextRequest(walletAddress);

        // Get faucet balance if self-hosted faucet is available
        let faucetBalance = null;
        if (faucetService.isSelfHostedFaucetAvailable()) {
          const balanceCheck = await faucetService.getFaucetBalance();
          if (balanceCheck.success) {
            faucetBalance = {
              balance: balanceCheck.balanceEth,
              address: balanceCheck.address
            };
          }
        }

        res.json({
          canRequest,
          walletAddress,
          timeUntilNextRequest: timeLeft,
          hoursUntilNextRequest: Math.ceil(timeLeft / (60 * 60 * 1000)),
          selfHostedAvailable: faucetService.isSelfHostedFaucetAvailable(),
          faucetBalance: faucetBalance
        });
      } catch (error) {
        console.error('Faucet status error:', error);
        res.status(500).json({ error: 'Failed to check faucet status' });
      }
    });

    // ===== Phase 3: Sandbox On-Ramp (testnet only) =====
    app.post('/api/onramp/intent', authenticateToken, async (req, res) => {
      try {
        const network = process.env.NETWORK || 'sepolia';
        if (network === 'mainnet') {
          return res.status(403).json({ error: 'On-ramp sandbox is disabled on mainnet' });
        }
        const { amountWei } = req.body || {};
        if (!amountWei) return res.status(400).json({ error: 'amountWei is required' });
        const cap = BigInt(process.env.ONRAMP_CAP_WEI || (100n * 1_000_000n)); // 100 KRSI default cap
        if (BigInt(amountWei) > cap) return res.status(400).json({ error: 'Amount exceeds per-request cap' });

        // Get user wallet
        const w = await pool.query('SELECT * FROM wallet_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
        if (w.rows.length === 0) return res.status(404).json({ error: 'Wallet not found' });
        const wallet = w.rows[0];

        // Mint on-chain (requires PRIVATE_KEY). If read-only, return clear error.
        try {
          const txHash = await blockchainService.mintTokens(wallet.address, amountWei);
          // Update DB balance as well
          const newBal = (BigInt(wallet.balance_wei || '0') + BigInt(amountWei)).toString();
          await pool.query('UPDATE wallet_accounts SET balance_wei = $1 WHERE id = $2', [newBal, wallet.id]);
          return res.json({ success: true, txHash, newBalanceWei: newBal });
        } catch (e) {
          return res.status(400).json({ error: e.message || 'On-ramp failed' });
        }
      } catch (e) {
        console.error('On-ramp intent error:', e.message);
        res.status(500).json({ error: 'Failed to process on-ramp intent' });
      }
    });
    
    // Database migration endpoint
app.post('/api/admin/migrate-database', async (req, res) => {
  try {
    console.log('🔄 Running database migration...');
    
    // Add new columns to existing table
    const migrations = [
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS product_description TEXT',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS unit VARCHAR(20)',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT \'KRSI\'',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS region VARCHAR(100)',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS state VARCHAR(100)',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT \'India\'',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS organic_certified BOOLEAN DEFAULT false',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS images TEXT[]',
      'ALTER TABLE supply_chain_batches ADD COLUMN IF NOT EXISTS marketplace_status VARCHAR(20) DEFAULT \'draft\'',
      'ALTER TABLE supply_chain_batches ALTER COLUMN quantity TYPE DECIMAL(15,2)',
      'ALTER TABLE supply_chain_batches ALTER COLUMN price_per_unit TYPE DECIMAL(15,2)',
      // Fix marketplace_orders table
      'ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES supply_chain_batches(id)',
      'ALTER TABLE marketplace_orders DROP COLUMN IF EXISTS listing_id',
      // Fix transactions table
      'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT \'KRSI\'',
      'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT',
      'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'pending\''
    ];
    
    const results = [];
    
    for (const migration of migrations) {
      try {
        await pool.query(migration);
        results.push(`✅ Applied: ${migration}`);
        console.log(`✅ Applied: ${migration}`);
      } catch (error) {
        results.push(`⚠️  Skipped: ${migration} - ${error.message}`);
        console.log(`⚠️  Skipped: ${migration} - ${error.message}`);
      }
    }
    
    // Update existing records with default values
    try {
      await pool.query(`
        UPDATE supply_chain_batches 
        SET 
          product_name = COALESCE(product_name, product_type),
          unit = COALESCE(unit, 'units'),
          currency = COALESCE(currency, 'KRSI'),
          country = COALESCE(country, 'India'),
          marketplace_status = COALESCE(marketplace_status, 'draft')
        WHERE product_name IS NULL OR unit IS NULL
      `);
      results.push('✅ Updated existing records with default values');
    } catch (error) {
      results.push(`⚠️  Update skipped: ${error.message}`);
    }
    
    res.json({
      success: true,
      message: 'Database migration completed',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// Sample data population endpoint for testing
app.post('/api/admin/populate-sample-batches', async (req, res) => {
  try {
    console.log('🌱 Populating sample batches...');
    
    // Get a farmer user ID
    const userQuery = await pool.query(`
      SELECT id FROM users WHERE role = 'farmer' LIMIT 1
    `);
    
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'No farmer users found. Please create a farmer user first.' });
    }
    
    const farmerId = userQuery.rows[0].id;
    
    // Sample batch data
    const sampleBatches = [
      {
        farmer_id: farmerId,
        product_name: 'Fresh Mangoes - Alphonso',
        product_type: 'crop',
        product_description: 'Premium Alphonso mangoes harvested at peak ripeness. Sweet, juicy, and perfect for direct consumption.',
        grade: 'Premium',
        quantity: 500,
        unit: 'kg',
        price_per_unit: 3.0,
        currency: 'KRSI',
        region: 'Maharashtra',
        state: 'Maharashtra',
        country: 'India',
        certifications: ['Organic', 'Fair Trade'],
        organic_certified: true,
        images: ['mango1.jpg', 'mango2.jpg'],
        qr_hash: 'qr_mango_alphonso_001',
        traceability_url: 'https://agrifinance.com/trace/mango_alphonso_001',
        status: 'verified',
        marketplace_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: farmerId
      },
      {
        farmer_id: farmerId,
        product_name: 'Cotton Bales',
        product_type: 'crop',
        product_description: 'High-quality cotton bales ready for textile processing. Clean, well-ginned cotton.',
        grade: 'A+',
        quantity: 1000,
        unit: 'kg',
        price_per_unit: 2.8,
        currency: 'KRSI',
        region: 'Gujarat',
        state: 'Gujarat',
        country: 'India',
        certifications: ['GOTS', 'Organic'],
        organic_certified: true,
        images: ['cotton1.jpg', 'cotton2.jpg'],
        qr_hash: 'qr_cotton_bales_002',
        traceability_url: 'https://agrifinance.com/trace/cotton_bales_002',
        status: 'verified',
        marketplace_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: farmerId
      },
      {
        farmer_id: farmerId,
        product_name: 'Premium Basmati Rice',
        product_type: 'processed_food',
        product_description: 'Aromatic Basmati rice with long grains and excellent cooking properties.',
        grade: 'Export',
        quantity: 200,
        unit: 'kg',
        price_per_unit: 2.5,
        currency: 'KRSI',
        region: 'Punjab',
        state: 'Punjab',
        country: 'India',
        certifications: ['FSSAI', 'Export Quality'],
        organic_certified: false,
        images: ['rice1.jpg', 'rice2.jpg'],
        qr_hash: 'qr_basmati_rice_003',
        traceability_url: 'https://agrifinance.com/trace/basmati_rice_003',
        status: 'verified',
        marketplace_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: farmerId
      },
      {
        farmer_id: farmerId,
        product_name: 'Organic Turmeric Powder',
        product_type: 'processed_food',
        product_description: 'Pure organic turmeric powder with high curcumin content.',
        grade: 'Standard',
        quantity: 50,
        unit: 'kg',
        price_per_unit: 2.0,
        currency: 'KRSI',
        region: 'Tamil Nadu',
        state: 'Tamil Nadu',
        country: 'India',
        certifications: ['Organic', 'FSSAI'],
        organic_certified: true,
        images: ['turmeric1.jpg', 'turmeric2.jpg'],
        qr_hash: 'qr_turmeric_powder_004',
        traceability_url: 'https://agrifinance.com/trace/turmeric_powder_004',
        status: 'verified',
        marketplace_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: farmerId
      }
    ];
    
    const createdBatches = [];
    
    // Insert sample batches
    for (const batch of sampleBatches) {
      const result = await pool.query(`
        INSERT INTO supply_chain_batches (
          farmer_id, product_name, product_type, product_description, grade,
          quantity, unit, price_per_unit, currency, region, state, country,
          certifications, organic_certified, images, qr_hash, traceability_url,
          status, marketplace_status, verified_at, verified_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING id, product_name
      `, [
        batch.farmer_id, batch.product_name, batch.product_type, batch.product_description, batch.grade,
        batch.quantity, batch.unit, batch.price_per_unit, batch.currency, batch.region, batch.state, batch.country,
        batch.certifications, batch.organic_certified, batch.images, batch.qr_hash, batch.traceability_url,
        batch.status, batch.marketplace_status, batch.verified_at, batch.verified_by
      ]);
      
      createdBatches.push(result.rows[0]);
      console.log(`✅ Created batch: ${result.rows[0].product_name}`);
    }
    
    res.json({
      success: true,
      message: 'Sample batches created successfully',
      batches: createdBatches,
      count: createdBatches.length
    });
    
  } catch (error) {
    console.error('❌ Error creating sample batches:', error);
    res.status(500).json({ error: 'Failed to create sample batches: ' + error.message });
  }
});

// Purchase product endpoint
app.post('/api/marketplace/purchase', authenticateToken, async (req, res) => {
  try {
    const { batchId, quantity, unitPrice, totalPrice, buyerId, farmerId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!batchId || !quantity || !unitPrice || !totalPrice) {
      return res.status(400).json({ error: 'Missing required purchase data' });
    }

    // Verify buyer matches authenticated user
    if (buyerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized purchase attempt' });
    }

    // CRITICAL SECURITY FIX: Prevent same-user purchases
    if (buyerId === farmerId) {
      return res.status(400).json({ 
        error: 'You cannot purchase your own products. Please buy from other farmers to support the marketplace economy.',
        code: 'SAME_USER_PURCHASE'
      });
    }

    // Get batch details
    const batchQuery = await pool.query(`
      SELECT * FROM supply_chain_batches 
      WHERE id = $1 AND marketplace_status = 'active' AND status = 'verified'
    `, [batchId]);

    if (batchQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Product not available for purchase' });
    }

    const batch = batchQuery.rows[0];

    // Check if sufficient quantity available
    if (parseFloat(batch.quantity) < quantity) {
      return res.status(400).json({ 
        error: `Insufficient quantity. Only ${batch.quantity} ${batch.unit} available.` 
      });
    }

    // Get buyer wallet
    const buyerWalletQuery = await pool.query(`
      SELECT * FROM wallet_accounts 
      WHERE user_id = $1 AND wallet_type = 'agrifinance'
    `, [buyerId]);

    if (buyerWalletQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer wallet not found' });
    }

    const buyerWallet = buyerWalletQuery.rows[0];
    const buyerBalance = parseFloat(buyerWallet.balance_wei) / 1000000; // Convert wei to KRSI

    // Check if buyer has sufficient balance
    if (buyerBalance < totalPrice) {
      return res.status(400).json({ 
        error: `Insufficient balance. You have ${buyerBalance.toFixed(2)} KRSI, but need ${totalPrice.toFixed(2)} KRSI.` 
      });
    }

    // Get farmer wallet
    const farmerWalletQuery = await pool.query(`
      SELECT * FROM wallet_accounts 
      WHERE user_id = $1 AND wallet_type = 'agrifinance'
    `, [farmerId]);

    if (farmerWalletQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer wallet not found' });
    }

    const farmerWallet = farmerWalletQuery.rows[0];

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Deduct from buyer wallet
      const newBuyerBalance = (buyerBalance - totalPrice) * 1000000; // Convert back to wei
      await client.query(`
        UPDATE wallet_accounts 
        SET balance_wei = $1, updated_at = NOW() 
        WHERE id = $2
      `, [newBuyerBalance.toString(), buyerWallet.id]);

      // Add to farmer wallet
      const farmerBalance = parseFloat(farmerWallet.balance_wei) / 1000000;
      const newFarmerBalance = (farmerBalance + totalPrice) * 1000000; // Convert back to wei
      await client.query(`
        UPDATE wallet_accounts 
        SET balance_wei = $1, updated_at = NOW() 
        WHERE id = $2
      `, [newFarmerBalance.toString(), farmerWallet.id]);

      // Update batch quantity
      const newQuantity = parseFloat(batch.quantity) - quantity;
      const newMarketplaceStatus = newQuantity <= 0 ? 'sold' : 'active';
      
      await client.query(`
        UPDATE supply_chain_batches 
        SET quantity = $1, marketplace_status = $2, updated_at = NOW()
        WHERE id = $3
      `, [newQuantity, newMarketplaceStatus, batchId]);

      // Create marketplace order
      const orderResult = await client.query(`
        INSERT INTO marketplace_orders (
          batch_id, buyer_id, seller_id, quantity, unit_price, total_amount,
          currency, status, payment_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [batchId, buyerId, farmerId, quantity, unitPrice, totalPrice, 'KRSI', 'completed', 'paid']);

      // Create transaction record for buyer (outgoing)
      await client.query(`
        INSERT INTO transactions (
          user_id, transaction_type, amount_wei, currency, status, 
          description, direction, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        buyerId, 
        'purchase', 
        (totalPrice * 1000000).toString(), 
        'KRSI', 
        'completed',
        `Purchased ${quantity} ${batch.unit} of ${batch.product_name}`,
        'outgoing' // Direction: outgoing for buyer (money going out)
      ]);

      // Create transaction record for farmer (incoming)
      await client.query(`
        INSERT INTO transactions (
          user_id, transaction_type, amount_wei, currency, status, 
          description, direction, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        farmerId, 
        'sale', 
        (totalPrice * 1000000).toString(), 
        'KRSI', 
        'completed',
        `Sold ${quantity} ${batch.unit} of ${batch.product_name}`,
        'incoming' // Direction: incoming for farmer (money coming in)
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Purchase completed successfully',
        orderId: orderResult.rows[0].id,
        purchase: {
          productName: batch.product_name,
          quantity: quantity,
          unit: batch.unit,
          totalPrice: totalPrice,
          remainingQuantity: newQuantity
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Purchase failed: ' + error.message });
  }
});

app.listen(PORT, () => {
      console.log(`🚀 AgriFinance Backend running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};

startServer();