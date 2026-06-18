import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  precoCusto: { type: Number, required: true },
  precoVenda: { type: Number, required: true },
  categoria: { type: String },
  tipo: { type: String },
  grupo: { type: String },
  unidade: { type: String, default: 'un' },
  ativo: { type: Boolean, default: true },
  dadosFiscais: { type: String },
  quantidade: { type: Number, default: 0 },
  imagem: { type: String },
  tempoPreparoMinutos: { type: Number, default: 0 },
  disponivel: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now }
});

export default mongoose.model("Product", ProductSchema);