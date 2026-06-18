import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const sales = await prisma.sale.findMany({
    take: 20,
    orderBy: { id: 'desc' }
  });
  console.log("Sales checked:", sales.length);
  const statuses = {};
  let zeroTotal = 0;
  let nonZeroTotal = 0;

  for (const s of sales) {
    statuses[s.status] = (statuses[s.status] || 0) + 1;
    if (Number(s.total) === 0) zeroTotal++;
    else nonZeroTotal++;
    console.log(`Sale ID: ${s.id}, status: ${s.status}, total: ${s.total}`);
  }
  console.log("Statuses:", statuses);
  console.log("Zero Total Count:", zeroTotal, "Non Zero Total Count:", nonZeroTotal);
}

check().catch(console.error).finally(() => prisma.$disconnect());
