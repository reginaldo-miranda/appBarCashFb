import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🔍 Buscando produtos no banco de dados...');
    
    const produtos = await prisma.product.findMany({
      where: {
        ativo: true,
      },
      include: {
        setoresImpressao: {
          include: {
            setor: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });

    console.log(`\n📊 Total de produtos ativos encontrados: ${produtos.length}`);

    const semSetor = [];
    const comSetor = [];

    produtos.forEach((prod) => {
      const setoresAtivos = prod.setoresImpressao
        .filter((psi) => psi.setor && psi.setor.ativo)
        .map((psi) => psi.setor.nome);

      if (setoresAtivos.length === 0) {
        semSetor.push({
          id: prod.id,
          nome: prod.nome,
          categoria: prod.categoria || 'Não informada',
          preco: Number(prod.precoVenda).toFixed(2),
        });
      } else {
        comSetor.push({
          id: prod.id,
          nome: prod.nome,
          categoria: prod.categoria || 'Não informada',
          preco: Number(prod.precoVenda).toFixed(2),
          setores: setoresAtivos.join(', '),
        });
      }
    });

    console.log('\n==================================================================');
    console.log(`❌ PRODUTOS SEM SETOR DE IMPRESSÃO CADASTRADO (${semSetor.length}):`);
    console.log('==================================================================');
    if (semSetor.length === 0) {
      console.log('Nenhum produto sem setor de impressão.');
    } else {
      semSetor.forEach((p) => {
        console.log(`[ID: ${p.id.toString().padStart(4, ' ')}] - ${p.nome.padEnd(35, ' ')} | R$ ${p.preco.padStart(6, ' ')} | Cat: ${p.categoria}`);
      });
    }

    console.log('\n==================================================================');
    console.log(`✅ PRODUTOS COM SETOR DE IMPRESSÃO CADASTRADO (${comSetor.length}):`);
    console.log('==================================================================');
    if (comSetor.length === 0) {
      console.log('Nenhum produto com setor de impressão.');
    } else {
      comSetor.forEach((p) => {
        console.log(`[ID: ${p.id.toString().padStart(4, ' ')}] - ${p.nome.padEnd(35, ' ')} | R$ ${p.preco.padStart(6, ' ')} | Setor: ${p.setores}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao listar produtos e setores:', error);
    process.exit(1);
  }
}

run();
