
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

function getDbConfig() {
  // Tenta extrair do DATABASE_URL_LOCAL ou DATABASE_URL
  const url = process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: u.username,
      password: u.password,
      database: u.pathname.substring(1)
    };
  } catch (e) {
    console.error('Erro parse URL:', e);
    return null;
  }
}

(async () => {
  const cfg = getDbConfig();
  if (!cfg) {
    console.error('Configuração de DB não encontrada');
    process.exit(1);
  }
  console.log('Conectando em:', cfg.host, cfg.database);
  
  try {
    const conn = await mysql.createConnection(cfg);
    const [rows] = await conn.query('SHOW TABLES');
    console.log('Tabelas encontradas:');
    rows.forEach(r => {
      const tableName = Object.values(r)[0];
      console.log(`- ${tableName}`);
    });
    
    // Check specific table details
    const [cols] = await conn.query("SHOW COLUMNS FROM `IdleTimeConfig`").catch(() => [[], []]);
    if (cols && cols.length) {
       console.log('Coluna `IdleTimeConfig` existe e tem colunas:', cols.length);
    } else {
       console.log('Tabela `IdleTimeConfig` (PascalCase) NÃO encontrada via query direta.');
       
       const [colsLower] = await conn.query("SHOW COLUMNS FROM `idletimeconfig`").catch(() => [[], []]);
       if (colsLower && colsLower.length) {
          console.log('Tabela `idletimeconfig` (lowercase) existe.');
       }
    }

    await conn.end();
  } catch (err) {
    console.error('Erro MySQL:', err);
  }
})();
