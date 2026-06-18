import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';

const router = express.Router();

// Listar todos os setores
router.get('/', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const setores = await prisma.setorImpressao.findMany({
      orderBy: { nome: 'asc' }
    });
    
    res.json({
      success: true,
      data: setores,
      count: setores.length
    });
  } catch (error) {
    console.error('Erro ao buscar setores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar setores',
      error: error.message
    });
  }
});

// Buscar setor por ID
router.get('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { id } = req.params;
    
    const setor = await prisma.setorImpressao.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!setor) {
      return res.status(404).json({
        success: false,
        message: 'Setor não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: setor
    });
  } catch (error) {
    console.error('Erro ao buscar setor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar setor',
      error: error.message
    });
  }
});

// Criar novo setor
router.post('/', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, descricao, modoEnvio, whatsappDestino, ativo } = req.body;
    
    // Validações
    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Nome do setor é obrigatório e deve ter pelo menos 3 caracteres'
      });
    }
    
    if (!modoEnvio || !['impressao', 'whatsapp', 'ambos'].includes(modoEnvio)) {
      return res.status(400).json({
        success: false,
        message: 'Modo de envio inválido. Use: impressao, whatsapp ou ambos'
      });
    }
    
    if (modoEnvio === 'whatsapp' || modoEnvio === 'ambos') {
      if (!whatsappDestino || !whatsappDestino.match(/^\d{10,15}$/)) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp destino inválido. Use apenas números (10-15 dígitos)'
        });
      }
    }
    
    // Verificar se já existe setor com mesmo nome
    const existente = await prisma.setorImpressao.findFirst({
      where: { nome: nome.trim() }
    });
    
    if (existente) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um setor com este nome'
      });
    }
    
    const setor = await prisma.setorImpressao.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        modoEnvio,
        whatsappDestino: whatsappDestino?.trim() || null,
        ativo: ativo !== undefined ? ativo : true,
        dataInclusao: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'Setor criado com sucesso',
      data: setor
    });
  } catch (error) {
    console.error('Erro ao criar setor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar setor',
      error: error.message
    });
  }
});

// Atualizar setor
router.put('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { id } = req.params;
    const { nome, descricao, modoEnvio, whatsappDestino, ativo } = req.body;
    
    // Validações
    if (nome && nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Nome do setor deve ter pelo menos 3 caracteres'
      });
    }
    
    if (modoEnvio && !['impressao', 'whatsapp', 'ambos'].includes(modoEnvio)) {
      return res.status(400).json({
        success: false,
        message: 'Modo de envio inválido. Use: impressao, whatsapp ou ambos'
      });
    }
    
    if ((modoEnvio === 'whatsapp' || modoEnvio === 'ambos') && whatsappDestino) {
      if (!whatsappDestino.match(/^\d{10,15}$/)) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp destino inválido. Use apenas números (10-15 dígitos)'
        });
      }
    }
    
    // Verificar se já existe outro setor com mesmo nome
    if (nome) {
      const existente = await prisma.setorImpressao.findFirst({
        where: {
          nome: nome.trim(),
          NOT: { id: parseInt(id) }
        }
      });
      
      if (existente) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um setor com este nome'
        });
      }
    }
    
    const setor = await prisma.setorImpressao.update({
      where: { id: parseInt(id) },
      data: {
        ...(nome && { nome: nome.trim() }),
        ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
        ...(modoEnvio && { modoEnvio }),
        ...(whatsappDestino !== undefined && { whatsappDestino: whatsappDestino?.trim() || null }),
        ...(ativo !== undefined && { ativo })
      }
    });
    
    res.json({
      success: true,
      message: 'Setor atualizado com sucesso',
      data: setor
    });
  } catch (error) {
    console.error('Erro ao atualizar setor:', error);
    res.status(500).json({
      success: false,
        message: 'Erro ao atualizar setor',
      error: error.message
    });
  }
});

// Deletar setor
router.delete('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { id } = req.params;
    
    // Verificar se existem produtos usando este setor
    const produtosCount = await prisma.productSetorImpressao.count({
      where: { setorImpressaoId: parseInt(id) }
    });
    
    if (produtosCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir este setor pois existem produtos associados a ele'
      });
    }
    
    await prisma.setorImpressao.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({
      success: true,
      message: 'Setor excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir setor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir setor',
      error: error.message
    });
  }
});

export default router;