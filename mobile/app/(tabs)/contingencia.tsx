import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NfceStatus = 'CONTINGENCIA' | 'CONTINGENCIA_REJEITADA' | 'CONTINGENCIA_EXPIRADA' | 'INUTILIZADA';

interface NfceContingencia {
  id: number;
  chave: string;
  numero: number;
  serie: number;
  status: NfceStatus;
  tpEmis: number;
  dhCont?: string;
  xJust?: string;
  tentativas: number;
  ultimaTentativa?: string;
  prazoLimite?: string;
  erroUltimo?: string;
  createdAt: string;
  sale?: {
    id: number;
    total: number;
    dataVenda: string;
    tipoVenda: string;
    cliente?: { nome: string };
  };
}

interface ContingenciaData {
  modoAtivo: boolean;
  dhCont?: string;
  xJust?: string;
  total: number;
  pendentes: number;
  rejeitadas: number;
  expiradas: number;
  nfces: NfceContingencia[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusConfig(status: NfceStatus) {
  switch (status) {
    case 'CONTINGENCIA':
      return { label: 'Pendente', color: '#FF9800', bg: '#FFF3E0', icon: 'time-outline' as const };
    case 'CONTINGENCIA_REJEITADA':
      return { label: 'Rejeitada', color: '#F44336', bg: '#FFEBEE', icon: 'close-circle-outline' as const };
    case 'CONTINGENCIA_EXPIRADA':
      return { label: 'Expirada', color: '#9C27B0', bg: '#F3E5F5', icon: 'warning-outline' as const };
    case 'INUTILIZADA':
      return { label: 'Inutilizada', color: '#607D8B', bg: '#ECEFF1', icon: 'ban-outline' as const };
    default:
      return { label: status, color: '#757575', bg: '#F5F5F5', icon: 'help-circle-outline' as const };
  }
}

function formatarPrazo(prazo?: string): { texto: string; urgente: boolean } {
  if (!prazo) return { texto: 'Sem prazo', urgente: false };
  const agora = new Date();
  const limite = new Date(prazo);
  const diffMs = limite.getTime() - agora.getTime();
  if (diffMs <= 0) return { texto: 'VENCIDO', urgente: true };
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const urgente = horas < 4;
  return { texto: `${horas}h ${minutos}min restantes`, urgente };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ContingenciaScreen() {
  const [data, setData] = useState<ContingenciaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [detailsModal, setDetailsModal] = useState<NfceContingencia | null>(null);

  // ── Carregamento ─────────────────────────────────────────────────────────

  const carregar = async () => {
    try {
      const res = await api.get('/nfce/contingencia/lista');
      if (res.data?.ok) {
        setData(res.data);
      }
    } catch (e: any) {
      console.error('Erro ao carregar contingências:', e);
      Alert.alert('Erro', 'Não foi possível carregar os dados de contingência.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregar();
    }, [])
  );

  // ── Ações ─────────────────────────────────────────────────────────────────

  const handleRetentar = async (nfce: NfceContingencia) => {
    const confirmAction = async () => {
        setActionLoading(nfce.id);
        try {
          const res = await api.post(`/nfce/contingencia/${nfce.id}/retentar`);
          if (res.data?.ok) {
            if (Platform.OS === 'web') window.alert('✅ Sucesso: ' + res.data.message);
            else Alert.alert('✅ Sucesso', res.data.message);
            await carregar();
          } else {
            if (Platform.OS === 'web') window.alert('❌ Falha: ' + (res.data?.message || 'Erro ao transmitir.'));
            else Alert.alert('❌ Falha', res.data?.message || 'Erro ao transmitir.');
            await carregar();
          }
        } catch (e: any) {
          if (Platform.OS === 'web') window.alert('Erro: ' + (e.response?.data?.message || 'Erro na transmissão.'));
          else Alert.alert('Erro', e.response?.data?.message || 'Erro na transmissão.');
          await carregar();
        } finally {
          setActionLoading(null);
        }
    };

    if (Platform.OS === 'web') {
        if (window.confirm(`Deseja tentar transmitir a NFC-e nº ${nfce.numero} para a SEFAZ agora?`)) {
            confirmAction();
        }
        return;
    }

    Alert.alert(
      'Retentar Transmissão',
      `Deseja tentar transmitir a NFC-e nº ${nfce.numero} para a SEFAZ agora?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Transmitir', onPress: confirmAction }
      ]
    );
  };

  const handleInutilizar = async (nfce: NfceContingencia) => {
    const confirmAction = async () => {
        setActionLoading(nfce.id);
        try {
          const res = await api.post(`/nfce/contingencia/${nfce.id}/inutilizar`);
          if (res.data?.ok) {
            if (Platform.OS === 'web') window.alert('✅ Sucesso: NFC-e inutilizada com sucesso.');
            else Alert.alert('✅ Sucesso', 'NFC-e inutilizada com sucesso.');
            await carregar();
          } else {
            if (Platform.OS === 'web') window.alert('❌ Erro: ' + (res.data?.message || 'Erro ao inutilizar.'));
            else Alert.alert('❌ Erro', res.data?.message || 'Erro ao inutilizar.');
          }
        } catch (e: any) {
             if (Platform.OS === 'web') window.alert('Erro: ' + (e.response?.data?.message || 'Erro ao inutilizar.'));
             else Alert.alert('Erro', e.response?.data?.message || 'Erro ao inutilizar.');
        } finally {
          setActionLoading(null);
        }
    };

    const msg = `Isso irá inutilizar a NFC-e nº ${nfce.numero}. Essa ação não pode ser desfeita.\n\nUse apenas se o cupom não puder ser transmitido e o prazo estiver próximo do vencimento.`;

    if (Platform.OS === 'web') {
        if (window.confirm('⚠️ Inutilizar Numeração: ' + msg)) {
            confirmAction();
        }
        return;
    }

    Alert.alert(
      '⚠️ Inutilizar Numeração',
      msg,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Inutilizar', style: 'destructive', onPress: confirmAction }
      ]
    );
  };

  const handleTentarTodos = async () => {
    const confirmAction = async () => {
        setRefreshing(true);
        try {
          const res = await api.post('/nfce/contingencia/desativar');
          if (Platform.OS === 'web') window.alert('🔄 Transmissão Iniciada: ' + (res.data?.message || 'Retransmissão em andamento.'));
          else Alert.alert('🔄 Transmissão Iniciada', res.data?.message || 'Retransmissão em andamento.');
          setTimeout(() => carregar(), 2000);
        } catch (e: any) {
          if (Platform.OS === 'web') window.alert('Erro: Não foi possível iniciar a transmissão.');
          else Alert.alert('Erro', 'Não foi possível iniciar a transmissão.');
        } finally {
          setRefreshing(false);
        }
    };

    if (Platform.OS === 'web') {
        if (window.confirm('Deseja tentar transmitir todas as NFC-es pendentes agora?')) {
            confirmAction();
        }
        return;
    }

    Alert.alert(
      'Transmitir Todas',
      'Deseja tentar transmitir todas as NFC-es pendentes agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Transmitir Todas', onPress: confirmAction }
      ]
    );
  };

  // ── Render Item ───────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: NfceContingencia }) => {
    const statusConfig = getStatusConfig(item.status);
    const prazo = formatarPrazo(item.prazoLimite);
    const isLoading = actionLoading === item.id;
    const canRetentar = ['CONTINGENCIA', 'CONTINGENCIA_REJEITADA'].includes(item.status);
    const canInutilizar = ['CONTINGENCIA', 'CONTINGENCIA_REJEITADA', 'CONTINGENCIA_EXPIRADA'].includes(item.status);

    return (
      <View style={[styles.card, { borderLeftColor: statusConfig.color }]}>
        {/* Header do Card */}
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardNumero}>NFC-e nº {item.numero} / Série {item.serie}</Text>
            <Text style={styles.cardValor}>
              R$ {Number(item.sale?.total || 0).toFixed(2)}
            </Text>
            <Text style={styles.cardData}>
              {new Date(item.createdAt).toLocaleString('pt-BR')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        {/* Prazo */}
        {item.status === 'CONTINGENCIA' && item.prazoLimite && (
          <View style={[styles.prazoRow, prazo.urgente && styles.prazoUrgente]}>
            <Ionicons name="alarm-outline" size={14} color={prazo.urgente ? '#F44336' : '#FF9800'} />
            <Text style={[styles.prazoText, prazo.urgente && styles.prazoTextoUrgente]}>
              ⏱ {prazo.texto}
            </Text>
          </View>
        )}

        {/* Tentativas */}
        <Text style={styles.tentativas}>
          {item.tentativas} tentativa(s) de transmissão
          {item.ultimaTentativa && ` • Última: ${new Date(item.ultimaTentativa).toLocaleString('pt-BR')}`}
        </Text>

        {/* Erro */}
        {item.erroUltimo && (
          <View style={styles.erroBox}>
            <Ionicons name="information-circle-outline" size={14} color='#D32F2F' />
            <Text style={styles.erroText} numberOfLines={2}>{item.erroUltimo}</Text>
          </View>
        )}

        {/* Ações */}
        <View style={styles.acoes}>
          <TouchableOpacity
            style={styles.btnDetalhes}
            onPress={() => setDetailsModal(item)}
          >
            <Ionicons name="eye-outline" size={14} color="#1565C0" />
            <Text style={styles.btnDetalhesText}>Detalhes</Text>
          </TouchableOpacity>

          {canRetentar && (
            <TouchableOpacity
              style={[styles.btnRetentar, isLoading && styles.btnDisabled]}
              onPress={() => handleRetentar(item)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={14} color="#fff" />
                  <Text style={styles.btnAcaoText}>Retentar</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canInutilizar && (
            <TouchableOpacity
              style={[styles.btnInutilizar, isLoading && styles.btnDisabled]}
              onPress={() => handleInutilizar(item)}
              disabled={isLoading}
            >
              <Ionicons name="ban-outline" size={14} color="#fff" />
              <Text style={styles.btnAcaoText}>Inutilizar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Carregando contingências...</Text>
      </View>
    );
  }

  const pendentes = data?.pendentes || 0;
  const rejeitadas = data?.rejeitadas || 0;
  const expiradas = data?.expiradas || 0;

  return (
    <View style={styles.container}>
      {/* ── Cabeçalho ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={data?.modoAtivo ? 'warning' : 'checkmark-circle'}
            size={26}
            color={data?.modoAtivo ? '#FF9800' : '#4CAF50'}
          />
          <View>
            <Text style={styles.headerTitle}>Contingência NFC-e</Text>
            <Text style={[
              styles.headerStatus,
              { color: data?.modoAtivo ? '#FF9800' : '#4CAF50' }
            ]}>
              {data?.modoAtivo ? '🟡 Modo ativo' : '🟢 Modo normal'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Resumo ─── */}
      <View style={styles.resumo}>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoNum, { color: '#FF9800' }]}>{pendentes}</Text>
          <Text style={styles.resumoLabel}>Pendentes</Text>
        </View>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoNum, { color: '#F44336' }]}>{rejeitadas}</Text>
          <Text style={styles.resumoLabel}>Rejeitadas</Text>
        </View>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoNum, { color: '#9C27B0' }]}>{expiradas}</Text>
          <Text style={styles.resumoLabel}>Expiradas</Text>
        </View>
      </View>

      {/* ── Botão Transmitir Todas ─── */}
      {pendentes > 0 && !data?.modoAtivo && (
        <TouchableOpacity style={styles.btnTransmitirTodas} onPress={handleTentarTodos}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.btnTransmitirTodasText}>Transmitir {pendentes} pendente(s) agora</Text>
        </TouchableOpacity>
      )}

      {/* ── Aviso modo ativo ─── */}
      {data?.modoAtivo && (
        <View style={styles.avisoAtivo}>
          <Ionicons name="information-circle" size={18} color="#FF9800" />
          <Text style={styles.avisoAtivoText}>
            Modo de contingência ativo. As NFC-es serão transmitidas ao desativar o modo em Configurações.
          </Text>
        </View>
      )}

      {/* ── Lista ─── */}
      <FlatList
        data={data?.nfces || []}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Ionicons name="checkmark-circle" size={64} color="#C8E6C9" />
            <Text style={styles.vazioTitulo}>Tudo em ordem!</Text>
            <Text style={styles.vazioTexto}>
              Nenhuma NFC-e em contingência no momento.
            </Text>
          </View>
        }
      />

      {/* ── Modal de Detalhes ─── */}
      <Modal visible={!!detailsModal} animationType="slide" presentationStyle="pageSheet">
        {detailsModal && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Contingência</Text>
              <TouchableOpacity onPress={() => setDetailsModal(null)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Status:</Text>
                <Text style={[styles.detalheValor, { color: getStatusConfig(detailsModal.status).color }]}>
                  {getStatusConfig(detailsModal.status).label}
                </Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>NFC-e Nº:</Text>
                <Text style={styles.detalheValor}>{detailsModal.numero} / Série {detailsModal.serie}</Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Tipo Emissão:</Text>
                <Text style={styles.detalheValor}>{detailsModal.tpEmis === 9 ? '9 - Contingência Offline' : '1 - Normal'}</Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Início Contingência:</Text>
                <Text style={styles.detalheValor}>
                  {detailsModal.dhCont ? new Date(detailsModal.dhCont).toLocaleString('pt-BR') : 'N/A'}
                </Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Prazo Limite:</Text>
                <Text style={styles.detalheValor}>
                  {detailsModal.prazoLimite ? new Date(detailsModal.prazoLimite).toLocaleString('pt-BR') : 'N/A'}
                </Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Tentativas:</Text>
                <Text style={styles.detalheValor}>{detailsModal.tentativas}</Text>
              </View>
              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Justificativa:</Text>
                <Text style={styles.detalheValor}>{detailsModal.xJust || 'Não informada'}</Text>
              </View>
              {detailsModal.erroUltimo && (
                <View style={[styles.detalheItem, { flexDirection: 'column' }]}>
                  <Text style={styles.detalheLabel}>Último Erro:</Text>
                  <Text style={[styles.detalheValor, { color: '#D32F2F', marginTop: 4 }]}>
                    {detailsModal.erroUltimo}
                  </Text>
                </View>
              )}
              <View style={[styles.detalheItem, { flexDirection: 'column' }]}>
                <Text style={styles.detalheLabel}>Chave de Acesso:</Text>
                <Text style={[styles.detalheValor, { fontSize: 11, marginTop: 4, color: '#555' }]}>
                  {detailsModal.chave}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  headerStatus: { fontSize: 13, marginTop: 2 },

  resumo: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resumoItem: { alignItems: 'center' },
  resumoNum: { fontSize: 22, fontWeight: 'bold' },
  resumoLabel: { fontSize: 12, color: '#666', marginTop: 2 },

  btnTransmitirTodas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1565C0',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnTransmitirTodasText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  avisoAtivo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  avisoAtivoText: { flex: 1, fontSize: 13, color: '#E65100', lineHeight: 18 },

  lista: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  cardNumero: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardValor: { fontSize: 18, fontWeight: '800', color: '#1565C0', marginTop: 2 },
  cardData: { fontSize: 12, color: '#888', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  prazoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  prazoUrgente: { backgroundColor: '#FFEBEE' },
  prazoText: { fontSize: 13, color: '#E65100', fontWeight: '600' },
  prazoTextoUrgente: { color: '#C62828' },

  tentativas: { fontSize: 12, color: '#888', marginBottom: 6 },

  erroBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  erroText: { flex: 1, fontSize: 12, color: '#D32F2F' },

  acoes: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  btnDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  btnDetalhesText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  btnRetentar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1565C0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnInutilizar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B71C1C',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnAcaoText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  vazio: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 10 },
  vazioTitulo: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  vazioTexto: { fontSize: 14, color: '#888', textAlign: 'center', paddingHorizontal: 32 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  modalClose: { padding: 4 },
  modalContent: { padding: 20 },
  detalheItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detalheLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detalheValor: { fontSize: 14, color: '#333', fontWeight: 'bold', maxWidth: '60%', textAlign: 'right' },
});
