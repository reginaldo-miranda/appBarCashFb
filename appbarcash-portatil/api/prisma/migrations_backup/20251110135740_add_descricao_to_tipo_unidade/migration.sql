-- AlterTable
ALTER TABLE `ProductGroup` MODIFY `icone` VARCHAR(191) NOT NULL DEFAULT '📦';

-- AlterTable
ALTER TABLE `Tipo` ADD COLUMN `descricao` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `UnidadeMedida` ADD COLUMN `descricao` VARCHAR(191) NULL;
