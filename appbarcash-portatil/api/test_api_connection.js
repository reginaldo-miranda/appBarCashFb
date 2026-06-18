
import axios from 'axios';

console.log('Testando conexão com a API...');

async function testApi() {
  try {
    const res = await axios.get('http://localhost:4000/api/health', { timeout: 2000 });
    console.log('✅ API está rodando!', res.data);
  } catch (e) {
    console.error('❌ Falha na conexão com a API:', e.message);
    if (e.code === 'ECONNREFUSED' || (e.message && e.message.includes('ECONNREFUSED'))) {
      console.error('   Dica: O servidor pode não estar rodando na porta 4000.');
      console.error('   Verifique se o processo da API foi iniciado corretamente.');
    }
  }
}

testApi();
