import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  useWindowDimensions,
  Switch
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Sale, CartItem, PaymentMethod } from '../types/index';
import { caixaService, saleService, companyService } from '../services/api';
import { events } from '../utils/eventBus';
import PixModal from './PixModal';
import CpfModal from './CpfModal';
import InfinitePayCardModal from './InfinitePayCardModal';
import { getInfinitePayEnabled, InfinitePayReturnData } from '../services/infinitePayService';
import { customerService } from '../services/api';

interface PaymentSplitModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
  onPaymentSuccess: (isFullPayment?: boolean, wantNfce?: boolean, pontosUsados?: number) => void;
}


interface ItemBalance {
  itemId: string;
  name: string;
  total: number;
  paid: number;
  remaining: number;
  fullyPaid: boolean;
}

export default function PaymentSplitModal({
  visible,
  sale,
  onClose,
  onPaymentSuccess
}: PaymentSplitModalProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;

  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');
  const [emitirNfce, setEmitirNfce] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);
  const [infinitePayCardModalVisible, setInfinitePayCardModalVisible] = useState(false);
  const [isInfinitePayActive, setIsInfinitePayActive] = useState(false);
  const [cpfModalVisible, setCpfModalVisible] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<(() => void) | null>(null);

  // Pontos
  const [pointsToUse, setPointsToUse] = useState(0);
  const [redemptionRule, setRedemptionRule] = useState<{points: number, value: number} | null>(null);

  useEffect(() => {
    companyService.get().then(res => {
      const p = Number(res.data.pontosParaResgate || 0);
      const v = Number(res.data.valorResgate || 0);
      if (p > 0 && v > 0) setRedemptionRule({ points: p, value: v });
    }).catch(() => {});
  }, []);


  // Efeito para fechar o modal se a venda for finalizada remotamente
  useEffect(() => {
    if (visible && sale && (sale as any).status === 'finalizada') {
      Alert.alert('Aviso', 'Esta venda foi finalizada.');
      onClose();
    }
    if (visible) {
      setEmitirNfce(false);
      getInfinitePayEnabled().then(setIsInfinitePayActive).catch(() => {});
    }
  }, [sale, visible]);

  // Polling de segurança para garantir atualização da venda no Desktop/Tablet
  useEffect(() => {
    if (!visible || !isTablet || !sale) return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const saleId = (sale as any).id || sale._id;
        if (!saleId) return;
        
        // Chamada direta para obter estado mais recente
        const response = await saleService.getById(saleId);
        const updatedSale = response.data;
        
        // Comparar se houve mudança relevante (pagamentos ou status)
        const currentPaid = (sale as any)?.caixaVendas?.length || 0;
        const newPaid = (updatedSale as any)?.caixaVendas?.length || 0;
        
        const currentStatus = sale.status;
        const newStatus = updatedSale.status;
        
        if (newPaid !== currentPaid || newStatus !== currentStatus) {
           console.log('🔄 Polling: Mudança detectada na venda. Forçando refresh.');
           // Emitir evento que o SaleScreen escuta (ou deveria escutar)
           // Assumindo que SaleScreen tem listener para 'sale:update' via WS, podemos simular um via EventBus
           // Mas o SaleScreen atual usa WS direto. Vamos usar o reload manual se tivermos acesso a função de reload... não temos.
           // Melhor: emitir evento na eventBus e garantir que SaleScreen ouça a eventBus também.
           
           events.emit('sale:polling-update', updatedSale);
        }
      } catch {}
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [visible, isTablet, sale]);

  const paymentMethods: PaymentMethod[] = [
    { key: 'dinheiro', label: 'Dinheiro', icon: 'cash' },
    { key: 'cartao', label: 'Cartão', icon: 'card' },
    { key: 'pix', label: 'PIX', icon: 'phone-portrait' },
    { key: 'cashback', label: 'Cashback', icon: 'gift' },
  ];

  // Total da venda
  const totalSale = useMemo(() => {
    // Calculate verified total
    const subtotal = sale?.itens ? sale.itens.reduce((acc, item) => acc + Number(item.subtotal), 0) : 0;
    const fee = Number(sale?.deliveryFee || 0);
    const discount = Number(sale?.desconto || 0);
    
    const calculated = subtotal + fee - discount;
    const stored = Number(sale?.total || 0);

    // If stored seems valid (close to calculated), use it. 
    // If stored is just the fee (and we have items), or stored is 0, use calculated.
    if (stored > 0 && Math.abs(stored - calculated) < 0.1) return stored;
    
    if (stored > 0 && Math.abs(stored - fee) < 0.1 && subtotal > 0) return calculated; 

    return calculated > 0 ? calculated : stored;
  }, [sale]);

  // Cálculo robusto do Total Pago
  const totalPaidGlobal = useMemo(() => {
    if (!sale) return 0;

    // 1. Total pelos registros financeiros (CaixaVenda)
    const financialTotal = (sale as any)?.caixaVendas 
      ? (sale as any).caixaVendas.reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0)
      : 0;

    // 2. Total pelo status físico dos itens
    // Item marcado como 'pago' conta como totalmente pago, independente de haver registro no caixa
    let itemsPaidTotal = 0;
    
    // Mapeia pagamentos parciais para evitar contagem duplicada ou incorreta
    const paidMap = new Map<string, number>();
    if (sale.caixaVendas && Array.isArray(sale.caixaVendas)) {
      sale.caixaVendas.forEach((cv: any) => {
        let pagos: any[] = [];
        if (Array.isArray(cv.itensPagos)) pagos = cv.itensPagos;
        else if (typeof cv.itensPagos === 'string') { try { pagos = JSON.parse(cv.itensPagos); } catch{} }
        
        pagos.forEach((p: any) => {
          const pid = String(p.id);
          const val = Number(p.paidAmount) || 0;
          paidMap.set(pid, (paidMap.get(pid) || 0) + val);
        });
      });
    }

    if (sale.itens) {
      sale.itens.forEach((item: CartItem) => {
         const itemId = String(item._id || (item as any).id);
         const subtotal = Number(item.subtotal);
         const isStatusPaid = (item as any).status === 'pago';
         
         if (isStatusPaid) {
           // Se está pago no status, consideramos o subtotal cheio
           itemsPaidTotal += subtotal;
         } else {
           // Se não está pago, conta apenas o parcial registrado
           itemsPaidTotal += (paidMap.get(itemId) || 0);
         }
      });
    }

    // Retorna o maior valor para garantir que se o item está 'pago', o valor reflete isso
    // Mesmo que o registro financeiro tenha se perdido ou não exista.
    // Mas também respeita pagamentos genéricos se financialTotal for maior.
    return Math.max(financialTotal, itemsPaidTotal);

  }, [sale]);

  // Garante que não fica negativo por arredondamento
  const totalRemainingGlobal = Math.max(0, totalSale - totalPaidGlobal);

  const itemBalances = useMemo(() => {
    if (!sale || !sale.itens) return [];

    // Mapa de quanto já foi pago por item (somando parciais explícitos)
    const paidMap = new Map<string, number>();

    // Iterar sobre pagamentos registrados no CaixaVenda
    if (sale.caixaVendas && Array.isArray(sale.caixaVendas)) {
      sale.caixaVendas.forEach((cv: any) => {
        let pagos: any[] = [];
        if (Array.isArray(cv.itensPagos)) {
          pagos = cv.itensPagos;
        } else if (typeof cv.itensPagos === 'string') {
          try {
             const parsed = JSON.parse(cv.itensPagos);
             if (Array.isArray(parsed)) pagos = parsed;
          } catch {}
        }
        pagos.forEach((p: any) => {
          const pid = String(p.id);
          const current = paidMap.get(pid) || 0;
          paidMap.set(pid, current + (Number(p.paidAmount) || 0));
        });
      });
    }

    // Calcula o total que AINDA FALTA pagar somando todos os itens
    // Para detectar se há discrepância (itens dizem que falta X, mas comanda diz que falta Y < X)
    let sumItemRemaining = 0;
    
    const itemsRaw = sale.itens.map((item: CartItem) => {
      const itemId = String(item._id || (item as any).id);
      const isStatusPaid = (item as any).status === 'pago';
      const partialPaid = paidMap.get(itemId) || 0;
      const total = Number(item.subtotal);
      
      const paid = isStatusPaid ? total : Math.min(partialPaid, total);
      const remaining = Math.max(0, total - paid);
      
      sumItemRemaining += remaining;
      
      return {
        itemId,
        name: item.nomeProduto,
        total,
        paid,
        remaining,
        fullyPaid: isStatusPaid || remaining < 0.05
      };
    });

    // Add Delivery Fee as Item if applicable
    const fee = Number(sale.deliveryFee || 0);
    if (fee > 0) {
        const feeId = 'delivery-fee';
        const feePaid = paidMap.get(feeId) || 0;
        const feeRemaining = Math.max(0, fee - feePaid);
        
        itemsRaw.push({
            itemId: feeId,
            name: 'Taxa de Entrega',
            total: fee,
            paid: feePaid,
            remaining: feeRemaining,
            fullyPaid: feeRemaining < 0.05
        });
    }

    // CORREÇÃO CRÍTICA:
    // Se a soma do restante dos itens (sumItemRemaining) for MAIOR que o restante global da venda (totalRemainingGlobal),
    // significa que houve pagamentos genéricos (não vinculados a itens) amortizando a dívida.
    // Nesse caso, o usuário vê itens "em aberto" que, na verdade, já estão pagos financeiramente.
    // Vamos distribuir esse "crédito genérico" para abater visualmente os itens restantes,
    // começando pelos primeiros da lista, para evitar o bloqueio de "Valores > Falta".
    
    if (sumItemRemaining > totalRemainingGlobal + 0.05) {
      let excessPayment = sumItemRemaining - totalRemainingGlobal;
      
      // Itera novamente aplicando o desconto do excesso
      return itemsRaw.map(i => {
         if (i.fullyPaid) return i;
         if (excessPayment <= 0.01) return i;

         // Abate do item atual
         const discount = Math.min(i.remaining, excessPayment);
         const newPaid = i.paid + discount;
         const newRemaining = i.remaining - discount;
         
         excessPayment -= discount;

         return {
           ...i,
           paid: newPaid,
           remaining: newRemaining,
           fullyPaid: newRemaining < 0.05 // Marca como pago se zerou
         };
      });
    }

    return itemsRaw;
  }, [sale, totalRemainingGlobal]); // Depende do totalRemainingGlobal agora
  


  const totalSelected = Array.from(selectedItems.values()).reduce((acc, val) => acc + val, 0);

  // Valores simulados para exibição em tempo real
  // Fix: Clamping para não exibir valor pago maior que o total (incoerência visual)
  const currentPaidDisplay = Math.min(totalSale, totalPaidGlobal + totalSelected);
  const currentRemainingDisplay = Math.max(0, totalRemainingGlobal - totalSelected);

  useEffect(() => {
    if (visible) {
      setSelectedItems(new Map());
      setPaymentMethod('dinheiro');
    }
  }, [visible]);

  const toggleItem = (balance: ItemBalance) => {
    if (balance.fullyPaid) return; // Não permite selecionar se já pago

    // Optimistic Update: Atualiza estado imediatamente
    const currentMap = new Map(selectedItems);
    if (currentMap.has(balance.itemId)) {
      currentMap.delete(balance.itemId);
    } else {
      currentMap.set(balance.itemId, balance.remaining);
    }
    setSelectedItems(currentMap);
  };

  const updateAmount = (itemId: string, text: string) => {
    const balance = itemBalances.find(i => i.itemId === itemId);
    if (!balance) return;

    // Normalizar entrada (vírgula para ponto)
    let val = parseFloat(text.replace(',', '.'));
    if (isNaN(val)) val = 0;
    
    // Validar máximo (não pagar mais que o restante)
    if (val > balance.remaining) val = balance.remaining;
    if (val < 0) val = 0;

    const newMap = new Map(selectedItems);
    newMap.set(itemId, val); 
    setSelectedItems(newMap);
  };

  // Função central desvinculada do botão para permitir reuso (ex: pós-PIX ou pós-InfinitePay)
  const submitPayment = async (extraPaymentInfo?: any) => {
    if (!sale) {
        Alert.alert('Erro', 'Venda não identificada.');
        return;
    }
    
    // Validar Saldo de Cashback
    if (paymentMethod === 'cashback' && sale.cliente) {
        const saldo = Number(sale.cliente.saldoCashback || 0);
        // totalSelected inclui a soma dos inputs. 
        // Descontamos pontos se houver (discountPoints não é subtraido do totalSelected aqui, mas do totalAmount enviado ao backend)
        // O usuário digita o 'valor a pagar'.
        
        if (totalSelected > saldo) {
             Alert.alert('Saldo Insuficiente', `O valor selecionado (R$ ${totalSelected.toFixed(2)}) excede o saldo de cashback do cliente (R$ ${saldo.toFixed(2)}).`);
             return;
        }
    }
    
    try {
      setLoading(true);

      const saleId = (sale as any).id || (sale as any)._id; // Fallback seguro

      // 2. Registrar metadados de pagamento na Venda
      const itemsPayload = Array.from(selectedItems.entries()).map(([id, amount]) => {
        const balance = itemBalances.find(i => i.itemId === id);
        // Verifica se pagou tudo que faltava (com tolerância)
        const finished = balance ? (Math.abs(balance.remaining - amount) < 0.05) : false;
        return {
          id,
          paidAmount: amount, // O valor nominal pago (incluindo pontos)
          fullyPaid: finished
        };
      });

      const discountPoints = redemptionRule && pointsToUse > 0 
           ? (pointsToUse / redemptionRule.points) * redemptionRule.value 
           : 0;

      await saleService.payItems(saleId, {
        paymentInfo: {
          method: paymentMethod,
          totalAmount: Math.max(0, totalSelected - discountPoints), // Cobra apenas o que sobrou
          ...(extraPaymentInfo || {})
        },
        items: itemsPayload
      });

      // Verificar se o pagamento quita a dívida total (com tolerância)
      // totalRemainingGlobal = O que faltava.
      // totalSelected = O que estamos abatendo agora (seja com dinheiro ou pontos)
      const isFullPayment = (totalRemainingGlobal - totalSelected) <= 0.05;

      console.log('✅ Pagamento Confirmado. Full?', isFullPayment, 'Pontos:', pointsToUse);

      // Limpar seleção
      setSelectedItems(new Map());
      setPointsToUse(0); // Resetar pontos após uso

      // Notificar sucesso (callback crítico para fechar modais)
      onPaymentSuccess(isFullPayment, emitirNfce, pointsToUse);

      // Feedback visual
      if (!isFullPayment) {
          if (Platform.OS === 'web') {
            setTimeout(() => window.alert('Pagamento registrado!'), 100);
          } else {
            Alert.alert('Sucesso', 'Pagamento registrado!');
          }
      }

    } catch (error: any) {
      console.error('Erro ao processar pagamento split:', error);
      Alert.alert('Erro', error?.response?.data?.error || 'Falha ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  // Processar retorno do CpfModal
  const handleCpfConfirm = async (customerData: any) => {
      setCpfModalVisible(false);
      setLoading(true);

      try {
          let clienteId = customerData.id;
          const cpfRaw = customerData.cpf ? String(customerData.cpf).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';

          // 1. Se não veio ID mas tem CPF/CNPJ, tenta buscar primeiro (Evita erro de duplicação se usuario clicou rapido)
          if (!clienteId && cpfRaw.length >= 11) {
              try {
                  const searchRes = await customerService.getByCpf(cpfRaw);
                  if (searchRes.data && searchRes.data.id) {
                      clienteId = searchRes.data.id;
                      // Atualizar dados se necessário?
                      // Se achou, usamos o ID e atualizamos nome/endereço fornecidos
                  }
              } catch (e) {
                  // Não achou, segue para create
              }
          }

          // 2. Se ainda não tem ID, cria
          if (!clienteId) {
             try {
                 const createRes = await customerService.create({
                     nome: customerData.nome,
                     endereco: customerData.endereco,
                     cpf: customerData.cpf,
                     ativo: true
                 });
                 clienteId = createRes.data?.customer?.id || createRes.data?.id;
             } catch (createErr: any) {
                 // 3. Se deu erro de CPF já existente (400), tentamos buscar novamente (Caso extremo)
                 if (createErr.response?.data?.error === 'CPF já cadastrado' || String(createErr).includes('CPF')) {
                     const retrySearch = await customerService.getByCpf(cpfRaw);
                     if (retrySearch.data?.id) clienteId = retrySearch.data.id;
                 } else {
                     throw createErr;
                 }
             }
          } else {
             // 4. Se já tinha ID (ou achou no passo 1), atualiza dados
             try {
                await customerService.update(clienteId, {
                    nome: customerData.nome,
                    endereco: customerData.endereco,
                    cpf: customerData.cpf
                });
             } catch (e) {
                console.warn('Erro ao atualizar dados do cliente existente no modal:', e);
             }
          }

          // 5. Vincula à venda
          if (clienteId && sale) {
              const saleId = (sale as any).id || (sale as any)._id;
              await saleService.update(saleId, { clienteId });
              console.log("Cliente vinculado com sucesso. ID:", clienteId);
          } else {
              if (Platform.OS === 'web') window.alert('Erro: Cliente não identificado para vínculo.');
              else Alert.alert('Erro', 'Cliente não identificado.');
          }

      } catch (error) {
          console.error("Erro ao vincular cliente:", error);
          if (Platform.OS === 'web') window.alert('Erro ao vincular cliente. A venda seguirá como Consumidor Final.');
          else Alert.alert('Aviso', 'Não foi possível vincular o cliente. Seguiremos sem CPF.');
      } finally {
          setLoading(false);
          // Executa a ação pendente
          if (pendingConfirmAction) {
              pendingConfirmAction();
              setPendingConfirmAction(null);
          }
      }
  };

  const handleCpfClose = async () => {
      setCpfModalVisible(false);
      // Se "Não usar", desvincular qualquer cliente que esteja na venda para ser Consumidor Final
      if (sale && (sale as any).clienteId) {
          try {
              const saleId = (sale as any).id || (sale as any)._id;
              // Passar null desvincula
              await saleService.update(saleId, { clienteId: null });
          } catch(e) {
              console.error('Erro ao desvincular cliente:', e);
          }
      }

      if (pendingConfirmAction) {
          pendingConfirmAction();
          setPendingConfirmAction(null);
      }
  };

  const executeConfirmLogic = async () => {
       // Se já está tudo pago, o botão serve para fechar/finalizar
      const isEverythingPaid = totalRemainingGlobal <= 0.05;

      if (totalSelected <= 0.01 && !isEverythingPaid) {
        Alert.alert('Atenção', 'Selecione e informe valores para os itens que deseja pagar.');
        return;
      }

      // Se tudo pago e nada selecionado, apenas confirma o sucesso para fechar
      if (isEverythingPaid && totalSelected <= 0.01) {
          onPaymentSuccess(true, emitirNfce);
          return;
      }

      // Intercept PIX payment
      if (paymentMethod === 'pix' && totalSelected > 0.05) {
          setPixAmount(totalSelected);
          setPixModalVisible(true);
          return; 
      }

      // Intercept Cartão InfinitePay se habilitado neste dispositivo
      if (paymentMethod === 'cartao' && isInfinitePayActive && totalSelected > 0.05) {
          setInfinitePayCardModalVisible(true);
          return;
      }

      await submitPayment();
  };

  const handleInfinitePaySuccess = async (returnData?: InfinitePayReturnData) => {
    setInfinitePayCardModalVisible(false);
    await submitPayment({
      nsu: returnData?.transactionNsu,
      autorizacao: returnData?.authCode,
      bandeira: returnData?.cardBrand,
      origem: 'infinitepay_tap'
    });
  };

  const handleInfinitePayManual = async () => {
    setInfinitePayCardModalVisible(false);
    await submitPayment();
  };

  const handleConfirm = async () => {
    if (!sale) return;
    
    // A pedido do usuário: REGRA SIMPLES.
    // Se clicou em confirmar pagamento e "Emitir NFC-e" está marcado, 
    // apenas abra a modal de fiscal (que é controlada pelo pai através do onPaymentSuccess).
    const isEverythingPaid = totalRemainingGlobal <= 0.05;
    const isPayingRest = (totalSelected >= totalRemainingGlobal - 0.05);
    const willFinalize = isEverythingPaid || isPayingRest;

    if (emitirNfce && willFinalize) {
        // Envia isFullPayment=true e wantNfce=true para forçar o pai a abrir a modal
        onPaymentSuccess(true, true, pointsToUse);
        return;
    }

    // Se NÃO for emitir NFC-e, segue o fluxo normal de pagamento
    if (willFinalize) {
        setPendingConfirmAction(() => executeConfirmLogic);
        setCpfModalVisible(true);
        return;
    }

    executeConfirmLogic();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, !isTablet && styles.containerMobile]}>
          <View style={styles.header}>
            <Text style={styles.title}>Divisão de Pagamento</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column', overflow: 'hidden' }}>
            {/* Coluna Esquerda: Lista de Itens (Altura Total) */}
            <View style={{ 
              flex: isTablet ? 0.58 : 1, 
              borderRightWidth: isTablet ? 1 : 0, 
              borderBottomWidth: isTablet ? 0 : 1,
              borderColor: '#e0e0e0', 
              display: 'flex', 
              flexDirection: 'column',
              backgroundColor: '#fff'
            }}>
                <View style={styles.leftColHeader}>
                    <Text style={styles.sectionTitle}>Selecione os itens a pagar:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={() => {
                        const all = new Map();
                        itemBalances.forEach(i => {
                          if (!i.fullyPaid) all.set(i.itemId, i.remaining);
                        });
                        setSelectedItems(all);
                      }}>
                        <Text style={{ color: '#2196F3', fontWeight: 'bold', fontSize: 13 }}>Selecionar Tudo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setSelectedItems(new Map())}>
                        <Text style={{ color: '#888', fontWeight: '600', fontSize: 13 }}>Limpar</Text>
                      </TouchableOpacity>
                    </View>
                </View>
                
                <ScrollView style={styles.list} contentContainerStyle={{ padding: 8 }}>
                    {itemBalances.map((item) => {
                      const isSelected = selectedItems.has(item.itemId);
                      const amount = selectedItems.get(item.itemId);
                      
                      if (item.fullyPaid) {
                        return (
                         <View key={item.itemId} style={[styles.itemRow, styles.itemPaid]}>
                           <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={{ marginRight: 8 }} />
                           <View style={{ flex: 1 }}>
                             <Text style={[styles.itemName, { color: '#666' }]}>{item.name}</Text>
                             <Text style={{ fontSize: 11, color: '#4CAF50' }}>Item totalmente quitado</Text>
                           </View>
                           <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#E8F5E9', borderRadius: 4 }}>
                              <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 11 }}>PAGO</Text>
                           </View>
                         </View>
                        );
                      }

                      return (
                        <View key={item.itemId} style={[styles.itemRow, isSelected && styles.itemSelected]}>
                          <TouchableOpacity 
                            style={styles.checkArea}
                            onPress={() => toggleItem(item)}
                          >
                            <Ionicons 
                              name={isSelected ? "checkbox" : "square-outline"} 
                              size={22} 
                              color={isSelected ? "#2196F3" : "#aaa"} 
                            />
                          </TouchableOpacity>
                          
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.itemSub}>
                              Total: R$ {item.total.toFixed(2)} | Falta: R$ {item.remaining.toFixed(2)}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={styles.inputContainer}>
                              <Text style={styles.currencySymbol}>R$</Text>
                              <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={amount !== undefined ? amount.toString() : ''}
                                onChangeText={(t) => updateAmount(item.itemId, t)}
                                selectTextOnFocus
                              />
                            </View>
                          ) : (
                            <Text style={styles.itemPrice}>R$ {item.remaining.toFixed(2)}</Text>
                          )}
                        </View>
                      );
                    })}
                </ScrollView>
            </View>

            {/* Coluna Direita: Resumo, Métodos de Pagamento e Confirmação */}
            <View style={{ 
              flex: isTablet ? 0.42 : 1, 
              backgroundColor: '#f8f9fa',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ padding: 12, gap: 10 }}
                showsVerticalScrollIndicator={true}
              >
                {/* Identificação de Mesa / Comanda / Cliente */}
                {sale && (
                  <View style={styles.contextCard}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                       {(sale as any).mesa && (
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                           <Ionicons name="restaurant-outline" size={15} color="#4CAF50" />
                           <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#2E7D32' }}>
                             Mesa {(sale as any).mesa.numero} {(sale as any).mesa.nomeResponsavel ? `- ${(sale as any).mesa.nomeResponsavel}` : ''}
                           </Text>
                         </View>
                       )}
                       {(sale as any).tipoVenda === 'comanda' && (
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                           <Ionicons name="receipt-outline" size={15} color="#FF9800" />
                           <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#E65100' }}>
                             Comanda {(sale as any).numeroComanda || (sale as any).codigo || ''} {(sale as any).nomeComanda ? `- ${(sale as any).nomeComanda}` : ''}
                           </Text>
                         </View>
                       )}
                       {sale.cliente && (
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                           <Ionicons name="person-circle-outline" size={15} color="#555" />
                           <Text style={{ fontSize: 13, color: '#444' }}>
                             Cliente: <Text style={{ fontWeight: 'bold' }}>{sale.cliente.nome}</Text>
                           </Text>
                         </View>
                       )}
                     </View>
                  </View>
                )}

                {/* Resumo de Totais da Venda */}
                <View style={styles.summaryBox}>
                    <View style={styles.rowBetween}>
                       <Text style={styles.label}>Total da Venda:</Text>
                       <Text style={styles.value}>R$ {totalSale.toFixed(2)}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                       <Text style={styles.label}>Já Pago:</Text>
                       <Text style={[styles.value, { color: '#4CAF50' }]}>R$ {currentPaidDisplay.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.rowBetween, { marginTop: 4, borderTopWidth: 1, borderColor: '#eee', paddingTop: 4 }]}>
                       <Text style={[styles.label, { fontWeight: 'bold' }]}>Restante Atual:</Text>
                       <Text style={[styles.value, { color: '#F44336', fontWeight: 'bold', fontSize: 16 }]}>R$ {currentRemainingDisplay.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Total Selecionado */}
                <View style={styles.totalBlock}>
                  <Text style={styles.totalLabel}>Total Selecionado:</Text>
                  <Text style={styles.totalValue}>R$ {totalSelected.toFixed(2)}</Text>
                </View>

                {/* Seção de Resgate de Pontos */}
                {redemptionRule && sale?.cliente && (sale.cliente.pontos || 0) >= redemptionRule.points && (
                   <View style={styles.pointsBox}>
                      <Text style={{ fontWeight: 'bold', color: '#E65100', marginBottom: 4, fontSize: 12 }}>
                          Resgate de Pontos 🎁
                      </Text>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ color: '#555', fontSize: 11 }}>Disp: {sale.cliente.pontos} pts</Text>
                          <Text style={{ color: '#555', fontSize: 11 }}>
                              {redemptionRule.points} pts = R$ {redemptionRule.value.toFixed(2)}
                          </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <TouchableOpacity 
                             style={{ padding: 6, backgroundColor: '#FFE0B2', borderRadius: 4 }}
                             onPress={() => setPointsToUse(Math.max(0, pointsToUse - redemptionRule.points))}
                          >
                              <Ionicons name="remove" size={18} color="#E65100" />
                          </TouchableOpacity>
                          
                          <View style={{ alignItems: 'center' }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#E65100' }}>{pointsToUse} pts</Text>
                              <Text style={{ fontSize: 11, color: '#E65100' }}>
                                - R$ {((pointsToUse / redemptionRule.points) * redemptionRule.value).toFixed(2)}
                              </Text>
                          </View>

                          <TouchableOpacity 
                             style={{ padding: 6, backgroundColor: '#FFE0B2', borderRadius: 4 }}
                             onPress={() => {
                                 const nextVal = pointsToUse + redemptionRule.points;
                                 const potentialDiscount = (nextVal / redemptionRule.points) * redemptionRule.value;
                                 if (nextVal > (sale.cliente?.pontos || 0)) return;
                                 if (potentialDiscount > totalRemainingGlobal + 0.05) return;
                                 setPointsToUse(nextVal);
                             }}
                          >
                              <Ionicons name="add" size={18} color="#E65100" />
                          </TouchableOpacity>
                      </View>
                   </View>
                )}

                {/* Métodos de Pagamento em Grid 2x2 */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>
                    Forma de Pagamento:
                  </Text>
                  <View style={styles.paymentMethodsGrid}>
                    {paymentMethods.map(method => (
                      <TouchableOpacity
                        key={method.key}
                        style={[
                          styles.methodButtonGrid,
                          paymentMethod === method.key && styles.methodButtonSelected
                        ]}
                        onPress={() => setPaymentMethod(method.key)}
                      >
                        <Ionicons 
                          name={method.icon} 
                          size={18} 
                          color={paymentMethod === method.key ? '#fff' : '#555'} 
                        />
                        <Text style={[
                            styles.methodTextGrid, 
                            paymentMethod === method.key && styles.methodTextSelected
                        ]}>
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Cashback informativo se selecionado */}
                {paymentMethod === 'cashback' && sale?.cliente && (
                   <View style={styles.cashbackBadge}>
                      <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 12 }}>Saldo Cashback Disponível:</Text>
                      <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 14 }}>
                          R$ {Number(sale.cliente.saldoCashback || 0).toFixed(2)}
                      </Text>
                   </View>
                )}
                
                {paymentMethod === 'cashback' && !sale?.cliente && (
                   <View style={styles.cashbackWarningBadge}>
                      <Text style={{ color: '#D32F2F', textAlign: 'center', fontSize: 12 }}>Venda sem cliente identificado.</Text>
                   </View>
                )}

                {/* Histórico de Pagamentos Recentes */}
                {(sale as any)?.caixaVendas && (sale as any).caixaVendas.length > 0 && (
                  <View style={styles.historyBox}>
                    <Text style={styles.historyTitle}>Histórico recente:</Text>
                    {(sale as any).caixaVendas.map((cv: any, idx: number) => (
                      <View key={idx} style={styles.historyRow}>
                         <Text style={styles.historyDesc}>
                           {new Date(cv.dataVenda).toLocaleTimeString().substring(0,5)} - {cv.formaPagamento.toUpperCase()}
                         </Text>
                         <Text style={styles.historyAmount}>
                           R$ {Number(cv.valor).toFixed(2)}
                         </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Rodapé Fixo da Coluna Direita: NFC-e e Confirmar Pagamento (Sempre Visível!) */}
              <View style={styles.rightFooterFixed}>
                {/* NFC-e Switch */}
                <View style={styles.nfceCard}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                     <Ionicons name="receipt-outline" size={18} color="#2196F3" />
                     <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>Emitir NFC-e (Cupom Fiscal)</Text>
                   </View>
                   <Switch
                     value={emitirNfce}
                     onValueChange={setEmitirNfce}
                     trackColor={{ false: "#ccc", true: "#2196F3" }}
                     thumbColor={"#fff"}
                     style={{ transform: Platform.OS === 'web' ? [{ scaleX: 0.85 }, { scaleY: 0.85 }] : [] }}
                   />
                </View>

                {/* Botão de Confirmação */}
                <TouchableOpacity
                  style={[
                    styles.confirmButton, 
                    ((totalSelected <= 0.01 && totalRemainingGlobal > 0.05) || loading) && styles.confirmButtonDisabled
                  ]}
                  onPress={handleConfirm}
                  disabled={((totalSelected <= 0.01 && totalRemainingGlobal > 0.05) || loading)}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                       {totalRemainingGlobal <= 0.05 ? 'Finalizar Venda' : 'Confirmar Pagamento'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
      <PixModal 
          visible={pixModalVisible}
          amount={pixAmount}
          transactionId={sale && ((sale as any).id || sale._id) ? `PEDIDO-${(sale as any).id || sale._id}` : undefined}
          onClose={() => setPixModalVisible(false)}
          onConfirm={() => {
              setPixModalVisible(false);
              // Proceder com a confirmação normal
              // O pagamento já foi feito "visualmente" no modal (QR Code), agora registramos no sistema.
              submitPayment();
          }}
      />

      <InfinitePayCardModal
          visible={infinitePayCardModalVisible}
          amount={totalSelected}
          orderId={sale && ((sale as any).id || sale._id) ? `PEDIDO-${(sale as any).id || sale._id}` : `VENDA-${Date.now()}`}
          onClose={() => setInfinitePayCardModalVisible(false)}
          onManualPayment={handleInfinitePayManual}
          onPaymentSuccess={handleInfinitePaySuccess}
      />
      
      <CpfModal
          visible={cpfModalVisible}
          onClose={handleCpfClose}
          onConfirm={handleCpfConfirm}
          initialData={sale && sale.cliente ? {
              id: (sale.cliente as any).id || (sale.cliente as any)._id,
              nome: sale.cliente.nome || '',
              cpf: (sale.cliente as any).cpf || '',
              endereco: (sale.cliente as any).endereco || ''
          } : undefined}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '95%',
    maxWidth: 980,
    height: '92%',
    maxHeight: 680,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  containerMobile: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  leftColHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  itemPaid: {
    backgroundColor: '#f9f9f9',
  },
  itemSelected: {
    backgroundColor: '#e3f2fd',
  },
  checkArea: {
    padding: 2,
    marginRight: 8,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemSub: {
    fontSize: 11,
    color: '#888',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
    width: 85,
  },
  currencySymbol: {
    color: '#666',
    marginRight: 2,
    fontSize: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 2,
    fontSize: 13,
    color: '#333',
  },
  contextCard: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  summaryBox: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: '#666',
    fontSize: 13,
  },
  value: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
  },
  totalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  totalLabel: {
    fontSize: 13,
    color: '#0D47A1',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 17,
    color: '#1565C0',
    fontWeight: 'bold',
  },
  pointsBox: {
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  methodButtonGrid: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    gap: 6,
  },
  methodButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  methodTextGrid: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  methodTextSelected: {
    color: '#fff',
  },
  cashbackBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  cashbackWarningBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  rightFooterFixed: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  nfceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyBox: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  historyDesc: {
    fontSize: 11,
    color: '#555',
  },
  historyAmount: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});
