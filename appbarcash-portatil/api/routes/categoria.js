import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Listar todas as categorias
router.get('/list', async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nome: 'asc' },
    });
    res.json(categorias);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Buscar categoria por ID
router.get('/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const categoria = await prisma.categoria.findUnique({ where: { id } });
    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.json(categoria);
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({ error: 'Erro ao buscar categoria' });
  }
});

// Criar nova categoria
router.post('/create', async (req, res) => {
  try {
    const { nome, descricao } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const categoria = await prisma.categoria.create({ data: { nome, descricao } });

    res.status(201).json({ message: 'Categoria cadastrada com sucesso', categoria });
  } catch (error) {
    if (error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
    }
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// Atualizar categoria
router.put('/update/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nome, descricao, ativo } = req.body;

    const categoria = await prisma.categoria.update({
      where: { id },
      data: { nome, descricao, ativo },
    });

    res.json({ message: 'Categoria atualizada com sucesso', categoria });
  } catch (error) {
    if (error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
    }
    console.error('Erro ao atualizar categoria:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Excluir categoria (soft delete)
router.delete('/delete/:id', async (req, res) => {
  try {
    const idStr = req.params.id;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Verificar se existem produtos vinculados a esta categoria
    const produtosCount = await prisma.product.count({
      where: {
        categoriaId: id,
      }
    });

    if (produtosCount > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir: Categoria possui produtos vinculados.' 
      });
    }

    await prisma.categoria.update({
      where: { id },
      data: { ativo: false },
    });

    res.json({ message: 'Categoria excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    if (error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
});

export default router;