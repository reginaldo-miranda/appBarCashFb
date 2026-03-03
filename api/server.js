// primeiro server funcionando

/*import express from "express";
import cors from "cors";

const app = express();
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.0.176:8081', 'http://localhost:4000', 'http://192.168.0.176:4000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Rota raiz
app.get("/", (req, res) => {
  res.send("Servidor Express está rodando 🚀");
});

// Rota de teste
app.get("/api/hello", (req, res) => {
  res.json({ message: "API funcionando 🚀" });
});


const PORT = 4000; // usei 4000 só pra garantir que não tem conflito
app.listen(PORT, () => {
  console.log(`✅ API rodando em: http://localhost:${PORT}`);
});
*/

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
// dotenv loaded at top
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth.js";
import companyRoutes from "./routes/company.js";

// ... (existing imports)


import customerRoutes from "./routes/customer.js";
import productRoutes from "./routes/product.js";
import productGroupRoutes from "./routes/productGroup.js";
import employeeRoutes from "./routes/employee.js";
import saleRoutes from "./routes/sale.js";
import mesaRoutes from "./routes/mesa.js";
import userRoutes from "./routes/user.js";
import tipoRoutes from "./routes/tipo.js";
import unidadeMedidaRoutes from "./routes/unidadeMedida.js";
import categoriaRoutes from "./routes/categoria.js";
import caixaRoutes from "./routes/caixa.js";
import setorImpressaoRoutes from "./routes/setorImpressao.js";
import setorImpressaoQueueRoutes from "./routes/setorImpressaoQueue.js";
import setoresRoutes from "./routes/setores.js";
import printerRoutes from "./routes/printer.js";
import variationTypeRoutes from "./routes/variationType.js";
import nfceRoutes from "./routes/nfce.js";
import systemRoutes from "./routes/system.js";
import idleTimeConfigRoutes from "./routes/idleTimeConfig.js";
import roleRoutes from "./routes/roles.js";
import configRoutes from "./routes/config.js";

// dotenv configured at top

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVIR FRONTEND (Site) ---
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve arquivos estáticos da pasta 'public' (onde fica o build do site)
app.use(express.static(path.join(__dirname, "public")));

// --- FIM CONFIG SITE ---

// Rota de saúde pública para teste de conexão
// Endpoint para controle de API (usado pelo mobile)
app.get('/dev/start-api', (req, res) => {
  res.json({ ok: true, message: 'API já está rodando' });
});

app.get('/api/health', (req, res) => {
  // Determina alvo do banco (local vs railway) com base nas variáveis atuais
  const dbTarget = process.env.DB_TARGET || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? 'local' : 'railway');

  // Extrai informações seguras do DATABASE_URL sem expor credenciais
  const getDbInfo = () => {
    try {
      const urlStr = process.env.DATABASE_URL || '';
      const u = new URL(urlStr);
      const provider = (u.protocol || '').replace(':', '') || 'unknown';
      const host = u.hostname || '';
      const port = u.port || '';
      const database = (u.pathname || '').replace(/^\//, '') || '';
      const info = { provider, host };
      if (port) info.port = port;
      if (database) info.database = database;
      return info;
    } catch {
      return { provider: 'unknown' };
    }
  };

  const db = getDbInfo();
  res.json({ ok: true, status: 'healthy', timestamp: Date.now(), dbTarget, db });
});

// DESABILITADO - Sempre usar base local
// Novo endpoint: alternar alvo do banco (local/railway) dinamicamente
import prisma, { switchDbTarget, getProductsForTarget, getSchemaSummaryForTarget } from "./lib/prisma.js";
import { getSaleUpdates, onSaleUpdate } from "./lib/events.js";
app.post('/api/admin/db-target', async (req, res) => {
  try {
    const { target } = req.body || {};
    const next = String(target || '').toLowerCase() === 'railway' ? 'railway' : 'local';
    const result = await switchDbTarget(next);
    if (!result.ok) {
      return res.status(500).json({ ok: false, message: 'Falha ao alternar DB_TARGET' });
    }
    return res.json({ ok: true, target: result.target });
  } catch (err) {
    console.error('Erro ao alternar DB_TARGET:', err);
    return res.status(500).json({ ok: false, message: 'Erro interno' });
  }
});

