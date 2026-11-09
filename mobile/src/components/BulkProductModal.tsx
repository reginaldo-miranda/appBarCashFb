import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService, getProductImageUrl } from '../services/api';

interface BulkProductModalProps {
  visible: boolean;
  onClose: () => void;
  baseProduct: any;
  onSuccess: () => void;
}

interface ProductCopy {
  id: string; // Temp ID
  nome: string;
  precoVenda: string;
  precoCusto: string;
  estoque: string;
  codigoBarras: string;
  ncm: string;
  imagem: string;
}

export default function BulkProductModal({ visible, onClose, baseProduct, onSuccess }: BulkProductModalProps) {
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState('1');
  const [copies, setCopies] = useState<ProductCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  const [uploadingCopyId, setUploadingCopyId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setQuantity('1');
      setCopies([]);
      setPhotoTargetId(null);
      setUploadingCopyId(null);
    }
  }, [visible]);

  const handleGenerateValues = () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }
    if (qty > 50) {
       Alert.alert('Erro', 'O limite máximo é de 50 itens por vez.');
       return;
    }

    const newCopies: ProductCopy[] = [];
    for (let i = 0; i < qty; i++) {
      newCopies.push({
        id: String(Date.now() + i),
        nome: `${baseProduct.nome || 'Produto'} #${i + 1}`,
        precoVenda: baseProduct.precoVenda ? Number(baseProduct.precoVenda).toFixed(2).replace('.', ',') : '0,00',
        precoCusto: baseProduct.precoCusto ? Number(baseProduct.precoCusto).toFixed(2).replace('.', ',') : '0,00',
        estoque: baseProduct.estoque ? String(baseProduct.estoque) : '0',
        codigoBarras: baseProduct.codigoBarras || '',
        ncm: baseProduct.ncm || '',
        imagem: baseProduct.imagem || '', // Herda automaticamente a foto do produto base
      });
    }
    setCopies(newCopies);
    setStep(2);
  };

  const updateCopy = (id: string, field: keyof ProductCopy, value: string) => {
    setCopies(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCopy = (id: string) => {
    setCopies(prev => prev.filter(c => c.id !== id));
  };

  const handlePickImage = async (copyId: string) => {
    setPhotoTargetId(null);
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            setUploadingCopyId(copyId);
            const data = new FormData();
            data.append('image', file);
            const res = await productService.uploadImage(data);
            if (res.data?.imageUrl) {
              updateCopy(copyId, 'imagem', res.data.imageUrl);
            }
          } catch (err: any) {
            console.error('Erro no upload de foto da cópia:', err);
            Alert.alert('Erro', 'Não foi possível enviar a foto.');
          } finally {
            setUploadingCopyId(null);
          }
        };
        input.click();
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const DocumentPicker = require('expo-document-picker');
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setUploadingCopyId(copyId);
          const data = new FormData();
          data.append('image', {
            uri: asset.uri,
            name: asset.name || 'photo.jpg',
            type: asset.mimeType || 'image/jpeg',
          } as any);
          const res = await productService.uploadImage(data);
          if (res.data?.imageUrl) {
            updateCopy(copyId, 'imagem', res.data.imageUrl);
          }
        }
      } catch (err) {
        console.error('Erro ao escolher foto:', err);
      } finally {
        setUploadingCopyId(null);
      }
    }
  };

  const handleSaveAll = async () => {
    if (copies.length === 0) return;

    setLoading(true);
    try {
      // Preparar payload
      const productsToCreate = copies.map(copy => ({
        ...baseProduct,
        nome: copy.nome,
        precoVenda: parseFloat(copy.precoVenda.replace(',', '.')),
        precoCusto: parseFloat(copy.precoCusto.replace(',', '.')),
        estoque: parseInt(copy.estoque) || 0,
        codigoBarras: copy.codigoBarras,
        ncm: copy.ncm,
        imagem: copy.imagem || null,
        // Remover campos de ID para garantir criação
        id: undefined,
        _id: undefined,
      }));

      await productService.createBulk(productsToCreate);

      const msg = 'Todos os produtos foram cadastrados com sucesso.';
      if (Platform.OS === 'web') {
        window.alert(msg);
        onSuccess();
      } else {
        Alert.alert('Sucesso!', msg, [
            { text: 'OK', onPress: onSuccess }
        ]);
      }
    } catch (error) {
      console.error('Erro ao replicar produtos:', error);
      Alert.alert('Erro', 'Falha ao salvar produtos em massa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Replicar Produto</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {step === 1 ? (
            <View style={styles.content}>
              <Text style={styles.label}>Quantas cópias deseja criar?</Text>
              <TextInput
                style={styles.inputQty}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.hint}>
                O produto base será duplicado com todas as suas configurações, incluindo fotos, locais e dados fiscais.
              </Text>
              
              <TouchableOpacity style={styles.button} onPress={handleGenerateValues}>
                <Text style={styles.buttonText}>Gerar Tabela</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, width: '100%' }}>
                <View style={[styles.gridHeader, { width: '100%', gap: 10 }]}>
                    <Text style={[styles.col, { width: 52, textAlign: 'center' }]}>Foto</Text>
                    <Text style={[styles.col, { flex: 1 }]}>Nome</Text>
                    <Text style={[styles.col, { width: 110, textAlign: 'right' }]}>Venda</Text>
                    <Text style={[styles.col, { width: 110, textAlign: 'right' }]}>Custo</Text>
                    <Text style={[styles.col, { width: 70, textAlign: 'right' }]}>Est.</Text>
                    <Text style={[styles.col, { width: 100, textAlign: 'right' }]}>NCM</Text>
                    <Text style={[styles.col, { width: 140, textAlign: 'right' }]}>Cód. Barras</Text>
                    <Text style={{ width: 44 }}></Text>
                </View>
                
                <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
                    {copies.map((copy) => (
                    <View key={copy.id} style={[styles.row, { width: '100%', gap: 10 }]}>
                        {/* Coluna de Foto (com miniatura ou botão para adicionar) */}
                        <TouchableOpacity
                            onPress={() => {
                                if (copy.imagem) {
                                    setPhotoTargetId(copy.id);
                                } else {
                                    handlePickImage(copy.id);
                                }
                            }}
                            style={styles.photoColBtn}
                            activeOpacity={0.7}
                        >
                            {uploadingCopyId === copy.id ? (
                                <ActivityIndicator size="small" color="#2196F3" />
                            ) : copy.imagem ? (
                                <Image
                                    source={{ uri: getProductImageUrl(copy.imagem) || '' }}
                                    style={styles.copyThumbnail}
                                />
                            ) : (
                                <View style={styles.noPhotoPlaceholder}>
                                    <Ionicons name="camera-outline" size={18} color="#94A3B8" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <TextInput 
                            style={[styles.input, { flex: 1 }]} 
                            value={copy.nome} 
                            onChangeText={t => updateCopy(copy.id, 'nome', t)}
                            placeholder="Nome"
                        />
                        <TextInput 
                            style={[styles.input, { width: 110, textAlign: 'right' }]} 
                            value={copy.precoVenda} 
                            onChangeText={t => updateCopy(copy.id, 'precoVenda', t)}
                            keyboardType="numeric"
                            placeholder="0,00"
                        />
                        <TextInput 
                            style={[styles.input, { width: 110, textAlign: 'right' }]} 
                            value={copy.precoCusto} 
                            onChangeText={t => updateCopy(copy.id, 'precoCusto', t)}
                            keyboardType="numeric"
                            placeholder="0,00"
                        />
                        <TextInput 
                            style={[styles.input, { width: 70, textAlign: 'right' }]} 
                            value={copy.estoque} 
                            onChangeText={t => updateCopy(copy.id, 'estoque', t)}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                        <TextInput 
                            style={[styles.input, { width: 100, textAlign: 'right' }]} 
                            value={copy.ncm} 
                            onChangeText={t => updateCopy(copy.id, 'ncm', t)}
                            keyboardType="numeric"
                            placeholder="NCM"
                        />
                        <TextInput 
                            style={[styles.input, { width: 140, textAlign: 'right' }]} 
                            value={copy.codigoBarras} 
                            onChangeText={t => updateCopy(copy.id, 'codigoBarras', t)}
                            placeholder="EAN/GTIN"
                        />
                        <TouchableOpacity onPress={() => removeCopy(copy.id)} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                    ))}
                </ScrollView>

            <View style={styles.footer}>
                 <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={() => setStep(1)}>
                    <Text style={[styles.buttonText, { color: '#666' }]}>Voltar</Text>
                 </TouchableOpacity>

                 <TouchableOpacity 
                    style={[styles.button, loading && { opacity: 0.7 }]} 
                    onPress={handleSaveAll}
                    disabled={loading}
                 >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar {copies.length} Produtos</Text>}
                 </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Modal de Ações da Foto (Trocar ou Remover) */}
      <Modal visible={!!photoTargetId} transparent animationType="fade" onRequestClose={() => setPhotoTargetId(null)}>
          <View style={styles.photoModalOverlay}>
              <View style={styles.photoModalCard}>
                  <Text style={styles.photoModalTitle}>Foto do Produto</Text>
                  {(() => {
                      const targetCopy = copies.find(c => c.id === photoTargetId);
                      if (!targetCopy?.imagem) return null;
                      return (
                          <Image
                              source={{ uri: getProductImageUrl(targetCopy.imagem) || '' }}
                              style={styles.photoModalPreview}
                          />
                      );
                  })()}
                  
                  <View style={styles.photoModalActions}>
                      <TouchableOpacity 
                          style={styles.photoActionBtnPrimary} 
                          onPress={() => photoTargetId && handlePickImage(photoTargetId)}
                      >
                          <Ionicons name="image-outline" size={18} color="#fff" />
                          <Text style={styles.photoActionTextPrimary}>Trocar Foto</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                          style={styles.photoActionBtnDanger} 
                          onPress={() => {
                              if (photoTargetId) updateCopy(photoTargetId, 'imagem', '');
                              setPhotoTargetId(null);
                          }}
                      >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                          <Text style={styles.photoActionTextDanger}>Remover Foto</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                          style={styles.photoActionBtnCancel} 
                          onPress={() => setPhotoTargetId(null)}
                      >
                          <Text style={styles.photoActionTextCancel}>Fechar</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 14,
    maxHeight: '90%',
    width: '95%',
    maxWidth: 1200,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B'
  },
  content: {
    padding: 24,
    alignItems: 'center'
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10
  },
  inputQty: {
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    padding: 10,
    width: 100,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
  },
  hint: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 20,
    maxWidth: 400,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 140
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  },
  gridHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center'
  },
  col: {
    fontWeight: 'bold',
    color: '#475569',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
    padding: 16
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center'
  },
  photoColBtn: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noPhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    height: 44,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    backgroundColor: '#E2E8F0',
  },
  // Photo Action Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  photoModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 14,
  },
  photoModalPreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoModalActions: {
    width: '100%',
    gap: 8,
  },
  photoActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  photoActionTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  photoActionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  photoActionTextDanger: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  photoActionBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  photoActionTextCancel: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
});
