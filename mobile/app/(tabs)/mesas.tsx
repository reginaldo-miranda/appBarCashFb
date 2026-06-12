import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { SafeIcon } from '../../components/SafeIcon';
import api, { mesaService, saleService, employeeService, getWsUrl, authService, idleTimeConfigService, customerService, getCurrentBaseUrl } from '../../src/services/api';
import { STORAGE_KEYS } from '../../src/services/storage';
import QRCode from 'react-native-qrcode-svg';
import ProductSelector from '../../src/components/ProductSelector.js';
import { useAuth } from '../../src/contexts/AuthContext';
  import SearchAndFilter from '../../src/components/SearchAndFilter';
  import ScreenIdentifier from '../../src/components/ScreenIdentifier';
  import { API_URL } from '../../src/services/api';
  import { events } from '../../src/utils/eventBus';
  import PasswordConfirmModal from '../../src/components/PasswordConfirmModal';
import ReceiptModal from '../../src/components/ReceiptModal';
import PixModal from '../../src/components/PixModal';
import CashbackPromptModal from '../../src/components/CashbackPromptModal';
import { useFocusEffect } from '@react-navigation/native';

interface Funcionario {
  _id: string;
  nome: string;
  ativo?: boolean;
}

interface Mesa {
  _id: string;
  numero: number;
  status: 'livre' | 'ocupada' | 'reservada' | 'manutencao';
  capacidade: number;
  observacoes?: string;
  nomeResponsavel?: string;
  funcionarioResponsavel?: {
    _id: string;
    nome: string;
  };
  vendaAtual?: {
    _id?: string;
    id?: number;
    total?: number;
  };
}

function parseTimeToMs(timeStr: string) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  let ms = 0;
  if (parts.length >= 1) ms += parts[0] * 3600000;
  if (parts.length >= 2) ms += parts[1] * 60000;
  if (parts.length >= 3) ms += parts[2] * 1000;
  return ms;
}

