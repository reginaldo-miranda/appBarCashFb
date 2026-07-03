import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Importar serviços para obter estatísticas
import { productService, categoryService, typeService, unidadeMedidaService } from '../services/api';

interface SubMenuItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  subItems: SubMenuItem[];
}

interface ProductsDropdownProps {
  visible: boolean;
  onClose: () => void;
}



const ProductsDropdown: React.FC<ProductsDropdownProps> = ({ visible, onClose }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;



  const menuItems: MenuItem[] = [
    {
      id: 'produtos',
      title: 'Produtos',
      description: 'Gerenciar catálogo de produtos',
      icon: 'cube-outline',
      color: '#2196F3',
      subItems: [
        {
          id: 'cadastro-produtos',
          title: 'Novo Produto',
          description: 'Cadastrar novo produto',
          icon: 'add-circle-outline',
          color: '#2196F3',
          onPress: () => {
            router.push('/produtos/cadastro' as any);
            onClose();
          },
        },
        {
          id: 'listagem-produtos',
          title: 'Gerenciar Produtos',
          description: 'Visualizar e editar produtos',
          icon: 'list-outline',
          color: '#2196F3',
          onPress: () => {
            router.push('/produtos/listagem' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'categorias',
      title: 'Categorias',
      description: 'Organizar produtos por categoria',
      icon: 'folder-outline',
      color: '#4CAF50',
      subItems: [
        {
          id: 'cadastro-categorias',
          title: 'Nova Categoria',
          description: 'Criar nova categoria',
          icon: 'add-circle-outline',
          color: '#4CAF50',
          onPress: () => {
            router.push('/categorias/cadastro' as any);
            onClose();
          },
        },
        {
          id: 'listagem-categorias',
          title: 'Gerenciar Categorias',
          description: 'Visualizar e editar categorias',
          icon: 'list-outline',
          color: '#4CAF50',
          onPress: () => {
            router.push('/categorias/listagem' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'tipos',
      title: 'Tipos',
      description: 'Classificar produtos por tipo',
      icon: 'pricetag-outline',
      color: '#FF9800',
      subItems: [
        {
          id: 'cadastro-tipos',
          title: 'Novo Tipo',
          description: 'Criar novo tipo de produto',
          icon: 'add-circle-outline',
          color: '#FF9800',
          onPress: () => {
            router.push('/tipos/cadastro' as any);
            onClose();
          },
        },
        {
          id: 'listagem-tipos',
          title: 'Gerenciar Tipos',
          description: 'Visualizar e editar tipos',
          icon: 'list-outline',
          color: '#FF9800',
          onPress: () => {
            router.push('/tipos/listagem' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'unidades',
      title: 'Unidades de Medida',
      description: 'Definir unidades de medida',
      icon: 'scale-outline',
      color: '#9C27B0',
      subItems: [
        {
          id: 'cadastro-unidades',
          title: 'Nova Unidade',
          description: 'Criar nova unidade de medida',
          icon: 'add-circle-outline',
          color: '#9C27B0',
          onPress: () => {
            router.push('/unidades/cadastro' as any);
            onClose();
          },
        },
        {
          id: 'listagem-unidades',
          title: 'Gerenciar Unidades',
          description: 'Visualizar e editar unidades',
          icon: 'list-outline',
          color: '#9C27B0',
          onPress: () => {
            router.push('/unidades/listagem' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'variacoes',
      title: 'Variações',
      description: 'Tipos de variação e regras de preço',
      icon: 'options-outline',
      color: '#795548',
      subItems: [
        {
          id: 'tipos-variacao',
          title: 'Tipos de Variação',
          description: 'Gerenciar tipos de variação',
          icon: 'list-outline',
          color: '#795548',
          onPress: () => {
            router.push('/variacoes/tipos' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'setores',
      title: 'Setores',
      description: 'Gerenciar setores de impressão',
      icon: 'print-outline',
      color: '#607D8B',
      subItems: [
        {
          id: 'cadastro-setor',
          title: 'Novo Setor',
          description: 'Cadastrar novo setor',
          icon: 'add-circle-outline',
          color: '#607D8B',
          onPress: () => {
            router.push('/setores/cadastro' as any);
            onClose();
          },
        },
        {
          id: 'listagem-setores',
          title: 'Gerenciar Setores',
          description: 'Visualizar e editar setores',
          icon: 'list-outline',
          color: '#607D8B',
          onPress: () => {
            router.push('/setores/listagem' as any);
            onClose();
          },
        },
      ],
    },
    {
      id: 'estoque',
      title: 'Estoque',
      description: 'Movimentações e Notas Fiscais',
      icon: 'bar-chart-outline',
      color: '#E91E63',
      subItems: [
        {
          id: 'movimentar-estoque',
          title: 'Lançar Movimentação',
          description: 'Lançar entradas, saídas ou importar XML',
          icon: 'swap-vertical-outline',
          color: '#E91E63',
          onPress: () => {
            router.push('/estoque/movimentacao' as any);
            onClose();
          },
        },
        {
          id: 'historico-estoque',
          title: 'Histórico de Estoque',
          description: 'Auditar movimentações do estoque',
          icon: 'time-outline',
          color: '#E91E63',
          onPress: () => {
            router.push('/estoque/historico' as any);
            onClose();
          },
        },
      ],
    },
  ];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Resetar estados quando fechar
      setSearchText('');
      setActiveSection(null);
      setExpandedItems([]);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };



  // Renderizar seção de navegação
  const renderNavigationSection = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.navigationCard,
        activeSection === item.id && styles.navigationCardActive
      ]}
      onPress={() => {
        setActiveSection(activeSection === item.id ? null : item.id);
        toggleExpanded(item.id);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.navigationCardHeader}>
        <View style={[styles.navigationIcon, { backgroundColor: item.color + '20' }]}>
          <Ionicons name={item.icon as any} size={24} color={item.color} />
        </View>
        <View style={styles.navigationContent}>
          <Text style={styles.navigationTitle}>{item.title}</Text>
          <Text style={styles.navigationDescription}>{item.description}</Text>
        </View>
        <Ionicons 
          name={expandedItems.includes(item.id) ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#666" 
        />
      </View>
      
      {expandedItems.includes(item.id) && (
        <View style={styles.subItemsContainer}>
          {item.subItems.map((subItem) => (
            <TouchableOpacity
              key={subItem.id}
              style={styles.subNavigationCard}
              onPress={subItem.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.subNavigationIcon, { backgroundColor: subItem.color + '20' }]}>
                <Ionicons name={subItem.icon as any} size={18} color={subItem.color} />
              </View>
              <View style={styles.subNavigationContent}>
                <Text style={styles.subNavigationTitle}>{subItem.title}</Text>
                <Text style={styles.subNavigationDescription}>{subItem.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  // Filtrar itens de menu baseado na busca
  const filteredMenuItems = menuItems.filter(item =>
    item.title.toLowerCase().includes(searchText.toLowerCase()) ||
    item.description.toLowerCase().includes(searchText.toLowerCase()) ||
    item.subItems.some(subItem =>
      subItem.title.toLowerCase().includes(searchText.toLowerCase()) ||
      subItem.description.toLowerCase().includes(searchText.toLowerCase())
    )
  );



  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.dropdown,
                {
                  opacity: fadeAnim,
                  transform: [
                    { scale: scaleAnim },
                    { translateY: slideAnim },
                  ],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconContainer}>
                    <Ionicons name="cube" size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Gestão de Produtos</Text>
                    <Text style={styles.headerSubtitle}>Dashboard e Navegação</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Barra de Busca */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar produtos, categorias, tipos..."
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholderTextColor="#999"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>



                {/* Navegação Principal */}
                <View style={styles.navigationSection}>
                  <Text style={styles.sectionTitle}>Navegação</Text>
                  <View style={styles.navigationContainer}>
                    {filteredMenuItems.map(renderNavigationSection)}
                  </View>
                </View>

                {/* Mensagem quando não há resultados de busca */}
                {searchText.length > 0 && filteredMenuItems.length === 0 && (
                  <View style={styles.noResultsContainer}>
                    <Ionicons name="search" size={48} color="#CCC" />
                    <Text style={styles.noResultsText}>Nenhum resultado encontrado</Text>
                    <Text style={styles.noResultsSubtext}>Tente buscar por outros termos</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    );
  };

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxWidth: width * 0.95,
    width: '100%',
    maxHeight: height * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    backgroundColor: '#FAFBFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  closeButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Barra de Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    paddingLeft: 4,
  },

  // Navegação
  navigationSection: {
    marginBottom: 20,
  },
  navigationContainer: {
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  navigationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    width: '48%',
  },
  navigationCardActive: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  navigationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  navigationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  navigationContent: {
    flex: 1,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  navigationDescription: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  subItemsContainer: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  subNavigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  subNavigationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subNavigationContent: {
    flex: 1,
  },
  subNavigationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subNavigationDescription: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Sem resultados
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },


});

export default ProductsDropdown;
