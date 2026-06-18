-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` ENUM('admin', 'funcionario') NOT NULL DEFAULT 'funcionario',
    `employeeId` INTEGER NULL,
    `permissoes` JSON NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoLogin` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `precoCusto` DECIMAL(10, 2) NOT NULL,
    `precoVenda` DECIMAL(10, 2) NOT NULL,
    `categoria` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `grupo` VARCHAR(191) NULL,
    `unidade` VARCHAR(191) NOT NULL DEFAULT 'un',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dadosFiscais` VARCHAR(191) NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 0,
    `imagem` VARCHAR(191) NULL,
    `tempoPreparoMinutos` INTEGER NOT NULL DEFAULT 0,
    `disponivel` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `icone` VARCHAR(191) NOT NULL DEFAULT '📦',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductGroup_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
