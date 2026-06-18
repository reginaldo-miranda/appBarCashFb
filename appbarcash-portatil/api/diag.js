
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

console.log('--- DIAGNOSTIC START ---');
const urlLocal = process.env.DATABASE_URL_LOCAL;
const urlEnv = process.env.DATABASE_URL;

console.log('DATABASE_URL_LOCAL:', urlLocal ? urlLocal.replace(/:[^:@]*@/, ':****@') : 'UNDEFINED');
console.log('DATABASE_URL:', urlEnv ? urlEnv.replace(/:[^:@]*@/, ':****@') : 'UNDEFINED');

const prisma = new PrismaClient({
    datasources: { db: { url: urlLocal || urlEnv } }
});

async function main() {
    try {
        console.log('Connecting...');
        await prisma.$connect();
        console.log('Connected!');

        const count = await prisma.employee.count();
        console.log('Employee count:', count);

        const employees = await prisma.employee.findMany();
        console.log('Employees found:', employees.length);
        if (employees.length > 0) {
            console.log('First employee:', employees[0].nome);
        }
    } catch (e) {
        console.error('CONNECTION ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
