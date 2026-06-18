-- DropIndex
DROP INDEX `DeliveryRange_companyId_fkey` ON `deliveryrange`;

-- AlterTable
ALTER TABLE `company` ADD COLUMN `certificadoNome` VARCHAR(191) NULL,
    ADD COLUMN `certificadoPath` VARCHAR(191) NULL,
    ADD COLUMN `certificadoSenha` VARCHAR(191) NULL,
    ADD COLUMN `csc` VARCHAR(191) NULL,
    ADD COLUMN `cscId` VARCHAR(191) NULL,
    ADD COLUMN `xmlFolder` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `cest` VARCHAR(191) NULL,
    ADD COLUMN `cfop` VARCHAR(191) NULL,
    ADD COLUMN `csosn` VARCHAR(191) NULL,
    ADD COLUMN `icmsAliquota` DECIMAL(5, 2) NULL,
    ADD COLUMN `icmsSituacao` VARCHAR(191) NULL,
    ADD COLUMN `ncm` VARCHAR(191) NULL,
    ADD COLUMN `origem` INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE `appsetting`;

-- CreateTable
CREATE TABLE `Nfce` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `chave` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `serie` INTEGER NOT NULL,
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'DENEGADA', 'CONTINGENCIA') NOT NULL DEFAULT 'PENDENTE',
    `ambiente` ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
    `xml` LONGTEXT NOT NULL,
    `protocolo` VARCHAR(191) NULL,
    `motivo` VARCHAR(191) NULL,
    `qrCode` TEXT NULL,
    `urlConsulta` TEXT NULL,
    `pdfPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Nfce_saleId_key`(`saleId`),
    UNIQUE INDEX `Nfce_chave_key`(`chave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NfceEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nfceId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `sequencia` INTEGER NOT NULL DEFAULT 1,
    `xmlEnvio` TEXT NULL,
    `xmlRetorno` TEXT NULL,
    `status` VARCHAR(191) NULL,
    `motivo` VARCHAR(191) NULL,
    `protocolo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ProductGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tipoId_fkey` FOREIGN KEY (`tipoId`) REFERENCES `Tipo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_unidadeMedidaId_fkey` FOREIGN KEY (`unidadeMedidaId`) REFERENCES `UnidadeMedida`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSize` ADD CONSTRAINT `ProductSize_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mesa` ADD CONSTRAINT `Mesa_funcionarioResponsavelId_fkey` FOREIGN KEY (`funcionarioResponsavelId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mesa` ADD CONSTRAINT `Mesa_vendaAtualId_fkey` FOREIGN KEY (`vendaAtualId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SetorImpressao` ADD CONSTRAINT `SetorImpressao_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSetorImpressao` ADD CONSTRAINT `ProductSetorImpressao_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSetorImpressao` ADD CONSTRAINT `ProductSetorImpressao_setorId_fkey` FOREIGN KEY (`setorId`) REFERENCES `SetorImpressao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_entregadorId_fkey` FOREIGN KEY (`entregadorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_mesaId_fkey` FOREIGN KEY (`mesaId`) REFERENCES `Mesa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_responsavelFuncionarioId_fkey` FOREIGN KEY (`responsavelFuncionarioId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Nfce` ADD CONSTRAINT `Nfce_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NfceEvent` ADD CONSTRAINT `NfceEvent_nfceId_fkey` FOREIGN KEY (`nfceId`) REFERENCES `Nfce`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_preparedById_fkey` FOREIGN KEY (`preparedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Caixa` ADD CONSTRAINT `Caixa_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Caixa` ADD CONSTRAINT `Caixa_funcionarioFechamentoId_fkey` FOREIGN KEY (`funcionarioFechamentoId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaixaVenda` ADD CONSTRAINT `CaixaVenda_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `Caixa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaixaVenda` ADD CONSTRAINT `CaixaVenda_vendaId_fkey` FOREIGN KEY (`vendaId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryRange` ADD CONSTRAINT `DeliveryRange_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

