const fs = require('fs');

const fileContent = fs.readFileSync('/Users/reginaldomiranda/Documents/appBarCash/api/routes/sale.js', 'utf-8');

// Extraction
const toNumCode = fileContent.match(/const toNum = [\s\S]*?;\n/)[0];
let normalizeSaleCode = fileContent.substring(fileContent.indexOf('const normalizeSale ='));
normalizeSaleCode = normalizeSaleCode.substring(0, normalizeSaleCode.indexOf('};') + 2);

let mapSaleResponseCode = fileContent.substring(fileContent.indexOf('const mapSaleResponse ='));
mapSaleResponseCode = mapSaleResponseCode.substring(0, mapSaleResponseCode.indexOf('};\nconst mapSales') + 2);

const code = `
${toNumCode}
${normalizeSaleCode}
${mapSaleResponseCode}

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
`;
fs.writeFileSync('/Users/reginaldomiranda/Documents/appBarCash/api/test_manual_runner.cjs', code);
