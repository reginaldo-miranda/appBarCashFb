import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import api, { productService } from '../../src/services/api';

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
      setProducts(Array.isArray(res) ? res : (res?.data || []));
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

      setTotalPages(res.data.pagination?.pages || 1);
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

  const formatMotivo = (motivo?: string) => {
    if (!motivo) return 'Sem motivo';
    const found = motivos.find(m => m.key === motivo);
    return found ? found.label : motivo;
  };

  const renderMovementRow = ({ item }: { item: Movement }) => {
    const isSaida = item.tipo === 'SAIDA';
    const isEntrada = item.tipo === 'ENTRADA';
    const rawQty = Math.abs(Number(item.quantidade) || 0);

    // Ajusta o sinal correto: Saída sempre negativa, Entrada sempre positiva
    const qtySign = isSaida ? `-${rawQty}` : isEntrada ? `+${rawQty}` : (item.quantidade >= 0 ? `+${item.quantidade}` : `${item.quantidade}`);
    const qtyColor = isSaida ? '#DC2626' : isEntrada ? '#16A34A' : '#2563EB';

    const dateObj = new Date(item.dataCadastro);
    const dateFormatted = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : item.dataCadastro;

    const subDetail = item.observacao || item.supplier?.razaoSocial || (item.chaveNfe ? `NF-e: ${item.chaveNfe.substring(0, 16)}...` : null);

    return (
      <View style={styles.movementRow}>
        {/* Coluna 1: Data / Hora + Badge do Tipo */}
        <View style={styles.colDate}>
          <Text style={styles.movementDate}>{dateFormatted}</Text>
          <View style={[
            styles.badge, 
            isSaida ? styles.badgeSaida : isEntrada ? styles.badgeEntrada : styles.badgeAjuste
          ]}>
            <Text style={[
              styles.badgeText, 
              isSaida ? styles.badgeTextSaida : isEntrada ? styles.badgeTextEntrada : styles.badgeTextAjuste
            ]}>
              {item.tipo}
            </Text>
          </View>
        </View>

        {/* Coluna 2: Produto e Observações */}
        <View style={styles.colProduct}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.product?.nome || 'Produto sem nome'}
          </Text>
          <View style={styles.subRow}>
            <Text style={styles.motivoText}>
              {formatMotivo(item.motivo)}
            </Text>
            {!!subDetail && (
              <Text style={styles.obsText} numberOfLines={1}>
                • {subDetail}
              </Text>
            )}
          </View>
        </View>

        {/* Coluna 3: Custo Unitário */}
        <View style={styles.colCusto}>
          <Text style={styles.colLabel}>Custo Unit.</Text>
          <Text style={styles.custoValue}>
            R$ {Number(item.precoCusto || 0).toFixed(2)}
          </Text>
        </View>

        {/* Coluna 4: Quantidade Movimentada */}
        <View style={styles.colQty}>
          <Text style={[styles.qtyValue, { color: qtyColor }]}>
            {qtySign}
            <Text style={styles.unitText}> {item.product?.unidade || 'un'}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Oculta o header padrão do Expo Router para eliminar o topo duplicado */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabeçalho Único e Moderno */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} 
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Histórico de Estoque</Text>
              <Text style={styles.headerSubtitle}>
                Auditoria de entradas, saídas e ajustes de inventário
              </Text>
            </View>
          </View>

          <View style={styles.headerRightBadge}>
            <Ionicons name="layers-outline" size={15} color="#94A3B8" />
            <Text style={styles.headerRightBadgeText}>
              {movements.length} registro{movements.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      {/* Conteúdo Centralizado e Responsivo */}
      <View style={styles.contentWrapper}>
        {/* Barra de Filtros Integrada */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* Filtro Produto */}
            <View style={[styles.filterGroup, { flex: 2, minWidth: 180 }]}>
              <Text style={styles.filterLabel}>Filtrar por Produto</Text>
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
            <View style={[styles.filterGroup, { flex: 1, minWidth: 120 }]}>
              <Text style={styles.filterLabel}>Tipo de Movimento</Text>
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

            {/* Filtro Motivo */}
            <View style={[styles.filterGroup, { flex: 1.5, minWidth: 150 }]}>
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

            {/* Botão Limpar Filtros */}
            {(selectedProductId || selectedTipo || selectedMotivo) ? (
              <View style={{ justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedProductId('');
                    setSelectedTipo('');
                    setSelectedMotivo('');
                  }}
                  style={styles.clearFiltersBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                  <Text style={styles.clearFiltersBtnText}>Limpar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Lista de Movimentações */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Carregando histórico de movimentações...</Text>
          </View>
        ) : (
          <FlatList
            data={movements}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMovementRow}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 12 }} />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Nenhuma movimentação de estoque encontrada</Text>
                <Text style={styles.emptySubtitle}>
                  Tente alterar ou limpar os filtros acima para visualizar outros registros.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: Platform.OS === 'web' ? 14 : 46,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  headerRightBadgeText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  contentWrapper: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterGroup: {
    minWidth: 120,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  webSelect: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 7,
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 13,
    outline: 'none',
  } as any,
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    gap: 4,
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  listContent: {
    paddingBottom: 24,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  colDate: {
    minWidth: 125,
    gap: 4,
  },
  movementDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeSaida: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeEntrada: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  badgeAjuste: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextSaida: {
    color: '#DC2626',
  },
  badgeTextEntrada: {
    color: '#16A34A',
  },
  badgeTextAjuste: {
    color: '#2563EB',
  },
  colProduct: {
    flex: 2,
    minWidth: 200,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  motivoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  obsText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  colCusto: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  colLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  custoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  colQty: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
