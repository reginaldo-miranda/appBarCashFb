import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const recent = await prisma.sale.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- Ultimas 5 vendas criadas ---');
  recent.forEach(s => console.log(`ID: ${s.id} Status: ${s.status} DataVenda: ${s.dataVenda} Total: ${s.total}`));

  const recentUpdated = await prisma.sale.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });
  console.log('--- Ultimas 5 vendas atualizadas ---');
  recentUpdated.forEach(s => console.log(`ID: ${s.id} Status: ${s.status} DataVenda: ${s.dataVenda} Total: ${s.total}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
