-- Adiciona CHECK constraints à tabela `Mesa` garantindo regras de domínio
-- 1) `capacidade` >= 1
-- 2) `clientesAtuais` >= 0
-- Usa condicionais para não falhar se já existirem.

-- CHECK: capacidade >= 1
SET @constraint_name := 'mesa_chk_capacidade_ge_1';
SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Mesa'
    AND CONSTRAINT_NAME = @constraint_name
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Mesa` ADD CONSTRAINT `mesa_chk_capacidade_ge_1` CHECK ((`capacidade` >= 1));',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CHECK: clientesAtuais >= 0
SET @constraint_name := 'mesa_chk_clientesAtuais_ge_0';
SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Mesa'
    AND CONSTRAINT_NAME = @constraint_name
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Mesa` ADD CONSTRAINT `mesa_chk_clientesAtuais_ge_0` CHECK ((`clientesAtuais` >= 0));',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;