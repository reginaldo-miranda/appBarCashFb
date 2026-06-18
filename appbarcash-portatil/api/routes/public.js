import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';
import { enqueuePrintJob, buildPrintContent } from '../lib/print.js';
import { queueWhatsAppMessage, formatWhatsappMessage } from '../lib/whatsapp.js';
import { recordSaleUpdate } from '../lib/events.js';

const router = express.Router();

// Helper de normalização e compatibilidade de produto
const mapProductPublic = (p) => {
  const num = (v) => Number(v);
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao || null,
    precoVenda: num(p.precoVenda),
    categoria: p.categoria || '',
    unidade: p.unidade || 'un',
    disponivel: p.disponivel === undefined ? true : !!p.disponivel,
    temVariacao: !!p.temVariacao,
    imagem: p.imagem || null,
    tempoPreparoMinutos: Number(p.tempoPreparoMinutos || 0),
    categoriaId: p.categoriaId || null,
    temTamanhos: !!p.temTamanhos,
    tamanhos: Array.isArray(p.tamanhos) ? p.tamanhos.map(t => ({
      id: t.id,
      nome: t.nome,
      preco: num(t.preco),
      ativo: !!t.ativo
    })).filter(t => t.ativo) : [],
  };
};

// Rota 1: GET /api/public/menu - Listar produtos e categorias ativos para o cardápio
router.get('/menu', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    
    // Obter produtos disponíveis e ativos
    const produtos = await prisma.product.findMany({
      where: { ativo: true, disponivel: true },
      include: { tamanhos: true },
      orderBy: { nome: 'asc' }
    });

    // Obter categorias ativas
    const categorias = await prisma.categoria.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' }
    });

    const mappedProducts = produtos.map(mapProductPublic);

    res.json({
      success: true,
      message: 'Cardápio retornado com sucesso',
      produtos: mappedProducts,
      categorias
    });
  } catch (error) {
    console.error('Erro ao buscar cardápio público:', error);
    res.status(500).json({ success: false, error: 'Erro ao carregar o cardápio eletrônico' });
  }
});

// Rota 2: GET /api/public/mesa/:id - Validar mesa por ID e retornar status
router.get('/mesa/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID de mesa inválido' });
    }

    const mesa = await prisma.mesa.findUnique({
      where: { id },
      include: {
        vendaAtual: {
          select: {
            id: true,
            status: true,
            tipoVenda: true,
            subtotal: true,
            total: true,
          }
        }
      }
    });

    if (!mesa || !mesa.ativo) {
      return res.status(404).json({ success: false, error: 'Mesa não cadastrada ou inativa' });
    }

    res.json({
      success: true,
      mesa: {
        id: mesa.id,
        numero: mesa.numero,
        nome: mesa.nome,
        status: mesa.status,
        vendaAtualId: mesa.vendaAtualId,
        vendaAtual: mesa.vendaAtual
      }
    });
  } catch (error) {
    console.error('Erro ao buscar mesa pública:', error);
    res.status(500).json({ success: false, error: 'Erro ao validar a mesa' });
  }
});

// Rota 2.5: GET /api/public/comanda/:nome - Validar e buscar comanda
router.get('/comanda/:nome', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const nome = String(req.params.nome).trim();

    if (!nome) {
      return res.status(400).json({ success: false, error: 'Identificação da comanda é obrigatória' });
    }

    const vendaAtiva = await prisma.sale.findFirst({
      where: {
        nomeComanda: nome,
        tipoVenda: 'comanda',
        status: 'aberta'
      },
      select: {
        id: true,
        status: true,
        tipoVenda: true,
        subtotal: true,
        total: true
      }
    });

    res.json({
      success: true,
      comanda: {
        nome: nome,
        vendaAtual: vendaAtiva || null
      }
    });
  } catch (error) {
    console.error('Erro ao buscar comanda pública:', error);
    res.status(500).json({ success: false, error: 'Erro ao validar a comanda' });
  }
});

