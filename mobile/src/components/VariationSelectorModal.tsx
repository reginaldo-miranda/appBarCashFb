import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { variationTypeService, productService, categoryService } from '../services/api';
import { computeVariationPrice } from '../utils/variation';
import { Product, VariationType, ProductSize } from '../types/index';

interface VariationSelectorModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (payload: {
    tipoId?: number;
    tipoNome?: string;
    regraPreco?: 'mais_caro' | 'media' | 'fixo';
    maxOpcoes?: number;
    opcoes: Array<{ productId: number; fracao?: number }>;
    precoFixo?: number;
  }) => void;
  onConfirmWhole?: () => void;
  selectedSize?: ProductSize | null;
}

function formatFlavorName(name: string): string {
  const clean = String(name || '').replace(/^pizza\s+/i, '').trim();
  if (!clean) return name || '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export default function VariationSelectorModal({
  visible,
  product,
  onClose,
  onConfirm,
  onConfirmWhole,
  selectedSize,
}: VariationSelectorModalProps) {
  const [tipos, setTipos] = useState<VariationType[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<VariationType | null>(null);
  const [optionsProducts, setOptionsProducts] = useState<Product[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedOpcoes, setSelectedOpcoes] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible) {
      loadTipos();
      setSelectedOpcoes([]);
      setOptionsProducts([]);
      setSearchText('');
    }
  }, [visible]);

  useEffect(() => {
    if (selectedTipo) {
      loadOptionsProducts(selectedTipo);
    }
  }, [selectedTipo]);

  const loadTipos = async () => {
    try {
      setLoadingTipos(true);
      let resp;
      const catId = Number(product?.categoriaId || 0);
      if (Number.isInteger(catId) && catId > 0) {
        resp = await variationTypeService.byCategoryId(catId);
      } else {
        resp = await variationTypeService.list();
      }
      let arr = Array.isArray(resp?.data) ? resp.data : [];
      if (arr.length === 0 && Number.isInteger(catId) && catId > 0) {
        const fallbackResp = await variationTypeService.list();
        arr = Array.isArray(fallbackResp?.data) ? fallbackResp.data : [];
      }
      setTipos(arr as any);
      if (arr.length > 0) {
        setSelectedTipo(arr[0] as any);
      }
    } catch {
      setTipos([]);
    } finally {
      setLoadingTipos(false);
    }
  };

  const loadOptionsProducts = async (tipo: VariationType) => {
    try {
      setLoadingOptions(true);
      const [r, catRes] = await Promise.all([
        productService.getAll(),
        categoryService.getAll().catch(() => ({ data: [] })),
      ]);
      const all = Array.isArray(r?.data) ? r.data : [];
      const catList = Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : [];
      const ids = Array.isArray(tipo?.categoriasIds) ? tipo.categoriasIds.map(Number) : [];

      const allowedCategoryNames = new Set(
        catList
          .filter((c: any) => ids.includes(Number(c.id)))
          .map((c: any) => String(c.nome || '').trim().toLowerCase())
      );

      const filtered =
        ids.length > 0
          ? all.filter((p: any) => {
              const catId = Number(p?.categoriaId || 0);
              const catName = String(p?.categoria || '').trim().toLowerCase();
              const matchesId = Number.isInteger(catId) && ids.includes(catId);
              const matchesName = allowedCategoryNames.has(catName);
              const isDifferentProduct =
                String(p?._id ?? (p as any)?.id) !== String(product?._id ?? (product as any)?.id);
              return (matchesId || matchesName) && isDifferentProduct;
            })
          : all.filter((p: any) => String(p?._id ?? (p as any)?.id) !== String(product?._id ?? (product as any)?.id));

      const normalized = filtered
        .filter((p: any) => !!p?.ativo && !!p?.disponivel)
        .map((p: any) => ({
          _id: String(p?._id ?? p?.id ?? ''),
          nome: p?.nome ?? p?.nomeProduto ?? 'Produto',
          descricao: p?.descricao ?? '',
          precoVenda: Number(p?.precoVenda ?? p?.preco ?? 0),
          categoria: p?.categoria ?? '',
          categoriaId: p?.categoriaId ?? undefined,
          ativo: !!p?.ativo,
          disponivel: !!p?.disponivel,
          tamanhos: p?.tamanhos || [],
        }));
      setOptionsProducts(normalized as any);
    } catch {
      setOptionsProducts([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const maxOpcoes = Number(selectedTipo?.maxOpcoes || 2);
  const additionalNeeded = Math.max(1, maxOpcoes - 1);

  const toggleOpcao = (pid: number) => {
    setSelectedOpcoes((prev) => {
      if (prev.includes(pid)) {
        return [];
      }
      if (additionalNeeded === 1) {
        return [pid];
      }
      const next = [...prev, pid];
      if (next.length > additionalNeeded) {
        next.shift();
      }
      return next;
    });
  };

  const baseFlavorPrice = useMemo(() => {
    if (selectedSize && selectedSize.preco) {
      return Number(selectedSize.preco);
    }
    return Number(product?.precoVenda || 0);
  }, [product, selectedSize]);

  const precoCalculado = useMemo(() => {
    try {
      if (!selectedTipo || selectedOpcoes.length === 0) {
        return baseFlavorPrice;
      }
      const rule = String(selectedTipo?.regraPreco || 'mais_caro') as 'mais_caro' | 'media' | 'fixo';
      const chosen = optionsProducts.filter((p) =>
        selectedOpcoes.includes(parseInt(String((p as any)?._id ?? (p as any)?.id ?? 0), 10))
      );
      const secondPrices = chosen.map((p) => {
        if (selectedSize && Array.isArray(p.tamanhos)) {
          const match = p.tamanhos.find((t) => t.nome === selectedSize.nome);
          if (match) return Number(match.preco);
        }
        return Number(p.precoVenda || 0);
      });

      const allPrices = [baseFlavorPrice, ...secondPrices];
      const max = Number(selectedTipo?.maxOpcoes || 2);
      const fracs = allPrices.map(() => 1 / max);

      return computeVariationPrice(rule, baseFlavorPrice, allPrices, selectedTipo?.precoFixo ?? undefined, fracs);
    } catch {
      return baseFlavorPrice;
    }
  }, [selectedTipo, selectedOpcoes, optionsProducts, selectedSize, baseFlavorPrice]);

  const selectedPizzaName = useMemo(() => {
    const baseName = formatFlavorName(product?.nome || 'Pizza');
    if (!selectedTipo || selectedOpcoes.length === 0) {
      return `1/2 ${baseName}`;
    }
    const chosen = optionsProducts.filter((p) =>
      selectedOpcoes.includes(parseInt(String((p as any)?._id ?? (p as any)?.id ?? 0), 10))
    );
    const otherNames = chosen.map((p) => formatFlavorName(p.nome));
    const allFlavors = [baseName, ...otherNames];
    const fractionLabel = allFlavors.length === 2 ? '1/2' : `1/${allFlavors.length}`;
    const nameWithFracs = allFlavors.map((f) => `${fractionLabel} ${f}`).join(' / ');
    return selectedSize ? `${nameWithFracs} (${selectedSize.nome})` : nameWithFracs;
  }, [product, selectedTipo, selectedOpcoes, optionsProducts, selectedSize]);

  const displayedOptions = useMemo(() => {
    const arr = Array.isArray(optionsProducts) ? optionsProducts : [];
    const q = String(searchText || '').toLowerCase().trim();
    if (!q) return arr;
    return arr.filter((p) => String(p?.nome || '').toLowerCase().includes(q));
  }, [optionsProducts, searchText]);

  const canConfirm = useMemo(() => {
    if (!selectedTipo) return false;
    return selectedOpcoes.length === additionalNeeded;
  }, [selectedTipo, selectedOpcoes, additionalNeeded]);

  const handleConfirm = () => {
    if (!selectedTipo || !canConfirm || !product) return;
    const baseId = parseInt(String((product as any)?._id ?? (product as any)?.id ?? 0), 10);
    const max = Number(selectedTipo.maxOpcoes || 2);
    const fraction = 1 / max;

    const baseOption = {
      productId: baseId,
      fracao: fraction,
    };

    const additionalOptions = selectedOpcoes.map((id) => ({
      productId: id,
      fracao: fraction,
    }));

    const allOptions = [baseOption, ...additionalOptions];

    const payload = {
      tipoId: selectedTipo.id,
      tipoNome: selectedTipo.nome,
      regraPreco: selectedTipo.regraPreco,
      maxOpcoes: selectedTipo.maxOpcoes,
      opcoes: allOptions,
      precoFixo: selectedTipo.precoFixo ?? undefined,
    };

    onConfirm(payload);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Montar Pizza Meio a Meio</Text>
            {selectedSize && (
              <View style={styles.sizeBadgeHeader}>
                <Text style={styles.sizeBadgeHeaderText}>Tamanho: {selectedSize.nome}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Scrollable Content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Card de Destaque do 1º Sabor (Base) */}
          <View style={styles.baseFlavorCard}>
            <View style={styles.baseFlavorHeader}>
              <View style={styles.baseTag}>
                <Ionicons name="pizza" size={14} color="#15803D" style={{ marginRight: 4 }} />
                <Text style={styles.baseTagText}>1º SABOR (BASE ESCOLHIDA)</Text>
              </View>
              <View style={styles.fractionTag}>
                <Text style={styles.fractionTagText}>½ (50%)</Text>
              </View>
            </View>
            <View style={styles.baseFlavorBody}>
              <View style={{ flex: 1 }}>
                <Text style={styles.baseFlavorName}>{formatFlavorName(product?.nome || 'Pizza')}</Text>
                <Text style={styles.baseFlavorSub}>
                  {selectedSize ? `Tamanho ${selectedSize.nome} • ` : ''}R$ {baseFlavorPrice.toFixed(2)}
                </Text>
              </View>
              <View style={styles.baseCheckBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.baseCheckText}>1º Sabor</Text>
              </View>
            </View>
          </View>

          {/* Seleção do Tipo de Variação (se houver mais de 1) */}
          {tipos.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Divisão</Text>
              <View style={styles.tiposRow}>
                {tipos.map((t) => {
                  const isSel = selectedTipo?.id === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.tipoPill, isSel && styles.tipoPillActive]}
                      onPress={() => {
                        setSelectedTipo(t);
                        setSelectedOpcoes([]);
                      }}
                    >
                      <Text style={[styles.tipoPillText, isSel && styles.tipoPillTextActive]}>
                        {t.nome} ({t.maxOpcoes} sabores)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Seção do 2º Sabor */}
          {selectedTipo && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {additionalNeeded === 1
                    ? 'Escolha o 2º Sabor'
                    : `Escolha os Sabores Adicionais (${selectedOpcoes.length}/${additionalNeeded})`}
                </Text>
                <View style={[styles.stepBadge, selectedOpcoes.length === additionalNeeded && styles.stepBadgeDone]}>
                  <Text style={[styles.stepBadgeText, selectedOpcoes.length === additionalNeeded && styles.stepBadgeTextDone]}>
                    {selectedOpcoes.length === additionalNeeded ? '✓ Sabor Selecionado' : 'Aguardando seleção'}
                  </Text>
                </View>
              </View>

              {/* Barra de Busca */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar sabor (ex: calabresa, mussarela, palmito...)"
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista de Sabores */}
              {loadingOptions ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingText}>Carregando sabores...</Text>
                </View>
              ) : displayedOptions.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="alert-circle-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Nenhum sabor encontrado</Text>
                  <Text style={styles.emptySub}>Verifique o texto digitado ou as categorias de produtos.</Text>
                </View>
              ) : (
                <View style={styles.optionsList}>
                  {displayedOptions.map((item) => {
                    const id = parseInt(String((item as any)?._id ?? (item as any)?.id ?? 0), 10);
                    const isSelected = selectedOpcoes.includes(id);

                    let optPrice = Number(item.precoVenda || 0);
                    if (selectedSize && Array.isArray(item.tamanhos)) {
                      const match = item.tamanhos.find((t) => t.nome === selectedSize.nome);
                      if (match) optPrice = Number(match.preco);
                    }

                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.opcaoCard, isSelected && styles.opcaoCardSelected]}
                        onPress={() => toggleOpcao(id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.opcaoLeft}>
                          <Text style={[styles.opcaoNome, isSelected && styles.opcaoNomeSelected]}>
                            {formatFlavorName(item.nome)}
                          </Text>
                          {!!item.descricao && (
                            <Text style={styles.opcaoDesc} numberOfLines={1}>
                              {item.descricao}
                            </Text>
                          )}
                        </View>

                        <View style={styles.opcaoRight}>
                          <View style={styles.priceContainer}>
                            <Text style={styles.priceLabel}>
                              {selectedSize ? `Tam. ${selectedSize.nome}` : 'Preço'}
                            </Text>
                            <Text style={[styles.opcaoPreco, isSelected && styles.opcaoPrecoSelected]}>
                              R$ {optPrice.toFixed(2)}
                            </Text>
                          </View>

                          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Rodapé Fixo */}
        <View style={styles.footer}>
          <View style={styles.pricingSummaryRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.pricingTitleRow}>
                <Text style={styles.pricingLabel}>Preço Final da Pizza:</Text>
                {selectedOpcoes.length === additionalNeeded && (
                  <Text style={styles.selectedPizzaNameText}>
                    {selectedPizzaName}
                  </Text>
                )}
              </View>
              <Text style={styles.pricingRuleHint}>
                {selectedOpcoes.length === additionalNeeded
                  ? selectedTipo?.regraPreco === 'mais_caro'
                    ? 'Cobrado pelo sabor mais caro'
                    : 'Média dos sabores'
                  : 'Aguardando escolha do 2º sabor'}
              </Text>
            </View>
            <Text style={styles.pricingValue}>R$ {precoCalculado.toFixed(2)}</Text>
          </View>

          <View style={styles.footerButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            {onConfirmWhole && (
              <TouchableOpacity style={styles.wholeButton} onPress={onConfirmWhole}>
                <Ionicons name="pizza-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.wholeButtonText}>Pizza Inteira</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    padding: 6,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  sizeBadgeHeader: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sizeBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  baseFlavorCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  baseFlavorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  baseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baseTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  fractionTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fractionTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  baseFlavorBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baseFlavorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  baseFlavorSub: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  baseCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  baseCheckText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBadgeDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stepBadgeTextDone: {
    color: '#15803D',
  },
  tiposRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  tipoPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tipoPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  tipoPillText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  tipoPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  optionsList: {
    gap: 8,
  },
  opcaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  opcaoCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  opcaoLeft: {
    flex: 1,
    marginRight: 10,
  },
  opcaoNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  opcaoNomeSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  opcaoDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  opcaoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  opcaoPreco: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  opcaoPrecoSelected: {
    color: '#1D4ED8',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pricingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  selectedPizzaNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pricingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  pricingRuleHint: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },
  pricingValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  wholeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  wholeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
