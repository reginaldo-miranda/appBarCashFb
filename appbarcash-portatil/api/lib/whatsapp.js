import { getActivePrisma } from './prisma.js';

export async function queueWhatsAppMessage({ saleId, to, text }) {
  const prisma = getActivePrisma();
  const log = await prisma.whatsAppMessageLog.create({ data: { saleId: saleId ?? null, destino: to, content: text, status: 'queued' } });
  sendWhatsApp(log.id).catch((err) => {});
  return log;
}

export async function sendWhatsApp(logId) {
  const prisma = getActivePrisma();
  const log = await prisma.whatsAppMessageLog.findUnique({ where: { id: logId } });
  if (!log) return;
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_ID || '';
  try {
    await prisma.whatsAppMessageLog.update({ where: { id: logId }, data: { status: 'queued' } });
    if (!token || !phoneId) throw new Error('Configuração do WhatsApp ausente');
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: log.destino, type: 'text', text: { preview_url: false, body: log.content } }),
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(errTxt);
    }
    await prisma.whatsAppMessageLog.update({ where: { id: logId }, data: { status: 'sent', sentAt: new Date() } });
  } catch (error) {
    await prisma.whatsAppMessageLog.update({ where: { id: logId }, data: { status: 'failed', error: String(error?.message || error) } });
  }
}

export function formatWhatsappMessage({ sale, itens }) {
  const head = [];
  if (sale?.mesa) head.push(`Mesa ${sale.mesa}`);
  if (sale?.comanda) head.push(`Comanda ${sale.comanda}`);
  const dt = new Date().toLocaleString('pt-BR');
  const lines = [`Pedido ${head.join(' • ')} • ${dt}`];
  let total = 0;
  for (const it of itens || []) {
    const nome = it.product?.nome || it.nome || '';
    const qtd = Number(it.quantidade || 0);
    const pv = Number(it.product?.precoVenda || it.preco || 0);
    total += pv * qtd;
    lines.push(`${nome} x${qtd} — R$ ${pv.toFixed(2)}`);
  }
  lines.push(`Total: R$ ${total.toFixed(2)}`);
  if (sale?.observacoes) lines.push(`Obs: ${sale.observacoes}`);
  return lines.join('\n');
}