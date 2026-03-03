import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  BackHandler,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { saleService, mesaService, systemService } from '../../src/services/api';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus'
import { SafeIcon } from '../../components/SafeIcon';
import WebDropdownMenu from '../../src/components/WebDropdownMenu';

// Header Gradient Fallback
const HeaderBackground = ({ children, style }: any) => {
  return (
    <View style={[{ backgroundColor: '#2196F3' }, style]}>
       {children}
    </View>
  );
};

export default function HomeScreen() {
  const authContext = useAuth() as any;
  const { user, logout, isAuthenticated } = authContext;
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    openTables: 0,
    openComandas: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      if (!isAuthenticated) {
        setStats({ totalSales: 0, totalRevenue: 0, openTables: 0, openComandas: 0 });
        return;
      }
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [salesHojeRes, openSalesRes, mesasResponse] = await Promise.all([
        saleService.list({ dataInicio: startOfDay.toISOString(), dataFim: endOfDay.toISOString() }),
        saleService.list({ status: 'aberta' }),
        mesaService.list(),
      ]);

      const todaySales = salesHojeRes?.data || [];
      const openSales = openSalesRes?.data || [];

      // Contar mesas ocupadas
      const openTables = (mesasResponse?.data || []).filter(
        (mesa: any) => mesa.status === 'ocupada'
      ).length;

      // Contar TODAS as comandas abertas (não apenas do dia)
      const openComandas = openSales.filter(
        (sale: any) => sale.tipoVenda === 'comanda'
      ).length;

      // Calcular vendas finalizadas (todas as vendas fechadas do dia)
      const finalizedSales = todaySales.filter((sale: any) => 
        sale.status === 'finalizada' || sale.status === 'fechada'
      );

      // Calcular receita total sem duplicação
      const totalRevenue = finalizedSales.reduce((sum: number, sale: any) => {
        return sum + (parseFloat(sale.total) || 0);
      }, 0);

      setStats({
        totalSales: finalizedSales.length, // Total de vendas finalizadas
        totalRevenue: totalRevenue, // Faturamento total sem duplicação
        openTables,
        openComandas,
      });
    } catch (error: any) {
      const status = error?.response?.status ?? 0;
      if (status === 401) {
        Alert.alert('Sessão expirada', 'Faça login novamente para carregar as estatísticas.');
      } else {
        Alert.alert('Erro', 'Não foi possível carregar as estatísticas. Verifique sua conexão.');
      }
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
    const off1 = events.on('mesas:refresh', loadStats);
    const off2 = events.on('comandas:refresh', loadStats);
    const off3 = events.on('caixa:refresh', loadStats);
    return () => { off1(); off2(); off3(); };
  }, [loadStats]);

  const handleLogout = () => {
    const title = 'Sair do Sistema';
    const message = 'Tem certeza que deseja fechar o sistema? Isso irá ENCERRAR O BANCO DE DADOS e desligar a aplicação.';
    
    // Tratamento específico para Web (Alert.alert tem limitações)
    if (Platform.OS === 'web') {
      // @ts-ignore - window.confirm existe no ambiente web
      if (window.confirm(`${title}\n\n${message}`)) {
        performShutdown();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair e Desligar', 
          style: 'destructive', 
          onPress: performShutdown
        },
      ]
    );
  };

  const performShutdown = async () => {
    try {
      // Tenta enviar comando de shutdown ao servidor
      await systemService.shutdown().catch((err) => console.warn('Falha no shutdown remoto', err));
      
      // Aguarda um momento para garantir envio e então fecha
      setTimeout(() => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else {
          // Fallback para iOS e Web: apenas desloga
          logout();
        }
      }, 800);
    } catch (error) {
      console.error('Erro ao sair:', error);
      Alert.alert('Erro', 'Falha ao encerrar o servidor remoto. Apenas o logout local será realizado.');
      logout();
    }
  };

  const menuItems = [
    {
      title: 'Nova Venda - Balcão',
      subtitle: 'Venda direta no balcão',
      icon: 'storefront',
      color: '#4CAF50',
      gradient: ['#66BB6A', '#43A047'],
      onPress: () => router.push('/sale?type=balcao'),
    },
    {
      title: 'Gerenciar Mesas',
      subtitle: 'Abrir e fechar mesas',
      icon: 'restaurant',
      color: '#2196F3',
      gradient: ['#42A5F5', '#1E88E5'],
      onPress: () => router.push('/(tabs)/mesas'),
    },
    {
      title: 'Comandas',
      subtitle: 'Comandas nomeadas',
      icon: 'receipt',
      color: '#FF9800',
      gradient: ['#FFA726', '#FB8C00'],
      onPress: () => router.push('/(tabs)/comandas'),
    },
    {
      title: 'Modo Tablet',
      subtitle: 'Cozinha e Bar',
      icon: 'tablet-portrait',
      color: '#E91E63',
      gradient: ['#EC407A', '#D81B60'],
      onPress: () => router.push('/tablet'),
    },
    {
      title: 'Histórico',
      subtitle: 'Vendas finalizadas',
      icon: 'time',
      color: '#9C27B0',
      gradient: ['#AB47BC', '#8E24AA'],
      onPress: () => router.push('/(tabs)/historico'),
    },
    {
      title: 'Relatórios',
      subtitle: 'Estatísticas',
      icon: 'bar-chart',
      color: '#607D8B',
      gradient: ['#78909C', '#546E7A'],
      onPress: () => router.push('/(tabs)/admin-relatorios'),
    },
    {
      title: 'Delivery',
      subtitle: 'Entregas',
      icon: 'bicycle',
      color: '#009688',
      gradient: ['#26A69A', '#00897B'],
      onPress: () => router.push('/delivery-dashboard'),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <HeaderBackground style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.welcomeLabel}>Bem-vindo(a),</Text>
            <Text style={styles.userName}>{user?.name || 'Usuário'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.userRole}>{user?.role?.nome || (typeof user?.role === 'string' ? user.role : 'Funcionário')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
             {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/configuracoes')}
              >
                <SafeIcon name="settings" size={20} color="#fff" fallbackText="⚙" />
              </TouchableOpacity>
             )}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <SafeIcon name="log-out" size={20} color="#fff" fallbackText="Exit" />
            </TouchableOpacity>
          </View>
        </View>
      </HeaderBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
        }
      >
        <ScreenIdentifier screenName="Home" />
        
        {/* Menu Dropdown - Apenas Web */}
        {Platform.OS === 'web' && <WebDropdownMenu />}

        {/* Status Rápido - Apenas Web ou Tablet Grande */}
        {(Platform.OS === 'web' || Dimensions.get('window').width > 600) && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Visão Geral de Hoje</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard]}>
              <View style={[styles.statIconBox, { backgroundColor: '#E8F5E8' }]}>
                <SafeIcon name="trending-up" size={24} color="#4CAF50" fallbackText="↑" />
              </View>
              <View>
                <Text style={styles.statNumber}>{stats.totalSales}</Text>
                <Text style={styles.statLabel}>Vendas</Text>
              </View>
            </View>
            <View style={[styles.statCard]}>
              <View style={[styles.statIconBox, { backgroundColor: '#E3F2FD' }]}>
                <SafeIcon name="cash" size={24} color="#2196F3" fallbackText="$" />
              </View>
              <View>
                <Text style={styles.statNumber}>R$ {stats.totalRevenue.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Faturamento</Text>
              </View>
            </View>
            <View style={[styles.statCard]}>
              <View style={[styles.statIconBox, { backgroundColor: '#FFF3E0' }]}>
                <SafeIcon name="restaurant" size={24} color="#FF9800" fallbackText="🍽" />
              </View>
              <View>
                <Text style={styles.statNumber}>{stats.openTables}</Text>
                <Text style={styles.statLabel}>Mesas</Text>
              </View>
            </View>
            <View style={[styles.statCard]}>
               <View style={[styles.statIconBox, { backgroundColor: '#F3E5F5' }]}>
                <SafeIcon name="receipt" size={24} color="#9C27B0" fallbackText="📝" />
              </View>
              <View>
                <Text style={styles.statNumber}>{stats.openComandas}</Text>
                <Text style={styles.statLabel}>Comandas</Text>
              </View>
            </View>
          </View>
        </View>
        )}

        {/* Menu Principal Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
          <View style={styles.menuGrid}>
            {menuItems.filter(item => {
              // Filtrar Histórico no mobile
              if (Platform.OS !== 'web' && item.title === 'Histórico') return false;
              // Filtrar Relatórios no mobile (apenas Desktop)
              if (Platform.OS !== 'web' && item.title === 'Relatórios') return false;
              return true;
            }).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuCard}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                  <SafeIcon name={item.icon as any} size={28} color="#fff" fallbackText="•" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
                <SafeIcon name="chevron-forward" size={18} color="#CBD5E1" fallbackText=">" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  userInfo: {
    justifyContent: 'center',
  },
  welcomeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 2,
  },
  userName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  userRole: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,50,50,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: -20, // Sobrepor levemente o header
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionContainer: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 16,
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  menuGrid: {
    gap: 16,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
});
