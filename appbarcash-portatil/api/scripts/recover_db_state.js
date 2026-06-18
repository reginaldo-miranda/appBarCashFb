
import prisma from '../lib/prisma.js';

async function main() {
  console.log('🔄 Starting system recovery...');
  try {
    // 1. Fix DeliveryRange FK issue if possible (optional, just ensuring table exists first)
    
    // 2. Critical Tables required by Frontend
    console.log('📦 Ensuring critical tables...');
    
    // SetorImpressao
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`SetorImpressao\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`nome\` VARCHAR(191) NOT NULL,
        \`descricao\` TEXT NULL,
        \`modoEnvio\` ENUM('impressora','whatsapp') NOT NULL DEFAULT 'impressora',
        \`whatsappDestino\` VARCHAR(191) NULL,
        \`printerId\` INTEGER NULL,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // Printer
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Printer\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`nome\` VARCHAR(191) NOT NULL,
        \`modelo\` VARCHAR(191) NULL,
        \`address\` VARCHAR(191) NULL,
        \`driver\` VARCHAR(191) NULL,
        \`ativo\` BOOLEAN NOT NULL DEFAULT true,
        \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`Printer_nome_key\`(\`nome\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // VariationType
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`VariationType\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`nome\` VARCHAR(191) NOT NULL,
        \`maxOpcoes\` INTEGER NOT NULL DEFAULT 1,
        \`categoriasIds\` JSON NULL,
        \`regraPreco\` ENUM('mais_caro','media','fixo') NOT NULL DEFAULT 'mais_caro',
        \`precoFixo\` DECIMAL(10,2) NULL,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`VariationType_nome_key\`(\`nome\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // 3. Critical Columns
    console.log('🔧 Fixing missing columns...');

    // 3. Critical Columns - Retry with standard syntax + error handling for 1060 (Duplicate column)
    console.log('🔧 Fixing missing columns (Pass 2)...');

    const addCol = async (tbl, query, colName) => {
      try {
         await prisma.$executeRawUnsafe(query);
         console.log(`  ✅ Added ${tbl}.${colName}`);
      } catch (e) {
         if (String(e).includes('1060') || String(e).includes('Duplicate column')) {
             console.log(`  ℹ️ ${tbl}.${colName} already exists.`);
         } else {
             console.log(`  ⚠️ Error adding ${tbl}.${colName}:`, e.message);
         }
      }
    };

    await addCol('Product', "ALTER TABLE `Product` ADD COLUMN `temVariacao` TINYINT(1) NOT NULL DEFAULT 0", 'temVariacao');

    await addCol('SaleItem', "ALTER TABLE `SaleItem` ADD COLUMN `variacaoTipo` VARCHAR(50) NULL", 'variacaoTipo');
    await addCol('SaleItem', "ALTER TABLE `SaleItem` ADD COLUMN `variacaoOpcoes` JSON NULL", 'variacaoOpcoes');
    await addCol('SaleItem', "ALTER TABLE `SaleItem` ADD COLUMN `variacaoRegraPreco` ENUM('mais_caro','media','fixo') NULL", 'variacaoRegraPreco');
    
    await addCol('SaleItem', "ALTER TABLE `SaleItem` ADD COLUMN `origem` VARCHAR(20) NULL DEFAULT 'default'", 'origem');

    // 4. Critical Sale Columns (detected missing)
    console.log('🔧 Fixing Sale columns...');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `cashbackGerado` DECIMAL(10, 2) NOT NULL DEFAULT 0.00", 'cashbackGerado');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `cashbackUsado` DECIMAL(10, 2) NOT NULL DEFAULT 0.00", 'cashbackUsado');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `pontosUsados` INTEGER NOT NULL DEFAULT 0", 'pontosUsados');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `isDelivery` TINYINT(1) NOT NULL DEFAULT 0", 'isDelivery');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `deliveryAddress` TEXT NULL", 'deliveryAddress');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `deliveryDistance` DOUBLE NULL", 'deliveryDistance');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `deliveryFee` DECIMAL(10, 2) NULL", 'deliveryFee');
    await addCol('Sale', "ALTER TABLE `Sale` ADD COLUMN `deliveryStatus` ENUM('pending','out_for_delivery','delivered','cancelled') DEFAULT 'pending'", 'deliveryStatus');

    // 5. Critical Customer Columns (detected missing)
    console.log('🔧 Fixing Customer columns...');
    await addCol('Customer', "ALTER TABLE `Customer` ADD COLUMN `saldoCashback` DECIMAL(10, 2) NOT NULL DEFAULT 0.00", 'saldoCashback');
    await addCol('Customer', "ALTER TABLE `Customer` ADD COLUMN `pontos` INTEGER NOT NULL DEFAULT 0", 'pontos');
    await addCol('Customer', "ALTER TABLE `Customer` ADD COLUMN `participaFidelidade` TINYINT(1) NOT NULL DEFAULT 1", 'participaFidelidade');

    // 6. Critical Company Columns (detected missing)
    console.log('🔧 Fixing Company columns...');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `cashbackPercent` DECIMAL(5, 2) NOT NULL DEFAULT 5.00", 'cashbackPercent');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `pointsPerCurrency` DECIMAL(5, 2) NOT NULL DEFAULT 1.00", 'pointsPerCurrency');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `pontosParaResgate` INTEGER NOT NULL DEFAULT 0", 'pontosParaResgate');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `valorResgate` DECIMAL(10, 2) NOT NULL DEFAULT 0.00", 'valorResgate');
    
    // Delivery config in Company
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `latitude` DOUBLE NULL", 'latitude');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `longitude` DOUBLE NULL", 'longitude');
    await addCol('Company', "ALTER TABLE `Company` ADD COLUMN `deliveryRadius` DOUBLE NULL", 'deliveryRadius');


    console.log('✅ Recovery script completed.');
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
