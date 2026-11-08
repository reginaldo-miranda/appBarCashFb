import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { MANUAL_DATA, ManualCategory, ManualTopic } from '../../src/data/manualContent';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { companyService } from '../../src/services/api';

export default function AjudaScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [supportPhone, setSupportPhone] = useState<string>('1934525192');

  // Carrega telefone/WhatsApp atualizado dos dados da empresa
  useEffect(() => {
    let isMounted = true;
    const loadCompanyData = async () => {
      try {
        const res = await companyService.get();
        if (isMounted && res?.data) {
          const phone = res.data.whatsapp || res.data.telefone;
          if (phone && String(phone).trim().length >= 8) {
            setSupportPhone(String(phone).trim());
          }
        }
      } catch (err) {
        console.log('[AjudaScreen] Utilizando telefone de suporte padrão:', err);
      }
    };
    loadCompanyData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenWhatsApp = () => {
    const raw = supportPhone.replace(/\D/g, '');
    if (!raw) {
      if (Platform.OS === 'web') {
        window.alert('Número de suporte não configurado.');
      } else {
        Alert.alert('Suporte', 'Número de suporte não configurado.');
      }
      return;
    }
    const fullNumber = raw.startsWith('55') ? raw : `55${raw}`;
    const text = encodeURIComponent('Olá! Estou usando o sistema AppBarCash e preciso de suporte com a seguinte dúvida:');
    const url = `https://wa.me/${fullNumber}?text=${text}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(err => {
        console.error('Erro ao abrir link do WhatsApp:', err);
        Alert.alert('Erro', 'Não foi possível abrir o WhatsApp no seu dispositivo.');
      });
    }
  };

  const toggleCategory = (id: string) => {
    if (selectedCategory === id) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(id);
      setExpandedTopic(null);
    }
  };

  const toggleTopic = (id: string) => {
    setExpandedTopic(expandedTopic === id ? null : id);
  };

  // Helper para busca insensível a acentos
  const normalize = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Filtragem em tempo real
  const normalizedQuery = normalize(searchQuery.trim());

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return MANUAL_DATA;
    return MANUAL_DATA.map(category => {
      const catMatches =
        normalize(category.id).includes(normalizedQuery) ||
        normalize(category.title).includes(normalizedQuery) ||
        normalize(category.description).includes(normalizedQuery);

      const matchingTopics = category.topics.filter(topic =>
        normalize(topic.id).includes(normalizedQuery) ||
        normalize(topic.title).includes(normalizedQuery) ||
        normalize(topic.content).includes(normalizedQuery)
      );

      if (catMatches) {
        return category;
      }
      if (matchingTopics.length > 0) {
        return {
          ...category,
          topics: matchingTopics,
        };
      }
      return null;
    }).filter(Boolean) as ManualCategory[];
  }, [normalizedQuery]);

  const isCategoryExpanded = (catId: string) => {
    if (normalizedQuery.length > 0) return true;
    return selectedCategory === catId;
  };

  const isTopicExpanded = (topicId: string) => {
    if (normalizedQuery.length > 0) return true;
    return expandedTopic === topicId;
  };

  // Formatador de texto markdown limpo e legível
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    return (
      <View style={styles.topicContentWrapper}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <View key={idx} style={{ height: 8 }} />;
          }

          const isNumbered = /^\d+\.\s/.test(trimmed);
          const isBullet = /^[-*•]\s/.test(trimmed);

          let prefix = '';
          let body = trimmed;

          if (isNumbered) {
            const match = trimmed.match(/^(\d+\.)\s*(.*)$/);
            if (match) {
              prefix = match[1];
              body = match[2];
            }
          } else if (isBullet) {
            prefix = '•';
            body = trimmed.replace(/^[-*•]\s*/, '');
          }

          const segments = body.split(/(\*\*.*?\*\*)/g);

          return (
            <View
              key={idx}
              style={[
                styles.lineRow,
                (isNumbered || isBullet) && styles.listLineRow
              ]}
            >
              {prefix ? (
                <Text
                  style={[
                    styles.prefixText,
                    isNumbered ? styles.numberPrefix : styles.bulletPrefix
                  ]}
                >
                  {prefix}{' '}
                </Text>
              ) : null}
              <Text style={styles.lineBodyText}>
                {segments.map((seg, sIdx) => {
                  if (seg.startsWith('**') && seg.endsWith('**')) {
                    return (
                      <Text key={sIdx} style={styles.boldText}>
                        {seg.slice(2, -2)}
                      </Text>
                    );
                  }
                  return <Text key={sIdx}>{seg}</Text>;
                })}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenIdentifier screenName="Manual de Ajuda" />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manual de Ajuda 📘</Text>
        <Text style={styles.headerSubtitle}>
          Guia completo de operação e dúvidas frequentes
        </Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Barra de Pesquisa */}
        <View style={styles.searchBarContainer}>
          <SafeIcon name="search" size={20} color="#757575" fallbackText="🔍" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar tópico (ex: fiscal, contingência, caixa)..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <SafeIcon name="close-circle" size={18} color="#9E9E9E" fallbackText="✕" />
            </TouchableOpacity>
          )}
        </View>

        {/* Card em Destaque: Suporte Técnico WhatsApp */}
        <View style={styles.supportCard}>
          <View style={styles.supportHeaderRow}>
            <View style={styles.whatsappIconBox}>
              <SafeIcon name="logo-whatsapp" size={24} color="#fff" fallbackText="💬" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Precisa de Suporte Técnico?</Text>
              <Text style={styles.supportDesc}>
                Fale diretamente com nossa equipe de suporte pelo WhatsApp.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={handleOpenWhatsApp}
            activeOpacity={0.85}
          >
            <SafeIcon name="logo-whatsapp" size={20} color="#fff" fallbackText="💬" />
            <Text style={styles.supportBtnText}>Falar com Suporte</Text>
          </TouchableOpacity>
        </View>

        {/* Indicador de resultados da busca */}
        {normalizedQuery.length > 0 && (
          <View style={styles.searchSummaryBox}>
            <Text style={styles.searchSummaryText}>
              Exibindo resultados para: <Text style={{ fontWeight: 'bold' }}>"{searchQuery}"</Text>
            </Text>
          </View>
        )}

        {/* Estado vazio quando não encontra resultados */}
        {filteredCategories.length === 0 && (
          <View style={styles.emptyContainer}>
            <SafeIcon name="help-circle-outline" size={48} color="#BDBDBD" fallbackText="❓" />
            <Text style={styles.emptyTitle}>Nenhum tópico encontrado</Text>
            <Text style={styles.emptySubtitle}>
              Não encontramos resultados para "{searchQuery}". Tente pesquisar por outros termos ou entre em contato com nosso suporte no botão acima.
            </Text>
          </View>
        )}

        {/* Lista de Categorias e Tópicos */}
        {filteredCategories.map(category => {
          const categoryOpen = isCategoryExpanded(category.id);

          return (
            <View key={category.id} style={styles.categoryCard}>
              <TouchableOpacity
                style={[
                  styles.categoryHeader,
                  categoryOpen && styles.categoryHeaderActive
                ]}
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.8}
              >
                <View style={styles.categoryHeaderLeft}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: categoryOpen ? '#fff' : '#E3F2FD' }
                    ]}
                  >
                    <SafeIcon
                      name={category.icon as any}
                      size={22}
                      color="#1976D2"
                      fallbackText="📁"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.categoryTitle,
                        categoryOpen && { color: '#fff' }
                      ]}
                    >
                      {category.title}
                    </Text>
                    <Text
                      style={[
                        styles.categoryDesc,
                        categoryOpen && { color: '#E3F2FD' }
                      ]}
                    >
                      {category.description}
                    </Text>
                  </View>
                </View>
                <SafeIcon
                  name={categoryOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={categoryOpen ? '#fff' : '#757575'}
                  fallbackText={categoryOpen ? '▲' : '▼'}
                />
              </TouchableOpacity>

              {categoryOpen && (
                <View style={styles.topicsList}>
                  {category.topics.map(topic => {
                    const topicOpen = isTopicExpanded(topic.id);

                    return (
                      <View key={topic.id} style={styles.topicItem}>
                        <TouchableOpacity
                          style={styles.topicHeader}
                          onPress={() => toggleTopic(topic.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.topicTitle,
                              topicOpen && { color: '#1976D2', fontWeight: 'bold' }
                            ]}
                          >
                            {topic.title}
                          </Text>
                          <SafeIcon
                            name={topicOpen ? 'remove' : 'add'}
                            size={20}
                            color={topicOpen ? '#1976D2' : '#757575'}
                            fallbackText={topicOpen ? '-' : '+'}
                          />
                        </TouchableOpacity>

                        {topicOpen && (
                          <View style={styles.topicContentBox}>
                            {renderFormattedContent(topic.content)}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Barra de Pesquisa
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#212121',
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  // Card de Suporte WhatsApp
  supportCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  supportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  whatsappIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  supportDesc: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 2,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
  },
  supportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchSummaryBox: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  searchSummaryText: {
    fontSize: 13,
    color: '#616161',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#424242',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Cards de Categoria
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  categoryHeaderActive: {
    backgroundColor: '#1976D2',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
  },
  categoryDesc: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  // Lista de Tópicos
  topicsList: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  topicItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#37474F',
    flex: 1,
    marginRight: 8,
  },
  topicContentBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
  },
  topicContentWrapper: {
    width: '100%',
  },
  lineRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  listLineRow: {
    paddingLeft: 4,
    marginBottom: 6,
  },
  prefixText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 'bold',
  },
  numberPrefix: {
    color: '#1976D2',
    minWidth: 20,
  },
  bulletPrefix: {
    color: '#78909C',
    minWidth: 14,
  },
  lineBodyText: {
    flex: 1,
    fontSize: 13,
    color: '#424242',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#212121',
  },
});
