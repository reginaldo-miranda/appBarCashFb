import mongoose from 'mongoose';

const caixaSchema = new mongoose.Schema({
  dataAbertura: {
    type: Date,
    required: true,
    default: Date.now
  },
  dataFechamento: {
    type: Date,
    default: null
  },
  valorAbertura: {
    type: Number,
    required: true,
    default: 0
  },
  valorFechamento: {
    type: Number,
    default: 0
  },
  totalVendas: {
    type: Number,
    default: 0
  },
  totalDinheiro: {
    type: Number,
    default: 0
  },
  totalCartao: {
    type: Number,
    default: 0
  },
  totalPix: {
    type: Number,
    default: 0
  },
  funcionarioAbertura: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  funcionarioFechamento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  status: {
    type: String,
    enum: ['aberto', 'fechado'],
    default: 'aberto'
  },
  observacoes: {
    type: String,
    default: ''
  },
  vendas: [{
    venda: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale'
    },
    valor: Number,
    formaPagamento: String,
    dataVenda: Date
  }]
}, {
  timestamps: true
});

export default mongoose.model('Caixa', caixaSchema);