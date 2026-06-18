
import prisma from '../lib/prisma.js';
import path from 'path';

async function main() {
  console.log('--- Fix Certificate Path ---');
  try {
    const filename = 'cert-1768701499640-583594117.pfx';
    // Use hardcoded path to be safe and explicit based on user environment
    const correctPath = `d:\\regi\\appBarCash\\api\\certs\\${filename}`; // Double backslashes for JS string

    console.log(`Setting path to: ${correctPath}`);

    const company = await prisma.company.findFirst();
    if (!company) {
        console.error('No company found to update.');
        return;
    }

    await prisma.company.update({
        where: { id: company.id },
        data: {
            certificadoPath: correctPath,
            // Also ensure these are set if needed, though mostly the path is the blocker
            certificadoNome: filename
        }
    });

    console.log('✅ Certificate path updated successfully.');
    
    // Verify
    const updated = await prisma.company.findUnique({ where: { id: company.id } });
    console.log('Current DB Path:', updated.certificadoPath);

  } catch (e) {
    console.error('Update Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
