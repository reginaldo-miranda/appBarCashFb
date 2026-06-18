import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPrinters() {
  const printers = await prisma.printer.findMany();
  console.log('Printers found:', printers);
}

checkPrinters()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
