/**
 * ContingenciaJobService.js
 * Job que roda periodicamente para tentar retransmitir NFC-es emitidas em contingência.
 * Executa a cada 5 minutos via setInterval no server.js.
 */

import prisma from '../lib/prisma.js';
import NfceService from './NfceService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intervalo entre tentativas (5 minutos)
const INTERVAL_MS = 5 * 60 * 1000;

// Máximo de tentativas antes de marcar como CONTINGENCIA_REJEITADA por timeout
const MAX_TENTATIVAS = 10;

let jobInterval = null;
let isRunning = false;

/**
 * Verifica se o modo de contingência está ativo
 */
async function isModoContingenciaAtivo() {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_ativa' } });
    return setting && setting.value === 'true';
}

/**
 * Tenta transmitir uma NFC-e de contingência para a SEFAZ.
 * Retorna { success, motivo, protocolo }
 *
 * CORREÇÃO: Verifica se a chave tem tpEmis=9 (posição 34).
 * Se não tiver, regenera o XML com a chave correta antes de enviar.
 */
async function transmitirUmaContingencia(nfce) {
    const company = await prisma.company.findFirst();
    if (!company || !company.certificadoPath) {
        return { success: false, motivo: 'Certificado não configurado.' };
    }

    try {
        let xmlAtual = nfce.xml;
        let chaveAtual = nfce.chave;

        if (!xmlAtual || xmlAtual.length < 100) {
            return { success: false, motivo: 'XML de contingência inválido ou vazio.' };
        }

        // ─── CORREÇÃO: Verificar tpEmis na chave (posição 34) ─────────────────────
        // Se for '1' (normal) mas XML tem tpEmis=9, SEFAZ rejeita com Rejeição 202.
        const tpEmisNaChave = chaveAtual ? chaveAtual.charAt(34) : '?';
        if (tpEmisNaChave !== '9') {
            console.warn(`[ContingenciaJob] ⚠️ Chave "${chaveAtual}" tem tpEmis="${tpEmisNaChave}". Regenerando XML...`);
            try {
                const sale = await prisma.sale.findUnique({
                    where: { id: nfce.saleId },
                    include: { itens: { include: { product: true } }, cliente: true, caixaVendas: true }
                });
                if (!sale) throw new Error('Venda original não encontrada.');

                const companyParaGerar = {
                    ...company,
                    numeroInicialNfce: nfce.numero || company.numeroInicialNfce,
                    serieNfce: nfce.serie || company.serieNfce
                };

                let dhCont = nfce.dhCont || new Date();
                let xJust = nfce.xJust || 'Falha de comunicacao com a SEFAZ';

                if (!nfce.dhCont) {
                    const dhContSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_dhCont' } });
                    if (dhContSetting?.value) dhCont = new Date(dhContSetting.value);
                }
                if (!nfce.xJust) {
                    const xJustSetting = await prisma.appSetting.findUnique({ where: { key: 'contingencia_xJust' } });
                    if (xJustSetting?.value) xJust = xJustSetting.value;
                }

                const { xmlContent: xmlNovo, accessKey: chaveNova } = await NfceService.buildXMLContingencia(
                    sale, companyParaGerar, dhCont, xJust
                );
                const signedXmlNovo = await NfceService.signXML(xmlNovo, company.certificadoPath, company.certificadoSenha);

                // Salvar no banco
                await prisma.nfce.update({
                    where: { id: nfce.id },
                    data: { chave: chaveNova, xml: signedXmlNovo }
                });

                xmlAtual = signedXmlNovo;
                chaveAtual = chaveNova;
                console.log(`[ContingenciaJob] ✅ XML regenerado | Nova chave=${chaveNova} | tpEmis="${chaveNova.charAt(34)}"`);
            } catch (e) {
                return { success: false, motivo: 'Erro ao regenerar XML de contingência: ' + e.message };
            }
        }
        // ─── FIM CORREÇÃO ──────────────────────────────────────────────────────────

        // Reenviar o XML (corrigido ou original) ao SEFAZ
        const result = await NfceService.sendToSefaz(xmlAtual, company, chaveAtual, { total: 0 });

        if (result.status === 'AUTORIZADO') {
            // Salvar XML em arquivo físico (mesma lógica do fluxo normal)
            try {
                let xmlDir;
                if (company.xmlFolder && company.xmlFolder.trim() !== '') {
                    const now = new Date();
                    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
                    const subfolder = `${months[now.getMonth()]}${now.getFullYear()}`;
                    xmlDir = path.join(company.xmlFolder, subfolder);
                } else {
                    xmlDir = path.join(__dirname, '../../xml_nfce');
                }
                if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
                fs.writeFileSync(path.join(xmlDir, `${chaveAtual}.xml`), xmlAtual);
            } catch (e) {
                console.error('[ContingenciaJob] Erro ao salvar XML físico:', e.message);
            }

            return { success: true, motivo: result.motivo, protocolo: result.protocolo };
        } else {
            return { success: false, motivo: result.motivo };
        }
    } catch (e) {
        return { success: false, motivo: e.message || 'Erro interno na transmissão.' };
    }
}

