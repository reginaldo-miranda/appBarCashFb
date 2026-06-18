
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

function getDbConfig() {
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
  
  try {
    const conn = await mysql.createConnection(cfg);
    console.log('Conectado ao DB. Criando tabela idletimeconfig...');
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS idletimeconfig (
        id INTEGER NOT NULL AUTO_INCREMENT,
        ativo TINYINT(1) NOT NULL DEFAULT 0,
        usarHoraInclusao TINYINT(1) NOT NULL DEFAULT 1,
        estagios JSON NOT NULL,
        updatedAt DATETIME(3) NOT NULL,
        PRIMARY KEY (id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    
    console.log('Tabela idletimeconfig criada/verificada com sucesso.');
    await conn.end();
  } catch (err) {
    console.error('Erro MySQL:', err);
    process.exit(1);
  }
})();
