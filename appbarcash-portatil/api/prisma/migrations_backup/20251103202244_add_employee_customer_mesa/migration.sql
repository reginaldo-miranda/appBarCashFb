-- AlterTable
ALTER TABLE `ProductGroup` MODIFY `icone` VARCHAR(191) NOT NULL DEFAULT '📦';

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `cargo` VARCHAR(191) NULL,
    `salario` DECIMAL(10, 2) NULL,
    `dataAdmissao` DATETIME(3) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `fone` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `rg` VARCHAR(191) NULL,
    `dataNascimento` DATETIME(3) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Customer_cpf_key`(`cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `capacidade` INTEGER NOT NULL,
    `status` ENUM('livre', 'ocupada', 'reservada', 'manutencao') NOT NULL DEFAULT 'livre',
    `vendaAtualId` INTEGER NULL,
    `funcionarioResponsavelId` INTEGER NULL,
    `nomeResponsavel` VARCHAR(191) NULL,
    `clientesAtuais` INTEGER NOT NULL DEFAULT 0,
    `horaAbertura` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `tipo` ENUM('interna', 'externa', 'vip', 'reservada', 'balcao') NOT NULL DEFAULT 'interna',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Mesa_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Mesa` ADD CONSTRAINT `Mesa_funcionarioResponsavelId_fkey` FOREIGN KEY (`funcionarioResponsavelId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
