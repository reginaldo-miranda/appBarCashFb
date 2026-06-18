import mongoose from "mongoose";

const CategoriaSchema = new mongoose.Schema({
  nome: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  descricao: { 
    type: String,
    trim: true
  },
  ativo: { 
    type: Boolean, 
    default: true 
  },
  dataInclusao: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model("Categoria", CategoriaSchema);