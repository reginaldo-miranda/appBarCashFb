import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('🔄 Aplicando migração de estoque por locais no banco de dados...');

  // 1. Verificar e adicionar colunas em Product
  const checkCol = async (table, col) => {
    const res = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
    return Array.isArray(res) && res.length > 0;
  };

  const hasDeposito = await checkCol('Product', 'estoqueDeposito');
  if (!hasDeposito) {
    console.log('➕ Adicionando coluna estoqueDeposito em Product...');
    await prisma.$executeRawUnsafe('ALTER TABLE `Product` ADD COLUMN `estoqueDeposito` INT NOT NULL DEFAULT 0');
  } else {
    console.log('✓ estoqueDeposito já existe em Product.');
  }

  const hasGeladeira = await checkCol('Product', 'estoqueGeladeira');
  if (!hasGeladeira) {
    console.log('➕ Adicionando coluna estoqueGeladeira em Product...');
    await prisma.$executeRawUnsafe('ALTER TABLE `Product` ADD COLUMN `estoqueGeladeira` INT NOT NULL DEFAULT 0');
  } else {
    console.log('✓ estoqueGeladeira já existe em Product.');
  }

  // 2. Inicializar produtos existentes: estoqueGeladeira = quantidade
  console.log('🔄 Inicializando estoqueGeladeira com o saldo atual dos produtos...');
  await prisma.$executeRawUnsafe('UPDATE `Product` SET `estoqueGeladeira` = `quantidade` WHERE `estoqueGeladeira` = 0 AND `quantidade` > 0');

  // 3. Verificar e adicionar colunas em StockMovement
  const hasLocalOrigem = await checkCol('StockMovement', 'localOrigem');
  if (!hasLocalOrigem) {
    console.log('➕ Adicionando localOrigem em StockMovement...');
    await prisma.$executeRawUnsafe('ALTER TABLE `StockMovement` ADD COLUMN `localOrigem` VARCHAR(50) NULL');
  }

  const hasLocalDestino = await checkCol('StockMovement', 'localDestino');
  if (!hasLocalDestino) {
    console.log('➕ Adicionando localDestino em StockMovement...');
    await prisma.$executeRawUnsafe('ALTER TABLE `StockMovement` ADD COLUMN `localDestino` VARCHAR(50) NULL');
  }

  // 4. Atualizar ENUM de TipoMovimento para incluir TRANSFERENCIA
  try {
    console.log('🔄 Atualizando ENUM de TipoMovimento em StockMovement...');
    await prisma.$executeRawUnsafe("ALTER TABLE `StockMovement` MODIFY COLUMN `tipo` ENUM('ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA') NOT NULL DEFAULT 'ENTRADA'");
    console.log('✓ ENUM atualizado com sucesso.');
  } catch (err) {
    console.log('Nota sobre ENUM:', err.message);
  }

  // 5. Exibir conferência
  const sample = await prisma.$queryRawUnsafe('SELECT id, nome, quantidade, estoqueDeposito, estoqueGeladeira FROM `Product` LIMIT 5');
  console.log('📦 Conferência de Produtos:', sample);

  console.log('✅ Migração concluída com sucesso!');
  await prisma.$disconnect();
}

run().catch(e => {
  console.error('❌ Erro na migração:', e);
  process.exit(1);
});

