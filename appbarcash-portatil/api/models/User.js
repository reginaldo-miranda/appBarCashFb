import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  nome: { type: String, required: true },
  tipo: { 
    type: String, 
    enum: ['admin', 'funcionario'], 
    default: 'funcionario' 
  },
  funcionario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee',
    required: function() { return this.tipo === 'funcionario'; }
  },
  permissoes: {
    vendas: { type: Boolean, default: true },
    produtos: { type: Boolean, default: false },
    funcionarios: { type: Boolean, default: false },
    clientes: { type: Boolean, default: false },
    relatorios: { type: Boolean, default: false },
    configuracoes: { type: Boolean, default: false },
    comandas: { type: Boolean, default: true }
  },
  ativo: { type: Boolean, default: true },
  dataInclusao: { type: Date, default: Date.now },
  ultimoLogin: { type: Date }
});

export default mongoose.model("User", UserSchema);
