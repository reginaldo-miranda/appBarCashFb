import React, { useState, useEffect, useMemo } from 'react';
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
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService } from '../services/api';

interface BulkFiscalModalProps {
  visible: boolean;
  onClose: () => void;
  initialCategory?: string;
  categorias: { id?: string | number; nome: string }[];
  products: any[];
  onSuccess: () => void;
}

export default function BulkFiscalModal({
  visible,
  onClose,
  initialCategory,
  categorias,
  products,
  onSuccess,
}: BulkFiscalModalProps) {
  const [selectedCat, setSelectedCat] = useState('');
  const [onlyMissingFiscal, setOnlyMissingFiscal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showReforma, setShowReforma] = useState(false);

  // Campos fiscais
  const [ncm, setNcm] = useState('');
  const [cest, setCest] = useState('');
  const [cfop, setCfop] = useState('5102');
  const [csosn, setCsosn] = useState('102');
  const [origem, setOrigem] = useState('0');

  // Reforma Tributária
  const [ibsCst, setIbsCst] = useState('410');
  const [ibsClassTrib, setIbsClassTrib] = useState('410031');
  const [ibsAliquota, setIbsAliquota] = useState('');
  const [cbsCst, setCbsCst] = useState('410');
  const [cbsClassTrib, setCbsClassTrib] = useState('410031');
  const [cbsAliquota, setCbsAliquota] = useState('');
  const [isAliquota, setIsAliquota] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedCat(initialCategory || (categorias.length > 0 ? categorias[0].nome : ''));
      setOnlyMissingFiscal(true);
      setShowReforma(false);
    }
  }, [visible, initialCategory, categorias]);

  // Contagem de produtos afetados
  const { totalCat, missingCat } = useMemo(() => {
    if (!selectedCat) return { totalCat: 0, missingCat: 0 };
    const inCat = products.filter(
      p => String(p.categoria || '').toLowerCase() === selectedCat.toLowerCase()
    );
    const missing = inCat.filter(
      p => !p.ncm || String(p.ncm).replace(/\D/g, '').length !== 8
    );
    return { totalCat: inCat.length, missingCat: missing.length };
  }, [selectedCat, products]);

  const targetCount = onlyMissingFiscal ? missingCat : totalCat;

  const handleOpenCosmos = () => {
    const term = selectedCat ? encodeURIComponent(selectedCat) : '';
    const url = term ? `https://cosmos.bluesoft.com.br/pesquisa?q=${term}` : 'https://cosmos.bluesoft.com.br';
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o Cosmos Bluesoft'));
  };

  const handleOpenGoogle = () => {
    const term = selectedCat ? encodeURIComponent(`NCM ${selectedCat}`) : 'tabela NCM produtos';
    Linking.openURL(`https://www.google.com/search?q=${term}`).catch(() => Alert.alert('Erro', 'Não foi possível abrir a busca do Google'));
  };

  const handleApply = async () => {
    if (!selectedCat) {
      Alert.alert('Atenção', 'Selecione uma categoria.');
      return;
    }

    const cleanNcm = ncm.replace(/\D/g, '');
    if (!cleanNcm || cleanNcm.length !== 8) {
      Alert.alert('Atenção', 'Informe um NCM válido de 8 dígitos para aplicar em massa.');
      return;
    }

    if (targetCount === 0) {
      Alert.alert('Aviso', 'Nenhum produto correspondente encontrado para atualizar nesta categoria.');
      return;
    }

    Alert.alert(
      'Confirmar Atualização em Massa',
      `Deseja aplicar estes dados fiscais a ${targetCount} produto(s) da categoria "${selectedCat}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar e Aplicar',
          onPress: async () => {
            setLoading(true);
            try {
              const payload = {
                categoriaNome: selectedCat,
                onlyMissingFiscal,
                ncm: cleanNcm,
                cest: cest.replace(/\D/g, ''),
                cfop: cfop.replace(/\D/g, '') || '5102',
                csosn: csosn ? String(csosn) : '102',
                origem: origem !== '' ? Number(origem) : 0,
                ibsCst: ibsCst ? ibsCst.replace(/\D/g, '') : null,
                ibsClassTrib: ibsClassTrib ? ibsClassTrib.replace(/\D/g, '') : null,
                ibsAliquota: ibsAliquota !== '' ? parseFloat(ibsAliquota.replace(',', '.')) : null,
                cbsCst: cbsCst ? cbsCst.replace(/\D/g, '') : null,
                cbsClassTrib: cbsClassTrib ? cbsClassTrib.replace(/\D/g, '') : null,
                cbsAliquota: cbsAliquota !== '' ? parseFloat(cbsAliquota.replace(',', '.')) : null,
                isAliquota: isAliquota !== '' ? parseFloat(isAliquota.replace(',', '.')) : null,
              };

              const resp = await productService.bulkUpdateFiscal(payload);
              Alert.alert(
                'Sucesso!',
                `${resp.data?.count || targetCount} produtos da categoria "${selectedCat}" foram atualizados com sucesso.`
              );
              onSuccess();
              onClose();
            } catch (err: any) {
              console.error('Erro ao aplicar fiscal em massa:', err);
              Alert.alert('Erro', err.response?.data?.error || 'Falha ao atualizar produtos em massa');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconBox}>
                <Ionicons name="flash" size={18} color="#D97706" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Aplicar Dados Fiscais em Massa</Text>
                <Text style={styles.headerSub}>Padronize NCM e Tributação por Categoria</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. Escolha da Categoria */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>1. Selecione a Categoria:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsRow}>
                {categorias.map(c => {
                  const isSel = selectedCat === c.nome;
                  return (
                    <TouchableOpacity
                      key={c.id || c.nome}
                      style={[styles.catChip, isSel && styles.catChipActive]}
                      onPress={() => setSelectedCat(c.nome)}
                    >
                      <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                        {c.nome}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. Resumo de Produtos Afetados & Modo de Aplicação */}
            <View style={styles.impactCard}>
              <View style={styles.impactHeader}>
                <Ionicons name="information-circle" size={16} color="#0284C7" />
                <Text style={styles.impactTitle}>
                  Categoria: <Text style={{ fontWeight: 'bold' }}>{selectedCat || 'Nenhuma'}</Text>
                </Text>
              </View>
              <Text style={styles.impactStats}>
                📦 Total de produtos: <Text style={{ fontWeight: 'bold' }}>{totalCat}</Text> | 🚨 Sem NCM válido: <Text style={{ fontWeight: 'bold', color: '#DC2626' }}>{missingCat}</Text>
              </Text>

              <View style={styles.scopeOptions}>
                <TouchableOpacity
                  style={[styles.scopeBtn, onlyMissingFiscal && styles.scopeBtnActive]}
                  onPress={() => setOnlyMissingFiscal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={onlyMissingFiscal ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={onlyMissingFiscal ? '#0284C7' : '#94A3B8'}
                  />
                  <Text style={[styles.scopeBtnText, onlyMissingFiscal && styles.scopeBtnTextActive]}>
                    Apenas os sem NCM ({missingCat})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scopeBtn, !onlyMissingFiscal && styles.scopeBtnActive]}
                  onPress={() => setOnlyMissingFiscal(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={!onlyMissingFiscal ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={!onlyMissingFiscal ? '#0284C7' : '#94A3B8'}
                  />
                  <Text style={[styles.scopeBtnText, !onlyMissingFiscal && styles.scopeBtnTextActive]}>
                    Todos da Categoria ({totalCat})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Dados Fiscais Comuns */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.sectionLabel}>2. Dados Fiscais Comuns:</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={styles.quickSearchBtn} onPress={handleOpenCosmos}>
                    <Text style={styles.quickSearchBtnText}>🌐 Cosmos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickSearchBtn} onPress={handleOpenGoogle}>
                    <Text style={styles.quickSearchBtnText}>🔍 Google</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1.5, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>NCM (8 dígitos) *</Text>
                  <TextInput
                    style={[styles.input, (!ncm || ncm.replace(/\D/g, '').length !== 8) && styles.inputWarning]}
                    placeholder="Ex: 22030000"
                    placeholderTextColor="#94A3B8"
                    value={ncm}
                    onChangeText={setNcm}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CEST</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 0300700"
                    placeholderTextColor="#94A3B8"
                    value={cest}
                    onChangeText={setCest}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={[styles.row, { marginTop: 8 }]}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>CFOP</Text>
                  <TextInput
                    style={styles.input}
                    value={cfop}
                    onChangeText={setCfop}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>CSOSN</Text>
                  <TextInput
                    style={styles.input}
                    value={csosn}
                    onChangeText={setCsosn}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Origem</Text>
                  <TextInput
                    style={styles.input}
                    value={origem}
                    onChangeText={setOrigem}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* 4. Acordeão Reforma Tributária (IBS / CBS) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setShowReforma(!showReforma)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={15} color="#6B21A8" />
                  <Text style={styles.accordionTitle}>Reforma Tributária (IBS / CBS)</Text>
                </View>
                <Ionicons
                  name={showReforma ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#6B21A8"
                />
              </TouchableOpacity>

              {showReforma && (
                <View style={styles.accordionBody}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>IBS CST</Text>
                      <TextInput
                        style={styles.input}
                        value={ibsCst}
                        onChangeText={setIbsCst}
                        placeholder="410"
                      />
                    </View>
                    <View style={{ flex: 1.5, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>IBS Class Trib</Text>
                      <TextInput
                        style={styles.input}
                        value={ibsClassTrib}
                        onChangeText={setIbsClassTrib}
                        placeholder="410031"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>IBS Alíq %</Text>
                      <TextInput
                        style={styles.input}
                        value={ibsAliquota}
                        onChangeText={setIbsAliquota}
                        placeholder="0.00"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={[styles.row, { marginTop: 8 }]}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>CBS CST</Text>
                      <TextInput
                        style={styles.input}
                        value={cbsCst}
                        onChangeText={setCbsCst}
                        placeholder="410"
                      />
                    </View>
                    <View style={{ flex: 1.5, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>CBS Class Trib</Text>
                      <TextInput
                        style={styles.input}
                        value={cbsClassTrib}
                        onChangeText={setCbsClassTrib}
                        placeholder="410031"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>CBS Alíq %</Text>
                      <TextInput
                        style={styles.input}
                        value={cbsAliquota}
                        onChangeText={setCbsAliquota}
                        placeholder="0.00"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer de Ação */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.applyBtn, loading && { opacity: 0.6 }]}
              onPress={handleApply}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.applyBtnText}>
                    Aplicar a {targetCount} produto(s)
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  catsRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#fff',
  },
  impactCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 10,
    marginBottom: 14,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  impactTitle: {
    fontSize: 12,
    color: '#0369A1',
  },
  impactStats: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 8,
  },
  scopeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  scopeBtnActive: {
    borderColor: '#0284C7',
    backgroundColor: '#E0F2FE',
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  scopeBtnTextActive: {
    color: '#0369A1',
    fontWeight: 'bold',
  },
  quickSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  quickSearchBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 3,
  },
  input: {
    height: 34,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  inputWarning: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  accordionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6B21A8',
  },
  accordionBody: {
    backgroundColor: '#FCFAFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E9D5FF',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});
