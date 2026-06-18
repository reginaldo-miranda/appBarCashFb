
import prisma from './lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    console.log('Creating Admin User...');

    // 1. Check if admin exists
    const existingUser = await prisma.user.findUnique({ where: { email: 'admin@barapp.com' } });
    if (existingUser) {
      console.log('Admin user already exists.');
      return;
    }

    // 2. Create Employee for Admin
    const adminEmployee = await prisma.employee.create({
      data: {
        nome: "Administrador Sistema",
        cpf: "000.000.000-00",
        email: "admin@barapp.com",
        cargo: "Admin",
        salario: 0,
        dataAdmissao: new Date(),
        ativo: true
      }
    });

    // 3. Create User
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = await prisma.user.create({
      data: {
        email: "admin@barapp.com",
        senha: hashedPassword,
        nome: "Administrador",
        tipo: "admin",
        employeeId: adminEmployee.id,
        permissoes: {
          vendas: true,
          produtos: true,
          clientes: true,
          funcionarios: true,
          relatorios: true,
          configuracoes: true,
          comandas: true,
          delivery: true,
          nfce: true,
          dashboard: true,
          caixa: true
        },
        ativo: true
      }
    });

    console.log(`✅ Admin user created: ${adminUser.email} / admin123`);

  } catch (error) {
    console.error('Failed to create admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
