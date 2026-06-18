/*
  Warnings:

  - You are about to alter the column `numero` on the `Mesa` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - A unique constraint covering the columns `[vendaAtualId]` on the table `Mesa` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Mesa` MODIFY `numero` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ProductGroup` MODIFY `icone` VARCHAR(191) NOT NULL DEFAULT '📦';

-- CreateTable
CREATE TABLE `Sale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `funcionarioId` INTEGER NULL,
    `clienteId` INTEGER NULL,
    `mesaId` INTEGER NULL,
    `responsavelNome` VARCHAR(191) NULL,
    `responsavelFuncionarioId` INTEGER NULL,
    `funcionarioNome` VARCHAR(191) NULL,
    `funcionarioAberturaNome` VARCHAR(191) NULL,
    `funcionarioAberturaId` INTEGER NULL,
    `numeroComanda` VARCHAR(191) NULL,
    `nomeComanda` VARCHAR(191) NULL,
    `tipoVenda` ENUM('balcao', 'mesa', 'delivery', 'comanda') NOT NULL DEFAULT 'balcao',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `desconto` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `formaPagamento` ENUM('dinheiro', 'cartao', 'pix') NOT NULL DEFAULT 'dinheiro',
    `status` ENUM('aberta', 'finalizada', 'cancelada') NOT NULL DEFAULT 'aberta',
    `dataVenda` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dataFinalizacao` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `tempoPreparoEstimado` INTEGER NOT NULL DEFAULT 0,
    `impressaoCozinha` BOOLEAN NOT NULL DEFAULT false,
    `impressaoBar` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sale_numeroComanda_key`(`numeroComanda`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaleItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `nomeProduto` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `precoUnitario` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Caixa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dataAbertura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dataFechamento` DATETIME(3) NULL,
    `valorAbertura` DECIMAL(10, 2) NOT NULL,
    `valorFechamento` DECIMAL(10, 2) NULL,
    `totalVendas` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalDinheiro` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalCartao` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalPix` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `funcionarioAberturaId` INTEGER NOT NULL,
    `funcionarioFechamentoId` INTEGER NULL,
    `status` ENUM('aberto', 'fechado') NOT NULL DEFAULT 'aberto',
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaixaVenda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caixaId` INTEGER NOT NULL,
    `vendaId` INTEGER NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `formaPagamento` ENUM('dinheiro', 'cartao', 'pix') NOT NULL,
    `dataVenda` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Mesa_vendaAtualId_key` ON `Mesa`(`vendaAtualId`);

-- AddForeignKey
ALTER TABLE `Mesa` ADD CONSTRAINT `Mesa_vendaAtualId_fkey` FOREIGN KEY (`vendaAtualId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_mesaId_fkey` FOREIGN KEY (`mesaId`) REFERENCES `Mesa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_responsavelFuncionarioId_fkey` FOREIGN KEY (`responsavelFuncionarioId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Caixa` ADD CONSTRAINT `Caixa_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Caixa` ADD CONSTRAINT `Caixa_funcionarioFechamentoId_fkey` FOREIGN KEY (`funcionarioFechamentoId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaixaVenda` ADD CONSTRAINT `CaixaVenda_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `Caixa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaixaVenda` ADD CONSTRAINT `CaixaVenda_vendaId_fkey` FOREIGN KEY (`vendaId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
