import express from 'express';
import multer from 'multer';
import { DOMParser } from 'xmldom';
import prisma from '../lib/prisma.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Auxiliar para extrair texto de uma tag XML
function getTagValue(element, tagName) {
  if (!element) return '';
  const tags = element.getElementsByTagName(tagName);
  if (tags && tags.length > 0 && tags[0].firstChild) {
    return tags[0].firstChild.nodeValue || '';
  }
  return '';
}

// 0. Gerenciamento de Locais de Estoque (Geladeira 1, Balcão, Cozinha, etc.)
router.get('/locations', async (req, res) => {
  try {
    const locations = await prisma.stockLocation.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    res.json(locations);
  } catch (error) {
    console.error('Erro ao buscar locais de estoque:', error);
    res.status(500).json({ error: 'Erro ao buscar locais de estoque' });
  }
});

router.post('/locations', async (req, res) => {
  try {
    const { nome, tipo, descricao } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: 'Nome do local é obrigatório' });
    }
    const cleanNome = String(nome).trim();
    const existing = await prisma.stockLocation.findFirst({
      where: { nome: cleanNome }
    });
    if (existing) {
      if (!existing.ativo) {
        const reativado = await prisma.stockLocation.update({
          where: { id: existing.id },
          data: { ativo: true, tipo: tipo || existing.tipo, descricao: descricao !== undefined ? descricao : existing.descricao }
        });
        return res.status(200).json({ message: 'Local de estoque reativado', location: reativado });
      }
      return res.status(400).json({ error: 'Já existe um local com este nome' });
    }

    const location = await prisma.stockLocation.create({
      data: {
        nome: cleanNome,
        tipo: tipo || 'OUTRO',
        descricao: descricao || null,
        ativo: true
      }
    });
    res.status(201).json({ message: 'Local cadastrado com sucesso', location });
  } catch (error) {
    console.error('Erro ao cadastrar local de estoque:', error);
    res.status(500).json({ error: 'Erro ao cadastrar local de estoque' });
  }
});

router.put('/locations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, tipo, descricao, ativo } = req.body;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    const data = {};
    if (nome && String(nome).trim()) data.nome = String(nome).trim();
    if (tipo !== undefined) data.tipo = tipo;
    if (descricao !== undefined) data.descricao = descricao;
    if (ativo !== undefined) data.ativo = !!ativo;

    const location = await prisma.stockLocation.update({
      where: { id },
      data
    });

    if (data.nome) {
      await prisma.product.updateMany({
        where: { localVendaId: id },
        data: { localVendaNome: data.nome }
      });
    }

    res.json({ message: 'Local atualizado com sucesso', location });
  } catch (error) {
    console.error('Erro ao atualizar local de estoque:', error);
    res.status(500).json({ error: 'Erro ao atualizar local de estoque' });
  }
});

router.delete('/locations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    const location = await prisma.stockLocation.update({
      where: { id },
      data: { ativo: false }
    });

    res.json({ message: 'Local desativado com sucesso', location });
  } catch (error) {
    console.error('Erro ao desativar local de estoque:', error);
    res.status(500).json({ error: 'Erro ao desativar local de estoque' });
  }
});

// 1. Listar fornecedores
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { ativo: true },
      orderBy: { razaoSocial: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  }
});

// 2. Cadastrar fornecedor manualmente
router.post('/supplier', async (req, res) => {
  try {
    const { cnpj, razaoSocial, nomeFantasia, telefone, email, nomeContato, tipo, logradouro, numero, complemento, bairro, cidade, uf, cep } = req.body;

    if (!cnpj || !razaoSocial) {
      return res.status(400).json({ error: 'CNPJ e Razão Social são obrigatórios' });
    }

    const limpoCnpj = String(cnpj).replace(/\D/g, '');
    const existente = await prisma.supplier.findUnique({
      where: { cnpj: limpoCnpj },
    });

    if (existente) {
      return res.status(400).json({ error: 'Fornecedor já cadastrado com este CNPJ' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        cnpj: limpoCnpj,
        razaoSocial,
        nomeFantasia,
        telefone,
        email,
        nomeContato,
        tipo,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        ativo: true,
      },
    });

    res.status(201).json({ message: 'Fornecedor cadastrado com sucesso', supplier });
  } catch (error) {
    console.error('Erro ao cadastrar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao cadastrar fornecedor' });
  }
});

