import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import api from '../services/api';

interface VoiceItem {
  produtoId: number;
  nome: string;
  quantidade: number;
  precoVenda: number;
  observacao?: string;
}

interface VoiceParsedData {
  action: string;
  comanda: number | null;
  mesa: number | null;
  clienteNome: string | null;
  garcomId: number | null;
  garcomNome: string | null;
  itens: VoiceItem[];
  itensNaoEncontrados?: string[];
  resumo: string;
  mensagemConfirmacao?: string;
}

export default function VoiceAssistantButton() {
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<VoiceParsedData | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const recognitionRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const latestTextRef = useRef<string>('');

  // Animação de pulsação ao ouvir
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isListening) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isListening]);

  // Inicializa a Web Speech API no navegador/web
  const startListening = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      alert('Comando de voz disponível apenas no navegador.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz (Web Speech API). Recomendamos o Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setSpokenText('');
        latestTextRef.current = '';
        setFeedbackMsg(null);
      };

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        latestTextRef.current = current;
        setSpokenText(current);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceAssistant] Erro no microfone:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        const textoCapturado = latestTextRef.current;
        if (textoCapturado && textoCapturado.trim().length >= 3) {
          processText(textoCapturado);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('[VoiceAssistant] Erro ao iniciar SpeechRecognition:', e);
      setIsListening(false);
    }
  };

  const processText = async (textToProcess: string) => {
    if (!textToProcess || textToProcess.trim().length < 3) return;

    setModalVisible(true);
    setLoading(true);
    setParsedData(null);

    try {
      const res = await api.post('/voice/parse', { text: textToProcess });
      if (res?.data?.ok && res.data.data) {
        setParsedData(res.data.data);

        // Fala a confirmação em voz alta no dispositivo (TTS)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(res.data.data.mensagemConfirmacao || res.data.data.resumo);
            utterance.lang = 'pt-BR';
            utterance.rate = 1.05;
            window.speechSynthesis.speak(utterance);
          } catch {}
        }
      } else {
        setFeedbackMsg({ text: 'Não foi possível interpretar o pedido.', type: 'error' });
      }
    } catch (err: any) {
      console.error('[VoiceAssistant] Erro ao enviar para /voice/parse:', err);
      setFeedbackMsg({ text: err?.response?.data?.message || 'Falha ao processar comando.', type: 'error' });
    } finally {
      setLoading(false);
      startConfirmationListener();
    }
  };

  const stopListeningAndProcess = async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);

    const textoFinal = latestTextRef.current || spokenText;
    if (textoFinal && textoFinal.trim().length >= 3) {
      processText(textoFinal);
    }
  };

  // Escuta se o garçom falar "Confirma" ou "Cancela" enquanto o modal estiver aberto
  const startConfirmationListener = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const confirmRec = new SpeechRecognition();
      confirmRec.lang = 'pt-BR';
      confirmRec.continuous = true;
      confirmRec.interimResults = false;

      confirmRec.onresult = (event: any) => {
        const last = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        if (last.includes('confirma') || last.includes('confirmar') || last.includes('enviar') || last.includes('ok')) {
          confirmRec.stop();
          handleExecuteOrder();
        } else if (last.includes('cancela') || last.includes('cancelar') || last.includes('fechar')) {
          confirmRec.stop();
          setModalVisible(false);
        }
      };

      confirmRec.start();
    } catch {}
  };

  // Executa o pedido no sistema
  const handleExecuteOrder = async () => {
    if (!parsedData || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/voice/execute', parsedData);
      if (res?.data?.ok) {
        setFeedbackMsg({ text: '✅ Pedido lançado com sucesso!', type: 'success' });
        setTimeout(() => {
          setModalVisible(false);
          setParsedData(null);
          setSpokenText('');
          setFeedbackMsg(null);
        }, 1500);
      } else {
        setFeedbackMsg({ text: res?.data?.message || 'Erro ao lançar pedido.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err?.response?.data?.message || 'Erro ao executar pedido.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calcularTotal = () => {
    if (!parsedData?.itens) return 0;
    return parsedData.itens.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  };

  return (
    <>
      {/* Botão Flutuante no Canto Inferior Direito */}
      <View style={styles.floatingContainer}>
        {isListening && (
          <View style={styles.liveBubble}>
            <Text style={styles.liveText} numberOfLines={2}>
              {spokenText || 'Fale agora: mesa, comanda, cliente e produtos...'}
            </Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.floatingBtn, isListening ? styles.floatingBtnActive : styles.floatingBtnIdle]}
            onPress={isListening ? stopListeningAndProcess : startListening}
            activeOpacity={0.8}
          >
            <Text style={styles.micIcon}>{isListening ? '⏹️' : '🎙️'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Modal de Confirmação do Pedido */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎙️ Pedido por Comando de Voz</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Processando pedido com Inteligência Artificial...</Text>
              </View>
            ) : parsedData ? (
              <ScrollView style={styles.scrollArea}>
                {/* Caixa de Confirmação em Destaque */}
                <View style={styles.confirmPromptBox}>
                  <Text style={styles.confirmPromptTitle}>📢 Confirmação do Pedido:</Text>
                  <Text style={styles.confirmPromptText}>
                    {parsedData.mensagemConfirmacao || parsedData.resumo}
                  </Text>
                </View>

                {/* O que foi falado */}
                <View style={styles.spokenBox}>
                  <Text style={styles.spokenLabel}>Você falou:</Text>
                  <Text style={styles.spokenValue}>"{spokenText}"</Text>
                </View>

                {/* Cartão de Identificação da Comanda */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryBadge}>
                      {parsedData.action === 'abertura_comanda'
                        ? '🟢 Abertura de Comanda'
                        : parsedData.comanda
                        ? `Comanda #${parsedData.comanda}`
                        : '🛒 Lançamento na Comanda'}
                    </Text>
                    {parsedData.clienteNome && (
                      <Text style={styles.clientBadge}>Cliente: {parsedData.clienteNome}</Text>
                    )}
                  </View>
                  {parsedData.garcomNome && (
                    <Text style={styles.garcomText}>Atendido por: {parsedData.garcomNome}</Text>
                  )}
                  {parsedData.action === 'abertura_comanda' && (
                    <Text style={styles.autoNumText}>• Número da comanda gerado automaticamente</Text>
                  )}
                </View>

                {/* Lista de Itens Identificados (Se for lançamento) */}
                {parsedData.itens && parsedData.itens.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Itens Identificados:</Text>
                    {parsedData.itens.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemQty}>{item.quantidade}x</Text>
                          <Text style={styles.itemName}>{item.nome}</Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          R$ {(item.precoVenda * item.quantidade).toFixed(2).replace('.', ',')}
                        </Text>
                      </View>
                    ))}

                    {/* Total */}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Estimado:</Text>
                      <Text style={styles.totalValue}>
                        R$ {calcularTotal().toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </>
                )}

                {/* Alerta de Itens Não Encontrados */}
                {parsedData.itensNaoEncontrados && parsedData.itensNaoEncontrados.length > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>⚠️ Itens não localizados no cardápio:</Text>
                    {parsedData.itensNaoEncontrados.map((it, i) => (
                      <Text key={i} style={styles.warningItem}>• {it}</Text>
                    ))}
                  </View>
                )}

                {feedbackMsg && (
                  <View style={[styles.feedbackBox, feedbackMsg.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                    <Text style={styles.feedbackText}>{feedbackMsg.text}</Text>
                  </View>
                )}

                <Text style={styles.voiceTip}>
                  💡 Dica: Você pode dizer <Text style={{ fontWeight: 'bold' }}>"Confirma"</Text> em voz alta ou clicar no botão abaixo.
                </Text>
              </ScrollView>
            ) : (
              <View style={styles.loadingBox}>
                <Text style={styles.errorText}>Não foi possível identificar o pedido.</Text>
              </View>
            )}

            {/* Ações do Rodapé */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, loading && styles.btnDisabled]}
                onPress={handleExecuteOrder}
                disabled={loading || !parsedData}
              >
                <Text style={styles.confirmBtnText}>
                  {loading ? 'Lançando...' : 'Confirmar Pedido (ou diga "Confirma")'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    bottom: 24,
    right: 24,
    zIndex: 999999,
    alignItems: 'flex-end',
  },
  liveBubble: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  liveText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  floatingBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingBtnIdle: {
    backgroundColor: '#2563EB',
  },
  floatingBtnActive: {
    backgroundColor: '#DC2626',
  },
  micIcon: {
    fontSize: 26,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  scrollArea: {
    maxHeight: 400,
  },
  confirmPromptBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  confirmPromptTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  confirmPromptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    lineHeight: 22,
  },
  autoNumText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  spokenBox: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  spokenLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  spokenValue: {
    fontSize: 14,
    color: '#1E293B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBadge: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clientBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  garcomText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 6,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQty: {
    fontWeight: 'bold',
    color: '#2563EB',
    fontSize: 14,
    marginRight: 8,
    width: 28,
  },
  itemName: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyItemsText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  warningItem: {
    fontSize: 12,
    color: '#B45309',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  voiceTip: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  feedbackBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  feedbackSuccess: {
    backgroundColor: '#DCFCE7',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#15803D',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#475569',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
});

