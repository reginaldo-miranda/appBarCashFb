import axios from 'axios';

async function testStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Buscando vendas no intervalo: ${startOfDay.toISOString()} ─ ${endOfDay.toISOString()}`);

  console.time('saleListRequest');
  try {
    const res = await axios.get('http://192.168.0.176:4000/api/sale/list', { 
      params: { 
        dataInicio: startOfDay.toISOString(), 
        dataFim: endOfDay.toISOString() 
      } 
    });
    console.timeEnd('saleListRequest');
    console.log(`Vendas retornadas: ${res.data.length}`);
  } catch (err) {
    console.timeEnd('saleListRequest');
    console.error('Erro sale/list:', err.message);
  }

  console.time('openSalesRequest');
  try {
    const res = await axios.get('http://192.168.0.176:4000/api/sale/open');
    console.timeEnd('openSalesRequest');
    console.log(`Vendas abertas retornadas: ${res.data.length}`);
  } catch(err) {
    console.timeEnd('openSalesRequest');
    console.error('Erro /open:', err.message);
  }

  console.time('customerSearch');
  try {
    const res = await axios.get('http://192.168.0.176:4000/api/customer/list', { params: { nome: 'te' } });
    console.timeEnd('customerSearch');
    console.log(`Clientes encontrados com 'te': ${res.data.length}`);
    if (res.data.length > 0) {
      console.log('Exemplo 1:', res.data[0].nome, res.data[0].cpf);
    }
  } catch(err) {
    console.timeEnd('customerSearch');
    console.error('Erro /customer/list:', err.message);
  }
}

testStats();
