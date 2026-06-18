import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:saguides%40123@localhost:3306/appBarCash"
    }
  }
});

async function main() {
  console.log("🔍 Iniciando teste de diagnóstico de vendas de Balcão e Tablets...");

  try {
    // 1. Obter um setor de impressão ativo (ex: Cozinha ou Bar)
    const setores = await prisma.setorImpressao.findMany({ where: { ativo: true } });
    if (setores.length === 0) {
      console.log("❌ Nenhum setor de impressão ativo encontrado. Por favor, crie um setor ativo primeiro.");
      process.exit(1);
    }
    const setor = setores[0];
    console.log(`✅ Setor ativo encontrado: ID ${setor.id} - ${setor.nome}`);

    // 2. Obter ou criar um produto de teste
    let produto = await prisma.product.findFirst({ where: { ativo: true } });
    if (!produto) {
      console.log("🧪 Criando produto de teste...");
      produto = await prisma.product.create({
        data: {
          nome: "Produto Teste Cozinha",
          precoCusto: 5.0,
          precoVenda: 10.0,
          ativo: true,
          quantidade: 10
        }
      });
    }
    console.log(`✅ Produto de teste: ID ${produto.id} - ${produto.nome}`);

    // 3. Vincular produto ao setor
    const vinculo = await prisma.productSetorImpressao.findUnique({
      where: {
        productId_setorId: {
          productId: produto.id,
          setorId: setor.id
        }
      }
    });

    if (!vinculo) {
      console.log("🔗 Vinculando produto ao setor de impressão...");
      await prisma.productSetorImpressao.create({
        data: {
          productId: produto.id,
          setorId: setor.id
        }
      });
    }

    // 4. Obter um funcionário ativo para abertura
    let funcionario = await prisma.employee.findFirst({ where: { ativo: true } });
    if (!funcionario) {
      console.log("🧪 Criando funcionário de teste...");
      funcionario = await prisma.employee.create({
        data: {
          nome: "Atendente Teste",
          cargo: "Atendente",
          ativo: true
        }
      });
    }

    // 5. Criar uma venda de Balcão FINALIZADA diretamente para teste
    console.log("🛒 Criando venda de Balcão Finalizada...");
    const vendaBalcaoFinalizada = await prisma.sale.create({
      data: {
        tipoVenda: "balcao",
        status: "finalizada",
        subtotal: 10.0,
        desconto: 0.0,
        total: 10.0,
        formaPagamento: "dinheiro",
        funcionarioId: funcionario.id,
        dataVenda: new Date(),
        dataFinalizacao: new Date()
      }
    });

    // 6. Criar item pendente nessa venda
    console.log("➕ Adicionando item 'pendente' na venda de Balcão Finalizada...");
    const item = await prisma.saleItem.create({
      data: {
        saleId: vendaBalcaoFinalizada.id,
        productId: produto.id,
        nomeProduto: produto.nome,
        quantidade: 1,
        precoUnitario: 10.0,
        subtotal: 10.0,
        status: "pendente",
        origem: "tablet"
      }
    });

    // 7. Simular a query SQL de queue do backend
    console.log("🖥️ Simulando a query do backend para o tablet...");
    const statusFiltro = "pendente";
    const sql = `
      SELECT 
        si.id,
        si.saleId,
        si.nomeProduto,
        si.quantidade,
        si.status,
        si.createdAt,
        sa.tipoVenda as tipoVenda,
        sa.status as saleStatus,
        psi.setorId
      FROM SaleItem si
      LEFT JOIN ProductSetorImpressao psi ON psi.productId = si.productId
      INNER JOIN Sale sa ON sa.id = si.saleId
      WHERE si.status = ?
        AND (sa.status = 'aberta' OR (sa.status = 'finalizada' AND sa.tipoVenda IN ('balcao', 'delivery')))
        AND (
          psi.setorId = ?
          OR (
            psi.setorId IS NULL
          )
        )
      ORDER BY si.createdAt ASC
    `;

    const results = await prisma.$queryRawUnsafe(sql, statusFiltro, setor.id);
    console.log("📊 Resultados da Query do Backend:");
    console.log(JSON.stringify(results, null, 2));

    if (results.length > 0) {
      console.log("🎉 SUCESSO: O item de balcão finalizado foi retornado pela query!");
    } else {
      console.log("❌ FALHA: O item de balcão finalizado NÃO foi retornado pela query.");
    }

    // Limpar os dados de teste criados para não sujar o banco
    console.log("🧹 Limpando dados do teste de diagnóstico...");
    await prisma.saleItem.delete({ where: { id: item.id } });
    await prisma.sale.delete({ where: { id: vendaBalcaoFinalizada.id } });

  } catch (error) {
    console.error("❌ Ocorreu um erro no teste de diagnóstico:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
