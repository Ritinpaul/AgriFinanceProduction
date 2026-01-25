// Transaction History Service - Aggregates all transaction types for users

async function getTransactionHistory(pool, userId, walletAddress = null) {
  const allTransactions = [];

  // 1. Liquidity Deposits
  try {
    const deposits = await pool.query(
      `SELECT id, amount_wei, lp_shares, tx_hash, created_at
       FROM liquidity_deposits
       WHERE user_id = $1 AND tx_hash IS NOT NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    for (const dep of deposits.rows) {
      allTransactions.push({
        id: `deposit-${dep.id}`,
        type: 'liquidity_deposit',
        typeLabel: 'Liquidity Deposit',
        amountWei: dep.amount_wei,
        token_symbol: 'KRSI',
        tx_hash: dep.tx_hash,
        created_at: dep.created_at,
        metadata: { lpShares: dep.lp_shares }
      });
    }
  } catch (e) {
    console.warn('Error fetching deposits:', e.message);
  }

  // 2. Liquidity Withdrawals  
  try {
    const withdrawals = await pool.query(
      `SELECT id, amount_wei, tx_hash, created_at
       FROM liquidity_deposits
       WHERE user_id = $1 AND tx_hash IS NOT NULL AND amount_wei < 0
       ORDER BY created_at DESC`,
      [userId]
    );
    for (const wd of withdrawals.rows) {
      allTransactions.push({
        id: `withdraw-${wd.id}`,
        type: 'liquidity_withdrawal',
        typeLabel: 'Liquidity Withdrawal',
        amountWei: Math.abs(Number(wd.amount_wei)),
        token_symbol: 'KRSI',
        tx_hash: wd.tx_hash,
        created_at: wd.created_at
      });
    }
  } catch (e) {
    console.warn('Error fetching withdrawals:', e.message);
  }

  // 3. Loan Creations
  try {
    const loans = await pool.query(
      `SELECT id, principal_wei, tx_hash, created_at, loanvault_loan_id
       FROM protocol_loans
       WHERE borrower_id_text = $1 AND tx_hash IS NOT NULL
       ORDER BY created_at DESC`,
      [String(userId)]
    );
    for (const loan of loans.rows) {
      allTransactions.push({
        id: `loan-create-${loan.id}`,
        type: 'loan_created',
        typeLabel: 'Loan Created',
        amountWei: loan.principal_wei,
        token_symbol: 'KRSI',
        tx_hash: loan.tx_hash,
        created_at: loan.created_at,
        metadata: { loanId: loan.id, onChainLoanId: loan.loanvault_loan_id }
      });
    }
  } catch (e) {
    console.warn('Error fetching loans:', e.message);
  }

  // 4. Loan Repayments
  try {
    const repayments = await pool.query(
      `SELECT id, principal_wei, repaid_wei, repayment_tx_hash, tx_hash, status, created_at, loanvault_loan_id
       FROM protocol_loans
       WHERE borrower_id_text = $1 
         AND ((repayment_tx_hash IS NOT NULL) OR (status = 'repaid' AND tx_hash IS NOT NULL))
       ORDER BY created_at DESC`,
      [String(userId)]
    );
    for (const loan of repayments.rows) {
      const repaymentTxHash = loan.repayment_tx_hash || (loan.status === 'repaid' ? loan.tx_hash : null);
      if (repaymentTxHash) {
        allTransactions.push({
          id: `loan-repay-${loan.id}`,
          type: 'loan_repaid',
          typeLabel: 'Loan Repaid',
          amountWei: loan.repaid_wei || loan.principal_wei,
          token_symbol: 'KRSI',
          tx_hash: repaymentTxHash,
          created_at: loan.created_at,
          metadata: { loanId: loan.id, onChainLoanId: loan.loanvault_loan_id }
        });
      }
    }
  } catch (e) {
    console.warn('Error fetching repayments:', e.message);
  }

  // 5. Blockchain Events (from indexer)
  if (walletAddress) {
    try {
      const events = await pool.query(
        `SELECT tx_hash, contract_address, event_name, event_data, block_number, indexed_at
         FROM blockchain_events
         WHERE LOWER(event_data::text) LIKE $1
           AND event_name IN ('LiquidityDeposited', 'LiquidityWithdrawn', 'LoanCreated', 'LoanRepaid')
         ORDER BY indexed_at DESC, block_number DESC
         LIMIT 100`,
        [`%${walletAddress.toLowerCase()}%`]
      );
      
      for (const event of events.rows) {
        const eventData = typeof event.event_data === 'string' 
          ? JSON.parse(event.event_data) 
          : event.event_data;
        
        const eventAddress = eventData.lender || eventData.borrower;
        if (eventAddress && eventAddress.toLowerCase() === walletAddress.toLowerCase()) {
          let type, typeLabel, amountWei;
          
          if (event.event_name === 'LiquidityDeposited') {
            type = 'liquidity_deposit';
            typeLabel = 'Liquidity Deposit';
            amountWei = eventData.amount || '0';
          } else if (event.event_name === 'LiquidityWithdrawn') {
            type = 'liquidity_withdrawal';
            typeLabel = 'Liquidity Withdrawal';
            amountWei = eventData.amount || '0';
          } else if (event.event_name === 'LoanCreated') {
            type = 'loan_created';
            typeLabel = 'Loan Created';
            amountWei = eventData.amount || '0';
          } else if (event.event_name === 'LoanRepaid') {
            type = 'loan_repaid';
            typeLabel = 'Loan Repaid';
            amountWei = eventData.amount || '0';
          }
          
          // Avoid duplicates - check if we already have this tx_hash
          if (!allTransactions.find(tx => tx.tx_hash === event.tx_hash && tx.type === type)) {
            allTransactions.push({
              id: `event-${event.tx_hash}-${event.block_number}`,
              type,
              typeLabel,
              amountWei,
              token_symbol: 'KRSI',
              tx_hash: event.tx_hash,
              created_at: event.indexed_at || new Date(),
              metadata: eventData,
              block_number: event.block_number
            });
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching blockchain events:', e.message);
    }
  }

  // 6. General transactions table
  try {
    const genTx = await pool.query(
      `SELECT id, transaction_type, amount_wei, currency, direction, status, description, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    for (const tx of genTx.rows) {
      allTransactions.push({
        id: `tx-${tx.id}`,
        type: tx.transaction_type || 'general',
        typeLabel: tx.description || tx.transaction_type || 'Transaction',
        amountWei: tx.amount_wei,
        token_symbol: tx.currency || 'KRSI',
        tx_hash: null,
        created_at: tx.created_at,
        direction: tx.direction,
        status: tx.status,
        metadata: { description: tx.description }
      });
    }
  } catch (e) {
    console.warn('Error fetching general transactions:', e.message);
  }

  // Sort by date (newest first) and format
  const network = process.env.NETWORK || 'sepolia';
  const explorerBase = network === 'sepolia' 
    ? 'https://sepolia.etherscan.io' 
    : 'https://etherscan.io';

  const formatted = allTransactions
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(tx => {
      const amountKRSI = Number(tx.amountWei) / 1_000_000;
      
      return {
        ...tx,
        formattedAmount: amountKRSI.toFixed(6),
        statusColor: tx.status === 'completed' || tx.status === 'confirmed' || !tx.status
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : tx.status === 'pending'
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        status: tx.status || 'confirmed',
        blockExplorerUrl: tx.tx_hash 
          ? `${explorerBase}/tx/${tx.tx_hash}`
          : null
      };
    });

  return formatted;
}

module.exports = {
  getTransactionHistory
};

