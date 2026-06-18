
import prisma from './lib/prisma.js';

async function main() {
  console.log('Start adding CEP to Customer...');
  try {
    try {
        // Tenta adicionar a coluna
        await prisma.$executeRawUnsafe(`ALTER TABLE Customer ADD COLUMN cep VARCHAR(191) NULL;`);
        console.log('✅ Added cep column to Customer');
    } catch (e) {
        // Se falhar, pode ser que já exista ou tabela seja minúscula
        if (e.message.includes('Duplicate column')) {
             console.log('⚠️ Column cep already exists');
        } else {
             // Tenta minúsculo
             try {
                await prisma.$executeRawUnsafe(`ALTER TABLE customer ADD COLUMN cep VARCHAR(191) NULL;`);
                console.log('✅ Added cep column to customer (lowercase)');
             } catch (e2) {
                 if (e2.message.includes('Duplicate column')) {
                     console.log('⚠️ Column cep already exists (lowercase)');
                 } else {
                     console.error('❌ Failed to add column:', e2);
                 }
             }
        }
    }
  } catch (e) {
    console.error('❌ General error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
