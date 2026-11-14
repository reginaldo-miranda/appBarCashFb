import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Modal,
  Platform,
  TextInput
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { saleService, API_URL, caixaService, getWsUrl, mesaService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { SafeIcon } from '../../components/SafeIcon';

interface Sale {
  _id: string;
  id?: string | number;
  numeroComanda?: string;
  cliente?: { nome: string };
  nomeCliente?: string;
  consumidor?: { nome: string };
  nomeConsumidor?: string;
  nomeComanda?: string;
  tipoVenda: string;
  status: string;
  itens: {
    produto?: string;
    nomeProduto: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    _id: string;
  }[];
  mesa?: { _id?: string; numero?: string; nome?: string; funcionarioResponsavel?: { nome: string }; nomeResponsavel?: string };
  funcionario?: { nome: string };
  // Snapshots adicionados na finalização
  responsavelNome?: string; // cliente
  responsavelFuncionario?: string; // se existir, manter por compatibilidade
  funcionarioNome?: string; // funcionário que finalizou (compatibilidade)
  funcionarioId?: string;
  funcionarioAberturaNome?: string; // funcionário que abriu a mesa
  funcionarioAberturaId?: string;
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento?: string;
  createdAt: string;
  updatedAt: string;
}

interface CaixaVenda {
  venda: Sale;
  valor: number;
  formaPagamento: string;
  dataVenda: string;
}

export default function CaixaScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');

  const [caixaVendas, setCaixaVendas] = useState<CaixaVenda[]>([]);
  const [hasCaixaAberto, setHasCaixaAberto] = useState<boolean>(false);
  // Map de detalhes de mesa por venda._id (quando populate faltar)
  const [mesaInfoBySale, setMesaInfoBySale] = useState<Record<string, any>>({});
  // Filtro por data (padrão hoje)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [markFilter, setMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');
  const [paymentFilterWeb, setPaymentFilterWeb] = useState<'all' | 'dinheiro' | 'cartao' | 'pix'>('all');
  
  // Novo estado para filtro de exibição (Abertas vs Registradas vs Movimentações)
  const [displayFilter, setDisplayFilter] = useState<'all' | 'open' | 'registered' | 'movimentacoes'>('all');
  
  // Estado para armazenar informações do caixa (nome, id, etc)
  const [caixaInfo, setCaixaInfo] = useState<any>(null);

  // Estados das melhorias do Caixa (Opções 1, 2 e 3)
  const [mostrarValores, setMostrarValores] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modal Abrir Caixa
  const [abrirCaixaModalVisible, setAbrirCaixaModalVisible] = useState<boolean>(false);
  const [valorAberturaInput, setValorAberturaInput] = useState<string>('100,00');
  const [obsAberturaInput, setObsAberturaInput] = useState<string>('');

  // Modal Sangria / Suprimento
  const [movModalVisible, setMovModalVisible] = useState<boolean>(false);
  const [movTipo, setMovTipo] = useState<'sangria' | 'suprimento'>('sangria');
  const [movValorInput, setMovValorInput] = useState<string>('');
  const [movMotivoInput, setMovMotivoInput] = useState<string>('');

  // Modal Conferência e Fechamento de Caixa
  const [fecharCaixaModalVisible, setFecharCaixaModalVisible] = useState<boolean>(false);
  const [valorContadoInput, setValorContadoInput] = useState<string>('');
  const [obsFechamentoInput, setObsFechamentoInput] = useState<string>('');

  const showNotice = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const parseCurrencyInput = (raw: string): number => {
    if (!raw) return 0;
    const cleaned = String(raw).replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return Number.isFinite(val) ? val : 0;
  };

  const formatMoney = (val: number) => {
    const n = Number(val) || 0;
    if (!mostrarValores) return 'R$ ••••';
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  };

  const formatMoneyPlain = (val: number) => {
    const n = Number(val) || 0;
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  };

  // Totais do Caixa Aberto (Turno Atual)
  const valorAberturaTurno = Number(caixaInfo?.valorAbertura || 0);
  const movimentacoesTurno: any[] = Array.isArray(caixaInfo?.movimentacoes) ? caixaInfo.movimentacoes : [];
  const totalSuprimentosTurno = movimentacoesTurno
    .filter((m) => m.tipo === 'suprimento')
    .reduce((acc, m) => acc + Number(m.valor || 0), 0);
  const totalSangriasTurno = movimentacoesTurno
    .filter((m) => m.tipo === 'sangria')
    .reduce((acc, m) => acc + Number(m.valor || 0), 0);

  const turnoTotalsByMethod = caixaVendas.reduce(
    (acc, cv) => {
      const m = String(cv.formaPagamento || '').toLowerCase();
      const v = Number(cv.valor ?? cv.venda?.total ?? 0) || 0;
      acc.total += v;
      if (m === 'dinheiro') acc.dinheiro += v;
      else if (m === 'cartao' || m === 'cartão') acc.cartao += v;
      else if (m === 'pix') acc.pix += v;
      else acc.outros += v;
      return acc;
    },
    { total: 0, dinheiro: 0, cartao: 0, pix: 0, outros: 0 }
  );

  const totalDinheiroTurno = caixaVendas.length > 0 ? turnoTotalsByMethod.dinheiro : Number(caixaInfo?.totalDinheiro || 0);
  const totalCartaoTurno = caixaVendas.length > 0 ? turnoTotalsByMethod.cartao : Number(caixaInfo?.totalCartao || 0);
  const totalPixTurno = caixaVendas.length > 0 ? turnoTotalsByMethod.pix : Number(caixaInfo?.totalPix || 0);
  const totalVendasTurno = caixaVendas.length > 0 ? turnoTotalsByMethod.total : Number(caixaInfo?.totalVendas || 0);
  const saldoEsperadoGaveta = Number(
    (valorAberturaTurno + totalDinheiroTurno + totalSuprimentosTurno - totalSangriasTurno).toFixed(2)
  );
  const valorContadoNum = parseCurrencyInput(valorContadoInput);
  const diferencaFechamento = Number((valorContadoNum - saldoEsperadoGaveta).toFixed(2));

  // Helpers e cálculos para filtro por data e subtotais
  const formatSelectedDate = selectedDate.toLocaleDateString('pt-BR');
  const prevDay = () => setSelectedDate((d: Date) => new Date(d.getTime() - 86400000));
  const nextDay = () => setSelectedDate((d: Date) => new Date(d.getTime() + 86400000));

  const filteredCaixaVendas: CaixaVenda[] = caixaVendas.filter((cv: CaixaVenda) => {
    const dv = new Date(cv.dataVenda || cv.venda?.createdAt);
    const matchDate = dv.toDateString() === selectedDate.toDateString();

    if (!matchDate) return false;

    if (Platform.OS !== 'web') {
      return true;
    }

    const isMarked = !!marks[saleKey(cv.venda)];
    const matchMark =
      markFilter === 'all' ||
      (markFilter === 'marked' ? isMarked : !isMarked);

    const method = String(cv.formaPagamento || '').toLowerCase();
    const matchPayment =
      paymentFilterWeb === 'all' || method === paymentFilterWeb;

    return matchMark && matchPayment;
  });

  const paymentTotals: Record<string, number> = filteredCaixaVendas.reduce((acc: Record<string, number>, cv: CaixaVenda) => {
    const m = String(cv.formaPagamento || '').toLowerCase();
    const v = Number(cv.valor ?? cv.venda?.total ?? 0);
    acc[m] = (acc[m] || 0) + v;
    return acc;
  }, {} as Record<string, number>);

  const selectedTotal = filteredCaixaVendas.reduce((acc, cv) => {
    if (marks[saleKey(cv.venda)]) {
      return acc + (Number(cv.valor) || 0);
    }
    return acc;
  }, 0);

  const formatMethodLabel = (m: string) => {
    const cleaned = (m || '').trim();
    if (!cleaned) return 'Indefinido';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const loadVendas = React.useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando vendas abertas do Caixa...');
      console.log('🔗 API_URL:', API_URL);

      const response = await saleService.open();
      const abertas = response.data || [];
      console.log('✅ Vendas abertas carregadas:', abertas);

      if (Array.isArray(abertas) && abertas.length > 0) {
        setVendas(abertas);
        console.log(`📊 ${abertas.length} vendas abertas encontradas`);
      } else {
        console.log('⚠️ Nenhuma venda com status "aberta". Tentando fallback status="aberto"...');
        const respFallback = await saleService.list({ status: 'aberto' });
        const abertasFallback = respFallback.data || [];
        console.log('✅ Fallback vendas abertas (status="aberto"):', abertasFallback);
        setVendas(abertasFallback);
        console.log(`📊 ${abertasFallback.length} vendas (status="aberto") encontradas`);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar vendas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as vendas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCaixaAberto = React.useCallback(async () => {
    try {
      console.log('🔄 Buscando caixa aberto e vendas registradas...');
      const resp = await caixaService.statusAberto();
      const caixaData = resp.data;
      setHasCaixaAberto(true);
      setCaixaInfo(caixaData);

      const vendasRegistradas: CaixaVenda[] = (caixaData?.vendas || []).map((v: any) => ({
        venda: v.venda,
        valor: v.valor,
        formaPagamento: v.formaPagamento,
        dataVenda: v.dataVenda,
      }));
      setCaixaVendas(vendasRegistradas);
      console.log(`🧾 ${vendasRegistradas.length} vendas registradas no caixa aberto`);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.log('ℹ️ Nenhum caixa aberto no momento.');
        setHasCaixaAberto(false);
        setCaixaVendas([]);
        setCaixaInfo(null);
      } else {
        console.error('❌ Erro ao buscar caixa aberto:', error);
      }
    }
  }, []);

  // Atualizações sem spinner para evitar flicker
  const softRefreshVendas = async () => {
    try {
      const response = await saleService.open();
      const abertas = response.data || [];
      setVendas((prev) => {
        const byId = new Map<string, any>();
        prev.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
        abertas.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
        return Array.from(byId.values());
      });
    } catch {}
  };

  const softRefreshCaixa = async () => {
    try {
      const resp = await caixaService.statusAberto();
      const caixaData = resp.data;
      setHasCaixaAberto(true);
      setCaixaInfo(caixaData);
      const vendasRegistradas: CaixaVenda[] = (caixaData?.vendas || []).map((v: any) => ({
        venda: v.venda,
        valor: v.valor,
        formaPagamento: v.formaPagamento,
        dataVenda: v.dataVenda,
      }));
      setCaixaVendas(vendasRegistradas);
    } catch {}
  };

  const handleAbrirCaixa = async () => {
    try {
      setActionLoading(true);
      const valorInicial = parseCurrencyInput(valorAberturaInput);
      const funcId = (user as any)?.funcionarioId || (user as any)?.id || 1;
      await caixaService.abrir(funcId, valorInicial, obsAberturaInput.trim());
      setAbrirCaixaModalVisible(false);
      setObsAberturaInput('');
      await loadCaixaAberto();
      events.emit('caixa:refresh');
      showNotice('Caixa Aberto', `Caixa iniciado com troco de ${formatMoneyPlain(valorInicial)}.`);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Erro ao abrir caixa';
      showNotice('Erro', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const abrirModalMovimentacao = (tipo: 'sangria' | 'suprimento') => {
    setMovTipo(tipo);
    setMovValorInput('');
    setMovMotivoInput('');
    setMovModalVisible(true);
  };

  const handleConfirmarMovimentacao = async () => {
    const val = parseCurrencyInput(movValorInput);
    if (val <= 0) {
      showNotice('Valor inválido', 'Informe um valor maior que R$ 0,00.');
      return;
    }
    try {
      setActionLoading(true);
      const operadorNome = (user as any)?.nome || (user as any)?.name || caixaInfo?.funcionarioAbertura?.nome || 'Administrador';
      await caixaService.adicionarMovimentacao({
        caixaId: caixaInfo?.id,
        tipo: movTipo,
        valor: val,
        motivo: movMotivoInput.trim() || (movTipo === 'sangria' ? 'Sangria de caixa' : 'Suprimento de troco'),
        funcionarioNome: operadorNome,
      });
      setMovModalVisible(false);
      setMovValorInput('');
      setMovMotivoInput('');
      await loadCaixaAberto();
      showNotice(
        movTipo === 'sangria' ? 'Sangria Registrada' : 'Suprimento Registrado',
        `${movTipo === 'sangria' ? 'Retirada' : 'Entrada'} de ${formatMoneyPlain(val)} lançada com sucesso!`
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Erro ao registrar movimentação';
      showNotice('Erro', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoverMovimentacao = async (mov: any) => {
    const confirmar = async () => {
      try {
        await caixaService.removerMovimentacao(mov.id);
        await loadCaixaAberto();
      } catch (error: any) {
        showNotice('Erro', error?.response?.data?.message || 'Não foi possível excluir a movimentação');
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Deseja remover este lançamento de ${mov.tipo} (${formatMoneyPlain(mov.valor)})?`)) {
        await confirmar();
      }
    } else {
      Alert.alert(
        'Remover Lançamento',
        `Deseja remover este lançamento de ${mov.tipo} (${formatMoneyPlain(mov.valor)})?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Remover', style: 'destructive', onPress: confirmar },
        ]
      );
    }
  };

  const abrirModalFecharCaixa = () => {
    setValorContadoInput(saldoEsperadoGaveta.toFixed(2).replace('.', ','));
    setObsFechamentoInput('');
    setFecharCaixaModalVisible(true);
  };

  const handleImprimirResumoCaixa = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const dataAbr = caixaInfo?.dataAbertura ? new Date(caixaInfo.dataAbertura).toLocaleString('pt-BR') : '--';
      const agoraStr = new Date().toLocaleString('pt-BR');
      const opNome = caixaInfo?.funcionarioAbertura?.nome || (user as any)?.nome || 'Administrador';
      const diffTxt =
        diferencaFechamento === 0
          ? 'BATEU EXATO (R$ 0,00)'
          : diferencaFechamento > 0
          ? `SOBRA (+${formatMoneyPlain(diferencaFechamento)})`
          : `FALTA (${formatMoneyPlain(diferencaFechamento)})`;

      const movRowsHtml =
        movimentacoesTurno.length === 0
          ? '<tr><td colspan="3" style="text-align:center;color:#666;">Nenhuma sangria/suprimento</td></tr>'
          : movimentacoesTurno
              .map((m) => {
                const hr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const sinal = m.tipo === 'suprimento' ? '+' : '-';
                return `<tr>
                  <td>${hr} - ${m.tipo.toUpperCase()}</td>
                  <td>${m.motivo || ''}</td>
                  <td style="text-align:right;font-weight:bold;">${sinal} ${formatMoneyPlain(m.valor)}</td>
                </tr>`;
              })
              .join('');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Resumo de Caixa #${caixaInfo?.id || ''}</title>
  <style>
    body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 12px; color: #000; font-size: 12px; }
    h2, h3 { text-align: center; margin: 4px 0; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .bold { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 2px 0; vertical-align: top; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h2>FECHAMENTO / RESUMO DE CAIXA</h2>
  <h3>Caixa #${caixaInfo?.id || ''}</h3>
  <div class="line"></div>
  <div class="row"><span>Abertura:</span><span>${dataAbr}</span></div>
  <div class="row"><span>Emissão:</span><span>${agoraStr}</span></div>
  <div class="row"><span>Operador:</span><span>${opNome}</span></div>
  <div class="line"></div>
  <div class="bold" style="margin-bottom:4px;">CONFERENCIA DA GAVETA (ESPECIE)</div>
  <div class="row"><span>(+) Troco Inicial:</span><span>${formatMoneyPlain(valorAberturaTurno)}</span></div>
  <div class="row"><span>(+) Vendas Dinheiro:</span><span>${formatMoneyPlain(totalDinheiroTurno)}</span></div>
  <div class="row"><span>(+) Suprimentos:</span><span>${formatMoneyPlain(totalSuprimentosTurno)}</span></div>
  <div class="row"><span>(-) Sangrias:</span><span>${formatMoneyPlain(totalSangriasTurno)}</span></div>
  <div class="line"></div>
  <div class="row bold" style="font-size:13px;"><span>(=) SALDO ESPERADO:</span><span>${formatMoneyPlain(saldoEsperadoGaveta)}</span></div>
  <div class="row"><span>Valor Contado:</span><span>${formatMoneyPlain(valorContadoNum)}</span></div>
  <div class="row bold"><span>Diferenca:</span><span>${diffTxt}</span></div>
  <div class="line"></div>
  <div class="bold" style="margin-bottom:4px;">FATURAMENTO POR FORMA DE PAGTO</div>
  <div class="row"><span>Dinheiro:</span><span>${formatMoneyPlain(totalDinheiroTurno)}</span></div>
  <div class="row"><span>Cartao:</span><span>${formatMoneyPlain(totalCartaoTurno)}</span></div>
  <div class="row"><span>PIX:</span><span>${formatMoneyPlain(totalPixTurno)}</span></div>
  <div class="row bold" style="font-size:13px;"><span>TOTAL VENDAS (${caixaVendas.length}):</span><span>${formatMoneyPlain(totalVendasTurno)}</span></div>
  <div class="line"></div>
  <div class="bold" style="margin-bottom:4px;">SANGRIAS E SUPRIMENTOS</div>
  <table>${movRowsHtml}</table>
  <div class="line"></div>
  <p style="text-align:center;margin-top:24px;">_______________________________<br/>Assinatura Responsável</p>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
      const win = window.open('', '_blank', 'width=420,height=680');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        showNotice('Aviso', 'Permita pop-ups no navegador para imprimir o resumo.');
      }
    } else {
      showNotice(
        'Resumo do Turno',
        `Troco Inicial: ${formatMoneyPlain(valorAberturaTurno)}\nVendas Dinheiro: ${formatMoneyPlain(totalDinheiroTurno)}\nSuprimentos: ${formatMoneyPlain(totalSuprimentosTurno)}\nSangrias: ${formatMoneyPlain(totalSangriasTurno)}\nSaldo na Gaveta: ${formatMoneyPlain(saldoEsperadoGaveta)}\nTotal Vendas: ${formatMoneyPlain(totalVendasTurno)}`
      );
    }
  };

  const handleConfirmarFechamentoCaixa = async () => {
    if (!caixaInfo?.id) return;
    try {
      setActionLoading(true);
      const funcId = (user as any)?.funcionarioId || (user as any)?.id || 1;
      const resumoObs = [
        obsFechamentoInput.trim(),
        `[Conferência: Esperado ${formatMoneyPlain(saldoEsperadoGaveta)} | Contado ${formatMoneyPlain(valorContadoNum)} | Dif: ${formatMoneyPlain(diferencaFechamento)}]`,
      ]
        .filter(Boolean)
        .join(' ');

      await caixaService.fechar(caixaInfo.id, funcId, valorContadoNum, resumoObs);
      setFecharCaixaModalVisible(false);
      setObsFechamentoInput('');
      await loadCaixaAberto();
      events.emit('caixa:refresh');
      showNotice('Caixa Fechado', 'O turno do caixa foi encerrado e salvo com sucesso!');
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Erro ao fechar caixa';
      showNotice('Erro', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const calcularTotal = (venda: Sale) => {
    return venda.itens.reduce((total, item) => {
      return total + (item.precoUnitario * item.quantidade);
    }, 0);
  };

  const finalizarVenda = async () => {
    if (!selectedSale) return;

    try {
      console.log('🔄 Finalizando venda:', selectedSale._id);
      console.log('💳 Método de pagamento:', paymentMethod);

      const response = await saleService.finalize(selectedSale._id, {
        formaPagamento: paymentMethod
      });

      console.log('✅ Venda finalizada com sucesso:', response);
      
      Alert.alert('Sucesso', 'Venda finalizada com sucesso!');
      setModalVisible(false);
      setSelectedSale(null);
      await loadVendas(); // Recarregar a lista
      await loadCaixaAberto(); // Atualizar vendas registradas no caixa
      
    } catch (error: any) {
      console.error('❌ Erro ao finalizar venda:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error.response) {
        errorMessage = error.response.data?.error || `Erro ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erro', `Não foi possível finalizar a venda: ${errorMessage}`);
    }
  };

  const abrirModalFinalizacao = (venda: Sale) => {
    setSelectedSale(venda);
    setPaymentMethod('dinheiro');
    setModalVisible(true);
  };

  const persistMarks = (next: Record<string, boolean>) => {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem('caixaMarks', JSON.stringify(next));
      } catch (e) {
        console.log('Falha ao salvar marcas', e);
      }
    }
  };

  const toggleMark = (saleId: string) => {
    setMarks(prev => {
      const next = { ...prev, [saleId]: !prev[saleId] };
      persistMarks(next);
      return next;
    });
  };

  useEffect(() => {
    loadVendas();
    loadCaixaAberto();
    const unsubscribe = events.on('caixa:refresh', () => onRefresh());
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    let since = Date.now();
    const t = setInterval(async () => {
      try {
        const res = await saleService.updates(since);
        const updates = res?.data?.updates || [];
        if (updates.length) {
          since = res?.data?.now || Date.now();
          // Buscar somente vendas alteradas e mesclar sem spinner
          const ids: string[] = updates.map((u: any) => String(u.id));
          const results = await Promise.all(ids.map((id) => saleService.getById(id)));
          const changed = results.map((r) => r.data).filter(Boolean);
          if (changed.length) {
            setVendas((prev) => {
              const byId = new Map<string, any>();
              prev.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
              changed.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
              return Array.from(byId.values());
            });
          }
          await softRefreshCaixa();
        }
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // WS para mobile/ExpoGo (bidirecional)
    try {
      const url = getWsUrl();
      if (url) {
        const ws = new (globalThis as any).WebSocket(url);
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              if (!id) return;
              const r = await saleService.getById(id);
              const v = r.data;
              if (v) {
                setVendas((prev) => {
                  const byId = new Map<string, any>();
                  prev.forEach((x: any) => byId.set(String((x as any)?._id || (x as any)?.id), x));
                  byId.set(String(v._id || v.id), v);
                  return Array.from(byId.values());
                });
                await softRefreshCaixa();
              }
            }
          } catch {}
        };
        return () => { try { ws.close(); } catch {} };
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const saved = window.localStorage.getItem('caixaMarks');
        if (saved) setMarks(JSON.parse(saved));
      } catch (e) {
        console.log('Falha ao carregar marcas do localStorage', e);
      }
    }
  }, []);

  // Quando caixaVendas atualiza, buscar mesa faltando populate
  useEffect(() => {
    const fetchMissingMesa = async () => {
      try {
        const tasks = caixaVendas
          .filter(cv => {
            const mesaRef: any = cv?.venda?.mesa;
            if (!mesaRef) return false;
            // Buscar quando for string (ObjectId) OU quando vier objeto incompleto (sem funcionarioResponsavel.nome ou nomeResponsavel)
            if (typeof mesaRef === 'string') return true;
            if (typeof mesaRef === 'object') {
              const hasFuncNome = !!mesaRef?.funcionarioResponsavel?.nome && String(mesaRef?.funcionarioResponsavel?.nome).trim().length > 0;
              const hasRespNome = !!mesaRef?.nomeResponsavel && String(mesaRef?.nomeResponsavel).trim().length > 0;
              // Se faltar algum dos nomes, tentar buscar detalhes completos
              return !(hasFuncNome && hasRespNome);
            }
            return false;
          })
          .map(async (cv) => {
            const mesaRef: any = cv?.venda?.mesa;
            const mesaId = typeof mesaRef === 'string' ? mesaRef : mesaRef?._id;
            if (!mesaId) return;
            try {
              const resp = await mesaService.getById(mesaId);
              const mesaData = resp?.data?.data || resp?.data; // algumas rotas retornam { data }
              if (mesaData && mesaData._id) {
                setMesaInfoBySale(prev => ({ ...prev, [saleKey(cv.venda)]: mesaData }));
              }
            } catch (e) {
              console.warn('Falha ao buscar detalhes da mesa', mesaId, e);
            }
          });
        await Promise.all(tasks);
      } catch (err) {
        console.warn('Erro ao resolver mesas sem populate:', err);
      }
    };

    if (caixaVendas.length > 0) {
      fetchMissingMesa();
    }
  }, [caixaVendas]);

  const getVendaTitle = (venda: Sale) => {
    // 1. Prioridade absoluta para tipoVenda explícito
    const tipo = String(venda.tipoVenda || '').toUpperCase();
    if (tipo === 'BALCAO') {
        const nomeCliente = venda.nomeCliente || venda.cliente?.nome || venda.responsavelNome || 'Balcão';
        return `Venda - ${nomeCliente}`;
    }

    // 2. Check seguro para Mesa (evitar "ghost" mesa)
    if (tipo === 'MESA' || (venda.mesa && (venda.mesa.numero || venda.mesa.nome))) {
      const nomeMesa = venda.mesa?.nome;
      const numeroMesa = venda.mesa?.numero;
      if (nomeMesa) return nomeMesa;
      if (numeroMesa != null) return `Mesa ${numeroMesa}`;
      
      // Se for MESA, mas não tiver nome nem número, mostra "Venda - Cliente" em vez de "Mesa"
      // (Isso corrige o caso onde o sistema força 'mesa' internamente para balcão)
      const nomeClienteFallback = venda.nomeCliente || venda.cliente?.nome || venda.responsavelNome || 'Balcão';
      return `Venda - ${nomeClienteFallback}`;
    }

    // 3. Comanda: Só se tiver NOME ou NÚMERO explícito de comanda
    if (tipo === 'COMANDA' || (venda.nomeComanda && venda.nomeComanda.trim().length > 0) || (venda.numeroComanda && String(venda.numeroComanda).trim().length > 0)) {
        if (venda.nomeComanda) return `Comanda ${venda.nomeComanda}`;
        if (venda.numeroComanda) return `Comanda ${venda.numeroComanda}`;
        return 'Comanda';
    }

    // 4. Fallback final seguro: Se não é Mesa nem Comanda EXPLÍCITA, é Venda Balcão (mesmo sem tipoVenda)
    const nomeClienteFallback = venda.nomeCliente || venda.cliente?.nome || venda.responsavelNome || 'Balcão';
    return `Venda - ${nomeClienteFallback}`;
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadVendas();
    loadCaixaAberto();
  }, [loadVendas, loadCaixaAberto]);

  // Recarrega ao focar na tela (útil após fechar mesa em outra aba)
  useFocusEffect(
    React.useCallback(() => {
      onRefresh();
      return () => {};
    }, [onRefresh])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando vendas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Caixa" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sistema de Caixa</Text>
          <View style={[styles.statusBadge, hasCaixaAberto ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
            <View style={[styles.statusDot, { backgroundColor: hasCaixaAberto ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.statusBadgeText, { color: hasCaixaAberto ? '#065F46' : '#991B1B' }]}>
              {hasCaixaAberto
                ? `Caixa #${caixaInfo?.id || ''} Aberto${caixaInfo?.dataAbertura ? ' • ' + new Date(caixaInfo.dataAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}`
                : 'Caixa Fechado'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setMostrarValores((v) => !v)}
            style={styles.iconBtn}
            accessibilityLabel={mostrarValores ? 'Ocultar valores' : 'Mostrar valores'}
          >
            <SafeIcon name={mostrarValores ? 'eye-outline' : 'eye-off-outline'} size={18} color="#475569" fallbackText="👁" />
          </TouchableOpacity>

          {!hasCaixaAberto ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
              onPress={() => setAbrirCaixaModalVisible(true)}
            >
              <SafeIcon name="lock-open-outline" size={15} color="#fff" fallbackText="🔓" />
              <Text style={styles.actionBtnText}>Abrir Caixa</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
                onPress={() => abrirModalMovimentacao('suprimento')}
              >
                <Text style={styles.actionBtnText}>+ Suprimento</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#EA580C' }]}
                onPress={() => abrirModalMovimentacao('sangria')}
              >
                <Text style={styles.actionBtnText}>- Sangria</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#475569' }]}
                onPress={handleImprimirResumoCaixa}
              >
                <SafeIcon name="print-outline" size={15} color="#fff" fallbackText="🖨" />
                <Text style={styles.actionBtnText}>Resumo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
                onPress={abrirModalFecharCaixa}
              >
                <SafeIcon name="lock-closed-outline" size={15} color="#fff" fallbackText="🔒" />
                <Text style={styles.actionBtnText}>Fechar Caixa</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <SafeIcon name="refresh" size={18} color="#2196F3" fallbackText="↻" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Opção 3: Painel Compacto no Topo (Saldo na Gaveta vs Faturamento) */}
      {hasCaixaAberto ? (
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiCardHighlight]}>
            <View style={styles.kpiHeaderLine}>
              <Text style={[styles.kpiLabel, { color: '#065F46' }]}>💵 SALDO NA GAVETA (ESPÉCIE)</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#047857', fontSize: 16 }]}>
              {formatMoney(saldoEsperadoGaveta)}
            </Text>
            <Text style={styles.kpiSub}>
              Troco: {formatMoney(valorAberturaTurno)} | Din: {formatMoney(totalDinheiroTurno)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>🟢 DINHEIRO</Text>
            <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{formatMoney(totalDinheiroTurno)}</Text>
            <Text style={styles.kpiSub}>Vendas em espécie</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>💳 CARTÃO</Text>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{formatMoney(totalCartaoTurno)}</Text>
            <Text style={styles.kpiSub}>Crédito / Débito</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>💠 PIX</Text>
            <Text style={[styles.kpiValue, { color: '#0D9488' }]}>{formatMoney(totalPixTurno)}</Text>
            <Text style={styles.kpiSub}>Transferência instantânea</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>🔺 SUPR. / 🔻 SANGRIA</Text>
            <Text style={[styles.kpiValue, { color: '#EA580C', fontSize: 12 }]}>
              +{formatMoney(totalSuprimentosTurno)} / -{formatMoney(totalSangriasTurno)}
            </Text>
            <Text style={styles.kpiSub}>{movimentacoesTurno.length} mov. no turno</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.kpiLabel, { color: '#1E40AF' }]}>💰 TOTAL VENDAS</Text>
            <Text style={[styles.kpiValue, { color: '#1D4ED8', fontSize: 15 }]}>{formatMoney(totalVendasTurno)}</Text>
            <Text style={styles.kpiSub}>{caixaVendas.length} vendas registradas</Text>
          </View>
        </View>
      ) : (
        <View style={styles.closedBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.closedBannerTitle}>O Caixa está fechado no momento</Text>
            <Text style={styles.closedBannerSub}>
              Abra o caixa informando o fundo de troco inicial para controlar o saldo da gaveta, sangrias e fechamento de turno.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 8 }]}
            onPress={() => setAbrirCaixaModalVisible(true)}
          >
            <Text style={[styles.actionBtnText, { fontSize: 13 }]}>🔓 Abrir Caixa Agora</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Componente de Filtro de Exibição */}
      <View style={styles.viewFilterContainer}>
         <TouchableOpacity 
            style={[styles.viewFilterOption, displayFilter === 'all' && styles.viewFilterOptionSelected]}
            onPress={() => setDisplayFilter('all')}
         >
             <Text style={[styles.viewFilterText, displayFilter === 'all' && styles.viewFilterTextSelected]}>Todos</Text>
         </TouchableOpacity>
         <TouchableOpacity 
            style={[styles.viewFilterOption, displayFilter === 'open' && styles.viewFilterOptionSelected]}
            onPress={() => setDisplayFilter('open')}
         >
             <Text style={[styles.viewFilterText, displayFilter === 'open' && styles.viewFilterTextSelected]}>
               Vendas Abertas ({vendas.length})
             </Text>
         </TouchableOpacity>
         <TouchableOpacity 
            style={[styles.viewFilterOption, displayFilter === 'registered' && styles.viewFilterOptionSelected]}
            onPress={() => setDisplayFilter('registered')}
         >
             <Text style={[styles.viewFilterText, displayFilter === 'registered' && styles.viewFilterTextSelected]}>
               Registradas ({caixaVendas.length})
             </Text>
         </TouchableOpacity>
         <TouchableOpacity 
            style={[styles.viewFilterOption, displayFilter === 'movimentacoes' && styles.viewFilterOptionSelected]}
            onPress={() => setDisplayFilter('movimentacoes')}
         >
             <Text style={[styles.viewFilterText, displayFilter === 'movimentacoes' && styles.viewFilterTextSelected]}>
               Sangrias/Supr. ({movimentacoesTurno.length})
             </Text>
         </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Vendas abertas para finalizar */}
        {(displayFilter === 'all' || displayFilter === 'open') && (
        <>
            <Text style={[styles.sectionTitle]}>Vendas em aberto</Text>
            {vendas.length === 0 ? (
            <View style={styles.emptyContainer}>
                <SafeIcon name="receipt-outline" size={64} color="#ccc" fallbackText="🧾" />
                <Text style={styles.emptyText}>Nenhuma venda em aberto</Text>
            </View>
            ) : (
            <View style={styles.listGrid}>
                {vendas.map((venda) => (
                <View key={venda._id} style={styles.vendaCard}>
                    <View style={styles.rowLine}>
                    <Text style={styles.vendaTitle}>
                        {getVendaTitle(venda)}
                    </Text>
                    <View style={styles.rowRight}>
                        <Text style={styles.vendaTotal}>
                        R$ {calcularTotal(venda).toFixed(2)}
                        </Text>
                        <TouchableOpacity
                        style={styles.rowAction}
                        onPress={() => abrirModalFinalizacao(venda)}
                        accessibilityLabel="Finalizar venda"
                        >
                        <SafeIcon name="checkmark-circle" size={20} color="#4CAF50" fallbackText="✓" />
                        </TouchableOpacity>
                    </View>
                    </View>
                    <View style={styles.rowLine}>
                    <Text style={styles.vendaInfoCompact}>
                        Itens: {venda.itens.length} | Funcionário: {venda.funcionario?.nome || 'N/A'}
                    </Text>
                    </View>
                </View>
                ))}
            </View>
            )}
        </>
        )}

        {/* Vendas registradas no Caixa aberto */}
        {(displayFilter === 'all' || displayFilter === 'registered') && (
        <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Vendas registradas no Caixa</Text>
            {!hasCaixaAberto ? (
            <View style={styles.emptyContainer}>
                <SafeIcon name="cash-outline" size={64} color="#ccc" fallbackText="＄" />
                <Text style={styles.emptyText}>Nenhum caixa aberto</Text>
            </View>
            ) : (
            <>
                <View style={styles.filterBar}>
                <TouchableOpacity onPress={prevDay} accessibilityLabel="Dia anterior">
                    <SafeIcon name="chevron-back" size={20} color="#333" fallbackText="‹" />
                </TouchableOpacity>
                <Text style={styles.dateDisplay}>{formatSelectedDate}</Text>
                <TouchableOpacity onPress={nextDay} accessibilityLabel="Próximo dia">
                    <SafeIcon name="chevron-forward" size={20} color="#333" fallbackText="›" />
                </TouchableOpacity>
                </View>

                <View style={styles.summaryBar}>
                {selectedTotal > 0 && (
                  <Text style={[styles.summaryItem, { borderColor: '#2196F3', borderWidth: 2, color: '#0D47A1', backgroundColor: '#E3F2FD' }]}>
                    Selecionado: R$ {selectedTotal.toFixed(2)}
                  </Text>
                )}
                {Object.entries(paymentTotals as Record<string, number>).length === 0 ? (
                    <Text style={styles.summaryItem}>Sem subtotais</Text>
                ) : (
                    Object.entries(paymentTotals as Record<string, number>).map(([method, total]) => (
                    <Text key={method} style={styles.summaryItem}>
                        {formatMethodLabel(method)}: R$ {total.toFixed(2)}
                    </Text>
                    ))
                )}
                </View>

                {Platform.OS === 'web' && (
                <View style={styles.webFilterContainer}>
                    <View style={styles.webFilterGroup}>
                        <TouchableOpacity
                            style={[styles.miniFilterButton, markFilter === 'all' && styles.miniFilterButtonSelected]}
                            onPress={() => setMarkFilter('all')}
                        >
                            <Text style={[styles.miniFilterText, markFilter === 'all' && styles.miniFilterTextSelected]}>Todos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.miniFilterButton, markFilter === 'marked' && styles.miniFilterButtonSelected]}
                            onPress={() => setMarkFilter('marked')}
                        >
                            <Text style={[styles.miniFilterText, markFilter === 'marked' && styles.miniFilterTextSelected]}>Marcados</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.miniFilterButton, markFilter === 'unmarked' && styles.miniFilterButtonSelected]}
                            onPress={() => setMarkFilter('unmarked')}
                        >
                            <Text style={[styles.miniFilterText, markFilter === 'unmarked' && styles.miniFilterTextSelected]}>Não marcados</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.webFilterGroup}>
                        {['all', 'dinheiro', 'cartao', 'pix', 'cashback'].map((method) => (
                            <TouchableOpacity
                                key={method}
                                style={[styles.miniFilterButton, paymentFilterWeb === method && styles.miniFilterButtonSelected]}
                                onPress={() => setPaymentFilterWeb(method as any)}
                            >
                                <Text style={[styles.miniFilterText, paymentFilterWeb === method && styles.miniFilterTextSelected]}>
                                    {method === 'all' ? 'Todas' : method.charAt(0).toUpperCase() + method.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                )}

                {filteredCaixaVendas.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="list-outline" size={64} color="#ccc" fallbackText="≡" />
                    <Text style={styles.emptyText}>Nenhuma venda registrada no caixa</Text>
                </View>
                ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: 680 }}>
                <View style={styles.tableContainer}>
                    {/* Header da Tabela */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { width: 90 }]} numberOfLines={1}>Nº Venda</Text>
                        <Text style={[styles.tableHeaderText, { width: 80 }]} numberOfLines={1}>Origem</Text>
                        <Text style={[styles.tableHeaderText, { width: 100 }]} numberOfLines={1}>Espécie</Text>
                        <Text style={[styles.tableHeaderText, { width: 60 }]} numberOfLines={1}>Hora</Text>
                        <Text style={[styles.tableHeaderText, { width: 180 }]} numberOfLines={1}>Cliente</Text>
                        <Text style={[styles.tableHeaderText, { width: 100 }]} numberOfLines={1}>Func</Text>
                        <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'right' }]}>Valor</Text>
                        {Platform.OS === 'web' && <Text style={[styles.tableHeaderText, { width: 40, textAlign: 'center' }]}>Ok</Text>}
                    </View>

                    {filteredCaixaVendas.map((cv, idx) => {
                    // console.log('DEBUG VENDA:', cv.venda);
                    const mesaObj: any = mesaInfoBySale[saleKey(cv.venda)] || ((cv.venda.mesa && typeof cv.venda.mesa === 'object') ? cv.venda.mesa : undefined);
                    const clean = (s: any) => (typeof s === 'string' ? s.trim() : '');
                    const nomeRespMesa = clean(mesaObj?.nomeResponsavel);
                    const nomeFuncMesa = clean(mesaObj?.funcionarioResponsavel?.nome);
                    
                    // Lógica para definir Origem (Prioriza tipoVenda mas verifica objetos)
                    const tipo = String(cv.venda.tipoVenda || '').toUpperCase();
                    
                    // DEBUG: Descomente para ver no terminal do Metro
                    // console.log(`[DEBUG] Venda ${cv.venda._id}: Tipo=${tipo}, Mesa=${JSON.stringify(cv.venda.mesa)}, Comanda=${cv.venda.numeroComanda}`);

                    let origem = 'Balcão';
                    // Check mais seguro para objeto mesa: deve ter numero ou nome VALIDOs. 
                    // Apenas _id não conta (pode ser lixo de banco)
                    const hasMesa = cv.venda.mesa && (
                        (typeof cv.venda.mesa === 'object' && (cv.venda.mesa.numero || cv.venda.mesa.nome ))
                    );

                    if (tipo.includes('BALC')) {
                        origem = 'Balcão';
                    } else if (tipo.includes('MESA')) {
                        origem = 'Mesa';
                    } else if (tipo.includes('COMANDA')) {
                         origem = 'Comanda';
                    } else {
                        // Fallback: se tipo não definido, tenta inferir
                        if (hasMesa) {
                            origem = 'Mesa';
                        } else if (cv.venda.numeroComanda || cv.venda.nomeComanda) {
                            origem = 'Comanda';
                        }
                    }

                    let responsavel = '';
                    
                    if (origem === 'Balcão') {
                       // Prioriza o nome inserido no fechamento (responsavelNome)
                       responsavel = 
                         clean(cv.venda?.responsavelNome) ||
                         clean(cv.venda?.cliente?.nome) ||
                         clean(cv.venda?.nomeCliente) ||
                         clean(cv.venda?.consumidor?.nome) ||
                         clean(cv.venda?.nomeConsumidor) ||
                         'CONSUMIDOR';
                    } else {
                       responsavel = 
                         nomeRespMesa ||
                         clean(cv.venda?.cliente?.nome) ||
                         clean(cv.venda?.nomeCliente) ||
                         clean(cv.venda?.responsavelNome) ||
                         clean(cv.venda?.consumidor?.nome) ||
                         clean(cv.venda?.nomeConsumidor) ||
                         'CONSUMIDOR';
                    }
                        
                    let funcionario = 
                        nomeFuncMesa ||
                        clean(cv.venda?.funcionario?.nome) ||
                        clean((cv.venda as any)?.funcionarioAberturaNome) ||
                        clean((cv.venda as any)?.funcionarioNome) ||
                        'N/A';
                    
                    const vendaId = cv.venda?._id || cv.venda?.id;
                    const numeroVenda = cv.venda?.numeroComanda || (mesaObj ? (mesaObj.nome || (mesaObj.numero ? `Mesa ${mesaObj.numero}` : '')) : '') || ((vendaId && typeof vendaId === 'string') ? vendaId.slice(-6).toUpperCase() : (vendaId ? String(vendaId) : 'N/A'));

                    const hora = cv.dataVenda ? new Date(cv.dataVenda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

                    return (
                        <View key={`${saleKey(cv.venda)}-${idx}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { width: 90 }]} numberOfLines={1}>{String(numeroVenda || 'N/A')}</Text>
                            <Text style={[styles.tableCell, { width: 80 }]} numberOfLines={1}>{origem}</Text>
                            <Text style={[styles.tableCell, { width: 100 }]} numberOfLines={1}>{cv.formaPagamento}</Text>
                            <Text style={[styles.tableCell, { width: 60 }]} numberOfLines={1}>{hora}</Text>
                            <Text style={[styles.tableCell, { width: 180 }]} numberOfLines={1}>{responsavel}</Text>
                            <Text style={[styles.tableCell, { width: 100 }]} numberOfLines={1}>{funcionario}</Text>
                            <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold' }]}>R$ {cv.valor.toFixed(2)}</Text>
                            {Platform.OS === 'web' && (
                                <View style={{ width: 40, alignItems: 'center' }}>
                                    <TouchableOpacity
                                    onPress={() => toggleMark(saleKey(cv.venda))}
                                    accessibilityLabel={marks[saleKey(cv.venda)] ? 'Desmarcar' : 'Marcar'}
                                    >
                                    <SafeIcon
                                        name={marks[saleKey(cv.venda)] ? 'checkbox' : 'square-outline'}
                                        size={18}
                                        color={marks[saleKey(cv.venda)] ? '#2196F3' : '#999'}
                                        fallbackText={marks[saleKey(cv.venda)] ? '☑' : '☐'}
                                    />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                    })}
                </View>
                </ScrollView>
                )}
            </>
            )}
        </>
        )}

        {/* Opção 2: Sangrias e Suprimentos lançados no turno */}
        {(displayFilter === 'movimentacoes' || (displayFilter === 'all' && movimentacoesTurno.length > 0)) && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 6 }}>
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>
                Movimentações de Gaveta (Sangrias e Suprimentos)
              </Text>
              {hasCaixaAberto && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.miniActionPill, { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' }]}
                    onPress={() => abrirModalMovimentacao('suprimento')}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1' }}>+ Suprimento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniActionPill, { backgroundColor: '#FFEDD5', borderColor: '#FDBA74' }]}
                    onPress={() => abrirModalMovimentacao('sangria')}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#C2410C' }}>- Sangria</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {movimentacoesTurno.length === 0 ? (
              <View style={styles.emptyContainer}>
                <SafeIcon name="swap-vertical-outline" size={48} color="#ccc" fallbackText="⇅" />
                <Text style={styles.emptyText}>Nenhuma sangria ou suprimento registrado neste turno</Text>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: 110 }]}>Tipo</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Motivo / Descrição</Text>
                  <Text style={[styles.tableHeaderText, { width: 65 }]}>Hora</Text>
                  <Text style={[styles.tableHeaderText, { width: 110 }]}>Operador</Text>
                  <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Valor</Text>
                  <Text style={[styles.tableHeaderText, { width: 44, textAlign: 'center' }]}>Ação</Text>
                </View>
                {movimentacoesTurno.map((mov: any) => {
                  const isSupr = mov.tipo === 'suprimento';
                  const horaMov = mov.createdAt
                    ? new Date(mov.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  return (
                    <View key={mov.id} style={styles.tableRow}>
                      <View style={{ width: 110, flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={[
                            styles.movTypeBadge,
                            { backgroundColor: isSupr ? '#DCFCE7' : '#FEE2E2' },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: isSupr ? '#15803D' : '#B91C1C',
                            }}
                          >
                            {isSupr ? '🔺 Suprimento' : '🔻 Sangria'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                        {mov.motivo || (isSupr ? 'Reforço de troco' : 'Sangria de caixa')}
                      </Text>
                      <Text style={[styles.tableCell, { width: 65 }]}>{horaMov}</Text>
                      <Text style={[styles.tableCell, { width: 110 }]} numberOfLines={1}>
                        {mov.funcionarioNome || 'Administrador'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            width: 100,
                            textAlign: 'right',
                            fontWeight: '700',
                            color: isSupr ? '#16A34A' : '#DC2626',
                          },
                        ]}
                      >
                        {isSupr ? '+' : '-'} R$ {Number(mov.valor || 0).toFixed(2).replace('.', ',')}
                      </Text>
                      <View style={{ width: 44, alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => handleRemoverMovimentacao(mov)}
                          style={{ padding: 4 }}
                          accessibilityLabel="Excluir movimentação"
                        >
                          <SafeIcon name="trash-outline" size={16} color="#EF4444" fallbackText="🗑" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Modal de Finalização */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Venda</Text>
            
            {selectedSale && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>
                  {getVendaTitle(selectedSale)}
                </Text>
                <Text style={styles.modalInfoText}>
                  Total: R$ {calcularTotal(selectedSale).toFixed(2)}
                </Text>
              </View>
            )}
            
            <Text style={styles.paymentLabel}>Forma de Pagamento:</Text>
            
            <View style={styles.paymentOptions}>
              {['dinheiro', 'cartao', 'pix'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentOption,
                    paymentMethod === method && styles.paymentOptionSelected
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[
                    styles.paymentOptionText,
                    paymentMethod === method && styles.paymentOptionTextSelected
                  ]}>
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={finalizarVenda}
              >
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Opção 1: Modal de Abrir Caixa */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={abrirCaixaModalVisible}
        onRequestClose={() => setAbrirCaixaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <Text style={styles.modalTitle}>🔓 Abrir Novo Turno de Caixa</Text>

            <Text style={styles.inputLabel}>Fundo de Troco Inicial na Gaveta (R$):</Text>
            <TextInput
              style={styles.textInputField}
              value={valorAberturaInput}
              onChangeText={setValorAberturaInput}
              keyboardType="numeric"
              placeholder="Ex: 150,00"
            />

            <View style={styles.presetRow}>
              {['0,00', '50,00', '100,00', '150,00', '200,00'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetChip,
                    valorAberturaInput === preset && styles.presetChipActive,
                  ]}
                  onPress={() => setValorAberturaInput(preset)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      valorAberturaInput === preset && styles.presetChipTextActive,
                    ]}
                  >
                    R$ {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Observação da Abertura (opcional):</Text>
            <TextInput
              style={styles.textInputField}
              value={obsAberturaInput}
              onChangeText={setObsAberturaInput}
              placeholder="Ex: Turno da Noite / Operador João"
            />

            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAbrirCaixaModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleAbrirCaixa}
                disabled={actionLoading}
              >
                <Text style={styles.confirmButtonText}>
                  {actionLoading ? 'Abrindo...' : 'Confirmar Abertura'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Opção 2: Modal de Sangria / Suprimento */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={movModalVisible}
        onRequestClose={() => setMovModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <Text style={styles.modalTitle}>
              {movTipo === 'sangria' ? '🔻 Lançar Sangria (Retirada)' : '🔺 Lançar Suprimento (Reforço)'}
            </Text>

            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  movTipo === 'suprimento' && { borderColor: '#0284C7', backgroundColor: '#E0F2FE', borderWidth: 2 },
                ]}
                onPress={() => setMovTipo('suprimento')}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    movTipo === 'suprimento' && { color: '#0369A1', fontWeight: '700' },
                  ]}
                >
                  🔺 Suprimento (+ Troco)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  movTipo === 'sangria' && { borderColor: '#EA580C', backgroundColor: '#FFEDD5', borderWidth: 2 },
                ]}
                onPress={() => setMovTipo('sangria')}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    movTipo === 'sangria' && { color: '#C2410C', fontWeight: '700' },
                  ]}
                >
                  🔻 Sangria (- Retirada)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Valor em Espécie (R$):</Text>
            <TextInput
              style={styles.textInputField}
              value={movValorInput}
              onChangeText={setMovValorInput}
              keyboardType="numeric"
              placeholder="Ex: 50,00"
            />

            <Text style={styles.inputLabel}>Sugestões Rápidas de Motivo:</Text>
            <View style={styles.presetRow}>
              {(movTipo === 'sangria'
                ? ['Pagamento Fornecedor', 'Compra Gelo/Insumos', 'Vale Funcionário', 'Retirada Cofre']
                : ['Reforço de Troco', 'Troca de Moedas', 'Aporte Extra']
              ).map((sug) => (
                <TouchableOpacity
                  key={sug}
                  style={[styles.presetChip, movMotivoInput === sug && styles.presetChipActive]}
                  onPress={() => setMovMotivoInput(sug)}
                >
                  <Text style={[styles.presetChipText, movMotivoInput === sug && styles.presetChipTextActive]}>
                    {sug}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Motivo / Descrição:</Text>
            <TextInput
              style={styles.textInputField}
              value={movMotivoInput}
              onChangeText={setMovMotivoInput}
              placeholder={
                movTipo === 'sangria'
                  ? 'Ex: Pagamento entregador / compra de gelo'
                  : 'Ex: Entrada de moedas para troco'
              }
            />

            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setMovModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: movTipo === 'sangria' ? '#EA580C' : '#0284C7' },
                ]}
                onPress={handleConfirmarMovimentacao}
                disabled={actionLoading}
              >
                <Text style={styles.confirmButtonText}>
                  {actionLoading ? 'Salvando...' : 'Confirmar Lançamento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Opção 1: Modal de Conferência e Fechamento de Caixa (Ultra Compacto) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fecharCaixaModalVisible}
        onRequestClose={() => setFecharCaixaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                maxWidth: 580,
                width: Platform.OS === 'web' ? 560 : '95%',
                padding: 14,
                maxHeight: '94%',
              },
            ]}
          >
            <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 10 }]}>
              🔒 Conferência e Fechamento de Caixa
            </Text>

            {/* Caixas 1 e 2 lado a lado para economizar metade da altura */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={[styles.conferenciaBox, { flex: 1.25, minWidth: 230, padding: 8 }]}>
                <Text style={styles.conferenciaSectionTitle}>1. GAVETA (EM DINHEIRO)</Text>
                <View style={styles.conferenciaLine}>
                  <Text style={styles.conferenciaLabel}>(+) Troco Inicial:</Text>
                  <Text style={styles.conferenciaVal}>{formatMoneyPlain(valorAberturaTurno)}</Text>
                </View>
                <View style={styles.conferenciaLine}>
                  <Text style={styles.conferenciaLabel}>(+) Vendas Dinheiro:</Text>
                  <Text style={[styles.conferenciaVal, { color: '#16A34A' }]}>
                    +{formatMoneyPlain(totalDinheiroTurno)}
                  </Text>
                </View>
                <View style={styles.conferenciaLine}>
                  <Text style={styles.conferenciaLabel}>(+) Suprimentos:</Text>
                  <Text style={[styles.conferenciaVal, { color: '#0284C7' }]}>
                    +{formatMoneyPlain(totalSuprimentosTurno)}
                  </Text>
                </View>
                <View style={styles.conferenciaLine}>
                  <Text style={styles.conferenciaLabel}>(-) Sangrias:</Text>
                  <Text style={[styles.conferenciaVal, { color: '#DC2626' }]}>
                    -{formatMoneyPlain(totalSangriasTurno)}
                  </Text>
                </View>
                <View style={[styles.conferenciaLine, styles.conferenciaTotalLine]}>
                  <Text style={styles.conferenciaTotalLabel}>(=) Saldo Esperado:</Text>
                  <Text style={styles.conferenciaTotalVal}>{formatMoneyPlain(saldoEsperadoGaveta)}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.conferenciaBox,
                  { flex: 1, minWidth: 195, padding: 8, backgroundColor: '#F8FAFC', justifyContent: 'space-between' },
                ]}
              >
                <View>
                  <Text style={styles.conferenciaSectionTitle}>
                    2. RESUMO ({caixaVendas.length} VENDAS)
                  </Text>
                  <View style={styles.conferenciaLine}>
                    <Text style={styles.conferenciaLabel}>🟢 Dinheiro:</Text>
                    <Text style={styles.conferenciaVal}>{formatMoneyPlain(totalDinheiroTurno)}</Text>
                  </View>
                  <View style={styles.conferenciaLine}>
                    <Text style={styles.conferenciaLabel}>💳 Cartão:</Text>
                    <Text style={styles.conferenciaVal}>{formatMoneyPlain(totalCartaoTurno)}</Text>
                  </View>
                  <View style={styles.conferenciaLine}>
                    <Text style={styles.conferenciaLabel}>💠 PIX:</Text>
                    <Text style={styles.conferenciaVal}>{formatMoneyPlain(totalPixTurno)}</Text>
                  </View>
                </View>
                <View style={[styles.conferenciaLine, styles.conferenciaTotalLine, { borderTopColor: '#CBD5E1' }]}>
                  <Text style={[styles.conferenciaTotalLabel, { color: '#1E293B' }]}>💰 Total Vendas:</Text>
                  <Text style={[styles.conferenciaTotalVal, { color: '#1D4ED8' }]}>
                    {formatMoneyPlain(totalVendasTurno)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Valor Contado e Observações lado a lado */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 3 }]}>
                  Valor Contado na Gaveta (R$):
                </Text>
                <TextInput
                  style={[styles.textInputField, { paddingVertical: 6, marginBottom: 0 }]}
                  value={valorContadoInput}
                  onChangeText={setValorContadoInput}
                  keyboardType="numeric"
                  placeholder="0,00"
                />
              </View>
              <View style={{ flex: 1.3 }}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 3 }]}>
                  Observações (opcional):
                </Text>
                <TextInput
                  style={[styles.textInputField, { paddingVertical: 6, marginBottom: 0 }]}
                  value={obsFechamentoInput}
                  onChangeText={setObsFechamentoInput}
                  placeholder="Ex: Conferido pelo gerente"
                />
              </View>
            </View>

            {/* Banner compacto de Diferença */}
            <View
              style={[
                styles.diffBanner,
                { marginTop: 8, marginBottom: 8, paddingVertical: 5 },
                diferencaFechamento === 0
                  ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                  : diferencaFechamento > 0
                  ? { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' }
                  : { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color:
                    diferencaFechamento === 0
                      ? '#166534'
                      : diferencaFechamento > 0
                      ? '#075985'
                      : '#991B1B',
                }}
              >
                {diferencaFechamento === 0
                  ? '✅ Gaveta bateu exato! (Diferença: R$ 0,00)'
                  : diferencaFechamento > 0
                  ? `🟢 Sobra de Caixa: +${formatMoneyPlain(diferencaFechamento)}`
                  : `⚠️ Falta no Caixa (Quebra): ${formatMoneyPlain(diferencaFechamento)}`}
              </Text>
            </View>

            {/* Botões de ação todos na mesma linha inferior */}
            <View style={[styles.modalActions, { gap: 8 }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { flex: 0.7, paddingVertical: 9 }]}
                onPress={() => setFecharCaixaModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.printReportBtn,
                  { flex: 1, marginTop: 0, paddingVertical: 9 },
                ]}
                onPress={handleImprimirResumoCaixa}
              >
                <SafeIcon name="print-outline" size={15} color="#1E293B" fallbackText="🖨" />
                <Text style={styles.printReportBtnText}>Imprimir (80mm)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { flex: 1.2, backgroundColor: '#DC2626', paddingVertical: 9 }]}
                onPress={handleConfirmarFechamentoCaixa}
                disabled={actionLoading}
              >
                <Text style={styles.confirmButtonText}>
                  {actionLoading ? 'Fechando...' : '🔒 Confirmar Fechamento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}



const styles: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Fundo levemente mais escuro para contraste das linhas brancas
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  
  // Header Compacto
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 36 : 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    zIndex: 10,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  statusBadgeOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconBtn: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Opção 3: KPI Cards Compactos no Topo
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  kpiCard: {
    flex: 1,
    minWidth: 135,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardHighlight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 1.5,
    minWidth: 175,
  },
  kpiHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  closedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  closedBannerSub: {
    fontSize: 11,
    color: '#B45309',
  },
  miniActionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  movTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  textInputField: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  presetChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  conferenciaBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
  },
  conferenciaSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  conferenciaLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  conferenciaLabel: {
    fontSize: 12,
    color: '#334155',
  },
  conferenciaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  conferenciaTotalLine: {
    borderTopWidth: 1,
    borderTopColor: '#6EE7B7',
    marginTop: 4,
    paddingTop: 5,
  },
  conferenciaTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  conferenciaTotalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },
  diffBanner: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 4,
    alignItems: 'center',
  },
  printReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    marginTop: 6,
  },
  printReportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },

  content: {
    flex: 1,
    paddingHorizontal: 12, // Padding lateral reduzido
    paddingTop: 8,
  },

  // Filtros Compactos
  viewFilterContainer: {
     flexDirection: 'row',
     backgroundColor: '#E2E8F0',
     padding: 2,
     borderRadius: 8,
     marginHorizontal: 12,
     marginTop: 8,
     marginBottom: 4,
     height: 32, // Altura fixa reduzida
  },
  viewFilterOption: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
  },
  viewFilterOptionSelected: {
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 1,
  },
  viewFilterText: {
      fontSize: 12, // Fonte menor
      fontWeight: '600',
      color: '#64748B',
  },
  viewFilterTextSelected: {
    color: '#0F172A',
  },

  // Tabela
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6, // Reduzido de 12 para 6 (50%)
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tableCell: {
    fontSize: 13,
    color: '#334155',
    paddingHorizontal: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },

  // Lista / Linhas Ultra Compactas
  listGrid: {
    flexDirection: 'column', // Mudança para coluna (lista vertical)
    paddingBottom: 12, // Reduzido de 24
  },
  vendaCard: {
    backgroundColor: '#fff',
    borderRadius: 6, // Bordas ainda menos arredondadas
    paddingVertical: 4, // Reduzido de 8 para 4 (metade)
    paddingHorizontal: 8, // Reduzido de 12 para 8
    marginBottom: 2, // Margem mínima entre itens (reduzido de 4)
    width: '100%', // Largura total
    borderLeftWidth: 3, // Reduzido de 4
    borderLeftColor: '#10B981', // Verde
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row', // Layout horizontal
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // Sombra ainda mais sutil
    shadowRadius: 1,
    elevation: 1,
  },
  // Reorganização interna do card para linha única
  rowLine: {
    flex: 1, // Ocupa o espaço disponível
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendaTitle: {
    fontSize: 13, // Fonte levemente reduzida (era 14)
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 70, // Largura mínima reduzida
  },
  // Container para informações secundárias na mesma linha ou logo abaixo
  vendaInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8, // Reduzido de 12
    marginRight: 8, // Reduzido de 12
    gap: 4, // Reduzido de 8
    overflow: 'hidden',
  },
  vendaInfoCompact: {
    fontSize: 10, // Fonte reduzida (era 11)
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4, // Reduzido de 6
    paddingVertical: 1, // Reduzido de 2
    borderRadius: 3, // Reduzido de 4
  },
  
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Reduzido de 8
  },
  vendaTotal: {
    fontSize: 13, // Reduzido de 14
    fontWeight: '700',
    color: '#059669', // Verde mais escuro para contraste em texto pequeno
    minWidth: 60, // Reduzido de 70
    textAlign: 'right',
  },
  rowAction: {
    padding: 2, // Reduzido de 4
  },

  // Filtros e Resumo (Vendas Registradas)
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 6, // Reduzido de 8
    borderRadius: 8,
    marginBottom: 6, // Reduzido de 8
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateDisplay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  summaryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4, // Reduzido de 6
    marginBottom: 8, // Reduzido de 12
  },
  summaryItem: {
    fontSize: 10, // Reduzido de 11
    fontWeight: '600',
    color: '#334155',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 6, // Reduzido de 8
    paddingVertical: 2, // Reduzido de 4
    borderRadius: 10, // Reduzido de 12
  },
  
  // Modal de Finalização (Mantido estilo, mas ajustado levemente)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: Platform.OS === 'web' ? 380 : '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInfo: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInfoText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  paymentOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
  },
  paymentOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentOptionTextSelected: {
    color: '#0369A1',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  
  // Novos estilos compactos para filtro web
  webFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Reduzido de 12
    marginBottom: 4, // Reduzido de 8
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webFilterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2, // Reduzido de 4
    alignItems: 'center',
    padding: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 6, // Reduzido de 8
  },
  miniFilterButton: {
    paddingHorizontal: 6, // Reduzido de 8
    paddingVertical: 3, // Reduzido de 5
    borderRadius: 4, // Reduzido de 6
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 0,
  },
  miniFilterButtonSelected: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1, // Reduzido de 2
    elevation: 1,
  },
  miniFilterText: {
    fontSize: 10, // Reduzido de 11
    fontWeight: '600',
    color: '#64748B',
  },
  miniFilterTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
});

const saleKey = (v: Sale) => String((v as any)?._id || (v as any)?.id || '');


