const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.Database || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndFixTables() {
  try {
    console.log('🔧 Checking and fixing table schemas...');

    // Check wallet_accounts table structure
    const walletColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wallet_accounts' 
      ORDER BY ordinal_position;
    `);
    
    console.log('wallet_accounts columns:', walletColumns.rows);

    // Check if user_id column exists
    const hasUserId = walletColumns.rows.some(col => col.column_name === 'user_id');
    
    if (!hasUserId) {
      console.log('Adding user_id column to wallet_accounts...');
      await pool.query(`
        ALTER TABLE wallet_accounts 
        ADD COLUMN user_id UUID REFERENCES users(id);
      `);
    }

    // Check nfts table structure
    const nftColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'nfts' 
      ORDER BY ordinal_position;
    `);
    
    console.log('nfts columns:', nftColumns.rows);

    // Check if owner_id column exists
    const hasOwnerId = nftColumns.rows.some(col => col.column_name === 'owner_id');
    
    if (!hasOwnerId) {
      console.log('Adding owner_id column to nfts...');
      await pool.query(`
        ALTER TABLE nfts 
        ADD COLUMN owner_id UUID REFERENCES users(id);
      `);
    }

    // Check admin_approvals table structure
    const approvalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_approvals' 
      ORDER BY ordinal_position;
    `);
    
    console.log('admin_approvals columns:', approvalColumns.rows);

    // Check if user_id column exists
    const hasApprovalUserId = approvalColumns.rows.some(col => col.column_name === 'user_id');
    
    if (!hasApprovalUserId) {
      console.log('Adding user_id column to admin_approvals...');
      await pool.query(`
        ALTER TABLE admin_approvals 
        ADD COLUMN user_id UUID REFERENCES users(id);
      `);
    }

    // Check transactions table structure
    const transactionColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('transactions columns:', transactionColumns.rows);

    // Check if user_id column exists
    const hasTransactionUserId = transactionColumns.rows.some(col => col.column_name === 'user_id');
    
    if (!hasTransactionUserId) {
      console.log('Adding user_id column to transactions...');
      await pool.query(`
        ALTER TABLE transactions 
        ADD COLUMN user_id UUID REFERENCES users(id);
      `);
    }

    // Now create indexes safely
    console.log('Creating indexes...');
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
      console.log('✅ Created users email index');
    } catch (e) {
      console.log('⚠️ Users email index already exists or error:', e.message);
    }

    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);');
      console.log('✅ Created wallet_accounts user index');
    } catch (e) {
      console.log('⚠️ Wallet accounts user index already exists or error:', e.message);
    }

    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_id);');
      console.log('✅ Created nfts owner index');
    } catch (e) {
      console.log('⚠️ NFTs owner index already exists or error:', e.message);
    }

    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON admin_approvals(status);');
      console.log('✅ Created admin_approvals status index');
    } catch (e) {
      console.log('⚠️ Admin approvals status index already exists or error:', e.message);
    }

    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);');
      console.log('✅ Created transactions user index');
    } catch (e) {
      console.log('⚠️ Transactions user index already exists or error:', e.message);
    }

    console.log('✅ Database schema check and fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database schema check error:', error);
    process.exit(1);
  }
}

checkAndFixTables();
