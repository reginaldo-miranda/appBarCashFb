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
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface MissingProduct {
  _id: string; // CartItem ID or similar
  productId: string; // The actual product ID in DB
  nomeProduto: string;
  ncm: string;
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

  useEffect(() => {
    let mounted = true;
    if (visible && products.length > 0) {
      setLoading(true);
      // Initialize form data with existing (or empty) values from the cart item
      const initial: Record<string, { ncm: string; cfop: string; csosn: string }> = {};
      products.forEach(p => {
        initial[p.productId] = {
          ncm: p.ncm || '',
          cfop: p.cfop || '5102',
          csosn: p.csosn || '102'
        };
      });
      setFormData(initial);

      // Fetch fresh product data from backend to get existing fiscal info
      const fetchFreshData = async () => {
        try {
          // Busca individualmente cada produto para garantir que todos os itens com erro sejam encontrados
          const fetchPromises = products.map(p => 
             api.get(`/product/${p.productId}`).catch(err => null)
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
                         csosn: prev[pid]?.csosn ? prev[pid].csosn : (pCsosn || '102')
                     };
                 }
             });
             
             return updated;
          });

        } catch (e) {
          console.log('Erro ao buscar dados fiscais existentes:', e);
        } finally {
          if (mounted) setLoading(false);
        }
      };

      fetchFreshData();
    }

    return () => { mounted = false; };
  }, [visible, products]);

  const handleChange = (productId: string, field: 'ncm' | 'cfop' | 'csosn', value: string) => {
    setFormData(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    // Validate that all fields for all products are filled
    for (const p of products) {
      const data = formData[p.productId];
      if (!data || !data.ncm || !data.cfop || !data.csosn) {
        Alert.alert('Atenção', `Preencha todos os campos fiscais para o produto: ${p.nomeProduto}`);
        return;
      }
      if (data.ncm.replace(/\D/g, '').length !== 8 || data.ncm === '00000000' || data.ncm === '99998888') {
        Alert.alert('Atenção', `O NCM do produto ${p.nomeProduto} é inválido ou dummy. Informe um NCM real com 8 dígitos.`);
        return;
      }
      if (data.cfop.replace(/\D/g, '').length !== 4) {
        Alert.alert('Atenção', `O CFOP do produto ${p.nomeProduto} deve ter exatamente 4 dígitos.`);
        return;
      }
      if (data.csosn.replace(/\D/g, '').length !== 3) {
        Alert.alert('Atenção', `O CSOSN do produto ${p.nomeProduto} deve ter exatamente 3 dígitos.`);
        return;
      }
    }

    setLoading(true);
    try {
      // Tenta salvar no cadastro do produto (Best Effort - não bloqueia se falhar)
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
        console.log('Aviso: Falha ao salvar no cadastro do produto. Os dados digitados serão usados apenas nesta venda.', e);
      }
      
      onSuccess(formData);
    } catch (error: any) {
      console.error('Erro no fluxo de salvamento fiscal:', error);
      Alert.alert('Erro', 'Ocorreu um problema ao processar os dados fiscais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="document-text" size={24} color="#FF9800" />
            <Text style={styles.title}>Dados Fiscais Ausentes</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Para emitir a NFC-e, preencha o NCM, CFOP e CSOSN dos produtos abaixo.
          </Text>

          <ScrollView style={styles.scroll}>
            {products.map((p, index) => (
              <View key={p.productId} style={styles.productCard}>
                <Text style={styles.productName}>{index + 1}. {p.nomeProduto}</Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>NCM *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData[p.productId]?.ncm}
                      onChangeText={(t) => handleChange(p.productId, 'ncm', t)}
                      keyboardType="numeric"
                      maxLength={8}
                      placeholder="Ex: 22021000"
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>CFOP *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData[p.productId]?.cfop}
                      onChangeText={(t) => handleChange(p.productId, 'cfop', t)}
                      keyboardType="numeric"
                      maxLength={4}
                      placeholder="Ex: 5102"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>CSOSN *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData[p.productId]?.csosn}
                    onChangeText={(t) => handleChange(p.productId, 'csosn', t)}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="Ex: 102"
                  />
                </View>
              </View>
            ))}
          </ScrollView>

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
                <Text style={styles.saveBtnText}>Salvar e Continuar</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '85%',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E65100'
  },
  subtitle: {
    padding: 16,
    color: '#666',
    fontSize: 14,
    textAlign: 'center'
  },
  scroll: {
    paddingHorizontal: 16,
    flex: 1
  },
  productCard: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
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
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333'
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center'
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
    fontWeight: 'bold'
  },
  disabledBtn: {
    opacity: 0.7
  }
});
