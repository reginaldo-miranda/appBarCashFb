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
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { saleService, mesaService, systemService } from '../../src/services/api';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus'
import { SafeIcon } from '../../components/SafeIcon';
import QrCodeAcessoMobile from '../../src/components/QrCodeAcessoMobile';

// Header Gradient Fallback
const HeaderBackground = ({ children, style }: any) => {
  return (
    <View style={[{ backgroundColor: '#2196F3' }, style]}>
       {children}
    </View>
  );
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 900;
  const isTablet = width > 600 && width <= 900;

  const cardWidthStyle = Platform.OS === 'web'
    ? (isDesktop ? { width: 'calc(33.333% - 7px)' as any } : isTablet ? { width: 'calc(50% - 6px)' as any } : { width: '100%' as any })
    : (isDesktop ? { width: '31.5%' as any } : isTablet ? { width: '48%' as any } : { width: '100%' as any });

  const authContext = useAuth() as any;
  const { user, logout, isAuthenticated } = authContext;
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    openTables: 0,
    openComandas: 0,
  });
  const [showRevenue, setShowRevenue] = useState(false);
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
    const title = 'Sair da Conta';
    const message = 'Tem certeza que deseja sair do sistema? A API também será encerrada.';
    
    const confirmLogout = async () => {
      try {
        await systemService.shutdown();
        if (Platform.OS === 'web') {
          window.alert('API finalizada com sucesso!');
        } else {
          Alert.alert('API Finalizada', 'A API foi encerrada com sucesso.');
        }
      } catch (e) {
        console.log('Erro ao finalizar API', e);
      } finally {
        logout();
      }
    };

    if (Platform.OS === 'web') {
      // @ts-ignore
      if (window.confirm(`${title}\n\n${message}`)) {
        confirmLogout();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair Agora', 
          style: 'destructive', 
          onPress: confirmLogout
        },
      ]
    );
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
        }
      >
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
                <>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => events.emit('qrcode:open')}
                    accessibilityLabel="Conectar Celular (QR Code)"
                  >
                    <SafeIcon name="qr-code" size={18} color="#fff" fallbackText="📱" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push('/configuracoes')}
                    accessibilityLabel="Configurações"
                  >
                    <SafeIcon name="settings" size={18} color="#fff" fallbackText="⚙" />
                  </TouchableOpacity>
                </>
               )}
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <SafeIcon name="log-out" size={18} color="#fff" fallbackText="Exit" />
              </TouchableOpacity>
            </View>
          </View>
        </HeaderBackground>

        <ScreenIdentifier screenName="Home" />

        {/* Status Rápido - Apenas Web ou Tablet Grande */}
        {(Platform.OS === 'web' || Dimensions.get('window').width > 600) && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Visão Geral de Hoje</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard]}>
              <View style={[styles.statIconBox, { backgroundColor: '#E8F5E8' }]}>
                <SafeIcon name="trending-up" size={18} color="#4CAF50" fallbackText="↑" />
              </View>
              <View>
                <Text style={styles.statNumber}>{stats.totalSales}</Text>
                <Text style={styles.statLabel}>Vendas</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.statCard, { position: 'relative' }]}
              onPress={() => setShowRevenue((prev) => !prev)}
              activeOpacity={0.75}
              accessibilityLabel="Mostrar ou ocultar faturamento"
            >
              <View style={styles.eyeBadge}>
                <SafeIcon
                  name={showRevenue ? 'eye-off' : 'eye'}
                  size={15}
                  color="#64748B"
                  fallbackText="👁"
                />
              </View>
              <View style={[styles.statIconBox, { backgroundColor: '#E3F2FD' }]}>
                <SafeIcon name="cash" size={18} color="#2196F3" fallbackText="$" />
              </View>
              <View>
                <Text style={styles.statNumber}>
                  {showRevenue ? `R$ ${stats.totalRevenue.toFixed(2)}` : 'R$ •••••'}
                </Text>
                <Text style={styles.statLabel}>Faturamento</Text>
              </View>
            </TouchableOpacity>
            <View style={[styles.statCard]}>
              <View style={[styles.statIconBox, { backgroundColor: '#FFF3E0' }]}>
                <SafeIcon name="restaurant" size={18} color="#FF9800" fallbackText="🍽" />
              </View>
              <View>
                <Text style={styles.statNumber}>{stats.openTables}</Text>
                <Text style={styles.statLabel}>Mesas</Text>
              </View>
            </View>
            <View style={[styles.statCard]}>
               <View style={[styles.statIconBox, { backgroundColor: '#F3E5F5' }]}>
                <SafeIcon name="receipt" size={18} color="#9C27B0" fallbackText="📝" />
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
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuCard, cardWidthStyle]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                  <SafeIcon name={item.icon as any} size={22} color="#fff" fallbackText="•" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
                <SafeIcon name="chevron-forward" size={16} color="#CBD5E1" fallbackText=">" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={{ height: 16 }} />
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
    paddingTop: Platform.OS === 'ios' ? 40 : 12,
    paddingBottom: 14,
    borderBottomLeftRadius: Platform.OS === 'web' ? 0 : 20,
    borderBottomRightRadius: Platform.OS === 'web' ? 0 : 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  hamburgerButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    justifyContent: 'center',
  },
  welcomeLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginBottom: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 2,
  },
  userRole: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,50,50,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 80,
  },
  sectionContainer: {
    marginTop: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  eyeBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 1,
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
});
