// Backfill approval requests for existing NFTs
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function backfillApprovals() {
  try {
    console.log('🔧 Finding NFTs without approval requests...');
    
    // Get all NFTs
    const nftsResult = await pool.query(`
      SELECT id, name, description, image_url, price_wei, owner_id 
      FROM nfts
    `);
    
    console.log(`📋 Found ${nftsResult.rows.length} NFTs`);
    
    let created = 0;
    
    for (const nft of nftsResult.rows) {
      // Check if approval already exists
      const existingApproval = await pool.query(
        `SELECT id FROM admin_approvals WHERE request_data->>'nft_id' = $1`,
        [nft.id]
      );
      
      if (existingApproval.rows.length === 0) {
        // Create approval request
        const price_krsi = nft.price_wei ? (BigInt(nft.price_wei) / BigInt(1000000)).toString() : '0';
        
        await pool.query(
          `INSERT INTO admin_approvals (user_id, approval_type, status, request_data)
           VALUES ($1, $2, $3, $4)`,
          [
            nft.owner_id,
            'nft_mint',
            'pending',
            JSON.stringify({
              nft_id: nft.id,
              name: nft.name,
              description: nft.description,
              image_url: nft.image_url,
              price_krsi: price_krsi
            })
          ]
        );
        
        created++;
        console.log(`✅ Created approval for NFT: ${nft.name}`);
      }
    }
    
    console.log(`\n🎉 Backfill complete! Created ${created} approval requests.`);
    
    // Show summary
    const totalApprovals = await pool.query('SELECT COUNT(*) FROM admin_approvals');
    console.log(`📊 Total approval requests in database: ${totalApprovals.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

backfillApprovals();
