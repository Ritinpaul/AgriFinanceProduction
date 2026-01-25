// Migration: Liquidity pool and loan core schema (Phase 3)
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'agrifinance',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      }
);

async function run() {
  console.log('🔧 Creating liquidity & loan schema...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pools (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL DEFAULT 'KRSI',
        total_deposits_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        total_borrows_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        apy_bps INTEGER NOT NULL DEFAULT 800, -- 8% APY
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS liquidity_deposits (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount_wei DECIMAL(78,0) NOT NULL,
        tx_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS protocol_loans (
        id SERIAL PRIMARY KEY,
        borrower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        principal_wei DECIMAL(78,0) NOT NULL,
        interest_bps INTEGER NOT NULL DEFAULT 1200,
        duration_days INTEGER NOT NULL DEFAULT 180,
        status TEXT NOT NULL DEFAULT 'active',
        repaid_wei DECIMAL(78,0) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Liquidity & loan schema created');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Liquidity schema migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
