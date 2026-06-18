
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConfig() {
  try {
    const company = await prisma.company.findFirst();
    if (company) {
        console.log(`XML Folder Configured: ${company.xmlFolder}`);
    } else {
        console.log('Company not found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
