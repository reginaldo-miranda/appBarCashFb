-- Adicionar campos de status e controle de preparação aos itens da venda
ALTER TABLE `SaleItem` ADD COLUMN `status` ENUM('pendente','pronto') DEFAULT 'pendente' AFTER `subtotal`;
ALTER TABLE `SaleItem` ADD COLUMN `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP AFTER `status`;
ALTER TABLE `SaleItem` ADD COLUMN `preparedAt` DATETIME NULL AFTER `createdAt`;
ALTER TABLE `SaleItem` ADD COLUMN `preparedById` INTEGER NULL AFTER `preparedAt`;

-- Adicionar foreign key para o funcionário que preparou
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_preparedById_fkey` 
  FOREIGN KEY (`preparedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice para facilitar busca por status e setor
CREATE INDEX `SaleItem_status_idx` ON `SaleItem`(`status`);
CREATE INDEX `SaleItem_createdAt_idx` ON `SaleItem`(`createdAt`);