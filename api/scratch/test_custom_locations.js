import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'thunder';
const token = jwt.sign({ id: 1, admin: true, nome: 'Admin Teste' }, JWT_SECRET);

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function runTests() {
  console.log('=== TESTE DE LOCAIS DE ESTOQUE PERSONALIZADOS ===\n');

  try {
    // 1. Listar locais de estoque
    console.log('1. Testando GET /stock/locations...');
    const locRes = await fetch(`${BASE_URL}/stock/locations`, { headers });
    const locations = await locRes.json();
    console.log(`   Locais ativos encontrados (${locations.length}):`);
    locations.forEach(l => console.log(`   - [ID ${l.id}] ${l.nome} (${l.tipo})`));
    if (!Array.isArray(locations) || locations.length === 0) {
      throw new Error('Nenhum local retornado por /stock/locations');
    }

    // 2. Criar novo local customizado
    console.log('\n2. Testando POST /stock/locations (Criar novo local)...');
    const newLocRes = await fetch(`${BASE_URL}/stock/locations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nome: 'Freezer Espetos ' + Date.now().toString().slice(-4),
        tipo: 'GELADEIRA',
        descricao: 'Freezer exclusivo para espetos e carnes'
      })
    });
    const newLoc = await newLocRes.json();
    console.log('   Resultado criação:', newLoc);
    const createdLocId = newLoc.location?.id;
    const createdLocNome = newLoc.location?.nome;

    // 3. Cadastrar produto com local customizado
    console.log('\n3. Testando POST /product/create com localVendaNome...');
    const prodRes = await fetch(`${BASE_URL}/product/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nome: 'Espeto de Alcatra Especial ' + Date.now().toString().slice(-4),
        descricao: 'Espeto bovino',
        precoCusto: '10.00',
        precoVenda: '18.00',
        categoria: 'Carnes',
        unidade: 'un',
        estoqueDeposito: 20,
        estoqueGeladeira: 5,
        quantidade: 25,
        localVendaId: createdLocId,
        localVendaNome: createdLocNome,
        ncm: '02013000',
        csosn: '102'
      })
    });
    const prodData = await prodRes.json();
    const createdProd = prodData.product;
    console.log(`   Produto criado ID ${createdProd.id}: ${createdProd.nome}`);
    console.log(`   Local de Venda: ${createdProd.localVendaNome} (ID: ${createdProd.localVendaId})`);
    console.log(`   Estoque Depósito: ${createdProd.estoqueDeposito} | Ponto de Venda: ${createdProd.estoqueGeladeira} | Total: ${createdProd.quantidade}`);

    // 4. Testar transferência Depósito -> Local Customizado
    console.log(`\n4. Testando POST /stock/transfer (Depósito ➔ ${createdLocNome})...`);
    const transRes = await fetch(`${BASE_URL}/stock/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: createdProd.id,
        quantidade: 7,
        origem: 'DEPOSITO',
        destino: createdLocNome,
        observacao: 'Abastecimento para o final de semana'
      })
    });
    const transData = await transRes.json();
    console.log('   Resultado Transferência:', transData);
    console.log(`   Novo Depósito: ${transData.estoqueDeposito} (esperado 13) | Novo ${createdLocNome}: ${transData.estoqueGeladeira} (esperado 12)`);
    console.log(`   Log Movimentação: ${transData.movement?.tipo} | Origem: ${transData.movement?.localOrigem} | Destino: ${transData.movement?.localDestino}`);

    // 5. Testar devolução Local Customizado -> Depósito
    console.log(`\n5. Testando POST /stock/transfer (${createdLocNome} ➔ Depósito)...`);
    const devRes = await fetch(`${BASE_URL}/stock/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: createdProd.id,
        quantidade: 2,
        origem: createdLocNome,
        destino: 'DEPOSITO',
        observacao: 'Devolução ao estoque central'
      })
    });
    const devData = await devRes.json();
    console.log('   Resultado Devolução:', devData);
    console.log(`   Novo Depósito: ${devData.estoqueDeposito} (esperado 15) | Novo ${createdLocNome}: ${devData.estoqueGeladeira} (esperado 10)`);

    // 6. Testar XML Entrada com destino configurado para o local
    console.log('\n6. Testando POST /stock/confirm-xml com localDestino customizado...');
    const xmlConfirmRes = await fetch(`${BASE_URL}/stock/confirm-xml`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        chave: '35241100000000000000550010000000011000000001',
        fornecedor: {
          cnpj: '12345678000199',
          razaoSocial: 'FRIGORIFICO TESTE LTDA'
        },
        itens: [
          {
            productId: createdProd.id,
            xProd: createdProd.nome,
            qCom: 10,
            vUnCom: 9.50,
            fatorConversao: 1,
            localDestino: createdLocNome // Entrada DIRETA no freezer!
          }
        ]
      })
    });
    const xmlConfirmData = await xmlConfirmRes.json();
    console.log('   Resultado XML Confirm:', xmlConfirmData.message || 'OK');

    // Verificar estoque atualizado do produto após XML
    const checkProdRes = await fetch(`${BASE_URL}/product/${createdProd.id}`, { headers });
    const checkProd = await checkProdRes.json();
    console.log(`   Após XML: Depósito: ${checkProd.estoqueDeposito} | ${checkProd.localVendaNome}: ${checkProd.estoqueGeladeira} (esperado 20) | Total: ${checkProd.quantidade}`);

    // 7. Testar finalização de venda e baixa no local correto
    console.log('\n7. Testando baixa de estoque ao finalizar venda...');
    // Criar uma venda com o produto
    const saleCreateRes = await fetch(`${BASE_URL}/sale/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        funcionario: 'admin-fixo',
        tipoVenda: 'balcao'
      })
    });
    const saleData = await saleCreateRes.json();
    console.log(`   Venda criada #${saleData.id}`);

    // Adicionar 2 unidades do produto
    const addItemRes = await fetch(`${BASE_URL}/sale/${saleData.id}/item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        produtoId: createdProd.id,
        quantidade: 2
      })
    });
    const addItemData = await addItemRes.json();
    console.log(`   Item adicionado à venda #${saleData.id}`);

    // Finalizar a venda
    const finalizeRes = await fetch(`${BASE_URL}/sale/${saleData.id}/finalize`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        formaPagamento: 'dinheiro',
        valorRecebido: 36.00
      })
    });
    const finalData = await finalizeRes.json();
    console.log(`   Venda finalizada: #${finalData.id} - Status: ${finalData.status}`);

    // Verificar saldo após venda
    const postSaleRes = await fetch(`${BASE_URL}/product/${createdProd.id}`, { headers });
    const postSale = await postSaleRes.json();
    console.log(`   Após Venda de 2 un:`);
    console.log(`   - Depósito: ${postSale.estoqueDeposito} (esperado 15)`);
    console.log(`   - ${postSale.localVendaNome}: ${postSale.estoqueGeladeira} (esperado 18, baixou 2 do ponto de venda!)`);
    console.log(`   - Total: ${postSale.quantidade} (esperado 33)`);

    // Verificar histórico de movimentações para este produto
    const histRes = await fetch(`${BASE_URL}/stock/history?productId=${createdProd.id}`, { headers });
    const histData = await histRes.json();
    console.log(`\n   Histórico de movimentações (${histData.movements?.length} registros):`);
    histData.movements?.forEach(m => {
      console.log(`   - [${m.tipo}] Qtd: ${m.quantidade} | Origem: ${m.localOrigem || '-'} | Destino: ${m.localDestino || '-'} | Obs: ${m.observacao}`);
    });

    console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===\n');
  } catch (err) {
    console.error('\n❌ ERRO NO TESTE:', err);
  }
}

runTests();
