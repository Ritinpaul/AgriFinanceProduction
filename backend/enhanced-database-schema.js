const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createEnhancedDatabaseSchema() {
  try {
    console.log('🔧 Creating enhanced database schema...');

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
        chain_id VARCHAR(20) DEFAULT 'amoy',
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

    // Create supply_chain_batches table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supply_chain_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES users(id),
        product_type VARCHAR(100) NOT NULL,
        grade VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_unit DECIMAL(10,2) NOT NULL,
        certifications TEXT[],
        qr_hash VARCHAR(255) UNIQUE,
        traceability_url TEXT,
        status VARCHAR(20) DEFAULT 'pending',
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

    console.log('✅ Enhanced database schema created successfully!');
    console.log('📊 Tables created: users, wallet_accounts, nfts, admin_approvals, transactions, loans, loan_payments, supply_chain_batches, credit_scores, platform_analytics, user_activity_logs');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Enhanced database schema creation error:', error);
    process.exit(1);
  }
}

createEnhancedDatabaseSchema();
