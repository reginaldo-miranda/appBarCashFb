
import axios from 'axios';
import prisma from '../lib/prisma.js';

const BASE_URL = 'http://localhost:4000/api';

async function main() {
    try {
        console.log('--- TEST CASHBACK FLOW ---');
        
        // 1. Ensure Admin Login
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@barapp.com', password: 'admin123', senha: 'admin123'
        });
        const token = loginRes.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };

        // 2. Create/Find Test Customer
        let customer = await prisma.customer.findFirst({ where: { cpf: '99999999999' } });
        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    nome: 'Test Cashback Client',
                    cpf: '99999999999',
                    participaFidelidade: true,
                    pontos: 0,
                    saldoCashback: 0
                }
            });
            console.log('Created Test Customer:', customer.id);
        } else {
            // Reset balance
            await prisma.customer.update({
                where: { id: customer.id },
                data: { pontos: 0, saldoCashback: 0 }
            });
            console.log('Reset Test Customer:', customer.id);
        }

        // 3. Create Sale
        const saleRes = await axios.post(`${BASE_URL}/sale/create`, {
            funcionario: 'admin-fixo',
            cliente: customer.id,
            valorTotal: 100.00,
            tipoVenda: 'balcao'
        }, { headers });
        
        const saleId = saleRes.data.id;
        console.log('Created Sale:', saleId, 'Value: 100.00');

        // 4. Add dummy item to allow finalization
        // We need a product first
        const product = await prisma.product.findFirst();
        if (!product) throw new Error('No products found in DB');

        await axios.post(`${BASE_URL}/sale/${saleId}/item`, {
            produtoId: product.id,
            quantidade: 1
        }, { headers });
        console.log('Added item to sale');

        // 5. Finalize Sale
        console.log('Finalizing sale...');
        const finalizeRes = await axios.put(`${BASE_URL}/sale/${saleId}/finalize`, {
            formaPagamento: 'dinheiro'
        }, { headers });

        console.log('Fainlize Result:', finalizeRes.status);
        if (finalizeRes.data.cashbackGerado) {
            console.log('Cashback Generated in Response:', finalizeRes.data.cashbackGerado);
        } else {
            console.log('WARNING: No cashbackGerado in response');
        }

        // Check if CLIENT object in sale response has the callback balance
        if (finalizeRes.data.cliente && finalizeRes.data.cliente.saldoCashback !== undefined) {
             console.log('SUCCESS: API Response includes cliente.saldoCashback:', finalizeRes.data.cliente.saldoCashback);
        } else {
             console.log('FAILURE: API Response MISSING cliente.saldoCashback');
        }

        // 6. Verify Customer Balance
        const finalCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
        console.log('Final Customer State:');
        console.log('Pontos:', finalCustomer.pontos);
        console.log('SaldoCashback:', finalCustomer.saldoCashback);

        if (Number(finalCustomer.saldoCashback) > 0) {
            console.log('SUCCESS: Cashback accumulated!');
        } else {
            console.log('FAILURE: Cashback NOT accumulated.');
        }

    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
