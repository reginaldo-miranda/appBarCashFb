import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "thunder", { expiresIn: "100h" });

    const res = await axios.get('http://localhost:4000/api/sale/list?status=finalizada,cancelada', {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Finalizadas/Canceladas encontradas:', res.data.length);
  } catch (err) {
    console.log('Erro no Axios:', err.message);
    if(err.response) console.log(err.response.data);
  } finally {
    await prisma.$disconnect();
  }
}
test();
