import { getActivePrisma } from './prisma.js';

export async function enqueuePrintJob({ saleId, productId, setorId, printerId, content }) {
  const prisma = getActivePrisma();
  const job = await prisma.printJob.create({ data: { saleId: saleId ?? null, productId, setorId, printerId: printerId ?? null, content, status: 'queued' } });
  processPrintJob(job).catch((err) => {});
  return job;
}

export async function processPrintJob(job) {
  const prisma = getActivePrisma();
  try {
    await prisma.printJob.update({ where: { id: job.id }, data: { status: 'processing' } });
    const printer = job.printerId ? await prisma.printer.findUnique({ where: { id: job.printerId } }) : null;
    const target = printer?.address || '';
    const driver = (printer?.driver || '').toLowerCase();
    const payload = { target, driver, content: job.content };
    await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.printJob.update({ where: { id: job.id }, data: { status: 'done', processedAt: new Date() } });
  } catch (error) {
    await prisma.printJob.update({ where: { id: job.id }, data: { status: 'failed', error: String(error?.message || error) } });
  }
}

export function buildPrintContent({ setorNome, saleRef, productNome, quantidade, observacao }) {
  const now = new Date();
  const dt = now.toLocaleString('pt-BR');
  const obs = observacao ? `\nObs: ${observacao}` : '';
  const mesa = saleRef?.mesa ? `Mesa ${saleRef.mesa}` : (saleRef?.comanda ? `Comanda ${saleRef.comanda}` : '');
  const head = [setorNome, mesa, dt].filter(Boolean).join(' • ');
  return `${head}\nItem: ${productNome}\nQtd: ${quantidade}${obs}`;
}