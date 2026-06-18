const fs = require('fs');

const saleJsContent = fs.readFileSync('/Users/reginaldomiranda/Documents/appBarCash/api/routes/sale.js', 'utf-8');

// Extrair funcoes relevantes
const toNumMatch = saleJsContent.match(/const toNum = \([\s\S]*?;\n/);
const normalizeSaleMatch = saleJsContent.match(/const normalizeSale = \([\s\S]*?;\n\};\n/);
const normalizeSalesMatch = saleJsContent.match(/const normalizeSales = \([\s\S]*?;\n/);
const mapSaleResponseMatch = saleJsContent.match(/const mapSaleResponse = \([\s\S]*?;\n\};\n/);

const code = `
${toNumMatch[0]}
${normalizeSaleMatch[0]}
${normalizeSalesMatch[0]}
${mapSaleResponseMatch[0]}

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

fs.writeFileSync('test_mapping_runner.js', code);
