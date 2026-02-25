
import { PrismaClient } from '@prisma/client';

async function checkMySQL() {
  const url = "mysql://root:saguides%40123@localhost:3306/appBar";
  console.log(`Testando conexão com MySQL em: ${url}`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url,
      },
    },
  });

  try {
    await prisma.$connect();
    console.log("✅ Conexão bem-sucedida com MySQL (3306)!");
    
    try {
      const count = await prisma.tipo.count();
      console.log(`✅ Tabela 'Tipo' encontrada. Registros: ${count}`);
    } catch (e) {
      console.log("❌ Erro ao acessar tabela 'Tipo':", e.message);
      if (e.code === 'P2021') {
        console.log("⚠️  A tabela não existe. É necessário rodar as migrações.");
      }
    }
    
  } catch (e) {
    console.error("❌ Falha na conexão MySQL:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMySQL();
