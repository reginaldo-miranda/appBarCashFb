CREATE TABLE `Printer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(191) NOT NULL,
  `modelo` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `driver` VARCHAR(191) NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Printer_nome_key`(`nome`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SetorImpressao` ADD COLUMN `printerId` INTEGER NULL;
ALTER TABLE `SetorImpressao` ADD CONSTRAINT `SetorImpressao_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `PrintJob` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NULL,
  `productId` INTEGER NOT NULL,
  `setorId` INTEGER NOT NULL,
  `printerId` INTEGER NULL,
  `content` TEXT NOT NULL,
  `status` ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WhatsAppMessageLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `saleId` INTEGER NULL,
  `destino` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `status` ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;