
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- Checking Company Table Structure ---');
  try {
    const columns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM Company");
    console.log('Columns found:');
    columns.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

    const pointsCol = columns.find(c => c.Field === 'pontosParaResgate');
    const valorCol = columns.find(c => c.Field === 'valorResgate');

    if (!pointsCol) console.error('MISSING COLUMN: pontosParaResgate');
    if (!valorCol) console.error('MISSING COLUMN: valorResgate');
    
  } catch (e) {
    console.error('Error checking columns:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
