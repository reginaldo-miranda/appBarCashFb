-- Script de criação da tabela `Mesa` em MySQL
-- Referência: modelo MongoDB (Mongoose) e uso atual na API (Prisma)
-- Decisões de mapeamento:
--  - ObjectId (Mongo) -> INT AUTO_INCREMENT (MySQL)
--  - Strings com limites do exemplo Mongo: `nomeResponsavel` (100), `observacoes` (200)
--  - Enums de `status` e `tipo` preservados
--  - `vendaAtualId` exclusivo (uma venda atual por mesa) e FK com ON DELETE SET NULL
--  - FK para `funcionarioResponsavelId` com ON DELETE SET NULL
--  - Índices para status, ativo e funcionário responsável
--  - Restrições: `capacidade >= 1` e `clientesAtuais >= 0`
-- Observação: este script usa nomes CamelCase (Mesa, Sale, Employee) para alinhar ao Prisma

CREATE TABLE `Mesa` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `numero` INT NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `capacidade` INT NOT NULL,
  `status` ENUM('livre','ocupada','reservada','manutencao') NOT NULL DEFAULT 'livre',
  `vendaAtualId` INT NULL,
  `funcionarioResponsavelId` INT NULL,
  `nomeResponsavel` VARCHAR(100) NULL,
  `clientesAtuais` INT NOT NULL DEFAULT 0,
  `horaAbertura` DATETIME NULL,
  `observacoes` VARCHAR(200) NULL,
  `tipo` ENUM('interna','externa','vip','reservada','balcao') NOT NULL DEFAULT 'interna',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mesa_numero_unique` (`numero`),
  UNIQUE KEY `mesa_vendaAtualId_unique` (`vendaAtualId`),
  CONSTRAINT `mesa_vendaAtualId_fk`
    FOREIGN KEY (`vendaAtualId`) REFERENCES `Sale`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `mesa_funcionarioResponsavelId_fk`
    FOREIGN KEY (`funcionarioResponsavelId`) REFERENCES `Employee`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `mesa_status_idx` (`status`),
  INDEX `mesa_ativo_idx` (`ativo`),
  INDEX `mesa_funcionarioResponsavelId_idx` (`funcionarioResponsavelId`),
  CHECK (`capacidade` >= 1),
  CHECK (`clientesAtuais` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Fim do script