// 3. Listar histórico de movimentações com filtros e paginação
router.get('/history', async (req, res) => {
  try {
    const { productId, tipo, motivo, page = 1, limit = 50 } = req.query;
    
    const p = Math.max(1, parseInt(String(page)));
    const l = Math.max(1, parseInt(String(limit)));
    
    const where = {};
    if (productId) {
      where.productId = parseInt(String(productId));
    }
    if (tipo) {
      where.tipo = String(tipo);
    }
    if (motivo) {
      where.motivo = String(motivo);
    }

    const total = await prisma.stockMovement.count({ where });
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: { id: true, nome: true, precoVenda: true, unidade: true }
        },
        supplier: {
          select: { id: true, razaoSocial: true, cnpj: true }
        }
      },
      orderBy: { dataCadastro: 'desc' },
      skip: (p - 1) * l,
      take: l,
    });

    res.json({
      movements,
      pagination: {
        total,
        page: p,
        limit: l,
        pages: Math.ceil(total / l)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de estoque:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de estoque' });
  }
});

// 4. Lançar movimentação manual (Entrada/Saída/Ajuste)
router.post('/move', async (req, res) => {
  try {
    const { productId, tipo, quantidade, precoCusto, motivo, observacao, supplierId, local } = req.body;

    if (!productId || !tipo || quantidade === undefined) {
      return res.status(400).json({ error: 'Produto, tipo e quantidade são obrigatórios' });
    }

    const pId = parseInt(String(productId));
    const qty = parseInt(String(quantidade));

    if (isNaN(pId) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de movimentação inválido' });
    }

    // Definir local da movimentação (padrão: DEPOSITO para entrada, GELADEIRA para saída)
    const targetLocal = local ? String(local).toUpperCase() : (tipo === 'ENTRADA' ? 'DEPOSITO' : 'GELADEIRA');

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: pId } });
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    let finalQtyChange = qty;
    let novoDeposito = Number(product.estoqueDeposito || 0);
    let novoGeladeira = Number(product.estoqueGeladeira || 0);

    if (tipo === 'ENTRADA') {
      if (targetLocal === 'GELADEIRA') novoGeladeira += qty;
      else novoDeposito += qty;
    } else if (tipo === 'SAIDA') {
      finalQtyChange = -qty;
      if (targetLocal === 'DEPOSITO') novoDeposito -= qty;
      else novoGeladeira -= qty;
    } else if (tipo === 'AJUSTE') {
      if (targetLocal === 'DEPOSITO') {
        finalQtyChange = qty - novoDeposito;
        novoDeposito = qty;
      } else {
        finalQtyChange = qty - novoGeladeira;
        novoGeladeira = qty;
      }
    }

    const novoEstoque = novoDeposito + novoGeladeira;

    // Executar alteração em transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar produto
      const updateData = {
        quantidade: novoEstoque,
        estoqueDeposito: novoDeposito,
        estoqueGeladeira: novoGeladeira
      };
      if (precoCusto !== undefined && precoCusto !== null) {
        updateData.precoCusto = Number(precoCusto);
      }
      
      const updatedProduct = await tx.product.update({
        where: { id: pId },
        data: updateData,
      });

      // 2. Criar log de movimentação
      const sId = supplierId ? parseInt(String(supplierId)) : null;
      const movement = await tx.stockMovement.create({
        data: {
          productId: pId,
          tipo,
          origem: 'MANUAL',
          quantidade: finalQtyChange,
          precoCusto: precoCusto !== undefined && precoCusto !== null ? Number(precoCusto) : product.precoCusto,
          motivo: motivo || null,
          observacao: observacao || `Movimentação no local: ${targetLocal}`,
          supplierId: sId || null,
          usuarioId: req.user?.id || null,
          localOrigem: tipo === 'SAIDA' ? targetLocal : null,
          localDestino: tipo === 'ENTRADA' ? targetLocal : null,
        },
      });

      return { updatedProduct, movement };
    });

    res.json({
      message: 'Movimentação registrada com sucesso',
      quantidadeAtual: result.updatedProduct.quantidade,
      estoqueDeposito: result.updatedProduct.estoqueDeposito,
      estoqueGeladeira: result.updatedProduct.estoqueGeladeira,
      movement: result.movement,
    });

  } catch (error) {
    console.error('Erro ao realizar movimentação de estoque:', error);
    res.status(500).json({ error: 'Erro ao realizar movimentação de estoque' });
  }
});

