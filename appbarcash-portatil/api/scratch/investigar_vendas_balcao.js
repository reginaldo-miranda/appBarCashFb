import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🔍 Buscando as 5 últimas vendas do tipo "balcao" ou "delivery"...');
    
    const vendas = await prisma.sale.findMany({
      where: {
        tipoVenda: {
          in: ['balcao', 'delivery']
        }
      },
      orderBy: {
        id: 'desc'
      },
      take: 5,
      include: {
        itens: true
      }
    });

    console.log(`\n📊 Vendas encontradas: ${vendas.length}`);
    vendas.forEach(v => {
      console.log(`\n[Venda ID: ${v.id}] Status: "${v.status}" | Tipo: "${v.tipoVenda}" | Data: ${v.dataVenda}`);
      console.log(`Itens da venda (${v.itens.length}):`);
      v.itens.forEach(it => {
        console.log(`  - Item ID ${it.id}: "${it.nomeProduto}" | Qtd: ${it.quantidade} | Status Preparação: "${it.status}"`);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
