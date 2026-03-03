import fs from 'fs';

const saleJsContent = fs.readFileSync('/Users/reginaldomiranda/Documents/appBarCash/api/routes/sale.js', 'utf-8');

const toNumMatch = saleJsContent.match(/const toNum = [\s\S]*?;\n/);
let normalizeSaleStr = saleJsContent.substring(saleJsContent.indexOf('const normalizeSale ='));
normalizeSaleStr = normalizeSaleStr.substring(0, normalizeSaleStr.indexOf('};') + 2);

let mapSaleResponseStr = saleJsContent.substring(saleJsContent.indexOf('const mapSaleResponse ='));
mapSaleResponseStr = mapSaleResponseStr.substring(0, mapSaleResponseStr.indexOf('};') + 2);

const code = `
${toNumMatch ? toNumMatch[0] : 'const toNum = (v) => Number(v);'}
${normalizeSaleStr}
${mapSaleResponseStr}

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
`;

fs.writeFileSync('/Users/reginaldomiranda/Documents/appBarCash/api/test_mapping_runner.js', code);
