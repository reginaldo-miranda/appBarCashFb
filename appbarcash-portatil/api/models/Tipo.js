import mongoose from "mongoose";

const TipoSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  ativo: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now }
});

export default mongoose.model("Tipo", TipoSchema);