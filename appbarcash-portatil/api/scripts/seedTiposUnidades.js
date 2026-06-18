import mongoose from "mongoose";
import dotenv from "dotenv";
import Tipo from "../models/Tipo.js";
import UnidadeMedida from "../models/UnidadeMedida.js";

dotenv.config();

const tiposIniciais = [
  { nome: 'Alcoólica' },
  { nome: 'Não Alcoólica' },
  { nome: 'Quente' },
  { nome: 'Frio' },
];

const unidadesIniciais = [
  { nome: 'Litro', sigla: 'L' },
  { nome: 'Mililitro', sigla: 'ml' },
  { nome: 'Quilograma', sigla: 'kg' },
  { nome: 'Grama', sigla: 'g' },
  { nome: 'Unidade', sigla: 'un' },
];

async function seedDatabase() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB Atlas");

    // Limpar dados existentes
    await Tipo.deleteMany({});
    await UnidadeMedida.deleteMany({});
    console.log("🧹 Dados existentes removidos");

    // Inserir tipos
    const tipos = await Tipo.insertMany(tiposIniciais);
    console.log(`✅ ${tipos.length} tipos inseridos`);

    // Inserir unidades de medida
    const unidades = await UnidadeMedida.insertMany(unidadesIniciais);
    console.log(`✅ ${unidades.length} unidades de medida inseridas`);

    console.log("🎉 Seed concluído com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro durante o seed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado do MongoDB");
  }
}

seedDatabase();