// Rota 3: POST /api/public/pedido - Lançar pedido da mesa ou comanda
router.post('/pedido', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { mesaId, comandaNome, itens } = req.body;

    if (!mesaId && !comandaNome) {
      return res.status(400).json({ success: false, error: 'Identificação da mesa ou comanda é obrigatória' });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ success: false, error: 'A sacola de compras está vazia' });
    }

    let mesa = null;
    let mesaIdNum = null;
    if (mesaId) {
      mesaIdNum = Number(mesaId);
      mesa = await prisma.mesa.findUnique({
        where: { id: mesaIdNum },
        include: { vendaAtual: true }
      });

      if (!mesa || !mesa.ativo) {
        return res.status(404).json({ success: false, error: 'Mesa não encontrada ou desativada' });
      }
    }

    // Usando transação para criar a venda/itens com total segurança
    const result = await prisma.$transaction(async (tx) => {
      let vendaId = null;
      let novaVendaCriada = false;
      const primeiroFunc = await tx.employee.findFirst({ where: { ativo: true } });

      if (mesa) {
        vendaId = mesa.vendaAtualId;

        // 1. Se a mesa estiver livre ou sem venda em aberto, cria uma nova venda do tipo mesa
        if (mesa.status !== 'ocupada' || !vendaId || mesa.vendaAtual?.status !== 'aberta') {
          const novaVenda = await tx.sale.create({
            data: {
              mesaId: mesaIdNum,
              tipoVenda: 'mesa',
              status: 'aberta',
              funcionarioId: primeiroFunc ? primeiroFunc.id : null,
              responsavelFuncionarioId: primeiroFunc ? primeiroFunc.id : null,
              subtotal: 0,
              desconto: 0,
              total: 0,
              observacoes: 'Pedido feito pelo Cardápio Eletrônico'
            }
          });

          vendaId = novaVenda.id;
          novaVendaCriada = true;

          // Atualizar Mesa para ocupada
          await tx.mesa.update({
            where: { id: mesaIdNum },
            data: {
              status: 'ocupada',
              vendaAtualId: vendaId,
              clientesAtuais: 1,
              horaAbertura: new Date(),
              nomeResponsavel: 'Auto-Atendimento'
            }
          });
        }
      } else if (comandaNome) {
        const comandaStr = String(comandaNome).trim();
        const comandaExistente = await tx.sale.findFirst({
          where: {
            nomeComanda: comandaStr,
            tipoVenda: 'comanda',
            status: 'aberta'
          }
        });

        if (comandaExistente) {
          vendaId = comandaExistente.id;
        } else {
          const novaVenda = await tx.sale.create({
            data: {
              nomeComanda: comandaStr,
              tipoVenda: 'comanda',
              status: 'aberta',
              funcionarioId: primeiroFunc ? primeiroFunc.id : null,
              responsavelFuncionarioId: primeiroFunc ? primeiroFunc.id : null,
              subtotal: 0,
              desconto: 0,
              total: 0,
              observacoes: 'Pedido feito pelo Cardápio Eletrônico'
            }
          });

          vendaId = novaVenda.id;
          novaVendaCriada = true;
        }
      }

      const itensInseridos = [];

      // 2. Inserir cada item
      for (const reqItem of itens) {
        const prodId = Number(reqItem.produtoId);
        const qty = Number(reqItem.quantidade || 1);
        const tamanhoName = reqItem.tamanho || null;
        const variacao = reqItem.variacao || null;

        const produto = await tx.product.findUnique({
          where: { id: prodId },
          include: { tamanhos: true }
        });

        if (!produto || !produto.ativo || !produto.disponivel) {
          throw new Error(`Produto #${prodId} indisponível no momento`);
        }

        let precoBase = Number(produto.precoVenda);
        let nomeFinal = produto.nome;

        // Tratar tamanho do produto
        if (tamanhoName) {
          const sizeObj = Array.isArray(produto.tamanhos) ? produto.tamanhos.find(t => t.nome === tamanhoName) : null;
          if (sizeObj) {
            precoBase = Number(sizeObj.preco);
            nomeFinal = `${produto.nome} (${tamanhoName})`;
          } else {
            throw new Error(`Tamanho '${tamanhoName}' não aplicável para ${produto.nome}`);
          }
        }

        // Lógica de variação (Ex: Pizza Meio a Meio)
        let precoUnit = precoBase;
        let variacaoTipo = null;
        let variacaoRegra = null;
        let variacaoOpcoes = null;

        if (variacao) {
          const tipoId = Number(variacao.tipoId);
          const tipoNome = String(variacao.tipoNome || '').trim();
          let vt = null;

          if (Number.isInteger(tipoId) && tipoId > 0) {
            vt = await tx.variationType.findUnique({ where: { id: tipoId } });
          } else if (tipoNome) {
            vt = await tx.variationType.findFirst({ where: { nome: tipoNome } });
          }

          if (vt && vt.ativo !== false) {
            const opcoesArr = Array.isArray(variacao.opcoes) ? variacao.opcoes : [];
            const opcoesIds = opcoesArr.map(o => Number(o.productId ?? o)).filter(n => Number.isInteger(n) && n > 0);
            const maxAllowed = Number(vt.maxOpcoes || 1);

            if (opcoesIds.length > 0 && opcoesIds.length <= maxAllowed) {
              const prods = await tx.product.findMany({
                where: { id: { in: opcoesIds }, ativo: true },
                include: { tamanhos: true }
              });

              if (prods.length === opcoesIds.length) {
                const precos = prods.map(p => {
                  if (tamanhoName && Array.isArray(p.tamanhos)) {
                    const s = p.tamanhos.find(t => t.nome === tamanhoName);
                    if (s) return Number(s.preco);
                  }
                  return Number(p.precoVenda);
                });

                const fractions = opcoesArr.map(o => Number(o.fracao || 0)).filter(f => Number.isFinite(f) && f > 0);
                const regra = String(vt.regraPreco);

                if (regra === 'mais_caro') {
                  precoUnit = Math.max(...precos);
                } else if (regra === 'media') {
                  if (fractions.length === precos.length && fractions.length > 0) {
                    const wsum = precos.reduce((acc, n, i) => acc + n * fractions[i], 0);
                    const fsum = fractions.reduce((acc, f) => acc + f, 0);
                    precoUnit = fsum > 0 ? (wsum / fsum) : precoBase;
                  } else {
                    const sum = precos.reduce((acc, n) => acc + n, 0);
                    precoUnit = precos.length > 0 ? (sum / precos.length) : precoBase;
                  }
                } else if (regra === 'fixo') {
                  const pf = vt.precoFixo !== null ? Number(vt.precoFixo) : 0;
                  precoUnit = pf > 0 ? pf : precoBase;
                }

                variacaoTipo = vt.nome;
                variacaoRegra = vt.regraPreco;
                variacaoOpcoes = prods.map((p, idx) => ({
                  productId: p.id,
                  nome: p.nome,
                  preco: precos[idx],
                  fracao: fractions[idx] || undefined
                }));

                if (variacaoOpcoes.length > 1) {
                  const nomesConcatenados = variacaoOpcoes.map(o => `meio ${o.nome}`).join(' / ');
                  nomeFinal = nomesConcatenados + (tamanhoName ? ` (${tamanhoName})` : '');
                }
              }
            }
          }
        }

        // Buscar se já há um item pendente idêntico sem variação na comanda para somar quantidade
        const itemExistente = !variacao ? await tx.saleItem.findFirst({
          where: {
            saleId: vendaId,
            productId: prodId,
            status: 'pendente',
            variacaoTipo: null,
          }
        }) : null;

        if (itemExistente) {
          const novaQtd = Number(itemExistente.quantidade) + qty;
          const subtotalCalculado = String((novaQtd * Number(itemExistente.precoUnitario)).toFixed(2));

          const updatedItem = await tx.saleItem.update({
            where: { id: itemExistente.id },
            data: {
              quantidade: novaQtd,
              subtotal: subtotalCalculado,
              createdAt: new Date()
            }
          });
          itensInseridos.push(updatedItem);
        } else {
          // Criar novo item de comanda
          const novoItem = await tx.saleItem.create({
            data: {
              saleId: vendaId,
              productId: prodId,
              nomeProduto: nomeFinal,
              quantidade: qty,
              precoUnitario: String(precoUnit.toFixed(2)),
              subtotal: String((qty * precoUnit).toFixed(2)),
              status: 'pendente',
              origem: 'cardapio',
              variacaoTipo: variacaoTipo || undefined,
              variacaoRegraPreco: variacaoRegra || undefined,
              variacaoOpcoes: variacaoOpcoes || undefined,
              createdAt: new Date()
            }
          });
          itensInseridos.push(novoItem);
        }
      }

      // 3. Recalcular os totais da Venda Principal
      const todosItens = await tx.saleItem.findMany({ where: { saleId: vendaId } });
      const novoSubtotal = todosItens.reduce((acc, item) => acc + Number(item.subtotal), 0);
      const saleObj = await tx.sale.findUnique({ where: { id: vendaId } });
      const desconto = Number(saleObj?.desconto || 0);
      const novoTotal = Math.max(0, novoSubtotal - desconto);

      await tx.sale.update({
        where: { id: vendaId },
        data: {
          subtotal: String(novoSubtotal.toFixed(2)),
          total: String(novoTotal.toFixed(2))
        }
      });

      return { vendaId, itensInseridos, novaVendaCriada };
    });

    // 4. Executar rotina de impressão e avisos (fora da transação para não causar bloqueios)
    try {
      const prismaClient = getActivePrisma();
      
      // Buscar venda completa com os dados atualizados
      const vendaCompleta = await prismaClient.sale.findUnique({
        where: { id: result.vendaId },
        include: {
          mesa: true,
          itens: { include: { product: true } }
        }
      });

      const saleRef = { mesa: vendaCompleta?.mesa || null, comanda: vendaCompleta?.nomeComanda || null };

      // Processar impressão de cada item recém-inserido
      for (const itemInserido of result.itensInseridos) {
        if (!itemInserido.productId) continue;

        // Buscar setores ativos vinculados ao produto
        const setores = await prismaClient.$queryRawUnsafe(`
          SELECT s.id AS id, s.nome AS nome, s.modoEnvio AS modo, s.whatsappDestino AS whatsappDestino, s.printerId AS printerId 
          FROM \`SetorImpressao\` s 
          INNER JOIN \`ProductSetorImpressao\` psi ON psi.setorId = s.id 
          WHERE psi.productId = ${itemInserido.productId} AND s.ativo = 1
        `);

        let cozinha = false;
        let bar = false;

        for (const s of Array.isArray(setores) ? setores : []) {
          const nomeSetorLower = String(s.nome || '').toLowerCase();
          const modo = String(s.modo || '').toLowerCase();

          if (['comandas', 'mesas', 'cozinha'].some(n => nomeSetorLower.includes(n))) cozinha = true;
          if (['balcão', 'balcao', 'bar'].some(n => nomeSetorLower.includes(n))) bar = true;

          // Disparar impressão física
          if (modo === 'impressora' && s.printerId) {
            const content = buildPrintContent({
              setorNome: s.nome,
              saleRef,
              productNome: itemInserido.nomeProduto,
              quantidade: itemInserido.quantidade,
              observacao: '[CARDÁPIO DIGITAL] ' + (itemInserido.observacao || '')
            });

            enqueuePrintJob({
              saleId: result.vendaId,
              productId: itemInserido.productId,
              setorId: Number(s.id),
              printerId: Number(s.printerId),
              content
            }).catch(err => console.error('Erro ao enfileirar impressão do cardápio:', err));
          }

          // Notificação via WhatsApp
          if (modo === 'whatsapp' && s.whatsappDestino) {
            const text = formatWhatsappMessage({ sale: vendaCompleta, itens: vendaCompleta?.itens || [] });
            queueWhatsAppMessage({
              saleId: result.vendaId,
              to: String(s.whatsappDestino),
              text
            }).catch(err => console.error('Erro ao enviar whatsapp do cardápio:', err));
          }
        }

        // Registrar se imprimiu cozinha ou bar
        if (cozinha || bar) {
          await prismaClient.sale.update({
            where: { id: result.vendaId },
            data: {
              impressaoCozinha: cozinha ? true : undefined,
              impressaoBar: bar ? true : undefined
            }
          });
        }
      }

      // 5. Notificar via WebSockets / SSE em tempo real para os garçons/caixa
      recordSaleUpdate(result.vendaId);
    } catch (err) {
      console.error('Erro ao processar impressões ou alertas do cardápio:', err);
    }

    res.status(201).json({
      success: true,
      message: 'Seu pedido foi enviado com sucesso para a cozinha!',
      vendaId: result.vendaId,
      itensCount: result.itensInseridos.length
    });

  } catch (error) {
    console.error('Erro ao processar pedido público:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao processar o seu pedido' });
  }
});

export default router;
