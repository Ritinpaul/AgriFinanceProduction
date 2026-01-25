// Migration: Create Blockchain Indexer Schema
// This sets up tables for indexing blockchain events and transactions

const { Pool } = require('pg');
require('dotenv').config();

// Prefer DATABASE_URL if provided (keeps parity with server.js). Fallback to individual vars.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'agrifinance',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }
);

async function createBlockchainIndexerSchema() {
  console.log('🔧 Creating blockchain indexer schema...');

  const client = await pool.connect();

  try {
    // Create blockchain_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blockchain_transactions (
        id SERIAL PRIMARY KEY,
        tx_hash VARCHAR(66) NOT NULL,
        block_number BIGINT NOT NULL,
        from_address VARCHAR(42),
        to_address VARCHAR(42),
        value_wei VARCHAR(78),
        gas_used BIGINT,
        gas_price VARCHAR(78),
        event_name VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        indexed_at TIMESTAMP DEFAULT NOW(),
        confirmed_at TIMESTAMP,
        UNIQUE(tx_hash)
      );
    `);

    console.log('✅ Created blockchain_transactions table');

    // Create blockchain_events table (for all contract events)
    await client.query(`
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

    console.log('✅ Created blockchain_events table');

    // Create blockchain_metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blockchain_metrics (
        id SERIAL PRIMARY KEY,
        date DATE DEFAULT CURRENT_DATE,
        total_transactions BIGINT DEFAULT 0,
        total_transactions_value VARCHAR(78) DEFAULT '0',
        gas_used_total BIGINT DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        tvl_usd DECIMAL(20,2) DEFAULT 0,
        indexed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date)
      );
    `);

    console.log('✅ Created blockchain_metrics table');

    // Create wallet_sync table (tracks syncing status)
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_sync (
        id SERIAL PRIMARY KEY,
        user_address VARCHAR(42) UNIQUE NOT NULL,
        blockchain_balance VARCHAR(78) NOT NULL,
        database_balance VARCHAR(78) NOT NULL,
        is_synced BOOLEAN DEFAULT FALSE,
        last_synced TIMESTAMP,
        sync_attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Created wallet_sync table');

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tx_hash ON blockchain_transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_block_number ON blockchain_transactions(block_number);
      CREATE INDEX IF NOT EXISTS idx_from_address ON blockchain_transactions(from_address);
      CREATE INDEX IF NOT EXISTS idx_to_address ON blockchain_transactions(to_address);
      CREATE INDEX IF NOT EXISTS idx_event_name ON blockchain_events(event_name);
      CREATE INDEX IF NOT EXISTS idx_contract_address ON blockchain_events(contract_address);
      CREATE INDEX IF NOT EXISTS idx_wallet_sync_address ON wallet_sync(user_address);
    `);

    console.log('✅ Created indexes');

    // Add new columns to existing wallet_accounts table if they don't exist
    const addColumnsQuery = `
      DO $$ 
      BEGIN
        ALTER TABLE wallet_accounts 
        ADD COLUMN IF NOT EXISTS user_address VARCHAR(42),
        ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP,
        ADD COLUMN IF NOT EXISTS blockchain_balance VARCHAR(78) DEFAULT '0',
        ADD COLUMN IF NOT EXISTS is_on_chain BOOLEAN DEFAULT FALSE;
      END $$;
    `;

    await client.query(addColumnsQuery);
    console.log('✅ Added blockchain columns to wallet_accounts');

    await client.query('COMMIT');
    console.log('✅ Successfully created blockchain indexer schema!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating blockchain indexer schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
createBlockchainIndexerSchema()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });


