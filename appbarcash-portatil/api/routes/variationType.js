import express from "express";
import { getActivePrisma } from "../lib/prisma.js";

const router = express.Router();

// Listar tipos de variação ativos
router.get("/list", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const tipos = await prisma.variationType.findMany({ where: { ativo: true }, orderBy: { dataInclusao: "desc" } });
    res.json(tipos.map((t) => ({
      _id: String(t.id),
      id: t.id,
      nome: t.nome,
      maxOpcoes: t.maxOpcoes,
      categoriasIds: Array.isArray(t.categoriasIds) ? t.categoriasIds : [],
      regraPreco: t.regraPreco,
      precoFixo: t.precoFixo ?? null,
      ativo: !!t.ativo,
      dataInclusao: t.dataInclusao
    })));
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar tipos de variação" });
  }
});

// Criar tipo de variação
router.post("/create", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, maxOpcoes, categoriasIds, regraPreco, precoFixo, ativo } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: "Nome da variação é obrigatório" });
    }
    const max = Number(maxOpcoes ?? 1);
    const cats = Array.isArray(categoriasIds) ? categoriasIds.filter((n) => Number.isInteger(Number(n))).map((n) => Number(n)) : [];
    const regra = ["mais_caro", "media", "fixo"].includes(String(regraPreco || "").toLowerCase()) ? String(regraPreco).toLowerCase() : "mais_caro";
    const pf = precoFixo !== undefined && precoFixo !== null ? String(Number(precoFixo).toFixed(2)) : null;

    const created = await prisma.variationType.create({
      data: {
        nome: String(nome),
        maxOpcoes: Number.isInteger(max) && max > 0 ? max : 1,
        categoriasIds: cats,
        regraPreco: regra,
        precoFixo: pf,
        ativo: ativo !== undefined ? !!ativo : true
      }
    });
    res.status(201).json({ message: "Tipo de variação criado com sucesso", variationType: created });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar tipo de variação" });
  }
});

// Atualizar tipo de variação
router.put("/update/:id", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { nome, maxOpcoes, categoriasIds, regraPreco, precoFixo, ativo } = req.body || {};
    const data = {
      nome: nome !== undefined ? String(nome) : undefined,
      maxOpcoes: maxOpcoes !== undefined ? Number(maxOpcoes) : undefined,
      categoriasIds: Array.isArray(categoriasIds) ? categoriasIds.filter((n) => Number.isInteger(Number(n))).map((n) => Number(n)) : undefined,
      regraPreco: regraPreco !== undefined ? String(regraPreco).toLowerCase() : undefined,
      precoFixo: precoFixo !== undefined ? String(Number(precoFixo).toFixed(2)) : undefined,
      ativo: ativo !== undefined ? !!ativo : undefined
    };
    const updated = await prisma.variationType.update({ where: { id }, data });
    res.json({ message: "Tipo de variação atualizado com sucesso", variationType: updated });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Tipo de variação não encontrado" });
    }
    res.status(500).json({ error: "Erro ao atualizar tipo de variação" });
  }
});

// Deletar (inativar) tipo de variação
router.delete("/delete/:id", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const updated = await prisma.variationType.update({ where: { id }, data: { ativo: false } });
    res.json({ message: "Tipo de variação removido com sucesso", variationType: updated });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Tipo de variação não encontrado" });
    }
    res.status(500).json({ error: "Erro ao remover tipo de variação" });
  }
});

// Listar tipos por categoria aplicável
router.get("/by-category/:categoriaId", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const raw = req.params.categoriaId;
    const catId = Number(raw);
    const isNum = Number.isInteger(catId) && catId > 0;
    const tipos = await prisma.variationType.findMany({ where: { ativo: true } });
    const filtered = tipos.filter((t) => {
      const arr = Array.isArray(t.categoriasIds) ? t.categoriasIds : [];
      if (isNum) return arr.includes(catId);
      return arr.length === 0; // se não fornecer id, retornar tipos gerais
    });
    res.json(filtered.map((t) => ({
      _id: String(t.id),
      id: t.id,
      nome: t.nome,
      maxOpcoes: t.maxOpcoes,
      categoriasIds: Array.isArray(t.categoriasIds) ? t.categoriasIds : [],
      regraPreco: t.regraPreco,
      precoFixo: t.precoFixo ?? null,
      ativo: !!t.ativo,
      dataInclusao: t.dataInclusao
    })));
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar tipos por categoria" });
  }
});

export default router;