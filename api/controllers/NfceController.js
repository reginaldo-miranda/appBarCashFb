import NfceService from '../services/NfceService.js';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';

import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



import { logDebug } from '../debug_logger.js';

// ...

export const emitirNfce = async (req, res) => {
    logDebug(`[Controller] emitirNfce. Body: ${JSON.stringify(req.body)}`);
    try {
        const { saleId, itemsOverlay } = req.body;
        if (!saleId) {
            return res.status(400).json({ error: 'Sale ID is required' });
        }

        const sale = await prisma.sale.findUnique({
             where: { id: parseInt(saleId) },
             include: {
                 itens: { include: { product: true } },
                 nfce: true,
                 cliente: true,
                 caixaVendas: true
             }
        });

        if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });

        // Aplica o overlay de itens se existir (garante NCMs atualizados mesmo se o banco estiver dessincronizado)
        if (itemsOverlay && Array.isArray(itemsOverlay) && itemsOverlay.length > 0) {
             sale.itens = sale.itens.map(dbItem => {
                 const overlayItem = itemsOverlay.find(oi => String(oi._id || oi.id) === String(dbItem.id));
                 const overlayProduct = overlayItem ? (overlayItem.product || overlayItem.produto) : null;
                 if (overlayItem && overlayProduct) {
                      dbItem.product = {
                          ...(dbItem.product || {}),
                          ncm: overlayProduct.ncm || (dbItem.product?.ncm || ''),
                          cfop: overlayProduct.cfop || (dbItem.product?.cfop || ''),
                          csosn: overlayProduct.csosn || (dbItem.product?.csosn || '')
                      };
                 }
                 return dbItem;
             });
        }

        logDebug(`[EmitirNfce] Sale ID: ${saleId}`);
        logDebug(`[EmitirNfce] Cashback Usado: ${sale?.cashbackUsado}`);
        logDebug(`[EmitirNfce] Delivery Fee: ${sale?.deliveryFee}`);
        logDebug(`[EmitirNfce] Total Venda: ${sale?.total}`);
        logDebug(`[EmitirNfce] Subtotal: ${sale?.subtotal}`);
        let company = await prisma.company.findFirst();
        if (!company || !company.cnpj) {
             return res.status(400).json({ error: 'Configuração fiscal incompleta (CNPJ não encontrado)' });
        }

        let attempts = 0;
        const maxAttempts = 100; // Aumentado para lidar com grandes desincronias de numeração
        let lastError = null;
        let lastResult = null;
        let lastSignedXml = null; // GUARDA o XML da tentativa vencedora
        let success = false;

        // Loop de Tentativas (Auto-Retry em caso de Duplicidade)
        while (attempts < maxAttempts && !success) {
            attempts++;
            console.log(`[NFC-e] Tentativa de emissão ${attempts}/${maxAttempts} - Sequência: ${company.numeroInicialNfce}`);

            try {
                // 1. Gerar XML
                const { xmlContent, accessKey } = await NfceService.buildXML(sale, company);

                // 2. Assinar
                const signedXml = await NfceService.signXML(xmlContent, company.certificadoPath, company.certificadoSenha);

                // 3. Enviar para SEFAZ
                const sefazResult = await NfceService.sendToSefaz(signedXml, company, accessKey, sale);
                lastResult = sefazResult;

                // Análise do Resultado
                if (sefazResult.status === 'AUTORIZADO') {
                    lastSignedXml = signedXml; // SALVA o XML da tentativa que foi AUTORIZADA
                    success = true; // Sai do loop com sucesso
                } else {
                    // Verifica se é erro de Duplicidade (204 ou 539)
                    const isDuplicity = (sefazResult.motivo && sefazResult.motivo.includes('Duplicidade')) ||
                                        (sefazResult.motivo && (sefazResult.motivo.includes('204') || sefazResult.motivo.includes('539')));

                    if (isDuplicity) {
                        console.warn(`[NFC-e] Duplicidade detectada na seq ${company.numeroInicialNfce} (Tentativa ${attempts}/${maxAttempts}). Buscando próximo número...`);
                        
                        // Incrementa no Banco
                        await prisma.company.update({
                            where: { id: company.id },
                            data: { numeroInicialNfce: { increment: 1 } }
                        });

                        // Atualiza objeto local da empresa para próxima iteração
                        company = await prisma.company.findFirst();
                        
                        lastError = sefazResult; // Guarda erro caso esgote tentativas
                        // Loop continua...
                    } else {
                        // Outro erro (Rejeição definitiva, erro de validação, etc)
                        console.error(`[NFC-e] Erro definitivo na tentativa ${attempts}: ${sefazResult.motivo}`);
                        lastError = sefazResult;
                        break; // Sai do loop
                    }
                }

            } catch (innerError) {
                console.error(`[NFC-e] Exceção na tentativa ${attempts}:`, innerError);
                lastError = { status: 'ERRO_INTERNO', motivo: innerError.message || 'Erro interno desconhecido' };
                break; 
            }
        } // Fim do While

        // Processar Resultado Final
        if (success && lastResult) {
            // SUCESSO
            const sefazResult = lastResult;
            
             // 4. Gerar QR Code (Recuperar ou Gerar)
            const qrCodeResult = await NfceService.getQrCode(sefazResult.chave, company, sale); // company agora tem num atualizado

            // 4.1 Salvar XML em arquivo físico
            let xmlDir;
            let finalXmlPath;

            if (company.xmlFolder && company.xmlFolder.trim() !== '') {
                const now = new Date();
                const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                const subfolder = `${months[now.getMonth()]}${now.getFullYear()}`;
                
                xmlDir = path.join(company.xmlFolder, subfolder);
                
                if (!fs.existsSync(xmlDir)) {
                    try {
                        fs.mkdirSync(xmlDir, { recursive: true });
                    } catch (e) {
                        console.error(`[ERROR] Falha ao criar diretório configurado ${xmlDir}:`, e);
                        xmlDir = path.join(__dirname, '../../xml_nfce');
                    }
                }
            } else {
                xmlDir = path.join(__dirname, '../../xml_nfce');
            }

            if (!fs.existsSync(xmlDir)) {
                fs.mkdirSync(xmlDir, { recursive: true });
            }
            
            // Recriar XML Assinado Final se necessário (na verdade já temos ele da ultima tentativa bem sucedida,
            // mas precisariamos ter guardado o 'signedXml' daquela iteração.
            // Para simplificar, vamos regerar ou assumir que o ultimo foi o sucesso.
            // MELHORIA: Guardar signedXml dentro do loop quando sucesso.
            
            // CORREÇÃO: Usar o XML já assinado da tentativa vencedora (NÃO rebuildar — evita novo cNF aleatório
            // que causaria Rejeição 202: "Campo Id não corresponde à concatenação dos campos correspondentes")
            const signedXmlFinal = lastSignedXml;
            
            const xmlFilename = `${sefazResult.chave}.xml`;
            finalXmlPath = path.join(xmlDir, xmlFilename);
            
            try {
                fs.writeFileSync(finalXmlPath, signedXmlFinal);
                console.log(`[SUCCESS] XML salvo em: ${finalXmlPath}`);
            } catch (err) {
                console.error('[ERROR] Erro ao salvar arquivo XML:', err);
            }

            // 5. Salvar na Venda (Upsert Nfce)
            const nfceData = {
                chave: sefazResult.chave,
                protocolo: sefazResult.protocolo || '',
                xml: signedXmlFinal, 
                qrCode: qrCodeResult ? qrCodeResult.url : null,
                status: 'AUTORIZADA',
                ambiente: company.ambienteFiscal,
                motivo: sefazResult.motivo,
                numero: company.numeroInicialNfce, // Número que deu certo
                serie: company.serieNfce,
                urlConsulta: qrCodeResult ? qrCodeResult.url : null
            };

            let savedNfce;
            if (sale.nfce) {
                savedNfce = await prisma.nfce.update({
                    where: { id: sale.nfce.id },
                    data: nfceData
                });
            } else {
                 savedNfce = await prisma.nfce.create({
                    data: {
                        ...nfceData,
                        saleId: sale.id
                    }
                });
            }

            // Increment NEXT number (Prepara o próximo)
            // IMPORTANTE: Como já incrementamos DURANTE as tentativas falhas para tentar o 'atual',
            // agora precisamos incrementar MAIS UM para deixar pronto para a PRÓXIMA venda.
            // Se a tentativa 1 (seq 100) deu certo -> incrementa para 101.
            // Se a tentativa 1 (seq 100) falhou, inc p/ 101, tentou 101 e deu certo -> inc p/ 102.
            await prisma.company.update({
                where: { id: company.id },
                data: { numeroInicialNfce: { increment: 1 } }
            });

            const fullResponse = {
                success: true,
                status: savedNfce.status,
                message: 'NFC-e emitida com sucesso',
                nfce: savedNfce,
                qrCode: qrCodeResult ? {
                    url: qrCodeResult.url,
                    base64: qrCodeResult.base64
                } : null,
                pdfUrl: `${req.protocol}://${req.get('host')}/api/nfce/${sale.id}/pdf`,
                urlConsulta: savedNfce.urlConsulta,
                xmlDebugPath: finalXmlPath
            };

            return res.json(fullResponse);

        } else {
            // FALHA APÓS TODAS TENTATIVAS OU ERRO IRRECUPERÁVEL
            const failure = lastError || { motivo: 'Erro desconhecido ao emitir' };
            
            // Tenta salvar o registro de rejeição se tiver chave (mesmo que duplicada)
            // Se foi duplicidade, provavelmente já existe uma nota com esse numero (de outra venda ou orfã).
            // A venda ATUAL continua sem nota autorizada.
            
            // Se o erro foi rejeição na SEFAZ, create/update registro NFC-e vinculado à venda com status REJEITADA
            if (lastResult && lastResult.chave) {
                 const nfceRejeitada = {
                    chave: lastResult.chave,
                    protocolo: lastResult.protocolo || '',
                    xml: '', // Não temos o XML final assinado aqui fácil sem rebuild, deixa vazio por enqto
                    status: failure.status === 'ERRO_COMUNICACAO' ? 'ERRO' : 'REJEITADA',
                    ambiente: company.ambienteFiscal,
                    motivo: failure.motivo || 'Rejeitada',
                    numero: company.numeroInicialNfce,
                    serie: company.serieNfce
                };
                
                 if (sale.nfce) {
                    await prisma.nfce.update({ where: { id: sale.nfce.id }, data: nfceRejeitada });
                } else {
                    await prisma.nfce.create({ data: { ...nfceRejeitada, saleId: sale.id } });
                }
            }
            
            return res.status(400).json({
                success: false,
                status: failure.status || 'REJEITADA',
                error: (failure.status === 'ERRO_COMUNICACAO' ? 'Falha de Comunicação: ' : 'Rejeição: ') + failure.motivo,
                message: failure.motivo || 'Nota rejeitada pela SEFAZ após tentativas.',
                nfce: failure
             });
        }

    } catch (error) {
        console.error("Erro Fatal no Controller emitir NFC-e:", error);
        return res.status(500).json({ error: 'Erro interno na emissão: ' + (error.message || error) });
    }
};

