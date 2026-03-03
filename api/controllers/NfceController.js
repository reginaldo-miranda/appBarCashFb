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
                 if (overlayItem && overlayItem.product) {
                      dbItem.product = {
                          ...(dbItem.product || {}),
                          ncm: overlayItem.product.ncm || (dbItem.product?.ncm || ''),
                          cfop: overlayItem.product.cfop || (dbItem.product?.cfop || ''),
                          csosn: overlayItem.product.csosn || (dbItem.product?.csosn || '')
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
                    success = true; // Sai do loop com sucesso
                } else {
                    // Verifica se é erro de Duplicidade (204 ou 539)
                    // Motivo geralmente contém "Duplicidade" ou códigos
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
                        // Não adianta tentar de novo
                        console.error(`[NFC-e] Erro definitivo na tentativa ${attempts}: ${sefazResult.motivo}`);
                        lastError = sefazResult;
                        break; // Sai do loop
                    }
                }

            } catch (innerError) {
                console.error(`[NFC-e] Exceção na tentativa ${attempts}:`, innerError);
                lastError = { status: 'ERRO_INTERNO', motivo: innerError.message || 'Erro interno desconhecido' };
                // Dependendo do erro interno (ex: falha de rede temporária), poderíamos tentar de novo.
                // Por segurança, vamos abortar em erro de código/interno, exceto se decidirmos tratar timeouts.
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
            
            // Re-buildando XML rapidamente para garantir que temos o binário correto da tentativa vencedora
            // (Isso é seguro pois os dados não mudaram, só a sequencia que já está atualizada no obj company)
             const { xmlContent } = await NfceService.buildXML(sale, company);
             const signedXmlFinal = await NfceService.signXML(xmlContent, company.certificadoPath, company.certificadoSenha);
            
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
                    status: 'REJEITADA',
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
                status: 'REJEITADA',
                error: `Rejeição: ${failure.motivo}`,
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
