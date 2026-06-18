
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- Company Data Check ---');
  try {
    const company = await prisma.company.findFirst();
    if (company) {
        console.log('Successfully fetched company.');
        console.log('Configs:', {
            id: company.id,
            cashbackPercent: company.cashbackPercent,
            pointsPerCurrency: company.pointsPerCurrency
        });
    } else {
        console.log('No company found.');
    }
  } catch (e) {
    console.error('Company Check Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
