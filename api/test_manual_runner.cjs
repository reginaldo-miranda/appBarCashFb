
const toNum = (v) => Number(v);

const normalizeSale = (venda) => {
  if (!venda) return venda;
  const itensNorm = Array.isArray(venda.itens)
    ? venda.itens.map((item) => ({
        ...item,
        precoUnitario: toNum(item.precoUnitario),
        subtotal: toNum(item.subtotal),
        product: item.product
          ? { ...item.product, precoVenda: toNum(item.product.precoVenda) }
          : item.product,
      }))
    : venda.itens;
  return {
    ...venda,
    subtotal: toNum(venda.subtotal),
    desconto: toNum(venda.desconto),
    total: toNum(venda.total),
    itens: itensNorm,
    caixaVendas: Array.isArray(venda.caixaVendas)
      ? venda.caixaVendas.map(cv => ({ ...cv, valor: toNum(cv.valor) }))
      : venda.caixaVendas,
  };
const mapSaleResponse = (venda) => {
  if (!venda) return venda;
  const base = { ...venda, _id: String(venda.id), id: venda.id };
  // Mapear itens e produto
    const itens = Array.isArray(venda.itens)
    ? venda.itens.map((item) => {
        const { product, ...restItem } = item;
        const produto = product
          ? {
              _id: String(product.id),
              id: product.id,
              nome: product.nome,
              preco: Number(product.precoVenda),
              ncm: product.ncm,
              cfop: product.cfop,
              csosn: product.csosn,
            }
          : undefined;
        return {
          ...restItem,
          _id: String(item.id),
          id: item.id,
          produto,
          nomeProduto: restItem.nomeProduto || (produto ? produto.nome : restItem.nomeProduto),
          precoUnitario: Number(restItem.precoUnitario),
          subtotal: Number(restItem.subtotal),
          origem: String(restItem.origem || 'default'),
          variacao: restItem.variacaoTipo
            ? {
                tipo: restItem.variacaoTipo,
                regraPreco: restItem.variacaoRegraPreco,
                opcoes: Array.isArray(restItem.variacaoOpcoes) ? restItem.variacaoOpcoes : []
              }
            : undefined,
        };
      })
    : venda.itens;
  base.itens = itens;
  // Mapear mesa
  if (venda.mesa) {
    const fr = venda.mesa.funcionarioResponsavel
      ? {
          _id: String(venda.mesa.funcionarioResponsavel.id),
          id: venda.mesa.funcionarioResponsavel.id,
          nome: venda.mesa.funcionarioResponsavel.nome,
        }
      : undefined;
    base.mesa = { ...venda.mesa, _id: String(venda.mesa.id), id: venda.mesa.id, funcionarioResponsavel: fr };
  }
  // Mapear funcionario e cliente
  if (venda.funcionario) {
    base.funcionario = { _id: String(venda.funcionario.id), id: venda.funcionario.id, nome: venda.funcionario.nome };
  }
  if (venda.entregador) {
    base.entregador = { _id: String(venda.entregador.id), id: venda.entregador.id, nome: venda.entregador.nome };
  }
  if (venda.cliente) {
    base.cliente = { 
        _id: String(venda.cliente.id), 
        id: venda.cliente.id, 
        nome: venda.cliente.nome,
        cpf: venda.cliente.cpf,
        endereco: venda.cliente.endereco
    };
  }
  if (venda.caixaVendas) {
    base.caixaVendas = venda.caixaVendas.map(cv => ({
      ...cv,
      valor: Number(cv.valor)
    }));
    base.totalPago = base.caixaVendas.reduce((acc, cv) => acc + cv.valor, 0);
  }
  
  if (venda.nfce) {
    base.nfce = venda.nfce;
  }
  
  return base;
};

const mockSale = {
  id: 1,
  status: 'aberta',
  tipoVenda: 'balcao',
  subtotal: 10,
  desconto: 0,
  total: 10,
  nfce: { status: 'AUTORIZADA', chave: 'abc' },
  itens: []
};
const res1 = normalizeSale(mockSale);
const res2 = mapSaleResponse(res1);
console.log('Final mapping keys:', Object.keys(res2));
console.log('Final mapping nfce:', res2.nfce);
