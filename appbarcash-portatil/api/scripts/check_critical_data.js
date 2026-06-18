
import prisma from '../lib/prisma.js';

async function main() {
  try {
    const varTypes = await prisma.variationType.count();
    const setores = await prisma.setorImpressao.count();
    const printers = await prisma.printer.count();
    
    console.log('--- Data Check ---');
    console.log(`VariationTypes: ${varTypes}`);
    console.log(`Setores: ${setores}`);
    console.log(`Printers: ${printers}`);
    
  } catch (e) {
    console.error('Check failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
