
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

const mockSale = {
  id: 513,
  status: 'aberta',
  tipoVenda: 'balcao',
  subtotal: 10,
  desconto: 0,
  total: 10,
  nfce: {
    status: 'AUTORIZADA',
    chave: '123'
  }
};

const normalized = normalizeSale(mockSale);
const mapped = mapSaleResponse(normalized);
console.log("Mapped output:");
console.log(JSON.stringify(mapped, null, 2));
