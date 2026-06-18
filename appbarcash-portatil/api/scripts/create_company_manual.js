import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating Company table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Company\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`razaoSocial\` VARCHAR(191) NOT NULL,
        \`nomeFantasia\` VARCHAR(191) NOT NULL,
        \`cnpj\` VARCHAR(191) NOT NULL,
        \`inscricaoEstadual\` VARCHAR(191) NULL,
        \`inscricaoMunicipal\` VARCHAR(191) NULL,
        \`logradouro\` VARCHAR(191) NULL,
        \`numero\` VARCHAR(191) NULL,
        \`complemento\` VARCHAR(191) NULL,
        \`bairro\` VARCHAR(191) NULL,
        \`cidade\` VARCHAR(191) NULL,
        \`uf\` VARCHAR(191) NULL,
        \`cep\` VARCHAR(191) NULL,
        \`ibge\` VARCHAR(191) NULL,
        \`telefone\` VARCHAR(191) NULL,
        \`telefoneSecundario\` VARCHAR(191) NULL,
        \`email\` VARCHAR(191) NULL,
        \`whatsapp\` VARCHAR(191) NULL,
        \`regimeTributario\` ENUM('simples_nacional', 'lucro_presumido', 'lucro_real') NOT NULL DEFAULT 'simples_nacional',
        \`cnae\` VARCHAR(191) NULL,
        \`contribuinteIcms\` BOOLEAN NOT NULL DEFAULT true,
        \`ambienteFiscal\` ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        \`logo\` VARCHAR(191) NULL,
        \`nomeImpressao\` VARCHAR(191) NULL,
        \`mensagemRodape\` VARCHAR(191) NULL,
        \`serieNfce\` INTEGER NOT NULL DEFAULT 1,
        \`numeroInicialNfce\` INTEGER NOT NULL DEFAULT 1,
        \`respNome\` VARCHAR(191) NULL,
        \`respCpf\` VARCHAR(191) NULL,
        \`respCargo\` VARCHAR(191) NULL,
        \`respTelefone\` VARCHAR(191) NULL,
        \`respEmail\` VARCHAR(191) NULL,
        \`plano\` VARCHAR(191) NULL,
        \`valorMensalidade\` DECIMAL(10, 2) NULL,
        \`diaVencimento\` INTEGER NULL,
        \`dataInicioCobranca\` DATETIME(3) NULL,
        \`status\` ENUM('ativa', 'bloqueada', 'cancelada') NOT NULL DEFAULT 'ativa',
        \`formaCobranca\` ENUM('pix', 'boleto', 'cartao') NOT NULL DEFAULT 'boleto',
        \`emailCobranca\` VARCHAR(191) NULL,
        \`banco\` VARCHAR(191) NULL,
        \`agencia\` VARCHAR(191) NULL,
        \`conta\` VARCHAR(191) NULL,
        \`tipoConta\` VARCHAR(191) NULL,
        \`chavePix\` VARCHAR(191) NULL,
        \`dataCadastro\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`ultimoPagamento\` DATETIME(3) NULL,
        \`proximoVencimento\` DATETIME(3) NULL,
        \`diasAtraso\` INTEGER NOT NULL DEFAULT 0,
        \`observacoes\` TEXT NULL,
        \`updatedAt\` DATETIME(3) NOT NULL,
        UNIQUE INDEX \`Company_cnpj_key\`(\`cnpj\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('Company table created successfully.');
  } catch (e) {
    console.error('Error creating table:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
