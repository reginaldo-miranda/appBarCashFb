import dotenv from "dotenv";
dotenv.config();
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Helper para construir URL do banco - FORÇADO LOCAL APENAS
const buildDatabaseUrl = () => {
  // Prioridade: DATABASE_URL_LOCAL > DATABASE_URL
  const envLocal = process.env.DATABASE_URL_LOCAL;
  const envDefault = process.env.DATABASE_URL;

  if (envLocal) {
    console.log('🔌 DB: Usando DATABASE_URL_LOCAL do .env');
    return envLocal;
  }
  
  if (envDefault) {
    console.log('🔌 DB: Usando DATABASE_URL do .env');
    return envDefault;
  }

  // Fallback com credenciais conhecidas
  const finalUrl = "mysql://root:saguides%40123@localhost:3306/appBarCash"; 
  console.log('🔌 DB: Usando URL fallback (nenhuma env encontrada)');
  return finalUrl; 
};

const urlLocal = buildDatabaseUrl();
const prismaLocal = new PrismaClient({ datasources: { db: { url: urlLocal } } });

// Força sempre local
let prisma = prismaLocal;
process.env.DB_TARGET = 'local';
process.env.DATABASE_URL = urlLocal;

export const switchDbTarget = async (next) => {
  console.log("Tentativa de trocar DB ignorada - MODO APENAS LOCAL ATIVO");
  return { ok: true, target: 'local' };
};

export const getCurrentDbInfo = () => {
  try {
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

export const getProductsForTarget = async () => {
  const prods = await prismaLocal.product.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { id: "asc" }, take: 50 });
  return prods;
};

export default prisma;
export const getPrisma = () => prisma;
export const getActivePrisma = () => prisma;

// Schema helpers (MySQL)
export const getColumnsForTarget = async (table) => {
  try {
    const rows = await prismaLocal.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\``);
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

export const getSchemaSummaryForTarget = async () => {
  const tables = [
    'Product', 'categoria', 'tipo', 'productGroup', 'unidadeMedida'
  ];
  const summary = {};
  for (const t of tables) {
    summary[t] = await getColumnsForTarget(t);
  }
  return summary;
};