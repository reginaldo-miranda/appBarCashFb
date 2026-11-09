import prisma from '../lib/prisma.js';

async function migrate() {
  console.log('--- Aplicando migração de Locais de Estoque Customizados ---');

  // 1. Criar tabela StockLocation
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`StockLocation\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`nome\` VARCHAR(191) NOT NULL,
      \`descricao\` VARCHAR(191) NULL,
      \`tipo\` VARCHAR(191) NULL DEFAULT 'OUTRO',
      \`ativo\` BOOLEAN NOT NULL DEFAULT true,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`StockLocation_nome_key\`(\`nome\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  console.log('✅ Tabela StockLocation verificada/criada.');

  // 2. Adicionar colunas em Product se não existirem
  const cols = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Product';
  `);
  const colNames = cols.map((c) => c.COLUMN_NAME);

  if (!colNames.includes('localVendaId')) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Product\` ADD COLUMN \`localVendaId\` INT NULL;
    `);
    console.log('✅ Coluna localVendaId adicionada em Product.');
  }

  if (!colNames.includes('localVendaNome')) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Product\` ADD COLUMN \`localVendaNome\` VARCHAR(191) NULL DEFAULT 'Geladeira 1';
    `);
    console.log('✅ Coluna localVendaNome adicionada em Product.');
  }

  // 3. Adicionar FK se não existir
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Product\` 
      ADD CONSTRAINT \`Product_localVendaId_fkey\` 
      FOREIGN KEY (\`localVendaId\`) REFERENCES \`StockLocation\`(\`id\`) 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('✅ Foreign key Product_localVendaId_fkey criada.');
  } catch (e) {
    if (!e.message.includes('Duplicate foreign key') && !e.message.includes('already exists')) {
      console.warn('FK warning:', e.message);
    }
  }

  // 4. Inserir Locais Padrão
  const defaultLocations = [
    { nome: 'Geladeira 1', tipo: 'GELADEIRA', descricao: 'Geladeira principal de cervejas' },
    { nome: 'Geladeira 2', tipo: 'GELADEIRA', descricao: 'Geladeira secundária de cervejas / refrigerantes' },
    { nome: 'Balcão', tipo: 'BALCAO', descricao: 'Balcão do caixa para doces e salgadinhos' },
    { nome: 'Cozinha / Chapa', tipo: 'COZINHA', descricao: 'Área da chapa e preparo para pães e insumos' },
    { nome: 'Bar / Doses', tipo: 'BAR', descricao: 'Prateleira de destilados para doses e drinks' },
    { nome: 'Depósito Central', tipo: 'DEPOSITO', descricao: 'Estoque reserva de engradados e caixas fechadas' },
  ];

  for (const loc of defaultLocations) {
    const existing = await prisma.stockLocation.findFirst({ where: { nome: loc.nome } });
    if (!existing) {
      await prisma.stockLocation.create({ data: loc });
      console.log(`🌱 Local criado: ${loc.nome}`);
    }
  }

  // 5. Vincular produtos aos locais sugeridos baseados em categoria
  const locG1 = await prisma.stockLocation.findFirst({ where: { nome: 'Geladeira 1' } });
  const locBalcao = await prisma.stockLocation.findFirst({ where: { nome: 'Balcão' } });
  const locCozinha = await prisma.stockLocation.findFirst({ where: { nome: 'Cozinha / Chapa' } });
  const locBar = await prisma.stockLocation.findFirst({ where: { nome: 'Bar / Doses' } });

  if (locG1) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`Product\` 
      SET \`localVendaId\` = ${locG1.id}, \`localVendaNome\` = 'Geladeira 1'
      WHERE \`categoria\` IN ('cervejas', 'refrigerantes') OR \`localVendaNome\` IS NULL;
    `);
  }

  if (locBalcao) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`Product\` 
      SET \`localVendaId\` = ${locBalcao.id}, \`localVendaNome\` = 'Balcão'
      WHERE \`categoria\` IN ('doces', 'salgados');
    `);
  }

  if (locCozinha) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`Product\` 
      SET \`localVendaId\` = ${locCozinha.id}, \`localVendaNome\` = 'Cozinha / Chapa'
      WHERE \`categoria\` IN ('lanches', 'porcoes');
    `);
  }

  if (locBar) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`Product\` 
      SET \`localVendaId\` = ${locBar.id}, \`localVendaNome\` = 'Bar / Doses'
      WHERE \`categoria\` IN ('doses');
    `);
  }

  console.log('🎉 Migração concluída com sucesso!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});

