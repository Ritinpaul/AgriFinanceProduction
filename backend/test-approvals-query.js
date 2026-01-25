const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testQuery() {
  try {
    console.log('Testing approvals query...\n');
    
    const result = await pool.query(
      `SELECT 
        aa.*,
        n.name as nft_name,
        n.description as nft_description,
        n.image_url as nft_image_url,
        n.token_id as nft_token_id,
        n.owner_address as nft_owner,
        n.price_wei as nft_price_wei,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM admin_approvals aa
      LEFT JOIN nfts n ON (aa.request_data->>'nft_id')::uuid = n.id
      LEFT JOIN users u ON aa.user_id = u.id
      WHERE aa.status = 'pending' 
      ORDER BY aa.created_at DESC`
    );
    
    console.log(`Found ${result.rows.length} pending approvals:\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`\n--- Approval ${index + 1} ---`);
        console.log(`ID: ${row.id}`);
        console.log(`Type: ${row.approval_type}`);
        console.log(`Status: ${row.status}`);
        console.log(`NFT Name: ${row.nft_name || 'N/A'}`);
        console.log(`NFT ID from request_data: ${row.request_data?.nft_id}`);
        console.log(`User: ${row.user_first_name} ${row.user_last_name} (${row.user_email})`);
        console.log(`Created: ${row.created_at}`);
      });
    } else {
      console.log('No pending approvals found.');
    }
    
    await pool.end();
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Details:', error);
    await pool.end();
    process.exit(1);
  }
}

testQuery();

