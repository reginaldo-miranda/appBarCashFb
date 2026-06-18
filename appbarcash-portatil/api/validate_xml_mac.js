const fs = require('fs');
const libxmljs = require('libxmljs');
const path = require('path');

const xmlPath = process.argv[2];
const xmlStr = fs.readFileSync(xmlPath, 'utf8');

// Extrair lote (enviNFe) ou direto NFe
let targetXml = xmlStr;
if (xmlStr.includes('<enviNFe')) {
    const match = xmlStr.match(/<enviNFe[\s\S]*<\/enviNFe>/);
    if(match) targetXml = match[0];
}

const xsdPath = path.join(__dirname, 'schemas', 'PL_009_V4', 'enviNFe_v4.00.xsd');
if(!fs.existsSync(xsdPath)) {
    console.error("XSD nao encontrado em:", xsdPath);
    process.exit(1);
}

const xsdStr = fs.readFileSync(xsdPath, 'utf8');
try {
    const rXSD = xsdStr.replace(/schemaLocation="([^"]+)"/g, (match, p1) => {
        return `schemaLocation="${path.join(__dirname, 'schemas', 'PL_009_V4', p1).replace(/\\/g, '/')}"`;
    });
    // Infelizmente o libxmljs e o import schemaLocation sofre pq ele n resolve local folder. O python lxml consegue:
} catch(e) {}
