import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDeliveries() {
  console.log('--- Checking Delivery Sales Prices ---');
  const deliveries = await prisma.sale.findMany({
    where: { isDelivery: true },
    select: {
      id: true,
      status: true,
      deliveryStatus: true,
      total: true,       // Checking this
      subtotal: true,    // Checking this
      deliveryFee: true, // Checking this
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (deliveries.length === 0) {
    console.log('No sales with isDelivery=true found.');
  } else {
    console.table(deliveries);
  }
}

checkDeliveries()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
