const BASE_URL = 'http://localhost:4000/api';

async function run() {
  try {
    console.log('1. Login...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@barapp.com', password: '123456' })
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login OK. Token obtained.');

    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('2. Creating Test Category...');
    const catRes = await fetch(`${BASE_URL}/categoria/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nome: 'DebugCat_' + Date.now(), descricao: 'Teste de API' })
    });
    const catData = await catRes.json();
    const categoryId = catData.categoria.id;
    console.log(`Category Created: ${categoryId}`);

    console.log('3. Creating Test Product linked to Category...');
    const prodRes = await fetch(`${BASE_URL}/product/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            nome: 'DebugProd_' + Date.now(),
            precoCusto: 10,
            precoVenda: 20,
            categoriaId: categoryId,
            unidade: 'un'
        })
    });
    const prodData = await prodRes.json();
    const productId = prodData.product.id;
    console.log(`Product Created: ${productId}`);

    console.log('4. Attempting to DELETE Category (Should Fail)...');
    
    const delRes = await fetch(`${BASE_URL}/categoria/delete/${categoryId}`, {
        method: 'DELETE',
        headers
    });

    if (delRes.status === 400) {
        const errData = await delRes.json();
        console.log('✅ SUCCESS: API returned 400 Bad Request.');
        console.log('Error Message:', errData.error);
        if (errData.error && errData.error.includes('vinculados')) {
            console.log('✅ Message content verified.');
        } else {
            console.log('❌ Message mismatch:', errData.error);
        }
    } else {
        console.log(`❌ FAIL: Unexpected status ${delRes.status}`);
        try { console.log(await delRes.text()); } catch {}
    }

    console.log('5. Cleanup...');
    // Optional cleanup
    
  } catch (error) {
    console.error('CRITICAL FAILURE:', error.message);
  }
}

run();
