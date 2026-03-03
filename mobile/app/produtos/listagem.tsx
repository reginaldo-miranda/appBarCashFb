import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { events } from '../../src/utils/eventBus';
import { testApiConnection, getCurrentBaseUrl } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { useProduct } from '../../src/contexts/ProductContext';
import { productService, categoryService, setorImpressaoService } from '../../src/services/api';
import SearchAndFilter from '../../src/components/SearchAndFilter';

interface Produto {
  _id: string;
  id?: number;
  nome: string;
  descricao?: string;
  precoCusto: number;
  precoVenda: number;
  categoria: string;
  grupo?: string;
  unidade: string;
  quantidade: number;
  ativo: boolean;
  disponivel: boolean;
  dadosFiscais?: string;
  imagem?: string;
  tempoPreparoMinutos?: number;
  dataInclusao?: Date;
  // Fiscais
  ncm?: string;
  cest?: string;
  cfop?: string;
  csosn?: string;
  origem?: number | string;
}

interface Categoria {
  _id: string;
  nome: string;
  ativo: boolean;
}

export default function ListagemProdutos() {
  const { hasPermission } = useAuth() as any;
  const { refreshTrigger, lastAction } = useProduct();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [showMissingFiscal, setShowMissingFiscal] = useState(false);
  const [savingSector, setSavingSector] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbTarget, setDbTarget] = useState('');
  const [apiHost, setApiHost] = useState('');

  const loadProdutos = async (sectorId?: string) => {
    try {
      const reqProducts = sectorId ? productService.listBySector(Number(sectorId)) : productService.getAll();
      const produtosResponse = await reqProducts;
      setProdutos(produtosResponse?.data || []);

      try {
        const categoriasResponse = await categoryService.getAll();
        setCategorias(categoriasResponse || []);
      } catch {
        setCategorias([]);
      }

      try {
        const setoresResponse = await setorImpressaoService.list();
        setSetores((setoresResponse?.data || []).map((s: any) => ({ id: String(s.id ?? s._id), nome: s.nome })));
      } catch {
        setSetores([]);
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  };

  const filterProdutos = () => {
    let filtered = produtos;

    // Filtro por categoria
    if (selectedCategory) {
      filtered = filtered.filter(produto => produto.categoria === selectedCategory);
    }

    // Filtro por dados fiscais
    if (showMissingFiscal) {
      filtered = filtered.filter(produto => !produto.ncm || String(produto.ncm).trim() === '');
    }

    // Filtro por texto de busca
    if (searchText.trim()) {
      filtered = filtered.filter(produto =>
        produto.nome.toLowerCase().includes(searchText.toLowerCase()) ||
        produto.categoria.toLowerCase().includes(searchText.toLowerCase()) ||
        (produto.grupo && produto.grupo.toLowerCase().includes(searchText.toLowerCase())) ||
        (produto.descricao && produto.descricao.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    setFilteredProdutos(filtered);
  };

  useEffect(() => {
    loadProdutos(selectedSectorId || undefined);
  }, [selectedSectorId]);

  useEffect(() => {
    filterProdutos();
  }, [searchText, produtos, selectedCategory, showMissingFiscal]);

  // Escuta mudanças no refreshTrigger para atualizar automaticamente
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadProdutos();
      if (lastAction === 'create') {
        setTimeout(() => { Alert.alert('Sucesso', 'Produto cadastrado com sucesso!'); }, 500);
      } else if (lastAction === 'update') {
        setTimeout(() => { Alert.alert('Sucesso', 'Alterado com sucesso'); }, 500);
      }
    }
  }, [refreshTrigger, lastAction]);

  // Atualiza a lista sempre que a tela receber foco (retorno da edição)
  useFocusEffect(
    useCallback(() => {
      loadProdutos();
    }, [])
  );

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

    const off = events.on('dbTargetChanged', async () => {
      const base = getCurrentBaseUrl();
      const res = await testApiConnection(base, undefined);
      if (res?.ok) {
        const host = new URL(base).hostname;
        setApiHost(host);
        setDbTarget(String(res?.data?.dbTarget || ''));
      }
      await loadProdutos();
    });
    return () => { off && off(); };
  }, []);

  // Verificar permissões
  if (!hasPermission('produtos')) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para acessar esta tela
        </Text>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProdutos();
    setRefreshing(false);
    
    // Mostra mensagem de confirmação após atualização manual
    setTimeout(() => {
      Alert.alert('Sucesso', 'Lista de produtos atualizada!');
    }, 300);
  };

  const handleEdit = (produto: Produto) => {
    try {
      const pid = (produto.id !== undefined && produto.id !== null) ? String(produto.id) : String(produto._id || '');
      if (!pid) {
        Alert.alert('Erro', 'Produto sem ID válido para edição.');
        return;
      }
      router.push(`/produtos/cadastro?id=${pid}` as any);
    } catch (error) {
      console.error('Erro ao navegar para edição:', error);
      Alert.alert('Erro', 'Erro ao abrir tela de edição. Tente novamente.');
    }
  };

  const handleDelete = async (produto: Produto) => {
    Alert.alert(
      'Excluir Produto',
      `Tem certeza que deseja excluir o produto "${produto.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const pid = (produto.id !== undefined && produto.id !== null) ? produto.id : (produto._id as any);
              await productService.delete(pid);
              
              // Recarregar a lista completa para garantir consistência
              await loadProdutos();
              
              Alert.alert('Sucesso', 'Produto excluído com sucesso!');
            } catch (error) {
              console.error('Erro ao excluir produto:', error);
              Alert.alert('Erro', 'Erro ao excluir produto. Tente novamente.');
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const toggleStatus = async (produto: Produto) => {
    const newStatus = !produto.ativo;
    const action = newStatus ? 'ativar' : 'desativar';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Produto`,
      `Deseja ${action} o produto "${produto.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: action.charAt(0).toUpperCase() + action.slice(1), 
          onPress: async () => {
            try {
              setLoading(true);
              const pid = (produto.id !== undefined && produto.id !== null) ? produto.id : (produto._id as any);
              await productService.update(pid, { ativo: newStatus });
              
              // Recarregar a lista completa para garantir consistência
              await loadProdutos();
              
              Alert.alert('Sucesso', `Produto ${action}do com sucesso!`);
            } catch (error) {
              console.error(`Erro ao ${action} produto:`, error);
              Alert.alert('Erro', `Erro ao ${action} produto. Tente novamente.`);
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const getStatusColor = (produto: Produto) => {
    if (!produto.ativo) return '#f44336';
    if (!produto.disponivel) return '#ff9800';
    if (produto.quantidade <= 0) return '#ff9800';
    return '#4caf50';
  };

  const getStatusText = (produto: Produto) => {
    if (!produto.ativo) return 'Inativo';
    if (!produto.disponivel) return 'Indisponível';
    if (produto.quantidade <= 0) return 'Sem Estoque';
    return 'Ativo';
  };

  const renderProduto = ({ item }: { item: Produto }) => (
    <View style={styles.produtoCard}>
      <View style={styles.produtoHeader}>
        <View style={styles.produtoInfo}>
          <Text style={styles.produtoNome}>{item.nome}</Text>
          {item.descricao && <Text style={styles.produtoDescricao}>{item.descricao}</Text>}
          <View style={styles.produtoDetails}>
            <Text style={styles.produtoCategoria}>{item.categoria}</Text>
            <Text style={styles.produtoPreco}>R$ {item.precoVenda.toFixed(2)}</Text>
          </View>
          <View style={styles.produtoEstoque}>
            <Text style={styles.estoqueText}>
              Estoque: {item.quantidade} {item.unidade}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) }]}>
              <Text style={styles.statusText}>{getStatusText(item)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.produtoActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={16} color="#2196F3" />
          <Text style={[styles.actionText, { color: '#2196F3' }]}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => toggleStatus(item)}
        >
          <Ionicons 
            name={item.ativo ? "pause" : "play"} 
            size={16} 
            color={item.ativo ? "#ff9800" : "#4caf50"} 
          />
          <Text style={[styles.actionText, { color: item.ativo ? "#ff9800" : "#4caf50" }]}>
            {item.ativo ? 'Desativar' : 'Ativar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={16} color="#f44336" />
          <Text style={[styles.actionText, { color: '#f44336' }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
      </View>
    );
  }

  // Configuração dos filtros de categoria
  const categoryFilters = [
    { key: '', label: 'Todas', icon: 'apps' },
    ...categorias.map(categoria => ({
      key: categoria.nome,
      label: categoria.nome,
      icon: 'pricetag'
    }))
  ];

  const handleFilterChange = (filterKey: string) => {
    setSelectedCategory(filterKey);
  };

  const handleSectorChange = (id: string) => {
    setSelectedSectorId(prev => (prev === id ? '' : id));
  };

  const saveSelectedSector = async () => {
    if (!selectedSectorId) {
      Alert.alert('Erro', 'Selecione um setor de impressão');
      return { ok: false } as any;
    }
    try {
      setSavingSector(true);
      const resp = await setorImpressaoService.select(Number(selectedSectorId));
      const ok = !!resp?.data?.ok;
      if (ok) {
        setSuccessToast(true);
        setTimeout(() => setSuccessToast(false), 3000);
        return { ok: true } as any;
      }
      Alert.alert('Erro', 'Falha ao gravar setor de impressão');
      return { ok: false } as any;
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase().includes('network') ? 'Falha na conexão com o banco de dados' : 'Erro ao gravar setor de impressão';
      Alert.alert('Erro', msg);
      return { ok: false } as any;
    } finally {
      setSavingSector(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.title}>Produtos ({filteredProdutos.length}) • Base: {dbTarget ? dbTarget.toUpperCase() : 'N/A'}</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            onPress={async () => { await saveSelectedSector(); router.push('/setores/listagem' as any); }} 
            style={[styles.addButton, { marginRight: 10 }]}
          >
            <Ionicons name="list" size={24} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={async () => { await saveSelectedSector(); router.push('/produtos/cadastro' as any); }} 
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#2196F3" />
          </TouchableOpacity>
        </View>
      </View>

      <SearchAndFilter
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Buscar produtos..."
        filters={categoryFilters}
        selectedFilter={selectedCategory}
        onFilterChange={handleFilterChange}
        style={{ marginHorizontal: 16, marginBottom: 8 }}
      />

      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TouchableOpacity
            onPress={() => setShowMissingFiscal(!showMissingFiscal)}
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 12, 
              borderRadius: 16, 
              borderWidth: 1, 
              borderColor: showMissingFiscal ? '#f44336' : '#ddd', 
              backgroundColor: showMissingFiscal ? '#ffebee' : '#fff', 
              marginRight: 8, 
              marginBottom: 6,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Ionicons name="alert-circle-outline" size={16} color={showMissingFiscal ? '#f44336' : '#666'} style={{ marginRight: 4 }} />
            <Text style={{ color: showMissingFiscal ? '#f44336' : '#666', fontWeight: showMissingFiscal ? 'bold' : 'normal' }}>Sem Fiscal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSectorChange('')}
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: selectedSectorId === '' ? '#2196F3' : '#ddd', backgroundColor: selectedSectorId === '' ? '#E3F2FD' : '#fff', marginRight: 8, marginBottom: 6 }}
        >
          <Text style={{ color: selectedSectorId === '' ? '#2196F3' : '#333' }}>Todos os setores</Text>
        </TouchableOpacity>
        {setores.map(s => (
          <TouchableOpacity
            key={s.id}
            onPress={() => handleSectorChange(s.id)}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: selectedSectorId === s.id ? '#2196F3' : '#ddd', backgroundColor: selectedSectorId === s.id ? '#E3F2FD' : '#fff', marginRight: 8, marginBottom: 6 }}
          >
            <Text style={{ color: selectedSectorId === s.id ? '#2196F3' : '#333' }}>{s.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredProdutos}
        renderItem={renderProduto}
        keyExtractor={(item) => (item._id ? String(item._id) : String(item.id))}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          filteredProdutos.length === 0 && styles.emptyListContent
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchText || selectedCategory ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            </Text>
            {!searchText && !selectedCategory && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/produtos/cadastro' as any)}
              >
                <Text style={styles.emptyButtonText}>Cadastrar Primeiro Produto</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      {savingSector && (
        <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8 }}>Gravando setor...</Text>
        </View>
      )}
      {successToast && (
        <View style={{ position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: '#E8F5E9', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#A5D6A7' }}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={{ color: '#2E7D32', marginLeft: 8 }}>Setor de impressão gravado com sucesso!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 15,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 15,
  },
  produtoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  produtoHeader: {
    marginBottom: 15,
  },
  produtoInfo: {
    flex: 1,
  },
  produtoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  produtoDescricao: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  produtoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  produtoCategoria: {
    fontSize: 12,
    color: '#999',
  },
  produtoPreco: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  produtoEstoque: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estoqueText: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  produtoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  editButton: {
    backgroundColor: '#e3f2fd',
  },
  toggleButton: {
    backgroundColor: '#f3e5f5',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});