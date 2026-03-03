import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { productService, categoryService, typeService, unidadeMedidaService, setorImpressaoService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { testApiConnection, getCurrentBaseUrl } from '../../src/services/api';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isLargeScreen = width > 768;

interface Product {
  _id: string;
  nome: string;
  descricao: string;
  precoCusto: number;
  precoVenda: number;
  categoria: string;
  tipo: string;
  grupo: string;
  unidade: string;
  ativo: boolean;
  quantidade: number;
  disponivel: boolean;
  ncm?: string;
  cest?: string;
  cfop?: string;
  origem?: number;
}

interface Categoria {
  _id: string;
  id?: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface Tipo {
  _id: string;
  id?: string;
  nome: string;
  ativo: boolean;
}

interface UnidadeMedida {
  _id: string;
  id?: string;
  nome: string;
  sigla: string;
  ativo: boolean;
}

interface SetorImpressao {
  id: string;
  nome: string;
  modoEnvio: 'impressora' | 'whatsapp';
}

export default function AdminProdutosScreen() {
  const { hasPermission } = useAuth() as any;
  const [products, setProducts] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'nome' | 'categoria' | 'preco'>('nome');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [dbTarget, setDbTarget] = useState('');
  const [apiHost, setApiHost] = useState('');
  const [setores, setSetores] = useState<SetorImpressao[]>([]);
  const [selectedSetores, setSelectedSetores] = useState<string[] | null>(null);

  // Filtros para o SearchAndFilter
  const categoryFilters = [
    { key: '', label: 'Todas' },
    ...(categorias || []).map(categoria => ({ key: categoria.nome, label: categoria.nome }))
  ];

  const statusFilters = [
    { key: '', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'inativo', label: 'Inativos' }
  ];

  const handleFilterChange = (filterKey: string) => {
    if (statusFilters.some(filter => filter.key === filterKey)) {
      // É um filtro de status
      if (filterKey === '') {
        setFilterActive(null);
      } else if (filterKey === 'ativo') {
        setFilterActive(true);
      } else if (filterKey === 'inativo') {
        setFilterActive(false);
      }
    } else {
      // É um filtro de categoria
      setSelectedCategory(filterKey);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    precoCusto: '',
    precoVenda: '',
    categoria: '',
    tipo: '',
    grupo: '',
    unidade: 'un',
    ativo: true,
    quantidade: '0',
    disponivel: true,
    ncm: '',
    cest: '',
    cfop: '',
    origem: '0',
  });

  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    const off = events.on('dbTargetChanged', () => {
      loadInitialData();
    });
    return () => { off && off(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const base = getCurrentBaseUrl();
        const res = await testApiConnection(base, undefined);
        if (res?.ok) {
          const host = new URL(base).hostname;
          setApiHost(host);
          setDbTarget(String(res?.data?.dbTarget || ''));
        }
      } catch {}
    })();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([
      loadProducts(),
      loadCategorias(),
      loadTipos(),
      loadUnidades(),
      loadSetores()
    ]);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getAll();
      setProducts(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      Alert.alert('Erro', 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorias = async () => {
    try {
      const response = await categoryService.getAll();
      setCategorias(Array.isArray(response) ? response : []);
    } catch (error: any) {
      console.error('❌ Erro ao carregar categorias:', error);
    }
  };

  const loadTipos = async () => {
    try {
      const tipos = await typeService.getAll();
      setTipos(Array.isArray(tipos) ? tipos : []);
    } catch (error: any) {
      console.error('Erro ao carregar tipos:', error);
    }
  };

  const loadUnidades = async () => {
    try {
      const unidades = await unidadeMedidaService.getAll();
      setUnidades(Array.isArray(unidades) ? unidades : []);
    } catch (error: any) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const loadSetores = async () => {
    try {
      const body = await setorImpressaoService.getAll();
      const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      const mapped: SetorImpressao[] = list.map((s: any) => ({ id: String(s.id ?? s._id), nome: s.nome, modoEnvio: String(s.modoEnvio || 'impressora') as any }));
      setSetores(mapped);
    } catch (error: any) {
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.nome || !formData.precoVenda || !formData.categoria) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios (Nome, Preço de Venda, Categoria)');
      return;
    }

    setLoading(true);
    try {
      const parseValue = (val: any) => {
        if (!val) return 0;
        return parseFloat(val.toString().replace(',', '.')) || 0;
      };

      const productData: any = {
        nome: formData.nome,
        descricao: formData.descricao,
        precoCusto: parseValue(formData.precoCusto),
        precoVenda: parseValue(formData.precoVenda),
        categoria: formData.categoria,
        tipo: formData.tipo,
        grupo: formData.grupo,
        unidade: formData.unidade,
        ativo: formData.ativo,
        quantidade: parseValue(formData.quantidade),
        disponivel: formData.disponivel,
        ncm: formData.ncm,
        cest: formData.cest,
        cfop: formData.cfop,
        origem: parseInt(formData.origem) || 0,
      };

      if (selectedSetores !== null) {
        productData.setoresImpressaoIds = selectedSetores.map((id) => Number(id));
      }

      let response;
      if (editingProduct) {
        response = await productService.update(editingProduct._id, productData);
      } else {
        response = await productService.create(productData);
      }

      Alert.alert('Sucesso', editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
      setModalVisible(false);
      loadInitialData();
    } catch (error: any) {
      console.error('❌ Erro ao salvar produto:', error);
      Alert.alert('Erro', 'Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (product: Product) => {
    setFormData({
      nome: product.nome || '',
      descricao: product.descricao || '',
      precoCusto: (product.precoCusto ?? 0).toString(),
      precoVenda: (product.precoVenda ?? 0).toString(),
      categoria: product.categoria || '',
      tipo: product.tipo || '',
      grupo: product.grupo || '',
      unidade: product.unidade || 'un',
      ativo: product.ativo !== undefined ? product.ativo : true,
      quantidade: (product.quantidade ?? 0).toString(),
      disponivel: product.disponivel !== undefined ? product.disponivel : true,
      ncm: product.ncm || '',
      cest: product.cest || '',
      cfop: product.cfop || '',
      origem: (product.origem ?? 0).toString(),
    });
    setEditingProduct(product);
    setSelectedSetores(null);
    try {
      const resp = await productService.getById(product._id);
      const sids = Array.isArray(resp?.data?.setoresImpressaoIds) ? resp.data.setoresImpressaoIds.map((n: any) => String(n)) : [];
      setSelectedSetores(sids);
    } catch {
      setSelectedSetores([]);
    }
    setModalVisible(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o produto "${product.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(product._id);
              Alert.alert('Sucesso', 'Produto excluído com sucesso');
              loadInitialData();
            } catch (error: any) {
              Alert.alert('Erro', 'Erro ao excluir produto');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      precoCusto: '',
      precoVenda: '',
      categoria: '',
      tipo: '',
      grupo: '',
      unidade: 'un',
      ativo: true,
      quantidade: '0',
      disponivel: true,
      ncm: '',
      cest: '',
      cfop: '',
      origem: '0',
    });
    setEditingProduct(null);
    setSelectedSetores([]);
  };

  const getFilteredAndSortedProducts = () => {
    const q = String(searchText || '').toLowerCase();
    let filtered = products.filter(product => {
      const nome = String(product?.nome || '').toLowerCase();
      const categoria = String(product?.categoria || '').toLowerCase();
      const descricao = String(product?.descricao || '').toLowerCase();
      return (nome.includes(q) || categoria.includes(q) || descricao.includes(q)) &&
             (!selectedCategory || product.categoria === selectedCategory) &&
             (filterActive === null || product.ativo === filterActive);
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nome': return a.nome.localeCompare(b.nome);
        case 'categoria': return a.categoria.localeCompare(b.categoria);
        case 'preco': return a.precoVenda - b.precoVenda;
        default: return 0;
      }
    });

    return filtered;
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={[
        styles.productCard,
        viewMode === 'grid' ? styles.gridCard : styles.listCard
      ]}
      onPress={() => handleEditProduct(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.nome}</Text>
          <Text style={styles.productCategory}>{item.categoria}</Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEditProduct(item)}>
            <SafeIcon name="pencil" size={18} color="#2196F3" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteProduct(item)}>
            <SafeIcon name="trash" size={18} color="#f44336" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>
      
      {viewMode === 'list' && (
        <Text style={styles.productDescription} numberOfLines={2}>{item.descricao}</Text>
      )}
      
      <View style={styles.priceContainer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Venda:</Text>
          <Text style={[styles.priceValue, styles.sellPrice]}>R$ {item.precoVenda.toFixed(2)}</Text>
        </View>
      </View>
      
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: item.ativo ? '#E8F5E8' : '#FFEBEE' }]}>
          <Text style={[styles.statusText, { color: item.ativo ? '#4CAF50' : '#f44336' }]}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Gerenciar Produtos</Text>
        {dbTarget ? (
           <View style={styles.dbBadge}>
             <SafeIcon name="server-outline" size={12} color="#64748B" fallbackText="DB" />
             <Text style={styles.dbText}>{dbTarget.toUpperCase()}</Text>
           </View>
        ) : null}
      </View>

      <View style={styles.searchSection}>
        <View style={{ flex: 1 }}>
          <SearchAndFilter
            searchText={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Buscar produtos..."
            filters={[...categoryFilters, ...statusFilters]}
            selectedFilter={selectedCategory || (filterActive === null ? '' : filterActive ? 'ativo' : 'inativo')}
            onFilterChange={handleFilterChange}
            showFilters={true}
          />
        </View>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <SafeIcon name="add" size={24} color="#fff" fallbackText="+" />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsSection}>
        <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const sortOptions = ['nome', 'categoria', 'preco'] as const;
              const nextIndex = (sortOptions.indexOf(sortBy) + 1) % sortOptions.length;
              setSortBy(sortOptions[nextIndex]);
            }}
          >
            <SafeIcon name="swap-vertical" size={16} color="#64748B" fallbackText="↕" />
            <Text style={styles.sortText}>
              Ordenar por: {sortBy === 'nome' ? 'Nome' : sortBy === 'categoria' ? 'Categoria' : 'Preço'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('grid')}
            >
              <SafeIcon name="grid" size={18} color={viewMode === 'grid' ? '#2196F3' : '#94A3B8'} fallbackText="▦" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <SafeIcon name="list" size={18} color={viewMode === 'list' ? '#2196F3' : '#94A3B8'} fallbackText="≡" />
            </TouchableOpacity>
          </View>
      </View>
    </View>
  );

  if (!hasPermission('produtos')) return null;

  const filteredProducts = getFilteredAndSortedProducts();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenIdentifier screenName="Admin - Produtos" />
      <View style={styles.container}>
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          numColumns={viewMode === 'grid' ? (isLargeScreen ? 3 : 2) : 1}
          key={viewMode + (isLargeScreen ? '_large' : '_small')}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadInitialData} colors={['#2196F3']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SafeIcon name="cube-outline" size={48} color="#CBD5E1" fallbackText="📦" />
              <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
            </View>
          }
        />

        {/* Modal de Cadastro/Edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
             <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                   <SafeIcon name="close" size={24} color="#64748B" fallbackText="X" />
                </TouchableOpacity>
             </View>

             <KeyboardAvoidingView
               style={{ flex: 1 }}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
             >
                <ScrollView 
                   style={styles.modalContent}
                   contentContainerStyle={styles.formContentContainer}
                   keyboardShouldPersistTaps="handled"
                >
                   {/* Layout centralizado para telas grandes */}
                   <View style={styles.formCard}>
                      
                      {/* Grupo: Informações Básicas */}
                      <View style={styles.formSection}>
                         <Text style={styles.sectionLabel}>Informações Básicas</Text>
                         
                         <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nome do Produto</Text>
                            <TextInput
                              style={styles.input}
                              value={formData.nome}
                              onChangeText={(t) => setFormData({...formData, nome: t})}
                              placeholder="Ex: Coca-Cola Lata"
                              placeholderTextColor="#94A3B8"
                            />
                         </View>

                         <View style={styles.inputGroup}>
                            <Text style={styles.label}>Descrição</Text>
                            <TextInput
                              style={[styles.input, styles.textArea]}
                              value={formData.descricao}
                              onChangeText={(t) => setFormData({...formData, descricao: t})}
                              placeholder="Detalhes do produto (opcional)"
                              placeholderTextColor="#94A3B8"
                              multiline
                            />
                         </View>
                      </View>

                      {/* Grupo: Classificação Unificada (Linha Única Forçada sem Scroll Externo) */}
                      <View style={styles.formSection}>
                         <Text style={styles.sectionLabel}>Classificação & Impressão</Text>
                         
                         {/* Container Row que força tudo na mesma linha */}
                         <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                             {/* 1. Categoria */}
                             <View style={{ flex: 1.2, minWidth: 0 }}>
                               <Text style={[styles.label, { fontSize: 11, marginBottom: 4 }]}>Categoria</Text>
                               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                  {(categorias || []).map(cat => (
                                    <TouchableOpacity
                                      key={cat._id}
                                      style={[
                                        styles.chip, 
                                        formData.categoria === cat.nome && styles.chipActive,
                                        { paddingHorizontal: 8, paddingVertical: 4 }
                                      ]}
                                      onPress={() => setFormData({...formData, categoria: cat.nome})}
                                    >
                                       <Text style={[styles.chipText, formData.categoria === cat.nome && styles.chipTextActive, { fontSize: 11 }]} numberOfLines={1}>
                                         {cat.nome}
                                       </Text>
                                    </TouchableOpacity>
                                  ))}
                               </ScrollView>
                             </View>

                             {/* 2. Setor */}
                             <View style={{ flex: 1.2, minWidth: 0 }}>
                               <Text style={[styles.label, { fontSize: 11, marginBottom: 4 }]}>Setor</Text>
                               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                 {(setores || []).map((s) => (
                                   <TouchableOpacity
                                     key={s.id}
                                     style={[
                                       styles.chip, 
                                       (selectedSetores || []).includes(String(s.id)) && styles.chipActive,
                                       { paddingHorizontal: 8, paddingVertical: 4 }
                                     ]}
                                     onPress={() => {
                                       const id = String(s.id);
                                       setSelectedSetores((prev) => {
                                         const current = prev || [];
                                         return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
                                       });
                                     }}
                                   >
                                     <Text style={[styles.chipText, (selectedSetores || []).includes(String(s.id)) && styles.chipTextActive, { fontSize: 11 }]} numberOfLines={1}>
                                       {s.nome}
                                     </Text>
                                   </TouchableOpacity>
                                 ))}
                               </ScrollView>
                             </View>

                             {/* 3. Tipo */}
                             <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[styles.label, { fontSize: 11, marginBottom: 4 }]}>Tipo</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                  {(tipos || []).map(t => (
                                    <TouchableOpacity
                                      key={t._id}
                                      style={[
                                        styles.chip, 
                                        formData.tipo === t.nome && styles.chipActive,
                                        { paddingHorizontal: 8, paddingVertical: 4 }
                                      ]}
                                      onPress={() => setFormData({...formData, tipo: t.nome})}
                                    >
                                      <Text style={[styles.chipText, formData.tipo === t.nome && styles.chipTextActive, { fontSize: 11 }]} numberOfLines={1}>
                                        {t.nome}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                             </View>
                             
                             {/* 4. Unidade */}
                             <View style={{ flex: 0.8, minWidth: 0 }}>
                                <Text style={[styles.label, { fontSize: 11, marginBottom: 4 }]}>Unid.</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                  {(unidades || []).map(u => (
                                    <TouchableOpacity
                                      key={u._id}
                                      style={[
                                        styles.chip, 
                                        formData.unidade === u.sigla && styles.chipActive,
                                        { paddingHorizontal: 8, paddingVertical: 4 }
                                      ]}
                                      onPress={() => setFormData({...formData, unidade: u.sigla})}
                                    >
                                      <Text style={[styles.chipText, formData.unidade === u.sigla && styles.chipTextActive, { fontSize: 11 }]} numberOfLines={1}>
                                        {u.sigla}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                             </View>
                         </View>
                      </View>

                      {/* Grupo: Preços */}
                      <View style={styles.formSection}>
                         <Text style={styles.sectionLabel}>Preços</Text>
                         <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                               <Text style={styles.label}>Preço de Custo (R$)</Text>
                               <TextInput
                                 style={styles.input}
                                 value={formData.precoCusto}
                                 onChangeText={(t) => setFormData({...formData, precoCusto: t})}
                                 keyboardType="numeric"
                                 placeholder="0.00"
                               />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                               <Text style={[styles.label, { color: '#2196F3' }]}>Preço de Venda (R$)</Text>
                               <TextInput
                                 style={[styles.input, { borderColor: '#BBDEFB', backgroundColor: '#F0F9FF' }]}
                                 value={formData.precoVenda}
                                 onChangeText={(t) => setFormData({...formData, precoVenda: t})}
                                 keyboardType="numeric"
                                 placeholder="0.00"
                               />
                            </View>
                         </View>
                      </View>

                      {/* Grupo: Estoque e Controles */}
                      <View style={styles.formSection}>
                         <Text style={styles.sectionLabel}>Estoque e Disponibilidade</Text>
                         <View style={styles.inputGroup}>
                            <Text style={styles.label}>Quantidade em Estoque</Text>
                            <TextInput
                               style={styles.input}
                               value={formData.quantidade}
                               onChangeText={(t) => setFormData({...formData, quantidade: t})}
                               keyboardType="numeric"
                               placeholder="0"
                            />
                         </View>

                         <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Produto Ativo</Text>
                            <Switch
                              value={formData.ativo}
                              onValueChange={(v) => setFormData({...formData, ativo: v})}
                              trackColor={{ false: '#E2E8F0', true: '#2196F3' }}
                              thumbColor={'#fff'}
                            />
                         </View>

                         <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Disponível para Venda</Text>
                            <Switch
                              value={formData.disponivel}
                              onValueChange={(v) => setFormData({...formData, disponivel: v})}
                              trackColor={{ false: '#E2E8F0', true: '#2196F3' }}
                              thumbColor={'#fff'}
                            />
                          </View>
                       </View>

                      {/* Grupo: Dados Fiscais */}
                      <View style={styles.formSection}>
                         <Text style={styles.sectionLabel}>Dados Fiscais</Text>
                         <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                               <Text style={[styles.label, { color: '#f44336' }]}>NCM (Obrigatório)*</Text>
                               <TextInput
                                 style={[styles.input, { borderColor: '#FFCDD2' }]}
                                 value={formData.ncm}
                                 onChangeText={(t) => setFormData({...formData, ncm: t})}
                                 keyboardType="numeric"
                                 placeholder="Ex: 22021000"
                               />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                               <Text style={styles.label}>CEST</Text>
                               <TextInput
                                 style={styles.input}
                                 value={formData.cest}
                                 onChangeText={(t) => setFormData({...formData, cest: t})}
                                 keyboardType="numeric"
                                 placeholder="Ex: 0300700"
                               />
                            </View>
                         </View>
                         
                         <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                               <Text style={styles.label}>CFOP</Text>
                               <TextInput
                                 style={styles.input}
                                 value={formData.cfop}
                                 onChangeText={(t) => setFormData({...formData, cfop: t})}
                                 keyboardType="numeric"
                                 placeholder="Ex: 5102"
                               />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                               <Text style={styles.label}>Origem (0-8)</Text>
                               <TextInput
                                 style={styles.input}
                                 value={formData.origem}
                                 onChangeText={(t) => setFormData({...formData, origem: t})}
                                 keyboardType="numeric"
                                 maxLength={1}
                                 placeholder="Ex: 0"
                               />
                            </View>
                         </View>
                      </View>

                   </View>
                   <View style={{height: 40}} />
                </ScrollView>
             </KeyboardAvoidingView>
             
             <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setModalVisible(false)}>
                   <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleSaveProduct}>
                   <Text style={styles.modalButtonTextPrimary}>Salvar Produto</Text>
                </TouchableOpacity>
             </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  dbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  dbText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    padding: 6,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridCard: {
    flex: 1,
    margin: 6,
  },
  listCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  productDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  priceContainer: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  sellPrice: {
    color: '#2196F3',
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  modalContent: {
    flex: 1,
  },
  formContentContainer: {
    padding: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 1200, // Aumentado para melhor uso em Desktop
    alignSelf: 'center', // Centraliza o card
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  formSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#2196F3',
  },
  chipText: {
    fontSize: 14,
    color: '#64748B',
  },
  chipTextActive: {
    color: '#0284C7',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#334155',
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});