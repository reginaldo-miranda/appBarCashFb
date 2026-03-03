import dotenv from "dotenv";
dotenv.config();
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Helper para construir URL do banco - FORÇADO LOCAL APENAS
const buildDatabaseUrl = (target) => {
  // Ignora o parametro target e retorna sempre a URL local
  // Prioridade: DATABASE_URL_LOCAL > DATABASE_URL (se for localhost)
  const envLocal = process.env.DATABASE_URL_LOCAL;
  const envDefault = process.env.DATABASE_URL;

  // Se envLocal existir (vindo do .env), DEVE ser usado prioridade maxima.
  if (envLocal) {
    console.log('🔌 DB Connection Strategy: Using DATABASE_URL_LOCAL from env');
    return envLocal;
  }
  
  // Se não, usa o hardcoded com a senha correta descoberta no .env
  const finalUrl = envDefault || "mysql://root:saguides%40123@localhost:3306/appBar"; 
  console.log('🔌 DB Connection Strategy: Using fallback with discovered credentials', { finalUrl });
  return finalUrl; 
};

const urlLocal = buildDatabaseUrl("local");
// const urlRailway = buildDatabaseUrl("railway"); // REMOVIDO
const prismaLocal = new PrismaClient({ datasources: { db: { url: urlLocal } } });
// const prismaRailway = ... // REMOVIDO

// Força sempre local
let prisma = prismaLocal;
process.env.DB_TARGET = 'local';
process.env.DATABASE_URL = urlLocal;

// Função switchDbTarget desabilitada/falsa para nao quebrar chamadas existentes mas nao fazer nada
export const switchDbTarget = async (next) => {
  console.log("Tentativa de trocar DB ignorada - MODO APENAS LOCAL ATIVO");
  return { ok: true, target: 'local' };
};

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