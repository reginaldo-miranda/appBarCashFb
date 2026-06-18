
console.log("Starting script...");

async function run() {
    try {
        console.log("Importing dotenv...");
        const dotenv = await import('dotenv');
        dotenv.default.config();
        
        console.log("Importing PrismaClient...");
        const { PrismaClient } = await import('@prisma/client');
        
        console.log("Importing NfceService...");
        // NfceService IS ALREADY AN INSTANCE (export default new NfceService())
        const NfceServiceModule = await import('../services/NfceService.js');
        const nfceService = NfceServiceModule.default;
        
        console.log("NfceService imported.");

        const prisma = new PrismaClient();
        
        console.log("--- INICIANDO SIMULAÇÃO NFC-E ---");

        const sale = await prisma.sale.findFirst({
            orderBy: { id: 'desc' },
            include: {
                itens: { include: { product: true } },
                nfce: true,
                cliente: true,
                caixaVendas: true
            }
        });

        if (!sale) {
            console.error("Nenhuma venda encontrada para teste.");
            return;
        }

        console.log(`Venda Encontrada: ID ${sale.id}`);
        
        const company = await prisma.company.findFirst();
        if (!company) {
            console.error("Empresa não encontrada.");
            return;
        }

        const { xmlContent } = await nfceService.buildXML(sale, company);

        console.log("\n--- XML GERADO (Trecho de Pagamento) ---");
        const pagBlock = xmlContent.match(/<pag>([\s\S]*?)<\/pag>/);
        if (pagBlock) {
            console.log(pagBlock[0]); 
        } else {
            console.log(xmlContent); 
        }

        console.log("\n--- VERIFICAÇÕES ---");
        const hasTroco = xmlContent.includes('<vTroco>0.00</vTroco>');
        const hasCashbackLabel = xmlContent.includes('<xPag>Cashback</xPag>');
        const hasType99 = xmlContent.includes('<tPag>99</tPag>');

        console.log(`vTroco presente? ${hasTroco ? 'SIM ✅' : 'NÃO ❌'}`);
        console.log(`Label 'Cashback' presente? ${hasCashbackLabel ? 'SIM ✅' : 'NÃO ❌'}`);
        console.log(`Tipo 99 (Outros) presente? ${hasType99 ? 'SIM ✅' : 'NÃO ❌'}`);

        await prisma.$disconnect();

    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
}

run();
