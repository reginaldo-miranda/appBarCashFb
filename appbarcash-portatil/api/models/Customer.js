import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  nome: { type: String },
  endereco: { type: String },
  cidade: { type: String },
  estado: { type: String },
  fone: { type: String },
  cpf: { type: String, unique: true },
  rg: { type: String },
  dataNascimento: { type: Date },
  ativo: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now }
});

export default mongoose.model("Customer", CustomerSchema);