import mongoose from "mongoose";

const ProductGroupSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  descricao: { type: String },
  icone: { type: String, default: '📦' },
  ativo: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now }
});

export default mongoose.model("ProductGroup", ProductGroupSchema);