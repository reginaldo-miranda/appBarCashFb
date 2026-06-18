import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check if any printer exists
  const count = await prisma.printer.count();
  if (count > 0) {
    console.log('Printers already exist. Skipping seed.');
    return;
  }

  const printer = await prisma.printer.create({
    data: {
      nome: 'Impressora Delivery',
      modelo: 'Generic Text',
      address: 'USB001',
      driver: 'text',
      ativo: true
    }
  });
  console.log('Printer created:', printer);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
