import dotenv from 'dotenv';
import prisma from '../lib/prisma.js';

// Carrega .env padrão e fallback para ./api/.env
dotenv.config();
dotenv.config({ path: './api/.env' });

async function run() {
  try {
    // Localiza mesas de teste criadas nos fluxos anteriores
    const testes = await prisma.mesa.findMany({
      where: {
        OR: [
          { nome: { startsWith: 'Mesa Teste' } },
          { observacoes: 'Criada via teste' },
        ],
        ativo: true,
      },
      select: { id: true, numero: true, nome: true },
    });

    if (testes.length === 0) {
      console.log('Nenhuma mesa de teste encontrada.');
      return;
    }

    for (const m of testes) {
      await prisma.mesa.update({ where: { id: m.id }, data: { ativo: false } });
      console.log(`Removida mesa teste id=${m.id} numero=${m.numero} nome=${m.nome}`);
    }
  } catch (err) {
    console.error('Falha ao remover mesas de teste:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();