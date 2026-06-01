import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🧪 Iniciando teste de query com suporte a status "pago"...');

    // 1. Criar uma venda finalizada temporária
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
    console.log(` Venda criada. ID: ${venda.id}`);

    // 2. Adicionar um item com status de preparação 'pago' (como ocorre no balcão finalizado)
    const item = await prisma.saleItem.create({
      data: {
        saleId: venda.id,
        productId: 7, 
        nomeProduto: 'Bauru Teste QA cozinha (Status PAGO)',
        quantidade: 1,
        precoUnitario: 12.00,
        subtotal: 12.00,
        status: 'pago', // <--- O status real gravado no balcão finalizado!
      }
    });
    console.log(` Item adicionado: ID ${item.id}, Status do Item: ${item.status}`);

    const setorCozinhaId = 1;

    // 3. Executar a nova query SQL com a correção proposta para 'pago'
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
      WHERE (si.status = ? OR (si.status = 'pago' AND ? = 'pendente'))
        AND (sa.status = 'aberta' OR (sa.status = 'finalizada' AND sa.tipoVenda IN ('balcao', 'delivery')))
        AND (
          psi.setorId = ?
          OR (
            psi.setorId IS NULL
            AND sa.tipoVenda IN ('balcao', 'delivery')
            AND sa.status IN ('aberta', 'finalizada')
          )
        )
        AND sa.id = ?
    `;

    const res = await prisma.$queryRawUnsafe(sql, 'pendente', 'pendente', setorCozinhaId, venda.id);
    console.log(`\n📋 Resultado da query buscando 'pendente' (Retornou ${res.length} itens):`);
    res.forEach(it => {
      console.log(`   - [ID: ${it.id}] ${it.nomeProduto} | Item Status: "${it.status}" | Venda Status: "${it.vendaStatus}"`);
    });

    // Clean up
    console.log('\n🧹 Limpando dados temporários...');
    await prisma.saleItem.deleteMany({ where: { saleId: venda.id } });
    await prisma.sale.delete({ where: { id: venda.id } });
    console.log(' Concluído com absoluto sucesso!');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
