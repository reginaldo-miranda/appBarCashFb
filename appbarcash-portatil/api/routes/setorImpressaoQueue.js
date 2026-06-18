import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';
import { recordSaleUpdate } from '../lib/events.js';

const router = express.Router();
const prisma = getActivePrisma();

/**
 * GET /api/setor-impressao/:id/queue
 * Retorna lista de itens pendentes para um setor específico
 */
router.get('/:id/queue', async (req, res) => {
  try {
    const setorId = parseInt(req.params.id);
    const { status = 'pendente', from, to, employees, strict } = req.query;
    // Obter setor padrão (fallback) quando produto não estiver vinculado
    let defaultSetorId = null;
    try {
      const rowsDefault = await prisma.$queryRawUnsafe("SELECT `value` FROM `AppSetting` WHERE `key` = 'defaultSetorImpressaoId' LIMIT 1");
      const val = Array.isArray(rowsDefault) && rowsDefault.length > 0 ? rowsDefault[0]?.value : null;
      const sid = val ? Number(val) : null;
      defaultSetorId = Number.isInteger(sid) && sid > 0 ? sid : null;
    } catch {}

    // Usar consulta SQL raw para buscar itens por setor (inclui fallback quando sem vínculo)
    // Filtros opcionais (apenas para entregues): intervalo de data e funcionários
    const extraFilters = [];
    if (String(status) === 'entregue') {
      if (from) {
        const f = String(from).slice(0, 10);
        extraFilters.push(`AND si.preparedAt >= '${f} 00:00:00'`);
      }
      if (to) {
        const t = String(to).slice(0, 10);
        extraFilters.push(`AND si.preparedAt <= '${t} 23:59:59'`);
      }
      if (employees) {
        const ids = String(employees)
          .split(',')
          .map((v) => parseInt(v))
          .filter((n) => Number.isInteger(n) && n > 0);
        if (ids.length > 0) {
          extraFilters.push(`AND (si.preparedById IN (${ids.join(',')}) OR sa.funcionarioId IN (${ids.join(',')}))`);
        }
      }
    }

    const isStrict = String(strict).toLowerCase() === '1' || String(strict).toLowerCase() === 'true';

    const sql = `
      SELECT 
        si.id,
        si.saleId,
        si.nomeProduto,
        si.quantidade,
        si.status,
        si.createdAt,
        si.preparedAt,
        si.variacaoOpcoes,
        si.preparedById,
        sa.funcionarioId as funcionarioId,
        s.numero as mesaNumero,
        s.nome as mesaNome,
        s.nomeResponsavel as mesaResponsavelNome,
        sa.nomeComanda as comandaNome,
        sa.tipoVenda as tipoVenda,
        fr.nome as responsavelNome,
        f.nome as funcionarioNome,
        c.nome as clienteNome,
        pb.nome as preparedByNome
      FROM SaleItem si
      LEFT JOIN ProductSetorImpressao psi ON psi.productId = si.productId
      INNER JOIN Sale sa ON sa.id = si.saleId
      LEFT JOIN Mesa s ON s.id = sa.mesaId
      LEFT JOIN Employee fr ON fr.id = s.funcionarioResponsavelId
      LEFT JOIN Employee f ON f.id = sa.funcionarioId
      LEFT JOIN Customer c ON c.id = sa.clienteId
      LEFT JOIN Employee pb ON pb.id = si.preparedById
      WHERE (si.status = ? OR (si.status = 'pago' AND ? = 'pendente'))
        AND (sa.status = 'aberta' OR (sa.status = 'finalizada' AND sa.tipoVenda IN ('balcao', 'delivery')))
        AND ${isStrict ? `(
          psi.setorId = ?
          OR (
            psi.setorId IS NULL
            AND sa.tipoVenda IN ('balcao', 'delivery')
            AND sa.status IN ('aberta', 'finalizada')
          )
        )` : `(
          psi.setorId = ?
          OR (
            psi.setorId IS NULL
            AND ? IS NOT NULL
            AND ? = ?
          )
        )`}
      ${extraFilters.join(' ')}
      ORDER BY si.createdAt ASC
    `;

    const items = isStrict
      ? await prisma.$queryRawUnsafe(sql, status, status, setorId)
      : await prisma.$queryRawUnsafe(sql, status, status, setorId, defaultSetorId, defaultSetorId, setorId);

    // Formatar os dados para exibição
    const formattedItems = items.map(item => {
      const tipoVendaClean = String(item.tipoVenda || '').toLowerCase();
      const mesaLabel = (tipoVendaClean === 'mesa')
        ? (item.mesaNumero ? `Mesa ${item.mesaNumero}` : (item.mesaNome || 'Mesa'))
        : (tipoVendaClean === 'balcao')
          ? 'Balcão'
          : (tipoVendaClean === 'delivery')
            ? 'Delivery'
            : (item.comandaNome ? `Comanda ${item.comandaNome}` : 'Comanda');
      const respMesa = item.mesaResponsavelNome || null;
      const respComanda = item.comandaNome || null;
      const responsavel = respMesa || respComanda || item.clienteNome || null;
      return {
        id: item.id,
        saleId: item.saleId,
        mesa: mesaLabel,
        responsavel: responsavel || 'Não informado',
        quantidade: item.quantidade,
        produto: item.nomeProduto,
        funcionario: item.funcionarioNome || 'Não informado',
        funcionarioId: item.funcionarioId || null,
        horario: item.createdAt,
        status: item.status,
        preparedAt: item.preparedAt,
        preparedBy: item.preparedByNome,
        preparedById: item.preparedById,
        variacaoOpcoes: item.variacaoOpcoes ? (typeof item.variacaoOpcoes === 'string' ? JSON.parse(item.variacaoOpcoes) : item.variacaoOpcoes) : []
      };
    });

    res.json({
      success: true,
      data: formattedItems,
      count: formattedItems.length
    });

  } catch (error) {
    console.error('Erro ao buscar fila do setor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar fila do setor',
      error: error.message
    });
  }
});

