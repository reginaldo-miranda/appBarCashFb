import { getActivePrisma } from '../lib/prisma.js';

const mapProduct = (p) => {
  const num = (v) => Number(v);
  return {
    _id: String(p.id),
    id: p.id,
    nome: p.nome,
    setoresImpressaoIds: Array.isArray(p.setoresImpressao)
      ? p.setoresImpressao.map(psi => psi.setorId)
      : (Array.isArray(p.setoresImpressaoIds) ? p.setoresImpressaoIds : []),
  };
};

async function run() {
  try {
    const prisma = getActivePrisma();
    const products = await prisma.product.findMany({ 
      where: { ativo: true }, 
      include: { tamanhos: true, setoresImpressao: true },
      orderBy: { dataInclusao: 'desc' } 
    });

    console.log(`\n📋 Itens mapeados: ${products.length}`);
    products.map(mapProduct).forEach(p => {
      console.log(`- Produto: ${p.nome} | setoresImpressaoIds =`, p.setoresImpressaoIds);
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
