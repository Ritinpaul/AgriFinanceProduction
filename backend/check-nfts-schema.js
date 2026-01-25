const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkNFTsSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'nfts' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== NFTs table columns ===');
    result.rows.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkNFTsSchema();
