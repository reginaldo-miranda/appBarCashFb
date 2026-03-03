const jwt = require('jsonwebtoken');
const axios = require('axios');

const secret = 'thunder'; // from .env
const token = jwt.sign({ id: 1, email: 'admin@admin.com', role: 'admin' }, secret, { expiresIn: '1h' });

async function run() {
  try {
    const res = await axios.get('http://127.0.0.1:4000/api/sale/open', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const sales = res.data;
    console.log(`Total Sales returned: ${sales.length}`);
    sales.slice(0, 5).forEach(s => {
      console.log(`Sale ${s.id} -> nfce: ${JSON.stringify(s.nfce)}`);
    });
  } catch (err) {
    console.error('Error fetching API:', err.response ? err.response.data : err.message);
  }
}

run();
