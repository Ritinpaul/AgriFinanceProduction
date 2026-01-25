// Create admin_approvals table
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createAdminApprovalsTable() {
  try {
    console.log('🔧 Creating admin_approvals table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        approval_type VARCHAR(100) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        request_data JSONB,
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ admin_approvals table created successfully!');
    
    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON admin_approvals(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_approvals_user ON admin_approvals(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_approvals_type ON admin_approvals(approval_type);');
    
    console.log('✅ Indexes created successfully!');
    
    // Check if table exists
    const result = await pool.query(`
      SELECT COUNT(*) FROM admin_approvals;
    `);
    
    console.log('✅ Table verified! Current count:', result.rows[0].count);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminApprovalsTable();
