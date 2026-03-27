import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, ActivityIndicator, Modal, Platform, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import CriarComandaModal from '../../src/components/CriarComandaModal';
// import ProdutosComandaModal from '../../src/components/ProdutosComandaModal';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import api, { comandaService, employeeService, saleService, getWsUrl, authService, idleTimeConfigService } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/services/storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { Comanda } from '../../src/types/index';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import PasswordConfirmModal from '../../src/components/PasswordConfirmModal';
import ReceiptModal from '../../src/components/ReceiptModal';
import PixModal from '../../src/components/PixModal';
import CashbackPromptModal from '../../src/components/CashbackPromptModal';
import { SafeIcon } from '../../components/SafeIcon';

function parseTimeToMs(timeStr: string) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  let ms = 0;
  if (parts.length >= 1) ms += parts[0] * 3600000;
  if (parts.length >= 2) ms += parts[1] * 60000;
  if (parts.length >= 3) ms += parts[2] * 1000;
  return ms;
}

export default function ComandasAbertasScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  // Estados de modal de produtos removidos após migração para SaleScreen
  // const [produtosModalVisible, setProdutosModalVisible] = useState(false);
  // const [comandaSelecionada, setComandaSelecionada] = useState<any>(null);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [filteredComandas, setFilteredComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [idleConfig, setIdleConfig] = useState<any>(null);
  const [comandaIdleStatus, setComandaIdleStatus] = useState<Record<string, string>>({});
  
  // Estados para fechamento de comanda (idêntico às mesas)
  const [fecharComandaModalVisible, setFecharComandaModalVisible] = useState(false);
  const [fecharComandaSelecionada, setFecharComandaSelecionada] = useState<any>(null);
  const [fecharPaymentMethod, setFecharPaymentMethod] = useState('dinheiro');
  const [fecharTotal, setFecharTotal] = useState(0);
  const [fecharSaleId, setFecharSaleId] = useState<string | null>(null);
  const [fecharValorPago, setFecharValorPago] = useState<number>(0);
  const [finalizandoComanda, setFinalizandoComanda] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [cashbackPromptVisible, setCashbackPromptVisible] = useState(false);
  const [cashbackBalance, setCashbackBalance] = useState(0);

  // Estado para cancelar comanda
  const [cancelComandaModalVisible, setCancelComandaModalVisible] = useState(false);
  const [cancelComandaTarget, setCancelComandaTarget] = useState<Comanda | null>(null);
  
  // Estados para filtros (igual à tela de produtos)
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<any[]>([]);
  
  const { user } = useAuth() as any;

  // Utilidades para lidar com totais possivelmente retornados como string/Decimal
  const toNum = (v: any): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const calcSaleTotal = (sale: any): number => {
    const t = toNum(sale?.total);
    if (t > 0) return t;
    const itens = Array.isArray(sale?.itens) ? sale.itens : [];
    const subtotal = itens.reduce((sum: number, it: any) => sum + toNum(it?.subtotal ?? (toNum(it?.quantidade) * toNum(it?.precoUnitario))), 0);
    const desconto = toNum(sale?.desconto);
    return Math.max(0, subtotal - (Number.isFinite(desconto) ? desconto : 0));
  };
  const calcSalePaid = (sale: any): number => {
    return (sale?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (toNum(cv.valor) || 0), 0);
  };
  const formatMoney = (v: any): string => toNum(v).toFixed(2);

  useEffect(() => {
    loadStatusFilters();
    idleTimeConfigService.get().then(res => {
        let d = res.data;
        if (d && typeof d.estagios === 'string') {
            try { d.estagios = JSON.parse(d.estagios); } catch {}
        }
        setIdleConfig(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!idleConfig || !idleConfig.ativo) {
        setComandaIdleStatus({});
        return;
    }
    
    const newStatus: Record<string, string> = {};
    (comandas || []).forEach((c: any) => { 
      const id = String(c._id || c.id);
      if (c.status !== 'aberta') return;

      let baseTime = 0;
      if (c.itens && c.itens.length > 0) {
          const times = c.itens.map((it: any) => new Date(it.createdAt || it.updatedAt || Date.now()).getTime());
          baseTime = Math.max(...times);
      } else if (idleConfig.usarHoraInclusao && c.createdAt) {
          baseTime = new Date(c.createdAt).getTime();
      }

      if (baseTime > 0) {
           const diff = Date.now() - baseTime;
           if (Array.isArray(idleConfig.estagios)) {
               const sorted = [...idleConfig.estagios].sort((a: any, b: any) => parseTimeToMs(a.tempo) - parseTimeToMs(b.tempo));
               for (const est of sorted) {
                   if (diff >= parseTimeToMs(est.tempo)) {
                       newStatus[id] = est.cor;
                   }
               }
           }
      }
    });
    setComandaIdleStatus(newStatus);
  }, [comandas, idleConfig]);

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

  // Aplicar filtros sempre que os dados ou filtros mudarem (igual à tela de produtos)
  useEffect(() => {
    filterComandas();
  }, [searchText, comandas, selectedFilter]);

  useEffect(() => {
    loadComandas();
  }, []);

  const loadStatusFilters = () => {
    // Configuração dos filtros de status igual à tela de produtos
    const filters = [
      { key: '', label: 'Todas', icon: 'apps' },
      { key: 'aberta', label: 'Abertas', icon: 'checkmark-circle' },
      { key: 'finalizada', label: 'Finalizadas', icon: 'close-circle' },
      { key: 'cancelada', label: 'Canceladas', icon: 'ban' }
    ];
    setStatusFilters(filters);
  };

  const applyComandas = (lista: Comanda[]) => {
    setComandas((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return lista;
      // Evitar piscadas: manter ordem e atualizar apenas itens alterados
      const byId = new Map<string, Comanda>();
      prev.forEach((x: any) => byId.set(String(x._id || x.id), x as any));
      const merged = lista.map((x: any) => {
        const id = String(x._id || x.id);
        const old = byId.get(id);
        if (!old) return x as any;
        // Atualiza campos relevantes sem reordenar
        return { ...old, ...x } as any;
      });
      return merged;
    });
  };

  const loadComandas = async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const response = await comandaService.getAll();
      const todasComandas = response.data?.filter((venda: Comanda) => venda.tipoVenda === 'comanda') || [];
      if (!silent) {
        setComandas(todasComandas);
      } else {
        applyComandas(todasComandas);
      }
    } catch (error: any) {
      console.error('Erro ao carregar comandas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as comandas.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const softRefreshComandas = async () => {
    try {
      const response = await comandaService.getAll();
      const todasComandas = response.data?.filter((venda: Comanda) => venda.tipoVenda === 'comanda') || [];
      applyComandas(todasComandas);
    } catch {}
  };

  // Lógica de filtragem igual à tela de produtos
  const filterComandas = () => {
    let filtered = comandas;

    // Filtro por status (igual à tela de produtos)
    if (selectedFilter) {
      filtered = filtered.filter(comanda => comanda.status === selectedFilter);
    }

    // Filtro por texto de busca (igual à tela de produtos)
    if (searchText.trim()) {
      filtered = filtered.filter(comanda =>
        (comanda.nomeComanda && comanda.nomeComanda.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.numeroComanda && comanda.numeroComanda.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.funcionario?.nome && comanda.funcionario.nome.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.cliente?.nome && comanda.cliente.nome.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    setFilteredComandas(filtered);
  };

  // Função de mudança de filtro igual à tela de produtos
  const handleFilterChange = (filterKey: string) => {
    setSelectedFilter(filterKey);
  };

  useFocusEffect(
    useCallback(() => {
      const off = events.on('comandas:refresh', () => {
        softRefreshComandas();
      });
      return () => off();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      softRefreshComandas();
      return () => {};
    }, [])
  );

useEffect(() => {
  if (realtimeConnected) return;
  let since = Date.now();
  const t = setInterval(async () => {
    try {
      const res = await saleService.updates(since);
      if (res?.data?.updates?.length) {
        since = res?.data?.now || Date.now();
        await softRefreshComandas();
      }
    } catch {}
  }, 2500);
  return () => clearInterval(t);
}, [realtimeConnected]);

  useEffect(() => {
    try {
      const url = getWsUrl();
      if (url) {
        const ws = new (globalThis as any).WebSocket(url);
        ws.onopen = () => { setRealtimeConnected(true); softRefreshComandas(); setLoading(false); };
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              if (!id) return;
              const r = await saleService.getById(id);
              const v = r.data;
              if (v && v.tipoVenda === 'comanda') {
                setComandas((prev) => {
                  if (!Array.isArray(prev) || prev.length === 0) return [v];
                  let found = false;
                  const next = prev.map((x: any) => {
                    const idX = String(x._id || x.id);
                    if (idX === String(v._id || v.id)) { found = true; return { ...x, ...v }; }
                    return x;
                  });
                  return found ? next : [...next, v];
                });
              }
            }
          } catch {}
        };
        return () => { try { ws.close(); setRealtimeConnected(false); } catch {} };
      }
    } catch {}
  }, []);

  const handleOpenModal = () => {
    if (Platform.OS === 'ios') {
      console.log('✅ iOS: Toque capturado: abrindo modal Nova Comanda com Alert');
      Alert.alert('Abrindo', 'Nova Comanda', [
        {
          text: 'OK',
          onPress: () => {
            console.log('👉 OK do Alert pressionado, abrindo modal');
            setModalVisible(true);
          },
        },
      ]);
    } else {
      console.log('✅ Web/Android: abrindo modal Nova Comanda imediatamente');
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleOpenProdutosModal = (comanda: any) => {
    // Navegar para a SaleScreen usando o fluxo já consolidado das Mesas
    router.push({
      pathname: '/sale',
      params: { tipo: 'comanda', vendaId: comanda._id }
    });
  };

  // Fluxo antigo de modal de produtos substituído por navegação para /sale
  // const handleCloseProdutosModal = () => {
  //   setProdutosModalVisible(false);
  //   setComandaSelecionada(null);
  // };

  // const handleUpdateComanda = async () => {
  //   // Recarrega as comandas após adicionar/remover produtos
  //   await loadComandas();
  //   
  //   // Se há uma comanda selecionada no modal, atualiza seus dados também
  //   if (comandaSelecionada) {
  //     try {
  //       const response = await comandaService.getById(comandaSelecionada._id);
  //       setComandaSelecionada(response.data);
  //     } catch (error: any) {
  //       console.error('Erro ao atualizar comanda selecionada:', error);
  //     }
  //   }
  // };

  // Função para abrir modal de fechamento de comanda (idêntico às mesas)
  const fecharModalFecharComanda = async (comanda: any) => {
    try {
      setFecharComandaSelecionada(comanda);
      setFecharPaymentMethod('dinheiro');
      setFecharTotal(0);
      setFecharValorPago(0);
      setFecharSaleId(null);

      // Buscar a venda ativa da comanda (igual às mesas)
      const response = await comandaService.getById(comanda._id);
      const comandaData = response.data;

      if (!comandaData) {
        Alert.alert('Erro', 'Nenhuma venda encontrada para esta comanda.');
        return;
      }

      const total = (comandaData.itens || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      const totalPago = (comandaData.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
      setFecharTotal(total);
      setFecharValorPago(totalPago);
      setFecharSaleId(comandaData._id);
      setFecharComandaSelecionada(comandaData);
      
      // Check for Cashback
      let clientBalance = 0;
      if (comandaData.clienteId || (comandaData.cliente && (comandaData.cliente.id || comandaData.cliente._id))) {
          try {
             const cid = comandaData.clienteId || comandaData.cliente.id || comandaData.cliente._id;
             // Fetch client updated data
             const clientRes = await api.get(`/customer/${cid}`);
             clientBalance = Number(clientRes.data.saldoCashback || 0);
          } catch {}
      }
      
      const remaining = total - totalPago;

      if (clientBalance > 0 && remaining > 0) {
          setCashbackBalance(clientBalance);
          setCashbackPromptVisible(true);
      } else {
          setFecharComandaModalVisible(true);
      }

    } catch (error) {
      console.error('Erro ao carregar venda da comanda:', error);
      Alert.alert('Erro', 'Não foi possível buscar a venda da comanda.');
    }
  };

  // Funções para cancelamento com senha
  const iniciarCancelamentoComanda = (comanda: Comanda) => {
    setCancelComandaTarget(comanda);
    setCancelComandaModalVisible(true);
  };

  const handleConfirmCancelComanda = async () => {
    if (!cancelComandaTarget) return;

    try {
      setCancelComandaModalVisible(false);
      // Aqui usamos _id ou id dependendo do que vier
      const id = cancelComandaTarget._id || (cancelComandaTarget as any).id;
      await comandaService.cancel(id);
      Alert.alert('Sucesso', 'Comanda cancelada com sucesso!');
      await loadComandas();
      events.emit('caixa:refresh');
    } catch (error: any) {
      console.error('Erro ao cancelar comanda:', error);
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cancelar comanda.');
    } finally {
      setCancelComandaTarget(null);
    }
  };

  // Função para confirmar fechamento de comanda com validações
  const confirmarFechamentoComanda = async (isPixConfirmed?: boolean) => {
    // Intercepta PIX
    if (fecharPaymentMethod === 'pix' && isPixConfirmed !== true) {
        setFecharComandaModalVisible(false);
        setPixModalVisible(true);
        return;
    }

    if (!fecharPaymentMethod) {
      Alert.alert('Erro', 'Selecione um método de pagamento.');
      return;
    }

    if (!fecharSaleId || !fecharComandaSelecionada) {
      Alert.alert('Erro', 'Dados da comanda não encontrados.');
      return;
    }

    // Validações antes de finalizar: comanda aberta e venda com itens
    try {
      if (fecharComandaSelecionada.status !== 'aberta') {
        Alert.alert('Erro', 'Para fechar, a comanda precisa estar ABERTA.');
        return;
      }

      const vendaResp = await comandaService.getById(fecharSaleId);
      const venda = vendaResp?.data;

      if (!venda) {
        Alert.alert('Erro', 'Venda não encontrada.');
        return;
      }

      if (venda.status !== 'aberta') {
        Alert.alert('Erro', 'A venda precisa estar ABERTA para finalizar.');
        return;
      }

      const itens = Array.isArray(venda.itens) ? venda.itens : [];
      if (itens.length === 0) {
        Alert.alert('Erro', 'Não é possível finalizar uma venda sem itens.');
        return;
      }

      const totalAtual = itens.reduce((sum: number, it: any) => sum + (it.subtotal || 0), 0);
      setFecharTotal(totalAtual);
    } catch (validError: any) {
      console.error('Erro ao validar venda/comanda antes de finalizar:', validError);
      Alert.alert('Erro', validError?.response?.data?.error || 'Falha ao validar venda.');
      return;
    }

    try {
      setFinalizandoComanda(true);

      const response = await saleService.finalize(fecharSaleId, { formaPagamento: fecharPaymentMethod });
      
      if (response.data && response.data.status === 'finalizada') {
        Alert.alert('Sucesso', 'Comanda finalizada com sucesso!');
        
        setFecharComandaModalVisible(false);
        setFecharComandaSelecionada(null);
        setFecharPaymentMethod('dinheiro');
        setFecharTotal(0);
        setFecharSaleId(null);
        
        await loadComandas();
        events.emit('caixa:refresh');
      } else {
        Alert.alert('Erro', 'Falha ao finalizar a comanda.');
      }
    } catch (error: any) {
      console.error('Erro ao finalizar comanda:', error);
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao finalizar comanda.');
    } finally {
      setFinalizandoComanda(false);
    }
  };

  const handleSubmitComanda = async (data: any) => {
    const newComandaData = {
      tipoVenda: 'comanda',
      nomeComanda: data.nomeComanda,
      cliente: data.cliente || null,
      funcionario: data.funcionario,
      valorTotal: data.valorTotalEstimado || 0,
      observacoes: data.observacoes || '',
    };

    console.log('Enviando dados para criar comanda:', JSON.stringify(newComandaData, null, 2));

    try {
      console.log('Criando comanda com dados:', newComandaData);
      const response = await comandaService.create(newComandaData);
      console.log('Resposta da criação:', response.data);
      Alert.alert('Sucesso', 'Comanda criada com sucesso!');
      handleCloseModal();
      // Redireciona imediatamente para a SaleScreen desta comanda
      router.push({ pathname: '/sale', params: { tipo: 'comanda', vendaId: response.data._id } });
      await loadComandas(); // Recarrega as comandas
      events.emit('comandas:refresh');
    } catch (error: any) {
      console.error('Erro detalhado ao criar comanda:', error);
      console.error('Response error:', error.response?.data);
      Alert.alert('Erro', `Não foi possível criar a comanda: ${error.response?.data?.error || error.message || 'Erro desconhecido'}`);
    }
  };

  // Função para obter a cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta':
        return '#4CAF50';
      case 'finalizada':
        return '#2196F3';
      case 'cancelada':
        return '#f44336';
      default:
        return '#666';
    }
  };

  // Função para obter o texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'aberta':
        return 'Aberta';
      case 'finalizada':
        return 'Finalizada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  };

  // Receipt Modal
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any>(null);

  const handleOpenReceipt = (sale: any) => {
      setSelectedReceiptSale(sale);
      setReceiptModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Comandas" />
      
      {/* Componente de busca e filtros igual à tela de produtos */}
      <SearchAndFilter
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Buscar comandas..."
        filters={statusFilters}
        selectedFilter={selectedFilter}
        onFilterChange={handleFilterChange}
      />
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: Platform.OS !== 'web' && Dimensions.get('window').width < 768 ? 16 : 0 }}>
          <TouchableOpacity onPress={() => router.push('/')} accessibilityLabel="Voltar para Home" style={{ marginRight: 12 }}>
            <SafeIcon name="arrow-back" size={Platform.OS !== 'web' && Dimensions.get('window').width < 768 ? 20 : 24} color="#2196F3" fallbackText="←" />
          </TouchableOpacity>
          <Text style={[styles.title, Platform.OS !== 'web' && Dimensions.get('window').width < 768 && { fontSize: 18 }]}>Comandas</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleOpenModal}>
          <Text style={styles.buttonText}>Nova Comanda</Text>
        </TouchableOpacity>
      </View>
      
      <CriarComandaModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSubmitComanda}
      />
      
      {/* ProdutosComandaModal removido: fluxo migrado para SaleScreen (/sale) */}
      
      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={filteredComandas}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            return (
            <View style={[
                  styles.comandaItem,
                  item.status === 'aberta' && comandaIdleStatus[item._id] && { backgroundColor: comandaIdleStatus[item._id] }
                 ]}>
              <TouchableOpacity 
                style={styles.comandaContent}
                onPress={() => handleOpenProdutosModal(item)}
              >
                <View style={styles.comandaInfo}>
                  <View style={styles.comandaHeader}>
                    <TouchableOpacity onPress={() => handleOpenReceipt(item)}>
                        <Text style={[styles.comandaNome, { textDecorationLine: 'underline', color: '#2196F3' }]}>
                            {item.nomeComanda || item.numeroComanda || 'Sem nome'}
                        </Text>
                    </TouchableOpacity>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.comandaFuncionario}>Funcionário: {item.funcionario?.nome || 'Não definido'}</Text>
                  {item.cliente?.nome && (
                    <Text style={styles.comandaCliente}>Cliente: {item.cliente.nome}</Text>
                  )}
                  <Text style={styles.comandaItens}>{item.itens?.length || 0} itens</Text>
                </View>
                <View style={styles.comandaTotal}>
                  <Text style={styles.comandaValor}>R$ {formatMoney(calcSaleTotal(item))}</Text>
                    {(() => {
                        const total = calcSaleTotal(item);
                        const paid = calcSalePaid(item);
                        if (total > 0 && paid > 0) {
                            return (
                                <>
                                    <Text style={{ fontSize: 11, color: '#4CAF50', marginTop: 2, textAlign: 'right' }}>
                                        Pago: {formatMoney(paid)}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#F44336', fontWeight: 'bold', textAlign: 'right' }}>
                                        Falta: {formatMoney(Math.max(0, total - paid))}
                                    </Text>
                                </>
                            );
                        }
                        return null;
                    })()}
                </View>
              </TouchableOpacity>
              
              {/* Botão de fechar comanda - só aparece se a comanda estiver aberta */}
              {item.status === 'aberta' && (
                <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8 }}>
                  <TouchableOpacity 
                    style={[styles.fecharButton, { backgroundColor: '#9C27B0', flex: 1, margin: 4 }, (item.itens?.length || 0) === 0 && { opacity: 0.6 }]}
                    onPress={() => {
                      console.log('🔴 BOTÃO FECHAR COMANDA CLICADO!', item);
                      fecharModalFecharComanda(item);
                    }}
                    disabled={(item.itens?.length || 0) === 0}
                  >
                    <View style={{ marginRight: 4 }}>
                      <SafeIcon name="close-circle" size={16} color="#fff" fallbackText="×" />
                    </View>
                    <Text style={styles.fecharButtonText}>Fechar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.fecharButton, { backgroundColor: '#F44336', flex: 1, margin: 4 }]}
                    onPress={() => iniciarCancelamentoComanda(item)}
                  >
                    <View style={{ marginRight: 4 }}>
                      <SafeIcon name="trash" size={16} color="#fff" fallbackText="🗑" />
                    </View>
                    <Text style={styles.fecharButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma comanda encontrada.</Text>
            </View>
          }
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de fechamento de comanda (idêntico às mesas) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={fecharComandaModalVisible}
        onRequestClose={() => setFecharComandaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📋 Finalizar Comanda</Text>
            
            {fecharComandaSelecionada && (
              <View style={styles.comandaDetails}>
                <Text style={styles.comandaDetailTitle}>
                  {fecharComandaSelecionada.nomeComanda || fecharComandaSelecionada.numeroComanda || 'Sem nome'}
                </Text>
                <Text style={styles.comandaDetailText}>
                  Funcionário: {fecharComandaSelecionada.funcionario?.nome || 'Não definido'}
                </Text>
                {fecharComandaSelecionada.cliente?.nome && (
                  <Text style={styles.comandaDetailText}>
                    Cliente: {fecharComandaSelecionada.cliente.nome}
                  </Text>
                )}
                <Text style={styles.comandaDetailText}>
                  Itens: {fecharComandaSelecionada.itens?.length || 0}
                </Text>
                <Text style={styles.totalText}>
                  💰 Total da Comanda: R$ {formatMoney(fecharTotal)}
                </Text>
                {fecharValorPago > 0 && (
                  <>
                    <Text style={[styles.totalText, { color: '#4CAF50', fontSize: 16, marginTop: 4 }]}>
                      Já pago: R$ {formatMoney(fecharValorPago)}
                    </Text>
                    <Text style={[styles.totalText, { color: '#F44336', fontSize: 18, fontWeight: 'bold', marginTop: 4 }]}>
                      Restante: R$ {formatMoney(Math.max(0, fecharTotal - fecharValorPago))}
                    </Text>
                  </>
                )}
              </View>
            )}

            <Text style={styles.paymentLabel}>Método de Pagamento:</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'dinheiro' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('dinheiro')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'dinheiro' && styles.paymentOptionTextSelected
                ]}>
                  Dinheiro
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'cartao' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('cartao')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'cartao' && styles.paymentOptionTextSelected
                ]}>
                  Cartão
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'pix' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('pix')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'pix' && styles.paymentOptionTextSelected
                ]}>
                  PIX
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFecharComandaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (finalizandoComanda || fecharComandaSelecionada?.status !== 'aberta' || (fecharComandaSelecionada?.itens?.length || 0) === 0 || !fecharPaymentMethod) && { opacity: 0.6 }
                ]}
                onPress={() => confirmarFechamentoComanda()}
                disabled={
                  finalizandoComanda ||
                  fecharComandaSelecionada?.status !== 'aberta' ||
                  (fecharComandaSelecionada?.itens?.length || 0) === 0 ||
                  !fecharPaymentMethod
                }
              >
                {finalizandoComanda ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Finalizar Comanda</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PasswordConfirmModal
        visible={cancelComandaModalVisible}
        title="Cancelar Comanda"
        message={`Tem certeza que deseja cancelar a comanda ${cancelComandaTarget?.nomeComanda || cancelComandaTarget?.numeroComanda}? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmCancelComanda}
        onCancel={() => {
          setCancelComandaModalVisible(false);
          setCancelComandaTarget(null);
        }}
      />
      
      <ReceiptModal 
        visible={receiptModalVisible} 
        sale={selectedReceiptSale} 
        onClose={() => setReceiptModalVisible(false)} 
      />

      <ReceiptModal 
        visible={receiptModalVisible} 
        sale={selectedReceiptSale} 
        onClose={() => setReceiptModalVisible(false)} 
      />

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
                setFecharComandaModalVisible(true);
            } catch (error) {
                Alert.alert('Erro', 'Falha ao aplicar cashback. Tente novamente.');
            }
        }}
        onClose={() => {
            setCashbackPromptVisible(false);
            setFecharComandaModalVisible(true);
        }}
      />

      <PixModal 
        visible={pixModalVisible}
        amount={Math.max(0, fecharTotal - fecharValorPago)}
        transactionId={fecharComandaSelecionada ? (fecharComandaSelecionada.nomeComanda || fecharComandaSelecionada.numeroComanda) : 'Comanda'}
        onClose={() => setPixModalVisible(false)}
        onConfirm={() => {
            setPixModalVisible(false);
            confirmarFechamentoComanda(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  comandaItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  comandaContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  fecharButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  fecharButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  comandaInfo: {
    flex: 1,
  },
  comandaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comandaNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  comandaFuncionario: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  comandaCliente: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  comandaItens: {
    fontSize: 14,
    color: '#666',
  },
  comandaTotal: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  comandaValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Estilos do modal de fechamento
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  comandaDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  comandaDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  comandaDetailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 8,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  paymentOption: {
    flex: 1,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  paymentOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  paymentOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentOptionTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});