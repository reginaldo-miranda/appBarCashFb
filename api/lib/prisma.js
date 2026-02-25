import dotenv from "dotenv";
dotenv.config();
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Helper para construir URL do banco - Suporta troca dinâmica e vendor
const buildDatabaseUrl = (target, vendor) => {
  const envLocal = process.env.DATABASE_URL_LOCAL;
  const envDefault = process.env.DATABASE_URL;

  // Se envLocal existir e não estivermos explicitamente pedindo outro vendor/target que invalide isso...
  // Mas para permitir a troca, vamos flexibilizar.
  
  // Se o usuário pediu MariaDB explicitamente
  if (vendor === 'mariadb') {
     const envMaria = process.env.DATABASE_URL_MARIADB;
     // Fallback para MariaDB local na porta 3307
     return envMaria || "mysql://root:saguides%40123@127.0.0.1:3307/appBar";
  }

  // Default MySQL
  if (envLocal) {
    console.log('🔌 DB Connection Strategy: Using DATABASE_URL_LOCAL from env');
    return envLocal;
  }
  
  const finalUrl = envDefault || "mysql://root:saguides%40123@127.0.0.1:3306/appBar"; 
  console.log('🔌 DB Connection Strategy: Using fallback with discovered credentials', { finalUrl, vendor });
  return finalUrl; 
};

// Gerenciamento de Cliente Prisma Dinâmico
let currentPrismaClient = null;

const getClient = () => {
  if (!currentPrismaClient) {
    const url = buildDatabaseUrl('local', 'mysql'); // Default start
    currentPrismaClient = new PrismaClient({ datasources: { db: { url } } });
  }
  return currentPrismaClient;
};

// Proxy para interceptar chamadas e direcionar ao cliente atual
const prismaProxy = new Proxy({}, {
  get: (target, prop) => {
    const client = getClient();
    if (prop === 'then') return client.then.bind(client);
    if (prop === '$connect') return client.$connect.bind(client);
    if (prop === '$disconnect') return client.$disconnect.bind(client);
    return client[prop];
  }
});

export const switchDbTarget = async (target, vendor) => {
  console.log(`Tentativa de trocar DB para: ${target} (Vendor: ${vendor})`);
  
  try {
    const newUrl = buildDatabaseUrl(target, vendor);
    console.log(`Nova URL gerada: ${newUrl}`);
    
    if (currentPrismaClient) {
      await currentPrismaClient.$disconnect();
    }
    
    currentPrismaClient = new PrismaClient({ datasources: { db: { url: newUrl } } });
    
    // Teste de conexão simples com timeout curto
    // O $queryRaw não tem timeout nativo fácil, mas o connect deve falhar se não der.
    await currentPrismaClient.$connect();
    await currentPrismaClient.$queryRaw`SELECT 1`;
    
    process.env.DB_TARGET = target;
    process.env.DB_VENDOR = vendor;
    process.env.DATABASE_URL = newUrl;
    
    return { ok: true, target, vendor };
  } catch (e) {
    console.error("Erro ao trocar banco de dados:", e);
    // Retorna mensagem de erro mais amigável
    let msg = e.message;
    if (msg.includes('P1001')) msg = "Não foi possível conectar ao servidor de banco de dados (P1001). Verifique se está rodando e a porta/host estão corretos.";
    if (msg.includes('P1003')) msg = "Banco de dados não encontrado (P1003). Verifique se o nome do banco está correto.";
    if (msg.includes('P1013')) msg = "String de conexão inválida (P1013).";
    if (msg.includes('Authentication failed')) msg = "Falha de autenticação (Senha/Usuário incorretos).";
    
    return { ok: false, reason: msg };
  }
};

const prisma = prismaProxy;


export const getCurrentDbInfo = () => {
  try {
    // Usar base local por padrão
    const urlStr = process.env.DATABASE_URL || urlLocal || "";
    const u = new URL(urlStr);
    const provider = (u.protocol || "").replace(":", "") || "unknown";
    const host = u.hostname || "";
    const port = u.port || "";
    const database = (u.pathname || "").replace(/^\//, "") || "";
    const info = { provider, host };
    if (port) info.port = port;
    if (database) info.database = database;
    return info;
  } catch {
    return { provider: "unknown" };
  }
};

export const getProductsForTarget = async (target) => {
  const t = String(target || '').toLowerCase();
  const client = t === 'railway' ? prismaRailway : prismaLocal;
  const prods = await client.product.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { id: "asc" }, take: 50 });
  return prods;
};

export default prisma;
export const getPrisma = () => prisma;
export const getActivePrisma = () => prisma;

// Schema helpers (MySQL)
export const getColumnsForTarget = async (target, table) => {
  const t = String(target || '').toLowerCase();
  const client = t === 'railway' ? prismaRailway : prismaLocal;
  try {
    const rows = await client.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\``);
    return rows.map(r => ({
      field: r.Field || r.field || r.COLUMN_NAME,
      type: r.Type || r.type || r.COLUMN_TYPE,
      nullable: (r.Null || r.IS_NULLABLE || '').toString().toUpperCase() === 'YES',
      key: r.Key || r.COLUMN_KEY || '',
      default: r.Default ?? r.COLUMN_DEFAULT ?? null,
      extra: r.Extra || r.EXTRA || ''
    }));
  } catch (e) {
    return [];
  }
};

export const getSchemaSummaryForTarget = async (target) => {
  const tables = [
    'Product', 'categoria', 'tipo', 'productGroup', 'unidadeMedida'
  ];
  const summary = {};
  for (const t of tables) {
    summary[t] = await getColumnsForTarget(target, t);
  }
  return summary;
};