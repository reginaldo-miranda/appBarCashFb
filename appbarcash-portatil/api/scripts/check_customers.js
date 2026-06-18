
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- Customer Data Check ---');
  try {
    const count = await prisma.customer.count();
    console.log(`Total Customers: ${count}`);

    // Try to fetch a customer with all fields to check for missing columns
    const firstCustomer = await prisma.customer.findFirst();
    if (firstCustomer) {
        console.log('Successfully fetched a customer record.');
        // Explicitly check fields that might be missing
        console.log('Sample data check:', {
            id: firstCustomer.id,
            cpf: firstCustomer.cpf,
            saldoCashback: firstCustomer.saldoCashback,
            pontos: firstCustomer.pontos,
            participaFidelidade: firstCustomer.participaFidelidade
        });
    } else {
        console.log('No customers found.');
    }

  } catch (e) {
    console.error('Customer Check Failed:', e);
    
    // Extract column name from error if possible
    if (e.meta && e.meta.column) {
        console.log(`MISSING COLUMN DETECTED: ${e.meta.column}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
