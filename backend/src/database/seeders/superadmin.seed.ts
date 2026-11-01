/**
 * Superadmin Seed Script
 * 
 * Run with: npx ts-node --transpile-only src/database/seeders/superadmin.seed.ts
 * 
 * This script creates the first superadmin user essential for RBAC system.
 * It should be run once during initial setup.
 * 
 * Requires MySQL running with civicpulse database.
 */

// Use direct mysql2 package for simple DB operations
import mysql from 'mysql2';
import 'reflect-metadata';

async function seedSuperadmin() {
  console.log('🌱 Running Superadmin Seed Script...\n');

  const connection = mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306', 10),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'civicpulse',
  });

  await connection.connect();

  try {
    // Check if superadmin already exists
    const [existingRows]: any = await connection.execute(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      ['superadmin@civicpulse.ai']
    );

    if (existingRows.length > 0) {
      console.log('⚠️  Superadmin already exists. Skipping seed.');
      console.log(`   Existing superadmin: ${existingRows[0].email}`);
      return;
    }

    // Create superadmin user
    const passwordHash = '$2a$10$IhCvXkXkYqZ7mPmVQvntneEfKqZZ5cT6hSGQ7Ph8GqRlF.E.He.S6';

    await connection.execute(
      'INSERT INTO users (name, email, passwordHash, role, department, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      ['Super Admin', 'superadmin@civicpulse.ai', passwordHash, 'superadmin', null]
    );

    console.log('🎉 Superadmin user created successfully!\n');
    console.log('   Email: superadmin@civicpulse.ai');
    console.log('   Role: superadmin');
    console.log('   Department: All departments');
    console.log('   Password: admin123 (change immediately!)');

  } catch (error) {
    console.error('❌ Seed script failed:', error);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the seed
seedSuperadmin();