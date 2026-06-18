
import { create } from 'xmlbuilder2';

// MOCK HELPER
function generateAccessKey(sale, company) {
    const cUF = company.ibge ? company.ibge.substring(0, 2) : '43'; // 43 = RS
    const now = new Date();
    const AAMM = `${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const CNPJ = company.cnpj.replace(/\D/g, '').padStart(14, '0');
    const mod = '65';
    const serie = String(company.serieNfce).padStart(3, '0');
    const nNF = String(company.numeroInicialNfce).padStart(9, '0');
    const tpEmis = '1'; 
    const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0'); 
    
    const keyBase = `${cUF}${AAMM}${CNPJ}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let sum = 0;
    for (let i = 0; i < keyBase.length; i++) {
        const digit = parseInt(keyBase.charAt(keyBase.length - 1 - i));
        sum += digit * weights[i % 8];
    }
    const remainder = sum % 11;
    const cDV = (remainder === 0 || remainder === 1) ? 0 : 11 - remainder;

    return `${keyBase}${cDV}`;
}

// COPIED LOGIC FROM NfceService.js
async function buildXML(sale, company) {
    const ambiente = company.ambienteFiscal === 'producao' ? '1' : '2'; // 1=Prod, 2=Hom
    const accessKey = generateAccessKey(sale, company);

    // Root Element
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
      .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' });

    // 1. Identificação
    root.ele('ide')
        .ele('cUF').txt(company.ibge ? company.ibge.substring(0, 2) : '43').up() // 43 = RS
        .ele('cNF').txt(accessKey.substring(35, 43)).up()
        .ele('natOp').txt('VENDA AO CONSUMIDOR').up()
        .ele('mod').txt('65').up()
        .ele('serie').txt(String(company.serieNfce)).up()
        .ele('nNF').txt(String(company.numeroInicialNfce)).up()
        .ele('dhEmi').txt(new Date().toISOString()).up()
        .ele('tpNF').txt('1').up()
        .ele('idDest').txt('1').up()
        .ele('cMunFG').txt(company.ibge || '4314902').up()
        .ele('tpImp').txt('4').up()
        .ele('tpEmis').txt('1').up()
        .ele('cDV').txt(accessKey.substring(43, 44)).up()
        .ele('tpAmb').txt(ambiente).up()
        .ele('finNFe').txt('1').up()
        .ele('indFinal').txt('1').up()
        .ele('indPres').txt('1').up()
        .ele('procEmi').txt('0').up()
        .ele('verProc').txt('1.0.0').up()
    .up();

    // 2. Emitente
    const emit = root.ele('emit');
    emit.ele('CNPJ').txt(company.cnpj.replace(/\D/g, '')).up();
    emit.ele('xNome').txt(company.razaoSocial.substring(0, 60)).up();
    
    const enderEmit = emit.ele('enderEmit');
    enderEmit.ele('xLgr').txt(company.endereco || 'Rua Teste').up();
    enderEmit.ele('nro').txt('123').up();
    enderEmit.ele('xBairro').txt('Centro').up();
    enderEmit.ele('cMun').txt(company.ibge || '4314902').up();
    enderEmit.ele('xMun').txt('Porto Alegre').up();
    enderEmit.ele('UF').txt('RS').up();
    enderEmit.ele('CEP').txt('90000000').up(); // TODO: Adicionar CEP na empresa
    enderEmit.ele('cPais').txt('1058').up();
    enderEmit.ele('xPais').txt('BRASIL').up();
    
    emit.ele('IE').txt(company.ie || '').up();

    // 3. Itens (Loop Real)
    // Se não tiver itens, isso vai dar erro de validação depois, mas ok.
    const itens = sale.itens || [];
    itens.forEach((item, index) => {
        const prod = item.product || {};
        const nItem = index + 1;
        // Assegurar casas decimais corretas
        const qCom = Number(item.quantidade).toFixed(4);
        const vUnCom = Number(item.precoUnitario).toFixed(10);
        const vProd = Number(item.subtotal || (item.quantidade * item.precoUnitario)).toFixed(2);
        
        const det = root.ele('det', { nItem: String(nItem) });
        
        // Produto
        const prodEle = det.ele('prod');
        prodEle.ele('cProd').txt(String(prod.id || item.productId || index)).up();
        prodEle.ele('cEAN').txt(prod.ean || 'SEM GTIN').up();
        prodEle.ele('xProd').txt((prod.nome || item.nomeProduto || 'Produto').substring(0, 120)).up();
        prodEle.ele('NCM').txt(prod.ncm || '00000000').up(); // Agora usa NCM real
        prodEle.ele('CFOP').txt(prod.cfop || '5102').up();
        prodEle.ele('uCom').txt('UN').up();
        prodEle.ele('qCom').txt(qCom).up();
        prodEle.ele('vUnCom').txt(vUnCom).up();
        prodEle.ele('vProd').txt(vProd).up();
        prodEle.ele('cEANTrib').txt('SEM GTIN').up();
        prodEle.ele('uTrib').txt('UN').up();
        prodEle.ele('qTrib').txt(qCom).up();
        prodEle.ele('vUnTrib').txt(vUnCom).up();
        prodEle.ele('indTot').txt('1').up();

        // Impostos
        const imposto = det.ele('imposto');
        const icms = imposto.ele('ICMS');
        // Simples Nacional (CSOSN)
        const icmsSn = icms.ele('ICMSSN102');
        icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
        icmsSn.ele('CSOSN').txt(String(prod.csosn || '102')).up();

        const pis = imposto.ele('PIS').ele('PISOutr');
        pis.ele('CST').txt('99').up();
        pis.ele('vBC').txt('0.00').up();
        pis.ele('pPIS').txt('0.00').up();
        pis.ele('vPIS').txt('0.00').up();

        const cofins = imposto.ele('COFINS').ele('COFINSOutr');
        cofins.ele('CST').txt('99').up();
        cofins.ele('vBC').txt('0.00').up();
        cofins.ele('pCOFINS').txt('0.00').up();
        cofins.ele('vCOFINS').txt('0.00').up();
    });

    // 4. Totais
    const vNF = Number(sale.total).toFixed(2);
    const total = root.ele('total');
    const icmsTot = total.ele('ICMSTot');
    icmsTot.ele('vBC').txt('0.00').up();
    icmsTot.ele('vICMS').txt('0.00').up();
    icmsTot.ele('vICMSDeson').txt('0.00').up();
    icmsTot.ele('vFCP').txt('0.00').up();
    icmsTot.ele('vBCST').txt('0.00').up();
    icmsTot.ele('vST').txt('0.00').up();
    icmsTot.ele('vFCPST').txt('0.00').up();
    icmsTot.ele('vFCPSTRet').txt('0.00').up();
    icmsTot.ele('vProd').txt(vNF).up();
    icmsTot.ele('vFrete').txt('0.00').up();
    icmsTot.ele('vSeg').txt('0.00').up();
    icmsTot.ele('vDesc').txt('0.00').up();
    icmsTot.ele('vII').txt('0.00').up();
    icmsTot.ele('vIPI').txt('0.00').up();
    icmsTot.ele('vIPIDevol').txt('0.00').up();
    icmsTot.ele('vPIS').txt('0.00').up();
    icmsTot.ele('vCOFINS').txt('0.00').up();
    icmsTot.ele('vOutro').txt('0.00').up();
    icmsTot.ele('vNF').txt(vNF).up();

    // 5. Transporte
    root.ele('transp').ele('modFrete').txt('9').up().up();

    // 6. Pagamento
    const pag = root.ele('pag');
    const detPag = pag.ele('detPag');
    detPag.ele('tPag').txt('01').up(); // Dinheiro (Default)
    detPag.ele('vPag').txt(vNF).up();

    return {
        xmlContent: root.end({ prettyPrint: true }),
        accessKey: accessKey
    };
}

// TEST DATA
const mockCompany = {
    cnpj: '12345678000199',
    razaoSocial: 'EMPRESA TESTE LTDA',
    endereco: 'RUA TESTE',
    ibge: '4314902',
    ie: '123123123',
    serieNfce: 1,
    numeroInicialNfce: 100,
    ambienteFiscal: 'homologacao'
};

const mockSale = {
    total: 100.00,
    itens: [
        {
            quantidade: 2,
            precoUnitario: 50.00,
            subtotal: 100.00,
            productId: 10,
            product: {
                id: 10,
                nome: 'PRODUTO TESTE',
                ean: '789123456',
                ncm: '', // Test empty NCM
                origem: '0',
                csosn: '102'
            }
        }
    ]
};

console.log("Iniciando teste de geração XML...");
buildXML(mockSale, mockCompany)
    .then(res => {
        console.log("✅ XML Gerado com sucesso!");
        console.log("Chave:", res.accessKey);
        // console.log(res.xmlContent);
    })
    .catch(err => {
        console.error("❌ ERRO GRAVE:", err);
    });
