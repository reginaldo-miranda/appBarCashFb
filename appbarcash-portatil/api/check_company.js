import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  console.log('=== Configuração da Empresa ===');
  if (company) {
    console.log('Razão Social:', company.razaoSocial);
    console.log('Nome Fantasia:', company.nomeFantasia);
    console.log('Latitude:', company.latitude);
    console.log('Longitude:', company.longitude);
    console.log('Raio de entrega:', company.deliveryRadius);
    console.log('CSC:', company.csc);
    console.log('CSC ID:', company.cscId);
  } else {
    console.log('Nenhuma empresa encontrada no banco!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
