import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  produto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  nomeProduto: {
    type: String,
    required: true
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1
  },
  precoUnitario: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
});

const saleSchema = new mongoose.Schema({
  funcionario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false
  },
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },
  mesa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mesa',
    required: false
  },
  // Snapshot do responsável da mesa no momento da finalização
  responsavelNome: {
    type: String,
    maxlength: 100,
    default: ''
  },
  responsavelFuncionario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  // Snapshot do funcionário que finalizou a venda
  funcionarioNome: {
    type: String,
    default: null
  },
  funcionarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  // Snapshot do funcionário que abriu a mesa
  funcionarioAberturaNome: {
    type: String,
    default: null
  },
  funcionarioAberturaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  numeroComanda: {
    type: String,
    unique: true,
    sparse: true
  },
  nomeComanda: {
    type: String,
    required: false,
    maxlength: 100
  },
  tipoVenda: {
    type: String,
    enum: ['balcao', 'mesa', 'delivery', 'comanda'],
    default: 'balcao'
  },
  itens: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  desconto: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  formaPagamento: {
    type: String,
    enum: ['dinheiro', 'cartao', 'pix'],
    default: 'dinheiro'
  },
  status: {
    type: String,
    enum: ['aberta', 'finalizada', 'cancelada'],
    default: 'aberta'
  },
  dataVenda: {
    type: Date,
    default: Date.now
  },
  dataFinalizacao: {
    type: Date
  },
  observacoes: {
    type: String,
    maxlength: 500
  },
  tempoPreparoEstimado: {
    type: Number,
    default: 0
  },
  impressaoCozinha: {
    type: Boolean,
    default: false
  },
  impressaoBar: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Middleware para calcular totais antes de salvar
saleSchema.pre('save', function(next) {
  // Gerar número da comanda se não existir
  if (this.isNew && !this.numeroComanda) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    this.numeroComanda = `CMD${timestamp}${random}`;
  }
  
  // Calcular subtotal dos itens
  this.subtotal = this.itens.reduce((acc, item) => acc + item.subtotal, 0);
  
  // Calcular total com desconto
  this.total = this.subtotal - (this.desconto || 0);
  
  // Se a venda está sendo finalizada, definir data de finalização
  if (this.status === 'finalizada' && !this.dataFinalizacao) {
    this.dataFinalizacao = new Date();
  }
  
  next();
});

// Método para adicionar item
saleSchema.methods.adicionarItem = function(produto, quantidade, precoUnitario) {
  const itemExistente = this.itens.find(item => item.produto.toString() === produto._id.toString());
  
  if (itemExistente) {
    itemExistente.quantidade += quantidade;
    itemExistente.subtotal = itemExistente.quantidade * itemExistente.precoUnitario;
  } else {
    this.itens.push({
      produto: produto._id,
      nomeProduto: produto.nome,
      quantidade: quantidade,
      precoUnitario: precoUnitario,
      subtotal: quantidade * precoUnitario
    });
  }
};

// Método para remover item
saleSchema.methods.removerItem = function(produtoId) {
  this.itens = this.itens.filter(item => item.produto.toString() !== produtoId.toString());
};

// Método para finalizar venda
saleSchema.methods.finalizar = function() {
  this.status = 'finalizada';
  this.dataFinalizacao = new Date();
};

export default mongoose.model('Sale', saleSchema);