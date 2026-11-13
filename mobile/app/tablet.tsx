import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import TabletCozinhaScreen from '../src/screens/TabletCozinhaScreen';
import TabletBarScreen from '../src/screens/TabletBarScreen';
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

  const limparEntregues = async () => {
    if (!activeSetorId) return;
    Alert.alert('Confirmar limpeza', 'Deseja ocultar todos os itens entregues desta tela?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: async () => {
        try {
          const resp = await apiService.request({ method: 'GET', url: `/setor-impressao-queue/${activeSetorId}/queue?status=entregue&strict=1` });
          const itens = resp?.data?.data || [];
          setHiddenDeliveredIds(itens.map((i: any) => Number(i.id)).filter(Boolean));
        } catch {}
      } }
    ]);
  };

  const isMobile = width < 768;

  return (
    <View style={[styles.container, isMobile && { paddingTop: 80 }]}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Pedidos</Text>
        <View style={styles.navActions}>
          {/* Controle de Volume e Toque de Telefone para Novos Pedidos */}
          <View style={styles.soundControlBox}>
            <TouchableOpacity
              style={[
                styles.soundIconBtn,
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
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.soundStepBtn}
              onPress={() => handleAdjustVolume(-20)}
              activeOpacity={0.75}
            >
              <Text style={styles.soundStepText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.soundVolumeText}>
              {soundMuted || soundVolume === 0 ? 'MUDO' : `${soundVolume}%`}
            </Text>

            <TouchableOpacity
              style={styles.soundStepBtn}
              onPress={() => handleAdjustVolume(20)}
              activeOpacity={0.75}
            >
              <Text style={styles.soundStepText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.soundTestBtn}
              onPress={handleTestSound}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color="#fff" />
              {!isMobile && <Text style={styles.soundTestText}>Testar</Text>}
            </TouchableOpacity>
          </View>

          {activeView === 'setor' ? (
            <>
              <TouchableOpacity style={styles.navActionBtn} onPress={() => marcarStatusEmLote('pronto')} activeOpacity={0.85}>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.navActionText}>Prontos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, { marginLeft: 8 }]} onPress={() => setActiveView('pronto')} activeOpacity={0.85}>
                <Ionicons name="albums" size={20} color="#fff" />
                <Text style={styles.navActionText}>Ver Prontos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, { marginLeft: 8 }]} onPress={() => setActiveView('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.navActionText}>Ver Entregues</Text>
              </TouchableOpacity>
            </>
          ) : activeView === 'pronto' ? (
            <>
              <TouchableOpacity style={styles.navActionBtn} onPress={() => marcarStatusEmLote('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.navActionText}>Entregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, { marginLeft: 8 }]} onPress={() => setActiveView('entregue')} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.navActionText}>Ver Entregues</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.navActionBtn} onPress={limparEntregues} activeOpacity={0.85}>
                <Ionicons name="trash" size={20} color="#fff" />
                <Text style={styles.navActionText}>Limpar entregues</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navActionBtn, { marginLeft: 8 }]} onPress={() => setActiveView('pronto')} activeOpacity={0.85}>
                <Ionicons name="albums" size={20} color="#fff" />
                <Text style={styles.navActionText}>Ver Prontos</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {(activeView === 'setor' || activeView === 'entregue' || activeView === 'pronto') && (
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          <TouchableOpacity
            key="todos"
            style={[styles.tabDynamic, activeSetorId === 'todos' && styles.activeTab]}
            onPress={() => setActiveSetorId('todos')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeSetorId === 'todos' && styles.activeTabText]}>Todos</Text>
          </TouchableOpacity>
          {setores.map((s) => {
            const isActive = Number(s.id) === activeSetorId;
            return (
              <TouchableOpacity
                key={String(s.id)}
                style={[styles.tabDynamic, isActive && styles.activeTab]}
                onPress={() => setActiveSetorId(Number(s.id))}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>{s.nome}</Text>
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
            <TabletCozinhaScreen {...compProps} />
          ) : (
            <TabletBarScreen {...compProps} />
          );
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  navbar: {
    height: 56,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e88e5',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navActionText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#ff6b6b',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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
});