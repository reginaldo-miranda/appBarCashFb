import prisma from './lib/prisma.js';

async function verifyFinal() {
  try {
    const nfces = await prisma.$queryRaw`SELECT * FROM Nfce LIMIT 1`;
    console.log('Nfce table exists now:', true);
  } catch (error) {
    console.error('Final verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFinal();
