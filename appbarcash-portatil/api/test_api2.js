import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "thunder", { expiresIn: "100h" });
    
    console.log('Fetching /api/sale/list?status=finalizada,cancelada');
    const res = await axios.get('http://localhost:4000/api/sale/list', {
      params: { status: 'finalizada,cancelada' },
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success! Count:', res.data.length);
    if(res.data.length > 0) {
      console.log('First sale:', res.data[0].id, res.data[0].status, res.data[0].dataVenda);
    }
  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Request Error:', err.message);
    }
  } finally {
    prisma.$disconnect();
  }
}

run();
