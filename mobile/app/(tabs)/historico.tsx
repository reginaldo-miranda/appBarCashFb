import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { saleService, API_URL } from '../../src/services/api';
import { printHtmlContent } from '../../src/utils/printHtml';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { SafeIcon } from '../../components/SafeIcon';
import { useAuth } from '../../src/contexts/AuthContext';

interface NfceData {
  id?: number;
  chave?: string;
  protocolo?: string;
  status?: string;
  numero?: number;
}

interface Sale {
  _id: string;
  id?: number;
  numeroComanda?: string;
  nomeComanda?: string;
  tipoVenda: 'balcao' | 'mesa' | 'comanda' | 'delivery';
  total: number;
  status: 'finalizada' | 'cancelada' | 'aberta';
  formaPagamento?: string;
  cliente?: {
    nome: string;
    cpf?: string;
  };
  funcionario?: {
    nome: string;
  };
  mesa?: {
    numero: number;
  };
  dataVenda: string;
  itens: SaleItem[];
  nfce?: NfceData | null;
}

interface SaleItem {
  _id: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

type FilterType = 'all' | 'mesa' | 'balcao' | 'comanda' | 'delivery' | 'fiscal' | 'nao_fiscal';
type DateFilter = 'today' | 'week' | 'month' | 'all';

// ─── Utilitários ─────────────────────────────────────────────────────────────

function isFiscal(sale: Sale): boolean {
  return !!(sale.nfce && (sale.nfce as any).status === 'AUTORIZADA');
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function HistoricoScreen() {
  const { user } = useAuth() as any;
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // ── Carregamento ─────────────────────────────────────────────────────────

  const loadSales = async () => {
    try {
      const response = await saleService.list({ status: 'finalizada,cancelada' });
      const finishedSales = response.data;
      setSales(finishedSales);
      applyFilters(finishedSales, typeFilter, dateFilter, searchText);
    } catch (error: any) {
      console.error('Erro ao carregar vendas:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico de vendas');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadSales();
    }, [])
  );

  useEffect(() => {
    applyFilters(sales, typeFilter, dateFilter, searchText);
  }, [sales, typeFilter, dateFilter, searchText]);

  // ── Filtros ───────────────────────────────────────────────────────────────

  const applyFilters = (salesData: Sale[], type: FilterType, date: DateFilter, search: string) => {
    let filtered = [...salesData];

    // Filtro por tipo/fiscal
    if (type === 'fiscal') {
      filtered = filtered.filter(s => isFiscal(s));
    } else if (type === 'nao_fiscal') {
      filtered = filtered.filter(s => !isFiscal(s));
    } else if (type !== 'all') {
      filtered = filtered.filter(s => s.tipoVenda === type);
    }

    // Filtro por data
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (date) {
      case 'today':
        filtered = filtered.filter(s => new Date(s.dataVenda) >= today);
        break;
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        filtered = filtered.filter(s => new Date(s.dataVenda) >= weekAgo);
        break;
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        filtered = filtered.filter(s => new Date(s.dataVenda) >= monthAgo);
        break;
      }
      default:
        break;
    }

    // Filtro por busca
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        (s.numeroComanda && s.numeroComanda.toLowerCase().includes(q)) ||
        (s.nomeComanda && s.nomeComanda.toLowerCase().includes(q)) ||
        (s.cliente?.nome && s.cliente.nome.toLowerCase().includes(q)) ||
        (s.cliente?.cpf && s.cliente.cpf.toLowerCase().includes(q)) ||
        (s.funcionario?.nome && s.funcionario.nome.toLowerCase().includes(q)) ||
        (s.mesa?.numero && s.mesa.numero.toString().includes(q)) ||
        s._id.toLowerCase().includes(q)
      );
    }

    setFilteredSales(filtered);
  };

  // ── Reimpressão ───────────────────────────────────────────────────────────

  const handleReprint = async (sale: Sale) => {
    if (!sale) return;

    const ehFiscal = isFiscal(sale);
    const tipoCupom = ehFiscal ? 'Cupom Fiscal NFC-e' : 'Recibo Comum';
    const saleNum = sale.numeroComanda || sale.nomeComanda || `#${sale._id.slice(-6)}`;

    // Confirmar ação
    const confirmed = await new Promise<boolean>(resolve => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).confirm === 'function') {
        resolve((window as any).confirm(`Deseja reimprimir o ${tipoCupom} da venda ${saleNum}?`));
        return;
      }
      Alert.alert(
        'Confirmar Reimpressão',
        `Deseja reimprimir o ${tipoCupom} da venda ${saleNum}?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Reimprimir', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

    if (!confirmed) return;

    setReprinting(true);
    try {
      const saleId = sale.id || Number(sale._id);

      if (ehFiscal) {
        // ── Cupom Fiscal: abrir PDF do DANFE já autorizado ──────────────────
        const baseUrl = (API_URL || '').replace(/\/$/, '');
        const pdfUrl = `${baseUrl}/nfce/${saleId}/pdf`;

        try {
          const response = await api.get(`/nfce/${saleId}/pdf`);
          if (response.data && typeof response.data === 'string') {
            printHtmlContent(response.data);
          } else {
            // Web fallback: abrir em nova aba
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open(pdfUrl, '_blank');
            }
          }
        } catch {
          // Fallback: abrir URL diretamente
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(pdfUrl, '_blank');
          } else {
            // Mobile: tentar via printHtmlContent com fetch
            const res = await fetch(pdfUrl);
            const html = await res.text();
            printHtmlContent(html);
          }
        }

      } else {
        // ── Cupom Comum: usar endpoint de recibo ────────────────────────────
        const response = await api.post(`/sale/${saleId}/receipt-print`);
        if (response.data && response.data.content) {
          printHtmlContent(response.data.content);
        } else {
          const msg = response.data?.message || 'Enviado para impressão';
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Sucesso', msg);
        }
      }

      // ── Log da ação de reimpressão ──────────────────────────────────────
      try {
        await api.post(`/sale/${saleId}/reprint-log`, {
          userId: user?._id || user?.id || 'desconhecido',
          userName: user?.nome || user?.name || 'Usuário não identificado',
          tipo: ehFiscal ? 'fiscal' : 'comum',
        });
      } catch {
        // Log silencioso — não bloquear a reimpressão se o log falhar
      }

      if (Platform.OS === 'web') {
        window.alert(`✅ Reimpressão do ${tipoCupom} realizada com sucesso!`);
      } else {
        Alert.alert('Sucesso', `Reimpressão do ${tipoCupom} realizada com sucesso!`);
      }

    } catch (error: any) {
      console.error('Erro ao reimprimir:', error);
      const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro ao reimprimir cupom';
      if (Platform.OS === 'web') window.alert(`Erro: ${msg}`);
      else Alert.alert('Erro', msg);
    } finally {
      setReprinting(false);
    }
  };

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mesa': return 'restaurant';
      case 'balcao': return 'storefront';
      case 'comanda': return 'receipt';
      case 'delivery': return 'bicycle';
      default: return 'bag';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'mesa': return 'Mesa';
      case 'balcao': return 'Balcão';
      case 'comanda': return 'Comanda';
      case 'delivery': return 'Delivery';
      default: return 'Outros';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mesa': return '#2196F3';
      case 'balcao': return '#FF9800';
      case 'comanda': return '#9C27B0';
      case 'delivery': return '#4CAF50';
      default: return '#757575';
    }
  };

  // ── Render Card ───────────────────────────────────────────────────────────

  const renderSale = ({ item }: { item: Sale }) => {
    const fiscal = isFiscal(item);
    return (
      <TouchableOpacity
        style={[styles.saleCard, { borderLeftColor: getTypeColor(item.tipoVenda) }]}
        onPress={() => { setSelectedSale(item); setModalVisible(true); }}
      >
        <View style={styles.saleHeader}>
          <View style={styles.saleInfo}>
            <View style={styles.saleNumberRow}>
              <Text style={styles.saleNumber}>
                #{item.numeroComanda || item.nomeComanda || item._id.slice(-6)}
              </Text>
              {/* Badge Fiscal / Comum */}
              <View style={[styles.fiscalBadge, fiscal ? styles.fiscalBadgeFiscal : styles.fiscalBadgeComum]}>
                <Ionicons
                  name={fiscal ? 'shield-checkmark' : 'document-text'}
                  size={11}
                  color="#fff"
                />
                <Text style={styles.fiscalBadgeText}>{fiscal ? 'NFC-e' : 'Comum'}</Text>
              </View>
            </View>
            <View style={styles.typeContainer}>
              <SafeIcon name={getTypeIcon(item.tipoVenda) as any} size={16} color={getTypeColor(item.tipoVenda)} fallbackText="T" />
              <Text style={[styles.typeText, { color: getTypeColor(item.tipoVenda) }]}>
                {getTypeText(item.tipoVenda)}
                {item.mesa?.numero && ` ${item.mesa.numero}`}
              </Text>
            </View>
          </View>
          <View style={styles.saleAmount}>
            <Text style={styles.totalText}>R$ {item.total.toFixed(2)}</Text>
            <Text style={[styles.statusText, { color: item.status === 'finalizada' ? '#4CAF50' : '#F44336' }]}>
              {item.status === 'finalizada' ? 'Finalizada' : 'Cancelada'}
            </Text>
          </View>
        </View>

        <View style={styles.saleDetails}>
          <View style={styles.detailRow}>
            <SafeIcon name="person" size={14} color="#666" fallbackText="👤" />
            <Text style={styles.detailText}>{item.cliente?.nome || 'Cliente não informado'}</Text>
          </View>
          <View style={styles.detailRow}>
            <SafeIcon name="time" size={14} color="#666" fallbackText="⏱" />
            <Text style={styles.detailText}>{new Date(item.dataVenda).toLocaleString('pt-BR')}</Text>
          </View>
          <View style={styles.detailRow}>
            <SafeIcon name="card" size={14} color="#666" fallbackText="💳" />
            <Text style={styles.detailText}>{item.formaPagamento || 'Não informado'}</Text>
          </View>
        </View>

        {/* Botão rápido de reimprimir no card */}
        {item.status === 'finalizada' && (
          <TouchableOpacity
            style={[styles.quickReprintBtn, isFiscal(item) ? styles.quickReprintFiscal : styles.quickReprintComum]}
            onPress={() => handleReprint(item)}
          >
            <Ionicons name="print-outline" size={14} color="#fff" />
            <Text style={styles.quickReprintText}>
              Reimprimir {isFiscal(item) ? 'NFC-e' : 'Recibo'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderDateFilterButton = (filter: DateFilter, label: string) => (
    <TouchableOpacity
      style={[styles.dateFilterButton, dateFilter === filter && styles.activeDateFilterButton]}
      onPress={() => setDateFilter(filter)}
    >
      <Text style={[styles.dateFilterButtonText, dateFilter === filter && styles.activeDateFilterButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Filtros de tipo com opções fiscal/não fiscal
  const typeFilters = [
    { key: 'all', label: 'Todos' },
    { key: 'fiscal', label: '🟢 Fiscal' },
    { key: 'nao_fiscal', label: '🔵 Comum' },
    { key: 'mesa', label: 'Mesa' },
    { key: 'balcao', label: 'Balcão' },
    { key: 'comanda', label: 'Comanda' },
    { key: 'delivery', label: 'Delivery' },
  ];

  // Estatísticas
  const totalSales = filteredSales.length;
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalFiscais = filteredSales.filter(isFiscal).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Histórico" />

      {/* Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalSales}</Text>
          <Text style={styles.statLabel}>Vendas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>R$ {totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Faturamento</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2e7d32' }]}>{totalFiscais}</Text>
          <Text style={styles.statLabel}>Com NFC-e</Text>
        </View>
      </View>

      {/* Filtros de Data */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateFiltersContent} style={styles.dateFiltersContainer}>
          {renderDateFilterButton('today', 'Hoje')}
          {renderDateFilterButton('week', 'Semana')}
          {renderDateFilterButton('month', 'Mês')}
          {renderDateFilterButton('all', 'Todos')}
        </ScrollView>
      </View>

      {/* Busca e Filtros de Tipo */}
      <View style={styles.searchWrapper}>
        <SearchAndFilter
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Buscar por número, cliente, CPF..."
          filters={typeFilters}
          selectedFilter={typeFilter}
          onFilterChange={(k) => setTypeFilter(k as FilterType)}
        />
      </View>

      {/* Lista de Vendas */}
      <FlatList
        data={filteredSales}
        renderItem={renderSale}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <SafeIcon name="document-text-outline" size={64} color="#ccc" fallbackText="doc" />
            <Text style={styles.emptyText}>Nenhuma venda encontrada</Text>
          </View>
        }
      />

      {/* ── Modal de Detalhes ─────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        {selectedSale && (
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detalhes da Venda</Text>
                <Text style={styles.modalSubTitle}>
                  #{selectedSale.numeroComanda || selectedSale.nomeComanda || selectedSale._id.slice(-6)}
                </Text>
              </View>
              <View style={styles.modalHeaderRight}>
                {/* Badge fiscal no modal */}
                <View style={[
                  styles.fiscalBadgeLarge,
                  isFiscal(selectedSale) ? styles.fiscalBadgeFiscal : styles.fiscalBadgeComum
                ]}>
                  <Ionicons
                    name={isFiscal(selectedSale) ? 'shield-checkmark' : 'document-text'}
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.fiscalBadgeLargeText}>
                    {isFiscal(selectedSale) ? 'NFC-e Autorizada' : 'Cupom Comum'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <SafeIcon name="close" size={24} color="#333" fallbackText="×" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Dados da venda */}
              <View style={styles.saleDetailCard}>
                <Text style={styles.saleDetailTotal}>R$ {selectedSale.total.toFixed(2)}</Text>

                <View style={styles.saleDetailInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Tipo:</Text>
                    <Text style={styles.infoValue}>{getTypeText(selectedSale.tipoVenda)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Cliente:</Text>
                    <Text style={styles.infoValue}>{selectedSale.cliente?.nome || 'Não informado'}</Text>
                  </View>
                  {selectedSale.cliente?.cpf && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>CPF:</Text>
                      <Text style={styles.infoValue}>{selectedSale.cliente.cpf}</Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Funcionário:</Text>
                    <Text style={styles.infoValue}>{selectedSale.funcionario?.nome || 'Não informado'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Pagamento:</Text>
                    <Text style={styles.infoValue}>{selectedSale.formaPagamento || 'Não informado'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Data:</Text>
                    <Text style={styles.infoValue}>{new Date(selectedSale.dataVenda).toLocaleString('pt-BR')}</Text>
                  </View>
                  {selectedSale.mesa?.numero && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Mesa:</Text>
                      <Text style={styles.infoValue}>{selectedSale.mesa.numero}</Text>
                    </View>
                  )}
                  {/* Dados fiscais se disponíveis */}
                  {isFiscal(selectedSale) && selectedSale.nfce && (
                    <>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Nº NFC-e:</Text>
                        <Text style={styles.infoValue}>{selectedSale.nfce.numero || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Protocolo:</Text>
                        <Text style={[styles.infoValue, { fontSize: 12 }]}>{selectedSale.nfce.protocolo || 'N/A'}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Itens */}
              <View style={styles.itemsContainer}>
                <Text style={styles.itemsTitle}>Itens da Venda</Text>
                {Array.isArray(selectedSale.itens) && selectedSale.itens.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.nomeProduto}</Text>
                      <Text style={styles.itemQuantity}>Qtd: {item.quantidade}</Text>
                    </View>
                    <Text style={styles.itemTotal}>R$ {Number(item.subtotal).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* ── Botão Principal de Reimpressão ──────────────────────────── */}
              {selectedSale.status === 'finalizada' && (
                <TouchableOpacity
                  style={[
                    styles.reprintMainBtn,
                    isFiscal(selectedSale) ? styles.reprintMainFiscal : styles.reprintMainComum,
                    reprinting && styles.reprintMainDisabled,
                  ]}
                  onPress={() => handleReprint(selectedSale)}
                  disabled={reprinting}
                >
                  {reprinting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="print" size={22} color="#fff" />
                  )}
                  <Text style={styles.reprintMainText}>
                    {reprinting
                      ? 'Imprimindo...'
                      : isFiscal(selectedSale)
                        ? '🧾 Reimprimir NFC-e (DANFE)'
                        : '🖨 Reimprimir Recibo Comum'}
                  </Text>
                </TouchableOpacity>
              )}

              {selectedSale.status === 'cancelada' && (
                <View style={styles.canceledWarning}>
                  <Ionicons name="warning" size={18} color="#F44336" />
                  <Text style={styles.canceledWarningText}>
                    Venda cancelada — reimpressão não disponível
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Estatísticas
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },

  // Filtros data
  filtersWrapper: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  dateFiltersContainer: { paddingHorizontal: 16 },
  dateFiltersContent: { alignItems: 'center', paddingVertical: 4 },
  dateFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeDateFilterButton: { backgroundColor: '#2196F3' },
  dateFilterButtonText: { fontSize: 14, color: '#666' },
  activeDateFilterButtonText: { color: '#fff', fontWeight: 'bold' },

  // Busca
  searchWrapper: { marginTop: 8, zIndex: 2 },

  // Lista
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },

  // Card de venda
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  saleInfo: { flex: 1 },
  saleNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  saleNumber: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  // Badge fiscal
  fiscalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fiscalBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  fiscalBadgeFiscal: { backgroundColor: '#2e7d32' },
  fiscalBadgeComum: { backgroundColor: '#1565c0' },
  fiscalBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  fiscalBadgeLargeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  typeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  typeText: { fontSize: 14, fontWeight: '500', marginLeft: 4 },
  saleAmount: { alignItems: 'flex-end' },
  totalText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusText: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  saleDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailText: { fontSize: 12, color: '#666', marginLeft: 6 },

  // Botão rápido no card
  quickReprintBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  quickReprintFiscal: { backgroundColor: '#2e7d32' },
  quickReprintComum: { backgroundColor: '#1565c0' },
  quickReprintText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Vazio
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 16 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSubTitle: { fontSize: 13, color: '#666', marginTop: 2 },
  modalHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn: { padding: 4 },
  modalContent: { flex: 1, padding: 20 },

  saleDetailCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  saleDetailTotal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
    marginBottom: 16,
  },
  saleDetailInfo: { gap: 12 },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: 'bold', maxWidth: '60%', textAlign: 'right' },

  itemsContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  itemsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  itemQuantity: { fontSize: 12, color: '#666', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: 'bold', color: '#2196F3' },

  // Botão principal de reimpressão no modal
  reprintMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  reprintMainFiscal: { backgroundColor: '#2e7d32' },
  reprintMainComum: { backgroundColor: '#1565c0' },
  reprintMainDisabled: { opacity: 0.6 },
  reprintMainText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Aviso cancelada
  canceledWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff3f3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  canceledWarningText: { color: '#c62828', fontSize: 14, fontWeight: '500' },
});