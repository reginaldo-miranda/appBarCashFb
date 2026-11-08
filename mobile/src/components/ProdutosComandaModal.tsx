import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService, comandaService, categoryService } from '../services/api';
import VariationSelectorModal from './VariationSelectorModal';
import PaymentSplitModal from './PaymentSplitModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../services/storage';
import SearchAndFilter from './SearchAndFilter';
interface Categoria {
  id: string;
  nome: string;
  icon: string;
}

interface ProdutoExtendido {
  _id: string;
  nome: string;
  descricao: string;
  precoVenda: number;
  categoria: string;
  ativo: boolean;
  disponivel: boolean;
  grupo?: string;
}

interface CartItem {
  _id: string;
  produto: {
    _id: string;
    nome: string;
    preco: number;
  };
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  observacoes?: string;
}

interface Comanda {
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
  caixaVendas?: any[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  comanda: Comanda | null;
  onUpdateComanda: () => void;
}

export default function ProdutosComandaModal({ visible, onClose, comanda, onUpdateComanda }: Props) {
  const [produtos, setProdutos] = useState<ProdutoExtendido[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProdutoExtendido[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rawCategories, setRawCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState('');
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [variationModalVisible, setVariationModalVisible] = useState(false);
  const [variationProduct, setVariationProduct] = useState<ProdutoExtendido | null>(null);
  
  // Novos estados para os modais
  const [itensSelecionadosModalVisible, setItensSelecionadosModalVisible] = useState(false);
  const [fecharComandaModalVisible, setFecharComandaModalVisible] = useState(false);
  const [paymentSplitModalVisible, setPaymentSplitModalVisible] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && comanda) {
      loadProdutos();
      loadCategories();
    }
  }, [visible, comanda]);

  // Aplicar filtros sempre que os dados ou filtros mudarem
  useEffect(() => {
    filterProducts();
  }, [searchText, produtos, selectedCategory]);

  const loadProdutos = async () => {
    try {
      console.log('📦 Carregando produtos do banco...');
      const response = await productService.getAll();
      const produtosAtivos = response.data?.filter((prod: any) => prod.ativo && prod.disponivel) || [];
      const normalized = produtosAtivos.map((p: any) => ({
        ...p,
        _id: String(p?.id ?? p?._id ?? ''),
        nome: p?.nome ?? p?.nomeProduto ?? p?.produto?.nome ?? p?.name ?? 'Produto',
        descricao: p?.descricao ?? '',
        precoVenda: Number(p?.precoVenda ?? p?.preco ?? 0),
        categoria: p?.categoria ?? '',
        categoriaId: p?.categoriaId ?? undefined,
        tipo: p?.tipo ?? '',
        tipoId: p?.tipoId ?? undefined,
        grupo: p?.grupo ?? '',
        groupId: p?.groupId ?? undefined,
        temVariacao: !!p?.temVariacao,
      }));
      console.log('📦 Produtos carregados:', normalized.length);
      setProdutos(normalized);
      setLoading(false);
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      console.log('📦 Carregando categorias do banco...');
      let used: any[] = [];
      try {
        const resp = await productService.getUsedCategories();
        used = Array.isArray(resp?.data) ? resp.data : [];
      } catch (e) {
        used = [];
      }
      const data = used.length > 0 ? used : await categoryService.getAll();

      const categoryFilters = [
        { key: '', label: 'Todas', icon: 'apps', id: null },
        ...data.map((categoria: any) => ({
          key: String(categoria.id ?? categoria._id ?? categoria.label ?? categoria.nome),
          label: String(categoria.label ?? categoria.nome ?? ''),
          icon: 'pricetag',
          id: categoria.id ?? categoria._id ?? null,
        })),
      ];

      console.log('📦 Categorias carregadas:', categoryFilters.length);
      setRawCategories(Array.isArray(data) ? data : []);
      setCategories(categoryFilters);
    } catch (error) {
      console.error('❌ Erro ao carregar categorias:', error);
      // Fallback para categorias padrão apenas em caso de erro
      console.log('⚠️ Usando categorias padrão como fallback');
      setCategories([
        { key: '', label: 'Todas', icon: 'apps', id: null },
      ]);
      setRawCategories([]);
    }
  };

