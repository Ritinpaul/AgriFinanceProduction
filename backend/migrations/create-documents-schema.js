// Migration: Create documents tables for IPFS
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
	console.log('🔧 Creating documents schema...');
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(`
			CREATE TABLE IF NOT EXISTS documents (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
				title TEXT,
				mime_type TEXT,
				cid TEXT NOT NULL,
				ipfs_url TEXT,
				gateway_url TEXT,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW()
			);
		`);
		await client.query(`
			CREATE TABLE IF NOT EXISTS nft_documents (
				id SERIAL PRIMARY KEY,
				nft_id UUID REFERENCES nfts(id) ON DELETE CASCADE,
				document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
				linked_at TIMESTAMP DEFAULT NOW(),
				UNIQUE(nft_id, document_id)
			);
		`);
		await client.query('COMMIT');
		console.log('✅ Documents schema created');
	} catch (e) {
		await client.query('ROLLBACK');
		console.error('❌ Documents schema migration failed:', e.message);
		process.exitCode = 1;
	} finally {
		client.release();
		await pool.end();
	}
}

run();
