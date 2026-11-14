import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Utilitário: normalizar forma de pagamento
function normalizeFormaPagamento(fp) {
  if (!fp) return null;
  const val = String(fp).toLowerCase();
  if (val === 'cartão') return 'cartao';
  if (['dinheiro', 'cartao', 'pix', 'cashback'].includes(val)) return val;
  return null;
}

// Acrescentar campos derivados em vendas de um caixa
function augmentCaixaVendas(caixa) {
  const c = { ...caixa };
  c.vendas = (c.vendas || []).map(reg => {
    const v = reg.venda || {};
    const atendenteNome = v.funcionarioNome || v.funcionarioAberturaNome || (v.funcionario && v.funcionario.nome) || 'Administrador';
    const responsavelNome = v.responsavelNome || (v.mesa && v.mesa.nomeResponsavel) || v.nomeComanda || '';
    return { ...reg, atendenteNome, responsavelNome };
  });
  return c;
}
// ===== Helpers de normalização numérica =====
const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  if (v && typeof v === 'object' && typeof v.toString === 'function') return parseFloat(v.toString()) || 0;
  return Number(v) || 0;
};
const normalizeVendaRegistro = (reg) => (reg ? { ...reg, valor: toNum(reg.valor) } : reg);
const mapCaixaResponse = (c) => {
  if (!c) return c;
  const vendas = Array.isArray(c.vendas) ? c.vendas.map(normalizeVendaRegistro) : c.vendas;
  const valorAbertura = toNum(c.valorAbertura);
  const valorFechamento = c.valorFechamento !== null && c.valorFechamento !== undefined ? toNum(c.valorFechamento) : null;
  const totalVendas = toNum(c.totalVendas);
  const totalDinheiro = toNum(c.totalDinheiro);
  const totalCartao = toNum(c.totalCartao);
  const totalPix = toNum(c.totalPix);
  const movimentacoes = Array.isArray(c.movimentacoes)
    ? c.movimentacoes.map((m) => ({
        ...m,
        id: Number(m.id),
        caixaId: Number(m.caixaId),
        valor: toNum(m.valor),
      }))
    : [];
  const totalSuprimentos = movimentacoes
    .filter((m) => m.tipo === 'suprimento')
    .reduce((acc, m) => acc + toNum(m.valor), 0);
  const totalSangrias = movimentacoes
    .filter((m) => m.tipo === 'sangria')
    .reduce((acc, m) => acc + toNum(m.valor), 0);
  const saldoGaveta = Number((valorAbertura + totalDinheiro + totalSuprimentos - totalSangrias).toFixed(2));

  return {
    ...c,
    valorAbertura,
    valorFechamento,
    totalVendas,
    totalDinheiro,
    totalCartao,
    totalPix,
    movimentacoes,
    totalSuprimentos: Number(totalSuprimentos.toFixed(2)),
    totalSangrias: Number(totalSangrias.toFixed(2)),
    saldoGaveta,
    vendas,
  };
};

let movTableEnsured = false;
async function ensureCaixaMovimentacaoTable() {
  if (movTableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`caixamovimentacao\` (
        \`id\`              INT NOT NULL AUTO_INCREMENT,
        \`caixaId\`         INT NOT NULL,
        \`tipo\`            VARCHAR(32) NOT NULL DEFAULT 'sangria',
        \`valor\`           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`motivo\`          VARCHAR(255) DEFAULT NULL,
        \`funcionarioNome\` VARCHAR(191) DEFAULT NULL,
        \`createdAt\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`CaixaMovimentacao_caixaId_idx\` (\`caixaId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    movTableEnsured = true;
  } catch (err) {
    console.error('Erro ao garantir tabela caixamovimentacao:', err?.message);
  }
}

async function getMovimentacoesByCaixaIds(caixaIds) {
  await ensureCaixaMovimentacaoTable();
  const validIds = (caixaIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) return {};
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, caixaId, tipo, valor, motivo, funcionarioNome, createdAt FROM caixamovimentacao WHERE caixaId IN (${validIds.join(',')}) ORDER BY createdAt DESC, id DESC`
    );
    const map = {};
    for (const r of rows || []) {
      const cid = Number(r.caixaId);
      if (!map[cid]) map[cid] = [];
      map[cid].push({
        id: Number(r.id),
        caixaId: cid,
        tipo: String(r.tipo || 'sangria').toLowerCase(),
        valor: toNum(r.valor),
        motivo: r.motivo || '',
        funcionarioNome: r.funcionarioNome || 'Administrador',
        createdAt: r.createdAt,
      });
    }
    return map;
  } catch (err) {
    console.error('Erro ao buscar movimentações do caixa:', err?.message);
    return {};
  }
}

