
import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api';

async function main() {
  try {
    console.log('1. Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@barapp.com',
        senha: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token obtained.');

    console.log('2. Updating Company Config (Setting pontosParaResgate to 111)...');
    const updateRes = await axios.post(`${BASE_URL}/company`, {
        cashbackPercent: 12.3,
        pontosParaResgate: 111,
        valorResgate: 15.5
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Update Status:', updateRes.status);
    console.log('Update Response:', updateRes.data);

    console.log('3. Verifying Update...');
    const getRes = await axios.get(`${BASE_URL}/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Fetched Company:');
    console.log('Cashback:', getRes.data.cashbackPercent);
    console.log('Pontos:', getRes.data.pontosParaResgate);
    console.log('Valor Resgate:', getRes.data.valorResgate);

    if (getRes.data.pontosParaResgate === 111) {
        console.log('SUCCESS: Pontos updated correctly.');
    } else {
        console.log('FAILURE: Pontos NOT updated.');
    }

  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}

main();
