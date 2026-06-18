import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Listar todos os perfis
router.get('/', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { nome: 'asc' }
    });
    res.json(roles);
  } catch (error) {
    console.error('Erro ao listar roles:', error);
    res.status(500).json({ error: 'Erro interno ao listar perfis' });
  }
});

// Criar novo perfil
router.post('/', async (req, res) => {
  try {
    const { nome, descricao, permissoes } = req.body;
    
    // Validação básica
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const role = await prisma.role.create({
      data: {
        nome,
        descricao,
        permissoes: permissoes || {},
        ativo: true
      }
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Erro ao criar role:', error);
    // Verificar erro de unique constraint
    if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Já existe um perfil com este nome' });
    }
    res.status(500).json({ error: 'Erro ao criar perfil' });
  }
});

// Atualizar perfil
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, permissoes, ativo } = req.body;

    const role = await prisma.role.update({
      where: { id: parseInt(id) },
      data: {
        nome,
        descricao,
        permissoes,
        ativo
      }
    });

    res.json(role);
  } catch (error) {
    console.error('Erro ao atualizar role:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Remover perfil (validar se tem usuários)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);

    // Verificar usos
    const usersCount = await prisma.user.count({
      where: { roleId }
    });

    if (usersCount > 0) {
      return res.status(400).json({ error: `Não é possível excluir: existem ${usersCount} usuários vinculados a este perfil.` });
    }

    await prisma.role.delete({
      where: { id: roleId }
    });

    res.json({ message: 'Perfil removido com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar role:', error);
    res.status(500).json({ error: 'Erro ao deletar perfil' });
  }
});

export default router;
