import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Listar todos os tipos
router.get('/list', async (req, res) => {
  try {
    const tipos = await prisma.tipo.findMany({
      orderBy: { nome: 'asc' },
    });
    res.json(tipos);
  } catch (error) {
    console.error('Erro ao buscar tipos:', error);
    res.status(500).json({ error: 'Erro ao buscar tipos' });
  }
});

// Criar novo tipo
router.post('/create', async (req, res) => {
  try {
    const { nome, descricao, ativo } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const tipo = await prisma.tipo.create({ data: { nome, descricao, ativo } });

    res.status(201).json({ message: 'Tipo cadastrado com sucesso', tipo });
  } catch (error) {
    console.error('Erro ao cadastrar tipo:', error);
    if (error && error.code === 'P2002') {
      res.status(400).json({ error: 'Tipo já existe' });
    } else {
      res.status(500).json({ error: 'Erro ao cadastrar tipo' });
    }
  }
});

// Atualizar tipo
router.put('/update/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nome, descricao, ativo } = req.body;

    const tipo = await prisma.tipo.update({
      where: { id },
      data: { nome, descricao, ativo },
    });

    res.json({ message: 'Tipo atualizado com sucesso', tipo });
  } catch (error) {
    console.error('Erro ao atualizar tipo:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Tipo não encontrado' });
    }
    res.status(500).json({ error: 'Erro ao atualizar tipo' });
  }
});

// Deletar tipo (soft delete)
router.delete('/delete/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    await prisma.tipo.update({
      where: { id },
      data: { ativo: false },
    });

    res.json({ message: 'Tipo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover tipo:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Tipo não encontrado' });
    }
    res.status(500).json({ error: 'Erro ao remover tipo' });
  }
});

export default router;