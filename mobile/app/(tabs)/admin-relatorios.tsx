import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeIcon } from '../../components/SafeIcon';
import { saleService, productService, customerService, employeeService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

interface ReportStats {
  totalVendas: number;
  totalProdutos: number;
  faturamentoTotal: number;
  faturamentoMedio: number;
  produtoMaisVendido: string;
  totalClientes: number;
  totalFuncionarios: number;
  vendasPorTipo: {
    balcao: number;
    mesa: number;
    comanda: number;
  };
  vendasPorStatus: {
    finalizadas: number;
    abertas: number;
    canceladas: number;
  };
}

export default function AdminRelatoriosScreen() {
  const { hasPermission } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ReportStats>({
    totalVendas: 0,
    totalProdutos: 0,
    faturamentoTotal: 0,
    faturamentoMedio: 0,
    produtoMaisVendido: 'N/A',
    totalClientes: 0,
    totalFuncionarios: 0,
    vendasPorTipo: {
      balcao: 0,
      mesa: 0,
      comanda: 0,
    },
    vendasPorStatus: {
      finalizadas: 0,
      abertas: 0,
      canceladas: 0,
    },
  });
  const [salesList, setSalesList] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'total'>('hoje');
  const [filtroFiscal, setFiltroFiscal] = useState<'todas' | 'fiscal' | 'nao-fiscal'>('todas');
  const [searchTable, setSearchTable] = useState('');

  useEffect(() => {
    if (hasPermission('relatorios')) {
      loadReports();
    } else {
      setLoading(false);
    }
  }, [periodo, filtroFiscal]);

  if (!hasPermission('relatorios')) {
    return (
      <View style={styles.container}>
        <ScreenIdentifier screenName="Admin - Relatórios" />
        <View style={styles.loadingContainer}>
          <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
          <Text style={[styles.loadingText, { fontWeight: 'bold', marginTop: 16 }]}>Acesso Negado</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
            Você não tem permissão para acessar os relatórios.
          </Text>
        </View>
      </View>
    );
  }

  const loadReports = async () => {
    try {
      setLoading(true);

      const [salesResponse, productsResponse, customersResponse, employeesResponse] = await Promise.all([
        saleService.getAll(),
        productService.getAll(),
        customerService.getAll(),
        employeeService.getAll(),
      ]);

      const sales = salesResponse.data || [];
      const products = productsResponse.data || [];
      const customers = customersResponse.data || [];
      const employees = employeesResponse.data || [];

      // Filtrar vendas por período
      const now = new Date();
      let filteredSales = sales;

      if (periodo === 'hoje') {
        const today = now.toDateString();
        filteredSales = sales.filter((sale: any) => {
          const d = sale.dataVenda || sale.createdAt;
          return d ? new Date(d).toDateString() === today : false;
        });
      } else if (periodo === 'semana') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredSales = sales.filter((sale: any) => {
          const d = sale.dataVenda || sale.createdAt;
          return d ? new Date(d) >= weekAgo : false;
        });
      } else if (periodo === 'mes') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredSales = sales.filter((sale: any) => {
          const d = sale.dataVenda || sale.createdAt;
          return d ? new Date(d) >= monthAgo : false;
        });
      }

      // Filtrar Vendas Fiscais / Não Fiscais
      if (filtroFiscal === 'fiscal') {
        filteredSales = filteredSales.filter((sale: any) => sale.nfce && sale.nfce.status === 'AUTORIZADA');
      } else if (filtroFiscal === 'nao-fiscal') {
        filteredSales = filteredSales.filter((sale: any) => !sale.nfce || sale.nfce.status !== 'AUTORIZADA');
      }

      // Calcular estatísticas
      const totalVendas = filteredSales.length;
      const vendasFinalizadas = filteredSales.filter((sale: any) => sale.status === 'finalizada');
      const faturamentoTotal = vendasFinalizadas.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
      const faturamentoMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

      // Vendas por tipo
      const vendasPorTipo = {
        balcao: filteredSales.filter((sale: any) => sale.tipoVenda === 'balcao').length,
        mesa: filteredSales.filter((sale: any) => sale.tipoVenda === 'mesa').length,
        comanda: filteredSales.filter((sale: any) => sale.tipoVenda === 'comanda').length,
      };

      // Vendas por status
      const vendasPorStatus = {
        finalizadas: filteredSales.filter((sale: any) => sale.status === 'finalizada').length,
        abertas: filteredSales.filter((sale: any) => sale.status === 'aberta').length,
        canceladas: filteredSales.filter((sale: any) => sale.status === 'cancelada').length,
      };

      // Produto mais vendido
      const productCounts: { [key: string]: number } = {};

      filteredSales.forEach((sale: any) => {
        if (sale.itens && Array.isArray(sale.itens)) {
          sale.itens.forEach((item: any) => {
            const productName = item.nomeProduto || item.produto?.nome || 'Desconhecido';
            const quantity = Number(item.quantidade) || 0;
            if (quantity > 0) {
              productCounts[productName] = (productCounts[productName] || 0) + quantity;
            }
          });
        }
      });

      let produtoMaisVendido = 'Nenhum';
      let maxVendas = 0;

      Object.entries(productCounts).forEach(([product, count]) => {
        if (count > maxVendas) {
          maxVendas = count;
          produtoMaisVendido = product;
        }
      });

      setStats({
        totalVendas,
        totalProdutos: products.length,
        faturamentoTotal,
        faturamentoMedio,
        produtoMaisVendido,
        totalClientes: customers.length,
        totalFuncionarios: employees.length,
        vendasPorTipo,
        vendasPorStatus,
      });
      setSalesList(filteredSales);

    } catch (error: any) {
      console.error('Erro ao carregar relatórios:', error);
      Alert.alert('Erro', 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Filtragem da tabela detalhada em tempo real
  const filteredSalesList = useMemo(() => {
    if (!searchTable.trim()) return salesList;
    const q = searchTable.toLowerCase().trim();
    return salesList.filter((s: any) => {
      const docId = (s.nfce && s.nfce.status === 'AUTORIZADA' ? `nfce ${s.nfce.numero || s.nfce.id}` : `venda ${s.id}`).toLowerCase();
      const client = (s.cliente?.nome || 'consumidor').toLowerCase();
      const status = (s.status || '').toLowerCase();
      return docId.includes(q) || client.includes(q) || status.includes(q);
    });
  }, [salesList, searchTable]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando relatórios...</Text>
      </View>
    );
  }

  const periodOptions: { key: typeof periodo; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mês' },
    { key: 'total', label: 'Total' },
  ];

  const fiscalOptions: { key: typeof filtroFiscal; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'fiscal', label: 'Fiscais (NFC-e)' },
    { key: 'nao-fiscal', label: 'Não Fiscais' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ScreenIdentifier screenName="Admin - Relatórios" />

      {/* 1. Header Compacto com Botão de Atualizar */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="bar-chart" size={22} color="#0284C7" />
            <Text style={styles.headerTitle}>Relatórios Administrativos</Text>
          </View>
          <Text style={styles.headerSubtitle}>Análise de vendas, faturamento e estatísticas</Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
          <Ionicons name="refresh" size={15} color="#0284C7" />
          <Text style={styles.refreshBtnText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Barra de Filtros Unificada (Período e Fiscal) */}
      <View style={styles.filterCard}>
        {/* Filtro de Período */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>📅 Período:</Text>
          <View style={styles.filterPillsRow}>
            {periodOptions.map((opt) => {
              const active = periodo === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setPeriodo(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.filterDivider} />

        {/* Filtro Fiscal */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>🏛️ Tipo de Venda:</Text>
          <View style={styles.filterPillsRow}>
            {fiscalOptions.map((opt) => {
              const active = filtroFiscal === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterPill, active && styles.filterPillActiveFiscal]}
                  onPress={() => setFiltroFiscal(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActiveFiscal]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* 3. Resumo Geral - Grid de 5 Cards no Desktop/Tablet */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-up" size={18} color="#0F172A" />
          <Text style={styles.sectionTitle}>Resumo Geral</Text>
        </View>

        <View style={styles.kpiGrid}>
          {/* Total de Vendas */}
          <View style={[styles.kpiCard, { borderTopColor: '#10B981' }]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="receipt-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.kpiTitle}>Total de Vendas</Text>
            </View>
            <Text style={styles.kpiValue}>{stats.totalVendas}</Text>
            <Text style={styles.kpiSub}>pedidos no período</Text>
          </View>

          {/* Faturamento Total */}
          <View style={[styles.kpiCard, { borderTopColor: '#2563EB' }]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cash-outline" size={18} color="#2563EB" />
              </View>
              <Text style={styles.kpiTitle}>Faturamento Total</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
              {formatCurrency(stats.faturamentoTotal)}
            </Text>
            <Text style={styles.kpiSub}>vendas finalizadas</Text>
          </View>

          {/* Faturamento Médio */}
          <View style={[styles.kpiCard, { borderTopColor: '#F59E0B' }]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.kpiTitle}>Faturamento Médio</Text>
            </View>
            <Text style={styles.kpiValue}>
              {formatCurrency(stats.faturamentoMedio)}
            </Text>
            <Text style={styles.kpiSub}>ticket médio por venda</Text>
          </View>

          {/* Produto Mais Vendido */}
          <View style={[styles.kpiCard, { borderTopColor: '#8B5CF6' }]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="star-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.kpiTitle}>Mais Vendido</Text>
            </View>
            <Text style={[styles.kpiValue, { fontSize: 15 }]} numberOfLines={2}>
              {stats.produtoMaisVendido}
            </Text>
            <Text style={styles.kpiSub}>destaque do período</Text>
          </View>

          {/* Total de Produtos (Clicável) */}
          <TouchableOpacity
            style={[styles.kpiCard, styles.kpiCardClickable, { borderTopColor: '#0284C7' }]}
            onPress={() => router.push('/(tabs)/admin-produtos')}
            activeOpacity={0.8}
          >
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="cube-outline" size={18} color="#0284C7" />
              </View>
              <Text style={styles.kpiTitle}>Total Produtos</Text>
              <Ionicons name="arrow-forward" size={12} color="#0284C7" style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={styles.kpiValue}>{stats.totalProdutos}</Text>
            <Text style={[styles.kpiSub, { color: '#0284C7', fontWeight: 'bold' }]}>gerenciar catálogo →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Canais de Venda e Status das Vendas (2 Painéis Lado a Lado no Desktop) */}
      <View style={[styles.panelsRow, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
        {/* Painel: Vendas por Tipo (Canal) */}
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Ionicons name="storefront-outline" size={16} color="#0F172A" />
            <Text style={styles.subPanelTitle}>Vendas por Tipo de Canal</Text>
          </View>
          <View style={styles.channelGrid}>
            <View style={styles.channelItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="storefront" size={16} color="#10B981" />
                <Text style={styles.channelLabel}>Balcão</Text>
              </View>
              <Text style={styles.channelCount}>{stats.vendasPorTipo.balcao}</Text>
            </View>

            <View style={styles.channelItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="restaurant" size={16} color="#2563EB" />
                <Text style={styles.channelLabel}>Mesa</Text>
              </View>
              <Text style={styles.channelCount}>{stats.vendasPorTipo.mesa}</Text>
            </View>

            <View style={styles.channelItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="receipt" size={16} color="#F59E0B" />
                <Text style={styles.channelLabel}>Comanda</Text>
              </View>
              <Text style={styles.channelCount}>{stats.vendasPorTipo.comanda}</Text>
            </View>
          </View>
        </View>

        {/* Painel: Vendas por Status */}
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Ionicons name="checkmark-done-circle-outline" size={16} color="#0F172A" />
            <Text style={styles.subPanelTitle}>Status das Vendas</Text>
          </View>
          <View style={styles.channelGrid}>
            <View style={[styles.channelItem, { borderLeftColor: '#10B981', borderLeftWidth: 3 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.channelLabel}>Finalizadas</Text>
              </View>
              <Text style={[styles.channelCount, { color: '#10B981' }]}>{stats.vendasPorStatus.finalizadas}</Text>
            </View>

            <View style={[styles.channelItem, { borderLeftColor: '#F59E0B', borderLeftWidth: 3 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time" size={16} color="#F59E0B" />
                <Text style={styles.channelLabel}>Abertas</Text>
              </View>
              <Text style={[styles.channelCount, { color: '#F59E0B' }]}>{stats.vendasPorStatus.abertas}</Text>
            </View>

            <View style={[styles.channelItem, { borderLeftColor: '#EF4444', borderLeftWidth: 3 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={styles.channelLabel}>Canceladas</Text>
              </View>
              <Text style={[styles.channelCount, { color: '#EF4444' }]}>{stats.vendasPorStatus.canceladas}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. Atalhos de Gestão Geral (Clientes e Funcionários) */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => router.push('/(tabs)/admin-clientes')}
          activeOpacity={0.8}
        >
          <View style={[styles.shortcutIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="people" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shortcutTitle}>Total de Clientes</Text>
            <Text style={styles.shortcutValue}>{stats.totalClientes} cadastrados</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => router.push('/(tabs)/admin-funcionarios')}
          activeOpacity={0.8}
        >
          <View style={[styles.shortcutIconBox, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="person" size={18} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shortcutTitle}>Total de Funcionários</Text>
            <Text style={styles.shortcutValue}>{stats.totalFuncionarios} cadastrados</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 6. Botão Retrátil de Detalhamento das Vendas com Contador */}
      <View style={styles.accordionContainer}>
        <TouchableOpacity
          style={[styles.accordionToggleBtn, showDetails && styles.accordionToggleBtnActive]}
          onPress={() => setShowDetails(!showDetails)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="list" size={18} color={showDetails ? '#FFFFFF' : '#0284C7'} />
            <Text style={[styles.accordionToggleText, showDetails && styles.accordionToggleTextActive]}>
              Detalhamento das Vendas ({salesList.length})
            </Text>
          </View>
          <Ionicons
            name={showDetails ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={showDetails ? '#FFFFFF' : '#0284C7'}
          />
        </TouchableOpacity>

        {/* Tabela de Vendas Detalhada */}
        {showDetails && (
          <View style={styles.detailsContent}>
            {/* Barra de Busca na Tabela */}
            <View style={styles.tableSearchBox}>
              <Ionicons name="search" size={15} color="#94A3B8" />
              <TextInput
                style={styles.tableSearchInput}
                placeholder="Buscar por cliente, nº do documento ou status..."
                placeholderTextColor="#94A3B8"
                value={searchTable}
                onChangeText={setSearchTable}
              />
              {searchTable !== '' && (
                <TouchableOpacity onPress={() => setSearchTable('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Cabeçalho da Tabela */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellHeader, { flex: 1.5 }]}>Documento</Text>
              <Text style={[styles.tableCellHeader, { flex: 2 }]}>Emissão</Text>
              <Text style={[styles.tableCellHeader, { flex: 2 }]}>Cliente</Text>
              <Text style={[styles.tableCellHeader, { flex: 1.3, textAlign: 'center' }]}>Status</Text>
              <Text style={[styles.tableCellHeader, { flex: 1.5, textAlign: 'right' }]}>Valor Total</Text>
            </View>

            {/* Linhas de Vendas */}
            {filteredSalesList.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Ionicons name="file-tray-outline" size={32} color="#CBD5E1" />
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>Nenhuma venda encontrada para os filtros selecionados.</Text>
              </View>
            ) : (
              filteredSalesList.map((sale: any, idx: number) => {
                const isNfce = sale.nfce && sale.nfce.status === 'AUTORIZADA';
                const docId = isNfce
                  ? `NFC-e ${sale.nfce.numero || sale.nfce.id}`
                  : `Venda #${sale.id}`;
                const d = sale.dataVenda || sale.createdAt;
                const dateStr = d
                  ? new Date(d).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';
                const clientName = sale.cliente?.nome || 'Consumidor';
                const status = (sale.status || '').toLowerCase();
                const isFinalizada = status === 'finalizada';
                const isAberta = status === 'aberta';

                return (
                  <View
                    key={sale._id || sale.id || idx}
                    style={[styles.tableRow, idx % 2 === 1 && styles.tableRowEven]}
                  >
                    <View style={[styles.tableCellWrapper, { flex: 1.5 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons
                          name={isNfce ? 'document-text' : 'receipt-outline'}
                          size={13}
                          color={isNfce ? '#0284C7' : '#64748B'}
                        />
                        <Text style={[styles.tableCell, isNfce && { fontWeight: 'bold', color: '#0369A1' }]} numberOfLines={1}>
                          {docId}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                      {dateStr}
                    </Text>

                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '500' }]} numberOfLines={1}>
                      {clientName}
                    </Text>

                    <View style={[{ flex: 1.3, alignItems: 'center' }]}>
                      <View
                        style={[
                          styles.statusBadge,
                          isFinalizada
                            ? styles.statusBadgeFinalizada
                            : isAberta
                            ? styles.statusBadgeAberta
                            : styles.statusBadgeCancelada,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isFinalizada
                              ? styles.statusBadgeTextFinalizada
                              : isAberta
                              ? styles.statusBadgeTextAberta
                              : styles.statusBadgeTextCancelada,
                          ]}
                        >
                          {sale.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }]} numberOfLines={1}>
                      {formatCurrency(Number(sale.total) || 0)}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Rodapé da Tabela */}
            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterLabel}>Total (apenas Finalizadas):</Text>
              <Text style={styles.tableFooterValue}>
                {formatCurrency(
                  salesList
                    .filter((s) => s.status === 'finalizada')
                    .reduce((sum: number, sale: any) => sum + (Number(sale.total) || 0), 0)
                )}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 14,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    minWidth: 110,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterPillActiveFiscal: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filterPillTextActiveFiscal: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filterDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopWidth: 4,
    padding: 12,
  },
  kpiCardClickable: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  panelsRow: {
    gap: 10,
  },
  subPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  subPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  subPanelTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  channelGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  channelItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  channelLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  channelCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shortcutIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  shortcutValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  accordionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  accordionToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  accordionToggleBtnActive: {
    backgroundColor: '#0284C7',
  },
  accordionToggleText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  accordionToggleTextActive: {
    color: '#FFFFFF',
  },
  detailsContent: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  tableSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    marginBottom: 12,
  },
  tableSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
  },
  tableCellHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  tableRowEven: {
    backgroundColor: '#F8FAFC',
  },
  tableCellWrapper: {
    justifyContent: 'center',
  },
  tableCell: {
    fontSize: 12,
    color: '#334155',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeFinalizada: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeAberta: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeCancelada: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  statusBadgeTextFinalizada: {
    color: '#166534',
  },
  statusBadgeTextAberta: {
    color: '#92400E',
  },
  statusBadgeTextCancelada: {
    color: '#991B1B',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  tableFooterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tableFooterValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0284C7',
  },
});