  const resolveCategoriaNome = (catVal: any): string => {
    const raw = String(catVal ?? '').trim();
    if (!raw) return '';
    const isNumeric = /^\d+$/.test(raw);
    if (isNumeric) {
      const id = Number(raw);
      const found = rawCategories.find((c: any) => Number(c?.id) === id);
      return String(found?.nome ?? '').trim();
    }
    return raw;
  };

  const matchesSelectedCategory = (produto: any, selected: string): boolean => {
    if (!selected) return true;
    const selLower = String(selected).toLowerCase();
    const selIsNumeric = /^\d+$/.test(String(selected));
    if (selIsNumeric) {
      const selId = Number(selected);
      const pid = Number(produto?.categoriaId ?? 0);
      if (Number.isInteger(selId) && Number.isInteger(pid) && pid > 0) {
        return selId === pid;
      }
      const found = rawCategories.find((c: any) => Number(c?.id) === selId);
      const selNameLower = String((found?.nome ?? found?.label ?? '')).toLowerCase();
      const catNomeNum = resolveCategoriaNome(produto?.categoria);
      const catLowerNum = String(catNomeNum).toLowerCase();
      if (selNameLower && catLowerNum && selNameLower === catLowerNum) return true;
      const tipoLowerNum = String(produto?.tipo ?? '').toLowerCase();
      if (selNameLower && tipoLowerNum && selNameLower === tipoLowerNum) return true;
      const grupoLowerNum = String(produto?.grupo ?? '').toLowerCase();
      if (selNameLower && grupoLowerNum && selNameLower === grupoLowerNum) return true;
      if (catLowerNum.includes(',')) {
        const parts = catLowerNum.split(',').map(s => s.trim());
        if (parts.includes(selNameLower)) return true;
      }
    }
    const catNome = resolveCategoriaNome(produto?.categoria);
    const catLower = String(catNome).toLowerCase();
    if (catLower && catLower === selLower) return true;
    const tipoLower = String(produto?.tipo ?? '').toLowerCase();
    if (tipoLower && tipoLower === selLower) return true;
    const grupoLower = String(produto?.grupo ?? '').toLowerCase();
    if (grupoLower && grupoLower === selLower) return true;
    if (catLower.includes(',')) {
      const parts = catLower.split(',').map(s => s.trim());
      if (parts.includes(selLower)) return true;
    }
    return false;
  };

  const adicionarItem = async (produto: ProdutoExtendido) => {
    if (!comanda || !produto?._id) {
      Alert.alert('Erro', 'Dados inválidos');
      return;
    }

    if ((produto as any)?.temVariacao) {
      setVariationProduct(produto);
      setVariationModalVisible(true);
      return;
    }

    // Adicionar produto ao loading
    setLoadingItems(prev => new Set(prev).add(produto._id));
    
    const itemData = {
      produtoId: produto._id,
      quantidade: quantidade || 1,
      observacoes: observacoes.trim() || undefined
    } as any;
    try {
      const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(cm).toLowerCase() === 'tablet') itemData.origem = 'tablet';
    } catch {}
    
