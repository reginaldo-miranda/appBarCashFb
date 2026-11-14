import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import TabletCozinhaScreen from '../src/screens/TabletCozinhaScreen';
import TabletBarScreen from '../src/screens/TabletBarScreen';
import BillRequestAlertBanner from '../src/components/BillRequestAlertBanner';
import { apiService, authService, setApiBaseUrl } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/services/storage';
import {
  SOUND_VOLUME_KEY,
  SOUND_MUTED_KEY,
  getSavedSoundConfig,
  playOrderAlertSound,
  stopOrderAlertSound,
} from '../src/utils/orderAlertSound';

export default function TabletMode() {
  const { width } = useWindowDimensions();
  const split = false;
  const [setores, setSetores] = React.useState<any[]>([]);
  const [activeSetorId, setActiveSetorId] = React.useState<number | string | null>('todos');
  const [activeView, setActiveView] = React.useState<'setor' | 'pronto' | 'entregue'>('setor');
  const [hiddenDeliveredIds, setHiddenDeliveredIds] = React.useState<number[]>([]);
  const [soundVolume, setSoundVolume] = React.useState<number>(80);
  const [soundMuted, setSoundMuted] = React.useState<boolean>(false);
  const [clearModalVisible, setClearModalVisible] = React.useState<boolean>(false);
  const [clearDateFrom, setClearDateFrom] = React.useState<string>('');
  const [clearDateTo, setClearDateTo] = React.useState<string>('');
  const [clearingDelivered, setClearingDelivered] = React.useState<boolean>(false);
  const [refreshKey, setRefreshKey] = React.useState<number>(0);

  const formatDateBR = (d: Date): string => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const applyDateMask = (val: string): string => {
    const digits = String(val || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const parseBrToIso = (br: string): string | null => {
    const trimmed = String(br || '').trim();
    if (!trimmed) return '';
    const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 2000 || yyyy > 2100) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const showNotice = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  React.useEffect(() => {
    getSavedSoundConfig().then(({ volume, muted }) => {
      setSoundVolume(volume);
      setSoundMuted(muted);
    });
    return () => {
      stopOrderAlertSound();
    };
  }, []);

  const handleToggleMute = async () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    try {
      await AsyncStorage.setItem(SOUND_MUTED_KEY, String(nextMuted));
    } catch {}
    if (nextMuted) {
      stopOrderAlertSound();
    } else {
      playOrderAlertSound(soundVolume, false, true);
    }
  };

  const handleAdjustVolume = async (delta: number) => {
    const nextVol = Math.max(0, Math.min(100, soundVolume + delta));
    const nextMuted = nextVol === 0;
    setSoundVolume(nextVol);
    setSoundMuted(nextMuted);
    try {
      await Promise.all([
        AsyncStorage.setItem(SOUND_VOLUME_KEY, String(nextVol)),
        AsyncStorage.setItem(SOUND_MUTED_KEY, String(nextMuted)),
      ]);
    } catch {}
    if (!nextMuted) {
      playOrderAlertSound(nextVol, false, true);
    } else {
      stopOrderAlertSound();
    }
  };

  const handleTestSound = async () => {
    const volToPlay = soundVolume > 0 ? soundVolume : 80;
    if (soundMuted || soundVolume === 0) {
      setSoundMuted(false);
      setSoundVolume(volToPlay);
      try {
        await Promise.all([
          AsyncStorage.setItem(SOUND_VOLUME_KEY, String(volToPlay)),
          AsyncStorage.setItem(SOUND_MUTED_KEY, 'false'),
        ]);
      } catch {}
    }
    playOrderAlertSound(volToPlay, false, true);
  };

  const isLocalHost = (url: string): boolean => {
    try {
      const u = new URL(String(url));
      const h = u.hostname;
      return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(String(h));
    } catch {
      return false;
    }
  };

  const detectLanBaseUrl = (): string => {
    const DEFAULT_PORT = 4000;
    try {
      const candidates: string[] = [];
      const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL;
      if (scriptUrl) {
        const parsed = new URL(String(scriptUrl));
        if (parsed.hostname) candidates.push(parsed.hostname);
      }
      const devHost = (Constants as any)?.expoGo?.developer?.host;
      if (devHost) candidates.push(String(devHost).split(':')[0]);
      const hostUri = (Constants as any)?.expoConfig?.hostUri;
      if (hostUri) candidates.push(String(hostUri).split(':')[0]);
      const dbgHost = (Constants as any)?.manifest?.debuggerHost;
      if (dbgHost) candidates.push(String(dbgHost).split(':')[0]);
      const envPackagerHost = (typeof process !== 'undefined' ? (process as any)?.env?.REACT_NATIVE_PACKAGER_HOSTNAME : '') || '';
      if (envPackagerHost) candidates.push(envPackagerHost);
      for (const h of candidates) {
        const host = String(h);
        if (host && !['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) {
          return `http://${host}:${DEFAULT_PORT}/api`;
        }
      }
    } catch {}
    return '';
  };

  React.useEffect(() => {
    (async () => {
      try {
        const base = apiService.getBaseURL();
        if (!base || isLocalHost(base)) {
          const detected = detectLanBaseUrl();
          if (detected) {
            await setApiBaseUrl(detected);
          }
        }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'tablet');
        const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!existingToken) {
          try {
            const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
            const token = login?.data?.token;
            if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          } catch (_e) {
            // silencioso: tablet deve continuar tentando listar setores
          }
        }
        const resp = await apiService.request({ method: 'GET', url: '/setor-impressao/list' });
        const arr = resp?.data?.data || [];
        const ativos = Array.isArray(arr) ? arr.filter((s: any) => s?.ativo !== false) : [];
        if (alive) {
          setSetores(ativos);
          setActiveSetorId((prev) => prev ?? 'todos');
        }
      } catch (err) {
        // silencioso
      }
    })();
    return () => { alive = false; AsyncStorage.removeItem(STORAGE_KEYS.CLIENT_MODE).catch(() => {}); };
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        if (activeSetorId && activeSetorId !== 'todos') {
          const { setorImpressaoService } = await import('../src/services/api');
          await setorImpressaoService.select(Number(activeSetorId));
        }
      } catch {}
    })();
  }, [activeSetorId]);

  const onBack = () => {
    if (activeView !== 'setor') {
      setActiveView('setor');
      return;
    }
    try { router.back(); } catch {}
  };

  const marcarStatusEmLote = async (status: 'pronto' | 'entregue') => {
    if (!activeSetorId) return;
    try {
      const resp = await apiService.request({ method: 'GET', url: `/setor-impressao-queue/${activeSetorId}/queue?status=${status === 'pronto' ? 'pendente' : 'pronto'}&strict=1` });
      const itens = resp?.data?.data || [];
      for (const it of itens) {
        await apiService.request({ method: 'PATCH', url: `/setor-impressao-queue/sale/${it.saleId}/item/${it.id}/status`, data: { status } });
      }
      setActiveView(status === 'pronto' ? 'pronto' : 'entregue');
    } catch {}
  };

  const limparEntregues = () => {
    if (!activeSetorId) return;
    const hoje = formatDateBR(new Date());
    setClearDateFrom(hoje);
    setClearDateTo(hoje);
    setClearModalVisible(true);
  };

  const aplicarAtalhoPeriodo = (tipo: 'hoje' | '7dias' | 'mes' | 'tudo') => {
    const agora = new Date();
    if (tipo === 'hoje') {
      const hoje = formatDateBR(agora);
      setClearDateFrom(hoje);
      setClearDateTo(hoje);
    } else if (tipo === '7dias') {
      const seteDiasAtras = new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000);
      setClearDateFrom(formatDateBR(seteDiasAtras));
      setClearDateTo(formatDateBR(agora));
    } else if (tipo === 'mes') {
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      setClearDateFrom(formatDateBR(inicioMes));
      setClearDateTo(formatDateBR(agora));
    } else {
      setClearDateFrom('');
      setClearDateTo('');
    }
  };

  const confirmarLimpezaEntregues = async () => {
    if (!activeSetorId) return;
    const isoFrom = parseBrToIso(clearDateFrom);
    const isoTo = parseBrToIso(clearDateTo);
    if (isoFrom === null) {
      showNotice('Data Inválida', 'Informe a Data Inicial no formato DD/MM/AAAA (ex: 13/11/2026) ou deixe em branco para todas.');
      return;
    }
    if (isoTo === null) {
      showNotice('Data Inválida', 'Informe a Data Final no formato DD/MM/AAAA (ex: 13/11/2026) ou deixe em branco para todas.');
      return;
    }
    if (isoFrom && isoTo && isoFrom > isoTo) {
      showNotice('Período Inválido', 'A Data Inicial não pode ser maior que a Data Final.');
      return;
    }

    try {
      setClearingDelivered(true);
      const resp = await apiService.request({
        method: 'POST',
        url: `/setor-impressao-queue/${activeSetorId}/clear-entregues`,
        data: {
          from: isoFrom || undefined,
          to: isoTo || undefined,
        },
      });
      setClearModalVisible(false);
      setHiddenDeliveredIds([]);
      setRefreshKey((k) => k + 1);
      const msg = resp?.data?.message || 'Pedidos entregues limpos com sucesso!';
      showNotice('Concluído', msg);
    } catch (err: any) {
      showNotice('Erro', err?.response?.data?.message || 'Não foi possível limpar os pedidos entregues.');
    } finally {
      setClearingDelivered(false);
    }
  };

  const isMobile = width < 768;

  return (
    <View style={[styles.container, Platform.OS !== 'web' && isMobile && { paddingTop: 28 }]}>
      <BillRequestAlertBanner />
      <View style={[styles.navbar, isMobile && styles.navbarMobile]}>
        <View style={[styles.navTopRow, isMobile && { width: '100%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, isMobile && styles.backButtonMobile]} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={isMobile ? 20 : 24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.navTitle, isMobile && { fontSize: 16 }]}>Pedidos</Text>
          </View>

          {/* Controle de Volume e Toque de Telefone para Novos Pedidos */}
          <View style={[styles.soundControlBox, isMobile && { marginRight: 0, paddingHorizontal: 5, paddingVertical: 3 }]}>
            <TouchableOpacity
              style={[
                styles.soundIconBtn,
                isMobile && { width: 26, height: 26 },
                (soundMuted || soundVolume === 0) && { backgroundColor: 'rgba(244,67,54,0.85)' },
              ]}
              onPress={handleToggleMute}
              activeOpacity={0.8}
            >
              <Ionicons
                name={
                  soundMuted || soundVolume === 0
                    ? 'volume-mute'
                    : soundVolume <= 40
                    ? 'volume-low'
                    : soundVolume <= 75
                    ? 'volume-medium'
                    : 'volume-high'
                }
                size={isMobile ? 15 : 18}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.soundStepBtn, isMobile && { width: 24, height: 24, marginHorizontal: 3 }]}
              onPress={() => handleAdjustVolume(-20)}
              activeOpacity={0.75}
            >
              <Text style={styles.soundStepText}>−</Text>
            </TouchableOpacity>

            <Text style={[styles.soundVolumeText, isMobile && { minWidth: 34, fontSize: 11 }]}>
              {soundMuted || soundVolume === 0 ? 'MUDO' : `${soundVolume}%`}
            </Text>

            <TouchableOpacity
              style={[styles.soundStepBtn, isMobile && { width: 24, height: 24, marginHorizontal: 3 }]}
              onPress={() => handleAdjustVolume(20)}
              activeOpacity={0.75}
            >
              <Text style={styles.soundStepText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.soundTestBtn, isMobile && { paddingHorizontal: 7, paddingVertical: 5 }]}
              onPress={handleTestSound}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={13} color="#fff" />
              {!isMobile && <Text style={styles.soundTestText}>Testar</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.navActions, isMobile && styles.navActionsMobile]}>
          {activeView === 'setor' ? (
            <>
              <TouchableOpacity style={[styles.navActionBtn, isMobile && styles.navActionBtnMobile]} onPress={() => marcarStatusEmLote('pronto')} activeOpacity={0.85}>
                <Ionicons name="checkmark-done" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Prontos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, !isMobile && { marginLeft: 8 }, isMobile && styles.navActionBtnMobile]} onPress={() => setActiveView('pronto')} activeOpacity={0.85}>
                <Ionicons name="albums" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Ver Prontos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, !isMobile && { marginLeft: 8 }, isMobile && styles.navActionBtnMobile]} onPress={() => setActiveView('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Ver Entregues</Text>
              </TouchableOpacity>
            </>
          ) : activeView === 'pronto' ? (
            <>
              <TouchableOpacity style={[styles.navActionBtn, isMobile && styles.navActionBtnMobile]} onPress={() => marcarStatusEmLote('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Entregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, !isMobile && { marginLeft: 8 }, isMobile && styles.navActionBtnMobile]} onPress={() => setActiveView('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Ver Entregues</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.navActionBtn, isMobile && styles.navActionBtnMobile]} onPress={limparEntregues} activeOpacity={0.85}>
                <Ionicons name="trash" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Limpar entregues</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, !isMobile && { marginLeft: 8 }, isMobile && styles.navActionBtnMobile]} onPress={() => setActiveView('pronto')} activeOpacity={0.85}>
                <Ionicons name="albums" size={isMobile ? 15 : 20} color="#fff" />
                <Text style={[styles.navActionText, isMobile && styles.navActionTextMobile]}>Ver Prontos</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {(activeView === 'setor' || activeView === 'entregue' || activeView === 'pronto') && (
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabsContent, isMobile && { flexGrow: 1, justifyContent: 'space-around', paddingHorizontal: 4 }]}>
          <TouchableOpacity
            key="todos"
            style={[styles.tabDynamic, isMobile && styles.tabDynamicMobile, activeSetorId === 'todos' && styles.activeTab]}
            onPress={() => setActiveSetorId('todos')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isMobile && styles.tabTextMobile, activeSetorId === 'todos' && styles.activeTabText]}>Todos</Text>
          </TouchableOpacity>
          {setores.map((s) => {
            const isActive = Number(s.id) === activeSetorId;
            return (
              <TouchableOpacity
                key={String(s.id)}
                style={[styles.tabDynamic, isMobile && styles.tabDynamicMobile, isActive && styles.activeTab]}
                onPress={() => setActiveSetorId(Number(s.id))}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isMobile && styles.tabTextMobile, isActive && styles.activeTabText]}>{s.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      )}

      <View style={styles.content}>
        {(() => {
          const isTodos = activeSetorId === 'todos';
          const ativo = isTodos
            ? { id: 'todos', nome: 'Todos os Setores' }
            : setores.find((s) => Number(s.id) === activeSetorId);
          if (!ativo) return null;
          const compProps: any = {
            setorIdOverride: isTodos ? 'todos' : Number(ativo.id),
            setorNomeOverride: ativo.nome,
            soundVolume,
            soundMuted,
          };
          if (activeView === 'pronto') compProps.forceFilterStatus = 'pronto';
          if (activeView === 'entregue') compProps.forceFilterStatus = 'entregue';
          compProps.hiddenIds = activeView === 'entregue' ? hiddenDeliveredIds : [];
          return isTodos || String(ativo.nome || '').toLowerCase().includes('cozinha') ? (
            <TabletCozinhaScreen key={`${activeSetorId}-${refreshKey}`} {...compProps} />
          ) : (
            <TabletBarScreen key={`${activeSetorId}-${refreshKey}`} {...compProps} />
          );
        })()}
      </View>

      {/* Modal de Limpeza de Pedidos Entregues por Período */}
      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !clearingDelivered && setClearModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={22} color="#D32F2F" />
                <Text style={styles.modalTitle}>Limpar Pedidos Entregues</Text>
              </View>
              <TouchableOpacity
                onPress={() => setClearModalVisible(false)}
                disabled={clearingDelivered}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Setor selecionado:{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {activeSetorId === 'todos'
                  ? 'Todos os Setores'
                  : setores.find((s) => Number(s.id) === Number(activeSetorId))?.nome || 'Setor Atual'}
              </Text>
            </Text>
            <Text style={styles.modalHint}>
              Os pedidos entregues no período serão removidos desta lista de Pedidos (as vendas e relatórios financeiros permanecem intactos).
            </Text>

            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => aplicarAtalhoPeriodo('hoje')}
              >
                <Text style={styles.shortcutChipText}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => aplicarAtalhoPeriodo('7dias')}
              >
                <Text style={styles.shortcutChipText}>Últimos 7 dias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => aplicarAtalhoPeriodo('mes')}
              >
                <Text style={styles.shortcutChipText}>Este Mês</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => aplicarAtalhoPeriodo('tudo')}
              >
                <Text style={styles.shortcutChipText}>Todas as datas</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateInputsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.dateInputLabel}>Data Inicial</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={clearDateFrom}
                  onChangeText={(txt) => setClearDateFrom(applyDateMask(txt))}
                  maxLength={10}
                  editable={!clearingDelivered}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.dateInputLabel}>Data Final</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={clearDateTo}
                  onChangeText={(txt) => setClearDateTo(applyDateMask(txt))}
                  maxLength={10}
                  editable={!clearingDelivered}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setClearModalVisible(false)}
                disabled={clearingDelivered}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, clearingDelivered && { opacity: 0.7 }]}
                onPress={confirmarLimpezaEntregues}
                disabled={clearingDelivered}
              >
                {clearingDelivered ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color="#fff" />
                    <Text style={styles.modalConfirmText}>Limpar Entregues</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  navbar: {
    minHeight: 54,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e88e5',
  },
  navbarMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  navTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navActionsMobile: {
    width: '100%',
    justifyContent: 'space-between',
    gap: 6,
  },
  soundControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  soundIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  soundStepBtn: {
    width: 26,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: 4,
  },
  soundStepText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  soundVolumeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 38,
    textAlign: 'center',
  },
  soundTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  soundTestText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navActionBtnMobile: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navActionText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  navActionTextMobile: {
    fontSize: 12,
    marginLeft: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backButtonMobile: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDynamic: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    minWidth: 110,
  },
  tabDynamicMobile: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 2,
    minWidth: 74,
    flex: 1,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#ff6b6b',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  tabTextMobile: {
    fontSize: 13.5,
  },
  activeTabText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  splitContent: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  shortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  shortcutChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shortcutChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
});