/**
 * PATCH /api/sale/:saleId/item/:itemId/status
 * Atualiza o status de um item (marcar como pronto/pendente)
 */
router.patch('/sale/:saleId/item/:itemId/status', async (req, res) => {
  try {
    const { saleId, itemId } = req.params;
    const { status, preparedById } = req.body;

    if (!['pendente', 'pronto', 'entregue'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido. Use: pendente, pronto ou entregue'
      });
    }

    // Buscar o item existente
    const existingItem = await prisma.saleItem.findFirst({
      where: {
        id: parseInt(itemId),
        saleId: parseInt(saleId)
      },
      include: {
        sale: true,
        product: true
      }
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }

    const saleStatus = existingItem.sale?.status;
    const tipoVenda = String(existingItem.sale?.tipoVenda || '').toLowerCase();
    const isFinalizadaPermitida = saleStatus === 'finalizada' && ['balcao', 'delivery'].includes(tipoVenda);

    if (saleStatus && saleStatus !== 'aberta' && !isFinalizadaPermitida) {
      return res.status(400).json({
        success: false,
        message: 'Venda não está aberta para atualização de status'
      });
    }

    // Atualizar o status do item
    let updatedItem = null;
    if (status === 'entregue') {
      const fallbackPrepared = Number(preparedById) || existingItem.preparedById || existingItem.sale?.funcionarioId || null;
      const setPrepared = fallbackPrepared ? `, preparedById = IFNULL(preparedById, ${fallbackPrepared})` : '';
      const affected = await prisma.$executeRawUnsafe(`UPDATE \`SaleItem\` SET status = 'entregue'${setPrepared} WHERE id = ${parseInt(itemId)} AND saleId = ${parseInt(saleId)} LIMIT 1`);
      if (!affected) {
        return res.status(404).json({ success: false, message: 'Item não encontrado para entregar' });
      }
      updatedItem = await prisma.saleItem.findUnique({
        where: { id: parseInt(itemId) },
        include: {
          sale: { include: { mesa: { select: { numero: true, nome: true } } } },
          product: true,
          preparedBy: { select: { nome: true } }
        }
      });
    } else {
      if (status === 'pronto') {
        const fallbackPrepared = Number(preparedById) || existingItem.preparedById || existingItem.sale?.funcionarioId || null;
        const setPrepared = fallbackPrepared ? `, preparedById = IFNULL(preparedById, ${fallbackPrepared})` : '';
        const affected = await prisma.$executeRawUnsafe(`UPDATE \`SaleItem\` SET status = 'pronto', preparedAt = IFNULL(preparedAt, NOW())${setPrepared} WHERE id = ${parseInt(itemId)} AND saleId = ${parseInt(saleId)} LIMIT 1`);
        if (!affected) {
          return res.status(404).json({ success: false, message: 'Item não encontrado para marcar como pronto' });
        }
      } else if (status === 'pendente') {
        const affected = await prisma.$executeRawUnsafe(`UPDATE \`SaleItem\` SET status = 'pendente' WHERE id = ${parseInt(itemId)} AND saleId = ${parseInt(saleId)} LIMIT 1`);
        if (!affected) {
          return res.status(404).json({ success: false, message: 'Item não encontrado para marcar como pendente' });
        }
      }
      updatedItem = await prisma.saleItem.findUnique({
        where: { id: parseInt(itemId) },
        include: {
          sale: { include: { mesa: { select: { numero: true, nome: true } } } },
          product: true,
          preparedBy: { select: { nome: true } }
        }
      });
    }

    // Registrar atualização para sincronização em tempo real
    await recordSaleUpdate(updatedItem.saleId, 'item_updated', {
      itemId: updatedItem.id,
      status: updatedItem.status,
      preparedAt: updatedItem.preparedAt,
      preparedBy: updatedItem.preparedBy?.nome
    });

    res.json({ success: true, message: status === 'pronto' ? 'Item marcado como pronto' : status === 'entregue' ? 'Item marcado como entregue' : 'Item marcado como pendente', data: updatedItem });

  } catch (error) {
    const code = error?.code;
    console.error('Erro ao atualizar status do item:', code || '', error?.message || error);
    if (code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Item não encontrado para atualizar', error: String(error?.message || error) });
    }
    if (code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Violação de chave estrangeira ao atualizar item', error: String(error?.message || error) });
    }
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar status do item',
      error: String(error?.message || error)
    });
  }
});

/**
 * GET /api/setor-impressao/list
 * Lista todos os setores de impressão ativos
 */
router.get('/list', async (req, res) => {
  try {
    const setores = await prisma.setorImpressao.findMany({
      where: {
        ativo: true
      },
      orderBy: {
        nome: 'asc'
      }
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

export default router;