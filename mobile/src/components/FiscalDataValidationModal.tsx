import React, { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface MissingProduct {
  _id: string;
  productId: string;
  nomeProduto: string;
  ncm: string;
  cfop: string;
  csosn: string;
}

interface NcmSugestao {
  ncm: string;
  descricao: string;
  cfop: string;
  csosn: string;
}

interface FiscalDataValidationModalProps {
  visible: boolean;
  products: MissingProduct[];
  onSuccess: (updatedFiscalData: Record<string, { ncm: string; cfop: string; csosn: string }>) => void;
  onCancel: () => void;
}

export default function FiscalDataValidationModal({
  visible,
  products,
  onSuccess,
  onCancel
}: FiscalDataValidationModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, { ncm: string; cfop: string; csosn: string }>>({});
  // Sugestões por productId
  const [sugestoes, setSugestoes] = useState<Record<string, NcmSugestao[]>>({});
  const [sugestaoLoading, setSugestaoLoading] = useState<Record<string, boolean>>({});
  const [sugestaoAplicada, setSugestaoAplicada] = useState<Record<string, boolean>>({});

  // ── Inicialização e busca de dados fiscais existentes ─────────────────────

  useEffect(() => {
    let mounted = true;
    if (visible && products.length > 0) {
      setLoading(true);
      setSugestoes({});
      setSugestaoAplicada({});

      const initial: Record<string, { ncm: string; cfop: string; csosn: string }> = {};
      products.forEach(p => {
        initial[p.productId] = {
          ncm: p.ncm || '',
          cfop: p.cfop || '5102',
          csosn: p.csosn || '102'
        };
      });
      setFormData(initial);

      const fetchFreshData = async () => {
        try {
          const fetchPromises = products.map(p =>
            api.get(`/product/${p.productId}`).catch(() => null)
          );
          const responses = await Promise.all(fetchPromises);

          if (!mounted) return;

          setFormData(prev => {
            const updated = { ...prev };
            responses.forEach((res, index) => {
              if (res && res.data) {
                const pData = res.data;
                const pid = products[index].productId;
                const pNcm = pData.ncm ? String(pData.ncm).replace(/\D/g, '') : '';
                const pCfop = pData.cfop ? String(pData.cfop).replace(/\D/g, '') : '';
                const pCsosn = pData.csosn ? String(pData.csosn).replace(/\D/g, '') : '';
                updated[pid] = {
                  ncm: prev[pid]?.ncm ? prev[pid].ncm : (pNcm || ''),
                  cfop: prev[pid]?.cfop ? prev[pid].cfop : (pCfop || '5102'),
                  csosn: prev[pid]?.csosn ? prev[pid].csosn : (pCsosn || '102'),
                };
              }
            });
            return updated;
          });
        } catch (e) {
          console.log('Erro ao buscar dados fiscais existentes:', e);
        } finally {
          if (mounted) {
            setLoading(false);
            // Após carregar, buscar sugestões automáticas para produtos sem NCM
            fetchSugestoesAuto(initial);
          }
        }
      };

      fetchFreshData();
    }

    return () => { mounted = false; };
  }, [visible, products]);

  // ── Busca automática de sugestões NCM ────────────────────────────────────

  const fetchSugestoesAuto = async (
    initialData: Record<string, { ncm: string; cfop: string; csosn: string }>
  ) => {
    // Buscar sugestões apenas para produtos sem NCM válido
    const semNcm = products.filter(p => {
      const ncm = (initialData[p.productId]?.ncm || '').replace(/\D/g, '');
      return ncm.length !== 8 || ncm === '00000000' || ncm === '99998888';
    });

    for (const p of semNcm) {
      fetchSugestaoParaProduto(p.productId, p.nomeProduto);
    }
  };

  const fetchSugestaoParaProduto = async (productId: string, nomeProduto: string) => {
    if (!nomeProduto) return;
    setSugestaoLoading(prev => ({ ...prev, [productId]: true }));
    try {
      const response = await api.get(`/product/suggest-ncm?nome=${encodeURIComponent(nomeProduto)}`);
      const { sugestoes: lista } = response.data;
      if (Array.isArray(lista) && lista.length > 0) {
        setSugestoes(prev => ({ ...prev, [productId]: lista }));
      }
    } catch {
      // Silencioso — não bloquear o usuário
    } finally {
      setSugestaoLoading(prev => ({ ...prev, [productId]: false }));
    }
  };

  // ── Aplicar sugestão nos campos ───────────────────────────────────────────

  const aplicarSugestao = (productId: string, sugestao: NcmSugestao) => {
    setFormData(prev => ({
      ...prev,
      [productId]: {
        ncm: sugestao.ncm,
        cfop: sugestao.cfop || '5102',
        csosn: sugestao.csosn || '102',
      }
    }));
    setSugestaoAplicada(prev => ({ ...prev, [productId]: true }));
  };

  // ── Abrir ChatGPT para pesquisa manual ───────────────────────────────────

  const abrirChatGPT = (nomeProduto: string) => {
    const query = `Qual é o código NCM brasileiro (Nomenclatura Comum do Mercosul) para o produto: "${nomeProduto}"? Informe apenas o código de 8 dígitos e uma breve explicação.`;
    const url = `https://chat.openai.com/?q=${encodeURIComponent(query)}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        // Fallback: Google
        const googleUrl = `https://www.google.com/search?q=NCM+${encodeURIComponent(nomeProduto)}+tabela+TIPI+2024`;
        Linking.openURL(googleUrl);
      });
    }
  };

  // ── Handlers de formulário ────────────────────────────────────────────────

  const handleChange = (productId: string, field: 'ncm' | 'cfop' | 'csosn', value: string) => {
    setFormData(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
    // Limpar badge de sugestão aplicada se o usuário editar manualmente
    if (field === 'ncm') {
      setSugestaoAplicada(prev => ({ ...prev, [productId]: false }));
    }
  };

  const handleSave = async () => {
    for (const p of products) {
      const data = formData[p.productId];
      if (!data || !data.ncm || !data.cfop || !data.csosn) {
        Alert.alert('Atenção', `Preencha todos os campos fiscais para o produto: ${p.nomeProduto}`);
        return;
      }
      if (data.ncm.replace(/\D/g, '').length !== 8 || data.ncm === '00000000' || data.ncm === '99998888') {
        Alert.alert('Atenção', `O NCM do produto "${p.nomeProduto}" é inválido. Informe um NCM real com 8 dígitos.`);
        return;
      }
      if (data.cfop.replace(/\D/g, '').length !== 4) {
        Alert.alert('Atenção', `O CFOP do produto "${p.nomeProduto}" deve ter exatamente 4 dígitos.`);
        return;
      }
      if (data.csosn.replace(/\D/g, '').length !== 3) {
        Alert.alert('Atenção', `O CSOSN do produto "${p.nomeProduto}" deve ter exatamente 3 dígitos.`);
        return;
      }
    }

    setLoading(true);
    try {
      try {
        const updatePromises = products.map(p => {
          const payload = formData[p.productId];
          return api.put(`/product/update/${p.productId}`, {
            ncm: payload.ncm,
            cfop: payload.cfop,
            csosn: payload.csosn
          });
        });
        await Promise.all(updatePromises);
      } catch (e) {
        console.log('Aviso: Falha ao salvar no cadastro. Os dados serão usados apenas nesta venda.', e);
      }
      onSuccess(formData);
    } catch (error: any) {
      console.error('Erro no fluxo de salvamento fiscal:', error);
      Alert.alert('Erro', 'Ocorreu um problema ao processar os dados fiscais.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="document-text" size={24} color="#FF9800" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Dados Fiscais Ausentes</Text>
              <Text style={styles.headerSubtitle}>
                {products.length} produto{products.length > 1 ? 's' : ''} com dados incompletos
              </Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Para emitir a NFC-e, preencha o NCM, CFOP e CSOSN abaixo.{'\n'}
            <Text style={{ color: '#2196F3', fontWeight: '600' }}>
              Sugestões automáticas serão buscadas para você ✨
            </Text>
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {products.map((p, index) => {
              const sugs = sugestoes[p.productId] || [];
              const carregando = sugestaoLoading[p.productId];
              const aplicado = sugestaoAplicada[p.productId];
              const ncmAtual = formData[p.productId]?.ncm || '';
              const ncmValido = ncmAtual.replace(/\D/g, '').length === 8 &&
                ncmAtual !== '00000000' &&
                ncmAtual !== '99998888';

              return (
                <View key={p.productId} style={styles.productCard}>
                  {/* Nome do produto */}
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>
                      {index + 1}. {p.nomeProduto}
                    </Text>
                    {ncmValido && (
                      <View style={styles.okBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                        <Text style={styles.okBadgeText}>OK</Text>
                      </View>
                    )}
                  </View>

                  {/* Sugestões automáticas */}
                  {carregando && (
                    <View style={styles.sugestaoLoadingRow}>
                      <ActivityIndicator size="small" color="#2196F3" />
                      <Text style={styles.sugestaoLoadingText}>Buscando NCM automaticamente...</Text>
                    </View>
                  )}

                  {!carregando && sugs.length > 0 && (
                    <View style={styles.sugestoesContainer}>
                      <Text style={styles.sugestoesLabel}>
                        <Ionicons name="bulb-outline" size={13} color="#FF9800" /> Sugestões encontradas:
                      </Text>
                      {sugs.map((sug, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.sugestaoChip,
                            aplicado && formData[p.productId]?.ncm === sug.ncm && styles.sugestaoChipAtiva
                          ]}
                          onPress={() => aplicarSugestao(p.productId, sug)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sugestaoNcm}>{sug.ncm}</Text>
                            <Text style={styles.sugestaoDesc} numberOfLines={2}>{sug.descricao}</Text>
                          </View>
                          <Ionicons
                            name={aplicado && formData[p.productId]?.ncm === sug.ncm ? 'checkmark-circle' : 'arrow-forward-circle-outline'}
                            size={22}
                            color={aplicado && formData[p.productId]?.ncm === sug.ncm ? '#4CAF50' : '#2196F3'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {!carregando && sugs.length === 0 && (
                    <View style={styles.semSugestaoRow}>
                      <Ionicons name="information-circle-outline" size={15} color="#999" />
                      <Text style={styles.semSugestaoText}>Nenhuma sugestão automática encontrada.</Text>
                    </View>
                  )}

                  {/* Botão ChatGPT */}
                  <TouchableOpacity
                    style={styles.chatGptBtn}
                    onPress={() => abrirChatGPT(p.nomeProduto)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#10a37f" />
                    <Text style={styles.chatGptBtnText}>Pesquisar com ChatGPT</Text>
                    <Ionicons name="open-outline" size={14} color="#10a37f" />
                  </TouchableOpacity>

                  {/* Campos manuais */}
                  <View style={styles.inputRow}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>NCM *</Text>
                      <TextInput
                        style={[styles.input, ncmValido && styles.inputValido]}
                        value={formData[p.productId]?.ncm || ''}
                        onChangeText={(t) => handleChange(p.productId, 'ncm', t.replace(/\D/g, ''))}
                        keyboardType="numeric"
                        maxLength={8}
                        placeholder="Ex: 22021000"
                        placeholderTextColor="#bbb"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>CFOP *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData[p.productId]?.cfop || ''}
                        onChangeText={(t) => handleChange(p.productId, 'cfop', t.replace(/\D/g, ''))}
                        keyboardType="numeric"
                        maxLength={4}
                        placeholder="5102"
                        placeholderTextColor="#bbb"
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>CSOSN *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData[p.productId]?.csosn || ''}
                      onChangeText={(t) => handleChange(p.productId, 'csosn', t.replace(/\D/g, ''))}
                      keyboardType="numeric"
                      maxLength={3}
                      placeholder="102"
                      placeholderTextColor="#bbb"
                    />
                  </View>
                </View>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelBtn]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveBtn, loading && styles.disabledBtn]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Salvar e Continuar</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  // Header
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF3E0'
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#E65100'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#BF360C',
    marginTop: 1
  },
  subtitle: {
    padding: 14,
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20
  },
  scroll: {
    paddingHorizontal: 14,
    flex: 1
  },
  // Card do produto
  productCard: {
    backgroundColor: '#FAFAFA',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  okBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3
  },
  okBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  // Sugestões
  sugestaoLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8
  },
  sugestaoLoadingText: {
    fontSize: 13,
    color: '#1565C0',
    fontStyle: 'italic'
  },
  sugestoesContainer: {
    marginBottom: 10,
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#C5E1A5'
  },
  sugestoesLabel: {
    fontSize: 12,
    color: '#558B2F',
    fontWeight: '700',
    marginBottom: 8
  },
  sugestaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    gap: 8
  },
  sugestaoChipAtiva: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9'
  },
  sugestaoNcm: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1565C0',
    letterSpacing: 1
  },
  sugestaoDesc: {
    fontSize: 12,
    color: '#555',
    marginTop: 2
  },
  semSugestaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8
  },
  semSugestaoText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic'
  },
  // Botão ChatGPT
  chatGptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10a37f',
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4'
  },
  chatGptBtnText: {
    color: '#10a37f',
    fontSize: 13,
    fontWeight: '600'
  },
  // Campos de input
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  inputContainer: {
    flex: 1
  },
  label: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333'
  },
  inputValido: {
    borderColor: '#4CAF50',
    backgroundColor: '#F9FFF9'
  },
  // Footer
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  cancelBtn: {
    backgroundColor: '#E0E0E0'
  },
  cancelBtnText: {
    color: '#333',
    fontWeight: 'bold'
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    flex: 1
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  },
  disabledBtn: {
    opacity: 0.7
  }
});