// 4.1 Transferência de Estoque entre Locais (Depósito <-> Geladeira/Balcão/Cozinha)
router.post('/transfer', async (req, res) => {
  try {
    const { productId, quantidade, origem = 'DEPOSITO', destino = 'GELADEIRA', observacao } = req.body;

    if (!productId || quantidade === undefined || Number(quantidade) <= 0) {
      return res.status(400).json({ error: 'Produto e quantidade válida são obrigatórios.' });
    }

    const pId = parseInt(String(productId));
    const qty = parseInt(String(quantidade));

    if (isNaN(pId) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Parâmetros de transferência inválidos.' });
    }

    const locOrigem = String(origem).trim();
    const locDestino = String(destino).trim();

    if (locOrigem.toUpperCase() === locDestino.toUpperCase()) {
      return res.status(400).json({ error: 'Origem e destino não podem ser o mesmo local.' });
    }

    const isOrigemDep = /dep[oó]sito/i.test(locOrigem);
    const isDestinoDep = /dep[oó]sito/i.test(locDestino);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: pId } });
      if (!product) {
        throw new Error('Produto não encontrado');
      }

      let novoDeposito = Number(product.estoqueDeposito || 0);
      let novoGeladeira = Number(product.estoqueGeladeira || 0);
      let novoLocalVendaNome = product.localVendaNome;

      if (isOrigemDep && !isDestinoDep) {
        // Depósito -> Local de Venda (Geladeira, Balcão, Cozinha...)
        if (novoDeposito < qty) {
          throw new Error(`Saldo insuficiente no Depósito (disponível: ${novoDeposito}).`);
        }
        novoDeposito -= qty;
        novoGeladeira += qty;
        // Se o destino for um local de venda explícito, sincroniza o local de venda
        if (locDestino && locDestino.toUpperCase() !== 'GELADEIRA') {
          novoLocalVendaNome = locDestino;
        }
      } else if (!isOrigemDep && isDestinoDep) {
        // Local de Venda -> Depósito
        if (novoGeladeira < qty) {
          throw new Error(`Saldo insuficiente em ${locOrigem} (disponível: ${novoGeladeira}).`);
        }
        novoGeladeira -= qty;
        novoDeposito += qty;
      } else if (!isOrigemDep && !isDestinoDep) {
        // Entre dois locais de venda (ex: Geladeira 1 -> Geladeira 2 ou Balcão)
        if (novoGeladeira < qty) {
          throw new Error(`Saldo insuficiente em ${locOrigem} (disponível: ${novoGeladeira}).`);
        }
        // O produto passa a ter o novo local de venda
        novoLocalVendaNome = locDestino;
      } else {
        throw new Error('Origem e destino não podem ser ambos Depósito.');
      }

      const updatedProduct = await tx.product.update({
        where: { id: pId },
        data: {
          estoqueDeposito: novoDeposito,
          estoqueGeladeira: novoGeladeira,
          quantidade: novoDeposito + novoGeladeira,
          localVendaNome: novoLocalVendaNome
        }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: pId,
          tipo: 'TRANSFERENCIA',
          origem: 'MANUAL',
          quantidade: qty,
          precoCusto: product.precoCusto,
          motivo: isDestinoDep ? 'RETORNO_DEPOSITO' : 'ABASTECIMENTO_PONTO_VENDA',
          observacao: observacao || `Transferência de ${qty} un de ${locOrigem} para ${locDestino}`,
          localOrigem: locOrigem,
          localDestino: locDestino,
          usuarioId: req.user?.id || null
        }
      });

      return { updatedProduct, movement };
    });

    res.json({
      success: true,
      message: `Transferência de ${qty} unidades concluída com sucesso!`,
      quantidadeAtual: result.updatedProduct.quantidade,
      estoqueDeposito: result.updatedProduct.estoqueDeposito,
      estoqueGeladeira: result.updatedProduct.estoqueGeladeira,
      movement: result.movement
    });
  } catch (error) {
    console.error('Erro ao transferir estoque:', error);
    res.status(500).json({ error: error.message || 'Erro ao transferir estoque' });
  }
});

