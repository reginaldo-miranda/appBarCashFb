import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api, { productService } from '../../src/services/api';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

interface Movement {
  id: number;
  productId: number;
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  origem: 'MANUAL' | 'VENDA' | 'XML_NFE';
  quantidade: number;
  precoCusto: number;
  motivo?: string;
  observacao?: string;
  chaveNfe?: string;
  dataCadastro: string;
  product: {
    nome: string;
    unidade: string;
  };
  supplier?: {
    razaoSocial: string;
  };
}

interface Product {
  id: number;
  nome: string;
}

export default function HistoricoEstoque() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedMotivo, setSelectedMotivo] = useState('');

  const motivos = [
    { key: '', label: 'Todos os motivos' },
    { key: 'COMPRA', label: 'Compra de Fornecedor' },
    { key: 'DEVOLUCAO', label: 'Devolução de Cliente' },
    { key: 'VENCIDO', label: 'Produto Vencido' },
    { key: 'DANIFICADO', label: 'Produto Danificado' },
    { key: 'CONSUMO_INTERNO', label: 'Consumo Interno' },
    { key: 'FURTO_OU_ROUBO', label: 'Roubo / Furto' },
    { key: 'AJUSTE', label: 'Ajuste de Inventário' },
  ];

  useEffect(() => {
    loadProducts();
    loadMovements(1, true);
  }, [selectedProductId, selectedTipo, selectedMotivo]);

  const loadProducts = async () => {
    try {
      const res = await productService.getAll();
      setProducts(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMovements = async (pageNumber: number, clear = false) => {
    try {
      if (clear) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      let url = `/stock/history?page=${pageNumber}&limit=30`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      if (selectedTipo) url += `&tipo=${selectedTipo}`;
      if (selectedMotivo) url += `&motivo=${selectedMotivo}`;

      const res = await api.get(url);
      
      if (clear) {
        setMovements(res.data.movements || []);
      } else {
        setMovements(prev => [...prev, ...(res.data.movements || [])]);
      }

      setTotalPages(res.data.pagination.pages || 1);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Erro ao carregar o histórico de movimentações.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMovements(nextPage, false);
    }
  };

  const getTipoBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA':
        return styles.badgeEntrada;
      case 'SAIDA':
        return styles.badgeSaida;
      default:
        return styles.badgeAjuste;
    }
  };

  const formatMotivo = (motivo?: string) => {
    if (!motivo) return 'Sem motivo';
    const found = motivos.find(m => m.key === motivo);
    return found ? found.label : motivo;
  };

  const renderMovementCard = ({ item }: { item: Movement }) => {
    const isPos = item.quantidade > 0;
    const qtySign = isPos ? `+${item.quantidade}` : `${item.quantidade}`;
    const dateFormatted = new Date(item.dataCadastro).toLocaleString('pt-BR');

    return (
      <View style={styles.movementCard}>
        <View style={styles.cardHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.product?.nome}</Text>
            <Text style={styles.movementDate}>{dateFormatted}</Text>
          </View>
          <View style={[styles.badge, getTipoBadgeStyle(item.tipo)]}>
            <Text style={styles.badgeText}>{item.tipo}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantidade:</Text>
            <Text style={[styles.detailValue, { fontWeight: 'bold', color: isPos ? '#4CAF50' : '#F44336' }]}>
              {qtySign} {item.product?.unidade || 'un'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Custo Unitário:</Text>
            <Text style={styles.detailValue}>
              R$ {Number(item.precoCusto || 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Motivo:</Text>
            <Text style={styles.detailValue}>{formatMotivo(item.motivo)}</Text>
          </View>

          {item.supplier && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fornecedor:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{item.supplier.razaoSocial}</Text>
            </View>
          )}

          {item.observacao && (
            <View style={[styles.detailRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 6 }]}>
              <Text style={[styles.detailLabel, { fontStyle: 'italic' }]}>Observações:</Text>
              <Text style={[styles.detailValue, { fontStyle: 'italic', color: '#555' }]}>{item.observacao}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Estoque</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barra de Filtros */}
      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          {/* Filtro Produto */}
          <View style={[styles.filterGroup, { flex: 1 }]}>
            <Text style={styles.filterLabel}>Produto</Text>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={styles.webSelect}
            >
              <option value="">Todos os produtos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </View>

          {/* Filtro Tipo */}
          <View style={[styles.filterGroup, { width: 120 }]}>
            <Text style={styles.filterLabel}>Tipo</Text>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              style={styles.webSelect}
            >
              <option value="">Todos</option>
              <option value="ENTRADA">Entrada (+)</option>
              <option value="SAIDA">Saída (-)</option>
              <option value="AJUSTE">Ajustes</option>
            </select>
          </View>
        </View>

        <View style={[styles.filterRow, { marginTop: 10 }]}>
          {/* Filtro Motivo */}
          <View style={[styles.filterGroup, { flex: 1 }]}>
            <Text style={styles.filterLabel}>Motivo</Text>
            <select
              value={selectedMotivo}
              onChange={(e) => setSelectedMotivo(e.target.value)}
              style={styles.webSelect}
            >
              {motivos.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </View>
        </View>
      </View>

      {/* Lista de Movimentações */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando auditoria de estoque...</Text>
        </View>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMovementCard}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 12 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="receipt-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhuma movimentação de estoque encontrada.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    height: 60,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterBar: {
    backgroundColor: '#FFF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterGroup: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  webSelect: {
    height: 38,
    borderRadius: 6,
    borderColor: '#DDD',
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 14,
    backgroundColor: '#FFF',
    outline: 'none',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  movementCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  productInfo: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  movementDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeEntrada: {
    backgroundColor: '#E8F5E9',
  },
  badgeSaida: {
    backgroundColor: '#FFEBEE',
  },
  badgeAjuste: {
    backgroundColor: '#FFF3E0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#444',
  },
  cardDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
});
