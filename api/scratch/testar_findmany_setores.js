import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🔍 Executando findMany de produtos com include: { setoresImpressao: true }...');
    
    const produtos = await prisma.product.findMany({
      where: { ativo: true },
      include: { setoresImpressao: true }
    });

    console.log(`\n📋 Produtos retornados: ${produtos.length}`);
    produtos.forEach(p => {
      console.log(`- Produto ID ${p.id} (${p.nome}): setoresImpressao =`, p.setoresImpressao);
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