app.get('/api/admin/compare/products', async (req, res) => {
  try {
    // USAR APENAS BASE LOCAL
    const local = await getProductsForTarget('local');
    const pick = (arr) => arr.map((p) => p.nome).slice(0, 10);
    res.json({
      ok: true,
      local: { count: local.length, sample: pick(local) },
      railway: { count: 0, sample: [] } // Base railway desabilitada
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/admin/schema/diff', async (req, res) => {
  try {
    // USAR APENAS BASE LOCAL - Railway desabilitada
    const local = await getSchemaSummaryForTarget('local');
    res.json({ ok: true, diff: {} }); // Sem diferenças, apenas local
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Endpoint para correções rápidas de schema (uso interno em LAN)
app.post('/api/admin/schema/fix', async (req, res) => {
  try {
    // Garantir SaleItem.status como VARCHAR(20)
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pendente';"
    );

    // Garantir Product.temVariacao
    try {
      const cols = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `Product` LIKE 'temVariacao'");
      const exists = Array.isArray(cols) && cols.length > 0;
      if (!exists) {
        await prisma.$executeRawUnsafe("ALTER TABLE `Product` ADD COLUMN `temVariacao` TINYINT(1) NOT NULL DEFAULT 0");
      }
    } catch {}

    // Garantir tabela VariationType
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `VariationType` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `nome` VARCHAR(191) NOT NULL,\n        `maxOpcoes` INTEGER NOT NULL DEFAULT 1,\n        `categoriasIds` JSON NULL,\n        `regraPreco` ENUM('mais_caro','media','fixo') NOT NULL DEFAULT 'mais_caro',\n        `precoFixo` DECIMAL(10,2) NULL,\n        `ativo` TINYINT(1) NOT NULL DEFAULT 1,\n        `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        UNIQUE INDEX `VariationType_nome_key`(`nome`),\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );

    // Garantir colunas de variação em SaleItem
    try {
      const c1 = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `SaleItem` LIKE 'variacaoTipo'");
      if (!Array.isArray(c1) || c1.length === 0) {
        await prisma.$executeRawUnsafe("ALTER TABLE `SaleItem` ADD COLUMN `variacaoTipo` VARCHAR(50) NULL");
      }
    } catch {}
    try {
      const c2 = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `SaleItem` LIKE 'variacaoOpcoes'");
      if (!Array.isArray(c2) || c2.length === 0) {
        await prisma.$executeRawUnsafe("ALTER TABLE `SaleItem` ADD COLUMN `variacaoOpcoes` JSON NULL");
      }
    } catch {}
    try {
      const c3 = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `SaleItem` LIKE 'variacaoRegraPreco'");
      if (!Array.isArray(c3) || c3.length === 0) {
        await prisma.$executeRawUnsafe("ALTER TABLE `SaleItem` ADD COLUMN `variacaoRegraPreco` ENUM('mais_caro','media','fixo') NULL");
      }
    } catch {}

    return res.json({ ok: true, message: 'Schema corrigido: Product.temVariacao + SaleItem.* + VariationType' });
  } catch (e) {
    console.error('Erro corrigindo schema:', e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/api/sale/updates', (req, res) => {
  try {
    const since = req.query.since || 0;
    const updates = getSaleUpdates(since);
    res.json({ ok: true, now: Date.now(), updates });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

const sseClients = [];
app.get('/api/sale/stream', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    res.write(`retry: 1000\n\n`);
    sseClients.push(res);
    const unsubscribe = onSaleUpdate((payload) => {
      try {
        const msg = { type: 'sale:update', payload };
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
        console.log('[SSE] sale:update enviado para cliente');
      } catch {}
    });
    req.on('close', () => {
      unsubscribe && unsubscribe();
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
      try { res.end(); } catch {}
    });
  } catch {
    res.status(500).end();
  }
});

// Middleware de autenticação JWT para proteger todas as rotas (exceto /api/auth)
const authenticate = (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "thunder");
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

// Rotas
app.use("/api/auth", authRoutes); // rotas públicas
app.use("/api/customer", authenticate, customerRoutes);
app.use("/api/company", authenticate, companyRoutes); // Nova rota de empresa
app.use("/api/product", authenticate, productRoutes);
app.use("/api/variation-type", authenticate, variationTypeRoutes);
app.use("/api/product-group", authenticate, productGroupRoutes);
app.use("/api/employee", employeeRoutes); // REMOVIDO AUTHENTICATE TEMPORARIAMENTE PARA DEBUG DE LISTAGEM
app.use("/api/sale", authenticate, saleRoutes);
app.use("/api/mesa", authenticate, mesaRoutes);
app.use("/api/user", authenticate, userRoutes);
app.use("/api/tipo", authenticate, tipoRoutes);
app.use("/api/unidade-medida", authenticate, unidadeMedidaRoutes);
app.use("/api/categoria", authenticate, categoriaRoutes);
app.use("/api/caixa", authenticate, caixaRoutes);
app.use("/api/setor-impressao", authenticate, setorImpressaoRoutes);
app.use("/api/setor-impressao-queue", authenticate, setorImpressaoQueueRoutes);
app.use("/api/setores", authenticate, setoresRoutes);
app.use("/api/printer", authenticate, printerRoutes);
app.use("/api/nfce", nfceRoutes);
app.use("/api/system", systemRoutes); // Public for setup
app.use("/api/idle-time-config", authenticate, idleTimeConfigRoutes);
app.use("/api/roles", authenticate, roleRoutes); 
app.use("/api/config", authenticate, configRoutes); // FIM ROTAS API

// Tratamento de 404 para rotas da API que não existem
app.all('/api/*', (req, res) => {
  res.status(404).json({ ok: false, message: 'Rota API não encontrada' });
});

// Para qualquer outra rota (que não seja API nem arquivo estático), servir o index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ API rodando em: http://0.0.0.0:${PORT}`));

// Conexão única com Prisma após iniciar servidor
const dbTarget = 'local';
prisma.$connect()
  .then(() => console.log(`✅ Conectado ao MySQL (${dbTarget})`))
  .catch(err => console.error("❌ Erro ao conectar MySQL:", err));

(async () => {
  try {
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `SetorImpressao` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `nome` VARCHAR(191) NOT NULL,\n        `descricao` VARCHAR(191) NULL,\n        `modoEnvio` ENUM('impressora','whatsapp') NOT NULL DEFAULT 'impressora',\n        `whatsappDestino` VARCHAR(191) NULL,\n        `ativo` BOOLEAN NOT NULL DEFAULT true,\n        `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        UNIQUE INDEX `SetorImpressao_nome_key`(`nome`),\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );

    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `Printer` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `nome` VARCHAR(191) NOT NULL,\n        `modelo` VARCHAR(191) NULL,\n        `address` VARCHAR(191) NULL,\n        `driver` VARCHAR(191) NULL,\n        `ativo` BOOLEAN NOT NULL DEFAULT true,\n        `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        UNIQUE INDEX `Printer_nome_key`(`nome`),\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SetorImpressao` ADD COLUMN IF NOT EXISTS `printerId` INTEGER NULL;"
    );
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `PrintJob` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `saleId` INTEGER NULL,\n        `productId` INTEGER NOT NULL,\n        `setorId` INTEGER NOT NULL,\n        `printerId` INTEGER NULL,\n        `content` TEXT NOT NULL,\n        `status` ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',\n        `error` TEXT NULL,\n        `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        `processedAt` DATETIME(3) NULL,\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `AppSetting` (\n        `key` VARCHAR(191) NOT NULL,\n        `value` VARCHAR(191) NULL,\n        `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        PRIMARY KEY (`key`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `SetorImpressao` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `nome` VARCHAR(191) NOT NULL,\n        `descricao` TEXT NULL,\n        `modoEnvio` ENUM('impressora','whatsapp') NOT NULL DEFAULT 'impressora',\n        `whatsappDestino` VARCHAR(191) NULL,\n        `printerId` INTEGER NULL,\n        `ativo` TINYINT(1) NOT NULL DEFAULT 1,\n        `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `WhatsAppMessageLog` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `saleId` INTEGER NULL,\n        `destino` VARCHAR(191) NOT NULL,\n        `content` TEXT NOT NULL,\n        `status` ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',\n        `error` TEXT NULL,\n        `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        `sentAt` DATETIME(3) NULL,\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pendente';"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` ADD COLUMN IF NOT EXISTS `origem` VARCHAR(20) NULL DEFAULT 'default';"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Product` ADD COLUMN IF NOT EXISTS `temVariacao` TINYINT(1) NOT NULL DEFAULT 0;"
    );
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `VariationType` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `nome` VARCHAR(191) NOT NULL,\n        `maxOpcoes` INTEGER NOT NULL DEFAULT 1,\n        `categoriasIds` JSON NULL,\n        `regraPreco` ENUM('mais_caro','media','fixo') NOT NULL DEFAULT 'mais_caro',\n        `precoFixo` DECIMAL(10,2) NULL,\n        `ativo` TINYINT(1) NOT NULL DEFAULT 1,\n        `dataInclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n        UNIQUE INDEX `VariationType_nome_key`(`nome`),\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` ADD COLUMN IF NOT EXISTS `variacaoTipo` VARCHAR(50) NULL;"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` ADD COLUMN IF NOT EXISTS `variacaoOpcoes` JSON NULL;"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `SaleItem` ADD COLUMN IF NOT EXISTS `variacaoRegraPreco` ENUM('mais_caro','media','fixo') NULL;"
    );
     await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `idletimeconfig` (\n        `id` INTEGER NOT NULL AUTO_INCREMENT,\n        `ativo` TINYINT(1) NOT NULL DEFAULT 0,\n        `usarHoraInclusao` TINYINT(1) NOT NULL DEFAULT 1,\n        `estagios` JSON NOT NULL,\n        `updatedAt` DATETIME(3) NOT NULL,\n        PRIMARY KEY (`id`)\n      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
  } catch {}
})();

// WebSocket server para eventos em tempo real (LAN, sem localhost)
(async () => {
  try {
    const { WebSocketServer } = await import('ws');
    const WS_PORT = process.env.WS_PORT || 4001;
    const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });
    const sockets = new Set();
    wss.on('connection', (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
    onSaleUpdate((payload) => {
      try {
        const msg = JSON.stringify({ type: 'sale:update', payload });
        sockets.forEach((ws) => { try { ws.send(msg); } catch {} });
      } catch {}
    });
    console.log(`🔌 WebSocket ativo em ws://0.0.0.0:${WS_PORT}`);
  } catch (e) {
    console.warn('WS desativado:', e?.message || e);
  }
})();

// Tratamento de encerramento gracioso
const gracefulShutdown = async () => {
  console.log('\n🛑 Encerrando servidor...');
  try {
    await prisma.$disconnect();
    console.log('✅ Conexão com o Banco de Dados fechada.');
  } catch (err) {
    console.error('Erro ao fechar conexão com o banco:', err);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