export const getDetails = async (req, res) => {
  // TODO implement
  res.json({ todo: true });
};

export const generatePdf = async (req, res) => {
    try {
        const { saleId } = req.params;
        const sale = await prisma.sale.findUnique({
             where: { id: parseInt(saleId) },
             include: { 
                 itens: { include: { product: true } }, 
                 nfce: true,
                 caixaVendas: true
             }
        });




        if (!sale) return res.status(404).send('Venda não encontrada');
        
        // Buscar dados da empresa globalmente se nao estiver na venda
        const company = await prisma.company.findFirst();

        // Regenerar imagem do QR Code
        let qrCodeImg = '';
        if (sale.nfce?.qrCode) {
            try {
                qrCodeImg = await QRCode.toDataURL(sale.nfce.qrCode);
            } catch (err) {
                console.error("Erro regenerando QR PDF:", err);
            }
        }

        // Recalcular total baseado nos itens + deliveryFee
        const totalItens = sale.itens.reduce((acc, item) => {
            return acc + (Number(item.subtotal) || (Number(item.quantidade) * Number(item.precoUnitario)));
        }, 0);
        
        const fee = Number(sale.deliveryFee || 0);
        const discount = Number(sale.desconto || 0);
        const totalVendaCalculada = totalItens + fee - discount;
        
        // Usar SEMPRE o total calculado para garantir que a impressão bata com a soma dos itens listados + taxas
        // Isso corrige casos onde sale.total no banco pode estar desatualizado ou inconsistente (ex: só com a taxa)
        const totalFinal = totalVendaCalculada;

        console.log("[DEBUG] Generate PDF - ID:", saleId);
        console.log("[DEBUG] Fee:", fee);
        console.log("[DEBUG] Discount:", discount);
        console.log("[DEBUG] TotalFinal:", totalFinal);
        console.log("[DEBUG] CashbackUsado (DB):", sale.cashbackUsado);

        const isContingencia = sale.nfce?.tpEmis === 9;
        const html = `
            <html>
            <head>
                <title>NFC-e ${saleId}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; color: #000; width: 300px; margin: auto; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    .divider { border-top: 1px dashed #000; margin: 10px 0; }
                    .contingencia-box { border: 2px solid #000; background: #fff; padding: 8px; margin: 8px 0; text-align: center; }
                    .contingencia-titulo { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
                    .contingencia-info { font-size: 11px; margin-top: 4px; }
                </style>
            </head>
            <body>
                <div class="center bold">${company?.razaoSocial || 'EMPRESA DEMO'}</div>
                <div class="center">CNPJ: ${company?.cnpj || ''}</div>
                <div class="center">${company?.endereco || 'Endereço não cadastrado'}</div>
                
                <div class="divider"></div>
                <div class="center bold">DANFE NFC-e - Documento Auxiliar</div>
                <div class="center">Nota Fiscal de Consumidor Eletrônica</div>
                <div class="center">Não permite aproveitamento de crédito de ICMS</div>
                
                ${isContingencia ? `
                <div class="divider"></div>
                <div class="contingencia-box">
                    <div class="contingencia-titulo">*** EMITIDA EM CONTINGENCIA ***</div>
                    <div class="contingencia-titulo">*** OFFLINE - SEM COMUNICACAO SEFAZ ***</div>
                    <div class="contingencia-info">
                        Inicio Contingencia: ${sale.nfce?.dhCont ? new Date(sale.nfce.dhCont).toLocaleString('pt-BR') : 'N/D'}
                    </div>
                    <div class="contingencia-info" style="word-break:break-word;">
                        Motivo: ${sale.nfce?.xJust || 'Falha de comunicacao com a SEFAZ'}
                    </div>
                    <div class="contingencia-info">
                        <strong>Pendente de transmissao a SEFAZ</strong>
                    </div>
                </div>
                ` : ''}
                
                <div class="divider"></div>
                
                ${sale.itens.map(item => `
                    <div class="row">
                        <span>${item.quantidade}x ${item.product?.nome || item.nomeProduto}</span>
                        <span>R$ ${Number(item.subtotal || (item.quantidade * item.precoUnitario)).toFixed(2)}</span>
                    </div>
                `).join('')}

                ${fee > 0 ? `
                    <div class="row">
                        <span>Taxa de Entrega / Desp.</span>
                        <span>R$ ${fee.toFixed(2)}</span>
                    </div>
                ` : ''}
                
                <div class="divider"></div>
                <div class="row bold">
                    <span>Qtd. Total de Itens</span>
                    <span>${sale.itens.length}</span>
                </div>
                <div class="row bold" style="font-size: 14px">
                    <span>Valor Total R$</span>
                    <span>${totalFinal.toFixed(2)}</span>
                </div>
                <div class="row">
                    <span>Forma de Pagamento</span>
                </div>
                ${(() => {
                    let htmlPag = '';
                    let paymentFound = false;

                    // 1. Tentar usar CaixaVendas (Fonte da verdade)
                    if (sale.caixaVendas && sale.caixaVendas.length > 0) {
                         const paymentsByType = {};
                         sale.caixaVendas.forEach(cv => {
                             const forma = (cv.formaPagamento || 'outros').toLowerCase();
                             const val = Number(cv.valor || 0);
                             if (val > 0) {
                                 paymentsByType[forma] = (paymentsByType[forma] || 0) + val;
                             }
                         });

                         const methodMap = {
                            'dinheiro': 'Dinheiro',
                            'cartao': 'Cartão',
                            'credito': 'Cartão Crédito',
                            'debito': 'Cartão Débito',
                            'pix': 'PIX',
                            'cashback': 'Cashback / Fidelidade'
                         };

                         Object.keys(paymentsByType).forEach(tipo => {
                            let label = methodMap[tipo];
                            if (!label) {
                                if (tipo.includes('credito')) label = 'Cartão Crédito';
                                else if (tipo.includes('debito')) label = 'Cartão Débito';
                                else label = 'Outros';
                            }
                            
                            htmlPag += `
                            <div class="row">
                                <span>${label}</span>
                                <span>${paymentsByType[tipo].toFixed(2)}</span>
                            </div>`;
                         });
                         paymentFound = true;
                    }

                    // 2. Fallback para Colunas da Venda (Se CaixaVendas vazio)
                    if (!paymentFound) {
                        const cashback = Number(sale.cashbackUsado || 0);
                        const total = totalFinal;
                        const mainPayment = total - cashback;
                        
                        if (cashback > 0) {
                            htmlPag += `
                            <div class="row">
                                <span>Cashback / Fidelidade</span>
                                <span>${cashback.toFixed(2)}</span>
                            </div>`;
                        }
                        
                        if (mainPayment > 0.005) {
                             const methodMap = {
                                'dinheiro': 'Dinheiro',
                                'cartao': 'Cartão',
                                'pix': 'PIX',
                                'cashback': 'Cashback'
                             };
                             const methodName = methodMap[sale.formaPagamento] || 'Outros';
                             
                             htmlPag += `
                            <div class="row">
                                <span>${methodName}</span>
                                <span>${mainPayment.toFixed(2)}</span>
                            </div>`;
                        }
                    }
                    
                    return htmlPag;
                })()}
                
                <div class="divider"></div>
                <div class="row bold">
                    <span>Valor Pago R$</span>
                    <span>${totalFinal.toFixed(2)}</span>
                </div>

                <div class="divider"></div>
                <div class="center"><strong>Consulte pela Chave de Acesso em:</strong></div>
                <div class="center" style="word-break: break-all; font-size: 10px; margin: 5px 0;">${sale.nfce?.chave || 'CHAVE NÃO GERADA'}</div>
                
                <div class="divider"></div>
                
                <div class="center">
                    CONSUMIDOR ${sale.clienteId ? 'IDENTIFICADO' : 'NÃO IDENTIFICADO'}
                </div>
                <div class="center">
                    Via Consumidor
                </div>
                <div class="center" style="margin-top: 20px">
                    Protocolo de Autorização: ${sale.nfce?.protocolo || 'N/A'}<br>
                    Data de Autorização: ${new Date().toLocaleString()}
                </div>
                
                ${qrCodeImg ? `
                    <div class="center" style="margin-top: 20px;">
                        <img src="${qrCodeImg}" width="150" height="150" />
                    </div>
                ` : ''}
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar impressão: ' + e.message);
    }
};

export const sendPdfEmail = async (req, res) => {
    try {
        const { saleId } = req.params;
        const { emailTo } = req.body;

        if (!emailTo) {
            return res.status(400).json({ ok: false, message: 'E-mail de destino é obrigatório.' });
        }

        // Puxar config de SMTP
        const getConfigValue = async (key) => {
            const setting = await prisma.appSetting.findUnique({ where: { key } });
            return setting ? setting.value : '';
        };

        const host = await getConfigValue('smtp_host');
        const port = await getConfigValue('smtp_port');
        const user = await getConfigValue('smtp_user');
        const pass = await getConfigValue('smtp_password');
        const sender = await getConfigValue('smtp_sender');

        if (!host || !user || !pass) {
            return res.status(400).json({ ok: false, message: 'Configuração SMTP incompleta. Acesse as Configurações de E-mail antes.', emailError: true });
        }

        // Gerar o PDF nativamente aqui usando o Puppeteer
        const pdfUrl = `${req.protocol}://${req.get('host')}/api/nfce/${saleId}/pdf`;
        
        console.log("[BACKEND-PDF] Iniciando criação de PDF virtual na url:", pdfUrl);

        let pdfBuffer;
        try {
            const browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            // Desabilita o alert/print que tá solto no html gerado na outra rota (window.print)
            await page.evaluateOnNewDocument(() => {
                window.print = () => {};
            });
            await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
            pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            await browser.close();
            console.log("[BACKEND-PDF] PDF gerado com sucesso.");
        } catch (pupErr) {
            console.error("[BACKEND-PDF] Erro ao gerar com Puppeteer:", pupErr);
            throw new Error("Não foi possível gerar o arquivo PDF nativo.");
        }

        const transporter = nodemailer.createTransport({
            host,
            port: Number(port),
            secure: Number(port) === 465,
            auth: { user, pass }
        });

        await transporter.sendMail({
            from: `"${sender}" <${user}>`,
            to: emailTo,
            subject: `Cupom Fiscal NFC-e - Pedido #${saleId}`,
            text: `Olá!\n\nSegue em anexo o Cupom Fiscal NFC-e referente à sua compra.\n\nObrigado por comprar conosco!`,
            attachments: [
                {
                    filename: `Cupom_Fiscal_NFCe_${saleId}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        res.json({ ok: true, message: 'Cupom gerado e enviado para o e-mail com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar PDF por e-mail:', error);
        res.status(500).json({ ok: false, message: 'Erro ao enviar e-mail: ' + error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE CONTINGÊNCIA OFFLINE (novas — não alteram nada acima)
// ═══════════════════════════════════════════════════════════════

/**
 * Ativar modo de contingência offline
 * POST /api/nfce/contingencia/ativar
 * Body: { xJust: string (mínimo 15 chars) }
 */
export const ativarContingencia = async (req, res) => {
    try {
        const { xJust } = req.body;
        if (!xJust || xJust.trim().length < 15) {
            return res.status(400).json({ ok: false, message: 'Justificativa obrigatória (mínimo 15 caracteres).' });
        }
        const dhCont = new Date().toISOString();
        await prisma.appSetting.upsert({
            where: { key: 'contingencia_ativa' },
            update: { value: 'true' },
            create: { key: 'contingencia_ativa', value: 'true' }
        });
        await prisma.appSetting.upsert({
            where: { key: 'contingencia_dhCont' },
            update: { value: dhCont },
            create: { key: 'contingencia_dhCont', value: dhCont }
        });
        await prisma.appSetting.upsert({
            where: { key: 'contingencia_xJust' },
            update: { value: xJust.trim() },
            create: { key: 'contingencia_xJust', value: xJust.trim() }
        });
        return res.json({ ok: true, message: 'Modo de contingência ativado.', dhCont, xJust: xJust.trim() });
    } catch (e) {
        console.error('[Contingência] Erro ao ativar:', e);
        return res.status(500).json({ ok: false, message: e.message });
    }
};

/**
 * Desativar modo de contingência offline e disparar job de retransmissão
 * POST /api/nfce/contingencia/desativar
 */
export const desativarContingencia = async (req, res) => {
    try {
        await prisma.appSetting.upsert({
            where: { key: 'contingencia_ativa' },
            update: { value: 'false' },
            create: { key: 'contingencia_ativa', value: 'false' }
        });
        // Dispara job imediatamente em background (não aguarda)
        import('../services/ContingenciaJobService.js')
            .then(({ executarJobAgora }) => executarJobAgora())
            .catch(e => console.error('[Contingência] Erro ao executar job após desativação:', e));

        return res.json({ ok: true, message: 'Modo de contingência desativado. Retransmissão iniciada.' });
    } catch (e) {
        console.error('[Contingência] Erro ao desativar:', e);
        return res.status(500).json({ ok: false, message: e.message });
    }
};

/**
 * Listar NFC-es em contingência
 * GET /api/nfce/contingencia/lista
 */
export const listarContingencias = async (req, res) => {
    try {
        const nfces = await prisma.nfce.findMany({
            where: {
                status: { in: ['CONTINGENCIA', 'CONTINGENCIA_REJEITADA', 'CONTINGENCIA_EXPIRADA', 'INUTILIZADA'] }
            },
            include: {
                sale: {
                    select: {
                        id: true,
                        total: true,
                        dataVenda: true,
                        tipoVenda: true,
                        cliente: { select: { nome: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Buscar status do modo contingência
        const setting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_ativa' } });
        const dhContSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_dhCont' } });
        const xJustSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_xJust' } });

        const modoAtivo = setting && setting.value === 'true';

        return res.json({
            ok: true,
            modoAtivo,
            dhCont: dhContSetting?.value || null,
            xJust: xJustSetting?.value || null,
            total: nfces.length,
            pendentes: nfces.filter(n => n.status === 'CONTINGENCIA').length,
            rejeitadas: nfces.filter(n => n.status === 'CONTINGENCIA_REJEITADA').length,
            expiradas: nfces.filter(n => n.status === 'CONTINGENCIA_EXPIRADA').length,
            nfces
        });
    } catch (e) {
        console.error('[Contingência] Erro ao listar:', e);
        return res.status(500).json({ ok: false, message: e.message });
    }
};

/**
 * Emitir NFC-e em modo de contingência offline (sem enviar ao SEFAZ)
 * POST /api/nfce/contingencia/emitir
 * Body: { saleId, itemsOverlay? }
 */
export const emitirNfceContingencia = async (req, res) => {
    try {
        const { saleId, itemsOverlay } = req.body;
        if (!saleId) return res.status(400).json({ ok: false, error: 'saleId obrigatório' });

        const sale = await prisma.sale.findUnique({
            where: { id: parseInt(saleId) },
            include: { itens: { include: { product: true } }, nfce: true, cliente: true, caixaVendas: true }
        });
        if (!sale) return res.status(404).json({ ok: false, error: 'Venda não encontrada' });

        // Aplica overlay de itens se existir
        if (itemsOverlay && Array.isArray(itemsOverlay) && itemsOverlay.length > 0) {
            sale.itens = sale.itens.map(dbItem => {
                const overlayItem = itemsOverlay.find(oi => String(oi._id || oi.id) === String(dbItem.id));
                const overlayProduct = overlayItem ? (overlayItem.product || overlayItem.produto) : null;
                if (overlayItem && overlayProduct) {
                    dbItem.product = {
                        ...(dbItem.product || {}),
                        ncm: overlayProduct.ncm || (dbItem.product?.ncm || ''),
                        cfop: overlayProduct.cfop || (dbItem.product?.cfop || ''),
                        csosn: overlayProduct.csosn || (dbItem.product?.csosn || '')
                    };
                }
                return dbItem;
            });
        }

        let company = await prisma.company.findFirst();
        if (!company || !company.cnpj) {
            return res.status(400).json({ ok: false, error: 'Configuração fiscal incompleta (CNPJ não encontrado)' });
        }

        // Buscar dados de contingência
        const dhContSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_dhCont' } });
        const xJustSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_xJust' } });
        const dhCont = dhContSetting?.value ? new Date(dhContSetting.value) : new Date();
        const xJust = xJustSetting?.value || 'Falha de comunicacao com a SEFAZ';

        // Gerar XML de contingência (tpEmis=9)
        const { xmlContent, accessKey } = await NfceService.buildXMLContingencia(sale, company, dhCont, xJust);

        // Assinar XML localmente
        const signedXml = await NfceService.signXML(xmlContent, company.certificadoPath, company.certificadoSenha);

        // Gerar QR Code offline (com CSC)
        const qrCodeResult = await NfceService.getQrCodeContingencia(accessKey, company);

        // Calcular prazo limite (24h após início da contingência)
        const prazoLimite = new Date(dhCont.getTime() + 24 * 60 * 60 * 1000);

        // Salvar no banco com status CONTINGENCIA
        const nfceData = {
            chave: accessKey,
            xml: signedXml,
            protocolo: '',
            motivo: 'Emitida em contingência offline',
            status: 'CONTINGENCIA',
            ambiente: company.ambienteFiscal,
            numero: company.numeroInicialNfce,
            serie: company.serieNfce,
            qrCode: qrCodeResult?.url || null,
            urlConsulta: null,
            tpEmis: 9,
            dhCont,
            xJust,
            prazoLimite,
            tentativas: 0
        };

        let savedNfce;
        if (sale.nfce) {
            savedNfce = await prisma.nfce.update({ where: { id: sale.nfce.id }, data: nfceData });
        } else {
            savedNfce = await prisma.nfce.create({ data: { ...nfceData, saleId: sale.id } });
        }

        // Incrementa número da NFC-e para a próxima emissão
        await prisma.company.update({
            where: { id: company.id },
            data: { numeroInicialNfce: { increment: 1 } }
        });

        return res.json({
            ok: true,
            status: 'CONTINGENCIA',
            message: 'NFC-e emitida em CONTINGÊNCIA. Será transmitida ao SEFAZ quando a conexão for restabelecida.',
            prazoLimite: prazoLimite.toISOString(),
            nfce: savedNfce,
            qrCode: qrCodeResult ? { url: qrCodeResult.url, base64: qrCodeResult.base64 } : null,
            pdfUrl: `${req.protocol}://${req.get('host')}/api/nfce/${sale.id}/pdf`
        });
    } catch (e) {
        console.error('[Contingência] Erro ao emitir:', e);
        return res.status(500).json({ ok: false, error: 'Erro na emissão em contingência: ' + (e.message || e) });
    }
};

/**
 * Retentar transmissão manual de uma NFC-e de contingência
 * POST /api/nfce/contingencia/:nfceId/retentar
 *
 * CORREÇÃO: Antes de enviar, verifica se a chave de acesso tem tpEmis=9 (posição 34).
 * Se não tiver (bug de versão anterior), regenera o XML + reassina com a chave correta.
 * Isso corrige o erro: "Erro na Chave de Acesso - Campo Id não corresponde à concatenação
 * dos campos correspondentes" (Rejeição 202/560 da SEFAZ).
 */
export const retentarContingencia = async (req, res) => {
    try {
        const { nfceId } = req.params;
        const nfce = await prisma.nfce.findUnique({ where: { id: parseInt(nfceId) } });
        if (!nfce) return res.status(404).json({ ok: false, message: 'NFC-e não encontrada.' });
        if (!['CONTINGENCIA', 'CONTINGENCIA_REJEITADA'].includes(nfce.status)) {
            return res.status(400).json({ ok: false, message: `NFC-e com status "${nfce.status}" não pode ser retentada.` });
        }

        const company = await prisma.company.findFirst();
        if (!company || !company.certificadoPath) {
            return res.status(400).json({ ok: false, message: 'Certificado não configurado.' });
        }

        const novasTentativas = (nfce.tentativas || 0) + 1;
        await prisma.nfce.update({
            where: { id: nfce.id },
            data: { tentativas: novasTentativas, ultimaTentativa: new Date(), status: 'CONTINGENCIA' }
        });

        // ─── CORREÇÃO: Verificar e regenerar XML com chave correta (tpEmis=9) ─────
        // A chave de acesso NFC-e tem 44 dígitos:
        // ─── CORREÇÃO: SEMPRE regenerar XML para aplicar novos campos de Schema (indIntermed/QR Code 2.0) ─────
        let xmlParaEnviar;
        let chaveParaEnviar;
        let saleOriginal;

        try {
            // Buscar venda original com todos os dados
            saleOriginal = await prisma.sale.findUnique({
                where: { id: nfce.saleId },
                include: { itens: { include: { product: true } }, cliente: true, caixaVendas: true }
            });
            if (!saleOriginal) throw new Error('Venda original não encontrada para regenerar XML.');

            // Usar o número e série ORIGINAIS salvos na NFC-e
            const companyParaGerar = {
                ...company,
                numeroInicialNfce: nfce.numero || company.numeroInicialNfce,
                serieNfce: nfce.serie || company.serieNfce
            };

            // Usar dhCont e xJust originais salvos na NFC-e
            let dhCont = nfce.dhCont || new Date();
            let xJust = nfce.xJust || 'Falha de comunicacao com a SEFAZ';

            // Regenerar XML de contingência garantindo o novo layout 4.00 (inclui indIntermed e QR v2.0)
            const { xmlContent: xmlNovo, accessKey: chaveNova } = await NfceService.buildXMLContingencia(
                saleOriginal, companyParaGerar, dhCont, xJust
            );

            // Reassinar 
            const signedXmlNovo = await NfceService.signXML(xmlNovo, company.certificadoPath, company.certificadoSenha);

            // Atualizar banco (preservando o ID da NFC-e)
            xmlParaEnviar = signedXmlNovo;
            chaveParaEnviar = chaveNova;

            await prisma.nfce.update({
                where: { id: nfce.id },
                data: { chave: chaveNova, xml: signedXmlNovo }
            });

            console.log(`[Contingência] ✅ XML regenerado e atualizado no banco para ID=${nfce.id}`);
        } catch (regenError) {
            console.error('[Contingência] Erro ao regenerar/preparar XML:', regenError);
            return res.status(500).json({ ok: false, message: 'Erro ao preparar nota para o novo Schema: ' + regenError.message });
        }

        const result = await NfceService.sendToSefaz(xmlParaEnviar, company, chaveParaEnviar, saleOriginal);

        if (result.status === 'AUTORIZADO') {
            await prisma.nfce.update({
                where: { id: nfce.id },
                data: { status: 'AUTORIZADA', protocolo: result.protocolo || '', motivo: result.motivo, erroUltimo: null }
            });
            
            // Smart Auto-Recovery: Se tivemos sucesso ao bater na SEFAZ, significa que a conexão restabeleceu!
            // Desativamos a contingência global automaticamente.
            await prisma.appSetting.upsert({
                where: { key: 'contingencia_ativa' },
                update: { value: 'false' },
                create: { key: 'contingencia_ativa', value: 'false' }
            });
            
            return res.json({ ok: true, message: 'NFC-e transmitida com sucesso! Protocolo: ' + result.protocolo });
        } else {
            await prisma.nfce.update({
                where: { id: nfce.id },
                data: { erroUltimo: result.motivo, status: 'CONTINGENCIA_REJEITADA' }
            });
            return res.status(400).json({ ok: false, message: 'Falha na transmissão: ' + result.motivo });
        }
    } catch (e) {
        console.error('[Contingência] Erro ao retentar:', e);
        return res.status(500).json({ ok: false, message: e.message });
    }
};

/**
 * Inutilizar numeração de NFC-e de contingência não transmitida
 * POST /api/nfce/contingencia/:nfceId/inutilizar
 * Body: { xJust? }
 */
export const inutilizarContingencia = async (req, res) => {
    try {
        const { nfceId } = req.params;
        const { xJust } = req.body;

        const nfce = await prisma.nfce.findUnique({ where: { id: parseInt(nfceId) } });
        if (!nfce) return res.status(404).json({ ok: false, message: 'NFC-e não encontrada.' });

        const company = await prisma.company.findFirst();
        if (!company) return res.status(400).json({ ok: false, message: 'Empresa não configurada.' });

        const justificativa = xJust || nfce.xJust || 'Numeracao de contingencia nao transmitida';
        
        // Marca como inutilizada no banco (envio real ao SEFAZ pode ser implementado depois)
        await prisma.nfce.update({
            where: { id: nfce.id },
            data: {
                status: 'INUTILIZADA',
                motivo: 'Inutilizada: ' + justificativa,
                erroUltimo: null
            }
        });

        // Registra evento de inutilização
        await prisma.nfceEvent.create({
            data: {
                nfceId: nfce.id,
                tipo: 'INUTILIZACAO',
                sequencia: 1,
                status: 'INUTILIZADA',
                motivo: justificativa
            }
        });

        return res.json({ ok: true, message: 'NFC-e marcada como inutilizada com sucesso.' });
    } catch (e) {
        console.error('[Contingência] Erro ao inutilizar:', e);
        return res.status(500).json({ ok: false, message: e.message });
    }
};

