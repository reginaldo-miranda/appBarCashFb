import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { events } from '../utils/eventBus';
import { useAuth } from '../contexts/AuthContext';

interface SidebarMenuProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SidebarMenu({ isOpen: externalIsOpen, onClose }: SidebarMenuProps) {
  const router = useRouter();
  const authContext = useAuth() as any;
  const { user } = authContext || {};
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-320)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === 'web';
  const closeTimeoutRef = useRef<any>(null);

  const openMenu = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -320,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
      if (onClose) onClose();
    });
  };

  // Sincronizar com prop externa (ex: disparada pelo botão hambúrguer no mobile/header)
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      if (externalIsOpen) openMenu();
      else closeMenu();
    }
  }, [externalIsOpen]);

  // Listener para evento global de abrir sidebar
  useEffect(() => {
    const unsub = events.on('sidebar:toggle', () => {
      if (isOpen) closeMenu();
      else openMenu();
    });
    const unsubOpen = events.on('sidebar:open', openMenu);
    const unsubClose = events.on('sidebar:close', closeMenu);
    return () => {
      unsub();
      unsubOpen();
      unsubClose();
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (isWeb) {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      openMenu();
    }
  };

  const handleMouseLeave = () => {
    if (isWeb) {
      closeTimeoutRef.current = setTimeout(() => {
        closeMenu();
      }, 350); // Delay suave para não fechar acidentalmente
    }
  };

  const navigateTo = (route: string | null, action?: () => void) => {
    closeMenu();
    if (action) {
      action();
      return;
    }
    if (route) {
      router.push(route as any);
    }
  };

  const sections = [
    {
      title: 'Operações Rápidas',
      icon: 'flash-outline',
      color: '#4CAF50',
      items: [
        { label: 'Início (Home)', route: '/(tabs)', icon: 'home', color: '#2563EB' },
        { label: 'Nova Venda - Balcão', route: '/sale?type=balcao', icon: 'storefront', color: '#4CAF50' },
        { label: 'Gerenciar Mesas', route: '/(tabs)/mesas', icon: 'restaurant', color: '#2196F3' },
        { label: 'Comandas', route: '/(tabs)/comandas', icon: 'receipt', color: '#FF9800' },
        { label: 'Modo Tablet (Cozinha e Bar)', route: '/tablet', icon: 'tablet-portrait', color: '#E91E63' },
        { label: 'Delivery & Entregas', route: '/delivery-dashboard', icon: 'bicycle', color: '#009688' },
      ],
    },
    {
      title: 'Estoque & Compras',
      icon: 'cube-outline',
      color: '#00838F',
      items: [
        { label: 'Estoque & Reposição', route: '/estoque/movimentacao', icon: 'swap-horizontal', color: '#00838F' },
        { label: 'Entrada via XML Nota', route: '/estoque/movimentacao?tab=xml', icon: 'document-text', color: '#00ACC1' },
        { label: 'Histórico de Estoque', route: '/estoque/historico', icon: 'list', color: '#0097A7' },
      ],
    },
    {
      title: 'Financeiro & Consultas',
      icon: 'stats-chart-outline',
      color: '#9C27B0',
      items: [
        { label: 'Histórico de Vendas', route: '/(tabs)/historico', icon: 'time', color: '#9C27B0' },
        { label: 'Relatórios Gerenciais', route: '/(tabs)/admin-relatorios', icon: 'bar-chart', color: '#607D8B' },
        { label: 'Controle de Caixa', route: '/(tabs)/caixa', icon: 'cash', color: '#2E7D32' },
      ],
    },
    {
      title: 'Cadastros',
      icon: 'grid-outline',
      color: '#3F51B5',
      items: [
        { label: 'Gerenciar Produtos', route: '/(tabs)/admin-produtos', icon: 'fast-food', color: '#E65100' },
        { label: 'Categorias', route: '/categorias/listagem', icon: 'file-tray-stacked', color: '#1565C0' },
        { label: 'Tipos (Sabores)', route: '/tipos/listagem', icon: 'pizza', color: '#D81B60' },
        { label: 'Variações', route: '/variacoes/tipos', icon: 'options', color: '#6A1B9A' },
        { label: 'Unidades de Medida', route: '/unidades/listagem', icon: 'scale', color: '#00695C' },
        { label: 'Setores de Impressão', route: '/setores/listagem', icon: 'print', color: '#455A64' },
        { label: 'Clientes', route: '/(tabs)/admin-clientes', icon: 'people', color: '#0288D1' },
        { label: 'Funcionários', route: '/(tabs)/admin-funcionarios', icon: 'person-add', color: '#5E35B1' },
        { label: 'Perfis de Acesso', route: '/(tabs)/admin-perfis', icon: 'shield-checkmark', color: '#3949AB' },
      ],
    },
    {
      title: 'Configurações & Fiscal',
      icon: 'settings-outline',
      color: '#475569',
      items: [
        { label: 'Configurações do Sistema', route: '/(tabs)/admin-configuracoes', icon: 'settings', color: '#475569' },
        { label: 'Configuração de Delivery', route: '/delivery-config', icon: 'map', color: '#00897B' },
        { label: 'Contingência NFC-e', route: '/(tabs)/contingencia', icon: 'shield-checkmark', color: '#D32F2F' },
        {
          label: 'Conectar Celular 📱',
          route: null,
          icon: 'qr-code',
          color: '#0284C7',
          action: () => events.emit('qrcode:open'),
        },
        { label: 'Ajuda (Manual)', route: '/(tabs)/ajuda', icon: 'help-circle', color: '#0284C7' },
      ],
    },
  ];

  return (
    <>
      {/* Gatilho invisível / discreto na borda esquerda no Desktop (Web) */}
      {isWeb && (
        <View
          style={styles.hoverTriggerArea}
          // @ts-ignore - Propriedades React Native Web para hover
          onMouseEnter={handleMouseEnter}
        >
          <View style={styles.hoverHandle}>
            <Ionicons name="chevron-forward" size={14} color="#64748B" />
          </View>
        </View>
      )}

      {/* Backdrop escurecido quando o menu estiver aberto */}
      {isOpen && (
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={closeMenu}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      {/* Menu Gaveta Lateral Retrátil */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
        // @ts-ignore - React Native Web hover
        onMouseEnter={handleMouseEnter}
        // @ts-ignore
        onMouseLeave={handleMouseLeave}
      >
        {/* Cabeçalho do Menu */}
        <View style={styles.drawerHeader}>
          <TouchableOpacity
            style={styles.drawerHeaderInfo}
            onPress={() => navigateTo('/(tabs)')}
            activeOpacity={0.7}
          >
            <View style={styles.logoBadge}>
              <Ionicons name="wine" size={20} color="#fff" />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.drawerHeaderTitle}>AppBarCash</Text>
              <Text style={styles.drawerHeaderSubtitle}>{user?.name || 'Administrador'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={closeMenu} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Lista de seções e itens */}
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((sec, secIdx) => (
            <View key={secIdx} style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Ionicons name={sec.icon as any} size={15} color={sec.color} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: sec.color }]}>{sec.title}</Text>
              </View>
              {sec.items.map((item, itemIdx) => (
                <TouchableOpacity
                  key={itemIdx}
                  style={styles.menuItem}
                  onPress={() => navigateTo(item.route, item.action)}
                  activeOpacity={0.65}
                >
                  <View style={[styles.itemIconBox, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon as any} size={17} color={item.color} />
                  </View>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={13} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Área sensível ao mouse na borda esquerda
  hoverTriggerArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 22,
    zIndex: 9998,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  hoverHandle: {
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#E2E8F0',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 9999,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 310,
    backgroundColor: '#FFFFFF',
    zIndex: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  drawerHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  drawerHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  drawerHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
    backgroundColor: '#FFFFFF',
  },
  itemIconBox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: '#334155',
  },
});

