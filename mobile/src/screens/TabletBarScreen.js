import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Vibration, Animated, Pressable, ScrollView, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, authService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { computeDateRange, buildQueueParams } from '../utils/filters';
import { useSetorSync } from '../hooks/useSetorSync';
import { imprimirPedidoSetor } from '../utils/printSetor';
import { playOrderAlertSound } from '../utils/orderAlertSound';

export default function TabletBarScreen(props = {}) {
  const { setorIdOverride, setorNomeOverride, forceFilterStatus, hiddenIds, soundVolume, soundMuted } = props || {};
  const [items, setItems] = useState([]);
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setorId, setSetorId] = useState(null);
  const [setorNome, setSetorNome] = useState('Bar');
  const [submittingId, setSubmittingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: null, text: '' });
  const screenHeight = Dimensions.get('window').height;
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState({ d: null, m: null, y: null });
  const [customTo, setCustomTo] = useState({ d: null, m: null, y: null });
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [setores, setSetores] = useState([]);

  const knownItemQtyMapRef = useRef(new Map());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    isFirstLoadRef.current = true;
    knownItemQtyMapRef.current = new Map();
  }, [setorIdOverride]);

  const ensureToken = React.useCallback(async () => {
    try {
      const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!existingToken) {
        const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
        const token = login?.data?.token;
        if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      }
    } catch {}
  }, []);

  React.useEffect(() => { ensureToken(); }, [ensureToken]);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [sound, setSound] = useState();
  const [filterStatus, setFilterStatus] = useState(forceFilterStatus || 'pendente');

  // Função para notificar novo pedido (Toque de Telefone + Vibração + Animação)
  const notificarNovoPedido = async () => {
    playOrderAlertSound(soundVolume, soundMuted);

    // Vibração
    Vibration.vibrate([0, 200, 100, 200]);
    
    // Animação de fade
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Sincronização em tempo real
  const handleUpdate = (updateData) => {
    console.log('Atualização recebida:', updateData);
    const id = setorIdOverride ?? setorId;
    if (!id) return;

    // Tocar alerta imediatamente se o evento indicar novo item ou incremento (+) para a aba aberta
    if (updateData && updateData.eventType === 'new_order_item') {
      const isTodosTab = String(id).toLowerCase() === 'todos';
      const evSetorIds = Array.isArray(updateData.setorIds) ? updateData.setorIds.map(Number) : [];
      const belongsToOpenTab = isTodosTab || evSetorIds.includes(Number(id));
      if (belongsToOpenTab) {
        notificarNovoPedido();
      }
    }

    buscarItensDoSetor(id, undefined, true);
  };

  const { connected } = useSetorSync(setorIdOverride ?? setorId, handleUpdate);

  // Buscar ID do setor bar
  const buscarSetorBar = async () => {
    try {
      const response = await apiService.request({
        method: 'GET',
        url: '/setor-impressao/list'
      });

      if (response.data?.success) {
        const setores = response.data.data;
        const bar = setores.find(s => 
          s.nome.toLowerCase().includes('bar') || 
          s.nome.toLowerCase().includes('balcão') ||
          s.nome.toLowerCase().includes('balcao')
        );
        
        if (bar) {
          setSetorId(bar.id);
          setSetorNome(bar.nome);
          return bar.id;
        } else {
          // Se não encontrar "bar", procurar por nomes similares
          const similar = setores.find(s => 
            s.nome.toLowerCase().includes('bebidas') ||
            s.nome.toLowerCase().includes('drink')
          );
          if (similar) {
            setSetorId(similar.id);
            setSetorNome(similar.nome);
            return similar.id;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar setor bar:', error);
      return null;
    }
  };

  const carregarSetores = React.useCallback(async () => {
    try {
      const response = await apiService.request({ method: 'GET', url: '/setor-impressao/list' });
      const arr = Array.isArray(response?.data?.data) ? response.data.data : [];
      setSetores(arr);
    } catch {}
  }, []);

  // Buscar itens do setor
  const buscarItensDoSetor = async (idSetor, statusOverride, silent = false) => {
    if (!idSetor) return;
    
    try {
      if (!silent) setLoading(true);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const activeStatus = statusOverride || (forceFilterStatus || filterStatus);
      const range = computeDateRange(datePreset, customFrom, customTo);
      const dateParams = buildQueueParams(activeStatus, range, selectedEmployeeIds);
      let response = await apiService.request({
        method: 'GET',
        url: `/setor-impressao-queue/${idSetor}/queue?status=${activeStatus}${dateParams}&strict=1`,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data?.success) {
        let arr = response.data.data || [];
        setFeedbackMsg({ type: null, text: '' });
        setRawItems(arr);

        // Detectar novos pedidos pendentes ou aumento de quantidade (+) apenas desta aba aberta
        if (activeStatus === 'pendente') {
          const nextMap = new Map();
          for (const it of arr) {
            const itemId = Number(it.id);
            const qty = Math.max(1, Number(it.quantidade || 1));
            nextMap.set(itemId, (nextMap.get(itemId) || 0) + qty);
          }

          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            knownItemQtyMapRef.current = nextMap;
          } else {
            let hasNewOrIncremented = false;
            for (const [itemId, qty] of nextMap.entries()) {
              const prevQty = knownItemQtyMapRef.current.get(itemId);
              if (prevQty === undefined || qty > prevQty) {
                hasNewOrIncremented = true;
                break;
              }
            }
            knownItemQtyMapRef.current = nextMap;
            if (hasNewOrIncremented) {
              notificarNovoPedido();
            }
          }
        }

        let base = Array.isArray(hiddenIds) && hiddenIds.length > 0 ? arr.filter((i) => !hiddenIds.includes(Number(i.id))) : arr;
        if (Array.isArray(selectedEmployeeIds) && selectedEmployeeIds.length > 0) {
          const empSet = new Set(selectedEmployeeIds.map((v) => Number(v)));
          const nameSet = new Set(selectedEmployeeIds.map((id) => {
            const emp = employees.find((e) => Number(e.id) === Number(id));
            return String(emp?.nome || '').trim().toLowerCase();
          }).filter(Boolean));
          base = base.filter((it) => {
            const byId = empSet.has(Number(it?.preparedById)) || empSet.has(Number(it?.funcionarioId)) || empSet.has(Number(it?.employeeId));
            const nome = String(it?.funcionario || it?.preparadoPor || it?.responsavel || it?.employeeName || '').trim().toLowerCase();
            const byName = nome && nameSet.has(nome);
            return byId || byName;
          });
        }
        const expanded = [];
        for (const it of base) {
          const qty = Math.max(1, Math.floor(Number(it?.quantidade || 1)));
          for (let k = 0; k < qty; k++) {
            expanded.push({ ...it, quantidade: 1, displayQty: 1, realId: it.id, _key: `${it.id}-${k}` });
          }
        }
        console.log('[ENTREGUES FILTRO][BAR][SERVER]', { status: activeStatus, range, employeeIds: selectedEmployeeIds, rawCount: arr.length, showCount: expanded.length });
        setItems(expanded);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      Alert.alert('Erro', 'Não foi possível carregar os pedidos');
    } finally {
      setLoading(false);
    }
  };

  // date range util moved to utils/filters

  const carregarFuncionarios = React.useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const resp = await apiService.request({ method: 'GET', url: '/employee/list', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const arr = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp?.data?.data) ? resp.data.data : [];
      setEmployees(arr);
    } catch {}
  }, []);

  // Alterar status do item (pendente -> pronto -> entregue)
  const alterarStatus = async (item, novoStatus) => {
    try {
      let existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!existingToken) {
        try {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const token = login?.data?.token;
          if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          existingToken = token;
        } catch {}
      }
      setSubmittingId(item.id);
      Vibration.vibrate(100);
      const response = await apiService.request({
        method: 'PATCH',
        url: `/setor-impressao-queue/sale/${item.saleId}/item/${(item.realId || item.id)}/status`,
        data: { status: novoStatus },
        headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {}
      });
      if (response?.success && response.data?.success) {
        notificarSucesso();
        const targetKey = String(item?._key || `${item.id}`);
        setItems(prevItems => prevItems.filter(i => String(i?._key || `${i.id}`) !== targetKey));
        Alert.alert('Sucesso', novoStatus === 'pronto' ? 'Item marcado como pronto' : 'Item marcado como entregue');
        setFeedbackMsg({ type: 'success', text: novoStatus === 'pronto' ? 'Item marcado como pronto' : 'Item marcado como entregue' });
        buscarItensDoSetor(setorId);
      } else {
        const msg = response?.data?.message || `Falha ao marcar como ${novoStatus} (status ${response?.status || 'N/A'})`;
        Alert.alert('Erro', msg);
        setFeedbackMsg({ type: 'error', text: msg });
      }
    } catch (error) {
      console.error(`Erro ao marcar item como ${novoStatus}:`, error);
      Alert.alert('Erro', `Não foi possível marcar o item como ${novoStatus}`);
    } finally {
      setSubmittingId(null);
    }
  };

  // Notificar sucesso
  const notificarSucesso = () => {
    Vibration.vibrate(50);
    // Aqui você pode adicionar som de sucesso se desejar
  };

  // Função para imprimir todos os pedidos atuais
  const imprimirPedidos = async () => {
    if (items.length === 0) {
      Alert.alert('Aviso', 'Não há pedidos para imprimir');
      return;
    }

    try {
      const resultado = await imprimirPedidoSetor(items, setorNome);
      if (resultado.success) {
        Alert.alert('Sucesso', 'Pedidos preparados para impressão');
      } else {
        Alert.alert('Erro', resultado.message);
      }
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      Alert.alert('Erro', 'Não foi possível preparar os pedidos para impressão');
    }
  };

  // Agrupar itens por mesa
  const agruparPorMesa = (items) => {
    const agrupado = {};
    items.forEach(item => {
      if (!agrupado[item.mesa]) {
        agrupado[item.mesa] = [];
      }
      agrupado[item.mesa].push(item);
    });
    return agrupado;
  };

  // Atualizar quando a tela entrar em foco
  useFocusEffect(
    useCallback(() => {
      const carregarDados = async () => {
        let idSetor = setorIdOverride ?? null;
        if (idSetor) {
          setSetorId(idSetor);
          if (setorNomeOverride) setSetorNome(setorNomeOverride);
        } else {
          idSetor = await buscarSetorBar();
        }
        if (idSetor) {
          await buscarItensDoSetor(idSetor);
        } else {
          Alert.alert('Aviso', 'Setor "Bar" não encontrado. Verifique o cadastro de setores.');
          setLoading(false);
        }
      };
      carregarDados();
      const interval = setInterval(() => {
        const id = setorIdOverride ?? setorId;
        if (id) {
          buscarItensDoSetor(id, undefined, true);
        }
      }, 3000);
      return () => clearInterval(interval);
    }, [setorId, setorIdOverride, setorNomeOverride, filterStatus, forceFilterStatus, hiddenIds])
  );

  React.useEffect(() => {
    const id = setorIdOverride ?? setorId;
    if (id) {
      buscarItensDoSetor(id);
    }
    if ((forceFilterStatus || filterStatus) === 'entregue' || employees.length === 0) {
      carregarFuncionarios();
    }
    if ((forceFilterStatus || filterStatus) === 'entregue' && setores.length === 0) {
      carregarSetores();
    }
  }, [setorId, setorIdOverride, filterStatus, forceFilterStatus, hiddenIds, datePreset, customFrom, customTo, selectedEmployeeIds, carregarFuncionarios]);

  const mesasAgrupadas = agruparPorMesa(items);

  const getWaitingMinutes = (dt) => {
    const t = new Date(dt).getTime();
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  };

  const renderItem = ({ item }) => {
    const screenWidth = Dimensions.get('window').width;
    const isPhone = screenWidth < 768;
    const iconSize = isPhone ? 12 : 20;
    const waiting = getWaitingMinutes(item.horario);
    const urgencyStyle = waiting >= 20 ? styles.urgentHigh : waiting >= 10 ? styles.urgentMedium : waiting >= 5 ? styles.urgentLow : null;
    const timeStr = new Date(item.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const rawMesa = String(item?.mesa || '');
    const isComanda = /comanda/i.test(rawMesa) || String(item?.tipo || '').toLowerCase() === 'comanda';
    const displayName = rawMesa.replace(/^\s*(comanda|mesa)\s*:?\s*/i, '').trim();
    const hasResp = item.responsavel && !/não informado/i.test(String(item.responsavel));

    return (
      <Animated.View style={[styles.itemContainer, urgencyStyle, { opacity: fadeAnim }]}> 
        <View style={styles.itemInfo}>
          {/* Linha 1: Produto + Badge de Status (Esquerda) | Tempo + Botão de Ação (Direita) */}
          <View style={styles.itemTopRow}>
            <View style={styles.itemTitleGroup}>
              <Text style={styles.itemTitle}>
                {Number(item?.displayQty || 1)}x {item.produto}
              </Text>
              <Text style={[
                styles.statusPill,
                (item.status === 'pendente' || item.status === 'pago')
                  ? styles.statusPending
                  : item.status === 'pronto'
                  ? styles.statusReady
                  : styles.statusDelivered
              ]}>
                {(item.status === 'pendente' || item.status === 'pago')
                  ? (item.isPago || item.status === 'pago' ? 'Em preparação • Pago' : 'Em preparação')
                  : item.status === 'pronto'
                  ? 'Pronto'
                  : 'Entregue'}
              </Text>
              {item.setorNome ? (
                <View style={styles.setorBadge}>
                  <Ionicons name="pricetag-outline" size={11} color="#4338CA" />
                  <Text style={styles.setorBadgeText}>{String(item.setorNome).toUpperCase()}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.topRightActions}>
              <View style={styles.itemMeta}>
                <Ionicons name="time" size={15} color="#475569" />
                <Text style={styles.waitText}>{waiting} min</Text>
              </View>
              {(item.status === 'pendente' || item.status === 'pago') ? (
                <TouchableOpacity style={[styles.checkbox, { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' }]} onPress={() => alterarStatus(item, 'pronto')} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={iconSize} color="#2E7D32" />
                  <Text style={[styles.checkboxText, { color: '#2E7D32', fontWeight: 'bold' }]}>Marcar como pronto</Text>
                </TouchableOpacity>
              ) : item.status === 'pronto' ? (
                <TouchableOpacity
                  style={[styles.checkbox, { borderColor: '#2196F3', backgroundColor: '#E3F2FD', opacity: submittingId === item.id ? 0.6 : 1 }]}
                  onPress={() => {
                    try {
                      console.log('Entregar clique (bar)', { id: item.realId || item.id, saleId: item.saleId, status: item.status });
                      if (!(item?.realId || item?.id) || !item?.saleId) {
                        Alert.alert('Erro', 'Item inválido para entrega');
                        return;
                      }
                      alterarStatus(item, 'entregue');
                    } catch (e) {
                      Alert.alert('Erro', 'Falha ao iniciar entrega');
                    }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.8}
                  disabled={submittingId === item.id}
                >
                  <Ionicons name="checkmark" size={iconSize} color="#1565C0" />
                  <Text style={[styles.checkboxText, { color: '#1565C0', fontWeight: 'bold' }]}>Marcar como entregue</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.checkbox, { borderColor: '#9E9E9E', backgroundColor: '#F5F5F5' }]}> 
                  <Ionicons name="checkmark-done" size={iconSize} color="#757575" />
                  <Text style={[styles.checkboxText, { color: '#757575' }]}>Entregue</Text>
                </View>
              )}
            </View>
          </View>

          {/* Linha 2: Detalhes em Linha Horizontal */}
          <View style={styles.itemDetailsInlineRow}>
            <View style={styles.inlineTag}>
              <Ionicons name={isComanda ? "receipt-outline" : "restaurant-outline"} size={13} color="#0284C7" />
              <Text style={styles.inlineTagHighlight}>{isComanda ? 'Comanda' : 'Mesa'}: {displayName || rawMesa}</Text>
            </View>

            <Text style={styles.inlineDot}>•</Text>

            <View style={styles.inlineTag}>
              <Ionicons name="person-outline" size={13} color="#64748B" />
              <Text style={styles.inlineTagText}>{item.funcionario || 'Atendente'}</Text>
            </View>

            <Text style={styles.inlineDot}>•</Text>

            <View style={styles.inlineTag}>
              <Ionicons name="time-outline" size={13} color="#64748B" />
              <Text style={styles.inlineTagText}>{timeStr}</Text>
            </View>

            {hasResp ? (
              <>
                <Text style={styles.inlineDot}>•</Text>
                <View style={styles.inlineTag}>
                  <Ionicons name="person-circle-outline" size={13} color="#64748B" />
                  <Text style={styles.inlineTagText}>Resp: {item.responsavel}</Text>
                </View>
              </>
            ) : null}

            {item.observacoes ? (
              <View style={styles.obsInlineTag}>
                <Ionicons name="alert-circle" size={13} color="#B45309" />
                <Text style={styles.obsInlineText} numberOfLines={1}>Obs: {item.observacoes}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderMesa = ({ item: mesa }) => {
    const mesaItems = mesasAgrupadas[mesa];
    return (
      <View style={styles.mesaContainer}>
        <View style={styles.mesaHeader}>
          <Text style={styles.mesaTitle}>{mesa}</Text>
          <Text style={styles.mesaItemsCount}>{mesaItems.length} item(s)</Text>
        </View>
        <FlatList
          data={mesaItems}
          renderItem={renderItem}
          keyExtractor={(item, idx) => String(item?._key || `${item.id}-${idx}`)}
          scrollEnabled={true}
          nestedScrollEnabled={true}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="wine" size={48} color="#4CAF50" style={styles.loadingIcon} />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
          <Text style={styles.loadingSubtext}>Preparando bar</Text>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="wine" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
          <Text style={styles.emptySubtext}>Os pedidos aparecerão aqui quando forem realizados</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCompactRow}>
          <View style={styles.headerLeftGroup}>
            <Ionicons name="wine" size={24} color="#4CAF50" />
            <Text style={styles.headerTitleCompact}>{setorNome}</Text>
            <Text style={styles.headerSubtitleCompact}>{forceFilterStatus === 'pronto' ? 'Prontos' : `${items.length} ${filterStatus}`}</Text>
          </View>
          <View style={styles.headerRightGroup}>
            <View style={[styles.connectionStatus, connected ? styles.connected : styles.disconnected]}>
              <Ionicons name={connected ? 'wifi' : 'wifi-off'} size={14} color="#fff" />
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={imprimirPedidos}>
              <Ionicons name="print" size={18} color="#fff" />
            </TouchableOpacity>
            
          </View>
        </View>
        {!forceFilterStatus && (
          <View style={styles.filtersRow}>
            <TouchableOpacity onPress={() => { setFilterStatus('pendente'); if (setorId) buscarItensDoSetor(setorId, 'pendente'); }} style={[styles.filterChip, filterStatus === 'pendente' && styles.filterChipActive]}>
              <Text style={[styles.filterText, filterStatus === 'pendente' && styles.filterTextActive]}>Em preparação</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFilterStatus('pronto'); if (setorId) buscarItensDoSetor(setorId, 'pronto'); }} style={[styles.filterChip, filterStatus === 'pronto' && styles.filterChipActive]}>
              <Text style={[styles.filterText, filterStatus === 'pronto' && styles.filterTextActive]}>Prontos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFilterStatus('entregue'); if (setorId) buscarItensDoSetor(setorId, 'entregue'); }} style={[styles.filterChip, filterStatus === 'entregue' && styles.filterChipActive]}>
              <Text style={[styles.filterText, filterStatus === 'entregue' && styles.filterTextActive]}>Entregues</Text>
            </TouchableOpacity>
          </View>
        )}
        {((forceFilterStatus || filterStatus) !== 'entregue') && (
          <View style={styles.compactFiltersArea}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {employees.map((e) => {
                const checked = selectedEmployeeIds.includes(e.id);
                const count = items.filter(i => (Number(i.preparedById) === Number(e.id) || Number(i.funcionarioId) === Number(e.id))).length;
                return (
                  <TouchableOpacity key={e.id} style={[styles.employeeChip, checked && styles.employeeChipActive]} onPress={() => { setSelectedEmployeeIds((prev)=> checked ? prev.filter(id=>id!==e.id) : [...prev, e.id]); if (setorId) buscarItensDoSetor(setorId); }}>
                    <Text style={[styles.employeeChipText, checked && styles.employeeChipTextActive]}>{e.nome}</Text>
                    <Text style={[styles.employeeChipCount, checked && styles.employeeChipTextActive]}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        {feedbackMsg.text ? (
          <Text style={[styles.feedbackMsg, feedbackMsg.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
            {feedbackMsg.text}
          </Text>
        ) : null}
        {(forceFilterStatus === 'entregue' || filterStatus === 'entregue') && (
          <View style={styles.compactFiltersArea}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {setores.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => { setSetorId(s.id); setSetorNome(s.nome); buscarItensDoSetor(s.id); }} style={[styles.filterChipSm, Number(setorId) === Number(s.id) && styles.filterChipSmActive]}>
                  <Text style={[styles.filterTextSm, Number(setorId) === Number(s.id) && styles.filterTextSmActive]}>
                    {s.nome.toLowerCase().includes('bar') ? 'bar' : s.nome.toLowerCase().includes('cozinha') ? 'cozinha' : s.nome.toLowerCase().includes('chapa') ? 'chapa' : s.nome}
                  </Text>
                </TouchableOpacity>
              ))}
              {['hoje','semana','mes','custom'].map((p) => (
                <TouchableOpacity key={p} onPress={() => { setDatePreset(p); if (setorId) buscarItensDoSetor(setorId); }} style={[styles.filterChipSm, datePreset === p && styles.filterChipSmActive]}>
                  <Text style={[styles.filterTextSm, datePreset === p && styles.filterTextSmActive]}>
                    {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Pers.'}
                  </Text>
                </TouchableOpacity>
              ))}
              {employees.map((e) => {
                const checked = selectedEmployeeIds.includes(e.id);
                const count = items.filter(i => i.status==='entregue' && (Number(i.preparedById) === Number(e.id) || Number(i.funcionarioId) === Number(e.id))).length;
                return (
                  <TouchableOpacity key={e.id} style={[styles.employeeChip, checked && styles.employeeChipActive]} onPress={() => { setSelectedEmployeeIds((prev)=> checked ? prev.filter(id=>id!==e.id) : [...prev, e.id]); if (setorId) buscarItensDoSetor(setorId); }}>
                    <Text style={[styles.employeeChipText, checked && styles.employeeChipTextActive]}>{e.nome}</Text>
                    <Text style={[styles.employeeChipCount, checked && styles.employeeChipTextActive]}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        
        {(forceFilterStatus === 'entregue' || filterStatus === 'entregue') && items.length === 0 && (
          <Text style={styles.noResultsBanner}>Nenhum item encontrado com os filtros selecionados</Text>
        )}
      </View>
      
      
      
      
      <View style={[styles.deliveriesArea, { minHeight: screenHeight * 0.7 }]}>
      <FlatList
          style={styles.mainList}
          data={[...items].sort((a, b) => new Date(a.horario).getTime() - new Date(b.horario).getTime())}
          renderItem={renderItem}
          keyExtractor={(item, idx) => String(item?._key || `${item.id}-${idx}`)}
          contentContainerStyle={styles.listContainer}
        scrollEnabled={true}
        showsVerticalScrollIndicator
        initialNumToRender={12}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => buscarItensDoSetor(setorId)}
            colors={['#4CAF50']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wine" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
            <Text style={styles.emptySubtext}>Os pedidos aparecerão aqui quando forem realizados</Text>
          </View>
        }
      />
      </View>
    </View>
  );
}

function PickerSmall({ value, onChange, range }) {
  return (
    <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 4, backgroundColor: '#fff' }}>
      <Picker selectedValue={value} onValueChange={onChange} style={{ width: 90, height: 40 }}>
        <Picker.Item label="--" value={null} />
        {range.map((v) => (
          <Picker.Item key={String(v)} label={String(v)} value={v} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTopRow: {
    display: 'none'
  },
  headerCompactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitleCompact: { fontSize: 18, fontWeight: '700', color: '#4CAF50', marginLeft: 6 },
  headerSubtitleCompact: { fontSize: 12, color: '#666', marginLeft: 8 },
  iconButton: { marginLeft: 8, backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  compactFiltersArea: { marginTop: 6 },
  horizontalRow: { alignItems: 'center' },
  filterChipSm: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, backgroundColor: '#fff' },
  filterChipSmActive: { borderColor: '#4CAF50', backgroundColor: '#e7f5e7' },
  filterTextSm: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTextSmActive: { color: '#2e7d32', fontWeight: '700' },
  employeeChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  employeeChipActive: { borderColor: '#4CAF50', backgroundColor: '#e7f5e7' },
  employeeChipText: { fontSize: 12, color: '#333', fontWeight: '600' },
  employeeChipTextActive: { color: '#2e7d32' },
  employeeChipCount: { fontSize: 12, color: '#666', marginLeft: 6 },
  deliveriesArea: { flex: 1 },
  mainList: { flex: 1 },
  printButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 3,
  },
  printButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    fontWeight: '500',
  },
  feedbackMsg: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },
  feedbackError: {
    color: '#d32f2f'
  },
  feedbackSuccess: {
    color: '#2e7d32'
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#f44336',
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingIcon: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 22,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mesaContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  mesaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  mesaItemsCount: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: 'bold',
  },
  itemContainer: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
    marginRight: 0,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  itemTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 10,
    gap: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  itemDetailsInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  inlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineTagHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  inlineTagText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  inlineDot: {
    fontSize: 12,
    color: '#94a3b8',
    marginHorizontal: 1,
  },
  obsInlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    gap: 4,
  },
  obsInlineText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitText: {
    marginLeft: 5,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 90,
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  readyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  advancedFilters: {
    marginHorizontal: 15,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee'
  },
  filtersLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  filterHint: { fontSize: 13, color: '#666', marginBottom: 6 },
  dateBox: { flex: 1, marginHorizontal: 4 },
  dateLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  employeeBox: { marginTop: 6 },
  searchLabel: { fontSize: 12, color: '#666' },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 6, backgroundColor: '#f9f9f9' },
  employeeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  employeeName: { marginLeft: 8, flex: 1, color: '#333' },
  employeeCount: { fontSize: 12, color: '#666' },
  filterChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#e7f5e7',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '700',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimensions.get('window').width < 768 ? 6 : 10,
    paddingVertical: Dimensions.get('window').width < 768 ? 4 : 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
    minWidth: Dimensions.get('window').width < 768 ? 50 : 90,
    justifyContent: 'center',
  },
  checkboxText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: Dimensions.get('window').width < 768 ? 10 : 13,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: '#e7f5e7',
    color: '#4CAF50',
  },
  statusReady: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32',
  },
  statusDelivered: {
    backgroundColor: '#e0e0e0',
    color: '#616161',
  },
  urgentLow: {
    backgroundColor: '#f1f8e9',
    borderColor: '#c5e1a5',
    borderWidth: 1,
  },
  urgentMedium: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
    borderWidth: 1,
  },
  urgentHigh: {
    backgroundColor: '#ffebee',
    borderColor: '#ef5350',
    borderWidth: 1,
  },
  setorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  setorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
});
