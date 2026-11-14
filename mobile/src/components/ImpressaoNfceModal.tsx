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
  onContingenciaPress?: () => void;
}

// Dica inteligente de solução baseada no motivo do erro
const getErrorTip = (msg?: string) => {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (m.includes('duplicidade') || m.includes('204') || m.includes('539')) {
    return 'Dica: A numeração fiscal já foi usada na SEFAZ. Ajuste o "Próximo Número NFC-e" em Configurações > Fiscal para um número maior.';
  }
  if (m.includes('certificado') || m.includes('vencid') || m.includes('senha') || m.includes('pfx')) {
    return 'Dica: Verifique se o arquivo do Certificado Digital A1 (.pfx) e a senha foram preenchidos corretamente nas Configurações da Empresa.';
  }
  if (m.includes('ncm') || m.includes('cfop') || m.includes('csosn') || m.includes('schema') || m.includes('tribut')) {
    return 'Dica: Verifique o NCM, CFOP e dados tributários dos produtos desta venda no cadastro de Produtos.';
  }
  if (m.includes('timeout') || m.includes('network') || m.includes('conexão') || m.includes('comunica')) {
    return 'Dica: Os servidores da SEFAZ ou da rede local estão instáveis. Você pode tentar emitir em Contingência Offline.';
  }
  return null;
};

export default function ImpressaoNfceModal({ visible, onClose, status, message, nfceData, onContingenciaPress }: Props) {
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
        const resp = await NfceService.sendNfceEmail(saleId, emailInput);
        
        setShowEmailModal(false);
        showAlert('Sucesso', resp?.message || 'Cupom (PDF + XML) enviado para o e-mail com sucesso!');
    } catch (error: any) {
        console.error("Erro ao enviar email", error);
        const errMsg = typeof error === 'string' ? error : (error?.message || 'Falha ao enviar e-mail.');
        showAlert('Erro', errMsg);
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
                {/* Bloco único compacto: QR Code à esquerda + Dados da Nota à direita */}
                <View style={styles.successCardCompact}>
                  {nfceData?.qrCode?.base64 && (
                    <View style={styles.qrCodeCompactBox}>
                      <Image
                        source={{ uri: nfceData.qrCode.base64 }}
                        style={styles.qrCodeImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.qrCodeLabel}>Aponte a câmera</Text>
                    </View>
                  )}

                  <View style={styles.successInfoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                      <Text style={styles.successTitle}>Nota Autorizada!</Text>
                    </View>

                    <Text style={styles.successSubText}>
                      {message || 'Documento fiscal autorizado pela SEFAZ.'}
                    </Text>

                    {(nfceData?.nfce?.numero || nfceData?.nfce?.serie) && (
                      <View style={styles.nfceNumBadge}>
                        <Text style={styles.nfceNumText}>
                          Nº: {String(nfceData.nfce.numero).padStart(9, '0')} • Série: {nfceData.nfce.serie}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Grade de Botões em 2 Colunas */}
                <View style={styles.actionsGrid}>
                  <View style={styles.actionsRow}>
                    {nfceData?.pdfUrl && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FF9800', flex: 1 }]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.open(nfceData.pdfUrl, '_blank');
                          } else {
                            Linking.openURL(nfceData.pdfUrl);
                          }
                        }}
                      >
                        <Ionicons name="print" size={18} color="#fff" />
                        <Text style={styles.actionText}>Imprimir (PDF)</Text>
                      </TouchableOpacity>
                    )}

                    {nfceData?.pdfUrl && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#009688', flex: 1 }]}
                        onPress={() => setShowEmailModal(true)}
                      >
                        <Ionicons name="mail" size={18} color="#fff" />
                        <Text style={styles.actionText}>E-mail (PDF+XML)</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.actionsRow}>
                    {(nfceData?.urlConsulta || nfceData?.nfce?.qrCode || nfceData?.qrCode?.url) ? (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#2196F3', flex: 1 }]}
                        onPress={() => {
                          const url = nfceData?.qrCode?.url || nfceData?.nfce?.qrCode || nfceData?.urlConsulta;
                          if (url) Linking.openURL(url);
                        }}
                      >
                        <Ionicons name="qr-code" size={18} color="#fff" />
                        <Text style={styles.actionText}>Ver QR Code</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50', flex: 1 }]}
                      onPress={onClose}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.actionText}>Concluir / Fechar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {status === 'error' && (
              <View style={styles.center}>
                <Ionicons name="alert-circle" size={48} color="#F44336" />
                <Text style={styles.errorTitle}>Falha na Emissão</Text>
                
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxHeader}>Motivo retornado:</Text>
                  <Text style={styles.errorBoxText} selectable={true}>
                    {message || 'Ocorreu um erro ao comunicar com a SEFAZ.'}
                  </Text>
                </View>

                {getErrorTip(message) && (
                  <View style={styles.tipBox}>
                    <Ionicons name="bulb-outline" size={18} color="#E65100" style={{ marginRight: 6 }} />
                    <Text style={styles.tipText}>{getErrorTip(message)}</Text>
                  </View>
                )}
                
                <View style={[styles.actions, { marginTop: 14 }]}>
                  {onContingenciaPress && (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: '#FF9800' }]} 
                      onPress={onContingenciaPress}
                    >
                      <Ionicons name="cloud-offline" size={20} color="#fff" />
                      <Text style={styles.actionText}>Emitir em Contingência</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: '#757575' }]} 
                    onPress={onClose}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
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
                      <Text style={styles.title}>Enviar PDF + XML por E-mail</Text>
                      <TouchableOpacity onPress={() => setShowEmailModal(false)} disabled={sendingEmail}>
                          <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                  </View>
                  <View style={styles.content}>
                      <Text style={styles.subText}>Digite o e-mail do cliente abaixo para encaminhar o cupom fiscal (PDF + XML da NFC-e):</Text>
                      
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
    width: '92%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 5
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#eee'
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  content: { padding: 12, minHeight: 120 },
  center: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  loadingText: { marginTop: 14, fontSize: 15, fontWeight: '600', color: '#333' },
  subText: { marginTop: 6, color: '#666' },
  successCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    width: '100%',
    gap: 12,
  },
  qrCodeCompactBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  qrCodeImage: { width: 92, height: 92 },
  qrCodeLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  successInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  successTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  successSubText: { fontSize: 12, color: '#1B5E20', lineHeight: 16 },
  nfceNumBadge: {
    marginTop: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  nfceNumText: { fontSize: 12, fontWeight: 'bold', color: '#1E293B' },
  errorTitle: { marginTop: 8, fontSize: 17, fontWeight: 'bold', color: '#F44336' },
  message: { marginTop: 4, textAlign: 'center', color: '#555', fontSize: 13 },
  actions: { marginTop: 10, width: '100%', gap: 8 },
  actionsGrid: { marginTop: 10, width: '100%', gap: 8 },
  actionsRow: { flexDirection: 'row', width: '100%', gap: 8 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2196F3', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, gap: 6
  },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  qrCodeContainer: { alignItems: 'center', marginVertical: 6 },
  emailContainer: {
    width: '90%', maxWidth: 350, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 10
  },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginTop: 16, backgroundColor: '#FAFAFA'
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: '100%',
    maxHeight: 140,
  },
  errorBoxHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 4,
  },
  errorBoxText: {
    fontSize: 13,
    color: '#37474F',
    lineHeight: 18,
  },
  tipBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: '100%',
  },
  tipText: {
    fontSize: 12,
    color: '#E65100',
    flex: 1,
    lineHeight: 16,
  }
});
