const fs = require('fs');
const lines = fs.readFileSync('mobile/app/sale.tsx', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('!p.ncm') || l.includes('missingProducts.push')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
