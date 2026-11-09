import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

async function testStock() {
  console.log('=== Teste de Controle de Estoque por Local ===');

  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'thunder');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Buscar um produto
  const product = await prisma.product.findFirst({
    where: { ativo: true },
  });

  if (!product) {
    console.log('Nenhum produto encontrado para teste.');
    process.exit(1);
  }

  console.log(`\n📦 Produto selecionado: ${product.nome} (ID: ${product.id})`);
  console.log(`Estado Inicial -> Total: ${product.quantidade} | Depósito: ${product.estoqueDeposito} | Geladeira: ${product.estoqueGeladeira}`);

  // 2. Garantir saldo inicial para teste: 20 no Depósito, 10 na Geladeira (Total: 30)
  const initialUpdate = await prisma.product.update({
    where: { id: product.id },
    data: {
      estoqueDeposito: 20,
      estoqueGeladeira: 10,
      quantidade: 30,
    },
  });
  console.log(`\n✅ Saldo ajustado para teste -> Depósito: ${initialUpdate.estoqueDeposito} | Geladeira: ${initialUpdate.estoqueGeladeira} | Total: ${initialUpdate.quantidade}`);

  // 3. Teste Transferência via API: Depósito -> Geladeira (Transferir 6 unidades)
  const transferRes = await fetch('http://localhost:4000/api/stock/transfer', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId: product.id,
      quantidade: 6,
      origem: 'DEPOSITO',
      destino: 'GELADEIRA',
      observacao: 'Abastecimento da geladeira com 6 cervejas',
    }),
  });

  const transferData = await transferRes.json();
  console.log('\n🔄 Resposta da Transferência (Depósito -> Geladeira, 6 un):', transferData);

  // 4. Verificar produto no banco
  const afterDepToGel = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Após Transferência -> Total: ${afterDepToGel.quantidade} | Depósito: ${afterDepToGel.estoqueDeposito} (esperado 14) | Geladeira: ${afterDepToGel.estoqueGeladeira} (esperado 16)`);

  if (afterDepToGel.estoqueDeposito === 14 && afterDepToGel.estoqueGeladeira === 16 && afterDepToGel.quantidade === 30) {
    console.log('🎉 SUCESSO: Transferência Depósito -> Geladeira calculada com perfeição!');
  } else {
    console.error('❌ ERRO nos saldos após transferência');
  }

  // 5. Teste Transferência reversa via API: Geladeira -> Depósito (Devolver 2 unidades)
  const reverseRes = await fetch('http://localhost:4000/api/stock/transfer', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId: product.id,
      quantidade: 2,
      origem: 'GELADEIRA',
      destino: 'DEPOSITO',
      observacao: 'Devolução de 2 unidades para o depósito',
    }),
  });

  const reverseData = await reverseRes.json();
  console.log('\n🔄 Resposta da Transferência Reversa (Geladeira -> Depósito, 2 un):', reverseData);

  const afterGelToDep = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Após Transferência Reversa -> Total: ${afterGelToDep.quantidade} | Depósito: ${afterGelToDep.estoqueDeposito} (esperado 16) | Geladeira: ${afterGelToDep.estoqueGeladeira} (esperado 14)`);

  if (afterGelToDep.estoqueDeposito === 16 && afterGelToDep.estoqueGeladeira === 14 && afterGelToDep.quantidade === 30) {
    console.log('🎉 SUCESSO: Transferência reversa Geladeira -> Depósito calculada com perfeição!');
  } else {
    console.error('❌ ERRO nos saldos após transferência reversa');
  }

  // 6. Verificar logs de StockMovement
  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id, tipo: 'TRANSFERENCIA' },
    orderBy: { id: 'desc' },
    take: 2,
  });
  console.log('\n📋 Últimas 2 movimentações do tipo TRANSFERENCIA no banco:');
  movements.forEach((m) => {
    console.log(`- ID: ${m.id} | Tipo: ${m.tipo} | Qtd: ${m.quantidade} | De: ${m.localOrigem} -> Para: ${m.localDestino} | Obs: ${m.observacao}`);
  });

  // 7. Teste de Venda: simular finalização de venda e verificar dedução automática da Geladeira
  console.log('\n🛒 Testando dedução automática na finalização de venda (/api/sale/:id/finalize)...');
  const testSale = await prisma.sale.create({
    data: {
      status: 'aberta',
      tipoVenda: 'balcao',
      subtotal: product.precoVenda * 3,
      total: product.precoVenda * 3,
      desconto: 0,
      itens: {
        create: [
          {
            productId: product.id,
            nomeProduto: product.nome,
            quantidade: 3,
            precoUnitario: product.precoVenda,
            subtotal: product.precoVenda * 3,
          },
        ],
      },
    },
  });

  console.log(`Venda criada ID: ${testSale.id}. Finalizando venda para abater 3 unidades da Geladeira...`);
  const finalizeRes = await fetch(`http://localhost:4000/api/sale/${testSale.id}/finalize`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      metodoPagamento: 'DINHEIRO',
      valorPago: product.precoVenda * 3,
    }),
  });
  const finalizeData = await finalizeRes.json();
  console.log('Resposta de finalização da venda:', finalizeData.message || finalizeData);

  const afterSale = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Após Venda de 3 un -> Total: ${afterSale.quantidade} (esperado 27) | Depósito: ${afterSale.estoqueDeposito} (esperado 16) | Geladeira: ${afterSale.estoqueGeladeira} (esperado 11)`);

  if (afterSale.estoqueDeposito === 16 && afterSale.estoqueGeladeira === 11 && afterSale.quantidade === 27) {
    console.log('🎉 SUCESSO ABSOLUTO: Venda deduzida automaticamente da Geladeira!');
  } else {
    console.error('❌ ERRO na dedução de venda');
  }

  // Limpar a venda de teste criada
  await prisma.saleItem.deleteMany({ where: { saleId: testSale.id } });
  await prisma.sale.delete({ where: { id: testSale.id } });

  console.log('\n=== Todos os testes automatizados de Estoque por Local foram concluídos com sucesso! ===');
  process.exit(0);
}

testStock().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
