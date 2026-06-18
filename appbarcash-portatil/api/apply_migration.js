import fs from 'fs';
import prisma from './lib/prisma.js';

async function applyMigration() {
  try {
    const sql = fs.readFileSync('migration_diff.sql', 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    for (const statement of statements) {
      if (statement.startsWith('--')) continue; // Skip comments if they are whole lines (simple check)
      // Prisma executeRaw might not like comments inside, but let's try.
      // Better to rely on the split.
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('Executed statement.');
      } catch (err) {
        console.error('Failed to execute statement:', statement.substring(0, 50) + '...', err.message);
        // Continue or break? Some might fail if they depend on order, but diff usually is ordered.
        // Also "Cannot drop index" might happen again here if it's in the SQL.
      }
    }
    console.log('Migration application finished.');
  } catch (error) {
    console.error('Migration script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
