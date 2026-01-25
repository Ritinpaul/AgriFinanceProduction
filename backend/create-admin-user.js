// create-admin-user.js - Create admin user in database
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAdminUser() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin@123', 10);
    
    // Check if admin exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['admin@gmail.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('Admin user already exists:', existingUser.rows[0].email);
      
      // Update password to ensure it's correct
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
        [hashedPassword, 'admin', 'admin@gmail.com']
      );
      console.log('✅ Admin password updated and role set to admin');
      return;
    }

    // Create admin user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, profile_completed, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING *`,
      ['admin@gmail.com', hashedPassword, 'Admin', 'User', 'admin']
    );

    console.log('✅ Admin user created successfully:');
    console.log('   Email:', result.rows[0].email);
    console.log('   ID:', result.rows[0].id);
    console.log('   Role:', result.rows[0].role);
    console.log('\nLogin credentials:');
    console.log('   Email: admin@gmail.com');
    console.log('   Password: admin@123');
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

createAdminUser();
