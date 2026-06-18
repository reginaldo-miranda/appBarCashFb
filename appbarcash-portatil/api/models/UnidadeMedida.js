import mongoose from "mongoose";

const UnidadeMedidaSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  sigla: { type: String, required: true, unique: true },
  ativo: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now }
});

export default mongoose.model("UnidadeMedida", UnidadeMedidaSchema);