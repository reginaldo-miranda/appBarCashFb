/**
 * dbBootstrap.js
 * 
 * Módulo de inicialização do banco de dados.
 * Executado uma vez no startup da API, após a conexão com o banco ser confirmada.
 * 
 * Responsabilidades:
 *  1. Criar todas as tabelas que não existem (CREATE TABLE IF NOT EXISTS)
 *  2. Aplicar migrações de colunas adicionadas após a criação inicial (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
 * 
 * IMPORTANTE:
 *  - A ordem das tabelas respeita as dependências de Foreign Keys.
 *  - Todas as operações são idempotentes: podem rodar múltiplas vezes sem efeito colateral.
 *  - Erros individuais são capturados e logados sem derrubar o servidor.
 */

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function runDbBootstrap(prisma) {
  console.log('🔧 [dbBootstrap] Iniciando verificação e criação de tabelas...');

  const run = async (sql, label) => {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      // Ignora erros de "objeto já existe" que não sejam críticos
      const msg = err?.message || String(err);
      // Erros esperados: tabela já existe, coluna já existe, constraint duplicada
      const ignorable = ['already exists', 'Duplicate column', 'Duplicate key name', 'Can\'t DROP'];
      if (!ignorable.some(s => msg.includes(s))) {
        console.warn(`⚠️  [dbBootstrap] ${label}: ${msg}`);
      }
    }
  };

  // ============================================================
  // ETAPA 1: Tabelas sem dependências (sem FK para outras tabelas)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`role\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`descricao\`    VARCHAR(191) DEFAULT NULL,
      \`permissoes\`   JSON NOT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Role_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'role');

  await run(`
    CREATE TABLE IF NOT EXISTS \`categoria\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`descricao\`    VARCHAR(191) DEFAULT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Categoria_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'categoria');

  await run(`
    CREATE TABLE IF NOT EXISTS \`tipo\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`descricao\`    VARCHAR(191) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Tipo_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'tipo');

  await run(`
    CREATE TABLE IF NOT EXISTS \`unidademedida\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`sigla\`        VARCHAR(191) NOT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`descricao\`    VARCHAR(191) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`UnidadeMedida_nome_key\` (\`nome\`),
      UNIQUE KEY \`UnidadeMedida_sigla_key\` (\`sigla\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'unidademedida');

  await run(`
    CREATE TABLE IF NOT EXISTS \`productgroup\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`descricao\`    VARCHAR(191) DEFAULT NULL,
      \`icone\`        VARCHAR(191) NOT NULL DEFAULT '📦',
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`ProductGroup_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'productgroup');

  await run(`
    CREATE TABLE IF NOT EXISTS \`printer\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`modelo\`       VARCHAR(191) DEFAULT NULL,
      \`address\`      VARCHAR(191) DEFAULT NULL,
      \`driver\`       VARCHAR(191) DEFAULT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Printer_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'printer');

  await run(`
    CREATE TABLE IF NOT EXISTS \`variationtype\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`maxOpcoes\`    INT NOT NULL DEFAULT 1,
      \`categoriasIds\` JSON DEFAULT NULL,
      \`regraPreco\`   ENUM('mais_caro','media','fixo') NOT NULL DEFAULT 'mais_caro',
      \`precoFixo\`    DECIMAL(10,2) DEFAULT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`VariationType_nome_key\` (\`nome\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'variationtype');

  await run(`
    CREATE TABLE IF NOT EXISTS \`appsetting\` (
      \`key\`       VARCHAR(191) NOT NULL,
      \`value\`     VARCHAR(191) DEFAULT NULL,
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`key\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'appsetting');

  await run(`
    CREATE TABLE IF NOT EXISTS \`idletimeconfig\` (
      \`id\`               INT NOT NULL AUTO_INCREMENT,
      \`ativo\`            TINYINT(1) NOT NULL DEFAULT 0,
      \`usarHoraInclusao\` TINYINT(1) NOT NULL DEFAULT 1,
      \`estagios\`         JSON NOT NULL,
      \`updatedAt\`        DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'idletimeconfig');

  await run(`
    CREATE TABLE IF NOT EXISTS \`whatsappmessagelog\` (
      \`id\`        INT NOT NULL AUTO_INCREMENT,
      \`saleId\`    INT DEFAULT NULL,
      \`destino\`   VARCHAR(191) NOT NULL,
      \`content\`   TEXT NOT NULL,
      \`status\`    ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
      \`error\`     TEXT DEFAULT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`sentAt\`    DATETIME(3) DEFAULT NULL,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'whatsappmessagelog');

  // ============================================================
  // ETAPA 2: Tabela company (sem FK mas complexa)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`company\` (
      \`id\`                   INT NOT NULL AUTO_INCREMENT,
      \`razaoSocial\`          VARCHAR(191) NOT NULL,
      \`nomeFantasia\`         VARCHAR(191) NOT NULL,
      \`cnpj\`                 VARCHAR(191) NOT NULL,
      \`inscricaoEstadual\`    VARCHAR(191) DEFAULT NULL,
      \`inscricaoMunicipal\`   VARCHAR(191) DEFAULT NULL,
      \`logradouro\`           VARCHAR(191) DEFAULT NULL,
      \`numero\`               VARCHAR(191) DEFAULT NULL,
      \`complemento\`          VARCHAR(191) DEFAULT NULL,
      \`bairro\`               VARCHAR(191) DEFAULT NULL,
      \`cidade\`               VARCHAR(191) DEFAULT NULL,
      \`uf\`                   VARCHAR(191) DEFAULT NULL,
      \`cep\`                  VARCHAR(191) DEFAULT NULL,
      \`ibge\`                 VARCHAR(191) DEFAULT NULL,
      \`telefone\`             VARCHAR(191) DEFAULT NULL,
      \`telefoneSecundario\`   VARCHAR(191) DEFAULT NULL,
      \`email\`                VARCHAR(191) DEFAULT NULL,
      \`whatsapp\`             VARCHAR(191) DEFAULT NULL,
      \`regimeTributario\`     ENUM('simples_nacional','lucro_presumido','lucro_real') NOT NULL DEFAULT 'simples_nacional',
      \`cnae\`                 VARCHAR(191) DEFAULT NULL,
      \`dataAbertura\`         VARCHAR(191) DEFAULT NULL,
      \`contribuinteIcms\`     TINYINT(1) NOT NULL DEFAULT 1,
      \`ambienteFiscal\`       ENUM('homologacao','producao') NOT NULL DEFAULT 'homologacao',
      \`logo\`                 VARCHAR(191) DEFAULT NULL,
      \`nomeImpressao\`        VARCHAR(191) DEFAULT NULL,
      \`mensagemRodape\`       VARCHAR(191) DEFAULT NULL,
      \`serieNfce\`            INT NOT NULL DEFAULT 1,
      \`numeroInicialNfce\`    INT NOT NULL DEFAULT 1,
      \`respNome\`             VARCHAR(191) DEFAULT NULL,
      \`respCpf\`              VARCHAR(191) DEFAULT NULL,
      \`respCargo\`            VARCHAR(191) DEFAULT NULL,
      \`respTelefone\`         VARCHAR(191) DEFAULT NULL,
      \`respEmail\`            VARCHAR(191) DEFAULT NULL,
      \`plano\`                VARCHAR(191) DEFAULT NULL,
      \`valorMensalidade\`     DECIMAL(10,2) DEFAULT NULL,
      \`diaVencimento\`        INT DEFAULT NULL,
      \`dataInicioCobranca\`   DATETIME(3) DEFAULT NULL,
      \`status\`               ENUM('ativa','bloqueada','cancelada') NOT NULL DEFAULT 'ativa',
      \`formaCobranca\`        ENUM('pix','boleto','cartao') NOT NULL DEFAULT 'boleto',
      \`emailCobranca\`        VARCHAR(191) DEFAULT NULL,
      \`banco\`                VARCHAR(191) DEFAULT NULL,
      \`agencia\`              VARCHAR(191) DEFAULT NULL,
      \`conta\`                VARCHAR(191) DEFAULT NULL,
      \`tipoConta\`            VARCHAR(191) DEFAULT NULL,
      \`chavePix\`             VARCHAR(191) DEFAULT NULL,
      \`dataCadastro\`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`ultimoPagamento\`      DATETIME(3) DEFAULT NULL,
      \`proximoVencimento\`    DATETIME(3) DEFAULT NULL,
      \`diasAtraso\`           INT NOT NULL DEFAULT 0,
      \`observacoes\`          TEXT DEFAULT NULL,
      \`updatedAt\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      \`latitude\`             DOUBLE DEFAULT NULL,
      \`longitude\`            DOUBLE DEFAULT NULL,
      \`deliveryRadius\`       DOUBLE DEFAULT NULL,
      \`certificadoNome\`      VARCHAR(191) DEFAULT NULL,
      \`certificadoPath\`      VARCHAR(191) DEFAULT NULL,
      \`certificadoSenha\`     VARCHAR(191) DEFAULT NULL,
      \`csc\`                  VARCHAR(191) DEFAULT NULL,
      \`cscId\`                VARCHAR(191) DEFAULT NULL,
      \`xmlFolder\`            VARCHAR(191) DEFAULT NULL,
      \`cashbackPercent\`      DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      \`pointsPerCurrency\`    DECIMAL(5,2) NOT NULL DEFAULT 1.00,
      \`pontosParaResgate\`    INT NOT NULL DEFAULT 0,
      \`valorResgate\`         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Company_cnpj_key\` (\`cnpj\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'company');

  // ============================================================
  // ETAPA 3: Tabelas com FK para role (employee, customer)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`employee\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`cpf\`          VARCHAR(191) DEFAULT NULL,
      \`email\`        VARCHAR(191) DEFAULT NULL,
      \`endereco\`     VARCHAR(191) DEFAULT NULL,
      \`bairro\`       VARCHAR(191) DEFAULT NULL,
      \`telefone\`     VARCHAR(191) DEFAULT NULL,
      \`cargo\`        VARCHAR(191) DEFAULT NULL,
      \`salario\`      DECIMAL(10,2) DEFAULT NULL,
      \`dataAdmissao\` DATETIME(3) DEFAULT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`roleId\`       INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`Employee_roleId_fkey\` (\`roleId\`),
      CONSTRAINT \`Employee_roleId_fkey\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'employee');

  await run(`
    CREATE TABLE IF NOT EXISTS \`customer\` (
      \`id\`                  INT NOT NULL AUTO_INCREMENT,
      \`nome\`                VARCHAR(191) DEFAULT NULL,
      \`endereco\`            TEXT DEFAULT NULL,
      \`cidade\`              VARCHAR(191) DEFAULT NULL,
      \`estado\`              VARCHAR(191) DEFAULT NULL,
      \`fone\`                VARCHAR(191) DEFAULT NULL,
      \`cpf\`                 VARCHAR(191) DEFAULT NULL,
      \`rg\`                  VARCHAR(191) DEFAULT NULL,
      \`dataNascimento\`      DATETIME(3) DEFAULT NULL,
      \`ativo\`               TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`cep\`                 VARCHAR(191) DEFAULT NULL,
      \`saldoCashback\`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`pontos\`              INT NOT NULL DEFAULT 0,
      \`participaFidelidade\` TINYINT(1) NOT NULL DEFAULT 1,
      \`email\`               VARCHAR(191) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Customer_cpf_key\` (\`cpf\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'customer');

  // ============================================================
  // ETAPA 4: setorimpressao (FK para printer)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`setorimpressao\` (
      \`id\`              INT NOT NULL AUTO_INCREMENT,
      \`nome\`            VARCHAR(191) NOT NULL,
      \`descricao\`       VARCHAR(191) DEFAULT NULL,
      \`modoEnvio\`       ENUM('impressora','whatsapp') NOT NULL DEFAULT 'impressora',
      \`whatsappDestino\` VARCHAR(191) DEFAULT NULL,
      \`ativo\`           TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`printerId\`       INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`SetorImpressao_nome_key\` (\`nome\`),
      KEY \`SetorImpressao_printerId_fkey\` (\`printerId\`),
      CONSTRAINT \`SetorImpressao_printerId_fkey\` FOREIGN KEY (\`printerId\`) REFERENCES \`printer\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'setorimpressao');

  // ============================================================
  // ETAPA 5: product (FK para categoria, tipo, productgroup, unidademedida)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`product\` (
      \`id\`                  INT NOT NULL AUTO_INCREMENT,
      \`nome\`                VARCHAR(191) NOT NULL,
      \`descricao\`           VARCHAR(191) DEFAULT NULL,
      \`precoCusto\`          DECIMAL(10,2) NOT NULL,
      \`precoVenda\`          DECIMAL(10,2) NOT NULL,
      \`categoria\`           VARCHAR(191) DEFAULT NULL,
      \`tipo\`                VARCHAR(191) DEFAULT NULL,
      \`grupo\`               VARCHAR(191) DEFAULT NULL,
      \`unidade\`             VARCHAR(191) NOT NULL DEFAULT 'un',
      \`ativo\`               TINYINT(1) NOT NULL DEFAULT 1,
      \`dadosFiscais\`        VARCHAR(191) DEFAULT NULL,
      \`quantidade\`          INT NOT NULL DEFAULT 0,
      \`imagem\`              VARCHAR(191) DEFAULT NULL,
      \`tempoPreparoMinutos\` INT NOT NULL DEFAULT 0,
      \`disponivel\`          TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`categoriaId\`         INT DEFAULT NULL,
      \`groupId\`             INT DEFAULT NULL,
      \`tipoId\`              INT DEFAULT NULL,
      \`unidadeMedidaId\`     INT DEFAULT NULL,
      \`temVariacao\`         TINYINT(1) NOT NULL DEFAULT 0,
      \`temTamanhos\`         TINYINT(1) NOT NULL DEFAULT 0,
      \`cest\`                VARCHAR(191) DEFAULT NULL,
      \`cfop\`                VARCHAR(191) DEFAULT NULL,
      \`csosn\`               VARCHAR(191) DEFAULT NULL,
      \`icmsAliquota\`        DECIMAL(5,2) DEFAULT NULL,
      \`icmsSituacao\`        VARCHAR(191) DEFAULT NULL,
      \`ncm\`                 VARCHAR(191) DEFAULT NULL,
      \`origem\`              INT NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      KEY \`Product_categoriaId_fkey\` (\`categoriaId\`),
      KEY \`Product_tipoId_fkey\` (\`tipoId\`),
      KEY \`Product_groupId_fkey\` (\`groupId\`),
      KEY \`Product_unidadeMedidaId_fkey\` (\`unidadeMedidaId\`),
      CONSTRAINT \`Product_categoriaId_fkey\` FOREIGN KEY (\`categoriaId\`) REFERENCES \`categoria\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Product_groupId_fkey\` FOREIGN KEY (\`groupId\`) REFERENCES \`productgroup\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Product_tipoId_fkey\` FOREIGN KEY (\`tipoId\`) REFERENCES \`tipo\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Product_unidadeMedidaId_fkey\` FOREIGN KEY (\`unidadeMedidaId\`) REFERENCES \`unidademedida\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'product');

  // ============================================================
  // ETAPA 6: sale (FK para employee, customer — sem mesa ainda pois mesa tem FK para sale)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`sale\` (
      \`id\`                       INT NOT NULL AUTO_INCREMENT,
      \`funcionarioId\`            INT DEFAULT NULL,
      \`clienteId\`                INT DEFAULT NULL,
      \`mesaId\`                   INT DEFAULT NULL,
      \`responsavelNome\`          VARCHAR(191) DEFAULT NULL,
      \`responsavelFuncionarioId\` INT DEFAULT NULL,
      \`funcionarioNome\`          VARCHAR(191) DEFAULT NULL,
      \`funcionarioAberturaNome\`  VARCHAR(191) DEFAULT NULL,
      \`funcionarioAberturaId\`    INT DEFAULT NULL,
      \`numeroComanda\`            VARCHAR(191) DEFAULT NULL,
      \`nomeComanda\`              VARCHAR(191) DEFAULT NULL,
      \`tipoVenda\`                ENUM('balcao','mesa','delivery','comanda') NOT NULL DEFAULT 'balcao',
      \`subtotal\`                 DECIMAL(10,2) NOT NULL,
      \`desconto\`                 DECIMAL(10,2) NOT NULL,
      \`total\`                    DECIMAL(10,2) NOT NULL,
      \`formaPagamento\`           ENUM('dinheiro','cartao','pix','cashback') NOT NULL DEFAULT 'dinheiro',
      \`status\`                   ENUM('aberta','finalizada','cancelada') NOT NULL DEFAULT 'aberta',
      \`dataVenda\`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`dataFinalizacao\`          DATETIME(3) DEFAULT NULL,
      \`observacoes\`              VARCHAR(191) DEFAULT NULL,
      \`tempoPreparoEstimado\`     INT NOT NULL DEFAULT 0,
      \`impressaoCozinha\`         TINYINT(1) NOT NULL DEFAULT 0,
      \`impressaoBar\`             TINYINT(1) NOT NULL DEFAULT 0,
      \`createdAt\`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      \`deliveryAddress\`          TEXT DEFAULT NULL,
      \`deliveryDistance\`         DOUBLE DEFAULT NULL,
      \`deliveryFee\`              DECIMAL(10,2) DEFAULT NULL,
      \`deliveryStatus\`           ENUM('pending','out_for_delivery','delivered','cancelled') DEFAULT 'pending',
      \`isDelivery\`               TINYINT(1) NOT NULL DEFAULT 0,
      \`entregadorId\`             INT DEFAULT NULL,
      \`cashbackGerado\`           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`cashbackUsado\`            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`pontosUsados\`             INT NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Sale_numeroComanda_key\` (\`numeroComanda\`),
      KEY \`Sale_funcionarioId_fkey\` (\`funcionarioId\`),
      KEY \`Sale_clienteId_fkey\` (\`clienteId\`),
      KEY \`Sale_mesaId_fkey\` (\`mesaId\`),
      KEY \`Sale_responsavelFuncionarioId_fkey\` (\`responsavelFuncionarioId\`),
      KEY \`Sale_funcionarioAberturaId_fkey\` (\`funcionarioAberturaId\`),
      KEY \`Sale_entregadorId_fkey\` (\`entregadorId\`),
      CONSTRAINT \`Sale_clienteId_fkey\` FOREIGN KEY (\`clienteId\`) REFERENCES \`customer\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Sale_entregadorId_fkey\` FOREIGN KEY (\`entregadorId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Sale_funcionarioAberturaId_fkey\` FOREIGN KEY (\`funcionarioAberturaId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Sale_funcionarioId_fkey\` FOREIGN KEY (\`funcionarioId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Sale_responsavelFuncionarioId_fkey\` FOREIGN KEY (\`responsavelFuncionarioId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'sale');

  // ============================================================
  // ETAPA 7: mesa (FK para employee e sale — circular, mesaId em sale é adicionado depois)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`mesa\` (
      \`id\`                       INT NOT NULL AUTO_INCREMENT,
      \`numero\`                   INT NOT NULL,
      \`nome\`                     VARCHAR(191) NOT NULL,
      \`capacidade\`               INT NOT NULL,
      \`status\`                   ENUM('livre','ocupada','reservada','manutencao') NOT NULL DEFAULT 'livre',
      \`vendaAtualId\`             INT DEFAULT NULL,
      \`funcionarioResponsavelId\` INT DEFAULT NULL,
      \`nomeResponsavel\`          VARCHAR(191) DEFAULT NULL,
      \`clientesAtuais\`           INT NOT NULL DEFAULT 0,
      \`horaAbertura\`             DATETIME(3) DEFAULT NULL,
      \`observacoes\`              VARCHAR(191) DEFAULT NULL,
      \`tipo\`                     ENUM('interna','externa','vip','reservada','balcao') NOT NULL DEFAULT 'interna',
      \`ativo\`                    TINYINT(1) NOT NULL DEFAULT 1,
      \`createdAt\`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Mesa_numero_key\` (\`numero\`),
      UNIQUE KEY \`Mesa_vendaAtualId_key\` (\`vendaAtualId\`),
      KEY \`Mesa_funcionarioResponsavelId_fkey\` (\`funcionarioResponsavelId\`),
      CONSTRAINT \`Mesa_funcionarioResponsavelId_fkey\` FOREIGN KEY (\`funcionarioResponsavelId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`Mesa_vendaAtualId_fkey\` FOREIGN KEY (\`vendaAtualId\`) REFERENCES \`sale\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'mesa');

  // Adiciona FK mesaId em sale (pode já existir)
  await run(
    "ALTER TABLE `sale` ADD CONSTRAINT `Sale_mesaId_fkey` FOREIGN KEY (`mesaId`) REFERENCES `mesa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;",
    'sale.mesaId_fkey'
  );

  // ============================================================
  // ETAPA 8: user (FK para employee e role)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`user\` (
      \`id\`           INT NOT NULL AUTO_INCREMENT,
      \`email\`        VARCHAR(191) NOT NULL,
      \`senha\`        VARCHAR(191) NOT NULL,
      \`nome\`         VARCHAR(191) NOT NULL,
      \`tipo\`         ENUM('admin','funcionario') NOT NULL DEFAULT 'funcionario',
      \`employeeId\`   INT DEFAULT NULL,
      \`permissoes\`   JSON DEFAULT NULL,
      \`ativo\`        TINYINT(1) NOT NULL DEFAULT 1,
      \`dataInclusao\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`ultimoLogin\`  DATETIME(3) DEFAULT NULL,
      \`roleId\`       INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`User_email_key\` (\`email\`),
      KEY \`User_employeeId_fkey\` (\`employeeId\`),
      KEY \`User_roleId_fkey\` (\`roleId\`),
      CONSTRAINT \`User_employeeId_fkey\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`User_roleId_fkey\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'user');

  // ============================================================
  // ETAPA 9: caixa (FK para employee)
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`caixa\` (
      \`id\`                      INT NOT NULL AUTO_INCREMENT,
      \`dataAbertura\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`dataFechamento\`          DATETIME(3) DEFAULT NULL,
      \`valorAbertura\`           DECIMAL(10,2) NOT NULL,
      \`valorFechamento\`         DECIMAL(10,2) DEFAULT NULL,
      \`totalVendas\`             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`totalDinheiro\`           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`totalCartao\`             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`totalPix\`                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`funcionarioAberturaId\`   INT NOT NULL,
      \`funcionarioFechamentoId\` INT DEFAULT NULL,
      \`status\`                  ENUM('aberto','fechado') NOT NULL DEFAULT 'aberto',
      \`observacoes\`             VARCHAR(191) DEFAULT NULL,
      \`createdAt\`               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`Caixa_funcionarioAberturaId_fkey\` (\`funcionarioAberturaId\`),
      KEY \`Caixa_funcionarioFechamentoId_fkey\` (\`funcionarioFechamentoId\`),
      CONSTRAINT \`Caixa_funcionarioAberturaId_fkey\` FOREIGN KEY (\`funcionarioAberturaId\`) REFERENCES \`employee\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`Caixa_funcionarioFechamentoId_fkey\` FOREIGN KEY (\`funcionarioFechamentoId\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'caixa');

  // ============================================================
  // ETAPA 10: tabelas que dependem de sale, product, caixa, setorimpressao
  // ============================================================

  await run(`
    CREATE TABLE IF NOT EXISTS \`saleitem\` (
      \`id\`                INT NOT NULL AUTO_INCREMENT,
      \`saleId\`            INT NOT NULL,
      \`productId\`         INT DEFAULT NULL,
      \`nomeProduto\`       VARCHAR(191) NOT NULL,
      \`quantidade\`        INT NOT NULL,
      \`precoUnitario\`     DECIMAL(10,2) NOT NULL,
      \`subtotal\`          DECIMAL(10,2) NOT NULL,
      \`status\`            VARCHAR(20) NOT NULL DEFAULT 'pendente',
      \`createdAt\`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`preparedAt\`        DATETIME(3) DEFAULT NULL,
      \`preparedById\`      INT DEFAULT NULL,
      \`origem\`            VARCHAR(20) DEFAULT 'default',
      \`variacaoOpcoes\`    JSON DEFAULT NULL,
      \`variacaoRegraPreco\` ENUM('mais_caro','media','fixo') DEFAULT NULL,
      \`variacaoTipo\`      VARCHAR(50) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`SaleItem_saleId_fkey\` (\`saleId\`),
      KEY \`SaleItem_productId_fkey\` (\`productId\`),
      KEY \`SaleItem_preparedById_fkey\` (\`preparedById\`),
      CONSTRAINT \`SaleItem_preparedById_fkey\` FOREIGN KEY (\`preparedById\`) REFERENCES \`employee\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`SaleItem_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`product\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`SaleItem_saleId_fkey\` FOREIGN KEY (\`saleId\`) REFERENCES \`sale\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'saleitem');

  await run(`
    CREATE TABLE IF NOT EXISTS \`caixavenda\` (
      \`id\`             INT NOT NULL AUTO_INCREMENT,
      \`caixaId\`        INT NOT NULL,
      \`vendaId\`        INT NOT NULL,
      \`valor\`          DECIMAL(10,2) NOT NULL,
      \`formaPagamento\` ENUM('dinheiro','cartao','pix','cashback') NOT NULL,
      \`dataVenda\`      DATETIME(3) NOT NULL,
      \`itensPagos\`     JSON DEFAULT NULL,
      \`observacoes\`    VARCHAR(191) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`CaixaVenda_caixaId_fkey\` (\`caixaId\`),
      KEY \`CaixaVenda_vendaId_fkey\` (\`vendaId\`),
      CONSTRAINT \`CaixaVenda_caixaId_fkey\` FOREIGN KEY (\`caixaId\`) REFERENCES \`caixa\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`CaixaVenda_vendaId_fkey\` FOREIGN KEY (\`vendaId\`) REFERENCES \`sale\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'caixavenda');

  await run(`
    CREATE TABLE IF NOT EXISTS \`nfce\` (
      \`id\`             INT NOT NULL AUTO_INCREMENT,
      \`saleId\`         INT NOT NULL,
      \`chave\`          VARCHAR(191) NOT NULL,
      \`numero\`         INT NOT NULL,
      \`serie\`          INT NOT NULL,
      \`status\`         ENUM('PENDENTE','PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA','DENEGADA','CONTINGENCIA','CONTINGENCIA_REJEITADA','CONTINGENCIA_EXPIRADA','INUTILIZADA') NOT NULL DEFAULT 'PENDENTE',
      \`ambiente\`       ENUM('homologacao','producao') NOT NULL DEFAULT 'homologacao',
      \`xml\`            LONGTEXT NOT NULL,
      \`protocolo\`      VARCHAR(191) DEFAULT NULL,
      \`motivo\`         VARCHAR(191) DEFAULT NULL,
      \`qrCode\`         TEXT DEFAULT NULL,
      \`urlConsulta\`    TEXT DEFAULT NULL,
      \`pdfPath\`        VARCHAR(191) DEFAULT NULL,
      \`tpEmis\`         INT NOT NULL DEFAULT 1,
      \`dhCont\`         DATETIME(3) DEFAULT NULL,
      \`xJust\`          VARCHAR(255) DEFAULT NULL,
      \`tentativas\`     INT NOT NULL DEFAULT 0,
      \`ultimaTentativa\` DATETIME(3) DEFAULT NULL,
      \`prazoLimite\`    DATETIME(3) DEFAULT NULL,
      \`erroUltimo\`     TEXT DEFAULT NULL,
      \`createdAt\`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`Nfce_saleId_key\` (\`saleId\`),
      UNIQUE KEY \`Nfce_chave_key\` (\`chave\`),
      CONSTRAINT \`Nfce_saleId_fkey\` FOREIGN KEY (\`saleId\`) REFERENCES \`sale\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'nfce');

  await run(`
    CREATE TABLE IF NOT EXISTS \`nfceevent\` (
      \`id\`        INT NOT NULL AUTO_INCREMENT,
      \`nfceId\`    INT NOT NULL,
      \`tipo\`      VARCHAR(191) NOT NULL,
      \`sequencia\` INT NOT NULL DEFAULT 1,
      \`xmlEnvio\`  TEXT DEFAULT NULL,
      \`xmlRetorno\` TEXT DEFAULT NULL,
      \`status\`    VARCHAR(191) DEFAULT NULL,
      \`motivo\`    VARCHAR(191) DEFAULT NULL,
      \`protocolo\` VARCHAR(191) DEFAULT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`NfceEvent_nfceId_fkey\` (\`nfceId\`),
      CONSTRAINT \`NfceEvent_nfceId_fkey\` FOREIGN KEY (\`nfceId\`) REFERENCES \`nfce\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'nfceevent');

  await run(`
    CREATE TABLE IF NOT EXISTS \`printjob\` (
      \`id\`          INT NOT NULL AUTO_INCREMENT,
      \`saleId\`      INT DEFAULT NULL,
      \`productId\`   INT NOT NULL,
      \`setorId\`     INT NOT NULL,
      \`printerId\`   INT DEFAULT NULL,
      \`content\`     TEXT NOT NULL,
      \`status\`      ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
      \`error\`       TEXT DEFAULT NULL,
      \`createdAt\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`processedAt\` DATETIME(3) DEFAULT NULL,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'printjob');

  await run(`
    CREATE TABLE IF NOT EXISTS \`productsetorimpressao\` (
      \`productId\` INT NOT NULL,
      \`setorId\`   INT NOT NULL,
      PRIMARY KEY (\`productId\`, \`setorId\`),
      KEY \`ProductSetorImpressao_setorId_fkey\` (\`setorId\`),
      CONSTRAINT \`ProductSetorImpressao_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`product\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`ProductSetorImpressao_setorId_fkey\` FOREIGN KEY (\`setorId\`) REFERENCES \`setorimpressao\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'productsetorimpressao');

  await run(`
    CREATE TABLE IF NOT EXISTS \`productsize\` (
      \`id\`        INT NOT NULL AUTO_INCREMENT,
      \`productId\` INT NOT NULL,
      \`nome\`      VARCHAR(191) NOT NULL,
      \`preco\`     DECIMAL(10,2) NOT NULL,
      \`ativo\`     TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id\`),
      KEY \`ProductSize_productId_fkey\` (\`productId\`),
      CONSTRAINT \`ProductSize_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`product\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'productsize');

  await run(`
    CREATE TABLE IF NOT EXISTS \`deliveryrange\` (
      \`id\`        INT NOT NULL AUTO_INCREMENT,
      \`minDist\`   DOUBLE NOT NULL,
      \`maxDist\`   DOUBLE NOT NULL,
      \`price\`     DECIMAL(10,2) NOT NULL,
      \`companyId\` INT NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`DeliveryRange_companyId_fkey\` (\`companyId\`),
      CONSTRAINT \`DeliveryRange_companyId_fkey\` FOREIGN KEY (\`companyId\`) REFERENCES \`company\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'deliveryrange');

  // ============================================================
  // ETAPA 11: Migrações de colunas (ADD COLUMN IF NOT EXISTS)
  // Colunas que foram adicionadas depois da criação inicial das tabelas
  // ============================================================

  // Nfce - campos de contingência (bancos antigos que criaram sem esses campos)
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `tpEmis` INT NOT NULL DEFAULT 1;", 'nfce.tpEmis');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `dhCont` DATETIME(3) DEFAULT NULL;", 'nfce.dhCont');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `xJust` VARCHAR(255) DEFAULT NULL;", 'nfce.xJust');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `tentativas` INT NOT NULL DEFAULT 0;", 'nfce.tentativas');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `ultimaTentativa` DATETIME(3) DEFAULT NULL;", 'nfce.ultimaTentativa');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `prazoLimite` DATETIME(3) DEFAULT NULL;", 'nfce.prazoLimite');
  await run("ALTER TABLE `nfce` ADD COLUMN IF NOT EXISTS `erroUltimo` TEXT DEFAULT NULL;", 'nfce.erroUltimo');

  // Nfce - atualizar enum status para incluir novos valores de contingência
  await run(
    "ALTER TABLE `nfce` MODIFY COLUMN `status` ENUM('PENDENTE','PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA','DENEGADA','CONTINGENCIA','CONTINGENCIA_REJEITADA','CONTINGENCIA_EXPIRADA','INUTILIZADA') NOT NULL DEFAULT 'PENDENTE';",
    'nfce.status enum update'
  );

  // Sale - campos de delivery e cashback
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `deliveryAddress` TEXT DEFAULT NULL;", 'sale.deliveryAddress');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `deliveryDistance` DOUBLE DEFAULT NULL;", 'sale.deliveryDistance');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `deliveryFee` DECIMAL(10,2) DEFAULT NULL;", 'sale.deliveryFee');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `deliveryStatus` ENUM('pending','out_for_delivery','delivered','cancelled') DEFAULT 'pending';", 'sale.deliveryStatus');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `isDelivery` TINYINT(1) NOT NULL DEFAULT 0;", 'sale.isDelivery');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `entregadorId` INT DEFAULT NULL;", 'sale.entregadorId');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `cashbackGerado` DECIMAL(10,2) NOT NULL DEFAULT 0.00;", 'sale.cashbackGerado');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `cashbackUsado` DECIMAL(10,2) NOT NULL DEFAULT 0.00;", 'sale.cashbackUsado');
  await run("ALTER TABLE `sale` ADD COLUMN IF NOT EXISTS `pontosUsados` INT NOT NULL DEFAULT 0;", 'sale.pontosUsados');

  // SaleItem - campos de variação e origem
  await run("ALTER TABLE `saleitem` ADD COLUMN IF NOT EXISTS `origem` VARCHAR(20) DEFAULT 'default';", 'saleitem.origem');
  await run("ALTER TABLE `saleitem` ADD COLUMN IF NOT EXISTS `variacaoTipo` VARCHAR(50) DEFAULT NULL;", 'saleitem.variacaoTipo');
  await run("ALTER TABLE `saleitem` ADD COLUMN IF NOT EXISTS `variacaoOpcoes` JSON DEFAULT NULL;", 'saleitem.variacaoOpcoes');
  await run("ALTER TABLE `saleitem` ADD COLUMN IF NOT EXISTS `variacaoRegraPreco` ENUM('mais_caro','media','fixo') DEFAULT NULL;", 'saleitem.variacaoRegraPreco');

  // Product - campos adicionados depois
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `temVariacao` TINYINT(1) NOT NULL DEFAULT 0;", 'product.temVariacao');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `temTamanhos` TINYINT(1) NOT NULL DEFAULT 0;", 'product.temTamanhos');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `ncm` VARCHAR(191) DEFAULT NULL;", 'product.ncm');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `cest` VARCHAR(191) DEFAULT NULL;", 'product.cest');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `cfop` VARCHAR(191) DEFAULT NULL;", 'product.cfop');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `csosn` VARCHAR(191) DEFAULT NULL;", 'product.csosn');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `icmsSituacao` VARCHAR(191) DEFAULT NULL;", 'product.icmsSituacao');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `icmsAliquota` DECIMAL(5,2) DEFAULT NULL;", 'product.icmsAliquota');
  await run("ALTER TABLE `product` ADD COLUMN IF NOT EXISTS `origem` INT NOT NULL DEFAULT 0;", 'product.origem');

  // SetorImpressao - campo printerId
  await run("ALTER TABLE `setorimpressao` ADD COLUMN IF NOT EXISTS `printerId` INT DEFAULT NULL;", 'setorimpressao.printerId');

  // Customer - campos de fidelidade e email
  await run("ALTER TABLE `customer` ADD COLUMN IF NOT EXISTS `saldoCashback` DECIMAL(10,2) NOT NULL DEFAULT 0.00;", 'customer.saldoCashback');
  await run("ALTER TABLE `customer` ADD COLUMN IF NOT EXISTS `pontos` INT NOT NULL DEFAULT 0;", 'customer.pontos');
  await run("ALTER TABLE `customer` ADD COLUMN IF NOT EXISTS `participaFidelidade` TINYINT(1) NOT NULL DEFAULT 1;", 'customer.participaFidelidade');
  await run("ALTER TABLE `customer` ADD COLUMN IF NOT EXISTS `email` VARCHAR(191) DEFAULT NULL;", 'customer.email');

  // Company - campos de NFC-e e fidelidade
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `csc` VARCHAR(191) DEFAULT NULL;", 'company.csc');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `cscId` VARCHAR(191) DEFAULT NULL;", 'company.cscId');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `certificadoNome` VARCHAR(191) DEFAULT NULL;", 'company.certificadoNome');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `certificadoSenha` VARCHAR(191) DEFAULT NULL;", 'company.certificadoSenha');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `certificadoPath` VARCHAR(191) DEFAULT NULL;", 'company.certificadoPath');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `xmlFolder` VARCHAR(191) DEFAULT NULL;", 'company.xmlFolder');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `cashbackPercent` DECIMAL(5,2) NOT NULL DEFAULT 5.00;", 'company.cashbackPercent');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `pointsPerCurrency` DECIMAL(5,2) NOT NULL DEFAULT 1.00;", 'company.pointsPerCurrency');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `pontosParaResgate` INT NOT NULL DEFAULT 0;", 'company.pontosParaResgate');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `valorResgate` DECIMAL(10,2) NOT NULL DEFAULT 0.00;", 'company.valorResgate');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `latitude` DOUBLE DEFAULT NULL;", 'company.latitude');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `longitude` DOUBLE DEFAULT NULL;", 'company.longitude');
  await run("ALTER TABLE `company` ADD COLUMN IF NOT EXISTS `deliveryRadius` DOUBLE DEFAULT NULL;", 'company.deliveryRadius');

  // Employee - campo roleId
  await run("ALTER TABLE `employee` ADD COLUMN IF NOT EXISTS `roleId` INT DEFAULT NULL;", 'employee.roleId');

  // User - campo roleId
  await run("ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `roleId` INT DEFAULT NULL;", 'user.roleId');

  console.log('✅ [dbBootstrap] Verificação de tabelas concluída com sucesso!');

  // Executar sementes (seeds) de dados padrões
  await runSeeds(prisma);
}

/**
 * Insere registros padrões caso as tabelas correspondentes estejam vazias.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function runSeeds(prisma) {
  console.log('🌱 [dbBootstrap] Verificando sementes (seeds) de dados padrões...');

  // 1. Tipos
  try {
    const countTipos = await prisma.tipo.count();
    if (countTipos === 0) {
      console.log('🌱 [dbBootstrap] Inserindo tipos padrões...');
      await prisma.tipo.createMany({
        data: [
          { nome: 'alcoolicos', descricao: 'Bebidas alcoólicas' },
          { nome: 'nao alcoolicos', descricao: 'Bebidas não alcoólicas' },
          { nome: 'aliementos', descricao: 'Alimentos em geral' },
          { nome: 'importado', descricao: 'Produtos importados' },
          { nome: 'nacional', descricao: 'Produtos nacionais' }
        ]
      });
      console.log('🌱 [dbBootstrap] Tipos padrões inseridos com sucesso!');
    }
  } catch (err) {
    console.error('❌ [dbBootstrap] Erro ao inserir tipos padrões:', err.message);
  }

  // 2. Categorias
  try {
    const countCategorias = await prisma.categoria.count();
    if (countCategorias === 0) {
      console.log('🌱 [dbBootstrap] Inserindo categorias padrões...');
      await prisma.categoria.createMany({
        data: [
          { nome: 'cervejas', descricao: 'Cervejas em lata e garrafa' },
          { nome: 'refrigerantes', descricao: 'Refrigerantes e sucos' },
          { nome: 'salgados', descricao: 'Salgados assados e fritos' },
          { nome: 'doces', descricao: 'Doces e sobremesas' },
          { nome: 'doses', descricao: 'Doses de destilados' },
          { nome: 'lanches', descricao: 'Lanches e hambúrgueres' },
          { nome: 'porcoes', descricao: 'Porções variadas' }
        ]
      });
      console.log('🌱 [dbBootstrap] Categorias padrões inseridas com sucesso!');
    }
  } catch (err) {
    console.error('❌ [dbBootstrap] Erro ao inserir categorias padrões:', err.message);
  }

  // 3. Unidades de Medidas
  try {
    const countUnidades = await prisma.unidadeMedida.count();
    if (countUnidades === 0) {
      console.log('🌱 [dbBootstrap] Inserindo unidades de medida padrões...');
      await prisma.unidadeMedida.createMany({
        data: [
          { nome: 'quilo', sigla: 'kg', descricao: 'Quilo' },
          { nome: 'unidades', sigla: 'un', descricao: 'Unidades' },
          { nome: 'peças', sigla: 'pc', descricao: 'Peças' }
        ]
      });
      console.log('🌱 [dbBootstrap] Unidades de medida padrões inseridas com sucesso!');
    }
  } catch (err) {
    console.error('❌ [dbBootstrap] Erro ao inserir unidades de medida padrões:', err.message);
  }

  // 4. Setores
  try {
    const countSetores = await prisma.setorImpressao.count();
    if (countSetores === 0) {
      console.log('🌱 [dbBootstrap] Inserindo setores de impressão padrões...');
      await prisma.setorImpressao.createMany({
        data: [
          { nome: 'bar', descricao: 'Setor de preparo de bebidas', modoEnvio: 'impressora' },
          { nome: 'cozinha', descricao: 'Setor de preparo de pratos', modoEnvio: 'impressora' },
          { nome: 'chapa', descricao: 'Setor de preparo de lanches', modoEnvio: 'impressora' }
        ]
      });
      console.log('🌱 [dbBootstrap] Setores de impressão padrões inseridos com sucesso!');
    }
  } catch (err) {
    console.error('❌ [dbBootstrap] Erro ao inserir setores padrões:', err.message);
  }
}

