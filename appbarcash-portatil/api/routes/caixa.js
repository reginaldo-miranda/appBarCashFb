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
  if (v && typeof v === 'object' && typeof v.toString === 'function') return parseFloat(v.toString());
  return Number(v);
};
const normalizeVendaRegistro = (reg) => (reg ? { ...reg, valor: toNum(reg.valor) } : reg);
const mapCaixaResponse = (c) => {
  if (!c) return c;
  const vendas = Array.isArray(c.vendas) ? c.vendas.map(normalizeVendaRegistro) : c.vendas;
  return {
    ...c,
    valorAbertura: toNum(c.valorAbertura),
    valorFechamento: toNum(c.valorFechamento),
    totalVendas: toNum(c.totalVendas),
    totalDinheiro: toNum(c.totalDinheiro),
    totalCartao: toNum(c.totalCartao),
    totalPix: toNum(c.totalPix),
    vendas,
  };
};

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

    const caixasObj = caixas.map(caixa => augmentCaixaVendas(caixa));
  res.json(caixasObj.map(mapCaixaResponse));
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

    const c = augmentCaixaVendas(caixa);
  res.json(mapCaixaResponse(c));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Abrir caixa
router.post('/abrir', async (req, res) => {
  try {
    const { funcionarioId, valorAbertura = 0, observacoes = '' } = req.body;

    const funcId = parseInt(funcionarioId, 10);
    if (Number.isNaN(funcId)) {
      return res.status(400).json({ message: 'funcionarioId inválido' });
    }

    // Verificar se funcionário existe
    const funcionario = await prisma.employee.findUnique({ where: { id: funcId } });
    if (!funcionario) {
      return res.status(404).json({ message: 'Funcionário não encontrado' });
    }

    // Verificar se já existe caixa aberto
    const caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    if (caixaAberto) {
      return res.status(400).json({ message: 'Já existe um caixa aberto' });
    }

    const novoCaixa = await prisma.caixa.create({
      data: {
        funcionarioAberturaId: funcId,
        valorAbertura: Number(valorAbertura) || 0,
        observacoes,
      },
      include: { funcionarioAbertura: { select: { nome: true } } },
    });

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
    const funcId = parseInt(funcionarioId, 10);
    if (Number.isNaN(funcId)) {
      return res.status(400).json({ message: 'funcionarioId inválido' });
    }

    const caixa = await prisma.caixa.findUnique({ where: { id } });
    if (!caixa) {
      return res.status(404).json({ message: 'Caixa não encontrado' });
    }

    if (caixa.status === 'fechado') {
      return res.status(400).json({ message: 'Caixa já está fechado' });
    }

    // Verificar se funcionário existe
    const funcionario = await prisma.employee.findUnique({ where: { id: funcId } });
    if (!funcionario) {
      return res.status(404).json({ message: 'Funcionário não encontrado' });
    }

    const updatedObservacoes = observacoes
      ? (caixa.observacoes ? caixa.observacoes + '\n' + observacoes : observacoes)
      : caixa.observacoes;

    const caixaPopulado = await prisma.caixa.update({
      where: { id },
      data: {
        dataFechamento: new Date(),
        funcionarioFechamentoId: funcId,
        valorFechamento: Number(valorFechamento) || 0,
        status: 'fechado',
        observacoes: updatedObservacoes,
      },
      include: {
        funcionarioAbertura: { select: { nome: true } },
        funcionarioFechamento: { select: { nome: true } },
      },
    });

    res.json(mapCaixaResponse(caixaPopulado));
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
      let funcionario = await prisma.employee.findFirst({ where: { ativo: true } });
      if (!funcionario) {
        funcionario = await prisma.employee.create({
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

    res.json({
      message: 'Venda registrada no caixa com sucesso',
      caixa: mapCaixaResponse(caixaAtualizado),
    });
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

    const c = augmentCaixaVendas(caixaAberto);
  res.json(mapCaixaResponse(c));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;