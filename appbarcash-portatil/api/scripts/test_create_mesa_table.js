// Teste de criação de tabela Mesa em MySQL (ambiente local)
// Não altera tabelas existentes; cria uma tabela temporária `Mesa_Test`, inspeciona e remove.
// Usa DATABASE_URL da API (Prisma) para conectar.

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Carregar env padrão e fallback para ./api/.env
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: './api/.env' });
}

const createMesaTestSQL = `
CREATE TABLE IF NOT EXISTS \`Mesa_Test\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`numero\` INT NOT NULL,
  \`nome\` VARCHAR(100) NOT NULL,
  \`capacidade\` INT NOT NULL,
  \`status\` ENUM('livre','ocupada','reservada','manutencao') NOT NULL DEFAULT 'livre',
  \`vendaAtualId\` INT NULL,
  \`funcionarioResponsavelId\` INT NULL,
  \`nomeResponsavel\` VARCHAR(100) NULL,
  \`clientesAtuais\` INT NOT NULL DEFAULT 0,
  \`horaAbertura\` DATETIME NULL,
  \`observacoes\` VARCHAR(200) NULL,
  \`tipo\` ENUM('interna','externa','vip','reservada','balcao') NOT NULL DEFAULT 'interna',
  \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`mesa_test_numero_unique\` (\`numero\`),
  UNIQUE KEY \`mesa_test_vendaAtualId_unique\` (\`vendaAtualId\`),
  CONSTRAINT \`mesa_test_vendaAtualId_fk\`
    FOREIGN KEY (\`vendaAtualId\`) REFERENCES \`Sale\`(\`id\`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT \`mesa_test_funcionarioResponsavelId_fk\`
    FOREIGN KEY (\`funcionarioResponsavelId\`) REFERENCES \`Employee\`(\`id\`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX \`mesa_test_status_idx\` (\`status\`),
  INDEX \`mesa_test_ativo_idx\` (\`ativo\`),
  INDEX \`mesa_test_funcionarioResponsavelId_idx\` (\`funcionarioResponsavelId\`),
  CHECK (\`capacidade\` >= 1),
  CHECK (\`clientesAtuais\` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definido no .env da API.');
    process.exit(1);
  }

  console.log('Conectando ao MySQL usando DATABASE_URL...');
  const conn = await mysql.createConnection(url);
  try {
    console.log('Criando tabela temporária Mesa_Test...');
    await conn.execute(createMesaTestSQL);

    console.log('Inspecionando a definição da tabela criada...');
    const [rows] = await conn.query('SHOW CREATE TABLE `Mesa_Test`');
    const createDef = rows && rows[0] && (rows[0]['Create Table'] || rows[0]['Create Table'.toString()]);
    console.log(createDef || rows[0]);

    console.log('Validação concluída com sucesso. Removendo a tabela temporária...');
    await conn.execute('DROP TABLE IF EXISTS `Mesa_Test`');
    console.log('Tabela temporária removida.');
  } catch (err) {
    console.error('Falha ao criar/validar Mesa_Test:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();