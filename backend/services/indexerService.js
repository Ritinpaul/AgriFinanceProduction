const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const ESCROW_ABI = [
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principalWei)',
  'event LoanRepaid(uint256 indexed loanId, address indexed payer, uint256 amountWei, uint256 totalRepaidWei)',
  'event LoanClosed(uint256 indexed loanId)'
];

const LOAN_VAULT_ABI = [
  'event LiquidityDeposited(address indexed lender, uint256 amount, uint256 lpShares)',
  'event LiquidityWithdrawn(address indexed lender, uint256 amount, uint256 lpShares)',
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower)',
  'event LiquidationExecuted(uint256 indexed loanId, address indexed liquidator)'
];

async function ensureIndexerTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blockchain_events (
      id SERIAL PRIMARY KEY,
      tx_hash VARCHAR(66) NOT NULL,
      contract_address VARCHAR(42) NOT NULL,
      event_name VARCHAR(100) NOT NULL,
      event_data JSONB,
      block_number BIGINT NOT NULL,
      log_index INTEGER,
      indexed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(tx_hash, contract_address, event_name, log_index)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      name TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  // Ensure protocol_loans has escrow tracking fields
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='protocol_loans' AND column_name='escrow_loan_id'
      ) THEN
        ALTER TABLE protocol_loans ADD COLUMN escrow_loan_id BIGINT UNIQUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='protocol_loans' AND column_name='escrow_borrower'
      ) THEN
        ALTER TABLE protocol_loans ADD COLUMN escrow_borrower TEXT;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='protocol_loans' AND column_name='repaid_wei'
      ) THEN
        ALTER TABLE protocol_loans ADD COLUMN repaid_wei DECIMAL(78,0) DEFAULT 0;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='protocol_loans' AND column_name='principal_wei'
      ) THEN
        ALTER TABLE protocol_loans ADD COLUMN principal_wei DECIMAL(78,0) DEFAULT 0;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='protocol_loans' AND column_name='status'
      ) THEN
        ALTER TABLE protocol_loans ADD COLUMN status TEXT DEFAULT 'active';
      END IF;
    END$$;
  `);
}

async function getCursor(pool, cursorName = 'escrow_last_block') {
  const { rows } = await pool.query('SELECT value FROM indexer_state WHERE name=$1', [cursorName]);
  return rows[0]?.value ? Number(rows[0].value) : null;
}

async function setCursor(pool, blockNumber, cursorName = 'escrow_last_block') {
  await pool.query(`
    INSERT INTO indexer_state(name, value) VALUES($1,$2)
    ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value
  `, [cursorName, String(blockNumber)]);
}

async function scanEscrow(pool, { fromBlock, toBlock } = {}) {
  const rpcUrl = process.env.RPC_SEPOLIA || 'https://ethereum-sepolia.publicnode.com';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const address = process.env.ESCROW_CONTRACT_ADDRESS;
  if (!address) return { success: false, error: 'ESCROW_CONTRACT_ADDRESS not set' };
  await ensureIndexerTables(pool);
  let start = fromBlock ?? (await getCursor(pool)) ?? (await provider.getBlockNumber()) - 2_000; // last ~2000 blocks default
  if (start < 0) start = 0;
  const end = toBlock ?? await provider.getBlockNumber();
  if (end < start) return { success: true, scanned: 0, range: [start, end] };

  const iface = new ethers.utils.Interface(ESCROW_ABI);
  const topics = [
    [iface.getEventTopic('LoanCreated'), iface.getEventTopic('LoanRepaid'), iface.getEventTopic('LoanClosed')]
  ];
  const logs = await provider.getLogs({ address, fromBlock: start, toBlock: end, topics });

  let inserted = 0;
  for (const log of logs) {
    const parsed = iface.parseLog(log);
    const data = {
      loanId: parsed.args.loanId?.toString?.() || parsed.args[0]?.toString?.(),
      borrower: parsed.args.borrower || undefined,
      payer: parsed.args.payer || undefined,
      amountWei: parsed.args.amountWei?.toString?.(),
      totalRepaidWei: parsed.args.totalRepaidWei?.toString?.()
    };
    try {
      await pool.query(`
        INSERT INTO blockchain_events(tx_hash, contract_address, event_name, event_data, block_number, log_index)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT DO NOTHING
      `, [log.transactionHash, address.toLowerCase(), parsed.name, data, log.blockNumber, log.logIndex]);
      inserted += 1;
      // Auto-wire to protocol_loans
      const loanIdNum = data.loanId ? Number(data.loanId) : null;
      if (parsed.name === 'LoanCreated' && loanIdNum != null) {
        await pool.query(`
          INSERT INTO protocol_loans (escrow_loan_id, escrow_borrower, principal_wei, repaid_wei, status)
          VALUES ($1,$2,$3,0,'active')
          ON CONFLICT (escrow_loan_id) DO UPDATE SET principal_wei=EXCLUDED.principal_wei, status='active'
        `, [loanIdNum, (data.borrower||'').toLowerCase(), data.principalWei || data.amountWei || '0']);
      }
      if (parsed.name === 'LoanRepaid' && loanIdNum != null) {
        const amt = data.amountWei || '0';
        await pool.query(`
          UPDATE protocol_loans SET repaid_wei = COALESCE(repaid_wei,0) + $2 WHERE escrow_loan_id=$1
        `, [loanIdNum, amt]);
      }
      if (parsed.name === 'LoanClosed' && loanIdNum != null) {
        await pool.query(`
          UPDATE protocol_loans SET status='closed' WHERE escrow_loan_id=$1
        `, [loanIdNum]);
      }
    } catch {}
  }
  await setCursor(pool, end);
  return { success: true, inserted, range: [start, end] };
}

async function scanLoanVault(pool, { fromBlock, toBlock } = {}) {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_SEPOLIA || 'https://ethereum-sepolia.publicnode.com';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // Get LoanVault address from deployments or env
  const networkName = process.env.NETWORK || 'sepolia';
  const depPath = path.join(__dirname, '..', '..', 'deployments', `${networkName}.json`);
  let loanVaultAddress = process.env.LOAN_VAULT_ADDRESS;
  
  if (!loanVaultAddress && fs.existsSync(depPath)) {
    try {
      const deployments = JSON.parse(fs.readFileSync(depPath, 'utf8'));
      loanVaultAddress = deployments.LoanVault;
    } catch (e) {
      console.warn('Could not read deployments file:', e.message);
    }
  }
  
  if (!loanVaultAddress) {
    loanVaultAddress = '0xb3c84011492b4126337798E53aE5e483FD2933A8'; // Fallback to known Sepolia address
  }
  
  await ensureIndexerTables(pool);
  let start = fromBlock ?? (await getCursor(pool, 'loanvault_last_block')) ?? (await provider.getBlockNumber()) - 2_000;
  if (start < 0) start = 0;
  const end = toBlock ?? await provider.getBlockNumber();
  if (end < start) return { success: true, scanned: 0, synced: 0, range: [start, end] };

  const iface = new ethers.utils.Interface(LOAN_VAULT_ABI);
  const topics = [
    [
      iface.getEventTopic('LiquidityDeposited'),
      iface.getEventTopic('LiquidityWithdrawn'),
      iface.getEventTopic('LoanCreated'),
      iface.getEventTopic('LoanRepaid'),
      iface.getEventTopic('LoanDefaulted'),
      iface.getEventTopic('LiquidationExecuted')
    ]
  ];
  
  const logs = await provider.getLogs({ address: loanVaultAddress, fromBlock: start, toBlock: end, topics });

  let inserted = 0;
  let synced = 0;
  
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log);
      const eventName = parsed.name;
      
      // Extract event data based on event type
      let data = {};
      if (eventName === 'LiquidityDeposited') {
        data = {
          lender: parsed.args.lender,
          amount: parsed.args.amount?.toString(),
          lpShares: parsed.args.lpShares?.toString()
        };
      } else if (eventName === 'LiquidityWithdrawn') {
        data = {
          lender: parsed.args.lender,
          amount: parsed.args.amount?.toString(),
          lpShares: parsed.args.lpShares?.toString()
        };
      } else if (eventName === 'LoanCreated') {
        data = {
          loanId: parsed.args.loanId?.toString(),
          borrower: parsed.args.borrower,
          amount: parsed.args.amount?.toString(),
          interestRate: parsed.args.interestRate?.toString()
        };
      } else if (eventName === 'LoanRepaid') {
        data = {
          loanId: parsed.args.loanId?.toString(),
          borrower: parsed.args.borrower,
          amount: parsed.args.amount?.toString()
        };
      } else if (eventName === 'LoanDefaulted') {
        data = {
          loanId: parsed.args.loanId?.toString()
        };
      } else if (eventName === 'LiquidationExecuted') {
        data = {
          loanId: parsed.args.loanId?.toString(),
          liquidator: parsed.args.liquidator
        };
      }
      
      // Store event in blockchain_events table
      await pool.query(`
        INSERT INTO blockchain_events(tx_hash, contract_address, event_name, event_data, block_number, log_index)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT DO NOTHING
      `, [
        log.transactionHash,
        loanVaultAddress.toLowerCase(),
        eventName,
        data,
        log.blockNumber,
        log.logIndex
      ]);
      inserted += 1;
      
      // Auto-wire events to database tables
      if (eventName === 'LiquidityDeposited') {
        const lenderAddress = (data.lender || '').toLowerCase();
        const amountWei = data.amount || '0';
        
        // Find user_id from wallet_accounts
        const userResult = await pool.query(
          'SELECT user_id FROM wallet_accounts WHERE LOWER(address) = $1 LIMIT 1',
          [lenderAddress]
        );
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].user_id;
          
          // Ensure tables exist
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
          
          // Insert liquidity_deposits (check for existing tx_hash first to avoid duplicates)
          const existingDeposit = await pool.query(
            'SELECT id FROM liquidity_deposits WHERE tx_hash = $1 LIMIT 1',
            [log.transactionHash]
          );
          
          if (existingDeposit.rows.length === 0) {
            await pool.query(`
              INSERT INTO liquidity_deposits(user_id, amount_wei, tx_hash, created_at)
              VALUES ($1, $2, $3, NOW())
            `, [userId, amountWei, log.transactionHash]);
          }
          
          // Ensure liquidity_pools has one row, then update total
          const poolCheck = await pool.query('SELECT id FROM liquidity_pools LIMIT 1');
          if (poolCheck.rows.length === 0) {
            await pool.query(`
              INSERT INTO liquidity_pools (symbol, total_deposits_wei, total_borrows_wei, apy_bps)
              VALUES ('KRSI', 0, 0, 800)
            `);
          }
          
          // Only update if this is a new deposit (not already processed)
          if (existingDeposit.rows.length === 0) {
            await pool.query(`
              UPDATE liquidity_pools 
              SET total_deposits_wei = total_deposits_wei + $1
              WHERE id = (SELECT id FROM liquidity_pools ORDER BY id LIMIT 1)
            `, [amountWei]);
          }
          
          synced += 1;
        }
      } else if (eventName === 'LiquidityWithdrawn') {
        const lenderAddress = (data.lender || '').toLowerCase();
        const amountWei = data.amount || '0';
        
        // Find user_id from wallet_accounts
        const userResult = await pool.query(
          'SELECT user_id FROM wallet_accounts WHERE LOWER(address) = $1 LIMIT 1',
          [lenderAddress]
        );
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].user_id;
          
          // Ensure tables exist
          await pool.query(`
            CREATE TABLE IF NOT EXISTS liquidity_deposits (
              id SERIAL PRIMARY KEY,
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              amount_wei DECIMAL(78,0) NOT NULL,
              tx_hash TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            );
          `);
          
          // Insert as negative deposit (withdrawal) - check for existing tx_hash first
          const existingWithdrawal = await pool.query(
            'SELECT id FROM liquidity_deposits WHERE tx_hash = $1 LIMIT 1',
            [log.transactionHash]
          );
          
          if (existingWithdrawal.rows.length === 0) {
            await pool.query(`
              INSERT INTO liquidity_deposits(user_id, amount_wei, tx_hash, created_at)
              VALUES ($1, $2, $3, NOW())
            `, [userId, (-BigInt(amountWei)).toString(), log.transactionHash]);
            
            // Update liquidity_pools total (subtract)
            await pool.query(`
              UPDATE liquidity_pools 
              SET total_deposits_wei = GREATEST(total_deposits_wei - $1, 0)
              WHERE id = (SELECT id FROM liquidity_pools ORDER BY id LIMIT 1)
            `, [amountWei]);
          }
          
          synced += 1;
        }
      } else if (eventName === 'LoanCreated') {
        // Auto-wire LoanCreated to protocol_loans (if needed)
        const loanIdNum = data.loanId ? Number(data.loanId) : null;
        if (loanIdNum != null) {
          // Check if protocol_loans table exists and has required columns
          await pool.query(`
            CREATE TABLE IF NOT EXISTS protocol_loans (
              id SERIAL PRIMARY KEY,
              loanvault_loan_id BIGINT UNIQUE,
              borrower_address TEXT,
              principal_wei DECIMAL(78,0) DEFAULT 0,
              repaid_wei DECIMAL(78,0) DEFAULT 0,
              status TEXT DEFAULT 'active',
              created_at TIMESTAMP DEFAULT NOW()
            );
          `);
          
          await pool.query(`
            INSERT INTO protocol_loans (loanvault_loan_id, borrower_address, principal_wei, repaid_wei, status)
            VALUES ($1, $2, $3, 0, 'active')
            ON CONFLICT (loanvault_loan_id) DO UPDATE SET principal_wei=EXCLUDED.principal_wei, status='active'
          `, [loanIdNum, (data.borrower || '').toLowerCase(), data.amount || '0']);
          
          // Update liquidity_pools total_borrows_wei
          await pool.query(`
            UPDATE liquidity_pools 
            SET total_borrows_wei = total_borrows_wei + $1
            WHERE id = (SELECT id FROM liquidity_pools ORDER BY id LIMIT 1)
          `, [data.amount || '0']);
          
          synced += 1;
        }
      } else if (eventName === 'LoanRepaid') {
        const loanIdNum = data.loanId ? Number(data.loanId) : null;
        if (loanIdNum != null) {
          const repayAmount = BigInt(data.amount || '0');
          
          // First, get the current loan state
          const loanResult = await pool.query(
            'SELECT principal_wei, repaid_wei, status FROM protocol_loans WHERE loanvault_loan_id = $1',
            [loanIdNum]
          );
          
          if (loanResult.rows.length > 0) {
            const loan = loanResult.rows[0];
            const currentRepaid = BigInt(loan.repaid_wei || '0');
            const principalWei = BigInt(loan.principal_wei || '0');
            const newRepaid = currentRepaid + repayAmount;
            const isFullyRepaid = newRepaid >= principalWei;
            
            // Update loan with new repaid amount and status if fully repaid
            await pool.query(`
              UPDATE protocol_loans 
              SET repaid_wei = $1,
                  status = CASE WHEN $1 >= $2 THEN 'repaid' ELSE status END,
                  repaid_at = CASE WHEN $1 >= $2 AND repaid_at IS NULL THEN NOW() ELSE repaid_at END,
                  repayment_tx_hash = COALESCE(repayment_tx_hash, $3)
              WHERE loanvault_loan_id = $4
            `, [newRepaid.toString(), principalWei.toString(), log.transactionHash, loanIdNum]);
            
            // Update liquidity_pools total_borrows_wei (subtract repaid amount)
            await pool.query(`
              UPDATE liquidity_pools 
              SET total_borrows_wei = GREATEST(total_borrows_wei - $1, 0)
              WHERE id = (SELECT id FROM liquidity_pools ORDER BY id LIMIT 1)
            `, [data.amount || '0']);
            
            synced += 1;
            
            if (isFullyRepaid) {
              console.log(`✅ Loan ${loanIdNum} marked as fully repaid via indexer`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error processing LoanVault event at block ${log.blockNumber}:`, err.message);
      // Continue processing other events
    }
  }
  
  await setCursor(pool, end, 'loanvault_last_block');
  return { success: true, inserted, synced, range: [start, end] };
}

module.exports = { scanEscrow, scanLoanVault, ensureIndexerTables };


