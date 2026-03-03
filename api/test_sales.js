import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://127.0.0.1:4000/sale/list');
    let sales = res.data;
    if (typeof sales === 'string') {
        sales = JSON.parse(sales);
    }
    
    console.log(`Type after parse: ${typeof sales}, isArray: ${Array.isArray(sales)}`);
    console.log(`Total Sales: ${sales.length}`);
    const fiscalSales = sales.filter(s => s.nfce && s.nfce.status === 'AUTORIZADA');
    console.log(`Fiscal Sales (AUTORIZADA): ${fiscalSales.length}`);
    
    if (fiscalSales.length > 0) {
      console.log('Sample fiscal sale nfce field:', fiscalSales[0].nfce);
    }
  } catch(e) { console.error('Error', e.message); }
}

run();