function obterIpLanCardapio() {
  try {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      const match = envUrl.match(/https?:\/\/([^:/]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.log('Erro ao ler EXPO_PUBLIC_API_URL:', e);
  }

  try {
    const currentUrl = getCurrentBaseUrl();
    if (currentUrl && !currentUrl.includes('localhost') && !currentUrl.includes('127.0.0.1')) {
      const match = currentUrl.match(/https?:\/\/([^:/]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.log('Erro ao ler getCurrentBaseUrl:', e);
  }

  try {
    const Constants = require('expo-constants').default;
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (e) {}

  return '192.168.1.145';
}

function obterPortaCardapio() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.port) {
      return window.location.port;
    }
  } catch (e) {}
  return '8082';
}

export default function MesasScreen() {
  const { user } = useAuth();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [mesaOpenTotals, setMesaOpenTotals] = useState<Record<string, { total: number; pago: number }>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  
  const [idleConfig, setIdleConfig] = useState<any>(null);
  const [mesaIdleStatus, setMesaIdleStatus] = useState<Record<string, string>>({});
  
  // Estados para modais
  const [gerarMesasModalVisible, setGerarMesasModalVisible] = useState(false);
  const [criarMesaModalVisible, setCriarMesaModalVisible] = useState(false);
  const [abrirMesaModalVisible, setAbrirMesaModalVisible] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  
  // Modal de pagamento ao fechar mesa
  const [fecharMesaModalVisible, setFecharMesaModalVisible] = useState(false);
  const [fecharMesaSelecionada, setFecharMesaSelecionada] = useState<Mesa | null>(null);
  const [fecharPaymentMethod, setFecharPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [fecharTotal, setFecharTotal] = useState<number>(0);
  const [fecharSaleId, setFecharSaleId] = useState<string | null>(null);
  const [fecharValorPago, setFecharValorPago] = useState<number>(0);
  const [finalizandoMesa, setFinalizandoMesa] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [cashbackPromptVisible, setCashbackPromptVisible] = useState(false);
  const [cashbackBalance, setCashbackBalance] = useState(0);


  // Estados para cancelar mesa
  const [cancelMesaModalVisible, setCancelMesaModalVisible] = useState(false);
  const [cancelMesaTarget, setCancelMesaTarget] = useState<Mesa | null>(null);

  // Estado para QR Code da mesa
  const [qrCodeModalVisible, setQrCodeModalVisible] = useState(false);
  const [qrCodeMesa, setQrCodeMesa] = useState<Mesa | null>(null);

  // Estados para busca de clientes no Abrir Mesa
  const [clients, setClients] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });
  const [registerLoading, setRegisterLoading] = useState(false);

  // Estados para Juntar Mesas
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Mesa | null>(null);
  const [mergeSources, setMergeSources] = useState<Mesa[]>([]);

  const toggleMergeMode = () => {
    if (mergeMode) {
      setMergeMode(false);
      setMergeTarget(null);
      setMergeSources([]);
    } else {
      setMergeMode(true);
      Alert.alert('Modo de Junção', 'Selecione a Mesa Principal e depois as mesas que deseja juntar a ela.');
    }
  };

  const handleMergeSelect = (mesa: Mesa) => {
    if (mesa.status !== 'ocupada') return;

    if (!mergeTarget) {
      setMergeTarget(mesa);
      return;
    }

    if (mergeTarget._id === mesa._id) {
      setMergeTarget(null); // Deselect target
      setMergeSources([]); // Clear sources
      return;
    }

    // Toggle source
    if (mergeSources.find(m => m._id === mesa._id)) {
      setMergeSources(prev => prev.filter(m => m._id !== mesa._id));
    } else {
      setMergeSources(prev => [...prev, mesa]);
    }
  };

  const handleMergeConfirm = async () => {
    if (!mergeTarget || mergeSources.length === 0) {
      const msg = 'Selecione uma mesa principal e pelo menos uma mesa para juntar.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Erro', msg);
      }
      return;
    }

    const message = `Deseja transferir os pedidos de ${mergeSources.map(m => m.numero).join(', ')} para a Mesa ${mergeTarget.numero}?`;

    const executeMerge = async () => {
       try {
         setLoading(true);
         await mesaService.merge(mergeTarget._id, mergeSources.map(m => m._id));
         
         if (Platform.OS === 'web') {
             window.alert('Mesas juntadas com sucesso!');
         } else {
             Alert.alert('Sucesso', 'Mesas juntadas com sucesso!');
         }
         toggleMergeMode();
         loadMesas();
       } catch (error: any) {
         const errorMsg = error?.response?.data?.message || 'Erro ao juntar mesas.';
         if (Platform.OS === 'web') {
             window.alert(errorMsg);
         } else {
             Alert.alert('Erro', errorMsg);
         }
       } finally {
         setLoading(false);
       }
    };

    if (Platform.OS === 'web') {
        if (window.confirm(message)) {
            executeMerge();
        }
    } else {
        Alert.alert(
          'Confirmar Junção',
          message,
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Confirmar', 
              onPress: executeMerge 
            }
          ]
        );
    }
  };

  // Receipt Modal
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);

  const handleOpenReceiptMesa = async (mesa: Mesa) => {
    try {
        let saleData = null;
        // Tenta pegar do vendaAtual se tiver itens (raro, geralmente é resumo)
        if (mesa.vendaAtual && (mesa.vendaAtual as any).itens) {
            saleData = mesa.vendaAtual;
        } else {
            // Busca a venda completa
            const resp = await saleService.getByMesa(mesa._id);
            const sales = resp.data || [];
            const active = sales.find((s: any) => s.status === 'aberta');
            if (active) saleData = active;
        }

        if (saleData) {
            setSelectedReceiptSale(saleData);
            setReceiptModalVisible(true);
        } else {
            Alert.alert('Aviso', 'Não há venda aberta com itens para esta mesa.');
        }
    } catch (e) {
        console.error('Erro ao abrir cupom mesa:', e);
        Alert.alert('Erro', 'Falha ao carregar dados da venda.');
    }
  };
  
  // Estados para formulários
  const [quantidades, setQuantidades] = useState({
    interna: 10,
    externa: 5,
    vip: 3,
    balcao: 2
  });
  
  const [formMesa, setFormMesa] = useState({
    numero: '',
    nome: '',
    capacidade: '',
    tipo: 'interna',
    observacoes: ''
  });
  
  const [formAbrirMesa, setFormAbrirMesa] = useState({
    nomeResponsavel: '',
    funcionarioResponsavel: '',
    observacoes: ''
  });
  
  // Estados para loading
  const [gerandoMesas, setGerandoMesas] = useState(false);
  const [criandoMesa, setCriandoMesa] = useState(false);
  const [abindoMesa, setAbindoMesa] = useState(false);
  
  // Estados para funcionários
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioDropdownVisible, setFuncionarioDropdownVisible] = useState(false);
  
  // Estados para tooltips
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  // Filtros de status
  const statusFilters = [
    { key: 'todas', label: 'Todas', icon: 'restaurant', color: '#666' },
    { key: 'livre', label: 'Livres', icon: 'checkmark-circle', color: '#4CAF50' },
    { key: 'ocupada', label: 'Ocupadas', icon: 'people', color: '#F44336' },
    { key: 'reservada', label: 'Reservadas', icon: 'time', color: '#FF9800' },
    { key: 'manutencao', label: 'Manutenção', icon: 'construct', color: '#9E9E9E' },
  ];

  // Função para lidar com mudanças de filtro
  const handleFilterChange = (filterKey: string) => {
    setSelectedStatus(filterKey === 'todas' ? null : filterKey);
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadMesas();
    loadFuncionarios();
    idleTimeConfigService.get().then(res => {
      let d = res.data;
      if (d && typeof d.estagios === 'string') {
          try { d.estagios = JSON.parse(d.estagios); } catch {}
      }
      setIdleConfig(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const w = Dimensions.get('window').width;
    const shouldTablet = Platform.OS === 'web' || w >= 1024;
    (async () => {
      try {
        if (shouldTablet) await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'tablet');
      } catch {}
    })();
    return () => { AsyncStorage.removeItem(STORAGE_KEYS.CLIENT_MODE).catch(() => {}); };
  }, []);

  // Garantir token de autenticação para operações protegidas
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const tk = login?.data?.token;
          if (tk && mounted) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tk);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Revalidar quando a tela ganhar foco e quando eventos de atualização ocorrerem
  useFocusEffect(
    useCallback(() => {
      const off = events.on('mesas:refresh', () => {
        console.log('🔁 Evento mesas:refresh recebido, recarregando mesas');
        loadMesas();
      });
      return () => off();
    }, [loadMesas])
  );

  // Polling leve para garantir atualização mesmo sem interação
  useFocusEffect(
    useCallback(() => {
      const intervalId = setInterval(() => {
        console.log('⏱️ Polling de mesas a cada 5s');
        loadMesas();
      }, 5000);
      return () => clearInterval(intervalId);
    }, [loadMesas])
  );

  async function loadMesas(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const response = await mesaService.list();
      const mesasData = Array.isArray(response?.data) ? response.data : [];
      let needsReload = false;
      
      for (const mesa of mesasData) {
        if (mesa?.vendaAtual && mesa?.status !== 'ocupada') {
          try {
            const idToUpdate = mesa?._id ?? mesa?.id;
            if (idToUpdate != null) {
              await mesaService.update(idToUpdate, { status: 'ocupada' });
              needsReload = true;
            }
          } catch (updateError) {
            console.error('Erro ao corrigir status da mesa:', mesa.numero, updateError);
          }
        }
      }
      
      // Se houve correções, recarrega os dados
      if (needsReload) {
        const updatedResponse = await mesaService.list();
        setMesas(Array.isArray(updatedResponse?.data) ? updatedResponse.data : []);
      } else {
        setMesas(mesasData);
      }
    } catch (error: any) {
      console.error('Erro ao carregar mesas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as mesas');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function softRefreshMesas() {
    try {
      const response = await mesaService.list();
      const mesasData = response.data || [];
      setMesas(mesasData);
    } catch {}
  }

  useEffect(() => {
    try {
      const ocupadas = (Array.isArray(mesas) ? mesas : []).filter((m) => m?.status === 'ocupada');
      
      // Otimização: Evitar chamadas excessivas. Executar apenas se houver mesas ocupadas e não estiver carregando.
      // Melhoria futura: Usar useRef para guardar cache e evitar re-fetch se nada mudou.
      
      const promises = ocupadas.map(async (m) => {
        const idStr = String(m?._id ?? (m as any)?.id ?? '');
        if (!idStr) return null;
        
        try {
          // TODO: Otimizar para não buscar sale se já tivermos dados recentes (cache simples)
          const resp = await saleService.getByMesa(m._id ?? (m as any)?.id);
          const sales = Array.isArray(resp?.data) ? resp.data : [];
          const aberta = sales.find((s: any) => String(s?.status || '').toLowerCase() === 'aberta');
          const itens = Array.isArray(aberta?.itens) ? aberta.itens : [];
          const total = itens.reduce((sum: number, it: any) => sum + Number(it?.subtotal ?? (Number(it?.quantidade) * Number(it?.precoUnitario))), 0);
          const pago = (aberta?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
          
          let color = '';
          if (aberta && idleConfig && idleConfig.ativo) {
             let baseTime = 0;
             if (itens.length > 0) {
                 const times = itens.map((it: any) => new Date(it.createdAt || it.updatedAt || Date.now()).getTime());
                 baseTime = Math.max(...times);
             } else if (idleConfig.usarHoraInclusao && aberta.createdAt) {
                 baseTime = new Date(aberta.createdAt).getTime();
             }

             if (baseTime > 0) {
                 const diff = Date.now() - baseTime;
                 if (Array.isArray(idleConfig.estagios)) {
                     const sorted = [...idleConfig.estagios].sort((a: any, b: any) => parseTimeToMs(a.tempo) - parseTimeToMs(b.tempo));
                     for (const est of sorted) {
                         if (diff >= parseTimeToMs(est.tempo)) {
                             color = est.cor;
                         }
                     }
                 }
             }
          }

          const idNum = Number((m as any)?.id || 0);
          return { idStr, idNum: idNum ? String(idNum) : undefined, total, pago, color };
        } catch {
            return null;
        }
      });

      Promise.all(promises).then((results) => {
          setMesaOpenTotals(prev => {
              const next = { ...prev };
              let changed = false;
              results.forEach(r => {
                  if(!r) return;
                  if(JSON.stringify(next[r.idStr]) !== JSON.stringify({ total: r.total, pago: r.pago })) {
                      next[r.idStr] = { total: r.total, pago: r.pago };
                      if(r.idNum) next[r.idNum] = { total: r.total, pago: r.pago };
                      changed = true;
                  }
              });
              return changed ? next : prev;
          });

          setMesaIdleStatus(prev => {
              const next = { ...prev };
              let changed = false;
              results.forEach(r => {
                  if(!r) return;
                  if (r.color) {
                      if (next[r.idStr] !== r.color) {
                          next[r.idStr] = r.color;
                          if(r.idNum) next[r.idNum] = r.color;
                          changed = true;
                      }
                  } else {
                      if (next[r.idStr]) {
                          delete next[r.idStr];
                          if(r.idNum) delete next[r.idNum];
                          changed = true;
                      }
                  }
              });
              return changed ? next : prev;
          });
      });

    } catch {}
  }, [mesas, idleConfig]);

  async function loadFuncionarios() {
    try {
      console.log('🔄 loadFuncionarios: Buscando funcionários...');
      const response = await employeeService.getAll();
      const lista = response.data || [];
      console.log(`✅ loadFuncionarios: ${lista.length} encontrados.`);
      setFuncionarios(lista);
      
      // Auto-selecionar o primeiro ativo se não houver seleção
      /* const primeiroAtivo = lista.find(f => f.ativo);
      if (primeiroAtivo) {
          // Não vamos auto-selecionar aqui pois isso roda na montagem e não na abertura do modal
      } */
    } catch (error: any) {
      console.error('❌ Erro ao carregar funcionários:', error);
      Alert.alert('Erro', 'Falha ao carregar lista de funcionários.');
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMesas();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const lastFetchRef = { ts: 0 } as any;
    let ws: any = null;
    let sse: any = null;
    let pollTimer: any = null;
    let reconnectTimer: any = null;
    let reconnectDelay = 1000;
    const maxDelay = 8000;

    const scheduleFetch = async () => {
      const now = Date.now();
      if (now - lastFetchRef.ts >= 1500) {
        lastFetchRef.ts = now;
        await softRefreshMesas();
      }
    };

    const startPolling = () => {
      stopPolling();
      pollTimer = setInterval(scheduleFetch, 2000);
    };
    const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

    const connectWebSocket = () => {
      try {
        const url = getWsUrl();
        if (!url) { startPolling(); return; }
        ws = new (globalThis as any).WebSocket(url);
        ws.onopen = () => { reconnectDelay = 1000; };
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              setRealtimeConnected(true);
              stopPolling();
              const id = String(msg?.payload?.id || '');
              if (id) {
                try {
                  const r = await saleService.getById(id);
                  const v = r?.data;
                  const mesaId = Number(v?.mesaId || 0);
                  const aberta = String(v?.status || '').toLowerCase() === 'aberta';
                  console.log('[WS] sale:update recebido', { id, mesaId, aberta });
                  if (mesaId && Number.isFinite(mesaId)) {
                    setMesas((prev) => prev.map((m) => {
                      const mid = Number((m as any)?.id || 0);
                      if (mid === mesaId) {
                        return { ...m, status: aberta ? 'ocupada' : 'livre' } as any;
                      }
                      return m;
                    }));
                    try {
                      const itens = Array.isArray(v?.itens) ? v.itens : [];
                      const t = itens.reduce((acc: number, it: any) => acc + Number(it?.subtotal ?? (Number(it?.quantidade) * Number(it?.precoUnitario))), 0);
                      const p = (v?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
                      setMesaOpenTotals((prev) => ({ ...prev, [String(mesaId)]: { total: t, pago: p } }));
                      console.log('[WS] total atualizado', { mesaId, total: t, pago: p });
                    } catch {}
                  } else {
                    await scheduleFetch();
                  }
                } catch {
                  await scheduleFetch();
                }
              } else {
                await scheduleFetch();
              }
            }
          } catch {}
        };
        ws.onerror = () => { try { ws.close(); } catch {}; };
        ws.onclose = () => {
          try { ws = null; } catch {}
          stopPolling();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectWebSocket, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
          startPolling();
          setRealtimeConnected(false);
        };
      } catch { startPolling(); }
    };

    const connectSseIfWeb = () => {
      try {
        const isWeb = typeof window !== 'undefined' && !!(window as any).EventSource;
        if (!isWeb) return;
        const base = (API_URL || '').replace(/\/$/, '');
        if (!base) return;
        const url = `${base}/sale/stream`;
        sse = new (window as any).EventSource(url);
        sse.onmessage = async (evt: any) => {
          try {
            const msg = JSON.parse(String(evt?.data || '{}'));
            if (msg?.type === 'sale:update') {
              console.log('[SSE] sale:update recebido');
              setRealtimeConnected(true);
              await scheduleFetch();
            } else if (msg && (msg.id || msg.ts)) {
              console.log('[SSE] payload simples recebido, agendando refresh');
              setRealtimeConnected(true);
              await scheduleFetch();
            }
          } catch {}
        };
        sse.onerror = () => { try { sse.close(); } catch {}; setRealtimeConnected(false); };
      } catch {}
    };

    connectWebSocket();
    connectSseIfWeb();

    return () => {
      try { ws && ws.close(); } catch {}
      try { sse && sse.close && sse.close(); } catch {}
      try { stopPolling(); } catch {}
      try { reconnectTimer && clearTimeout(reconnectTimer); } catch {}
    };
  }, []);

  // Search Clients Effect
  useEffect(() => {
    const delay = setTimeout(async () => {
        if (searchClientQuery.length > 2) {
            try {
                const res = await api.get('/customer/list', { params: { nome: searchClientQuery } });
                setClients(res.data || []);
            } catch (e) { console.error('Erro ao buscar clientes', e); }
        } else {
           if (searchClientQuery === '') setClients([]);
        }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchClientQuery]);


useEffect(() => {
  if (realtimeConnected) return;
  let since = Date.now();
  const t = setInterval(async () => {
    try {
      const res = await saleService.updates(since);
      if (res?.data?.updates?.length) {
        since = res?.data?.now || Date.now();
        await softRefreshMesas();
      }
    } catch {}
  }, 1500);
  return () => clearInterval(t);
}, [realtimeConnected]);

  // Estatísticas das mesas
  const stats = useMemo(() => {
    const total = mesas.length;
    const livres = mesas.filter(mesa => mesa.status === 'livre').length;
    const ocupadas = mesas.filter(mesa => mesa.status === 'ocupada').length;
    const reservadas = mesas.filter(mesa => mesa.status === 'reservada').length;
    const manutencao = mesas.filter(mesa => mesa.status === 'manutencao').length;
    
    return { total, livres, ocupadas, reservadas, manutencao };
  }, [mesas]);

  // Filtrar mesas
  const filteredMesas = useMemo(() => {
    return mesas.filter(mesa => {
      const matchesSearch = searchTerm === '' || 
        mesa.numero.toString().includes(searchTerm) ||
        (mesa.nomeResponsavel && mesa.nomeResponsavel.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = selectedStatus === null || mesa.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [mesas, searchTerm, selectedStatus]);

  // Funções para tooltips
  const showTooltip = (tooltipId: string) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipVisible(tooltipId);
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(null);
    }, 2000);
  };

  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipVisible(null);
  };

  // Função para abrir modal de criação de mesa individual
  const abrirModalCriarMesa = () => {
    setFormMesa({
      numero: '',
      nome: '',
      capacidade: '',
      tipo: 'interna',
      observacoes: ''
    });
    setCriarMesaModalVisible(true);
  };

  // Função para fechar modal de criação de mesa
  const fecharModalCriarMesa = () => {
    setCriarMesaModalVisible(false);
    setFormMesa({
      numero: '',
      nome: '',
      capacidade: '',
      tipo: 'interna',
      observacoes: ''
    });
  };

  // Função para criar mesa individual
  const criarMesaIndividual = async () => {
    if (!formMesa.numero.trim()) {
      Alert.alert('Erro', 'Por favor, informe o número da mesa');
      return;
    }

    if (!formMesa.nome.trim()) {
      Alert.alert('Erro', 'Por favor, informe o nome da mesa');
      return;
    }

    if (!formMesa.capacidade.trim() || isNaN(Number(formMesa.capacidade))) {
      Alert.alert('Erro', 'Por favor, informe uma capacidade válida');
      return;
    }

    setCriandoMesa(true);

    try {
      const mesaData = {
        numero: formMesa.numero.trim(),
        nome: formMesa.nome.trim(),
        capacidade: parseInt(formMesa.capacidade),
        tipo: formMesa.tipo,
        observacoes: formMesa.observacoes.trim(),
        status: 'livre'
      };

      await mesaService.create(mesaData);
      
      Alert.alert('Sucesso', 'Mesa criada com sucesso!');
      fecharModalCriarMesa();
      await loadMesas();
      
    } catch (error: any) {
      console.error('Erro ao criar mesa:', error);
      Alert.alert(
        'Erro', 
        error.response?.data?.message || 'Não foi possível criar a mesa'
      );
    } finally {
      setCriandoMesa(false);
    }
  };

  // Função para abrir modal de geração automática de mesas
  const gerarMesas = () => {
    setQuantidades({
      interna: 10,
      externa: 5,
      vip: 3,
      balcao: 2
    });
    setGerarMesasModalVisible(true);
  };

  // Função para criar mesas automaticamente
  const criarMesasAutomaticamente = async () => {
    const totalMesas = quantidades.interna + quantidades.externa + quantidades.vip + quantidades.balcao;
    
    if (totalMesas === 0) {
      Alert.alert('Erro', 'Por favor, defina pelo menos uma mesa para criar');
      return;
    }

    setGerandoMesas(true);

    try {
      const mesasParaCriar = [];
      let numeroAtual = 1;

      // Gerar mesas internas
      for (let i = 0; i < quantidades.interna; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa Interna ${numeroAtual - 1}`,
          capacidade: 4,
          tipo: 'interna',
          status: 'livre'
        });
      }

      // Gerar mesas externas
      for (let i = 0; i < quantidades.externa; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa Externa ${numeroAtual - 1}`,
          capacidade: 6,
          tipo: 'externa',
          status: 'livre'
        });
      }

      // Gerar mesas VIP
      for (let i = 0; i < quantidades.vip; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa VIP ${numeroAtual - 1}`,
          capacidade: 8,
          tipo: 'vip',
          status: 'livre'
        });
      }

      // Gerar mesas de balcão
      for (let i = 0; i < quantidades.balcao; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Balcão ${numeroAtual - 1}`,
          capacidade: 2,
          tipo: 'balcao',
          status: 'livre'
        });
      }

      // Criar todas as mesas
      for (const mesa of mesasParaCriar) {
        await mesaService.create(mesa);
      }

      Alert.alert('Sucesso', `${totalMesas} mesas criadas com sucesso!`);
      setGerarMesasModalVisible(false);
      await loadMesas();

    } catch (error: any) {
      console.error('Erro ao gerar mesas:', error);
      Alert.alert('Erro', 'Não foi possível gerar as mesas');
    } finally {
      setGerandoMesas(false);
    }
  };

  // Função para abrir mesa
  const abrirMesa = (mesa: Mesa) => {
    setMesaSelecionada(mesa);
    // Limpar estados
    setClients([]);
    setSearchClientQuery('');
    setSelectedCliente(null);
    setFormAbrirMesa({
      nomeResponsavel: '',
      funcionarioResponsavel: '',
      observacoes: ''
    });
    setAbrirMesaModalVisible(true);
  };
  
  const handleSelectClient = (client: any) => {
     setSelectedCliente(client);
     setFormAbrirMesa(prev => ({ ...prev, nomeResponsavel: client.nome }));
     setShowClientModal(false);
  };

  const handleUseNameOnly = async (name: string) => {
    try {
        if (!name || name.length < 3) return;
        const res = await customerService.create({ nome: name, fone: '', endereco: '' });
        if (res.data && res.data.customer) {
            handleSelectClient(res.data.customer);
        } else {
            Alert.alert('Erro', 'Não foi possível criar o cliente temporário.');
        }
    } catch (e: any) {
        console.error(e);
        const msg = e.response?.data?.error || e.message || 'Falha ao usar nome temporário';
        Alert.alert('Erro', msg);
    }
  };

  const handleRegisterClient = async () => {
    if (!registerForm.nome) {
        Alert.alert('Erro', 'Nome é obrigatório');
        return;
    }
    setRegisterLoading(true);
    try {
        const res = await customerService.create(registerForm);
        if (res.data && res.data.customer) {
            setRegisterForm({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });
            setShowRegisterModal(false);
            setTimeout(() => {
                handleSelectClient(res.data.customer);
                Alert.alert('Sucesso', 'Cliente cadastrado!');
            }, 100);
        } else {
            Alert.alert('Erro', 'Servidor não retornou dados do cliente.');
        }
    } catch (e: any) {
        const msg = e.response?.data?.error || e.message || 'Erro ao cadastrar';
        Alert.alert('Erro', msg);
    } finally {
        setRegisterLoading(false);
    }
  };

  // Função para confirmar abertura da mesa
  const confirmarAbrirMesa = async () => {
    if (!formAbrirMesa.nomeResponsavel.trim()) {
      Alert.alert('Erro', 'Por favor, informe o nome do responsável');
      return;
    }

    if (!formAbrirMesa.funcionarioResponsavel) {
      Alert.alert('Erro', 'Por favor, selecione um funcionário responsável');
      return;
    }

    setAbindoMesa(true);

    try {
      if (!mesaSelecionada) {
        Alert.alert('Erro', 'Nenhuma mesa selecionada');
        return;
      }

      await mesaService.abrir(
        mesaSelecionada._id,
        formAbrirMesa.funcionarioResponsavel,
        formAbrirMesa.nomeResponsavel.trim(),
        formAbrirMesa.observacoes.trim(),
        selectedCliente ? (selectedCliente.id || selectedCliente._id) : undefined
      );
      
      setAbrirMesaModalVisible(false);
      await loadMesas();
      
      // Navegar direto para adicionar itens
      if (mesaSelecionada) {
          adicionarProdutos(mesaSelecionada);
      }

    } catch (error: any) {
      console.error('Erro ao abrir mesa:', error);
      Alert.alert('Erro', error.response?.data?.message || 'Não foi possível abrir a mesa');
    } finally {
      setAbindoMesa(false);
    }
  };

  // Função para fechar mesa
  const fecharMesa = async (mesa: Mesa) => {
    Alert.alert(
      'Confirmar',
      `Deseja realmente fechar a mesa ${mesa.numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Atualização otimista: marcar como livre imediatamente
              setMesas(prev => prev.map(m => m._id === mesa._id ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined } : m));

              await mesaService.fechar(mesa._id);
              Alert.alert('Sucesso', 'Mesa fechada e liberada!');
              await loadMesas();
              events.emit('caixa:refresh');
              events.emit('mesas:refresh');
            } catch (error: any) {
              console.error('Erro ao fechar mesa:', error);
              Alert.alert('Erro', error.response?.data?.message || 'Não foi possível fechar a mesa');
              // Em caso de erro, revalida estado
              await loadMesas();
            }
          }
        }
      ]
    );
  };



  // Funções para cancelamento com senha
  const iniciarCancelamentoMesa = (mesa: Mesa) => {
    setCancelMesaTarget(mesa);
    setCancelMesaModalVisible(true);
  };

  const handleConfirmCancelMesa = async () => {
    if (!cancelMesaTarget) return;

    // Recupera a vendaAtualId ou busca a venda da mesa
    // Se a mesa tem vendaAtual, usamos ela. Se não, tentamos buscar via saleService.getByMesa
    let saleId = cancelMesaTarget.vendaAtual?.id || cancelMesaTarget.vendaAtual?._id;

    // Se o ID não estiver direto no objeto mesa, tentamos buscar a venda ativa da mesa
    if (!saleId) {
      try {
        const resp = await saleService.getByMesa(cancelMesaTarget._id);
        const sales = resp.data || [];
        const active = sales.find((s: any) => s.status === 'aberta');
        if (active) saleId = active._id;
      } catch (e) {
        console.error('Erro ao buscar venda para cancelamento', e);
      }
    }

    if (!saleId) {
       Alert.alert('Aviso', 'Não foi encontrada venda ativa para cancelar nesta mesa. Apenas liberando a mesa.');
       // Se não tem venda, apenas libera a mesa? Ou não faz nada?
       // Como o usuário quer cancelar, vamos forçar liberarMesa se for só status visual
       liberarMesa(cancelMesaTarget);
       setCancelMesaModalVisible(false);
       setCancelMesaTarget(null);
       return;
    }

    try {
      setCancelMesaModalVisible(false);
      await saleService.cancel(saleId);
      Alert.alert('Sucesso', 'Mesa/Venda cancelada com sucesso!');
      await loadMesas();
      events.emit('caixa:refresh');
    } catch (error: any) {
      console.error('Erro ao cancelar mesa:', error);
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cancelar mesa.');
    } finally {
      setCancelMesaTarget(null);
    }
  };

  // Função para liberar mesa
  const liberarMesa = async (mesa: Mesa) => {
    console.log('🔓🔓🔓 FUNÇÃO LIBERAR MESA CHAMADA! 🔓🔓🔓');
    console.log('Mesa para liberar:', mesa);
    console.log('ID da mesa:', mesa._id);
    console.log('Status atual:', mesa.status);
    
    Alert.alert(
      'Confirmar',
      `Deseja liberar a mesa ${mesa.numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: async () => {
            console.log('🔄 Usuário confirmou liberação da mesa');
            try {
              // Atualização otimista: marcar como livre imediatamente
              setMesas(prev => prev.map(m => m._id === mesa._id ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined } : m));

              console.log('📡 Chamando mesaService.update...');
              const response = await mesaService.update(mesa._id, {
                status: 'livre',
                nomeResponsavel: undefined,
                funcionarioResponsavel: undefined,
                vendaAtual: undefined
              });
              console.log('✅ Mesa atualizada com sucesso:', response);
              
              Alert.alert('Sucesso', 'Mesa fechada com sucesso!');
              console.log('🔄 Recarregando lista de mesas...');
              await loadMesas();
              console.log('✅ Lista de mesas recarregada!');
              events.emit('caixa:refresh');
              events.emit('mesas:refresh');
            } catch (error: any) {
              console.error('❌ ERRO ao liberar mesa:', error);
              console.error('Detalhes do erro:', error.response?.data || error.message);
              Alert.alert('Erro', `Não foi possível liberar a mesa: ${error.response?.data?.message || error.message}`);
              // Em caso de erro, revalida estado
              await loadMesas();
            }
          }
        }
      ]
    );
  };

  // Função para adicionar produtos à mesa
  const adicionarProdutos = (mesa: Mesa) => {
    router.push({
      pathname: '/sale',
      params: { mesaId: mesa._id, mesaNumero: mesa.numero, tipo: 'mesa' }
    });
  };

  // Função para ver comanda da mesa
  const verComanda = (mesa: Mesa) => {
    router.push({
      pathname: '/sale',
      params: { mesaId: mesa._id, mesaNumero: mesa.numero, viewOnly: 'true', tipo: 'mesa' }
    });
  };

  // Função para colocar mesa em manutenção
  const colocarEmManutencao = async (mesa: Mesa) => {
    Alert.alert(
      'Manutenção',
      `Colocar mesa ${mesa.numero} em manutenção?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await mesaService.update(mesa._id, { status: 'manutencao' });
              Alert.alert('Sucesso', 'Mesa colocada em manutenção');
              await loadMesas();
            } catch (error: any) {
              console.error('Erro ao colocar mesa em manutenção:', error);
              Alert.alert('Erro', 'Não foi possível colocar a mesa em manutenção');
            }
          }
        }
      ]
    );
  };

  // Função para abrir o QR Code da mesa
  const abrirQrCodeMesa = (mesa: Mesa) => {
    setQrCodeMesa(mesa);
    setQrCodeModalVisible(true);
  };

  // Abrir modal de pagamento para fechar mesa
  const fecharModalFecharMesa = async (mesa: Mesa) => {
    console.log('🔥🔥🔥 FUNÇÃO fecharModalFecharMesa INICIADA! 🔥🔥🔥');
    console.log('Mesa recebida:', mesa);
    try {
      console.log('🔄 Configurando estados iniciais...');
      setFecharMesaSelecionada(mesa);
      setFecharPaymentMethod('dinheiro');
      setFecharTotal(0);
      setFecharValorPago(0);
      setFecharSaleId(null);
      console.log('✅ Estados iniciais configurados!');

      const response = await saleService.getByMesa(mesa._id);
      const sales = response.data || [];
      const activeSale = sales.find((s: any) => s.status === 'aberta');

      if (!activeSale) {
        console.log('ℹ️ Nenhuma venda ativa. Permitindo fechamento direto da mesa.');
        setFecharTotal(0);
        setFecharSaleId(null);
        setFecharMesaModalVisible(true);
        return;
      }

      const itensCount = (activeSale.itens || []).length;
      if (itensCount === 0) {
        Alert.alert('Erro', 'Para fechar a mesa é necessário ter itens na venda.');
        return;
      }
      const total = (activeSale.itens || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      const totalPago = (activeSale.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
      
      setFecharTotal(total);
      setFecharValorPago(totalPago);
      setFecharSaleId(activeSale._id);

      // Check for Cashback
      let clientBalance = 0;
      if (activeSale.clienteId) {
          try {
             // Fetch client updated data
             const clientRes = await api.get(`/customer/${activeSale.clienteId}`);
             clientBalance = Number(clientRes.data.saldoCashback || 0);
          } catch {}
      }
      
      const remaining = total - totalPago;

      if (clientBalance > 0 && remaining > 0) {
          setCashbackBalance(clientBalance);
          setCashbackPromptVisible(true);
      } else {
          setFecharMesaModalVisible(true);
      }

    } catch (error: any) {
      console.error('Erro ao carregar venda da mesa:', error);
      Alert.alert('Erro', 'Não foi possível buscar a venda da mesa.');
    }
  };

  // Confirmar fechamento com pagamento
  const confirmarFechamentoMesa = async (isPixConfirmed?: boolean) => {
    console.log('🔄 CONFIRMAR BOTÃO CLICADO - Iniciando processo de fechamento');
    
    // Interceptação para PIX
    if (fecharPaymentMethod === 'pix' && isPixConfirmed !== true) {
        setFecharMesaModalVisible(false);
        setPixModalVisible(true);
        return;
    }
    
    if (!fecharMesaSelecionada) {
      Alert.alert('Erro', 'Mesa não selecionada.');
      return;
    }

    try {
      setFinalizandoMesa(true);

      let venda: any = null;
      if (fecharSaleId) {
        try {
          const vendaResp = await saleService.getById(fecharSaleId);
          venda = vendaResp?.data;
        } catch (e) {
          console.error('Erro ao buscar venda:', e);
        }
      }

      const itens = Array.isArray(venda?.itens) ? venda.itens : [];
      const possuiItens = itens.length > 0;
      const vendaAberta = venda?.status === 'aberta';

      if (vendaAberta && possuiItens) {
        const data = { formaPagamento: fecharPaymentMethod };
        console.log('🌐 Finalizando venda via API...', fecharPaymentMethod);
        
        await saleService.finalize(fecharSaleId!, data);
        
        // Garantir liberação da mesa no backend (failsafe)
        try {
          await mesaService.fechar(fecharMesaSelecionada._id);
        } catch (error: any) {
          console.warn('⚠️ Aviso ao fechar mesa:', error?.message);
        }

        // 1. FECHAR MODAL IMEDIATAMENTE
        setFecharMesaModalVisible(false);

        // 2. LIMPAR FILTROS PARA GARANTIR VISIBILIDADE
        // Isso impede que a mesa "suma" se o usuário estiver filtrando por 'ocupada'
        setSelectedStatus(null); 
        setSearchTerm('');

        // 3. ATUALIZAÇÃO OTIMISTA (Visual imediato)
        setMesas(prev => prev.map(m => 
            (m._id === fecharMesaSelecionada._id || (m as any).id === fecharMesaSelecionada._id) 
            ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined, vendaAtual: undefined } 
            : m
        ));

        setFecharMesaSelecionada(null);
        setFecharSaleId(null);
        setFecharTotal(0);
        setFecharPaymentMethod('dinheiro');

        // 4. RECARREGAR DADOS (Sincronização com delay seguro)
        console.log('🔄 Recarregando lista de mesas silenciosamente...');
        setTimeout(() => {
           loadMesas(false); // Silent refresh
           events.emit('caixa:refresh');
           events.emit('mesas:refresh');
        }, 500);

        // 5. EXIBIR SUCESSO (Não bloqueante)
        if (Platform.OS === 'web') {
           setTimeout(() => window.alert('Sucesso: Venda finalizada e mesa liberada!'), 300);
        } else {
           Alert.alert('Sucesso', 'Venda finalizada e mesa liberada!');
        }

      } else {
        Alert.alert('Erro', 'Para fechar a mesa é necessário ter itens em uma venda aberta. Use "Liberar" para apenas liberar a mesa sem registro no caixa.');
        return;
      }
    } catch (error: any) {
      console.error('❌ ERRO ao fechar mesa:', error);
      let errorMessage = 'Falha ao fechar mesa';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      Alert.alert('Erro', errorMessage);
    } finally {
      setFinalizandoMesa(false);
    }
  };

    // Função para renderizar item da lista
    const renderItem = ({ item }: { item: Mesa }) => {
      // Logic for Merge Mode Check
      const isTarget = mergeMode && mergeTarget?._id === item._id;
      const isSource = mergeMode && mergeSources.find(m => m._id === item._id);
      const isOccupied = item.status === 'ocupada';
      
      const getStatusColor = (status: string) => {
        switch (status) {
          case 'livre': return '#4CAF50';
          case 'ocupada': return '#F44336';
          case 'reservada': return '#FF9800';
          case 'manutencao': return '#9E9E9E';
          default: return '#9E9E9E';
        }
      };

      const getStatusIcon = (status: string) => {
        switch (status) {
          case 'livre': return 'checkmark-circle';
          case 'ocupada': return 'person';
          case 'reservada': return 'time';
          case 'manutencao': return 'construct';
          default: return 'help-circle';
        }
      };

      const getStatusText = (status: string) => {
        switch (status) {
          case 'livre': return 'Livre';
          case 'ocupada': return 'Ocupada';
          case 'reservada': return 'Reservada';
          case 'manutencao': return 'Manutenção';
          default: return 'Desconhecido';
        }
      };

      const handleCardPress = () => {
        if (mergeMode) {
          if (isOccupied) {
            handleMergeSelect(item);
          } else {
             // Optional feedback
          }
        }
      };

      return (
        <TouchableOpacity 
           activeOpacity={mergeMode ? 0.8 : 1}
           onPress={mergeMode ? handleCardPress : undefined}
           style={[
              styles.mesaCard, 
              { borderLeftColor: getStatusColor(item.status) },
              isOccupied && mesaIdleStatus[item._id] && { backgroundColor: mesaIdleStatus[item._id] },
              isTarget && { borderColor: '#2196F3', borderWidth: 2, transform: [{scale: 1.02}], elevation: 8 },
              isSource && { borderColor: '#FF9800', borderWidth: 2, transform: [{scale: 1.02}], elevation: 8 },
              (mergeMode && !isOccupied) && { opacity: 0.5 }
           ]}
        >
          <View style={styles.mesaHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => !mergeMode && handleOpenReceiptMesa(item)} disabled={mergeMode}>
                <Text style={[styles.mesaNumero, { textDecorationLine: 'underline', color: '#2196F3' }]}>
                    Mesa {item.numero}
                    {(item.nomeResponsavel || item.funcionarioResponsavel?.nome) &&
                    (() => {
                        const id = String(item?._id ?? (item as any)?.id ?? '');
                        const vt = item?.vendaAtual?.total;
                        const mapData = id ? mesaOpenTotals[id] : undefined;
                        const displayTotal = vt != null && Number(vt) > 0 ? Number(vt) : (mapData?.total || 0);

                        const valorTotal = displayTotal.toFixed(2).replace('.', ',');
                        
                        let text = ``;
                        if (displayTotal > 0) {
                            text += ` - R$ ${valorTotal}`;
                        }
                        text += ` - Responsável: ${item.nomeResponsavel || item.funcionarioResponsavel?.nome}`;
                        return text;
                    })()
                    }
                </Text>
              </TouchableOpacity>
              {!mergeMode && (
                <TouchableOpacity 
                  style={{ marginLeft: 8, padding: 4, backgroundColor: '#333', borderRadius: 4, borderWidth: 1, borderColor: '#444' }}
                  onPress={() => abrirQrCodeMesa(item)}
                >
                  <SafeIcon name="qr-code" size={14} color="#FF8C00" fallbackText="QR" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Badges for Merge Mode */}
            {isTarget && <View style={[styles.statusBadge, {backgroundColor: '#2196F3'}]}><Text style={styles.statusText}>PRINCIPAL</Text></View>}
            {isSource && <View style={[styles.statusBadge, {backgroundColor: '#FF9800'}]}><Text style={styles.statusText}>JUNTAR</Text></View>}
            
            {!mergeMode && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <SafeIcon name={getStatusIcon(item.status)} size={12} color="#fff" fallbackText="•" />
                <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
              </View>
            )}
          </View>

          {/* Exibição explícita de valores financeiros se houver totais */}
          {(() => {
               const id = String(item?._id ?? (item as any)?.id ?? '');
               const mapData = id ? mesaOpenTotals[id] : undefined;
               const total = mapData?.total || 0;
               const pago = mapData?.pago || 0;
               
               if (total > 0 && item.status === 'ocupada') {
                   return (
                       <View style={{ marginTop: 4, marginBottom: 8, paddingHorizontal: 4 }}>
                           <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2196F3' }}>
                             Total: R$ {total.toFixed(2).replace('.', ',')}
                           </Text>
                           {pago > 0 && (
                             <>
                               <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 2 }}>
                                 Já pago: R$ {pago.toFixed(2).replace('.', ',')}
                               </Text>
                               <Text style={{ fontSize: 13, color: '#F44336', fontWeight: 'bold', marginTop: 2 }}>
                                 Restante: R$ {Math.max(0, total - pago).toFixed(2).replace('.', ',')}
                               </Text>
                             </>
                           )}
                       </View>
                   );
               }
               return null;
          })()}

          <View style={styles.mesaInfo}>
            <View style={styles.infoRow}>
              <SafeIcon name="people" size={16} color="#666" fallbackText="👥" />
              <Text style={styles.infoText}>Capacidade: {item.capacidade} pessoas</Text>
            </View>
            
            {item.observacoes && (
              <View style={styles.infoRow}>
                <SafeIcon name="document-text" size={16} color="#666" fallbackText="📄" />
                <Text style={styles.infoText}>Obs: {item.observacoes}</Text>
              </View>
            )}
          </View>

          {item.status === 'manutencao' && (
            <View style={styles.maintenanceInfo}>
              <SafeIcon name="warning" size={16} color="#FF9800" fallbackText="!" />
              <Text style={styles.maintenanceText}>Mesa em manutenção</Text>
            </View>
          )}

          {/* Hide Action Buttons in Merge Mode */}
          {!mergeMode && (
          <View style={styles.actionButtons}>
            <View style={styles.buttonRow}>
              {item.status === 'livre' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.openButton]}
                  onPress={() => abrirMesa(item)}
                >
                  <SafeIcon name="play" size={12} color="#fff" fallbackText="▶" />
                  <Text style={styles.actionButtonText}>Abrir</Text>
                </TouchableOpacity>
              )}

              {item.status === 'ocupada' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.addButton]}
                    onPress={() => adicionarProdutos(item)}
                  >
                    <SafeIcon name="add" size={12} color="#fff" fallbackText="+" />
                    <Text style={styles.actionButtonText}>Adicionar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.closeButton]}
                    onPress={() => {
                      try {
                        fecharModalFecharMesa(item);
                      } catch (error) {}
                    }}
                  >
                    <SafeIcon name="close-circle" size={12} color="#fff" fallbackText="×" />
                    <Text style={styles.actionButtonText}>Fechar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                    onPress={() => iniciarCancelamentoMesa(item)}
                  >
                    <SafeIcon name="trash" size={12} color="#fff" fallbackText="🗑" />
                    <Text style={styles.actionButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              )}

              {item.status === 'reservada' && (
                <TouchableOpacity
                    style={[styles.actionButton, styles.releaseButton]}
                    onPress={() => liberarMesa(item)}
                  >
                    <SafeIcon name="lock-open" size={12} color="#fff" fallbackText="🔓" />
                    <Text style={styles.actionButtonText}>Liberar</Text>
                  </TouchableOpacity>
              )}
            </View>
          </View>
          )}
        </TouchableOpacity>
      );
    };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 16, color: '#666' }}>Carregando mesas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Mesas" />
      {/* Header com estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statsLeft}>
          <TouchableOpacity
            style={[styles.statItem, selectedStatus === null && styles.statItemSelected]}
            onPress={() => setSelectedStatus(null)}
          >
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#2196F3' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'livre' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'livre' ? null : 'livre')}
          >
            <Text style={styles.statNumber}>{stats.livres}</Text>
            <Text style={styles.statLabel}>Livres</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#4CAF50' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'ocupada' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'ocupada' ? null : 'ocupada')}
          >
            <Text style={styles.statNumber}>{stats.ocupadas}</Text>
            <Text style={styles.statLabel}>Ocupadas</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#F44336' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'reservada' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'reservada' ? null : 'reservada')}
          >
            <Text style={styles.statNumber}>{stats.reservadas}</Text>
            <Text style={styles.statLabel}>Reservadas</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#FF9800' }]} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerButtons}>
          <View style={styles.tooltipContainer}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={abrirModalCriarMesa}
              onPressIn={() => showTooltip('criar')}
              onPressOut={hideTooltip}
              // @ts-ignore - Web only propertys
              onMouseEnter={() => Platform.OS === 'web' && showTooltip('criar')}
              onMouseLeave={() => Platform.OS === 'web' && hideTooltip()}
            >
              <SafeIcon name="add" size={16} color="#fff" fallbackText="+" />
            </TouchableOpacity>
            {tooltipVisible === 'criar' && (
              <View style={[styles.tooltip, styles.tooltipVisible]}>
                <Text style={styles.tooltipText}>Criar mesa individual</Text>
              </View>
            )}
          </View>

          <View style={styles.tooltipContainer}>
            <TouchableOpacity
              style={[styles.headerButton, styles.headerButtonSecondary]}
              onPress={gerarMesas}
              onPressIn={() => showTooltip('gerar')}
              onPressOut={hideTooltip}
              // @ts-ignore - Web only propertys
              onMouseEnter={() => Platform.OS === 'web' && showTooltip('gerar')}
              onMouseLeave={() => Platform.OS === 'web' && hideTooltip()}
            >
              <SafeIcon name="add" size={20} color="#fff" fallbackText="+" />
            </TouchableOpacity>
            {tooltipVisible === 'gerar' && (
              <View style={[styles.tooltip, styles.tooltipVisible]}>
                <Text style={styles.tooltipText}>Gerar várias mesas</Text>
              </View>
            )}
          </View>

          <View style={styles.tooltipContainer}>
            <TouchableOpacity
              style={[styles.headerButton, mergeMode && { backgroundColor: '#FF9800' }]}
              onPress={toggleMergeMode}
              onPressIn={() => showTooltip('merge')}
              onPressOut={hideTooltip}
              // @ts-ignore - Web only propertys
              onMouseEnter={() => Platform.OS === 'web' && showTooltip('merge')}
              onMouseLeave={() => Platform.OS === 'web' && hideTooltip()}
            >
              <SafeIcon name="albums" size={20} color="#fff" fallbackText="J" />
            </TouchableOpacity>
            {tooltipVisible === 'merge' && (
              <View style={[styles.tooltip, styles.tooltipVisible]}>
                <Text style={styles.tooltipText}>{mergeMode ? 'Cancelar Junção' : 'Juntar Mesas'}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Barra de pesquisa e filtros */}
      <SearchAndFilter
        searchText={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Pesquisar por número da mesa ou responsável..."
        filters={statusFilters}
        selectedFilter={selectedStatus || 'todas'}
        onFilterChange={handleFilterChange}
        showFilters={true}
      />

      {/* Lista de mesas */}
      <FlatList
        data={filteredMesas}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <SafeIcon name="restaurant" size={64} color="#ccc" fallbackText="🍽" />
            <Text style={{ color: '#666', marginTop: 16 }}>
              {searchTerm || selectedStatus ? 'Nenhuma mesa encontrada' : 'Nenhuma mesa cadastrada'}
            </Text>
          </View>
        }
      />

      {/* Modal para gerar mesas */}
      <Modal
        visible={gerarMesasModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGerarMesasModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gerar Mesas Automaticamente</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setGerarMesasModalVisible(false)}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Defina a quantidade de mesas para cada tipo que deseja criar automaticamente:
              </Text>

              <View style={styles.quantidadeContainer}>
                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas Internas</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, interna: Math.max(0, prev.interna - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.interna.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, interna: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, interna: prev.interna + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas Externas</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, externa: Math.max(0, prev.externa - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.externa.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, externa: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, externa: prev.externa + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas VIP</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, vip: Math.max(0, prev.vip - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.vip.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, vip: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, vip: prev.vip + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas de Balcão</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, balcao: Math.max(0, prev.balcao - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.balcao.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, balcao: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, balcao: prev.balcao + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>
                  Total: {quantidades.interna + quantidades.externa + quantidades.vip + quantidades.balcao} mesas
                </Text>
              </View>

              <Text style={styles.warningText}>
                As mesas serão numeradas automaticamente a partir do número 1
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setGerarMesasModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={criarMesasAutomaticamente}
                disabled={gerandoMesas}
              >
                {gerandoMesas ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Gerar Mesas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para criar mesa individual */}
      <Modal
        visible={criarMesaModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={fecharModalCriarMesa}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Nova Mesa</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={fecharModalCriarMesa}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Número da Mesa <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.numero}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, numero: text }))}
                  placeholder="Ex: 1, 2, 3..."
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Nome da Mesa <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.nome}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, nome: text }))}
                  placeholder="Ex: Mesa Principal, Mesa da Varanda..."
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Capacidade <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.capacidade}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, capacidade: text }))}
                  placeholder="Número de pessoas"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo da Mesa</Text>
                <View style={styles.tipoSelector}>
                  {['interna', 'externa', 'vip', 'balcao'].map((tipo) => (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.tipoOption,
                        formMesa.tipo === tipo && styles.tipoOptionSelected
                      ]}
                      onPress={() => setFormMesa(prev => ({ ...prev, tipo }))}
                    >
                      <Text style={[
                        styles.tipoOptionText,
                        formMesa.tipo === tipo && styles.tipoOptionTextSelected
                      ]}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Observações</Text>
                <TextInput
                  style={[styles.formInput, styles.textAreaSmall]}
                  value={formMesa.observacoes}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, observacoes: text }))}
                  placeholder="Observações sobre a mesa..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={fecharModalCriarMesa}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={criarMesaIndividual}
                disabled={criandoMesa}
              >
                {criandoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Criar Mesa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para abrir mesa */}
      <Modal
        visible={abrirMesaModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAbrirMesaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showClientModal ? 'Selecionar Cliente' : `Abrir Mesa ${mesaSelecionada?.numero}`}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                    if (showClientModal) {
                        setShowClientModal(false);
                    } else {
                        setAbrirMesaModalVisible(false);
                    }
                }}
              >
                <SafeIcon name={showClientModal ? "arrow-back" : "close"} size={24} color="#666" fallbackText={showClientModal ? "<-" : "×"} />
              </TouchableOpacity>
            </View>

            {showClientModal ? (
                 <View style={{ height: 400, padding: 0 }}>
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                        <TextInput
                            style={[styles.formInput, { marginBottom: 10 }]}
                            placeholder="Buscar por nome..."
                            value={searchClientQuery}
                            onChangeText={setSearchClientQuery}
                            autoFocus={true}
                        />
                    </View>
                    
                    {clients.length === 0 && searchClientQuery.length > 2 && (
                       <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => {
                                   setRegisterForm({ ...registerForm, nome: searchClientQuery });
                                   setShowRegisterModal(true);
                               }}
                           >
                               <SafeIcon name="person-add" size={20} color="#2196F3" fallbackText="+" />
                               <Text style={{ color: '#2196F3', fontWeight: 'bold', marginLeft: 8 }}>Cadastrar: "{searchClientQuery}"</Text>
                           </TouchableOpacity>

                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#FFF3E0', borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => handleUseNameOnly(searchClientQuery)}
                           >
                               <SafeIcon name="document-text" size={20} color="#FF9800" fallbackText="T" />
                               <Text style={{ color: '#FF9800', fontWeight: 'bold', marginLeft: 8 }}>Usar Apenas Nome: "{searchClientQuery}"</Text>
                           </TouchableOpacity>
                       </View>
                    )}

                    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                        {clients.map(c => (
                            <TouchableOpacity key={c.id || c._id} 
                                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                                onPress={() => handleSelectClient(c)}
                            >
                                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{c.nome}</Text>
                                {c.endereco && <Text style={{ fontSize: 12, color: '#666' }}>{c.endereco}</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                 </View>
            ) : (
            <>
            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Nome do Responsável <Text style={styles.requiredField}>*</Text>
                </Text>
                 <TouchableOpacity
                    style={[styles.formInput, { justifyContent: 'center' }]}
                    onPress={() => setShowClientModal(true)}
                  >
                     <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                        <Text style={{ color: formAbrirMesa.nomeResponsavel ? '#000' : '#888' }}>
                            {formAbrirMesa.nomeResponsavel || 'Buscar ou Cadastrar Cliente...'}
                        </Text>
                        <SafeIcon name="search" size={20} color="#666" fallbackText="🔍" />
                     </View>
                  </TouchableOpacity>
              </View>

              <View style={styles.dropdownFormGroup}>
                <Text style={styles.formLabel}>
                  Funcionário Responsável <Text style={styles.requiredField}>*</Text>
                </Text>

                {/* Mobile: Seleção Rápida (Chips) */}
                {Platform.OS !== 'web' || Dimensions.get('window').width < 768 ? (
                   <View>
                       {funcionarios.length === 0 ? (
                            <TouchableOpacity onPress={() => loadFuncionarios()} style={{ padding: 10, alignItems: 'center' }}>
                                <Text style={{ color: '#F44336' }}>Nenhum funcionário. Toque p/ recarregar.</Text>
                            </TouchableOpacity>
                       ) : (
                           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                                {funcionarios.map((func) => {
                                    const isSelected = formAbrirMesa.funcionarioResponsavel === func._id;
                                    return (
                                        <TouchableOpacity
                                            key={func._id}
                                            onPress={() => {
                                                if (func.ativo) {
                                                    setFormAbrirMesa(prev => ({ ...prev, funcionarioResponsavel: func._id }));
                                                } else {
                                                    Alert.alert('Inativo', 'Funcionário inativo.');
                                                }
                                            }}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 16,
                                                borderRadius: 20,
                                                backgroundColor: isSelected ? '#2196F3' : '#f0f0f0',
                                                borderWidth: 1,
                                                borderColor: isSelected ? '#1976D2' : '#e0e0e0',
                                                opacity: func.ativo ? 1 : 0.6
                                            }}
                                        >
                                            <Text style={{ 
                                                color: isSelected ? '#fff' : '#333', 
                                                fontWeight: isSelected ? 'bold' : 'normal' 
                                            }}>
                                                {func.nome}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                           </ScrollView>
                       )}
                   </View>
                ) : (
                /* Desktop: Dropdown Original */
                <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.dropdownButton, { flex: 1, borderColor: (!formAbrirMesa.funcionarioResponsavel && abindoMesa) ? 'red' : '#ddd' }]}
                  onPress={() => {
                      if (funcionarios.length === 0) {
                          Alert.alert(
                              'Sem Funcionários', 
                              'Nenhum funcionário carregado. Tentar recarregar?',
                              [
                                  { text: 'Não', style: 'cancel'},
                                  { text: 'Sim', onPress: () => loadFuncionarios() }
                              ]
                          );
                      } else {
                          setFuncionarioDropdownVisible(!funcionarioDropdownVisible);
                      }
                  }}
                >
                  <Text style={[
                    styles.dropdownButtonText,
                    !formAbrirMesa.funcionarioResponsavel && styles.dropdownPlaceholder,
                    funcionarios.length === 0 && { color: '#F44336' }
                  ]}>
                    {funcionarios.length === 0 
                        ? 'Nenhum funcionário encontrado (Toque p/ recarregar)' 
                        : (formAbrirMesa.funcionarioResponsavel
                            ? funcionarios.find((f: Funcionario) => f._id === formAbrirMesa.funcionarioResponsavel)?.nome
                            : 'Selecione um funcionário')
                    }
                  </Text>
                  <SafeIcon
                    name={funcionarioDropdownVisible ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#666"
                    fallbackText={funcionarioDropdownVisible ? "↑" : "↓"}
                  />
                </TouchableOpacity>
                </View>
                )}

                {/* Dropdown List (Apenas Desktop) */}
                {Platform.OS === 'web' && Dimensions.get('window').width >= 768 && funcionarioDropdownVisible && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScrollView}>
                      <TouchableOpacity
                        style={[
                          styles.dropdownItem,
                          !formAbrirMesa.funcionarioResponsavel && styles.dropdownItemSelected
                        ]}
                        onPress={() => {
                          setFormAbrirMesa(prev => ({ ...prev, funcionarioResponsavel: '' }));
                          setFuncionarioDropdownVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          !formAbrirMesa.funcionarioResponsavel && styles.dropdownItemTextSelected
                        ]}>
                          Nenhum funcionário
                        </Text>
                        {!formAbrirMesa.funcionarioResponsavel && (
                          <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                        )}
                      </TouchableOpacity>
                      {funcionarios.map((funcionario: Funcionario) => (
                        <TouchableOpacity
                          key={funcionario._id}
                          style={[
                            styles.dropdownItem,
                            formAbrirMesa.funcionarioResponsavel === funcionario._id && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            if (!funcionario.ativo) {
                              Alert.alert('Aviso', 'Funcionário inativo não pode ser selecionado.');
                              return;
                            }
                            setFormAbrirMesa(prev => ({ ...prev, funcionarioResponsavel: funcionario._id }));
                            setFuncionarioDropdownVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            formAbrirMesa.funcionarioResponsavel === funcionario._id && styles.dropdownItemTextSelected,
                            !funcionario.ativo && { color: '#999' }
                          ]}>
                            {funcionario.nome}{!funcionario.ativo ? ' (Inativo)' : ''}
                          </Text>
                          {formAbrirMesa.funcionarioResponsavel === funcionario._id && (
                            <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Observações</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={formAbrirMesa.observacoes}
                  onChangeText={(text) => setFormAbrirMesa(prev => ({ ...prev, observacoes: text }))}
                  placeholder="Observações sobre a abertura da mesa..."
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>
            </>
            )}

            {!showClientModal && (
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAbrirMesaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, (!formAbrirMesa.nomeResponsavel || !formAbrirMesa.funcionarioResponsavel) && { opacity: 0.5 }]}
                onPress={() => {
                    if (!formAbrirMesa.nomeResponsavel.trim()) {
                        Alert.alert('Campo Obrigatório', 'Por favor, informe o nome do responsável pela mesa.');
                        return;
                    }
                    if (!formAbrirMesa.funcionarioResponsavel) {
                        if (funcionarios.length === 0) {
                            Alert.alert('Erro de Configuração', 'Não há funcionários cadastrados. Vá em Admin > Funcionários para cadastrar.');
                        } else {
                            Alert.alert('Campo Obrigatório', 'Selecione um funcionário responsável.');
                        }
                        return;
                    }
                    confirmarAbrirMesa();
                }}
                disabled={abindoMesa}
              >
                {abindoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Abrir Mesa</Text>
                )}
              </TouchableOpacity>
            </View>
            )}
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CashbackPromptModal 
        visible={cashbackPromptVisible}
        balance={cashbackBalance}
        totalToPay={fecharTotal - fecharValorPago} // Valor restante real
        loading={finalizandoMesa}
        onClose={() => {
            setCashbackPromptVisible(false);
            setFecharMesaModalVisible(true);
        }}
        onConfirm={async (amount) => {
           // 1. Fechar modal imediatamente para dar feedback visual
           setCashbackPromptVisible(false);
           setFinalizandoMesa(true); // Ativa loading global se houver, ou apenas bloqueia

           try {
               // Validação de segurança
               if(!fecharSaleId) {
                   throw new Error('ID da venda perdido. Tente novamente.');
               }

               // 2. Busca dados da venda
               const saleRes = await saleService.getById(fecharSaleId);
               const sale = saleRes.data;
               if(!sale || !sale.itens) throw new Error('Dados da venda incompletos.');

               // 3. Monta payload de pagamento (Cashback)
               const itemsPayload = [];
               let remainingToPay = amount;
               
               for (const item of sale.itens) {
                   if (remainingToPay <= 0.005) break;
                    let paidSoFar = 0;
                    if (sale.caixaVendas) {
                         sale.caixaVendas.forEach((cv: any) => {
                             let pagos: any[] = [];
                             try { 
                                 if(Array.isArray(cv.itensPagos)) pagos = cv.itensPagos;
                                 else pagos = JSON.parse(cv.itensPagos || '[]');
                             } catch{}
                             const p = pagos.find((pp: any) => String(pp.id) === String(item._id || (item as any).id));
                             if(p) paidSoFar += (Number(p.paidAmount)||0);
                         });
                    }
                    const itemTotal = Number(item.subtotal);
                    const itemRemaining = Math.max(0, itemTotal - paidSoFar);
                    if (itemRemaining > 0) {
                        const toPay = Math.min(remainingToPay, itemRemaining);
                        itemsPayload.push({
                            id: item._id || (item as any).id,
                            paidAmount: toPay,
                            fullyPaid: (itemRemaining - toPay) < 0.05
                        });
                        remainingToPay -= toPay;
                    }
               }
               
               const fee = Number(sale.deliveryFee || 0);
               if (remainingToPay > 0.005 && fee > 0) {
                     let feePaid = 0;
                     if (sale.caixaVendas) {
                         sale.caixaVendas.forEach((cv: any) => {
                            let pagos: any[] = [];
                            try { if(Array.isArray(cv.itensPagos)) pagos = cv.itensPagos; else pagos = JSON.parse(cv.itensPagos); } catch{}
                            const p = pagos.find((pp: any) => pp.id === 'delivery-fee');
                            if(p) feePaid += (Number(p.paidAmount)||0);
                         });
                     }
                     const feeRemaining = Math.max(0, fee - feePaid);
                     if (feeRemaining > 0) {
                         const toPay = Math.min(remainingToPay, feeRemaining);
                         itemsPayload.push({
                             id: 'delivery-fee',
                             paidAmount: toPay,
                             fullyPaid: (feeRemaining - toPay) < 0.05
                         });
                         remainingToPay -= toPay;
                     }
                }

               // 4. Executa pagamento (com correção de precisão)
               const calculatedTotal = itemsPayload.reduce((acc, i) => acc + i.paidAmount, 0);
               const safeTotal = Number(calculatedTotal.toFixed(2));

               await saleService.payItems(fecharSaleId, {
                   paymentInfo: { method: 'cashback', totalAmount: safeTotal },
                   items: itemsPayload
               });

               // 5. Atualiza valores
               const updated = await saleService.getById(fecharSaleId);
               const v = updated.data;
               const p = (v?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
               setFecharValorPago(p);
               
               // O modal de fechamento abre no finally ou setTimeout abaixo
               
           } catch (e: any) {
               const msg = 'Falha ao usar cashback: ' + (e.message || e);
               console.error(msg);
               if (Platform.OS === 'web') alert(msg);
               else Alert.alert('Erro', msg);
           } finally {
               setFinalizandoMesa(false);
               // SEMPRE abre o modal de fechamento, com ou sem sucesso no cashback, para não travar o fluxo
               setTimeout(() => {
                    setFecharMesaModalVisible(true);
               }, 500);
           }
        }}
      />

      {/* Modal de pagamento para fechar mesa */}
      <Modal
        visible={fecharMesaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFecharMesaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🍽️ Finalizar Mesa {fecharMesaSelecionada?.numero}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setFecharMesaModalVisible(false)}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>💰 Total da Mesa: R$ {fecharTotal.toFixed(2)}</Text>
              {fecharValorPago > 0 && (
                <>
                  <Text style={[styles.modalDescription, { color: '#4CAF50', fontSize: 16 }]}>
                    Já pago: R$ {fecharValorPago.toFixed(2)}
                  </Text>
                  <Text style={[styles.modalDescription, { color: '#F44336', fontSize: 18, fontWeight: 'bold' }]}>
                    Restante: R$ {Math.max(0, fecharTotal - fecharValorPago).toFixed(2)}
                  </Text>
                </>
              )}
              <Text style={styles.modalSubDescription}>Selecione a forma de pagamento para finalizar a mesa:</Text>
              <View style={styles.mesaTypesList}>
                {[
                  { key: 'dinheiro', label: 'Dinheiro' },
                  { key: 'cartao', label: 'Cartão' },
                  { key: 'pix', label: 'PIX' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.dropdownItem,
                      fecharPaymentMethod === method.key && styles.dropdownItemSelected,
                    ]}
                    onPress={() => setFecharPaymentMethod(method.key as any)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        fecharPaymentMethod === method.key && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {method.label}
                    </Text>
                    {fecharPaymentMethod === method.key && (
                      <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFecharMesaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  finalizandoMesa && { opacity: 0.6 }
                ]}
                onPress={() => confirmarFechamentoMesa()}
                disabled={finalizandoMesa}
              >
                {finalizandoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PasswordConfirmModal
        visible={cancelMesaModalVisible}
        title="Cancelar Mesa/Venda"
        message={`Tem certeza que deseja cancelar a mesa ${cancelMesaTarget?.numero}? Esta ação não pode ser desfeita e estornará a venda integralmente.`}
        onConfirm={handleConfirmCancelMesa}
        onCancel={() => {
          setCancelMesaModalVisible(false);
          setCancelMesaTarget(null);
        }}
      />
      
      <ReceiptModal 
        visible={receiptModalVisible} 
        sale={selectedReceiptSale}
        onClose={() => setReceiptModalVisible(false)} 
      />

      {/* Footer Fixo para Modo de Junção */}
      {mergeMode && (
        <View style={styles.mergeFooter}>
          <View style={styles.mergeInfo}>
             <Text style={styles.mergeInfoText}>
                {mergeTarget 
                   ? `Principal: Mesa ${mergeTarget.numero}` 
                   : 'Selecione a Mesa Principal'}
             </Text>
             <Text style={styles.mergeInfoSubText}>
                {mergeSources.length > 0 
                   ? `+ ${mergeSources.length} mesas para juntar (${mergeSources.map(m => m.numero).join(', ')})`
                   : 'Selecione mesas para adicionar'}
             </Text>
          </View>
          <View style={styles.mergeActions}>
              <TouchableOpacity style={styles.mergeCancelButton} onPress={toggleMergeMode}>
                  <Text style={styles.mergeButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                  style={[styles.mergeConfirmButton, (!mergeTarget || mergeSources.length === 0) && {opacity: 0.5}]} 
                  onPress={handleMergeConfirm}
                  disabled={!mergeTarget || mergeSources.length === 0}
              >
                  <Text style={styles.mergeButtonText}>Confirmar</Text>
              </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Modal Cadastro Rápido de Cliente */}
      <Modal
          visible={showRegisterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRegisterModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Novo Cliente</Text>
                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={() => setShowRegisterModal(false)}
                    >
                      <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Nome <Text style={styles.requiredField}>*</Text></Text>
                        <TextInput 
                            style={styles.formInput} 
                            value={registerForm.nome}
                            onChangeText={t => setRegisterForm({...registerForm, nome: t})}
                        />
                      </View>
                      
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Whatsapp / Telefone</Text>
                        <TextInput 
                            style={styles.formInput} 
                            value={registerForm.fone}
                            keyboardType="phone-pad"
                            onChangeText={t => setRegisterForm({...registerForm, fone: t})}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>CEP (Opcional)</Text>
                        <TextInput 
                            style={styles.formInput} 
                            placeholder="Digite CEP para buscar"
                            keyboardType="numeric"
                            onBlur={async () => {
                                if (registerForm.endereco?.length > 5) return; 
                                const c = (registerForm as any).cep?.replace(/\D/g,'');
                                if(c?.length===8) {
                                    try {
                                        const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
                                        const d = await r.json();
                                        if(!d.erro) {
                                            setRegisterForm(prev => ({
                                                ...prev,
                                                endereco: `${d.logradouro}, ${d.bairro}`,
                                                cidade: d.localidade,
                                                estado: d.uf
                                            }));
                                        }
                                    } catch {}
                                }
                            }}
                            onChangeText={t => setRegisterForm({...registerForm, cep: t} as any)} 
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Endereço Completo</Text>
                        <TextInput 
                            style={styles.formInput} 
                            value={registerForm.endereco}
                            placeholder="Rua, Número, Bairro"
                            onChangeText={t => setRegisterForm({...registerForm, endereco: t})}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                              <Text style={styles.formLabel}>Cidade</Text>
                              <TextInput 
                                  style={styles.formInput} 
                                  value={registerForm.cidade}
                                  onChangeText={t => setRegisterForm({...registerForm, cidade: t})}
                              />
                          </View>
                          <View style={{ width: 80 }}>
                              <Text style={styles.formLabel}>UF</Text>
                              <TextInput 
                                  style={styles.formInput} 
                                  value={registerForm.estado}
                                  onChangeText={t => setRegisterForm({...registerForm, estado: t})}
                              />
                          </View>
                      </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowRegisterModal(false)}>
                          <Text style={styles.cancelButtonText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={[styles.modalButton, styles.confirmButton]} 
                          onPress={handleRegisterClient}
                          disabled={registerLoading}
                      >
                          {registerLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Salvar</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <CashbackPromptModal
        visible={cashbackPromptVisible}
        balance={cashbackBalance}
        totalToPay={fecharTotal}
        onConfirm={async (amount) => {
            try {
                await saleService.payItems(fecharSaleId!, { 
                   paymentInfo: { method: 'cashback', totalAmount: amount }, 
                   items: [] 
                });
                setFecharValorPago((prev: number) => prev + amount);
                setCashbackPromptVisible(false);
                setFecharMesaModalVisible(true);
            } catch (error) {
                Alert.alert('Erro', 'Falha ao aplicar cashback. Tente novamente.');
            }
        }}
        onClose={() => {
            setCashbackPromptVisible(false);
            setFecharMesaModalVisible(true);
        }}
      />

      <PixModal
        visible={pixModalVisible}
        amount={fecharTotal - fecharValorPago}
        transactionId={fecharMesaSelecionada ? `Mesa ${fecharMesaSelecionada.numero}` : 'Mesa'}
        onClose={() => setPixModalVisible(false)}
        onConfirm={() => {
            setPixModalVisible(false);
            // Chama a confirmação real passando flag true
            confirmarFechamentoMesa(true);
        }}
      />

      {/* Modal de QR Code da Mesa */}
      <Modal
        visible={qrCodeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setQrCodeModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: '#333' }}>
            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FF8C00' }}>QR Code do Cardápio</Text>
              <TouchableOpacity onPress={() => setQrCodeModalVisible(false)} style={{ padding: 4 }}>
                <SafeIcon name="close" size={24} color="#FFF" fallbackText="×" />
              </TouchableOpacity>
            </View>

            {qrCodeMesa && (() => {
              const ipLan = obterIpLanCardapio();
              const porta = obterPortaCardapio();
              const linkCardapio = `http://${ipLan}:${porta}/cardapio/${qrCodeMesa._id}`;
              return (
                <>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 4 }}>
                    Mesa {String(qrCodeMesa.numero).padStart(2, '0')}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#AAA', textAlign: 'center', marginBottom: 20 }}>
                    Aponte a câmera do celular para abrir o cardápio e fazer pedidos.
                  </Text>

                  {/* QR Code Container */}
                  <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
                    <QRCode
                      value={linkCardapio}
                      size={200}
                      logoBackgroundColor='transparent'
                    />
                  </View>

                  {/* URL informativa para copiar/acessar manual */}
                  <View style={{ backgroundColor: '#222', borderRadius: 8, padding: 10, width: '100%', marginBottom: 20, borderWidth: 1, borderColor: '#333' }}>
                    <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Link de Acesso:</Text>
                    <Text style={{ fontSize: 12, color: '#FF8C00', fontWeight: 'bold', textAlign: 'center' }} selectable>
                      {linkCardapio}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={{ backgroundColor: '#FF8C00', paddingVertical: 12, borderRadius: 25, width: '100%', alignItems: 'center' }}
                    onPress={() => setQrCodeModalVisible(false)}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Fechar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statsLeft: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tooltipContainer: {
    position: 'relative',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  headerButtonSecondary: {
    backgroundColor: '#4CAF50',
  },
  tooltip: {
    position: 'absolute',
    top: 50,
    left: '50%',
    transform: [{ translateX: -60 }],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    opacity: 0,
    zIndex: 1000,
    minWidth: 120,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tooltipVisible: {
    opacity: 1,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  statItem: {
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  mesaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mesaNumero: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mesaInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtons: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  openButton: {
    backgroundColor: '#4CAF50',
  },
  addButton: {
    backgroundColor: '#2196F3',
  },
  viewButton: {
    backgroundColor: '#FF9800',
  },
  closeButton: {
     backgroundColor: '#9C27B0',
   },
   releaseButton: {
     backgroundColor: '#9C27B0',
   },
   cashButton: {
     backgroundColor: '#009688',
   },
   maintenanceInfo: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingVertical: 8,
   },
  maintenanceText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  modalDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalSubDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  mesaTypesList: {
    gap: 12,
    marginBottom: 16,
  },
  mesaTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  mesaTypeText: {
    fontSize: 14,
    color: '#333',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 1,
  },
  dropdownFormGroup: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requiredField: {
    color: '#d32f2f',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    height: 60,
    textAlignVertical: 'top',
  },
  tipoSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipoOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  tipoOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  tipoOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tipoOptionTextSelected: {
    color: '#fff',
  },
  quantidadeContainer: {
    gap: 16,
    marginBottom: 16,
  },
  quantidadeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quantidadeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  quantidadeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantidadeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantidadeInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  totalContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownScrollView: {
    maxHeight: 200,
    flexGrow: 0,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // Merge Styles
  mergeFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#333',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 20,
    zIndex: 9999,
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
  mergeInfo: {
    flex: 1,
    marginRight: 10,
  },
  mergeInfoText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  mergeInfoSubText: {
    color: '#ccc',
    fontSize: 12,
  },
  mergeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mergeCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#666',
    borderRadius: 8,
  },
  mergeConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  mergeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
