import { Ionicons } from '@expo/vector-icons';

export interface CartItem {
  _id: string;
  productId?: number;
  produto: {
    _id: string;
    nome: string;
    preco: number;
  };
  nomeProduto: string;
  product?: any; // Added for populated items
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  observacoes?: string;
  variacao?: {
    tipo: string;
    regraPreco?: 'mais_caro' | 'media' | 'fixo';
    opcoes: Array<{ productId: number; nome: string; preco: number }>;
  };
}

export interface Sale {
  _id: string;
  status: 'aberta' | 'fechada' | 'cancelada' | 'finalizada';
  itens: CartItem[];
  observacoes?: string;
  total: number;
  desconto?: number;
  caixaVendas?: any[];
  isDelivery?: boolean;
  deliveryAddress?: string;
  deliveryDistance?: number;
  deliveryFee?: number;
  deliveryStatus?: string;
  entregadorId?: number;
  entregador?: {
    _id: string;
    id?: number;
    nome: string;
  };
  clienteId?: number;
  cliente?: {
    _id: string;
    id?: number;
    nome: string;
    endereco?: string;
    saldoCashback?: number;
    pontos?: number;
  };
}

export interface Product {
  _id: string;
  nome: string;
  descricao: string;
  precoVenda: number;
  categoria: string;
  categoriaId?: number;
  grupo?: string;
  groupId?: number;
  ativo: boolean;
  disponivel: boolean;
  tipo?: string;
  tipoId?: number;
  unidade?: string;
  unidadeMedidaId?: number;
  temVariacao?: boolean;
  temTamanhos?: boolean;
  tamanhos?: ProductSize[];
}

export interface ProductSize {
  id?: number | string;
  nome: string;
  preco: number;
  ativo?: boolean;
}

export interface PaymentMethod {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface VariationType {
  _id: string;
  id: number;
  nome: string;
  maxOpcoes: number;
  categoriasIds?: number[];
  regraPreco: 'mais_caro' | 'media' | 'fixo';
  precoFixo?: number | null;
  ativo: boolean;
}

export interface Comanda {
  _id: string;
  numeroComanda?: string;
  nomeComanda?: string;
  cliente?: {
    _id: string;
    nome: string;
    fone?: string;
    email?: string;
  };
  customerId?: string;
  funcionario: {
    _id: string;
    nome: string;
  };
  status: 'aberta' | 'fechada' | 'cancelada';
  total: number;
  itens: CartItem[];
  observacoes?: string;
  tipoVenda: string;
  createdAt: string;
  updatedAt: string;
}