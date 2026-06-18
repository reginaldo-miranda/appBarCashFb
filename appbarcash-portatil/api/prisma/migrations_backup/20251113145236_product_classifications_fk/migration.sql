-- AlterTable
ALTER TABLE `Product` ADD COLUMN `categoriaId` INTEGER NULL,
    ADD COLUMN `groupId` INTEGER NULL,
    ADD COLUMN `tipoId` INTEGER NULL,
    ADD COLUMN `unidadeMedidaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ProductGroup` MODIFY `icone` VARCHAR(191) NOT NULL DEFAULT '📦';

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tipoId_fkey` FOREIGN KEY (`tipoId`) REFERENCES `Tipo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ProductGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_unidadeMedidaId_fkey` FOREIGN KEY (`unidadeMedidaId`) REFERENCES `UnidadeMedida`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
