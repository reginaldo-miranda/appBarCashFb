import prisma from '../lib/prisma.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

/**
 * Normaliza strings para comparação (remove acentos e pontuação, minúsculas)
 */
function normalizarTexto(txt) {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .trim();
}

/**
 * Calcula similaridade entre duas palavras
 */
function palavrasParecidas(p1, p2) {
  if (!p1 || !p2) return false;
  if (p1 === p2) return true;
  if (p1.length >= 4 && p2.length >= 4) {
    if (p1.startsWith(p2.substring(0, 4)) || p2.startsWith(p1.substring(0, 4))) return true;
  }
  return false;
}

/**
 * Analisador local inteligente com suporte estrito aos 2 padrões de fala
 */
function parseLocalFallback(textoOriginal, produtosDisponiveis, garconsDisponiveis) {
  const norm = normalizarTexto(textoOriginal);
  const palavras = norm.split(/\s+/).filter(w => w.length > 0);
  const mapaTextoQtd = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };

  // =========================================================================
  // PADRÃO 2: Lançamento de Produto na Comanda
  // Formato: "Comanda [Nome do Cliente], [Qtd] [Nome do Produto]"
  // Ex: "Comanda José Carlos, uma Antarctica 600 ml."
  // =========================================================================
  if (norm.startsWith('comanda ') || norm.includes('comanda')) {
    const semComanda = norm.replace(/^.*?comanda\s+/i, '').trim();
    const semComandaPalavras = semComanda.split(/\s+/);

    // Sistema de pontuação para encontrar o produto mais adequado
    let melhorProduto = null;
    let melhorScore = 0;
    let indiceInicioProduto = -1;

    for (const prod of produtosDisponiveis) {
      const prodNorm = normalizarTexto(prod.nome);
      const palavrasProd = prodNorm.split(/\s+/).filter(w => w.length >= 2);
      
      let score = 0;
      let primeiroIdxNaFrase = -1;

      for (const wProd of palavrasProd) {
        const idx = semComandaPalavras.findIndex(w => palavrasParecidas(w, wProd));
        if (idx !== -1) {
          // Palavras distintivas (não apenas números/medidas) ganham peso 10
          const peso = (['600', '600ml', 'ml', 'l', '2l', 'lata', 'litro', 'litros'].includes(wProd)) ? 1 : 10;
          score += peso;
          if (primeiroIdxNaFrase === -1 || idx < primeiroIdxNaFrase) {
            primeiroIdxNaFrase = idx;
          }
        }
      }

      if (score > melhorScore) {
        melhorScore = score;
        melhorProduto = prod;
        indiceInicioProduto = primeiroIdxNaFrase;
      }
    }

    if (melhorProduto && melhorScore >= 10) {
      let quantidade = 1;

      // Verifica se há quantidade antes do início do produto
      let fimIndiceCliente = indiceInicioProduto;
      if (indiceInicioProduto > 0) {
        const palavraAnterior = semComandaPalavras[indiceInicioProduto - 1];
        if (/^\d+$/.test(palavraAnterior)) {
          quantidade = parseInt(palavraAnterior, 10);
          fimIndiceCliente = indiceInicioProduto - 1;
        } else if (mapaTextoQtd[palavraAnterior]) {
          quantidade = mapaTextoQtd[palavraAnterior];
          fimIndiceCliente = indiceInicioProduto - 1;
        }
      }

      // Extrai o nome do cliente antes da quantidade/produto
      let clientePartes = semComandaPalavras.slice(0, fimIndiceCliente).filter(w => !['de', 'do', 'da', 'para'].includes(w));
      let clienteNome = clientePartes.length > 0
        ? clientePartes.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        : 'Cliente';

      return {
        action: 'lancamento_produto',
        clienteNome,
        comanda: null,
        mesa: null,
        itens: [
          {
            produtoId: melhorProduto.id,
            nome: melhorProduto.nome,
            quantidade,
            precoVenda: Number(melhorProduto.precoVenda || 0),
            observacao: ''
          }
        ],
        itensNaoEncontrados: [],
        resumo: `Você pediu ${quantidade}x ${melhorProduto.nome} para a comanda de ${clienteNome}. Confirma?`,
        mensagemConfirmacao: `Você pediu ${quantidade} ${melhorProduto.nome} para a comanda de ${clienteNome}. Confirma?`
      };
    }
  }

  // =========================================================================
  // PADRÃO 1: Abertura de Comanda
  // Formato: "[Nome do Funcionário] + [Nome do Cliente]"
  // Ex: "Gabriel, José Carlos" ou "Gabriel José Carlos"
  // =========================================================================
  let garcomEncontrado = null;
  let indiceFimGarcom = -1;

  for (const g of garconsDisponiveis) {
    const gNorm = normalizarTexto(g.nome);
    const gPartes = gNorm.split(/\s+/);
    
    // Verifica se a fala começa com o nome do garçom
    const idx = palavras.findIndex((w, i) => palavrasParecidas(w, gPartes[0]));
    if (idx !== -1) {
      garcomEncontrado = g;
      indiceFimGarcom = idx + gPartes.length;
      break;
    }
  }

  if (garcomEncontrado && indiceFimGarcom < palavras.length) {
    let clientePartes = palavras.slice(indiceFimGarcom).filter(w => !['para', 'o', 'a', 'de', 'cliente', 'comanda'].includes(w));
    if (clientePartes.length > 0) {
      let clienteNome = clientePartes.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

      return {
        action: 'abertura_comanda',
        garcomId: garcomEncontrado.id,
        garcomNome: garcomEncontrado.nome,
        clienteNome,
        comanda: null,
        mesa: null,
        itens: [],
        itensNaoEncontrados: [],
        resumo: `Confirma abertura da comanda para ${clienteNome}, atendido por ${garcomEncontrado.nome}?`,
        mensagemConfirmacao: `Confirma abertura da comanda para ${clienteNome}, atendido por ${garcomEncontrado.nome}?`
      };
    }
  }

  // =========================================================================
  // PADRÃO GERAL / FALLBACK
  // =========================================================================
  let comanda = null;
  const matchComanda = norm.match(/comanda\s*(\d+)/i);
  if (matchComanda) comanda = parseInt(matchComanda[1], 10);

  let mesa = null;
  const matchMesa = norm.match(/mesa\s*(\d+)/i);
  if (matchMesa) mesa = parseInt(matchMesa[1], 10);

  return {
    action: 'indefinido',
    comanda,
    mesa,
    clienteNome: null,
    garcomId: null,
    garcomNome: null,
    itens: [],
    itensNaoEncontrados: [],
    resumo: `Não foi possível identificar o comando completo: "${textoOriginal}". Tente: "Funcionário, Cliente" ou "Comanda Cliente, Qtd Produto".`,
    mensagemConfirmacao: `Comando não compreendido com clareza. Por favor, tente novamente.`
  };
}

