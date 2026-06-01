import { getActivePrisma } from '../lib/prisma.js';

async function run() {
  try {
    const prisma = getActivePrisma();
    
    console.log('🧪 Iniciando teste de simulação com IDs REAIS de setores (Cozinha = 1)...\n');

    // 1. Criar uma venda temporária do tipo 'balcao' com status 'aberta'
    console.log('➕ Criando venda Balcão Aberta temporária...');
    const venda = await prisma.sale.create({
      data: {
        status: 'aberta',
        tipoVenda: 'balcao',
        subtotal: 35.00,
        desconto: 0,
        total: 35.00,
        formaPagamento: 'dinheiro',
      }
    });
    console.log(` Venda temporária criada. ID: ${venda.id}, Status: ${venda.status}, Tipo: ${venda.tipoVenda}`);

    // 2. Adicionar ao SaleItem:
    // - Um produto COM setor (ex: Bauru Teste QA cozinha - ID 7 - Setor Cozinha - ID 1)
    // - Um produto SEM setor (ex: Porção de Calabresa - ID 8 - Sem Setor)
    console.log('\n➕ Adicionando itens à venda temporária...');
    
    // Produto com setor
    const itemComSetor = await prisma.saleItem.create({
      data: {
        saleId: venda.id,
        productId: 7, // Bauru Teste QA cozinha
        nomeProduto: 'Bauru Teste QA cozinha (Com Setor)',
        quantidade: 1,
        precoUnitario: 12.00,
        subtotal: 12.00,
        status: 'pendente',
      }
    });

    // Produto sem setor
    const itemSemSetor = await prisma.saleItem.create({
      data: {
        saleId: venda.id,
        productId: 8, // porcao de calabresa
        nomeProduto: 'porcao de calabresa (Sem Setor)',
        quantidade: 1,
        precoUnitario: 23.00,
        subtotal: 23.00,
        status: 'pendente',
      }
    });

    console.log(` Item com Setor adicionado: ID ${itemComSetor.id}`);
    console.log(` Item sem Setor adicionado: ID ${itemSemSetor.id}`);

    // Setores reais do banco
    const setorCozinhaId = 1; // Cozinha real = ID 1

    // ==========================================
    // TESTE 1: QUERY COM STRICT=1 (isStrict = true)
    // ==========================================
    console.log('\n🔍 Executando QUERY ORIGINAL com strict=1 para o setor Cozinha (ID 1)...');
    
    const sqlStrict = `
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

    const resStrict = await prisma.$queryRawUnsafe(sqlStrict, 'pendente', setorCozinhaId, venda.id);
    console.log(`\n📋 Resultado com QUERY ORIGINAL (Retornou ${resStrict.length} itens):`);
    resStrict.forEach(it => {
      console.log(`   - [ID: ${it.id}] ${it.nomeProduto} | Venda Status: ${it.vendaStatus}`);
    });

    // ==========================================
    // TESTE 2: QUERY CORRIGIDA COM STRICT=1 (Permitindo Aberta no Fallback)
    // ==========================================
    console.log('\n⚙️ Executando QUERY CORRIGIDA com strict=1 para o setor Cozinha (ID 1)...');
    
    const sqlCorrigida = `
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
            AND sa.status IN ('aberta', 'finalizada')
          )
        )
        AND sa.id = ?
    `;

    const resCorrigida = await prisma.$queryRawUnsafe(sqlCorrigida, 'pendente', setorCozinhaId, venda.id);
    console.log(`\n📋 Resultado com QUERY CORRIGIDA (Retornou ${resCorrigida.length} itens):`);
    resCorrigida.forEach(it => {
      console.log(`   - [ID: ${it.id}] ${it.nomeProduto} | Venda Status: ${it.vendaStatus}`);
    });

    // Clean up
    console.log('\n🧹 Limpando dados temporários de teste...');
    await prisma.saleItem.deleteMany({ where: { saleId: venda.id } });
    await prisma.sale.delete({ where: { id: venda.id } });
    console.log(' Dados de teste limpos com sucesso!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no script de teste:', error);
    process.exit(1);
  }
}

run();
