import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (company) {
    console.log('Empresa encontrada:', company.razaoSocial);
    console.log('Coordenadas antigas:');
    console.log('Latitude:', company.latitude);
    console.log('Longitude:', company.longitude);

    await prisma.company.update({
      where: { id: company.id },
      data: {
        latitude: -22.57085,
        longitude: -47.38796
      }
    });

    console.log('---');
    console.log('Coordenadas corrigidas com sucesso!');
    const updatedCompany = await prisma.company.findUnique({
      where: { id: company.id }
    });
    console.log('Novas Coordenadas:');
    console.log('Latitude:', updatedCompany.latitude);
    console.log('Longitude:', updatedCompany.longitude);
  } else {
    console.log('Nenhuma empresa encontrada no banco para atualizar.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
