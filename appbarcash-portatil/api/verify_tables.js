import prisma from './lib/prisma.js';

async function verifyTables() {
  try {
    console.log('Verifying tables...');
    // Try to query ProductSize table
    const sizes = await prisma.$queryRaw`SELECT * FROM ProductSize LIMIT 1`;
    console.log('ProductSize table exists:', sizes.length >= 0);
    
    // Try to query Nfce table
    const nfces = await prisma.$queryRaw`SELECT * FROM Nfce LIMIT 1`;
    console.log('Nfce table exists:', nfces.length >= 0);
    
    // Try to query Company table which seems new/updated
    const companies = await prisma.$queryRaw`SELECT * FROM Company LIMIT 1`;
    console.log('Company table exists:', companies.length >= 0);

  } catch (error) {
    console.error('Table verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTables();