async function resolveEmployee(funcionarioId) {
  const parsed = parseInt(funcionarioId, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    const found = await prisma.employee.findUnique({ where: { id: parsed } });
    if (found) return found;
  }
  let fallback = await prisma.employee.findFirst({ where: { ativo: true } });
  if (!fallback) {
    fallback = await prisma.employee.findFirst();
  }
  if (!fallback) {
    fallback = await prisma.employee.create({
      data: {
        nome: 'Administrador',
        email: 'admin@bar.com',
        telefone: '(00) 00000-0000',
        cargo: 'Gerente',
        salario: 0,
        dataAdmissao: new Date(),
        ativo: true,
      },
    });
  }
  return fallback;
}

// Listar todos os caixas
router.get('/', async (req, res) => {
  try {
    const caixas = await prisma.caixa.findMany({
      include: {
        funcionarioAbertura: { select: { nome: true } },
        funcionarioFechamento: { select: { nome: true } },
        vendas: {
          include: {
            venda: {
              include: {
                funcionario: { select: { nome: true } },
                mesa: {
                  include: { funcionarioResponsavel: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { dataAbertura: 'desc' },
    });

    const movMap = await getMovimentacoesByCaixaIds(caixas.map((c) => c.id));
    const caixasObj = caixas.map((caixa) => {
      const augmented = augmentCaixaVendas(caixa);
      augmented.movimentacoes = movMap[caixa.id] || [];
      return augmented;
    });
    res.json(caixasObj.map(mapCaixaResponse));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Buscar caixa aberto
router.get('/status/aberto', async (req, res) => {
  try {
    const caixaAberto = await prisma.caixa.findFirst({
      where: { status: 'aberto' },
      include: {
        funcionarioAbertura: { select: { nome: true } },
        vendas: {
          include: {
            venda: {
              include: {
                funcionario: { select: { nome: true } },
                mesa: {
                  include: { funcionarioResponsavel: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!caixaAberto) {
      return res.status(404).json({ message: 'Nenhum caixa aberto encontrado' });
    }

    const movMap = await getMovimentacoesByCaixaIds([caixaAberto.id]);
    const c = augmentCaixaVendas(caixaAberto);
    c.movimentacoes = movMap[caixaAberto.id] || [];
    res.json(mapCaixaResponse(c));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Buscar caixa por ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const caixa = await prisma.caixa.findUnique({
      where: { id },
      include: {
        funcionarioAbertura: { select: { nome: true } },
        funcionarioFechamento: { select: { nome: true } },
        vendas: {
          include: {
            venda: {
              include: {
                funcionario: { select: { nome: true } },
                mesa: {
                  include: { funcionarioResponsavel: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!caixa) {
      return res.status(404).json({ message: 'Caixa não encontrado' });
    }

    const movMap = await getMovimentacoesByCaixaIds([caixa.id]);
    const c = augmentCaixaVendas(caixa);
    c.movimentacoes = movMap[caixa.id] || [];
    res.json(mapCaixaResponse(c));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Abrir caixa
router.post('/abrir', async (req, res) => {
  try {
    const { funcionarioId, valorAbertura = 0, observacoes = '' } = req.body;

    // Verificar se já existe caixa aberto
    const caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    if (caixaAberto) {
      return res.status(400).json({ message: 'Já existe um caixa aberto' });
    }

    const funcionario = await resolveEmployee(funcionarioId);

    const novoCaixa = await prisma.caixa.create({
      data: {
        funcionarioAberturaId: funcionario.id,
        valorAbertura: Number(valorAbertura) || 0,
        observacoes: observacoes || null,
      },
      include: { funcionarioAbertura: { select: { nome: true } } },
    });

    novoCaixa.movimentacoes = [];
    novoCaixa.vendas = [];
    res.status(201).json(mapCaixaResponse(novoCaixa));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fechar caixa
router.put('/:id/fechar', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { funcionarioId, valorFechamento, observacoes = '' } = req.body;

    const caixa = await prisma.caixa.findUnique({ where: { id } });
    if (!caixa) {
      return res.status(404).json({ message: 'Caixa não encontrado' });
    }

    if (caixa.status === 'fechado') {
      return res.status(400).json({ message: 'Caixa já está fechado' });
    }

    const funcionario = await resolveEmployee(funcionarioId);

    const updatedObservacoes = observacoes
      ? (caixa.observacoes ? caixa.observacoes + '\n' + observacoes : observacoes)
      : caixa.observacoes;

    const caixaPopulado = await prisma.caixa.update({
      where: { id },
      data: {
        dataFechamento: new Date(),
        funcionarioFechamentoId: funcionario.id,
        valorFechamento: Number(valorFechamento) || 0,
        status: 'fechado',
        observacoes: updatedObservacoes,
      },
      include: {
        funcionarioAbertura: { select: { nome: true } },
        funcionarioFechamento: { select: { nome: true } },
        vendas: {
          include: {
            venda: {
              include: {
                funcionario: { select: { nome: true } },
                mesa: {
                  include: { funcionarioResponsavel: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    });

    const movMap = await getMovimentacoesByCaixaIds([id]);
    const c = augmentCaixaVendas(caixaPopulado);
    c.movimentacoes = movMap[id] || [];
    res.json(mapCaixaResponse(c));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Adicionar Sangria ou Suprimento no caixa aberto
router.post('/movimentacao', async (req, res) => {
  try {
    await ensureCaixaMovimentacaoTable();
    const { caixaId, tipo, valor, motivo = '', funcionarioNome = 'Administrador' } = req.body;

    const tipoNorm = String(tipo || '').toLowerCase().trim();
    if (!['sangria', 'suprimento'].includes(tipoNorm)) {
      return res.status(400).json({ message: 'Tipo inválido. Use sangria ou suprimento.' });
    }

    const valorNum = toNum(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return res.status(400).json({ message: 'Informe um valor maior que zero.' });
    }

    let targetCaixa = null;
    if (caixaId) {
      targetCaixa = await prisma.caixa.findUnique({ where: { id: Number(caixaId) } });
    }
    if (!targetCaixa) {
      targetCaixa = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    }
    if (!targetCaixa) {
      const funcionario = await resolveEmployee(null);
      targetCaixa = await prisma.caixa.create({
        data: {
          funcionarioAberturaId: funcionario.id,
          valorAbertura: 0,
          observacoes: 'Caixa aberto automaticamente ao lançar movimentação',
        },
      });
    }

    if (targetCaixa.status === 'fechado') {
      return res.status(400).json({ message: 'Não é possível lançar movimentação em um caixa fechado.' });
    }

    await prisma.$executeRawUnsafe(
      'INSERT INTO caixamovimentacao (caixaId, tipo, valor, motivo, funcionarioNome, createdAt) VALUES (?, ?, ?, ?, ?, NOW(3))',
      targetCaixa.id,
      tipoNorm,
      valorNum,
      String(motivo || '').trim() || (tipoNorm === 'sangria' ? 'Sangria de caixa' : 'Suprimento de troco'),
      String(funcionarioNome || 'Administrador').trim()
    );

    const caixaAtualizado = await prisma.caixa.findUnique({
      where: { id: targetCaixa.id },
      include: {
        funcionarioAbertura: { select: { nome: true } },
        vendas: {
          include: {
            venda: {
              include: {
                funcionario: { select: { nome: true } },
                mesa: {
                  include: { funcionarioResponsavel: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    });

    const movMap = await getMovimentacoesByCaixaIds([targetCaixa.id]);
    const c = augmentCaixaVendas(caixaAtualizado);
    c.movimentacoes = movMap[targetCaixa.id] || [];

    res.status(201).json({
      message: `${tipoNorm === 'sangria' ? 'Sangria' : 'Suprimento'} registrado com sucesso`,
      caixa: mapCaixaResponse(c),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remover movimentação (Sangria / Suprimento)
router.delete('/movimentacao/:movId', async (req, res) => {
  try {
    await ensureCaixaMovimentacaoTable();
    const movId = parseInt(req.params.movId, 10);
    if (Number.isNaN(movId) || movId <= 0) {
      return res.status(400).json({ message: 'ID da movimentação inválido' });
    }

    await prisma.$executeRawUnsafe('DELETE FROM caixamovimentacao WHERE id = ?', movId);
    res.json({ message: 'Movimentação excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Registrar venda no caixa
router.post('/registrar-venda', async (req, res) => {
  try {
    const { vendaId, valor, valorRecebido, formaPagamento } = req.body;
    const vendaIdInt = parseInt(vendaId, 10);
    if (Number.isNaN(vendaIdInt)) {
      return res.status(400).json({ message: 'vendaId inválido' });
    }

    const fpNorm = normalizeFormaPagamento(formaPagamento);
    if (!fpNorm) {
      return res.status(400).json({ message: 'formaPagamento inválida. Use dinheiro, cartao/cartão ou pix' });
    }

    // Obter valor da venda: usa `valor`, ou `valorRecebido`, ou o total da venda
    let valorBase = valor ?? valorRecebido;
    let vendaInfo = null;
    if (valorBase === undefined || valorBase === null) {
      vendaInfo = await prisma.sale.findUnique({ where: { id: vendaIdInt } });
      if (!vendaInfo) {
        return res.status(404).json({ message: 'Venda não encontrada' });
      }
      valorBase = vendaInfo.total; // Prisma Decimal
    }
    let valorNum;
    if (valorBase && typeof valorBase === 'object' && typeof valorBase.toString === 'function') {
      valorNum = parseFloat(valorBase.toString());
    } else {
      valorNum = Number(valorBase);
    }
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      return res.status(400).json({ message: 'valor inválido' });
    }

    // Buscar caixa aberto (ou criar automaticamente)
    let caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    if (!caixaAberto) {
      const funcionario = await resolveEmployee(null);
      caixaAberto = await prisma.caixa.create({
        data: {
          funcionarioAberturaId: funcionario.id,
          valorAbertura: 0,
          observacoes: 'Caixa aberto automaticamente pelo sistema',
        },
      });
    }

    // Registrar venda no caixa e atualizar totais
    const dataUpdate = {
      vendas: {
        create: {
          vendaId: vendaIdInt,
          valor: valorNum,
          formaPagamento: fpNorm,
          dataVenda: vendaInfo?.dataVenda ?? new Date(),
        },
      },
      totalVendas: { increment: valorNum },
    };

    if (fpNorm === 'dinheiro') {
      dataUpdate.totalDinheiro = { increment: valorNum };
    } else if (fpNorm === 'cartao') {
      dataUpdate.totalCartao = { increment: valorNum };
    } else if (fpNorm === 'pix') {
      dataUpdate.totalPix = { increment: valorNum };
    }

    const caixaAtualizado = await prisma.caixa.update({
      where: { id: caixaAberto.id },
      data: dataUpdate,
    });

    const movMap = await getMovimentacoesByCaixaIds([caixaAberto.id]);
    caixaAtualizado.movimentacoes = movMap[caixaAberto.id] || [];

    res.json({
      message: 'Venda registrada no caixa com sucesso',
      caixa: mapCaixaResponse(caixaAtualizado),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;