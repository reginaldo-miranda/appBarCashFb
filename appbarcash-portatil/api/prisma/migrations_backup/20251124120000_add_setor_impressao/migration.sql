-- CreateTable
CREATE TABLE `SetorImpressao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `modoEnvio` ENUM('impressora','whatsapp') NOT NULL DEFAULT 'impressora',
    `whatsappDestino` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SetorImpressao_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSetorImpressao` (
    `productId` INTEGER NOT NULL,
    `setorId` INTEGER NOT NULL,

    PRIMARY KEY (`productId`, `setorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductSetorImpressao` ADD CONSTRAINT `ProductSetorImpressao_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProductSetorImpressao` ADD CONSTRAINT `ProductSetorImpressao_setorId_fkey` FOREIGN KEY (`setorId`) REFERENCES `SetorImpressao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;