
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSaleId(id) {
    const sale = await prisma.sale.findUnique({
        where: { id },
        include: { 
            itens: true,
            caixaVendas: true,
            nfce: true
        }
    });

    if (sale) {
        console.log('--- SALE DETAILS ---');
        console.log(`ID: ${sale.id}`);
        console.log(`Subtotal: ${sale.subtotal}`);
        console.log(`DeliveryFee: ${sale.deliveryFee}`);
        console.log(`Desconto: ${sale.desconto}`);
        console.log(`Total: ${sale.total}`);
        console.log(`CashbackUsado: ${sale.cashbackUsado}`);
        console.log(`CashbackGerado: ${sale.cashbackGerado}`);
        console.log(`FormaPagamento (Final): ${sale.formaPagamento}`);
        console.log(`Status: ${sale.status}`);
        console.log(`DataFinalizacao: ${sale.dataFinalizacao}`);
        
        console.log('--- CAIXA VENDAS ---');
        let totalPagoCaixa = 0;
        if (sale.caixaVendas && sale.caixaVendas.length > 0) {
            sale.caixaVendas.forEach(cv => {
                console.log(`CV ID: ${cv.id} | Forma: ${cv.formaPagamento} | Valor: ${cv.valor} | Obs: ${cv.observacoes}`);
                if (cv.formaPagamento !== 'cashback') totalPagoCaixa += Number(cv.valor);
            });
        } else {
            console.log('No CaixaVendas found');
        }
        console.log(`Total Pago (Dinheiro/Cartão/Pix): ${totalPagoCaixa}`);

        console.log('--- ITENS ---');
        sale.itens.forEach(item => {
             console.log(`Item: ${item.nomeProduto} | Qtd: ${item.quantidade} | Subtotal: ${item.subtotal}`);
        });

    } else {
        console.log('Sale not found');
    }
}

async function findLatestSale() {
  try {
    const sale = await prisma.sale.findFirst({
        orderBy: { id: 'desc' },
        include: { 
            itens: true,
            caixaVendas: true,
            nfce: true
        }
    });

    if (sale) {
        console.log(`--- LATEST SALE FOUND (ID: ${sale.id}) ---`);
        await debugSaleId(sale.id);
        
        // XML Path check skipped


    } else {
        console.log('No sales found');
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

findLatestSale();
