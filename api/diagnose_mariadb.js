
import { PrismaClient } from '@prisma/client';

async function diagnoseMariaDB() {
  const url = "mysql://root:saguides%40123@127.0.0.1:3307/appBar";
  console.log(`🔍 Diagnóstico MariaDB (Porta 3307)`);
  console.log(`URL: ${url}`);
  
  // Primeiro tentar conectar sem banco específico para ver se o servidor responde
  const rootUrl = "mysql://root:saguides%40123@127.0.0.1:3307";
  const prismaRoot = new PrismaClient({ datasources: { db: { url: rootUrl } } });

  try {
    console.log("1️⃣ Tentando conectar na raiz do servidor...");
    await prismaRoot.$connect();
    console.log("✅ Conexão com o servidor MariaDB bem-sucedida!");
    
    // Listar bancos
    try {
      const dbs = await prismaRoot.$queryRaw`SHOW DATABASES`;
      console.log("📂 Bancos de dados encontrados:", dbs.map(d => d.Database).join(', '));
      
      const hasAppBar = dbs.some(d => d.Database === 'appBar');
      if (!hasAppBar) {
        console.error("❌ O banco de dados 'appBar' NÃO EXISTE no MariaDB.");
        console.log("💡 Solução: É necessário criar o banco e as tabelas.");
      } else {
        console.log("✅ Banco de dados 'appBar' existe.");
        
        // Agora conectar no banco específico e checar tabelas
        const prismaApp = new PrismaClient({ datasources: { db: { url: url } } });
        try {
            await prismaApp.$connect();
            const tables = await prismaApp.$queryRaw`SHOW TABLES`;
            const tableNames = tables.map(t => Object.values(t)[0]);
            console.log("📋 Tabelas no 'appBar':", tableNames.join(', '));
            
            if (tableNames.includes('Tipo') || tableNames.includes('tipo')) {
                console.log("✅ Tabela 'Tipo' encontrada.");
            } else {
                console.error("❌ Tabela 'Tipo' NÃO encontrada.");
                console.log("💡 Solução: É necessário rodar as migrações (prisma db push).");
            }
            await prismaApp.$disconnect();
        } catch (err) {
            console.error("❌ Erro ao conectar no banco 'appBar':", err.message);
        }
      }
      
    } catch (e) {
      console.error("❌ Erro ao listar bancos:", e.message);
    }

  } catch (e) {
    console.error("❌ Falha crítica ao conectar no servidor MariaDB:", e.message);
    console.log("👉 Verifique se a janela preta do MariaDB ainda está aberta.");
  } finally {
    await prismaRoot.$disconnect();
  }
}

diagnoseMariaDB();