/**
 * Loop principal do job
 */
async function executarJob() {
    if (isRunning) return; // Evita execuções sobrepostas
    isRunning = true;

    try {
        let modoAtivo = await isModoContingenciaAtivo();
        if (modoAtivo) {
            // Verifica as expiradas primeiro
            const agora = new Date();
            const expiradas = await prisma.nfce.findMany({
                where: {
                    status: 'CONTINGENCIA',
                    prazoLimite: { lt: agora }
                }
            });

            for (const nfce of expiradas) {
                await prisma.nfce.update({
                    where: { id: nfce.id },
                    data: {
                        status: 'CONTINGENCIA_EXPIRADA',
                        erroUltimo: 'Prazo de transmissão esgotado (24h).'
                    }
                });
                console.warn(`[ContingenciaJob] NFC-e ${nfce.chave} marcada como CONTINGENCIA_EXPIRADA (prazo vencido).`);
            }

            // SMART AUTO-RECOVERY: Teste de Conectividade
            // Pega apenas 1 para testar se a conexão com a SEFAZ voltou
            const primeiraPendente = await prisma.nfce.findFirst({
                where: { status: 'CONTINGENCIA' },
                orderBy: { createdAt: 'asc' }
            });

            if (primeiraPendente) {
                console.log(`[ContingenciaJob] Modo ativo, testando conectividade SEFAZ com NFC-e ID=${primeiraPendente.id}...`);
                const novasTentativas = (primeiraPendente.tentativas || 0) + 1;
                
                // Salvar tentativa
                await prisma.nfce.update({
                    where: { id: primeiraPendente.id },
                    data: { tentativas: novasTentativas, ultimaTentativa: new Date() }
                });

                const resultadoTeste = await transmitirUmaContingencia(primeiraPendente);

                if (resultadoTeste.success) {
                    console.log(`[ContingenciaJob] ✅ Teste de conexão SUCESSO! SEFAZ online. Desativando contingência automaticamente...`);
                    await prisma.nfce.update({
                        where: { id: primeiraPendente.id },
                        data: {
                            status: 'AUTORIZADA',
                            protocolo: resultadoTeste.protocolo || '',
                            motivo: resultadoTeste.motivo,
                            erroUltimo: null,
                            tpEmis: 9
                        }
                    });

                    await prisma.appSetting.upsert({
                        where: { key: 'contingencia_ativa' },
                        update: { value: 'false' },
                        create: { key: 'contingencia_ativa', value: 'false' }
                    });
                    
                    modoAtivo = false; // Prossegue com o resto da fila abaixo
                } else {
                    console.log(`[ContingenciaJob] 🔄 SEFAZ continua indisponível (${resultadoTeste.motivo}). Mantendo contingência e abortando envio em lote.`);
                    
                    // Verifica se o erro foi definitivo para essa nota de teste
                    const erroDefinitivo = resultadoTeste.motivo && (
                         resultadoTeste.motivo.toLowerCase().includes('ncm') ||
                         resultadoTeste.motivo.toLowerCase().includes('cfop') ||
                         resultadoTeste.motivo.toLowerCase().includes('csosn') ||
                         resultadoTeste.motivo.toLowerCase().includes('rejeição') ||
                         resultadoTeste.motivo.toLowerCase().includes('rejeicao') ||
                         resultadoTeste.motivo.toLowerCase().includes('inválido') ||
                         resultadoTeste.motivo.toLowerCase().includes('invalido')
                    );

                    if (erroDefinitivo || novasTentativas >= MAX_TENTATIVAS) {
                         await prisma.nfce.update({
                             where: { id: primeiraPendente.id },
                             data: { status: 'CONTINGENCIA_REJEITADA', erroUltimo: resultadoTeste.motivo }
                         });
                         console.error(`[ContingenciaJob] ❌ NFC-e ID=${primeiraPendente.id} marcada como REJEITADA e removida da fila.`);
                    } else {
                         await prisma.nfce.update({
                             where: { id: primeiraPendente.id },
                             data: { erroUltimo: resultadoTeste.motivo }
                         });
                    }
                    return; // Encerra o job até o próximo ciclo
                }
            } else {
                return; // Não tem pendentes, não faz nada
            }
        }

        // Modo desativado (ou acabou de ser desativado pelo Smart Auto-Recovery):
        // tenta transmitir todas as pendentes
        const pendentes = await prisma.nfce.findMany({
            where: { status: 'CONTINGENCIA' },
            orderBy: { createdAt: 'asc' }
        });

        if (pendentes.length === 0) return;

        console.log(`[ContingenciaJob] ${pendentes.length} NFC-e(s) em contingência para transmitir.`);

        for (const nfce of pendentes) {
            console.log(`[ContingenciaJob] Tentando transmitir NFC-e ID=${nfce.id} | Chave=${nfce.chave}`);

            // Atualiza tentativas
            const novasTentativas = (nfce.tentativas || 0) + 1;
            await prisma.nfce.update({
                where: { id: nfce.id },
                data: {
                    tentativas: novasTentativas,
                    ultimaTentativa: new Date()
                }
            });

            const resultado = await transmitirUmaContingencia(nfce);

            if (resultado.success) {
                await prisma.nfce.update({
                    where: { id: nfce.id },
                    data: {
                        status: 'AUTORIZADA',
                        protocolo: resultado.protocolo || '',
                        motivo: resultado.motivo,
                        erroUltimo: null,
                        tpEmis: 9 // Mantém registro de que foi emitida originalmente em contingência
                    }
                });
                console.log(`[ContingenciaJob] ✅ NFC-e ID=${nfce.id} AUTORIZADA! Protocolo=${resultado.protocolo}`);
            } else {
                // Verifica se é erro definitivo (dados incorretos) ou transitório (sem conexão)
                const erroDefinitivo =
                    resultado.motivo && (
                        resultado.motivo.includes('NCM') ||
                        resultado.motivo.includes('CFOP') ||
                        resultado.motivo.includes('CSOSN') ||
                        resultado.motivo.includes('Rejeição') ||
                        resultado.motivo.includes('rejeicao') ||
                        resultado.motivo.includes('inválido') ||
                        resultado.motivo.includes('invalido') ||
                        resultado.motivo.includes('Rejeicao')
                    );

                const prazoVencido = nfce.prazoLimite && new Date() > new Date(nfce.prazoLimite);

                if (erroDefinitivo || novasTentativas >= MAX_TENTATIVAS) {
                    await prisma.nfce.update({
                        where: { id: nfce.id },
                        data: {
                            status: prazoVencido ? 'CONTINGENCIA_EXPIRADA' : 'CONTINGENCIA_REJEITADA',
                            erroUltimo: resultado.motivo
                        }
                    });
                    console.error(`[ContingenciaJob] ❌ NFC-e ID=${nfce.id} marcada como ${prazoVencido ? 'EXPIRADA' : 'REJEITADA'}: ${resultado.motivo}`);
                } else {
                    // Erro transitório (ex: sem internet): mantém como CONTINGENCIA e tenta depois
                    await prisma.nfce.update({
                        where: { id: nfce.id },
                        data: { erroUltimo: resultado.motivo }
                    });
                    console.warn(`[ContingenciaJob] ⚠️ NFC-e ID=${nfce.id} falhou (tentativa ${novasTentativas}): ${resultado.motivo}. Tentará novamente.`);
                }
            }
        }
    } catch (e) {
        console.error('[ContingenciaJob] Erro no job:', e.message);
    } finally {
        isRunning = false;
    }
}

/**
 * Inicia o job (chamado no server.js)
 */
export function iniciarContingenciaJob() {
    if (jobInterval) return;
    console.log('[ContingenciaJob] Job de contingência iniciado (intervalo: 5min).');
    executarJob(); // Executa imediatamente ao iniciar
    jobInterval = setInterval(executarJob, INTERVAL_MS);
}

/**
 * Para o job (para uso em testes)
 */
export function pararContingenciaJob() {
    if (jobInterval) {
        clearInterval(jobInterval);
        jobInterval = null;
        console.log('[ContingenciaJob] Job parado.');
    }
}

/**
 * Executa o job manualmente (chamado quando se desativa o modo contingência)
 */
export async function executarJobAgora() {
    await executarJob();
}
