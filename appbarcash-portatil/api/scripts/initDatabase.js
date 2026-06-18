import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import ProductGroup from "../models/ProductGroup.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Mesa from "../models/Mesa.js";

dotenv.config();

async function initDatabase() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB Atlas");

    // Limpar collections existentes (opcional)
    console.log("🧹 Limpando collections existentes...");
    await User.deleteMany({});
    await Employee.deleteMany({});
    await ProductGroup.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Mesa.deleteMany({});

    // 1. Criar funcionário administrador
    console.log("👤 Criando funcionário administrador...");
    const adminEmployee = new Employee({
      nome: "Administrador",
      cpf: "000.000.000-00",
      telefone: "(00) 00000-0000",
      email: "admin@barapp.com",
      cargo: "Gerente",
      salario: 5000,
      dataAdmissao: new Date(),
      ativo: true
    });
    await adminEmployee.save();

    // 2. Criar usuário administrador
    console.log("🔐 Criando usuário administrador...");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = new User({
      email: "admin@barapp.com",
      senha: hashedPassword,
      nome: "Administrador",
      tipo: "admin",
      funcionario: adminEmployee._id,
      permissoes: {
        vendas: true,
        produtos: true,
        clientes: true,
        funcionarios: true,
        relatorios: true,
        configuracoes: true,
        comandas: true
      },
      ativo: true
    });
    await adminUser.save();

    // 3. Criar grupos de produtos
    console.log("📦 Criando grupos de produtos...");
    const grupos = [
      { nome: "Bebidas Alcoólicas", descricao: "Cervejas, vinhos, destilados" },
      { nome: "Bebidas Não Alcoólicas", descricao: "Refrigerantes, sucos, águas" },
      { nome: "Petiscos", descricao: "Porções, salgados, aperitivos" },
      { nome: "Pratos Principais", descricao: "Refeições completas" },
      { nome: "Sobremesas", descricao: "Doces e sobremesas" },
      { nome: "Outros", descricao: "Diversos produtos" }
    ];

    const gruposSalvos = [];
    for (const grupo of grupos) {
      const novoGrupo = new ProductGroup(grupo);
      await novoGrupo.save();
      gruposSalvos.push(novoGrupo);
    }

    // 4. Criar produtos de exemplo
    console.log("🍺 Criando produtos de exemplo...");
    const produtos = [
      // Bebidas Alcoólicas
      {
        nome: "Cerveja Skol 350ml",
        descricao: "Cerveja pilsen gelada",
        precoCusto: 2.50,
        precoVenda: 5.00,
        grupo: gruposSalvos[0]._id,
        unidade: "UN",
        quantidade: 100,
        ativo: true
      },
      {
        nome: "Cerveja Heineken 350ml",
        descricao: "Cerveja premium importada",
        precoCusto: 4.00,
        precoVenda: 8.00,
        grupo: gruposSalvos[0]._id,
        unidade: "UN",
        quantidade: 50,
        ativo: true
      },
      // Bebidas Não Alcoólicas
      {
        nome: "Coca-Cola 350ml",
        descricao: "Refrigerante de cola gelado",
        precoCusto: 2.00,
        precoVenda: 4.50,
        grupo: gruposSalvos[1]._id,
        unidade: "UN",
        quantidade: 80,
        ativo: true
      },
      {
        nome: "Água Mineral 500ml",
        descricao: "Água mineral natural",
        precoCusto: 1.00,
        precoVenda: 3.00,
        grupo: gruposSalvos[1]._id,
        unidade: "UN",
        quantidade: 60,
        ativo: true
      },
      // Petiscos
      {
        nome: "Porção de Batata Frita",
        descricao: "Batata frita crocante (500g)",
        precoCusto: 5.00,
        precoVenda: 15.00,
        grupo: gruposSalvos[2]._id,
        unidade: "UN",
        quantidade: 0,
        ativo: true
      },
      {
        nome: "Pastel de Queijo",
        descricao: "Pastel frito com queijo",
        precoCusto: 2.00,
        precoVenda: 6.00,
        grupo: gruposSalvos[2]._id,
        unidade: "UN",
        quantidade: 0,
        ativo: true
      },
      // Pratos Principais
      {
        nome: "Hambúrguer Artesanal",
        descricao: "Hambúrguer com pão, carne, queijo e salada",
        precoCusto: 8.00,
        precoVenda: 25.00,
        grupo: gruposSalvos[3]._id,
        unidade: "UN",
        quantidade: 0,
        ativo: true
      }
    ];

    for (const produto of produtos) {
      const novoProduto = new Product(produto);
      await novoProduto.save();
    }

    // 5. Criar funcionários de exemplo
    console.log("👥 Criando funcionários de exemplo...");
    const funcionarios = [
      {
        nome: "João Silva",
        cpf: "123.456.789-01",
        telefone: "(11) 99999-1111",
        email: "joao@barapp.com",
        cargo: "Garçom",
        salario: 2000,
        dataAdmissao: new Date(),
        ativo: true
      },
      {
        nome: "Maria Santos",
        cpf: "987.654.321-02",
        telefone: "(11) 99999-2222",
        email: "maria@barapp.com",
        cargo: "Cozinheira",
        salario: 2500,
        dataAdmissao: new Date(),
        ativo: true
      }
    ];

    const funcionariosSalvos = [];
    for (const funcionario of funcionarios) {
      const novoFuncionario = new Employee(funcionario);
      await novoFuncionario.save();
      funcionariosSalvos.push(novoFuncionario);
    }

    // Criar usuários para os funcionários
    console.log("🔐 Criando usuários para funcionários...");
    for (let i = 0; i < funcionariosSalvos.length; i++) {
      const funcionario = funcionariosSalvos[i];
      const hashedPass = await bcrypt.hash("123456", 10);
      
      console.log(`Criando usuário para: ${funcionario.nome} - ${funcionario.email}`);
      
      const novoUser = new User({
        email: funcionario.email,
        senha: hashedPass,
        nome: funcionario.nome,
        tipo: "funcionario",
        funcionario: funcionario._id,
        permissoes: {
          vendas: true,
          produtos: false,
          clientes: true,
          funcionarios: false,
          relatorios: false,
          configuracoes: false,
          comandas: true
        },
        ativo: true
      });
      await novoUser.save();
      console.log(`✅ Usuário criado para ${funcionario.nome}`);
    }

    // 6. Criar clientes de exemplo
    console.log("👤 Criando clientes de exemplo...");
    const clientes = [
      {
        nome: "Carlos Oliveira",
        cpf: "111.222.333-44",
        fone: "(11) 98888-1111",
        endereco: "Rua das Flores, 123",
        cidade: "São Paulo",
        estado: "SP",
        observacoes: "Cliente VIP"
      },
      {
        nome: "Ana Costa",
        cpf: "555.666.777-88",
        fone: "(11) 98888-2222",
        endereco: "Av. Principal, 456",
        cidade: "São Paulo",
        estado: "SP",
        observacoes: "Prefere mesa no fundo"
      },
      {
        nome: "Pedro Souza",
        cpf: "999.888.777-66",
        fone: "(11) 98888-3333",
        endereco: "Rua do Comércio, 789",
        cidade: "São Paulo",
        estado: "SP",
        observacoes: ""
      }
    ];

    for (const cliente of clientes) {
      const novoCliente = new Customer(cliente);
      await novoCliente.save();
    }

    // 7. Criar mesas básicas
    console.log("🪑 Criando mesas básicas...");
    const mesas = [];
    for (let i = 1; i <= 10; i++) {
      const mesa = new Mesa({
        numero: i.toString(),
        nome: `Mesa ${i}`,
        capacidade: i <= 6 ? 4 : 6, // Mesas 1-6 para 4 pessoas, 7-10 para 6 pessoas
        status: "livre",
        observacoes: i <= 6 ? "Mesa pequena" : "Mesa grande"
      });
      await mesa.save();
      mesas.push(mesa);
    }

    console.log("✅ Banco de dados inicializado com sucesso!");
    console.log("📊 Dados criados:");
    console.log(`   - 1 usuário administrador (admin@barapp.com / admin123)`);
    console.log(`   - ${funcionariosSalvos.length + 1} funcionários`);
    console.log(`   - ${gruposSalvos.length} grupos de produtos`);
    console.log(`   - ${produtos.length} produtos`);
    console.log(`   - ${clientes.length} clientes`);
    console.log(`   - ${mesas.length} mesas`);
    console.log("\n🔐 Credenciais de acesso:");
    console.log("   Admin: admin@barapp.com / admin123");
    console.log("   Funcionários: email do funcionário / 123456");

  } catch (error) {
    console.error("❌ Erro ao inicializar banco:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado do MongoDB");
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export default initDatabase;