// 5. Ler XML de Nota Fiscal (NF-e de compra)
router.post('/import-xml', upload.single('xml'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo XML é obrigatório' });
    }

    const xmlContent = req.file.buffer.toString('utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // 1. Chave de acesso
    let chave = '';
    const infNFe = doc.getElementsByTagName('infNFe');
    if (infNFe && infNFe.length > 0) {
      const idAttr = infNFe[0].getAttribute('Id');
      if (idAttr) {
        chave = idAttr.replace(/\D/g, ''); // Mantém apenas números
      }
    }
    if (!chave) {
      // Tentar via tag chNFe (comum em retorno de protocolo)
      chave = getTagValue(doc, 'chNFe');
    }

    // 2. Dados do fornecedor (Emitente)
    const emit = doc.getElementsByTagName('emit')[0];
    if (!emit) {
      return res.status(400).json({ error: 'Estrutura XML inválida: fornecedor (emit) não encontrado' });
    }

    const enderEmit = emit.getElementsByTagName('enderEmit')[0];
    const fornecedor = {
      cnpj: getTagValue(emit, 'CNPJ'),
      razaoSocial: getTagValue(emit, 'xNome'),
      nomeFantasia: getTagValue(emit, 'xFant') || getTagValue(emit, 'xNome'),
      telefone: getTagValue(emit, 'fone') || getTagValue(enderEmit, 'fone') || null,
      email: getTagValue(emit, 'email') || null,
      logradouro: getTagValue(enderEmit, 'xLgr') || null,
      numero: getTagValue(enderEmit, 'nro') || null,
      complemento: getTagValue(enderEmit, 'xCpl') || null,
      bairro: getTagValue(enderEmit, 'xBairro') || null,
      cidade: getTagValue(enderEmit, 'xMun') || null,
      uf: getTagValue(enderEmit, 'UF') || null,
      cep: getTagValue(enderEmit, 'CEP') || null,
    };

    if (!fornecedor.cnpj || !fornecedor.razaoSocial) {
      return res.status(400).json({ error: 'XML não contém CNPJ ou Razão Social do Emitente' });
    }

    // 3. Extrair produtos do XML
    const detList = doc.getElementsByTagName('det');
    const itens = [];

    for (let i = 0; i < detList.length; i++) {
      const prod = detList[i].getElementsByTagName('prod')[0];
      if (prod) {
        const item = {
          cProd: getTagValue(prod, 'cProd'),
          cEAN: getTagValue(prod, 'cEAN'),
          xProd: getTagValue(prod, 'xProd'),
          uCom: getTagValue(prod, 'uCom'),
          qCom: parseFloat(getTagValue(prod, 'qCom') || '0'),
          vUnCom: parseFloat(getTagValue(prod, 'vUnCom') || '0'),
          vProd: parseFloat(getTagValue(prod, 'vProd') || '0'),
          ncm: getTagValue(prod, 'NCM'),
          cest: getTagValue(prod, 'CEST'),
          cfop: getTagValue(prod, 'CFOP'),
        };
        
        // Se cEAN for inválido ou 'SEM GTIN', limpar
        if (item.cEAN === 'SEM GTIN' || !/^\d+$/.test(item.cEAN)) {
          item.cEAN = '';
        }

        itens.push(item);
      }
    }

    // 4. Buscar se fornecedor já está cadastrado
    const dbFornecedor = await prisma.supplier.findUnique({
      where: { cnpj: fornecedor.cnpj }
    });

    // 5. Tentar pré-associar itens do XML por EAN com produtos do banco
    const itensPreAssociados = [];
    for (const item of itens) {
      let productMatch = null;
      
      if (item.cEAN) {
        productMatch = await prisma.product.findFirst({
          where: { dadosFiscais: item.cEAN, ativo: true } // ou verificar outros campos de código de barras
        });
        
        if (!productMatch) {
          // Fallback: tentar buscar por nome do produto
          productMatch = await prisma.product.findFirst({
            where: { nome: { equals: item.xProd }, ativo: true }
          });
        }
      } else {
        // Tentar por nome direto
        productMatch = await prisma.product.findFirst({
          where: { nome: { equals: item.xProd }, ativo: true }
        });
      }

      itensPreAssociados.push({
        ...item,
        associatedProductId: productMatch ? productMatch.id : null,
        associatedProductName: productMatch ? productMatch.nome : null,
        associatedProductPrecoVenda: productMatch ? Number(productMatch.precoVenda || 0) : null,
        associatedProductPrecoCusto: productMatch ? Number(productMatch.precoCusto || 0) : null,
        associatedProductLocalVendaNome: productMatch ? (productMatch.localVendaNome || 'Geladeira 1') : null,
        associatedProductLocalVendaId: productMatch ? productMatch.localVendaId : null,
      });
    }

    res.json({
      chave,
      fornecedor: dbFornecedor || { ...fornecedor, novo: true },
      itens: itensPreAssociados,
    });

  } catch (error) {
    console.error('Erro ao processar XML de nota fiscal:', error);
    res.status(500).json({ error: 'Erro ao processar XML de nota fiscal' });
  }
});

