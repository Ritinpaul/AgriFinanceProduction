const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  try {
    // Check admin_approvals table
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_approvals' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== admin_approvals table columns ===');
    result.rows.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type}`);
    });
    
    // Get a sample row to see the actual data
    const sampleResult = await pool.query(`
      SELECT * FROM admin_approvals LIMIT 1
    `);
    
    console.log('\n=== Sample row (if exists) ===');
    if (sampleResult.rows.length > 0) {
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    } else {
      console.log('No rows in admin_approvals table');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
