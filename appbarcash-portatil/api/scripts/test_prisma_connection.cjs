const { PrismaClient } = require('@prisma/client');

// Forçando a URL diretamente para teste, ignorando .env temporariamente para isolar
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:saguides%40123@localhost:3307/appbar",
    },
  },
});

async function main() {
  console.log('Testando conexão com MariaDB na porta 3307...');
  try {
    const users = await prisma.user.count();
    console.log('Sucesso! Usuários encontrados:', users);
    
    const employees = await prisma.employee.count();
    console.log('Funcionários encontrados:', employees);

  } catch (e) {
    console.error('Erro ao conectar:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();