// 6. Confirmar Entrada em Lote via XML
router.post('/confirm-xml', async (req, res) => {
  try {
    const { chave, fornecedor, itens } = req.body;

    if (!chave || !fornecedor || !itens || !Array.isArray(itens)) {
      return res.status(400).json({ error: 'Dados da nota fiscal incompletos' });
    }

    // 1. Garantir fornecedor cadastrado
    let dbSupplier = await prisma.supplier.findUnique({
      where: { cnpj: fornecedor.cnpj }
    });

    if (!dbSupplier) {
      dbSupplier = await prisma.supplier.create({
        data: {
          cnpj: fornecedor.cnpj,
          razaoSocial: fornecedor.razaoSocial,
          nomeFantasia: fornecedor.nomeFantasia || fornecedor.razaoSocial,
          telefone: fornecedor.telefone || null,
          email: fornecedor.email || null,
          nomeContato: fornecedor.nomeContato || null,
          tipo: fornecedor.tipo || null,
          logradouro: fornecedor.logradouro || null,
          numero: fornecedor.numero || null,
          complemento: fornecedor.complemento || null,
          bairro: fornecedor.bairro || null,
          cidade: fornecedor.cidade || null,
          uf: fornecedor.uf || null,
          cep: fornecedor.cep || null,
          ativo: true
        }
      });
    }

    // 2. Executar toda a entrada em lote usando transação do Prisma
    const resultado = await prisma.$transaction(async (tx) => {
      const logs = [];

      for (const item of itens) {
        let pId = item.productId;
        let novoPrecoCusto = Number(item.vUnCom);

        // Se o usuário solicitou criar um novo produto
        if (item.cadastrarNovo && item.novoProduto) {
          const np = item.novoProduto;
          const createdProduct = await tx.product.create({
            data: {
              nome: np.nome,
              descricao: np.descricao || '',
              precoCusto: Number(np.precoCusto || item.vUnCom),
              precoVenda: Number(np.precoVenda || 0),
              categoria: np.categoria || '',
              tipo: np.tipo || '',
              unidade: np.unidade || 'un',
              quantidade: 0, // Inicia zerado; a quantidade da nota será somada logo abaixo
              dadosFiscais: item.cEAN || '',
              ncm: item.ncm || '',
              cest: item.cest || '',
              cfop: item.cfop || '',
              localVendaId: np.localVendaId ? Number(np.localVendaId) : undefined,
              localVendaNome: np.localVendaNome ? String(np.localVendaNome).trim() : undefined,
              ativo: true,
              disponivel: true,
            }
          });
          pId = createdProduct.id;
          novoPrecoCusto = Number(np.precoCusto || item.vUnCom);
        }

        if (!pId) {
          console.warn(`[StockConfirm] Item do XML ignorado por falta de associação: ${item.xProd}`);
          continue;
        }

        // Buscar dados atuais do produto
        const product = await tx.product.findUnique({ where: { id: pId } });
        if (!product) {
          throw new Error(`Produto associado ID ${pId} não foi encontrado.`);
        }

        const fator = Number(item.fatorConversao || 1);
        const qtEntrada = Number(item.qCom) * fator;
        
        // Novo custo unitário ponderado pelo fator de conversão
        const custoUnitarioConvertido = Number(item.vUnCom) / fator;

        const itemDestino = String(item.localDestino || 'DEPOSITO').trim();
        const isDep = /dep[oó]sito/i.test(itemDestino);

        let novoDeposito = Number(product.estoqueDeposito || 0);
        let novoGeladeira = Number(product.estoqueGeladeira || 0);

        if (isDep) {
          novoDeposito += qtEntrada;
        } else {
          novoGeladeira += qtEntrada;
        }
        const novoTotal = novoDeposito + novoGeladeira;

        // Atualizar produto (Estoque no Depósito/Local, Total, Custo e opcionalmente Preço de Venda ajustado)
        const updateProductData = {
          quantidade: novoTotal,
          estoqueDeposito: novoDeposito,
          estoqueGeladeira: novoGeladeira,
          precoCusto: custoUnitarioConvertido
        };
        if (item.precoVenda !== undefined && item.precoVenda !== null && Number(item.precoVenda) > 0) {
          updateProductData.precoVenda = Number(item.precoVenda);
        }

        const updated = await tx.product.update({
          where: { id: pId },
          data: updateProductData
        });

        const destNome = isDep ? 'DEPOSITO' : (itemDestino || product.localVendaNome || 'GELADEIRA');

        // Registrar movimentação de estoque
        const movement = await tx.stockMovement.create({
          data: {
            productId: pId,
            tipo: 'ENTRADA',
            origem: 'XML_NFE',
            quantidade: qtEntrada,
            precoCusto: custoUnitarioConvertido,
            motivo: 'COMPRA',
            observacao: `Entrada via XML Nota: ${chave} (Fator: 1:${fator}) - ${destNome}`,
            chaveNfe: chave,
            supplierId: dbSupplier.id,
            usuarioId: req.user?.id || null,
            localDestino: destNome
          }
        });

        logs.push({ productId: pId, totalAdicionado: qtEntrada, precoCusto: custoUnitarioConvertido });
      }

      return logs;
    });

    res.json({
      message: 'Nota fiscal de compra integrada com sucesso!',
      processados: resultado.length,
      detalhes: resultado
    });

  } catch (error) {
    console.error('Erro ao confirmar importação em lote:', error);
    res.status(500).json({ error: error.message || 'Erro ao integrar XML no estoque' });
  }
});

export default router;
