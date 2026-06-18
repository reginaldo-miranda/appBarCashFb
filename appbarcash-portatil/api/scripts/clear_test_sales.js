import { getActivePrisma } from "../lib/prisma.js";

const prisma = getActivePrisma();

async function main() {
  console.log("🧹 Iniciando a limpeza de dados de vendas de teste...");

  try {
    // Usamos uma transação para garantir consistência e evitar problemas de chave estrangeira
    await prisma.$transaction(async (tx) => {
      // 1. Desvincular todas as vendas ativas das mesas e resetar o status de todas elas
      console.log("📌 Resetando status de todas as mesas para 'livre'...");
      await tx.$executeRawUnsafe(`
        UPDATE \`Mesa\` 
        SET 
          \`status\` = 'livre', 
          \`vendaAtualId\` = NULL, 
          \`clientesAtuais\` = 0, 
          \`horaAbertura\` = NULL, 
          \`observacoes\` = NULL
      `);

      // 2. Deletar eventos de NFC-e
      console.log("🗑️ Deletando registros de eventos NFC-e...");
      await tx.$executeRawUnsafe("DELETE FROM `NfceEvent` WHERE 1=1");

      // 3. Deletar NFC-e
      console.log("🗑️ Deletando registros de NFC-e...");
      await tx.$executeRawUnsafe("DELETE FROM `Nfce` WHERE 1=1");

      // 4. Deletar CaixaVenda (relacionamento de vendas e caixas)
      console.log("🗑️ Deletando vendas vinculadas aos caixas (CaixaVenda)...");
      await tx.$executeRawUnsafe("DELETE FROM `CaixaVenda` WHERE 1=1");

      // 5. Deletar caixas de teste
      console.log("🗑️ Deletando caixas de teste (Caixa)...");
      await tx.$executeRawUnsafe("DELETE FROM `Caixa` WHERE 1=1");

      // 6. Deletar log de trabalhos de impressão
      console.log("🗑️ Deletando trabalhos de impressão de teste (PrintJob)...");
      await tx.$executeRawUnsafe("DELETE FROM `PrintJob` WHERE 1=1");

      // 7. Deletar log de mensagens de WhatsApp
      console.log("🗑️ Deletando log de mensagens do WhatsApp...");
      await tx.$executeRawUnsafe("DELETE FROM `WhatsAppMessageLog` WHERE 1=1");

      // 8. Deletar itens das vendas
      console.log("🗑️ Deletando itens de vendas (SaleItem)...");
      await tx.$executeRawUnsafe("DELETE FROM `SaleItem` WHERE 1=1");

      // 9. Deletar as vendas
      console.log("🗑️ Deletando as vendas de teste (Sale)...");
      await tx.$executeRawUnsafe("DELETE FROM `Sale` WHERE 1=1");
    });

    console.log("✨ Banco de dados de testes limpo com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ocorreu um erro ao limpar os dados de teste:", error);
    process.exit(1);
  }
}

main();
