import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vendasHoje = await prisma.sale.findMany({
      where: {
        dataVenda: {
          gte: today
        }
      },
      include: {
        nfce: true,
      },
      orderBy: { dataVenda: 'desc' },
      take: 10
    });

    console.log(`Total Vendas Hoje encontradas: ${vendasHoje.length}`);
    let fiscalCount = 0;

    for (const venda of vendasHoje) {
      const hasNfce = !!venda.nfce;
      const nfceStatus = venda.nfce ? venda.nfce.status : 'N/A';
      console.log(`Venda ID: ${venda.id} | Status: ${venda.status} | Data: ${venda.dataVenda.toISOString()} | Has NFCe: ${hasNfce} | NFCe Status: ${nfceStatus}`);
      if (venda.nfce && venda.nfce.status === 'AUTORIZADA') {
        fiscalCount++;
      }
    }
    
    console.log(`Total Vendas Fiscais (AUTORIZADA) Hoje: ${fiscalCount}`);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