/**
 * Processa a fala com suporte aos 2 padrões de fala oficiais
 */
export async function interpretarComandoDeVoz(textoOriginal) {
  if (!textoOriginal || typeof textoOriginal !== 'string' || !textoOriginal.trim()) {
    throw new Error('Texto de voz vazio ou inválido');
  }

  const produtos = await prisma.product.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, precoVenda: true },
    take: 300
  });

  const garcons = await prisma.employee.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, cargo: true }
  });

  // Se não houver chave do Gemini configurada, usa o analisador local
  if (!GEMINI_API_KEY) {
    return parseLocalFallback(textoOriginal, produtos, garcons);
  }

  // Com Gemini API disponível:
  const catalogoResumido = produtos.map(p => `ID:${p.id} | ${p.nome} | R$${p.precoVenda}`).join('\n');
  const garconsLista = garcons.map(g => `ID:${g.id} | ${g.nome}`).join('\n');

  const prompt = `Você é o módulo de reconhecimento de voz do sistema appBarCash.
O funcionário falou o seguinte comando em português:
"${textoOriginal}"

Existem 2 PADRÕES OBRIGATÓRIOS de comunicação:
PADRÃO 1 - ABERTURA DE COMANDA:
Formato: "Nome do Funcionário, Nome do Cliente" (ex: "Gabriel, José Carlos")
O número da comanda NÃO é falado (é gerado automaticamente).
Se for o caso, retorne 'action': "abertura_comanda", com 'garcomId', 'garcomNome', 'clienteNome' e 'mensagemConfirmacao': "Confirma abertura da comanda para [Cliente], atendido por [Garçom]?"

PADRÃO 2 - LANÇAMENTO DE PRODUTO:
Formato: "Comanda [Nome do Cliente], [Quantidade] [Nome do Produto]" (ex: "Comanda José Carlos, uma Antarctica 600 ml")
Se for o caso, retorne 'action': "lancamento_produto", com 'clienteNome', 'itens' (com produtoId, nome, quantidade) e 'mensagemConfirmacao': "Você pediu [Qtd] [Produto] para a comanda de [Cliente]. Confirma?"

LISTA DE PRODUTOS CADASTRADOS:
${catalogoResumido}

LISTA DE FUNCIONÁRIOS CADASTRADOS:
${garconsLista}

Retorne ESTRITAMENTE o JSON:
{
  "action": "abertura_comanda" | "lancamento_produto" | "indefinido",
  "garcomId": 1,
  "garcomNome": "...",
  "clienteNome": "...",
  "comanda": null,
  "itens": [
    { "produtoId": 1, "nome": "...", "quantidade": 1, "precoVenda": 10.0 }
  ],
  "itensNaoEncontrados": [],
  "resumo": "...",
  "mensagemConfirmacao": "..."
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      return parseLocalFallback(textoOriginal, produtos, garcons);
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      return parseLocalFallback(textoOriginal, produtos, garcons);
    }

    return JSON.parse(rawJson);
  } catch (err) {
    return parseLocalFallback(textoOriginal, produtos, garcons);
  }
}
