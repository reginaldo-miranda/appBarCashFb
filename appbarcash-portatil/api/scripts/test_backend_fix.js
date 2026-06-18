
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
    console.log('Login successful.');

    console.log('2. Updating via API with pointsPerCurrency explicitly set...');
    const updateRes = await axios.post(`${BASE_URL}/company`, {
        cashbackPercent: 12.3,
        pontosParaResgate: 111,
        valorResgate: 15.5,
        pointsPerCurrency: 1 // This is the key fix
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Update Status:', updateRes.status);
    console.log('Update Response:', updateRes.data);

  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}

main();
