// Migration: Governance indices for faster queries
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
  console.log('🔧 Creating governance indices...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON governance_proposals(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_votes_voter ON governance_votes(voter_id)`);
    await client.query('COMMIT');
    console.log('✅ Governance indices created');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Governance indices migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
