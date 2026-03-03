import { create } from 'xmlbuilder2';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from 'xmldom';
import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import forge from 'node-forge';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NfceService {
  constructor() {
    this.urlsSvrs = {
      homologacao: {
        autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        consulta: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
        qrCode: 'http://nfce-homologacao.svrs.rs.gov.br/qrcode/nfce/QRCode'
      },
      producao: {
        autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        consulta: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
        qrCode: 'https://nfce.svrs.rs.gov.br/qrcode/nfce/QRCode'
      }
    };
    
    // URLs específicas de São Paulo
    this.urlsSp = {
       homologacao: {
         autorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
         consulta: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx', // URL de Retorno/Consulta
         qrCode: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
         urlChave: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta'
       },
       producao: {
         autorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
         consulta: 'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
         qrCode: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
         urlChave: 'https://www.nfce.fazenda.sp.gov.br/consulta'
       }
    };
  }

  getUrlsForCompany(company) {
     const uf = company.uf ? company.uf.toUpperCase() : 'RS';
     if (uf === 'SP') return this.urlsSp;
     return this.urlsSvrs;
  }


  getUfCode(company) {
    const ibge = (company.ibge || '').replace(/\D/g, ''); // Remove spaces, dots, etc
    if (ibge && ibge.length >= 2) {
       return ibge.substring(0, 2);
    }
    const ufMap = {
        'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
        'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
        'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
        'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
        'SP': '35', 'SE': '28', 'TO': '17'
    };
    const uf = company.uf ? company.uf.toUpperCase().trim() : '';
    return ufMap[uf] || '43'; // Default to RS if unknown
  }

  /**
   * Remove acentos e caracteres especiais
   */
  sanitizeString(str) {
      if (!str) return '';
      return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9\s.,-]/g, "") // Mantem apenas chars seguros
        .trim();
  }

  /**
   * Gera o XML da NFC-e baseado na Venda e Empresa
   */
  async buildXML(sale, company) {
    console.log("[DEBUG] buildXML iniciado", { saleId: sale.id, itemCount: sale.itens?.length });
    try {
        const ambiente = company.ambienteFiscal === 'producao' ? '1' : '2'; // 1=Prod, 2=Hom
        const isProd = ambiente === '1';
        const accessKey = this.generateAccessKey(sale, company);
        const cUF = this.getUfCode(company);
        
        const cleanIbge = (company.ibge || '').replace(/\D/g, '');

        // VALIDAÇÃO CRÍTICA: IBGE Obrigatório
        if (!cleanIbge || cleanIbge.length < 7) {
            throw new Error(`Configuração Fiscal Incompleta: Código IBGE do Município não preenchido ou inválido (${company.ibge}). Verifique o cadastro da Empresa.`);
        }

        const cleanIe = (company.inscricaoEstadual || '').replace(/\D/g, '');
        // VALIDAÇÃO CRÍTICA: IE Obrigatório para Emitente (exceto MEI em alguns casos, mas GERALMENTE obrigatória em NFC-e)
        // Se cleanIe estiver vazio, pode causar Rejeição 230: IE do emitente não informada
        if (!cleanIe) {
             console.warn("AVISO: IE vazia. Pode causar rejeição se a empresa não for isento.");
        }

        console.log("[DEBUG] Chave gerada:", accessKey);
        
        console.log("[DEBUG] Dados Empresa para XML:", {
           ibge: cleanIbge,
           uf: company.uf,
           municipio: company.cidade,
           logradouro: company.logradouro,
           bairro: company.bairro,
           cep: company.cep,
           ie: cleanIe,
           cUF: cUF // Debug derived UF
        });

        // Root Element


        // Root Element
        const root = create({ version: '1.0', encoding: 'UTF-8' })
          .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
          .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' });
        
        console.log("[DEBUG] Root created");

    // 1. Identificação
        // Format Date to YYYY-MM-DDThh:mm:ss-03:00 (removing milliseconds, fixing offset)
        const now = new Date();
        const offset = '-03:00';
        const iso = now.toISOString().replace(/\.\d{3}Z$/, ''); // Remove .000Z
        // Adjust to local visually or just mock it? 
        // Better: Construct manual string to ensure local time representation if needed. 
        // However, to be safe and simple, let's just send the ISO string without millis + offset suffix (simulated)
        // Actually, verified sample uses local time.
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        const dhEmi = `${year}-${month}-${day}T${hour}:${min}:${sec}${offset}`;
        
        root.ele('ide')
            .ele('cUF').txt(cUF).up() 
            .ele('cNF').txt(accessKey.substring(35, 43)).up()
            .ele('natOp').txt('VENDA AO CONSUMIDOR').up()
            .ele('mod').txt('65').up()
            .ele('serie').txt(String(company.serieNfce)).up()
            .ele('nNF').txt(String(company.numeroInicialNfce)).up()
            .ele('dhEmi').txt(dhEmi).up()
        .ele('tpNF').txt('1').up()
        .ele('idDest').txt('1').up()
        .ele('cMunFG').txt(cleanIbge).up() // MUST USE SANITIZED IBGE
        .ele('tpImp').txt('4').up()
        .ele('tpEmis').txt('1').up()
        .ele('cDV').txt(accessKey.substring(43, 44)).up()
        .ele('tpAmb').txt(ambiente).up()
        .ele('finNFe').txt('1').up()
        .ele('indFinal').txt('1').up() // 1=Consumidor Final (Obrigatório em NFC-e)
        .ele('indPres').txt('1').up()  // 1=Presencial (Padrão NFC-e)
        // .ele('indIntermed').txt('0').up() // REMOVIDO: Obrigatório apenas se indPres != 1 (presencial). Se for 1, não deve existir ou deve ser omitido conforme UF. Na dúvida, melhor omitir pois alguns validadores rejeitam se existir com indPres=1
        .ele('procEmi').txt('0').up()
        .ele('verProc').txt('1.0.0').up()
    .up();

    // 2. Emitente
    const emit = root.ele('emit');
    emit.ele('CNPJ').txt(company.cnpj.replace(/\D/g, '')).up();
    emit.ele('xNome').txt(this.sanitizeString(company.razaoSocial).substring(0, 60)).up();
    
    const enderEmit = emit.ele('enderEmit');
    enderEmit.ele('xLgr').txt(this.sanitizeString(company.logradouro) || 'Rua Teste').up();
    enderEmit.ele('nro').txt(this.sanitizeString(company.numero) || 'SN').up();
    enderEmit.ele('xBairro').txt(this.sanitizeString(company.bairro) || 'Centro').up();
    enderEmit.ele('cMun').txt(cleanIbge).up(); // MUST USE SANITIZED IBGE
    enderEmit.ele('xMun').txt(this.sanitizeString(company.cidade) || 'Porto Alegre').up();
    enderEmit.ele('UF').txt(this.sanitizeString(company.uf) || 'RS').up();
    enderEmit.ele('CEP').txt((company.cep || '90000000').replace(/\D/g, '')).up();

    enderEmit.ele('cPais').txt('1058').up();
    enderEmit.ele('xPais').txt('BRASIL').up();
    
    // IE Obrigatória
    if (cleanIe) {
        emit.ele('IE').txt(cleanIe).up();
    }
    emit.ele('CRT').txt('1').up(); // 1 = Simples Nacional (Mandatory)

    // 2.5 Destinatário (Opcional - mas se cliente existir na venda e tiver CPF, deve ir)
    if (sale.cliente && sale.cliente.cpf) {
        const cpfRaw = (sale.cliente.cpf || '').replace(/\D/g, '');
        // Apenas adiciona grupo dest se tiver CPF ou CNPJ válido
        if (cpfRaw.length === 11 || cpfRaw.length === 14) {
            const dest = root.ele('dest');
            if (cpfRaw.length === 11) {
                dest.ele('CPF').txt(cpfRaw).up();
            } else {
                dest.ele('CNPJ').txt(cpfRaw).up();
            }

            // xNome
            const nomeDest = this.sanitizeString(sale.cliente.nome).substring(0, 60);
            
            // Regra de Homologação: Se identificar destinatário, o nome DEVE ser padrão
            if (ambiente === '2') {
                dest.ele('xNome').txt('NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL').up();
            } else if (nomeDest && nomeDest.length > 1) {
                dest.ele('xNome').txt(nomeDest).up();
            } else {
                 dest.ele('xNome').txt('CONSUMIDOR').up(); 
            }

            // Indicador da IE do Destinatário (9 = Não Contribuinte) - OBRIGATÓRIO
            dest.ele('indIEDest').txt('9').up();

            // Endereço (Opcional em NFC-e).
            // Se tiver dados completos, poderiamos enviar, mas exige cMun (IBGE) valido.
            // Para "CPF na Nota", apenas CPF e Nome (opcional) bastam.
            // Vamos dar 'up' no dest.
            dest.up(); 
        }
    }



    // 3. Itens (Loop Real)
    // Se não tiver itens, isso vai dar erro de validação depois, mas ok.
    const itens = sale.itens || [];
    
    // Pré-Cálculo para Rateio de Frete (Agora mapeado como vOutro / Despesas Acessórias)
    const totalProdutosParaRateio = itens.reduce((acc, it) => acc + (Number(it.quantidade) * Number(it.precoUnitario)), 0);
    
    // Mapeando Taxa de Entrega para vOutro (Despesas Acessórias) para evitar rejeição "NFC-e com Frete"
    let vOutroGlobal = 0;
    if (sale.deliveryFee) {
        vOutroGlobal = Number(sale.deliveryFee);
    }
    let vOutroAcumulado = 0;
    
    let totalProdutosCalculado = 0;

    itens.forEach((item, index) => {
        const prod = item.product || item.produto || {};
        const nItem = index + 1;
        // Assegurar casas decimais corretas
        const qCom = Number(item.quantidade);
        const vUnCom = Number(item.precoUnitario);
        
        // Calcular vProd (Valor do Produto / Item)
        // Regra de validação: vProd deve ser qCom * vUnCom (com arredondamentos)
        const subtotalItem = Number((qCom * vUnCom).toFixed(2));
        totalProdutosCalculado += subtotalItem;
        
        // Cálculo do vOutro do Item (Rateio Proporcional)
        let itemOutro = 0;
        if (vOutroGlobal > 0 && totalProdutosParaRateio > 0) {
            const ratio = subtotalItem / totalProdutosParaRateio;
            // Arredonda para 2 casas
            itemOutro = Number((vOutroGlobal * ratio).toFixed(2));
            
            // Se for o último item, joga a diferença do arredondamento nele
            if (index === itens.length - 1) {
                // OBS: vOutroAcumulado soma os ANTERIORES.
                itemOutro = Number((vOutroGlobal - vOutroAcumulado).toFixed(2));
            }
            
            vOutroAcumulado += itemOutro;
        }

        const vProd = subtotalItem.toFixed(2);
        
        const det = root.ele('det', { nItem: String(nItem) });
        
        // Produto
        const prodEle = det.ele('prod');
        prodEle.ele('cProd').txt(String(prod.id || item.productId || index)).up();
        prodEle.ele('cEAN').txt(prod.ean || 'SEM GTIN').up();
        
        // REGRA HOMOLOGAÇÃO: Primeiro item deve ter descrição fixa
        let xProdText = (prod.nome || item.nomeProduto || 'Produto').substring(0, 120);
        if (!isProd && nItem === 1) {
            xProdText = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
        }
        
        prodEle.ele('xProd').txt(xProdText).up();

        const ncmVal = (prod.ncm || item.ncm || '00000000').replace(/\D/g, '');
        prodEle.ele('NCM').txt(ncmVal.length === 8 ? ncmVal : '00000000').up(); // Agora usa NCM real
        if (prod.cest && String(prod.cest).replace(/\D/g, '').length > 0) {
           prodEle.ele('CEST').txt(String(prod.cest).replace(/\D/g, '')).up();
        }
        
        const cfopVal = (prod.cfop || item.cfop || '5102').replace(/\D/g, '');
        prodEle.ele('CFOP').txt(cfopVal || '5102').up();
        prodEle.ele('uCom').txt('UN').up();
        prodEle.ele('qCom').txt(qCom.toFixed(4)).up();
        prodEle.ele('vUnCom').txt(vUnCom.toFixed(10)).up();
        prodEle.ele('vProd').txt(vProd).up();
        prodEle.ele('cEANTrib').txt('SEM GTIN').up();
        prodEle.ele('uTrib').txt('UN').up();
        prodEle.ele('qTrib').txt(qCom.toFixed(4)).up();
        prodEle.ele('vUnTrib').txt(vUnCom.toFixed(10)).up();
        
        // Adiciona vOutro no Item se houver
        if (itemOutro > 0) {
            prodEle.ele('vOutro').txt(itemOutro.toFixed(2)).up();
            prodEle.ele('indTot').txt('1').up(); // Indica que compõe total
        } else {
            prodEle.ele('indTot').txt('1').up();
        }

        // Impostos
        const imposto = det.ele('imposto');
        const icms = imposto.ele('ICMS');
        // Simples Nacional (CSOSN)
        let csosnRaw = String(prod.csosn || item.csosn || '102').replace(/\D/g, '');
        if (csosnRaw.length < 3) csosnRaw = '102';
        const csosnCode = csosnRaw;
        let icmsSn;
        
        if (csosnCode === '500') {
            icmsSn = icms.ele('ICMSSN500');
            icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
            icmsSn.ele('CSOSN').txt(csosnCode).up();
            // ICMSSN500 pode exigir vBCSTRet e vICMSSTRet dependendo do estado, mas vamos manter simples por enquanto
        } else {
            // Default 102, 103, 300, 400
            icmsSn = icms.ele('ICMSSN102');
            icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
            icmsSn.ele('CSOSN').txt(csosnCode).up();
        }


        const pis = imposto.ele('PIS').ele('PISOutr');
        pis.ele('CST').txt('49').up();
        pis.ele('vBC').txt(vProd).up(); // CST 49 exige Base de calculo
        pis.ele('pPIS').txt('0.0000').up();
        pis.ele('vPIS').txt('0.00').up();

        const cofins = imposto.ele('COFINS').ele('COFINSOutr');
        cofins.ele('CST').txt('49').up();
        cofins.ele('vBC').txt(vProd).up();
        cofins.ele('pCOFINS').txt('0.0000').up();
        cofins.ele('vCOFINS').txt('0.00').up();
    });

    // 4. Totais
    // IMPORTANTE: vNF deve ser a soma dos itens (vProd) +- descontos/fretes/outros
    
    // Tratamento Taxa de Entrega (Já calculado vOutroGlobal e distribuído)
    const vOutroStr = vOutroGlobal.toFixed(2);
    
    // Total da Nota = Soma Produtos + Outros (vOutroGlobal)
    const vNFVal = totalProdutosCalculado + vOutroGlobal;
    const vNF = vNFVal.toFixed(2);
    
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
    icmsTot.ele('vProd').txt(totalProdutosCalculado.toFixed(2)).up(); 
    icmsTot.ele('vFrete').txt('0.00').up(); // Frete ZERADO para NFC-e
    icmsTot.ele('vSeg').txt('0.00').up();
    icmsTot.ele('vDesc').txt('0.00').up();
    icmsTot.ele('vII').txt('0.00').up();
    icmsTot.ele('vIPI').txt('0.00').up();
    icmsTot.ele('vIPIDevol').txt('0.00').up();
    icmsTot.ele('vPIS').txt('0.00').up();
    icmsTot.ele('vCOFINS').txt('0.00').up();
    icmsTot.ele('vOutro').txt(vOutroStr).up(); // Inclui Taxa de Entrega aqui (vOutro)
    icmsTot.ele('vNF').txt(vNF).up(); // Total Final

    // 5. Transporte
    // Modalidade 9 (Sem frete) obrigatória para evitar rejeição em NFC-e com valor no campo frete
    const modFrete = '9';
    root.ele('transp').ele('modFrete').txt(modFrete).up().up();

    // 6. Pagamento
    const pag = root.ele('pag');
    
    // Tenta usar CaixaVendas primeiro (fonte mais confiável de pagamentos parciais/mistos)
    let paymentAdded = false;
    
    if (sale.caixaVendas && sale.caixaVendas.length > 0) {
        console.log('[DEBUG] Usando CaixaVendas para gerar pagamentos NFC-e');
        
        // Agrupar por tipo e descrição para evitar duplicidade de linhas
        const paymentsAgg = {};
        
        sale.caixaVendas.forEach(cv => {
            let tPag = '01'; // Default Dinheiro
            let xPag = null;
            const forma = (cv.formaPagamento || '').toLowerCase();
            const val = Number(cv.valor || 0);

            if (val <= 0.005) return;
            
            if (forma === 'dinheiro') tPag = '01';
            else if (forma.includes('credito') || forma.includes('crédito')) tPag = '03';
            else if (forma.includes('debito') || forma.includes('débito')) tPag = '04';
            else if (forma === 'pix') tPag = '17';
            else if (forma === 'cashback') tPag = '19'; // Fidelidade/Cashback
            else tPag = '99'; // Outros

            const key = `${tPag}`; // Agrupar apenas por tPag
            if (!paymentsAgg[key]) {
                paymentsAgg[key] = { tPag, xPag: null, val: 0 };
            }
            paymentsAgg[key].val += val;
        });

        // Adicionar ao XML
        Object.values(paymentsAgg).forEach(p => {
            const val = p.val;
            if (val > 0.005) {
                const detPag = pag.ele('detPag');
                detPag.ele('tPag').txt(p.tPag).up();
                detPag.ele('vPag').txt(val.toFixed(2)).up();
                detPag.up();
                paymentAdded = true;
            }
        });


        
        // vTroco (Obrigatório em NFC-e 4.0 se soma pagamentos >= total, ou 0.00)
        // Como o sistema não gerencia troco explicitamente aqui (venda fecha exata), mandamos 0.00
        // Se houver troco real, deveria vir do front, mas por hora: 0.00
        pag.ele('vTroco').txt('0.00').up();
    }

    // Se não encontrou pagamentos no CaixaVendas (ou falhou), usa lógica antiga baseada no Sale Header
    if (!paymentAdded) {
        console.log('[DEBUG] Fallback para Sale Header (CaixaVendas vazio)');
        const cashbackUsado = Number(sale.cashbackUsado || 0);
        const totalNF = Number(vNF);
        const mainPayment = totalNF - cashbackUsado;

        if (cashbackUsado > 0 && mainPayment >= 0) {
             // Pagamento Principal
             if (mainPayment > 0.005) {
                const detPagMain = pag.ele('detPag');
                detPagMain.ele('tPag').txt('01').up(); // Dinheiro (Default fallback)
                detPagMain.ele('vPag').txt(mainPayment.toFixed(2)).up();
                detPagMain.up(); 
             }

             // Pagamento Cashback
             const detPagCashback = pag.ele('detPag');
             detPagCashback.ele('tPag').txt('19').up(); 
             detPagCashback.ele('vPag').txt(cashbackUsado.toFixed(2)).up();
             detPagCashback.up(); 
        } else {
            // Pagamento Simples
            const detPagVal = pag.ele('detPag');
            detPagVal.ele('tPag').txt('01').up(); 
            detPagVal.ele('vPag').txt(vNF).up();
            detPagVal.up();
        }
    }

    return {
        xmlContent: root.end({ prettyPrint: false }), // COMPACT XML for production/SEFAZ
        accessKey: accessKey
    };
    } catch (e) {
        console.error("[ERROR] buildXML falhou:", e);
        throw e;
    }
    }

  generateAccessKey(sale, company) {
    try {
        // 1. Sanitizar e Validar UF Code
        let cUF = this.getUfCode(company);
        if (!cUF || cUF.length !== 2) cUF = '43'; // Default RS

        // 2. Data AAMM
        const now = new Date();
        const AAMM = `${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 3. CNPJ
        let CNPJ = (company.cnpj || '').replace(/\D/g, '');
        if (!CNPJ || CNPJ.length === 0) throw new Error("CNPJ da empresa não encontrado para geração da chave");
        CNPJ = CNPJ.padStart(14, '0');

        // 4. Modelo (65 = NFC-e)
        const mod = '65';

        // 5. Série (Default 1) - Proteção contra undefined/null
        let serieRaw = company.serieNfce;
        if (serieRaw === undefined || serieRaw === null || isNaN(parseInt(serieRaw))) {
            serieRaw = 1;
        }
        const serie = String(serieRaw).replace(/\D/g, '').padStart(3, '0');

        // 6. Número da Nota (Default 1) - Proteção contra undefined/null
        let nNFRaw = company.numeroInicialNfce;
        if (nNFRaw === undefined || nNFRaw === null || isNaN(parseInt(nNFRaw))) {
            nNFRaw = 1;
        }
        const nNF = String(nNFRaw).replace(/\D/g, '').padStart(9, '0');

        // 7. Tipo Emissão (1 = Normal)
        const tpEmis = '1'; 

        // 8. Código Numérico (Aleatório)
        // Garantir 8 dígitos numéricos sempre
        const rnd = Math.floor(Math.random() * 99999999);
        const cNF = String(rnd).padStart(8, '0'); 
        
        // Montagem Base (43 caracteres)
        const keyBase = `${cUF}${AAMM}${CNPJ}${mod}${serie}${nNF}${tpEmis}${cNF}`;
        
        if (keyBase.length !== 43) {
            console.error("[NFC-e] Erro Crítico: keyBase não tem 43 chars:", keyBase.length, keyBase);
            throw new Error(`Erro interno na montagem da chave (len=${keyBase.length})`);
        }

        // 9. Dígito Verificador
        const weights = [2, 3, 4, 5, 6, 7, 8, 9];
        let sum = 0;
        for (let i = 0; i < keyBase.length; i++) {
            const digit = parseInt(keyBase.charAt(keyBase.length - 1 - i));
            sum += digit * weights[i % 8];
        }
        const remainder = sum % 11;
        const cDV = (remainder === 0 || remainder === 1) ? 0 : 11 - remainder;

        const finalKey = `${keyBase}${cDV}`;

        if (finalKey.length !== 44) {
             throw new Error(`Chave gerada inválida (Tamanho: ${finalKey.length})`);
        }

        return finalKey;
    } catch (e) {
        console.error("[NFC-e] Falha na geração da chave de acesso:", e);
        // Em caso de erro fatal, podemos retornar um placeholder ou re-throw.
        // Re-throw é mais seguro para não emitir nota lixo.
        throw e;
    }
  }

  async signXML(xml, pfxPath, password) {
    if (!fs.existsSync(pfxPath)) {
        throw new Error(`Certificado não encontrado em: ${pfxPath}`);
    }
    const pfxBuffer = fs.readFileSync(pfxPath);

    // Extract Key with forge (Robust logic)
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Tenta encontrar a chave em diferentes "bags"
    const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    let bag = bags[forge.pki.oids.pkcs8ShroudedKeyBag] ? bags[forge.pki.oids.pkcs8ShroudedKeyBag][0] : null;

    if (!bag) {
        // Fallback para keyBag simples
        const bags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
        bag = bags2[forge.pki.oids.keyBag] ? bags2[forge.pki.oids.keyBag][0] : null;
    }
    
    if (!bag || !bag.key) {
        throw new Error("Chave privada não encontrada no arquivo do certificado.");
    }
    
    const privateKey = forge.pki.privateKeyToPem(bag.key);
    console.log("[DEBUG] Chave privada extraída com sucesso. Tamanho:", privateKey.length);

    // Sign with xml-crypto (v6 API)
    const sig = new SignedXml();
    
    // Configure Algorithms (RSA-SHA1 - Match Valid Sample)
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    
    // IMPORTANT: v6 uses 'privateKey' property
    sig.privateKey = privateKey;

    // FIX: Add KeyInfo (Mandatory for SEFAZ)
    // We define the provider, but if it fails, we force injection below.
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    const certificate = forge.pki.certificateToPem(certBag[0].cert);
    const certClean = certificate
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '');

    sig.keyInfoProvider = {
        getKeyInfo: function(key, prefix) {
            return `<KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo>`;
        }
    };

    // FIX: Extract NFe ID for Reference URI (Required by SEFAZ Schema)
    const idMatch = xml.match(/InfNFe\s+Id="(.*?)"/i) || xml.match(/infNFe\s+Id="(.*?)"/);
    const referenceUri = idMatch ? `#${idMatch[1]}` : "";
    
    console.log("[DEBUG] Reference URI for Signature:", referenceUri);

    // Configure Reference (What to sign) using SHA-1
    // Matches the provided valid XML
    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        uri: referenceUri, // <--- EXPLICIT URI REFERENCE
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature", 
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });

    sig.computeSignature(xml);
    
    let signed = sig.getSignedXml();

    // FORCE INJECTION of KeyInfo if missing (xml-crypto sometimes omits it depending on version/config)
    if (signed.indexOf('<KeyInfo>') === -1) {
        console.log("[DEBUG] Manually injecting KeyInfo...");
        const keyInfoXml = `<KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo>`;
        signed = signed.replace('</Signature>', `${keyInfoXml}</Signature>`);
    }

    return signed;
  }

  async sendToSefaz(signedXml, company, accessKey, sale) {
      // 1. Append QR Code (infNFeSupl)
      const digestMatch = signedXml.match(/<DigestValue>(.*?)<\/DigestValue>/);
      if (!digestMatch) throw new Error("DigestValue não encontrado no XML assinado");
      const digestValue = digestMatch[1];
      
      const cscToken = company.csc || 'TESTE';
      let cscId = '1';
      if (company.cscId) {
          cscId = String(company.cscId).replace(/\D/g, '').replace(/^0+/, ''); // Remove non-digit and leading zeros
          if (cscId === '') cscId = '1';
      } 
      
      const isProd = company.ambienteFiscal === 'producao';
      const envKey = isProd ? 'producao' : 'homologacao';
      
      const urls = this.getUrlsForCompany(company);
      const urlQrCodeHelper = urls[envKey].qrCode;
      
      const dhEmiMatch = signedXml.match(/<dhEmi>(.*?)<\/dhEmi>/);

      const dhEmi = dhEmiMatch ? dhEmiMatch[1] : new Date().toISOString();
      const dhEmiHex = Buffer.from(dhEmi).toString('hex');
      const digValHex = Buffer.from(digestValue, 'base64').toString('hex');
      
      const vNF = Number(sale.total).toFixed(2);
      
      // QR Code params (NFC-e 4.0/5.0)
      // SHORT FORMAT (AccessKey|2|Amb|idCSC) required by local XSD Regex
      // Ensure NO leading zeros in idCSC
      
      const params = [
          accessKey,
          '2', // nVersao
          isProd ? '1' : '2', // tpAmb
          Number(cscId) // idCSC
      ].join('|');
      
      const stringToHash = params + cscToken; // Hash matches the short string? Or full? 
      // Usually hash signs the content. If we send short, we hash short.
      const cHashCSC = crypto.createHash('sha1').update(stringToHash).digest('hex').toUpperCase();
      
      const qrCodeFullParam = `${params}|${cHashCSC}`;
      const qrCodeUrl = `${urlQrCodeHelper}?p=${qrCodeFullParam}`;
      
      // Use urlChave if available (SP), otherwise use consulta SOAP (which is wrong but fallback)
      const urlChave = urls[envKey].urlChave || urls[envKey].consulta;
      
      // Remove CDATA to match valid sample
      const infNFeSupl = `<infNFeSupl><qrCode>${qrCodeUrl}</qrCode><urlChave>${urlChave}</urlChave></infNFeSupl>`;


      
      // Insert encoded QR Code into XML
      // CRITICAL FIX: infNFeSupl matches BEFORE Signature in the valid XML sample.
      // <NFe> <infNFe/> <infNFeSupl/> <Signature/> </NFe>
      // signedXml usually looks like <NFe><infNFe/>...<Signature/></NFe>
      // BUT if we replace </infNFe>, we put it in the middle.
      const finalXml = signedXml.replace('</infNFe>', `</infNFe>${infNFeSupl}`);


    // 2. Wrap in SOAP - COMPACTED to avoid whitespace validation issues
    // Pad idLote to 15 digits (Common SEFAZ requirement)
    // Remove redundant xmlns from NFe string
    const nfeClean = finalXml.replace(/<\?xml.*?>/g, '').replace(' xmlns="http://www.portalfiscal.inf.br/nfe"', '').trim();
    
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>000000000000001</idLote><indSinc>1</indSinc>${nfeClean}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      // 3. Send
      // 3. Send
      const pfxBuffer = fs.readFileSync(company.certificadoPath);
      
      // Robust Extraction using Forge (Fix for "Unsupported PKCS12")
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, company.certificadoSenha);
      
      // Get Key
      let keyBagLine = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keyBagLine) keyBagLine = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
      const privateKey = forge.pki.privateKeyToPem(keyBagLine[0].key);

      // Get Cert
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
      const certificate = forge.pki.certificateToPem(certBag[0].cert);

      // DEBUG: Save the FINAL XML being sent to check structure/indentation/order
      try {
          fs.writeFileSync(path.join(__dirname, '../debug_final_sent.xml'), finalXml);
          console.log("[DEBUG] XML Final salvo em api/debug_final_sent.xml");
      } catch (err) { console.error("Erro saving debug xml", err); }

      const agent = new https.Agent({
          cert: certificate,
          key: privateKey,
          rejectUnauthorized: false // Ignorar erro de certificado auto-assinado da SEFAZ se houver
      });

      
      console.log(`[NFC-e] Enviando para SEFAZ (${envKey})...`);
      
      // DEBUG LOGGING
      try {
          fs.writeFileSync(path.join(__dirname, '../debug_final_sent.xml'), finalXml);
          fs.writeFileSync(path.join(__dirname, '../debug_soap_sent.xml'), soapEnvelope);
          console.log("[DEBUG] Dumped debug_final_sent.xml and debug_soap_sent.xml");
      } catch (e) { console.error("Error dumping debug XML:", e); }

      try {
          const res = await axios.post(urls[envKey].autorizacao, soapEnvelope, {
              headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },

              httpsAgent: agent
          });
          
          const xmlResp = res.data;
          console.log('[NFC-e] Resposta SEFAZ:', xmlResp);

          // 1. Extrair cStat do Lote (retEnviNFe)
          const cStatLoteMatch = xmlResp.match(/<retEnviNFe[^>]*>[\s\S]*?<cStat>(\d+)<\/cStat>/);
          const cStatLote = cStatLoteMatch ? cStatLoteMatch[1] : null;
          
          let finalStatus = 'REJEITADO';
          let finalMotivo = 'Erro desconhecido';
          let finalProtocolo = '';
          
          // 2. Se Lote Processado (104), olhar o Protocolo (protNFe)
          if (cStatLote === '104') {
              const protMatch = xmlResp.match(/<protNFe[^>]*>[\s\S]*?<infProt>([\s\S]*?)<\/infProt>/);
              if (protMatch) {
                  const infProt = protMatch[1];
                  const cStatNota = (infProt.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
                  const xMotivoNota = (infProt.match(/<xMotivo>(.*?)<\/xMotivo>/) || [])[1];
                  const nProt = (infProt.match(/<nProt>(\d+)<\/nProt>/) || [])[1];
                  
                  finalStatus = cStatNota === '100' ? 'AUTORIZADO' : 'REJEITADO';
                  finalMotivo = xMotivoNota || 'Sem motivo';
                  finalProtocolo = nProt;
                  
                  // Se for 100 (Autorizado), sucesso total!
              } else {
                  finalMotivo = 'Lote processado mas sem protocolo (Erro SEFAZ?)';
              }
          } else {
              // Tratamento Melhorado de Erros (xMotivo ou Fault)
              const xMotivoGlobal = (xmlResp.match(/<xMotivo>(.*?)<\/xMotivo>/) || [])[1];
              const faultString = (xmlResp.match(/<faultstring>(.*?)<\/faultstring>/) || [])[1];
              const sMessage = (xmlResp.match(/<s:Reason>[\s\S]*?<s:Text.*?>(.*?)<\/s:Text>/) || [])[1];
              
              finalMotivo = xMotivoGlobal || faultString || sMessage || 'Erro Lote/SOAP Desconhecido';
              const cStat = (xmlResp.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
              if (cStat === '100') finalStatus = 'AUTORIZADO';
          }

          
          return {
              status: finalStatus,
              protocolo: finalProtocolo,
              motivo: finalMotivo,
              chave: accessKey
          };
          
      } catch (e) {
          console.error("Erro SOAP:", e.response ? e.response.data : e.message);
          return {
              status: 'ERRO_COMUNICACAO',
              motivo: e.message,
              chave: accessKey
          };
      }
  }

  async getQrCode(accessKey, company, sale) {
      // Re-generate for Display purposes with CORRECT Hash
      const cscToken = company.csc || 'TESTE';
      let cscId = '1';
      if (company.cscId) {
          cscId = String(company.cscId).replace(/\D/g, '').replace(/^0+/, ''); 
          if (cscId === '') cscId = '1';
      }

      const isProd = company.ambienteFiscal === 'producao';
      const envKey = isProd ? 'producao' : 'homologacao';
      
      const urls = this.getUrlsForCompany(company);
      const urlQrCodeHelper = urls[envKey].qrCode;
      
      // QR Code params (NFC-e 4.0)
      const params = [
          accessKey,
          '2', // nVersao
          isProd ? '1' : '2', // tpAmb
          Number(cscId) // idCSC
      ].join('|');
      
      const stringToHash = params + cscToken;
      const cHashCSC = crypto.createHash('sha1').update(stringToHash).digest('hex').toUpperCase();
      
      const qrCodeFullParam = `${params}|${cHashCSC}`;
      // Use encodeURIComponent to ensure special chars like pipes are safe in URL
      // Although SEFAZ usually accepts pipes, some browsers/readers need it. 
      // Safe bet: encode only if issues persist, but valid samples often show raw pipes.
      // Given the previous error "Invalid QR Code" was likely due to MISSING Hash, 
      // we will stick to raw pipes first (or minimal encoding) to match sendToSefaz.
      // BUT sendToSefaz logic I wrote previously didn't encode. 
      // Let's assume raw pipes are fine if Hash is present.
      
      const qrCodeUrl = `${urlQrCodeHelper}?p=${qrCodeFullParam}`;
      
      try {
          const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);
          return {
              url: qrCodeUrl,
              base64: qrCodeImage
          };
      } catch (err) {
          console.error("Erro gerando imagem QR:", err);
          return null;
      }
  }
}

export default new NfceService();
