
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando restauração de papéis (Roles)...');

  const roles = [
    {
      nome: 'Administrador',
      descricao: 'Acesso total ao sistema',
      permissoes: {
        vendas: true,
        produtos: true,
        funcionarios: true,
        clientes: true,
        relatorios: true,
        configuracoes: true,
        comandas: true,
        delivery: true,
        nfce: true,
        dashboard: true,
        caixa: true
      }
    },
    {
      nome: 'Gerente',
      descricao: 'Gestão da loja e equipe',
      permissoes: {
        vendas: true,
        produtos: true,
        funcionarios: true,
        clientes: true,
        relatorios: true,
        configuracoes: false,
        comandas: true,
        delivery: true,
        nfce: true,
        dashboard: true,
        caixa: true
      }
    },
    {
      nome: 'Caixa',
      descricao: 'Operador de caixa e vendas',
      permissoes: {
        vendas: true,
        produtos: false,
        funcionarios: false,
        clientes: true,
        relatorios: false,
        configuracoes: false,
        comandas: true,
        delivery: true,
        nfce: true,
        dashboard: false,
        caixa: true
      }
    },
    {
      nome: 'Garçom',
      descricao: 'Atendimento de mesas e pedidos',
      permissoes: {
        vendas: true,
        produtos: false,
        funcionarios: false,
        clientes: true,
        relatorios: false,
        configuracoes: false,
        comandas: true,
        delivery: false,
        nfce: false,
        dashboard: false,
        caixa: false
      }
    },
    {
      nome: 'Cozinha',
      descricao: 'Visualização de pedidos',
      permissoes: {
        vendas: false,
        produtos: false,
        funcionarios: false,
        clientes: false,
        relatorios: false,
        configuracoes: false,
        comandas: true,
        delivery: false,
        nfce: false,
        dashboard: false,
        caixa: false
      }
    }
  ];

  for (const role of roles) {
    const existing = await prisma.role.findUnique({ where: { nome: role.nome } });
    if (!existing) {
      await prisma.role.create({
        data: role
      });
      console.log(`✅ Role criado: ${role.nome}`);
    } else {
      console.log(`ℹ️ Role já existe: ${role.nome}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
