import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Categoria from '../models/Categoria.js';

dotenv.config();

const categorias = [
  {
    nome: 'Bebidas Alcoólicas',
    descricao: 'Cervejas, vinhos, destilados e outras bebidas com álcool'
  },
  {
    nome: 'Bebidas Não Alcoólicas',
    descricao: 'Refrigerantes, sucos, águas e outras bebidas sem álcool'
  },
  {
    nome: 'Petiscos',
    descricao: 'Aperitivos, salgadinhos e petiscos diversos'
  },
  {
    nome: 'Pratos Principais',
    descricao: 'Refeições completas, pratos quentes e principais'
  },
  {
    nome: 'Sobremesas',
    descricao: 'Doces, sorvetes e sobremesas diversas'
  },
  {
    nome: 'Outros',
    descricao: 'Produtos diversos que não se encaixam nas outras categorias'
  }
];

async function seedCategorias() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado ao MongoDB Atlas');

    // Remover categorias existentes
    await Categoria.deleteMany({});
    console.log('🗑️ Categorias existentes removidas');

    // Inserir novas categorias
    const categoriasInseridas = await Categoria.insertMany(categorias);
    console.log(`✅ ${categoriasInseridas.length} categorias inseridas com sucesso:`);
    
    categoriasInseridas.forEach(categoria => {
      console.log(`   - ${categoria.nome}`);
    });

    // Desconectar do MongoDB
    await mongoose.disconnect();
    console.log('✅ Desconectado do MongoDB');
    
  } catch (error) {
    console.error('❌ Erro ao popular categorias:', error);
    process.exit(1);
  }
}

seedCategorias();