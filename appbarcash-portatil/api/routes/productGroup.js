import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Rota para criar grupo
router.post("/create", async (req, res) => {
  try {
    const { nome, descricao, icone } = req.body;

    const nomeLower = nome?.toLowerCase();
    if (!nomeLower) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    // Verificar duplicidade
    const existente = await prisma.productGroup.findUnique({ where: { nome: nomeLower } });
    if (existente) {
      return res.status(400).json({ error: "Já existe um grupo com este nome" });
    }

    const novoGrupo = await prisma.productGroup.create({
      data: { nome: nomeLower, descricao, icone: icone || "📦" }
    });

    res.status(201).json({ message: "Grupo criado com sucesso", group: novoGrupo });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Já existe um grupo com este nome" });
    }
    res.status(500).json({ error: "Erro ao criar grupo" });
  }
});

// Rota para listar todos os grupos
router.get("/list", async (req, res) => {
  try {
    const groups = await prisma.productGroup.findMany({
      where: { ativo: true },
      orderBy: { dataInclusao: "desc" }
    });
    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
});

// Rota para buscar grupo por ID
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await prisma.productGroup.findUnique({ where: { id } });
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
});

// Rota para atualizar grupo
router.put("/update/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { nome, descricao, icone, ativo } = req.body;

    const grupoAtualizado = await prisma.productGroup.update({
      where: { id },
      data: { nome: nome?.toLowerCase(), descricao, icone, ativo }
    });

    res.json({ message: "Grupo atualizado com sucesso", group: grupoAtualizado });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Já existe um grupo com este nome" });
    }
    res.status(500).json({ error: "Erro ao atualizar grupo" });
  }
});

// Rota para deletar grupo (soft delete)
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.productGroup.update({
      where: { id },
      data: { ativo: false }
    });

    res.json({ message: "Grupo desativado com sucesso" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(500).json({ error: "Erro ao deletar grupo" });
  }
});

export default router;