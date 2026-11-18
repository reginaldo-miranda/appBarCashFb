import prisma from '../lib/prisma.js';
import { interpretarComandoDeVoz } from '../services/VoiceAssistantService.js';
import { enqueuePrintJob, buildPrintContent } from '../lib/print.js';
import { recordSaleUpdate } from '../lib/events.js';

/**
 * 1. Interpreta a frase de voz e devolve a confirmação estruturada
 */
export async function parseVoiceCommand(req, res) {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, message: 'Texto de voz não informado' });
    }

    const resultado = await interpretarComandoDeVoz(text);
    return res.json({ ok: true, data: resultado });
  } catch (error) {
    console.error('[VoiceController] Erro no parse:', error);
    return res.status(500).json({ ok: false, message: error.message || 'Erro ao processar comando de voz' });
  }
}

/**
 * 2. Executa a operação confirmada (Abertura ou Lançamento de Produto)
 */
export async function executeVoiceCommand(req, res) {
  try {
    const { action, clienteNome, garcomId, garcomNome, itens } = req.body || {};
    const userId = req.user?.id || req.user?.userId;

    // Resolve o funcionário responsável
    let funcionarioId = garcomId ? Number(garcomId) : null;
    if (!funcionarioId && userId) {
      const u = await prisma.user.findUnique({ where: { id: Number(userId) } });
      if (u?.employeeId) funcionarioId = u.employeeId;
    }
    if (!funcionarioId) {
      const primeiroFunc = await prisma.employee.findFirst({ where: { ativo: true } });
      funcionarioId = primeiroFunc ? primeiroFunc.id : 1;
    }

    // =========================================================================
    // FLUXO 1: ABERTURA DE COMANDA POR VOZ
    // =========================================================================
    if (action === 'abertura_comanda' || (!itens || itens.length === 0)) {
      if (!clienteNome || !clienteNome.trim()) {
        return res.status(400).json({ ok: false, message: 'Nome do cliente não informado para abertura da comanda.' });
      }

      // 1. Localiza ou cadastra o cliente
      let cliente = await prisma.customer.findFirst({
        where: { nome: { contains: clienteNome.trim() } }
      });
      if (!cliente) {
        cliente = await prisma.customer.create({
          data: {
            nome: clienteNome.trim(),
            ativo: true
          }
        });
      }

      // 2. Verifica se o cliente já possui comanda aberta (evita duplicar comanda pro mesmo cliente)
      const comandaExistente = await prisma.sale.findFirst({
        where: {
          clienteId: cliente.id,
          status: 'aberta',
          tipoVenda: 'comanda'
        }
      });
      if (comandaExistente) {
        return res.json({
          ok: true,
          message: `O cliente ${cliente.nome} já possui a comanda nº ${comandaExistente.nomeComanda} aberta!`,
          comanda: comandaExistente.nomeComanda,
          vendaId: comandaExistente.id,
          cliente: cliente.nome,
          jaExistia: true
        });
      }

      // 3. Gera o próximo número sequencial da comanda automaticamente
      const vendasComandas = await prisma.sale.findMany({
        where: { tipoVenda: 'comanda' },
        select: { nomeComanda: true },
        take: 500,
        orderBy: { id: 'desc' }
      });

      let maiorNumero = 0;
      for (const vc of vendasComandas) {
        const num = parseInt(String(vc.nomeComanda || ''), 10);
        if (!isNaN(num) && num > maiorNumero) {
          maiorNumero = num;
        }
      }
      const proximoNumero = maiorNumero + 1;

      // 4. Cria a nova comanda no banco
      const novaComanda = await prisma.sale.create({
        data: {
          nomeComanda: String(proximoNumero),
          tipoVenda: 'comanda',
          funcionarioId: funcionarioId,
          clienteId: cliente.id,
          status: 'aberta',
          subtotal: 0,
          desconto: 0,
          total: 0,
          formaPagamento: 'dinheiro',
          dataVenda: new Date()
        }
      });

      // Notifica em tempo real os terminais
      try { recordSaleUpdate(novaComanda.id, 'comanda_aberta_voz'); } catch {}

      return res.json({
        ok: true,
        message: `Comanda nº ${proximoNumero} aberta com sucesso para ${cliente.nome}!`,
        comanda: proximoNumero,
        vendaId: novaComanda.id,
        cliente: cliente.nome,
        funcionario: garcomNome || 'Atendente'
      });
    }

    // =========================================================================
    // FLUXO 2: LANÇAMENTO DE PRODUTO NA COMANDA EXISTENTE
    // =========================================================================
    if (action === 'lancamento_produto' || (itens && itens.length > 0)) {
      if (!clienteNome || !clienteNome.trim()) {
        return res.status(400).json({ ok: false, message: 'Nome do cliente não identificado para localizar a comanda.' });
      }

      // 1. Localiza a comanda aberta do cliente (sem criar comanda nova por engano)
      const venda = await prisma.sale.findFirst({
        where: {
          status: 'aberta',
          cliente: {
            nome: { contains: clienteNome.trim() }
          }
        },
        include: { cliente: true },
        orderBy: { id: 'desc' }
      });

      if (!venda) {
        return res.status(404).json({
          ok: false,
          message: `Nenhuma comanda aberta encontrada para o cliente "${clienteNome}". Abra a comanda primeiro falando: "[Funcionário], ${clienteNome}".`
        });
      }

      // 2. Insere os produtos na comanda existente
      const itensAdicionados = [];
      let valorAcrescido = 0;

      for (const item of itens) {
        const prodId = Number(item.produtoId);
        const qtd = Number(item.quantidade) || 1;
        if (!prodId || qtd <= 0) continue;

        const prod = await prisma.product.findUnique({
          where: { id: prodId },
          include: {
            setoresImpressao: { include: { setor: true } }
          }
        });
        if (!prod) continue;

        const precoUnit = Number(prod.precoVenda || 0);
        const subtotal = precoUnit * qtd;
        valorAcrescido += subtotal;

        const novoItem = await prisma.saleItem.create({
          data: {
            saleId: venda.id,
            productId: prod.id,
            nomeProduto: prod.nome,
            quantidade: qtd,
            precoUnitario: precoUnit,
            subtotal: subtotal,
            observacoes: item.observacao || null,
            status: 'pendente'
          }
        });

        itensAdicionados.push({ ...novoItem, produto: prod });

        // Enfileira impressão de produção se o produto tiver setor
        try {
          const temSetores = Array.isArray(prod.setoresImpressao) && prod.setoresImpressao.length > 0;
          if (temSetores) {
            for (const psi of prod.setoresImpressao) {
              if (psi.setor && psi.setor.ativo) {
                const printData = buildPrintContent('producao', {
                  venda,
                  item: novoItem,
                  produto: prod,
                  setor: psi.setor
                });
                await enqueuePrintJob(psi.setor.id, printData);
              }
            }
          }
        } catch (printErr) {
          console.warn('[VoiceController] Aviso na impressão automática:', printErr.message);
        }
      }

      // 3. Atualiza os totais da comanda
      await prisma.sale.update({
        where: { id: venda.id },
        data: {
          subtotal: { increment: valorAcrescido },
          total: { increment: valorAcrescido }
        }
      });

      // Emite evento para os terminais em tempo real
      try { recordSaleUpdate(venda.id, 'itens_adicionados_voz'); } catch {}

      return res.json({
        ok: true,
        message: `Itens adicionados com sucesso na comanda de ${venda.cliente?.nome || clienteNome}!`,
        vendaId: venda.id,
        comanda: venda.nomeComanda,
        cliente: venda.cliente?.nome || clienteNome,
        itensTotal: itensAdicionados.length,
        valorTotal: Number(venda.total || 0) + valorAcrescido
      });
    }

    return res.status(400).json({ ok: false, message: 'Ação não identificada.' });

  } catch (error) {
    console.error('[VoiceController] Erro na execução:', error);
    return res.status(500).json({ ok: false, message: error.message || 'Erro ao executar comando' });
  }
}
