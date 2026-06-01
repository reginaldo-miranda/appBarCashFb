import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🧪 Iniciando teste de query para venda balcão FINALIZADA...');

    // 1. Criar uma venda do tipo 'balcao' com status 'finalizada'
    console.log('➕ Criando venda Balcão Finalizada temporária...');
    const venda = await prisma.sale.create({
      data: {
        status: 'finalizada',
        tipoVenda: 'balcao',
        subtotal: 12.00,
        desconto: 0,
        total: 12.00,
        formaPagamento: 'dinheiro',
        dataFinalizacao: new Date(),
      }
    });
    console.log(` Venda finalizada criada. ID: ${venda.id}`);

    // 2. Adicionar ao SaleItem um produto com setor (Bauru Teste QA cozinha - ID 7 - Setor Cozinha - ID 1)
    const item = await prisma.saleItem.create({
      data: {
        saleId: venda.id,
        productId: 7, 
        nomeProduto: 'Bauru Teste QA cozinha (Com Setor)',
        quantidade: 1,
        precoUnitario: 12.00,
        subtotal: 12.00,
        status: 'pendente', // IMPORTANTE: O status inicial na fila é sempre 'pendente'!
      }
    });
    console.log(` Item adicionado: ID ${item.id}, Status do Item: ${item.status}`);

    const setorCozinhaId = 1;

    // 3. Executar a query SQL exata da API com strict=1
    const sql = `
      SELECT 
        si.id,
        si.nomeProduto,
        si.quantidade,
        si.status,
        sa.tipoVenda,
        sa.status as vendaStatus
      FROM SaleItem si
      LEFT JOIN ProductSetorImpressao psi ON psi.productId = si.productId
      INNER JOIN Sale sa ON sa.id = si.saleId
      WHERE si.status = ?
        AND (sa.status = 'aberta' OR (sa.status = 'finalizada' AND sa.tipoVenda IN ('balcao', 'delivery')))
        AND (
          psi.setorId = ?
          OR (
            psi.setorId IS NULL
            AND sa.tipoVenda IN ('balcao', 'delivery')
            AND sa.status = 'finalizada'
          )
        )
        AND sa.id = ?
    `;

    const res = await prisma.$queryRawUnsafe(sql, 'pendente', setorCozinhaId, venda.id);
    console.log(`\n📋 Resultado com strict=1 (Retornou ${res.length} itens):`);
    res.forEach(it => {
      console.log(`   - [ID: ${it.id}] ${it.nomeProduto} | Venda Status: ${it.vendaStatus}`);
    });

    // Clean up
    console.log('\n🧹 Limpando dados temporários...');
    await prisma.saleItem.deleteMany({ where: { saleId: venda.id } });
    await prisma.sale.delete({ where: { id: venda.id } });
    console.log(' Concluído!');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
