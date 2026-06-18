
import prisma from '../lib/prisma.js';

async function clearData() {
  console.log('--- INICIANDO LIMPEZA DE DADOS HISTÓRICOS ---');
  console.log('⚠️  ATENÇÃO: Este script apagará TODAS as Vendas, Caixas e Notas Fiscais!');
  console.log('⏳  Aguarde 5 segundos para cancelar (Ctrl+C) se mudou de ideia...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // 1. Limpar dependências de Venda
    console.log('🗑️  Apagando Itens de Venda (SaleItem)...');
    await prisma.saleItem.deleteMany({});
    
    console.log('🗑️  Apagando Eventos NFC-e (NfceEvent)...');
    await prisma.nfceEvent.deleteMany({});
    
    console.log('🗑️  Apagando Notas Fiscais (Nfce)...');
    await prisma.nfce.deleteMany({});
    
    console.log('🗑️  Apagando Vendas em Caixas (CaixaVenda)...');
    await prisma.caixaVenda.deleteMany({});

    console.log('🗑️  Apagando Jobs de Impressão (PrintJob)...');
    await prisma.printJob.deleteMany({});

    console.log('🗑️  Apagando Logs de WhatsApp (WhatsAppMessageLog)...');
    await prisma.whatsAppMessageLog.deleteMany({});

    // 2. Liberar Mesas (para não ficarem presas a vendas inexistentes)
    console.log('🔄 Resetando Status das Mesas...');
    await prisma.mesa.updateMany({
        data: {
            status: 'livre',
            vendaAtualId: null,
            clientesAtuais: 0,
            horaAbertura: null,
            nomeResponsavel: null,
            observacoes: null
        }
    });

    // 3. Apagar tabelas principais
    console.log('🗑️  Apagando TODAS as Vendas (Sale)...');
    await prisma.sale.deleteMany({});

    console.log('🗑️  Apagando TODOS os Caixas (Caixa)...');
    await prisma.caixa.deleteMany({});

    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO! O sistema está limpo.');

  } catch (error) {
    console.error('❌ ERRO CRÍTICO ao limpar dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
