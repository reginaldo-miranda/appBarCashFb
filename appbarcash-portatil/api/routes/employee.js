import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Helper para normalizar salário como número nas respostas
const toNum = (v) => Number(v);
const mapEmployeeResponse = (e) => {
  if (!e) return e;
  // Alias de ID para compatibilidade com o mobile (_id esperado)
  return { ...e, _id: e.id, id: e.id, salario: toNum(e.salario) };
};

// Rota para criar funcionário
router.post("/create", async (req, res) => {
  try {
    const { nome, endereco, bairro, telefone, salario, dataAdmissao, ativo, roleId } = req.body;

    const novoEmployee = await prisma.employee.create({
      data: {
        nome,
        endereco,
        bairro,
        telefone,
        salario,
        dataAdmissao,
        ativo: ativo !== undefined ? ativo : true,
        roleId: (roleId && Number(roleId) > 0) ? Number(roleId) : null,
      },
    });

    res.status(201).json({ message: "Funcionário cadastrado com sucesso", employee: mapEmployeeResponse(novoEmployee) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar funcionário" });
  }
});

// Rota para listar todos os funcionários
router.get("/list", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { dataInclusao: "desc" },
      include: { role: true },
    });
    res.json(employees.map(mapEmployeeResponse));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar funcionários" });
  }
});

// Rota para buscar funcionário por ID
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }
    res.json(mapEmployeeResponse(employee));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar funcionário" });
  }
});

// Rota para atualizar funcionário
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, endereco, bairro, telefone, salario, dataAdmissao, ativo, roleId } = req.body;

    const employee = await prisma.employee.update({
      where: { id },
      data: { 
        nome, endereco, bairro, telefone, salario, dataAdmissao, ativo,
        roleId: (roleId && Number(roleId) > 0) ? Number(roleId) : null 
      },
    });

    res.json({ message: "Funcionário atualizado com sucesso", employee: mapEmployeeResponse(employee) });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }
    res.status(500).json({ error: "Erro ao atualizar funcionário" });
  }
});

// Rota para deletar funcionário
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.employee.delete({ where: { id } });
    res.json({ message: "Funcionário deletado com sucesso" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }
    res.status(500).json({ error: "Erro ao deletar funcionário" });
  }
});

export default router;