import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('--- SETORES DE IMPRESSÃO ---');
    const setores = await prisma.setorImpressao.findMany();
    setores.forEach(s => {
      console.log(`[ID: ${s.id}] Nome: ${s.nome} | Ativo: ${s.ativo}`);
    });
    
    console.log('\n--- VÍNCULOS DO PRODUTO ID 7 ---');
    const vinculos = await prisma.productSetorImpressao.findMany({
      where: { productId: 7 },
      include: { setor: true }
    });
    
    if (vinculos.length === 0) {
      console.log('Produto ID 7 não possui vínculos.');
    } else {
      vinculos.forEach(v => {
        console.log(`Produto ID 7 está vinculado ao Setor ID ${v.setorId} (${v.setor.nome})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
