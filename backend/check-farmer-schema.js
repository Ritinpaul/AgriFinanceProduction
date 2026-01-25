const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  try {
    // Check farmer_profiles table
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'farmer_profiles' 
      AND column_name IN ('land_area_acres', 'farming_experience_years', 'primary_crops', 'user_id', 'profile_completed')
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== farmer_profiles relevant columns ===');
    result.rows.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
