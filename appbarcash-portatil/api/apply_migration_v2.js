import fs from 'fs';
import prisma from './lib/prisma.js';

async function applyMigration() {
  try {
    const sql = fs.readFileSync('migration_diff_utf8.sql', 'utf8');
    
    // Split by semicolon, but simple split is risky if string literals contain semicolon.
    // However, looking at the file, it's standard DDL.
    // We can filter out empty lines and comments more robustly.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    for (const statement of statements) {
      if (statement.startsWith('--')) {
        // Multi-line comment block handling or single line?
        // The split might result in a string starting with comment lines.
        // Let's remove comment lines from the statement.
        const cleanStatement = statement
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
          
        if (cleanStatement.length === 0) continue;
        
        try {
          await prisma.$executeRawUnsafe(cleanStatement);
          console.log(`Executed: ${cleanStatement.substring(0, 30)}...`);
        } catch (err) {
          console.error(`Failed: ${cleanStatement.substring(0, 30)}... Error: ${err.message}`);
        }
      } else {
         try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`Executed: ${statement.substring(0, 30)}...`);
        } catch (err) {
          console.error(`Failed: ${statement.substring(0, 30)}... Error: ${err.message}`);
        }
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
