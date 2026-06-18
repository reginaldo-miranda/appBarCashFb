import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

import { HapticTab } from '../../components/haptic-tab';
import ProductsTabButton from '../../src/components/ProductsTabButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { SafeIcon } from '../../components/SafeIcon';
import { Platform, useWindowDimensions } from 'react-native';
import api from '../../src/services/api';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const authContext = useAuth() as any;
  const { user, isAuthenticated, loading, hasPermission, isAdmin } = authContext;

  // Badge de NFC-es em contingência pendentes
  const [contingenciaPendentes, setContingenciaPendentes] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const buscarPendentes = async () => {
      try {
        const res = await api.get('/nfce/contingencia/lista');
        setContingenciaPendentes(res.data?.pendentes || 0);
      } catch { /* silencioso */ }
    };
    buscarPendentes();
    // Verifica a cada 2 minutos
    const interval = setInterval(buscarPendentes, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Configuração específica para Produtos para evitar conflito de href/tabBarButton no Mobile
  const produtosOptions = (Platform.OS === 'web' && !isMobile) 
    ? {
        // href removido para evitar conflito com tabBarButton
        title: 'Adm Produtos',
        headerTitle: 'Gerenciar Produtos',
        tabBarButton: (props: any) => (
          <ProductsTabButton 
            focused={props.accessibilityState?.selected || false} 
          />
        ),
      }
    : {
        href: null,
        title: 'Adm Produtos', 
        headerTitle: 'Gerenciar Produtos',
      };



  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redireciona para a tela de login sempre que a autenticação ficar falsa
      router.replace('/login');
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Removido: useEffect duplicado abaixo para evitar Hook condicional
  // useEffect(() => {
  //   if (!loading && !isAuthenticated) {
  //     router.replace('/login');
  //   }
  // }, [loading, isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'BarApp - Sistema de Vendas',
          tabBarIcon: ({ color }) => <SafeIcon name="home" size={24} color={color} fallbackText="Início" />,
        }}
      />
      <Tabs.Screen
        name="mesas"
        options={{
          title: 'Mesas',
          headerTitle: 'Gerenciar Mesas',
          tabBarIcon: ({ color }) => <SafeIcon name="restaurant" size={24} color={color} fallbackText="Mesas" />,
        }}
      />
      <Tabs.Screen
        name="comandas"
        options={{
          title: 'Comandas',
          headerTitle: 'Comandas Abertas',
          tabBarIcon: ({ color }) => <SafeIcon name="receipt" size={24} color={color} fallbackText="Comandas" />,
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          href: (Platform.OS === 'web' && !isMobile) || hasPermission('vendas') ? '/(tabs)/caixa' : null,
          title: 'Caixa',
          headerTitle: 'Caixa - Vendas Abertas',
          tabBarIcon: () => <SafeIcon name="cash" size={24} color="#FF0000" fallbackText="R$" />,
        }}
      />

      <Tabs.Screen
        name="historico"
        options={{
          href: Platform.OS === 'web' && !isMobile ? '/(tabs)/historico' : null,
          title: 'Histórico',
          headerTitle: 'Histórico de Vendas',
          tabBarIcon: ({ color }) => <SafeIcon name="time" size={24} color={color} fallbackText="Hist." />,
        }}
      />
      
      {/* Abas Administrativas - Visíveis apenas para usuários com permissões OU se estiver na WEB (Desktop) */}
      {(hasPermission('produtos') || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-produtos"
          options={produtosOptions as any}
        />
      )}
      
      {(hasPermission('funcionarios') || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-funcionarios"
          options={{
            href: null,
            title: 'Adm Func.',
            headerTitle: 'Gerenciar Funcionários',
            tabBarIcon: ({ color }) => <SafeIcon name="people" size={24} color={color} fallbackText="Func." />,
          }}
        />
      )}
      
      {(hasPermission('clientes') || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-clientes"
          options={{
            href: null,
            title: 'Adm Clientes',
            headerTitle: 'Gerenciar Clientes',
            tabBarIcon: ({ color }) => <SafeIcon name="person" size={24} color={color} fallbackText="Cli." />,
          }}
        />
      )}
      
      {(isAdmin() || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-configuracoes"
          options={{
            href: Platform.OS === 'web' && !isMobile ? '/(tabs)/admin-configuracoes' : null,
            title: 'Adm Config',
            headerTitle: 'Configurações do Sistema',
            tabBarIcon: ({ color }) => <SafeIcon name="settings" size={24} color={color} fallbackText="Conf." />,
          }}
        />
      )}

      {(isAdmin() || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-perfis"
          options={{
            href: null,
            title: 'Perfis de Acesso',
            headerTitle: 'Gerenciar Perfis de Acesso',
            tabBarIcon: ({ color }) => <SafeIcon name="shield-checkmark" size={24} color={color} fallbackText="Perfis" />,
          }}
        />
      )}

      {(hasPermission('relatorios') || Platform.OS === 'web') && (
        <Tabs.Screen
          name="admin-relatorios"
          options={{
            href: Platform.OS === 'web' && !isMobile ? '/(tabs)/admin-relatorios' : null,
            title: 'Adm Relatórios',
            headerTitle: 'Relatórios Administrativos',
            tabBarIcon: ({ color }) => <SafeIcon name="bar-chart" size={24} color={color} fallbackText="Rel." />,
          }}
        />
      )}

      {/* Tela de Contingência NFC-e - Somente Mobile */}
      <Tabs.Screen
        name="contingencia"
        options={{
          href: '/(tabs)/contingencia',
          title: 'Contingência',
          headerTitle: 'NFC-e em Contingência',
          tabBarIcon: ({ color }) => (
            <View style={layoutStyles.iconWrapper}>
              <SafeIcon
                name={contingenciaPendentes > 0 ? 'warning' : 'checkmark-circle-outline'}
                size={24}
                color={contingenciaPendentes > 0 ? '#FF9800' : color}
                fallbackText="⚠"
              />
              {contingenciaPendentes > 0 && (
                <View style={layoutStyles.badge}>
                  <Text style={layoutStyles.badgeText}>
                    {contingenciaPendentes > 99 ? '99+' : String(contingenciaPendentes)}
                  </Text>
                </View>
              )}
            </View>
          ),
          tabBarBadge: contingenciaPendentes > 0 ? contingenciaPendentes : undefined,
        }}
      />

      {/* Manual de Ajuda */}
      <Tabs.Screen
        name="ajuda"
        options={{
          title: 'Ajuda',
          headerTitle: 'Manual do Sistema',
          tabBarIcon: ({ color }) => <SafeIcon name="help-circle" size={24} color={color} fallbackText="?" />,
        }}
      />
    </Tabs>
  );
}

const layoutStyles = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
