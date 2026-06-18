
import prisma from '../lib/prisma.js';

async function main() {
  try {
    const saleCount = await prisma.sale.count();
    const lastSale = await prisma.sale.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    console.log('--- Sales Data Check ---');
    console.log(`Total Sales: ${saleCount}`);
    if (lastSale) {
        console.log(`Last Sale Date: ${lastSale.createdAt}`);
        console.log(`Last Sale ID: ${lastSale.id}`);
    } else {
        console.log('No sales found.');
    }
    
  } catch (e) {
    console.error('Check failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
