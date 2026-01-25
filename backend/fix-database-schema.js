const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixDatabaseSchema() {
  try {
    console.log('🔧 Fixing database schema...');

    // Check if tables exist and fix them
    const tables = ['users', 'wallet_accounts', 'nfts', 'admin_approvals', 'transactions'];
    
    for (const table of tables) {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        console.log(`Creating table: ${table}`);
        
        switch (table) {
          case 'users':
            await pool.query(`
              CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                profile_completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            break;
            
          case 'wallet_accounts':
            await pool.query(`
              CREATE TABLE wallet_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                address VARCHAR(255) NOT NULL,
                wallet_type VARCHAR(50) DEFAULT 'agrifinance',
                chain_id VARCHAR(20) DEFAULT 'amoy',
                token_symbol VARCHAR(10) DEFAULT 'KRSI',
                balance_wei VARCHAR(255) DEFAULT '0',
                custodial BOOLEAN DEFAULT TRUE,
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            break;
            
          case 'nfts':
            await pool.query(`
              CREATE TABLE nfts (
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
            break;
            
          case 'admin_approvals':
            await pool.query(`
              CREATE TABLE admin_approvals (
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
            break;
            
          case 'transactions':
            await pool.query(`
              CREATE TABLE transactions (
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
            break;
        }
      } else {
        console.log(`Table ${table} already exists`);
      }
    }

    // Create indexes
    console.log('Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON admin_approvals(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);');

    console.log('✅ Database schema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database schema fix error:', error);
    process.exit(1);
  }
}

fixDatabaseSchema();
