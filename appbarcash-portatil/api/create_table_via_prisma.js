
import prisma from './lib/prisma.js';

(async () => {
  try {
    console.log('Conectando via Prisma...');
    
    // Tenta criar a tabela com nome em MINÚSCULO para compatibilidade
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS idletimeconfig (
        id INTEGER NOT NULL AUTO_INCREMENT,
        ativo TINYINT(1) NOT NULL DEFAULT 0,
        usarHoraInclusao TINYINT(1) NOT NULL DEFAULT 1,
        estagios JSON NOT NULL,
        updatedAt DATETIME(3) NOT NULL,
        PRIMARY KEY (id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    
    console.log('Tabela idletimeconfig criada com sucesso.');
    
  } catch (err) {
    console.error('Erro ao criar tabela:', err);
  } finally {
    await prisma.$disconnect();
  }
})();