    try {
      await comandaService.addItem(comanda._id, itemData);
      setObservacoes('');
      Alert.alert('Sucesso', `${produto.nome} adicionado à comanda!`);
      try {
        const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
        if (String(cm).toLowerCase() === 'tablet') {
          Alert.alert('Modo tablet', 'Pedido adicionado como novo registro (linha independente).');
        }
      } catch {}
      onUpdateComanda();
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o item');
    } finally {
      // Remover produto do loading
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(produto._id);
        return newSet;
      });
    }
  };

  const removerItem = async (produto: ProdutoExtendido) => {
    if (!comanda || !produto?._id) {
      Alert.alert('Erro', 'Dados inválidos');
      return;
    }

    // Adicionar produto ao loading
    setLoadingItems(prev => new Set(prev).add(produto._id));
    
    try {
      await comandaService.removeItem(comanda._id, produto._id);
      Alert.alert('Sucesso', `${produto.nome} removido da comanda!`);
      onUpdateComanda();
    } catch (error) {
      console.error('Erro ao remover item:', error);
      Alert.alert('Erro', 'Não foi possível remover o item');
    } finally {
      // Remover produto do loading
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(produto._id);
        return newSet;
      });
    }
  };

  const handleVariationConfirm = async (payload: { tipoId?: number; tipoNome?: string; regraPreco?: 'mais_caro'|'media'|'fixo'; maxOpcoes?: number; opcoes: Array<{ productId: number }>; precoFixo?: number }) => {
    if (!comanda || !variationProduct?._id) {
      Alert.alert('Erro', 'Dados inválidos');
      return;
    }
    const produto = variationProduct;
    setVariationModalVisible(false);
    setVariationProduct(null);
    setLoadingItems(prev => new Set(prev).add(produto._id));
    const itemData: any = {
      produtoId: produto._id,
      quantidade: quantidade || 1,
      variacao: payload,
      observacoes: observacoes.trim() || undefined
    };
    try {
      try {
        const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
        if (String(cm).toLowerCase() === 'tablet') itemData.origem = 'tablet';
      } catch {}
      await comandaService.addItem(comanda._id, itemData);
      setObservacoes('');
      Alert.alert('Sucesso', `${produto.nome} (variação) adicionado à comanda!`);
      onUpdateComanda();
    } catch (error) {
      console.error('Erro ao adicionar item com variação:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o item com variação');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(produto._id);
        return newSet;
      });
    }
  };

  const handleVariationConfirmWhole = async () => {
      if (!comanda || !variationProduct?._id) {
        Alert.alert('Erro', 'Dados inválidos');
        return;
      }
      const produto = variationProduct;
      setVariationModalVisible(false);
      setVariationProduct(null);
      setLoadingItems(prev => new Set(prev).add(produto._id));
      
      const itemData: any = {
        produtoId: produto._id,
        quantidade: quantidade || 1,
        observacoes: observacoes.trim() || undefined
      };
      
      try {
        try {
          const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
          if (String(cm).toLowerCase() === 'tablet') itemData.origem = 'tablet';
        } catch {}
        await comandaService.addItem(comanda._id, itemData);
        setObservacoes('');
        Alert.alert('Sucesso', `${produto.nome} adicionado inteiro!`);
        onUpdateComanda();
      } catch (error) {
        console.error('Erro ao adicionar item inteiro:', error);
        Alert.alert('Erro', 'Não foi possível adicionar o item');
      } finally {
        setLoadingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(produto._id);
          return newSet;
        });
      }
    };

  // Função para incrementar quantidade no modal de itens selecionados
  const incrementarQuantidadeItem = async (item: CartItem) => {
    if (!comanda || !item?.produto?._id) {
      Alert.alert('Erro', 'Comanda não encontrada ou inválida. Atualizando...');
      try { onUpdateComanda?.(); } catch {}
      return;
    }

    const produtoId = item.produto._id;
    const qtyAtual = item.quantidade || 1;

    // Adicionar ao loading do item específico
    setLoadingItems(prev => new Set(prev).add(produtoId));

    try {
      const payload: any = { produtoId, quantidade: 1 };
      try {
        const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
        if (String(cm).toLowerCase() === 'tablet') payload.origem = 'tablet';
      } catch {}
      await comandaService.addItem(comanda._id, payload);
      onUpdateComanda?.();
      try {
        const cm = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
        if (String(cm).toLowerCase() === 'tablet') {
          Alert.alert('Modo tablet', 'Novo registro criado (linha independente).');
        }
      } catch {}
    } catch (error) {
      console.error('Erro ao incrementar quantidade do item:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o item. Sincronizando comanda...');
      try { onUpdateComanda?.(); } catch {}
    } finally {
      // Remover do loading
      setLoadingItems(prev => {
        const ns = new Set(prev);
        ns.delete(produtoId);
        return ns;
      });
    }
  };

  // Função para decrementar quantidade no modal de itens selecionados
  const decrementarQuantidadeItem = async (item: CartItem) => {
    if (!comanda || !item?.produto?._id) {
      Alert.alert('Erro', 'Comanda não encontrada ou inválida. Atualizando...');
      try { onUpdateComanda?.(); } catch {}
      return;
    }

    const produtoId = item.produto._id;
    const qtyAtual = item.quantidade || 1;

    // Adicionar ao loading do item específico
    setLoadingItems(prev => new Set(prev).add(produtoId));

    try {
      if (qtyAtual > 1) {
        await comandaService.updateItemQuantity(comanda._id, produtoId, qtyAtual - 1);
      } else {
        await comandaService.removeItem(comanda._id, produtoId);
      }
      onUpdateComanda?.();
    } catch (error) {
      console.error('Erro ao atualizar quantidade do item:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o item. Sincronizando comanda...');
      try { onUpdateComanda?.(); } catch {}
    } finally {
      // Remover do loading
      setLoadingItems(prev => {
        const ns = new Set(prev);
        ns.delete(produtoId);
        return ns;
      });
    }
  };

  // Função para fechar comanda
  const fecharComanda = async () => {
    if (!comanda) {
      Alert.alert('Erro', 'Nenhuma comanda selecionada');
      return;
    }

    try {
      await comandaService.close(comanda._id);
      Alert.alert('Sucesso', 'Comanda fechada com sucesso!');
      setFecharComandaModalVisible(false);
      onUpdateComanda();
      onClose();
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      Alert.alert('Erro', 'Não foi possível fechar a comanda');
    }
  };

  const filterProducts = () => {
    console.log('🔍 Aplicando filtros...');
    console.log('🔍 Texto de busca:', searchText);
    console.log('🔍 Categoria selecionada:', selectedCategory);
    console.log('🔍 Total de produtos:', produtos.length);

    let filtered = produtos;

    if (selectedCategory && selectedCategory !== '') {
      filtered = filtered.filter(product => matchesSelectedCategory(product, selectedCategory));
      console.log('🔍 Após filtro de categoria:', filtered.length);
    }

    // Filtro por texto de busca
    if (searchText && searchText.trim() !== '') {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(product => {
        const nomePesquisavel = (product?.nome ?? (product as any)?.nomeProduto ?? (product as any)?.produto?.nome ?? (product as any)?.name ?? '').toLowerCase();
        const descricaoPesquisavel = (product?.descricao ?? '').toLowerCase();
        const categoriaPesquisavel = String(resolveCategoriaNome(product?.categoria) ?? '').toLowerCase();
        return (
          nomePesquisavel.includes(searchLower) ||
          descricaoPesquisavel.includes(searchLower) ||
          categoriaPesquisavel.includes(searchLower)
        );
      });
      console.log('🔍 Após filtro de texto:', filtered.length);
    }

    console.log('🔍 Produtos filtrados final:', filtered.length);
    setFilteredProducts(filtered);
  };

  const handleSearchChange = useCallback((newSearchText: string) => {
    console.log('🔄 Mudança de busca:', newSearchText);
    if (!debounceTimeoutRef.current) {
      debounceTimeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current as any);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setSearchText(newSearchText);
    }, 250);
  }, []);

  const handleFilterChange = useCallback((newSelectedFilter: string) => {
    console.log('🔄 Mudança de filtro:', newSelectedFilter);
    setSelectedCategory(newSelectedFilter);
  }, []);

  const renderProduto = useCallback(({ item: produto }: { item: ProdutoExtendido }) => {
    // Calcular quantidade já adicionada na comanda
    const itemNaComanda = comanda?.itens?.find((item: CartItem) => item.produto._id === produto._id);
    const quantidadeNaComanda = itemNaComanda ? itemNaComanda.quantidade : 0;
    const isLoading = loadingItems.has(produto._id);
    const nomeExibicao = produto?.nome ?? (produto as any)?.nomeProduto ?? (produto as any)?.produto?.nome ?? (produto as any)?.name ?? 'Produto';
    return (
      <View style={[styles.produtoCard, quantidadeNaComanda > 0 && styles.produtoAdicionado]}>
        {/* Linha superior: nome à esquerda e preço + controles à direita */}
        <View style={styles.produtoTopRow}>
          {/* Nome do produto à esquerda */}
          <View style={styles.produtoInfo}>
            <Text style={styles.produtoNome} numberOfLines={1} ellipsizeMode="tail">{nomeExibicao}</Text>
          </View>
          {/* Preço e controles à direita */}
          <View style={styles.produtoRightSection}>
            <Text style={styles.produtoPreco}>R$ {produto.precoVenda?.toFixed(2)}</Text>
            <View style={styles.produtoControles}>
              <TouchableOpacity 
                style={[styles.btnControle, (quantidadeNaComanda === 0 || isLoading) && styles.btnControleDisabled]}
                onPress={() => removerItem(produto)}
                disabled={quantidadeNaComanda === 0 || isLoading}
              >
                <Text style={styles.btnControleText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantidadeDisplay}>{quantidadeNaComanda}</Text>
              <TouchableOpacity 
                style={[styles.btnControle, isLoading && styles.btnControleDisabled]}
                onPress={() => adicionarItem(produto)}
                disabled={isLoading}
              >
                <Text style={styles.btnControleText}>
                  {isLoading ? '...' : (quantidade > 1 ? `+${quantidade}` : '+')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {/* Total em linha separada se houver quantidade */}
        {quantidadeNaComanda > 0 && (
          <View style={styles.produtoTotalContainer}>
            <Text style={styles.produtoTotal}>
              Total: R$ {(quantidadeNaComanda * produto.precoVenda).toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    );
  }, [comanda?.itens, loadingItems, quantidade]);

  // Renderização de item selecionado memoizada para reduzir re-renders
  const renderItemSelecionado = useCallback(({ item, index }: { item: CartItem; index: number }) => {
    const isItemLoading = loadingItems.has(item.produto._id);
    return (
      <View key={`${item._id || item.produto._id}-${index}`} style={styles.itemSelecionadoCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemNome}>{item.nomeProduto}</Text>
          {item.observacoes ? (
            <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '600', marginTop: 2 }}>
              📝 Obs: {item.observacoes}
            </Text>
          ) : null}
          <Text style={styles.itemPreco}>R$ {item.precoUnitario?.toFixed(2)}</Text>
        </View>

        <View style={styles.itemControles}>
          <TouchableOpacity
            style={[styles.btnControle, isItemLoading && styles.btnControleDisabled]}
            onPress={() => decrementarQuantidadeItem(item)}
            disabled={isItemLoading}
          >
            <Text style={styles.btnControleText}>{isItemLoading ? '...' : '-'}</Text>
          </TouchableOpacity>
          <Text style={styles.quantidadeDisplay}>{item.quantidade}</Text>
          <TouchableOpacity
            style={[styles.btnControle, isItemLoading && styles.btnControleDisabled]}
            onPress={() => incrementarQuantidadeItem(item)}
            disabled={isItemLoading}
          >
            <Text style={styles.btnControleText}>{isItemLoading ? '...' : '+'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.itemTotal}>R$ {item.subtotal?.toFixed(2)}</Text>
      </View>
    );
  }, [loadingItems]);

  if (!comanda) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.comandaInfo}>
              <Text style={styles.modalTitle}>Adicionar Produtos</Text>
              <Text style={styles.comandaDetalhes}>
                {comanda?.numeroComanda || comanda?.nomeComanda}
              </Text>
              <Text style={styles.comandaDetalhes}>
                Cliente: {comanda?.cliente?.nome || 'Não informado'}
              </Text>
              <Text style={styles.comandaTotal}>
                Total: R$ {comanda?.total?.toFixed(2) || '0,00'}
              </Text>
            </View>
            <TouchableOpacity style={styles.btnFechar} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setItensSelecionadosModalVisible(true)}
            >
              <Ionicons name="list-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Itens Selecionados</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={() => setPaymentSplitModalVisible(true)}
            >
              <Ionicons name="cash-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Dividir Pagamento</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                styles.closeComandaButton,
                // Lógica para desabilitar se houver saldo devedor
                (() => {
                   const total = comanda?.total || 0;
                   const pagos = comanda?.caixaVendas 
                     ? comanda.caixaVendas.reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0)
                     : 0;
                   const restante = Math.max(0, total - pagos);
                   return restante > 0.05; // Tolerância
                })() && { backgroundColor: '#ccc' }
              ]}
              onPress={() => {
                   const total = comanda?.total || 0;
                   const pagos = comanda?.caixaVendas 
                     ? comanda.caixaVendas.reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0)
                     : 0;
                   const restante = Math.max(0, total - pagos);
                   if (restante > 0.05) {
                     Alert.alert('Saldo Pendente', `A comanda possui um saldo restante de R$ ${restante.toFixed(2)}. Realize o pagamento total antes de fechar.`);
                     return;
                   }
                   setFecharComandaModalVisible(true);
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Fechar Comanda</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {/* Substituído ScrollView + FlatList aninhados por FlatList com ListHeaderComponent para evitar nesting */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando produtos...</Text>
            </View>
          ) : (
            <FlatList
              style={styles.modalBody}
              data={filteredProducts}
              renderItem={renderProduto}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.produtosList}
              extraData={[filteredProducts, comanda, loadingItems, quantidade]}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews
              ListHeaderComponent={(
                <>
                  <SearchAndFilter
                    searchText={searchText}
                    onSearchChange={handleSearchChange}
                    selectedFilter={selectedCategory}
                    filters={categories}
                    onFilterChange={handleFilterChange}
                    searchPlaceholder="Buscar produtos..."
                  />

                  {/* Controle de Quantidade e Observações */}
                  <View style={styles.inputsRow}>
                    <View style={styles.quantidadeControl}>
                      <Text style={styles.quantidadeLabel}>Qtd:</Text>
                      <TextInput
                        style={styles.quantidadeInput}
                        value={quantidade.toString()}
                        onChangeText={(text) => setQuantidade(parseInt(text) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.obsControl}>
                      <Text style={styles.quantidadeLabel}>Obs:</Text>
                      <TextInput
                        style={styles.obsInput}
                        value={observacoes}
                        onChangeText={setObservacoes}
                        placeholder="Ex: sem cebola, gelo e limão..."
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                </>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchText || selectedCategory
                      ? 'Nenhum produto encontrado com os filtros aplicados'
                      : 'Nenhum produto disponível'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>

      {/* Modal de Itens Selecionados */}
      <Modal visible={itensSelecionadosModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.comandaInfo}>
                <Text style={styles.modalTitle}>Itens Selecionados</Text>
                <Text style={styles.comandaDetalhes}>
                  {comanda?.numeroComanda || comanda?.nomeComanda}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.btnFechar} 
                onPress={() => setItensSelecionadosModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Lista de itens selecionados */}
            <FlatList
              data={comanda?.itens || []}
              keyExtractor={(item, idx) => (item._id || item.produto?._id || `item-${idx}`)}
              renderItem={renderItemSelecionado}
              contentContainerStyle={{ padding: 15 }}
              extraData={[comanda?.itens, loadingItems]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.semItens}>Nenhum item selecionado</Text>}
              ListFooterComponent={
                <View style={styles.totalGeralContainer}>
                  <Text style={styles.totalGeralText}>
                    Total: R$ {((comanda?.itens || []).reduce((acc, it) => acc + (it.subtotal ?? (it.quantidade * (it.precoUnitario ?? 0))), 0)).toFixed(2)}
                  </Text>
                </View>
              }
              getItemLayout={(data, index) => ({ length: 70, offset: 70 * index, index })}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação para Fechar Comanda */}
      <Modal visible={fecharComandaModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmHeader}>
              <Ionicons name="warning-outline" size={48} color="#ff9800" />
              <Text style={styles.confirmTitle}>Fechar Comanda</Text>
            </View>
            
            <Text style={styles.confirmMessage}>
              Tem certeza que deseja fechar a comanda {comanda?.numeroComanda || comanda?.nomeComanda}?
            </Text>
            
            <Text style={styles.confirmSubMessage}>
              Total: R$ {comanda?.total?.toFixed(2)}
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setFecharComandaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, styles.confirmButtonPrimary]}
                onPress={fecharComanda}
              >
                <Text style={styles.confirmButtonText}>Fechar Comanda</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {variationProduct && (
        <VariationSelectorModal
          visible={variationModalVisible}
          product={{
            _id: String(variationProduct._id),
            nome: variationProduct.nome,
            descricao: variationProduct.descricao,
            precoVenda: variationProduct.precoVenda,
            categoria: variationProduct.categoria,
            categoriaId: (variationProduct as any)?.categoriaId,
            ativo: true,
            disponivel: true,
            temVariacao: true,
          } as any}
          onClose={() => { setVariationModalVisible(false); setVariationProduct(null); }}
          onConfirm={handleVariationConfirm}
          onConfirmWhole={handleVariationConfirmWhole}
        />
      )}

      {/* Modal de Divisão de Pagamento */}
      <PaymentSplitModal 
        visible={paymentSplitModalVisible}
        sale={comanda as any} 
        onClose={() => setPaymentSplitModalVisible(false)}
        onPaymentSuccess={async (isFullPayment) => {
          onUpdateComanda();
          
          if (isFullPayment) {
            // Se o pagamento for total, fechas os modais e finaliza a comanda
            setPaymentSplitModalVisible(false);
            
            try {
              // Tenta finalizar a comanda no backend se ainda estiver aberta
              if (comanda?._id && comanda.status !== 'fechada') {
                 // Pequeno delay para garantir que o backend processou os pagamentos anteriores se necessário,
                 // mas geralmente não é preciso.
                 await comandaService.close(comanda._id);
              }
            } catch (error) {
              console.error('Erro ao finalizar comanda automaticamente:', error);
            }
            
            // Fecha o modal principal para voltar à lista de comandas
            onClose();
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '95%',
    height: '90%',
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#27ae60',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  comandaInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  comandaDetalhes: {
    fontSize: 14,
    color: 'white',
    marginBottom: 2,
  },
  comandaTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  btnFechar: {
    padding: 5,
  },
  
  // Novos estilos para botões de ação
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 8, // Use gap instead of margin
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column', // Stack icon and text vertically to save horizontal space? Or keep row but tighter? 
    // User said "muito estreito", so horizontal space is the issue. Vertical stacking (Icon top, Text bottom) is a great way to save horizontal space.
    // Let's try centered column layout for buttons on mobile.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    // marginHorizontal removed in favor of gap in container
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 60,
  },
  closeComandaButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 11, // Smaller font
    fontWeight: '600',
    marginTop: 4, // Margin top because we stacked vertically
    marginLeft: 0, // Reset left margin
    textAlign: 'center',
  },
  
  modalBody: {
    flex: 1,
    padding: 15,
  },
  categoriasContainer: {
    marginBottom: 15,
  },
  categoriaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoriaBtnActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoriaIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  categoriaText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoriaTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  buscaContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  buscaInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    backgroundColor: '#f9f9f9',
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  quantidadeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  obsControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  obsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#333',
  },
  quantidadeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
    color: '#333',
  },
  quantidadeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#fff',
     minWidth: 60,
   },
   produtosList: {
     flex: 1,
   },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  produtoCard: {
    flexDirection: 'column',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  produtoAdicionado: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  produtoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  produtoInfo: {
    flex: 1,
    marginBottom: 0,
    marginRight: 12,
  },
  produtoNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  produtoRightSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  produtoPreco: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27ae60',
    marginRight: 12,
  },
  produtoControles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnControle: {
    width: 35,
    height: 35,
    borderRadius: 17,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  btnControleDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  btnControleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  quantidadeDisplay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  produtoTotalContainer: {
     marginTop: 8,
     paddingTop: 8,
     borderTopWidth: 1,
     borderTopColor: '#e0e0e0',
   },
   produtoTotal: {
     fontSize: 14,
     color: '#4caf50',
     fontWeight: '600',
     textAlign: 'right',
   },
  semProdutos: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
  },
  
  // Estilos para modal de itens selecionados
  itemSelecionadoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemInfo: {
    flex: 1,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemPreco: {
    fontSize: 14,
    color: '#666',
  },
  itemControles: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    minWidth: 80,
    textAlign: 'right',
  },
  semItens: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
    fontStyle: 'italic',
  },
  totalGeralContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#27ae60',
    borderRadius: 10,
    alignItems: 'center',
  },
  totalGeralText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  
  // Estilos para modal de confirmação
  confirmModalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  confirmSubMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    textAlign: 'center',
    marginBottom: 25,
  },
  confirmButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonPrimary: {
    backgroundColor: '#dc3545',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
