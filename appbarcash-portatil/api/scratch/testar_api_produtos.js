import pkg from 'supertest';
import express from 'express';
import productRouter from '../routes/product.js';

async function run() {
  try {
    const app = express();
    app.use(express.json());
    app.use('/product', productRouter);

    console.log('📡 Chamando API local GET /product/list...');
    
    // Como supertest precisa de uma instância HTTP, vamos simular ou chamar direto
    const server = app.listen(0);
    const port = server.address().port;
    
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(`http://localhost:${port}/product/list`);
    const data = await res.json();
    
    console.log(`\n📋 Produtos retornados da API: ${data.length}`);
    data.forEach(p => {
      console.log(`- Produto: ${p.nome} | setoresImpressaoIds =`, p.setoresImpressaoIds);
    });

    server.close();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
