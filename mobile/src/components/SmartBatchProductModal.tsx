import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService } from '../services/api';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

interface BatchItem {
  id: string;
  nome: string;
  precoVenda: string;
  quantidade: string;
  images: { title: string; url: string; thumbnail: string }[];
  selectedImageUrl: string | null;
  searchingImages: boolean;
  searchDone: boolean;
}

interface SmartBatchProductModalProps {
  visible: boolean;
  onClose: () => void;
  categorias: { id?: string | number; nome: string }[];
  initialCategory?: string;
  products: any[];
  onSuccess: () => void;
}

export default function SmartBatchProductModal({
  visible,
  onClose,
  categorias,
  initialCategory,
  products,
  onSuccess,
}: SmartBatchProductModalProps) {
  const [selectedCat, setSelectedCat] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const searchTimers = useRef<{ [key: string]: any }>({});

  const createEmptyItem = (): BatchItem => ({
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    nome: '',
    precoVenda: '',
    quantidade: '0',
    images: [],
    selectedImageUrl: null,
    searchingImages: false,
    searchDone: false,
  });

  // Inicializa quando abre o modal
  useEffect(() => {
    if (visible) {
      const defaultCat = initialCategory || (categorias.length > 0 ? categorias[0].nome : '');
      setSelectedCat(defaultCat);
      setItems([createEmptyItem(), createEmptyItem(), createEmptyItem()]);
    }
  }, [visible, initialCategory]);

  // Identifica dados fiscais e locais herdados da categoria
  const inheritedData = useMemo(() => {
    if (!selectedCat) return null;
    const cat = selectedCat.trim().toLowerCase();
    const prodWithNcm = (products || []).find(
      (p: any) => (p.categoria || '').trim().toLowerCase() === cat && p.ncm
    );
    const prodAny = (products || []).find(
      (p: any) => (p.categoria || '').trim().toLowerCase() === cat
    );
    const sample = prodWithNcm || prodAny;

    let localVenda = sample?.localVendaNome;
    if (!localVenda) {
      if (cat.includes('cerveja') || cat.includes('refrigerante') || cat.includes('bebida') || cat.includes('suco') || cat.includes('agua')) {
        localVenda = 'Geladeira 1';
      } else if (cat.includes('porco') || cat.includes('lanche') || cat.includes('pizza') || cat.includes('comida')) {
        localVenda = 'Cozinha';
      } else if (cat.includes('dose') || cat.includes('drink') || cat.includes('whisky')) {
        localVenda = 'Bar / Doses';
      } else {
        localVenda = 'Balcão';
      }
    }

    return {
      ncm: sample?.ncm || 'A definir / Geral',
      cfop: sample?.cfop || '5102',
      csosn: sample?.csosn || '102',
      origem: sample?.origem !== undefined ? String(sample.origem) : '0',
      localVenda,
      temModelo: !!sample,
    };
  }, [selectedCat, products]);

  // Função para buscar imagens na web
  const triggerImageSearch = async (itemId: string, term: string) => {
    if (!term || term.trim().length < 3) return;

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, searchingImages: true } : i))
    );

    try {
      const response = await productService.searchWebImages(term.trim(), selectedCat);
      const foundImages = Array.isArray(response.data?.images) ? response.data.images : [];

      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== itemId) return i;
          return {
            ...i,
            searchingImages: false,
            searchDone: true,
            images: foundImages,
            // Pré-seleciona a primeira foto se ainda não houver nenhuma selecionada
            selectedImageUrl: i.selectedImageUrl || (foundImages.length > 0 ? foundImages[0].url : null),
          };
        })
      );
    } catch (err) {
      console.warn('Erro ao buscar foto na web:', err);
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, searchingImages: false, searchDone: true } : i))
      );
    }
  };

  const handleNomeChange = (itemId: string, text: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, nome: text } : i))
    );

    // Debounce automático de 900ms para disparar busca enquanto digita
    if (searchTimers.current[itemId]) {
      clearTimeout(searchTimers.current[itemId]);
    }
    if (text.trim().length >= 4) {
      searchTimers.current[itemId] = setTimeout(() => {
        triggerImageSearch(itemId, text);
      }, 900);
    }
  };

  const handlePrecoChange = (itemId: string, text: string) => {
    // Permite digitação com vírgula ou ponto
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, precoVenda: text } : i))
    );
  };

  const handleSelectImage = (itemId: string, url: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, selectedImageUrl: url } : i))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length <= 1) {
      Alert.alert('Atenção', 'Mantenha ao menos uma linha para cadastrar.');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleSubmit = async () => {
    if (!selectedCat.trim()) {
      Alert.alert('Erro', 'Por favor, selecione uma categoria.');
      return;
    }

    // Filtra apenas itens preenchidos com nome
    const validItems = items.filter((i) => i.nome.trim() !== '');

    if (validItems.length === 0) {
      Alert.alert('Erro', 'Informe ao menos o nome de 1 produto para cadastrar.');
      return;
    }

    // Formata itens para envio
    const payloadItems = validItems.map((i) => {
      const cleanPrice = i.precoVenda.replace('R$', '').replace(/\s/g, '').replace(',', '.');
      return {
        nome: i.nome.trim(),
        precoVenda: parseFloat(cleanPrice) || 0,
        quantidade: parseInt(i.quantidade, 10) || 0,
        imageUrl: i.selectedImageUrl,
        thumbnailUrl: i.images.find(img => img.url === i.selectedImageUrl)?.thumbnail || null,
      };
    });

    try {
      setLoading(true);
      const res = await productService.smartBatchCreate({
        categoria: selectedCat.trim(),
        items: payloadItems,
      });

      const count = res.data?.createdCount || payloadItems.length;
      Alert.alert(
        'Sucesso! 🎉',
        `Foram cadastrados ${count} produtos na categoria "${selectedCat}" com dados fiscais herdados e fotos locais salvas com sucesso!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro no cadastro inteligente:', err);
      Alert.alert('Erro', err.response?.data?.error || err.message || 'Erro ao cadastrar produtos em lote.');
    } finally {
      setLoading(false);
    }
  };

  const validCount = items.filter((i) => i.nome.trim() !== '').length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={18} color="#0284C7" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Cadastro Inteligente de Produtos</Text>
                <Text style={styles.modalSubtitle}>
                  Informe as marcas e preços — o sistema busca as fotos e herda os dados fiscais
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* 1. Escolha da Categoria */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionLabel}>1. Escolha a Categoria:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRibbon}>
                {categorias.map((cat) => {
                  const active = (selectedCat || '').toLowerCase() === cat.nome.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat.nome}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => setSelectedCat(cat.nome)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                        {cat.nome}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Faixa de Herança Fiscal */}
              {inheritedData && (
                <View style={styles.inheritanceBanner}>
                  <Ionicons name="shield-checkmark" size={14} color="#0284C7" />
                  <Text style={styles.inheritanceText}>
                    <Text style={{ fontWeight: 'bold' }}>Fiscal Herdado da Categoria:</Text> NCM:{' '}
                    <Text style={styles.codePill}>{inheritedData.ncm}</Text> | CFOP:{' '}
                    <Text style={styles.codePill}>{inheritedData.cfop}</Text> | CSOSN:{' '}
                    <Text style={styles.codePill}>{inheritedData.csosn}</Text> | Local:{' '}
                    <Text style={styles.codePill}>{inheritedData.localVenda}</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Grade de Marcas e Preços */}
            <View style={styles.sectionBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sectionLabel}>2. Produtos e Fotos da Internet:</Text>
                <TouchableOpacity style={styles.addLineBtn} onPress={handleAddItem} activeOpacity={0.8}>
                  <Ionicons name="add" size={14} color="#0284C7" />
                  <Text style={styles.addLineBtnText}>Adicionar Linha</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemsTable}>
                {items.map((item, idx) => {
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInputsRow}>
                        {/* Número da Linha */}
                        <View style={styles.rowIdxBadge}>
                          <Text style={styles.rowIdxText}>{idx + 1}</Text>
                        </View>

                        {/* Nome / Marca */}
                        <View style={{ flex: 2 }}>
                          <TextInput
                            style={styles.inputNome}
                            placeholder="Marca / Produto (Ex: Antarctica 600ml)"
                            placeholderTextColor="#94A3B8"
                            value={item.nome}
                            onChangeText={(t) => handleNomeChange(item.id, t)}
                            onBlur={() => triggerImageSearch(item.id, item.nome)}
                          />
                        </View>

                        {/* Preço de Venda */}
                        <View style={{ width: 110 }}>
                          <TextInput
                            style={styles.inputPreco}
                            placeholder="Preço (R$)"
                            placeholderTextColor="#94A3B8"
                            value={item.precoVenda}
                            onChangeText={(t) => handlePrecoChange(item.id, t)}
                            keyboardType="numeric"
                          />
                        </View>

                        {/* Botão de Busca Manual da Foto */}
                        <TouchableOpacity
                          style={styles.btnManualSearch}
                          onPress={() => triggerImageSearch(item.id, item.nome)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="search" size={13} color="#0284C7" />
                          <Text style={styles.btnManualSearchText}>Buscar Foto</Text>
                        </TouchableOpacity>

                        {/* Botão Excluir */}
                        <TouchableOpacity
                          style={styles.btnDeleteRow}
                          onPress={() => handleRemoveItem(item.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Seletor de Miniaturas de Fotos */}
                      <View style={styles.photoThumbnailsRow}>
                        <Text style={styles.photoRowLabel}>Fotos encontradas:</Text>

                        {item.searchingImages ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ActivityIndicator size="small" color="#0284C7" />
                            <Text style={styles.searchingText}>Buscando no Google/Web...</Text>
                          </View>
                        ) : item.images.length === 0 ? (
                          <Text style={styles.noPhotoText}>
                            {item.nome.trim().length > 3
                              ? 'Nenhuma foto encontrada. Você pode clicar em "Buscar Foto" ou digitar mais detalhes.'
                              : 'Digite o nome do produto para buscar as fotos automaticamente.'}
                          </Text>
                        ) : (
                          <View style={styles.thumbsList}>
                            {item.images.map((img, imgIdx) => {
                              const isSelected = item.selectedImageUrl === img.url;
                              return (
                                <TouchableOpacity
                                  key={img.url || imgIdx}
                                  style={[styles.thumbBox, isSelected && styles.thumbBoxSelected]}
                                  onPress={() => handleSelectImage(item.id, img.url)}
                                  activeOpacity={0.8}
                                >
                                  <Image source={{ uri: img.thumbnail || img.url }} style={styles.thumbImage} />
                                  {isSelected && (
                                    <View style={styles.selectedBadge}>
                                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                            <Text style={styles.clickHint}>
                              {item.selectedImageUrl ? '✓ Foto selecionada' : 'Clique na foto desejada'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (validCount === 0 || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={validCount === 0 || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Salvando e Baixando Fotos...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    Cadastrar {validCount} {validCount === 1 ? 'Produto' : 'Produtos'} com Fotos
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 820,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  modalBody: {
    padding: 14,
  },
  sectionBox: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  catRibbon: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inheritanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inheritanceText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
  },
  codePill: {
    fontWeight: 'bold',
    color: '#0284C7',
  },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addLineBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  itemsTable: {
    gap: 10,
  },
  itemRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  itemInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowIdxBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIdxText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#475569',
  },
  inputNome: {
    height: 34,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  inputPreco: {
    height: 34,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  btnManualSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 6,
  },
  btnManualSearchText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  btnDeleteRow: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    width: 34,
  },
  photoThumbnailsRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  photoRowLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  searchingText: {
    fontSize: 10.5,
    color: '#0284C7',
    fontStyle: 'italic',
  },
  noPhotoText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    flex: 1,
  },
  thumbsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbBoxSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    resizeMode: 'contain',
  },
  selectedBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#10B981',
    borderRadius: 6,
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clickHint: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
