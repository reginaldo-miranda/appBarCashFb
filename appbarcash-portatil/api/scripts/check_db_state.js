
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- DB STATE CHECK ---');
  const comp = await prisma.company.findFirst();
  console.log('Company Config:');
  console.log(`- Cashback %: ${comp?.cashbackPercent}`);
  console.log(`- Points per Currency: ${comp?.pointsPerCurrency}`);
  console.log(`- Redemption Points: ${comp?.pontosParaResgate}`);
  console.log(`- Redemption Value: ${comp?.valorResgate}`);

  const cust = await prisma.customer.findFirst({ where: { cpf: '99999999999' } });
  if (cust) {
      console.log('Test Customer:');
      console.log(`- Saldo Cashback: ${cust.saldoCashback}`);
      console.log(`- Pontos: ${cust.pontos}`);
  }
  await prisma.$disconnect();
}
main();
