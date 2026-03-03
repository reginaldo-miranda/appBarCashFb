import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Linking, Image, Platform, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import NfceService from '../services/NfceService';

interface Props {
  visible: boolean;
  onClose: () => void;
  status: 'loading' | 'success' | 'error' | 'idle';
  message?: string;
  nfceData?: any; // Dados retornados da API (url, qrcode, etc)
}

export default function ImpressaoNfceModal({ visible, onClose, status, message, nfceData }: Props) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleOpenUrl = () => {
    if (nfceData?.urlConsulta) {
      Linking.openURL(nfceData.urlConsulta);
    }
  };

  // Auto-print (Auto-open PDF) when success
  React.useEffect(() => {
    if (status === 'success' && nfceData?.pdfUrl) {
       // Pequeno delay para garantir que o modal renderizou
       setTimeout(() => {
           Linking.openURL(nfceData.pdfUrl);
       }, 500);
    }
  }, [status, nfceData]);

  const extractSaleId = () => {
      if (nfceData?.nfce?.saleId) return nfceData.nfce.saleId;
      if (nfceData?.pdfUrl) {
          const match = nfceData.pdfUrl.match(/\/api\/nfce\/(\d+)\/pdf/);
          if (match && match[1]) return match[1];
      }
      return null;
  };

  const showAlert = (title: string, msg: string) => {
      if (Platform.OS === 'web') {
          window.alert(`${title}: ${msg}`);
      } else {
          Alert.alert(title, msg);
      }
  };

  const handleSendEmail = async () => {
    if (!emailInput || !emailInput.includes('@')) {
        showAlert('Aviso', 'Por favor, insira um e-mail válido.');
        return;
    }
    
    const saleId = extractSaleId();
    if (!saleId) {
        showAlert('Erro', 'Não foi possível identificar o ID da venda associado à NFC-e.');
        return;
    }

    try {
        setSendingEmail(true);
        await NfceService.sendNfceEmail(saleId, emailInput);
        
        setShowEmailModal(false);
        showAlert('Sucesso', 'Cupom enviado para o e-mail com sucesso!');
    } catch (error: any) {
        console.error("Erro ao enviar email", error);
        showAlert('Erro', error.message || 'Falha ao enviar e-mail.');
    } finally {
        setSendingEmail(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Emissão NFC-e</Text>
            <TouchableOpacity onPress={onClose} disabled={status === 'loading'}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {status === 'loading' && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Emitindo nota fiscal...</Text>
                <Text style={styles.subText}>Aguarde a resposta da SEFAZ</Text>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.center}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                <Text style={styles.successTitle}>Nota Autorizada!</Text>
                
                {nfceData?.qrCode?.base64 && (
                  <View style={styles.qrCodeContainer}>
                    <Image 
                      source={{ uri: nfceData.qrCode.base64 }} 
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrCodeLabel}>Aponte a câmera do celular</Text>
                  </View>
                )}

                {(nfceData?.nfce?.numero || nfceData?.nfce?.serie) ? (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#E8F5E9', borderRadius: 8, width: '100%', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' }}>✅ NFC-e emitida com sucesso</Text>
                        <Text style={{ fontSize: 13, color: '#1B5E20', marginTop: 4, textAlign: 'center' }}>Documento fiscal autorizado pela SEFAZ.</Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 8 }}>
                            Nº: {String(nfceData.nfce.numero).padStart(9, '0')} – Série: {nfceData.nfce.serie}
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.message}>{message || 'NFC-e emitida com sucesso.'}</Text>
                )}
                
                {/* Fallback para botão se não tiver imagem, ou ambos */}
                {(nfceData?.urlConsulta || nfceData?.nfce?.qrCode || nfceData?.qrCode?.url) && (
                  <View style={styles.actions}>
                    {nfceData?.pdfUrl && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF9800' }]} onPress={() => {
                            if (Platform.OS === 'web') {
                                window.open(nfceData.pdfUrl, '_blank');
                            } else {
                                Linking.openURL(nfceData.pdfUrl);
                            }
                        }}>
                        <Ionicons name="print" size={20} color="#fff" />
                        <Text style={styles.actionText}>Imprimir Cupom (PDF)</Text>
                        </TouchableOpacity>
                    )}

                    {nfceData?.pdfUrl && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#009688' }]} onPress={() => setShowEmailModal(true)}>
                            <Ionicons name="mail" size={20} color="#fff" />
                            <Text style={styles.actionText}>Enviar por E-mail</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.actionButton} onPress={() => {
                       const url = nfceData?.qrCode?.url || nfceData?.nfce?.qrCode || nfceData?.urlConsulta;
                       if(url) Linking.openURL(url);
                    }}>
                      <Ionicons name="qr-code" size={20} color="#fff" />
                      <Text style={styles.actionText}>Visualizar QR Code</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {status === 'error' && (
              <View style={styles.center}>
                <Ionicons name="alert-circle" size={48} color="#F44336" />
                <Text style={styles.errorTitle}>Falha na Emissão</Text>
                <Text style={styles.message}>{message || 'Ocorreu um erro ao comunicar com a SEFAZ.'}</Text>
                
                <TouchableOpacity style={[styles.actionButton, {backgroundColor:'#757575', marginTop:20}]} onPress={onClose}>
                  <Text style={styles.actionText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Modal para inserção de E-mail */}
      <Modal visible={showEmailModal} transparent animationType="slide">
          <View style={styles.overlay}>
              <View style={styles.emailContainer}>
                  <View style={styles.header}>
                      <Text style={styles.title}>Enviar PDF por E-mail</Text>
                      <TouchableOpacity onPress={() => setShowEmailModal(false)} disabled={sendingEmail}>
                          <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                  </View>
                  <View style={styles.content}>
                      <Text style={styles.subText}>Digite o e-mail do cliente abaixo para encaminhar o cupom fiscal (NFC-e):</Text>
                      
                      <TextInput
                          style={styles.input}
                          placeholder="cliente@email.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={emailInput}
                          onChangeText={setEmailInput}
                          editable={!sendingEmail}
                      />

                      <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: sendingEmail ? '#B0BEC5' : '#009688', marginTop: 16 }]} 
                          onPress={handleSendEmail}
                          disabled={sendingEmail}
                      >
                          {sendingEmail ? (
                              <ActivityIndicator size="small" color="#fff" />
                          ) : (
                              <>
                                <Ionicons name="send" size={20} color="#fff" />
                                <Text style={styles.actionText}>Confirmar e Enviar</Text>
                              </>
                          )}
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center'
  },
  container: {
    width: '90%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 5
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderColor: '#eee'
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { padding: 16, minHeight: 150 },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#333' },
  subText: { marginTop: 8, color: '#666' },
  successTitle: { marginTop: 8, fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  errorTitle: { marginTop: 8, fontSize: 18, fontWeight: 'bold', color: '#F44336' },
  message: { marginTop: 4, textAlign: 'center', color: '#555', fontSize: 14 },
  actions: { marginTop: 12, width: '100%', gap: 8 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2196F3', padding: 10, borderRadius: 8, gap: 8
  },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  qrCodeContainer: { alignItems: 'center', marginVertical: 8 },
  qrCodeImage: { width: 120, height: 120 },
  qrCodeLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  emailContainer: {
    width: '90%', maxWidth: 350, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 10
  },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginTop: 16, backgroundColor: '#FAFAFA'
  }
});
