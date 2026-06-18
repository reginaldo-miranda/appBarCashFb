import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Rota de cadastro
router.post("/register", async (req, res) => {
  try {
    const { email, senha, nome, tipo } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    const hashedSenha = await bcrypt.hash(senha, 10);

    await prisma.user.create({
      data: {
        email,
        senha: hashedSenha,
        nome: nome || email.split("@")[0],
        tipo: tipo === "admin" ? "admin" : "funcionario",
        ativo: true,
      },
    });

    return res.status(201).json({ message: "Usuário cadastrado com sucesso" });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return res.status(500).json({ error: "Erro no cadastro" });
  }
});

// Rota de login
router.post("/login", async (req, res) => {
  try {
    console.log('🔐 Login request received:', req.body);
    const { email, senha, password } = req.body;
    const senhaInput = senha || password;

    if (!email || !senhaInput) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    // Usuário admin fixo para primeiro acesso
    const adminFixo = {
      name: "Admin",
      email: "admin@admin.com",
      password: "123456",
      role: "admin",
    };

    // Verificar se é o usuário admin fixo
    if (email === adminFixo.email && senhaInput === adminFixo.password) {
      const token = jwt.sign(
        { admin: true, email: adminFixo.email },
        process.env.JWT_SECRET || "thunder",
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Login bem-sucedido",
        token,
        user: {
          _id: "admin-fixo",
          id: "admin-fixo",
          email: adminFixo.email,
          nome: adminFixo.name,
          tipo: "admin",
          permissoes: {
            vendas: true,
            produtos: true,
            funcionarios: true,
            clientes: true,
            relatorios: true,
            configuracoes: true,
            comandas: true,
          },
        },
      });
    }

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { 
        role: true,
        employee: {
           include: { role: true }
        }
      }
    });
    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    if (!user.ativo) {
      return res.status(403).json({ error: "Usuário inativo" });
    }

    const senhaCorreta = await bcrypt.compare(senhaInput, user.senha);
    if (!senhaCorreta) {
      return res.status(400).json({ error: "Senha incorreta" });
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, tipo: user.tipo },
      process.env.JWT_SECRET || "thunder",
      { expiresIn: "7d" }
    );

    const effectiveRole = user.role || (user.employee ? user.employee.role : null);
    
    return res.json({
      message: "Login bem-sucedido",
      token,
      user: {
        _id: user.id,
        id: user.id,
        email: user.email,
        nome: user.nome,
        tipo: user.tipo,
        permissoes: effectiveRole ? effectiveRole.permissoes : (user.permissoes || {}),
        role: effectiveRole,
        ativo: user.ativo,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota de shutdown seguro
router.post("/shutdown", async (req, res) => {
  try {
    // Verificar se há token (segurança básica) - embora o middleware geral já verifique na maioria das rotas
    // Aqui assumimos que quem chama tem acesso ao sistema
    console.log('🛑 Shutdown solicitado. Iniciando desligamento seguro...');
    
    // Tentar desconectar o Prisma (sem await bloquear eternamente)
    prisma.$disconnect().catch(e => console.error('Erro ao desconectar banco:', e));

    res.json({ message: "Sistema desligando com segurança..." });

    // Aguardar terminar resposta e então sair
    setTimeout(() => {
      console.log('👋 Adeus!');
      process.exit(0);
    }, 500);

  } catch (error) {
    console.error("Erro no shutdown:", error);
    res.status(500).json({ error: "Erro ao desligar sistema" });
  }
});

export default router;
