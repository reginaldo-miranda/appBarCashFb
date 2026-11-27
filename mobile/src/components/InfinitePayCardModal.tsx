import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  openInfinitePayTap,
  openInfinitePayAppForTap,
  listenForInfinitePayReturn,
  InfinitePayReturnData,
  shouldUseInfinitePayWebFlow,
} from '../services/infinitePayService';

interface InfinitePayCardModalProps {
  visible: boolean;
  amount: number;
  orderId: string;
  onClose: () => void;
  onManualPayment: () => void;
  onPaymentSuccess: (returnData?: InfinitePayReturnData) => void;
}

export default function InfinitePayCardModal({
  visible,
  amount,
  orderId,
  onClose,
  onManualPayment,
  onPaymentSuccess,
}: InfinitePayCardModalProps) {
  const [waitingReturn, setWaitingReturn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'credit' | 'debit'>('credit');

  useEffect(() => {
    if (!visible) {
      setWaitingReturn(false);
      setErrorMessage(null);
      setCopiedAmount(false);
      return;
    }

    // Escuta retornos da InfinitePay via DeepLink enquanto a modal estiver ativa
    const unsubscribe = listenForInfinitePayReturn((data) => {
      if (data.success) {
        setWaitingReturn(false);
        onPaymentSuccess(data);
      } else if (data.message) {
        Alert.alert('Pagamento Não Concluído', data.message || 'Transação cancelada ou não autorizada.');
        setWaitingReturn(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, onPaymentSuccess]);

  const handleSelectMethod = (method: 'credit' | 'debit') => {
    setErrorMessage(null);
    setCopiedAmount(false);
    setSelectedMethod(method);
    setWaitingReturn(true);

    if (shouldUseInfinitePayWebFlow()) {
      const result = openInfinitePayAppForTap(amount, method, orderId);
      setCopiedAmount(result.copied);
      return;
    }

    openInfinitePayTap({
      amount,
      method,
      orderId,
    }).then((result) => {
      if (!result.launched) {
        setWaitingReturn(false);
        setErrorMessage(result.message || result.reason || 'Não foi possível iniciar o pagamento.');
      }
    });
  };

  const handleOpenWebCheckout = async () => {
    setErrorMessage(null);
    setCopiedAmount(false);
    setWaitingReturn(true);

    const result = await openInfinitePayTap({
      amount,
      method: 'credit',
      orderId,
    });

    if (!result.launched) {
      setWaitingReturn(false);
      setErrorMessage(result.message || result.reason || 'Não foi possível gerar o link de pagamento.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.brandBadge}>
                <Ionicons name="card" size={20} color="#fff" />
              </View>
              <Text style={styles.title}>InfinitePay Tap</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Valor da Cobrança */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>
              {shouldUseInfinitePayWebFlow() ? 'Valor da Cobrança:' : 'Valor a Cobrar por Aproximação:'}
            </Text>
            <Text style={styles.amountValue}>
              R$ {Number(amount || 0).toFixed(2).replace('.', ',')}
            </Text>
          </View>

          {!waitingReturn ? (
            /* Seleção da Cobrança conforme a plataforma */
            <View style={styles.body}>
              {errorMessage ? (
                <View
                  style={{
                    backgroundColor: '#FFEBEE',
                    borderWidth: 1,
                    borderColor: '#EF9A9A',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ color: '#B71C1C', fontSize: 13, lineHeight: 18 }}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}
              {/* Seleção da modalidade do cartão (Crédito / Débito) */}
              <Text style={styles.subtitle}>Selecione a modalidade do cartão:</Text>

              <TouchableOpacity
                style={[styles.methodButton, styles.creditButton]}
                onPress={() => handleSelectMethod('credit')}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={24} color="#fff" />
                <View style={styles.methodTextContainer}>
                  <Text style={styles.methodButtonText}>Crédito (Aproximação)</Text>
                  <Text style={styles.methodButtonSubtext}>InfiniteTap / Cartão de Crédito</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodButton, styles.debitButton]}
                onPress={() => handleSelectMethod('debit')}
                activeOpacity={0.8}
              >
                <Ionicons name="wallet-outline" size={24} color="#fff" />
                <View style={styles.methodTextContainer}>
                  <Text style={styles.methodButtonText}>Débito (Aproximação)</Text>
                  <Text style={styles.methodButtonSubtext}>InfiniteTap / Cartão de Débito</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>

              {shouldUseInfinitePayWebFlow() ? (
                <TouchableOpacity
                  style={[styles.manualButton, { marginTop: 6 }]}
                  onPress={handleOpenWebCheckout}
                  activeOpacity={0.7}
                >
                  <Ionicons name="link-outline" size={18} color="#1565C0" />
                  <Text style={[styles.manualButtonText, { color: '#1565C0' }]}>
                    Link de Pagamento / Apple Pay (Online)
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Botão de contingência / Baixa Manual */}
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => {
                  onClose();
                  onManualPayment();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={18} color="#666" />
                <Text style={styles.manualButtonText}>Registrar Baixa Manualmente (Sem App)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Aguardando confirmação do app da InfinitePay */
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color="#00C853" style={{ marginBottom: 16 }} />
              <Text style={styles.waitingTitle}>Aguardando InfinitePay...</Text>
              <Text style={styles.waitingDesc}>
                {shouldUseInfinitePayWebFlow()
                  ? `Abrindo InfinitePay para cobrar R$ ${Number(amount || 0).toFixed(2).replace('.', ',')} no ${selectedMethod === 'debit' ? 'Débito' : 'Crédito'}. Aproxime o cartão no app e confirme abaixo.`
                  : 'Conclua a aproximação do cartão no app da InfinitePay.'}
              </Text>

              {shouldUseInfinitePayWebFlow() ? (
                <TouchableOpacity
                  style={[styles.confirmFallbackButton, { backgroundColor: '#1565C0', marginBottom: 10 }]}
                  onPress={() => openInfinitePayAppForTap(amount, selectedMethod, orderId)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.confirmFallbackText}>Reabrir App da InfinitePay</Text>
                </TouchableOpacity>
              ) : null}

              {/* Confirmação manual caso o callback demore ou não retorne */}
              <TouchableOpacity
                style={styles.confirmFallbackButton}
                onPress={() => {
                  setWaitingReturn(false);
                  onPaymentSuccess({
                    success: true,
                    amount,
                    orderId,
                    message: 'Confirmado manualmente pelo operador após InfinitePay',
                  });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.confirmFallbackText}>Já foi aprovado no InfinitePay (Confirmar)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelWaitingButton}
                onPress={() => setWaitingReturn(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelWaitingText}>Voltar às opções</Text>
              </TouchableOpacity>
            </View>
          )}
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
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  amountContainer: {
    backgroundColor: '#F1F8E9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#DCEDC8',
  },
  amountLabel: {
    fontSize: 13,
    color: '#558B2F',
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 2,
  },
  body: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 14,
    textAlign: 'center',
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  creditButton: {
    backgroundColor: '#1E88E5',
  },
  debitButton: {
    backgroundColor: '#00897B',
  },
  methodTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  methodButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    gap: 8,
  },
  manualButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  waitingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  waitingDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C853',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  confirmFallbackText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cancelWaitingButton: {
    paddingVertical: 8,
  },
  cancelWaitingText: {
    color: '#888',
    fontSize: 13,
  },
});
