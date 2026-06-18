
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- Checking Company pointsPerCurrency ---');
  try {
    const company = await prisma.company.findFirst();
    if (company) {
        console.log('ID:', company.id);
        console.log('Cashback:', company.cashbackPercent);
        console.log('PointsPerCurrency:', company.pointsPerCurrency);
        console.log('PontosResgate:', company.pontosParaResgate);
    } else {
        console.log('No company found.');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
