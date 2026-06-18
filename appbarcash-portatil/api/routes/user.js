import express from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Helper para ocultar senha e manter compatibilidade de id
function mapUserResponse(u) {
  if (!u) return null;
  const { senha, ...rest } = u;
  return { ...rest, _id: u.id, id: u.id };
}

// Rota padrão GET - lista usuários (mantém compatibilidade)
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      orderBy: { dataInclusao: "desc" },
      include: { role: true, employee: true } 
    });
    res.json(users.map(mapUserResponse));
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

// Rota para listar todos os usuários
router.get("/list", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      orderBy: { dataInclusao: "desc" },
      include: { role: true, employee: true } 
    });
    res.json(users.map(mapUserResponse));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// Rota para buscar usuário por ID
router.get("/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const user = await prisma.user.findUnique({ where: { id: idNum } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    res.json(mapUserResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

// Rota para criar usuário
router.post("/create", async (req, res) => {
  try {
    const { email, senha, nome, tipo, funcionario, permissoes, roleId } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    let employeeId = undefined;
    if (tipo === "funcionario" && funcionario && funcionario !== "admin-fixo") {
      const funcId = Number(funcionario);
      if (!Number.isInteger(funcId) || funcId <= 0) {
        return res.status(400).json({ error: "Funcionário inválido" });
      }
      const funcionarioExiste = await prisma.employee.findUnique({ where: { id: funcId } });
      if (!funcionarioExiste) {
        return res.status(400).json({ error: "Funcionário não encontrado" });
      }
      employeeId = funcId;
    }

    const hashedSenha = await bcrypt.hash(senha, 10);

    const novo = await prisma.user.create({
      data: {
        email,
        senha: hashedSenha,
        nome: nome || email.split("@")[0],
        tipo: tipo === "admin" ? "admin" : "funcionario",
        employeeId,
        employeeId,
        permissoes: permissoes || {},
        roleId: roleId ? Number(roleId) : null,
        ativo: true,
      },
    });

    res.status(201).json({ message: "Usuário cadastrado com sucesso", user: mapUserResponse(novo) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar usuário" });
  }
});

// Rota para atualizar permissões do usuário
router.put("/:id/permissions", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { permissoes } = req.body;

    const user = await prisma.user.update({
      where: { id: idNum },
      data: { permissoes },
    });

    res.json({ message: "Permissões atualizadas com sucesso", user: mapUserResponse(user) });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar permissões" });
  }
});

// Rota para ativar/desativar usuário
router.put("/:id/status", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { ativo } = req.body;

    const user = await prisma.user.update({
      where: { id: idNum },
      data: { ativo: Boolean(ativo) },
    });

    res.json({ message: `Usuário ${user.ativo ? "ativado" : "desativado"} com sucesso`, user: mapUserResponse(user) });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar status do usuário" });
  }
});

// Rota para atualizar dados do usuário
router.put("/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { nome, email, tipo, funcionario, permissoes, senha, roleId } = req.body;

    let employeeId = undefined;
    if (tipo === "funcionario" && funcionario && funcionario !== "admin-fixo") {
      const funcId = Number(funcionario);
      if (!Number.isInteger(funcId) || funcId <= 0) {
        return res.status(400).json({ error: "Funcionário inválido" });
      }
      const funcionarioExiste = await prisma.employee.findUnique({ where: { id: funcId } });
      if (!funcionarioExiste) {
        return res.status(400).json({ error: "Funcionário não encontrado" });
      }
      employeeId = funcId;
    }

    const data = {
      nome,
      email,
      tipo: tipo === "admin" ? "admin" : "funcionario",
      employeeId,
      permissoes,
      roleId: roleId ? Number(roleId) : null,
    };

    if (senha && typeof senha === "string" && senha.trim().length > 0) {
      data.senha = await bcrypt.hash(senha, 10);
    }

    const user = await prisma.user.update({
      where: { id: idNum },
      data,
    });

    res.json({ message: "Usuário atualizado com sucesso", user: mapUserResponse(user) });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

// Rota para deletar usuário (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const user = await prisma.user.update({
      where: { id: idNum },
      data: { ativo: false },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    res.json({ message: "Usuário deletado com sucesso" });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});

export default router;