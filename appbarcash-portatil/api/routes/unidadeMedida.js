import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Listar todas as unidades de medida
router.get('/list', async (req, res) => {
  try {
    const unidades = await prisma.unidadeMedida.findMany({
      orderBy: { nome: 'asc' },
    });
    res.json(unidades);
  } catch (error) {
    console.error('Erro ao buscar unidades de medida:', error);
    res.status(500).json({ error: 'Erro ao buscar unidades de medida' });
  }
});

// Criar nova unidade de medida
router.post('/create', async (req, res) => {
  try {
    const { nome, sigla, descricao, ativo } = req.body;

    if (!nome || !sigla) {
      return res.status(400).json({ error: 'Nome e sigla são obrigatórios' });
    }

    const unidade = await prisma.unidadeMedida.create({ data: { nome, sigla, descricao, ativo } });

    res.status(201).json({ message: 'Unidade de medida cadastrada com sucesso', unidade });
  } catch (error) {
    console.error('Erro ao cadastrar unidade de medida:', error);
    if (error && error.code === 'P2002') {
      res.status(400).json({ error: 'Unidade de medida já existe' });
    } else {
      res.status(500).json({ error: 'Erro ao cadastrar unidade de medida' });
    }
  }
});

// Atualizar unidade de medida
router.put('/update/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nome, sigla, descricao, ativo } = req.body;

    const unidade = await prisma.unidadeMedida.update({
      where: { id },
      data: { nome, sigla, descricao, ativo },
    });

    res.json({ message: 'Unidade de medida atualizada com sucesso', unidade });
  } catch (error) {
    console.error('Erro ao atualizar unidade de medida:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Unidade de medida não encontrada' });
    }
    if (error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Unidade de medida já existe' });
    }
    res.status(500).json({ error: 'Erro ao atualizar unidade de medida' });
  }
});

// Deletar unidade de medida (soft delete)
router.delete('/delete/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    await prisma.unidadeMedida.update({
      where: { id },
      data: { ativo: false },
    });

    res.json({ message: 'Unidade de medida removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover unidade de medida:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Unidade de medida não encontrada' });
    }
    res.status(500).json({ error: 'Erro ao remover unidade de medida' });
  }
});

export default router;