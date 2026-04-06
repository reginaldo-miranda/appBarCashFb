const fetch = require('node-fetch');

// Puxar a primeira NFC-e do banco que está em CONTINGENCIA e forçar a retentativa dela
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Buscando NFCes pendentes...");
    const nfces = await prisma.nfce.findMany({
        where: { status: { in: ['CONTINGENCIA', 'CONTINGENCIA_REJEITADA'] } },
        take: 1
    });

    if (nfces.length === 0) {
        console.log("Nenhuma nota em contingencia encontrada.");
        process.exit(0);
    }

    const nfce = nfces[0];
    console.log(`Disparando retentativa manual para a ID: ${nfce.id}`);
    
    const resp = await fetch(`http://0.0.0.0:4000/api/nfce/contingencia/${nfce.id}/retentar`, { method: 'POST' });
    const json = await resp.json();
    console.log("Resultado retentativa:");
    console.dir(json, {depth: null});
    process.exit(0);
}
run();
