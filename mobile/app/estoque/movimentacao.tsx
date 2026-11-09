import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api, { productService, categoryService, typeService, unidadeMedidaService } from '../../src/services/api';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isLargeScreen = width > 768;

interface Product {
  id: number;
  nome: string;
  quantidade: number;
  precoCusto: number;
  unidade: string;
  estoqueDeposito?: number;
  estoqueGeladeira?: number;
}

interface Supplier {
  id: number;
  razaoSocial: string;
  cnpj: string;
}

interface Categoria {
  id: number;
  nome: string;
}

interface Tipo {
  id: number;
  nome: string;
}

interface XmlItem {
  cProd: string;
  cEAN: string;
  xProd: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  ncm: string;
  cest: string;
  cfop: string;
  associatedProductId: number | null;
  associatedProductName: string | null;
  associatedProductPrecoVenda?: number | null;
  associatedProductPrecoCusto?: number | null;
  associatedProductLocalVendaNome?: string | null;
  localDestino?: string;
  precoVenda?: string | number;
  // Campos de controle do usuário
  productId: number | null;
  productName: string | null;
  fatorConversao: number;
  cadastrarNovo: boolean;
  novoProduto?: {
    nome: string;
    precoVenda: string;
    categoria: string;
    tipo: string;
    unidade: string;
    localVendaNome?: string;
  };
}

export default function MovimentacaoEstoque() {
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'transfer' | 'manual' | 'xml'>(
    params.tab === 'manual' ? 'manual' : params.tab === 'xml' ? 'xml' : 'transfer'
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [locaisEstoque, setLocaisEstoque] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // States Transferência entre Locais (Depósito <-> Geladeira)
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [transferDirection, setTransferDirection] = useState<'DEP_TO_GEL' | 'GEL_TO_DEP'>('DEP_TO_GEL');
  const [transferQty, setTransferQty] = useState('');
  const [transferObs, setTransferObs] = useState('');

  // States Manual
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearchModal, setShowProductSearchModal] = useState(false);
  const [productSearchTarget, setProductSearchTarget] = useState<'manual' | 'transfer'>('transfer');
  const [manualLocal, setManualLocal] = useState<'DEPOSITO' | 'GELADEIRA'>('DEPOSITO');
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE'>('ENTRADA');
  const [qty, setQty] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [reason, setReason] = useState('COMPRA'); // Padrão
  const [obs, setObs] = useState('');

  // States Fornecedor Expandido
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierCnpj, setSupplierCnpj] = useState('');
  const [supplierRazaoSocial, setSupplierRazaoSocial] = useState('');
  const [supplierNomeFantasia, setSupplierNomeFantasia] = useState('');
  const [supplierTelefone, setSupplierTelefone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierNomeContato, setSupplierNomeContato] = useState('');
  const [supplierTipo, setSupplierTipo] = useState('');
  const [supplierLogradouro, setSupplierLogradouro] = useState('');
  const [supplierNumero, setSupplierNumero] = useState('');
  const [supplierComplemento, setSupplierComplemento] = useState('');
  const [supplierBairro, setSupplierBairro] = useState('');
  const [supplierCidade, setSupplierCidade] = useState('');
  const [supplierUf, setSupplierUf] = useState('');
  const [supplierCep, setSupplierCep] = useState('');

  // States XML
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [xmlData, setXmlData] = useState<{
    chave: string;
    fornecedor: {
      cnpj: string;
      razaoSocial: string;
      nomeFantasia: string;
      telefone?: string;
      novo?: boolean;
    };
    itens: XmlItem[];
  } | null>(null);
  
  // Modal de Associação XML
  const [associatingItemIndex, setAssociatingItemIndex] = useState<number | null>(null);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [tempNewProduct, setTempNewProduct] = useState({
    nome: '',
    precoVenda: '',
    categoria: '',
    tipo: '',
    unidade: 'un',
    localVendaNome: 'Geladeira 1',
  });

  const reasonsInput = {
    ENTRADA: [
      { key: 'COMPRA', label: 'Compra de Fornecedor' },
      { key: 'DEVOLUCAO', label: 'Devolução de Cliente' },
      { key: 'AJUSTE', label: 'Ajuste de Estoque' },
      { key: 'OUTROS', label: 'Outros' },
    ],
    SAIDA: [
      { key: 'VENCIDO', label: 'Produto Vencido' },
      { key: 'DANIFICADO', label: 'Produto Danificado / Avariado' },
      { key: 'CONSUMO_INTERNO', label: 'Consumo Interno' },
      { key: 'FURTO_OU_ROUBO', label: 'Perda / Furto / Roubo' },
      { key: 'OUTROS', label: 'Outros' },
    ],
    AJUSTE: [
      { key: 'AJUSTE', label: 'Ajuste de Balanço / Inventário' },
    ]
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (params.productId && products.length > 0) {
      const prod = products.find(p => String(p.id) === String(params.productId));
      if (prod) {
        setTransferProduct(prod);
        if (params.tab === 'transfer' || !params.tab) {
          setActiveTab('transfer');
        }
      }
    }
  }, [products, params.productId, params.tab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, supRes, catRes, tipRes, locRes] = await Promise.all([
        productService.getAll(),
        api.get('/stock/suppliers'),
        categoryService.getAll(),
        typeService.getAll(),
        api.get('/stock/locations'),
      ]);
      const prods = prodRes.data || [];
      setProducts(prods);
      setSuppliers(supRes.data || []);
      setCategorias(catRes || []);
      setTipos(tipRes || []);
      setLocaisEstoque(locRes.data || []);

      // Atualiza produto selecionado se já houver um selecionado
      if (transferProduct) {
        const updatedTransfer = prods.find((p: Product) => p.id === transferProduct.id);
        if (updatedTransfer) setTransferProduct(updatedTransfer);
      }
      if (selectedProduct) {
        const updatedSelected = prods.find((p: Product) => p.id === selectedProduct.id);
        if (updatedSelected) setSelectedProduct(updatedSelected);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível carregar os dados cadastrais.');
    } finally {
      setLoading(false);
    }
  };

  // Transferência entre Depósito e Ponto de Venda (Geladeira, Balcão, Cozinha, etc.)
  const handleTransferStock = async () => {
    if (!transferProduct) {
      Alert.alert('Atenção', 'Selecione um produto para transferir.');
      return;
    }
    if (!transferQty || isNaN(Number(transferQty)) || Number(transferQty) <= 0) {
      Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
      return;
    }

    const qtyNum = Number(transferQty);
    const localNome = (transferProduct as any).localVendaNome || 'Geladeira 1';
    const origem = transferDirection === 'DEP_TO_GEL' ? 'DEPOSITO' : localNome;
    const destino = transferDirection === 'DEP_TO_GEL' ? localNome : 'DEPOSITO';

    setLoading(true);
    try {
      const res = await api.post('/stock/transfer', {
        productId: transferProduct.id,
        quantidade: qtyNum,
        origem,
        destino,
        observacao: transferObs || undefined,
      });

      const depAtual = res.data?.estoqueDeposito ?? (origem === 'DEPOSITO' ? (transferProduct.estoqueDeposito || 0) - qtyNum : (transferProduct.estoqueDeposito || 0) + qtyNum);
      const gelAtual = res.data?.estoqueGeladeira ?? (destino === 'DEPOSITO' ? (transferProduct.estoqueGeladeira || 0) - qtyNum : (transferProduct.estoqueGeladeira || 0) + qtyNum);

      Alert.alert(
        'Sucesso',
        `Transferência concluída com sucesso!\n\n${transferProduct.nome}\n` +
        `📦 Depósito: ${depAtual} ${transferProduct.unidade}\n` +
        `📍 ${localNome}: ${gelAtual} ${transferProduct.unidade}`
      );

      setTransferProduct((prev) =>
        prev
          ? {
              ...prev,
              quantidade: depAtual + gelAtual,
              estoqueDeposito: depAtual,
              estoqueGeladeira: gelAtual,
            }
          : null
      );
      setTransferQty('');
      setTransferObs('');
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao realizar transferência.');
    } finally {
      setLoading(false);
    }
  };

  // Lançar manual
  const handleSaveManual = async () => {
    if (!selectedProduct) {
      Alert.alert('Atenção', 'Selecione um produto.');
      return;
    }
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) {
      Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        productId: selectedProduct.id,
        tipo: movementType,
        quantidade: Number(qty),
        precoCusto: costPrice ? Number(costPrice) : null,
        motivo: reason,
        observacao: obs,
        supplierId: selectedSupplierId ? Number(selectedSupplierId) : null,
        local: manualLocal,
      };

      const res = await api.post('/stock/move', payload);
      Alert.alert('Sucesso', 'Movimentação registrada com sucesso!');
      
      // Limpar campos
      setSelectedProduct(null);
      setQty('');
      setCostPrice('');
      setSelectedSupplierId('');
      setObs('');
      loadData(); // Atualiza estoque na listagem
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao salvar movimentação.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupplier = async () => {
    if (!supplierCnpj || !supplierRazaoSocial) {
      Alert.alert('Atenção', 'CNPJ e Razão Social são obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cnpj: supplierCnpj.replace(/\D/g, ''),
        razaoSocial: supplierRazaoSocial,
        nomeFantasia: supplierNomeFantasia || null,
        telefone: supplierTelefone || null,
        email: supplierEmail || null,
        nomeContato: supplierNomeContato || null,
        tipo: supplierTipo || null,
        logradouro: supplierLogradouro || null,
        numero: supplierNumero || null,
        complemento: supplierComplemento || null,
        bairro: supplierBairro || null,
        cidade: supplierCidade || null,
        uf: supplierUf || null,
        cep: supplierCep || null,
      };

      const res = await api.post('/stock/supplier', payload);
      Alert.alert('Sucesso', 'Fornecedor cadastrado com sucesso!');

      // Recarrega fornecedores e seleciona o cadastrado
      const supRes = await api.get('/stock/suppliers');
      setSuppliers(supRes.data || []);
      setSelectedSupplierId(String(res.data.supplier.id));

      // Limpar campos
      setSupplierCnpj('');
      setSupplierRazaoSocial('');
      setSupplierNomeFantasia('');
      setSupplierTelefone('');
      setSupplierEmail('');
      setSupplierNomeContato('');
      setSupplierTipo('');
      setSupplierLogradouro('');
      setSupplierNumero('');
      setSupplierComplemento('');
      setSupplierBairro('');
      setSupplierCidade('');
      setSupplierUf('');
      setSupplierCep('');
      setShowSupplierModal(false);
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao cadastrar fornecedor.');
    } finally {
      setLoading(false);
    }
  };

  // Upload do XML
  const handleSelectXml = (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      processXmlFile(file);
    }
  };

  const processXmlFile = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('xml', file);

      const res = await api.post('/stock/import-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Inicializa os dados com associações automáticas pré-computadas na API
      const processedItens = res.data.itens.map((item: any) => ({
        ...item,
        productId: item.associatedProductId,
        productName: item.associatedProductName,
        associatedProductPrecoVenda: item.associatedProductPrecoVenda,
        associatedProductPrecoCusto: item.associatedProductPrecoCusto,
        associatedProductLocalVendaNome: item.associatedProductLocalVendaNome,
        localDestino: 'DEPOSITO', // Padrão
        precoVenda: item.associatedProductPrecoVenda ? String(item.associatedProductPrecoVenda) : '',
        fatorConversao: 1,
        cadastrarNovo: false,
      }));

      setXmlData({
        chave: res.data.chave,
        fornecedor: res.data.fornecedor,
        itens: processedItens,
      });

    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao processar arquivo XML.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de nova associação ou cadastro rápido
  const handleItemAssociation = (index: number) => {
    setAssociatingItemIndex(index);
    const item = xmlData!.itens[index];
    
    // Inicializa o modal de cadastro rápido com dados básicos do XML
    setTempNewProduct({
      nome: item.xProd,
      precoVenda: '',
      categoria: categorias[0]?.nome || '',
      tipo: tipos[0]?.nome || '',
      unidade: 'un',
      localVendaNome: locaisEstoque[0]?.nome || 'Geladeira 1',
    });
    
    setShowNewProductModal(true);
  };

  // Confirmar associação de novo produto
  const handleSaveTempNewProduct = () => {
    if (!tempNewProduct.nome || !tempNewProduct.precoVenda) {
      Alert.alert('Atenção', 'Nome do produto e Preço de Venda são obrigatórios.');
      return;
    }

    if (associatingItemIndex !== null && xmlData) {
      const updatedItens = [...xmlData.itens];
      updatedItens[associatingItemIndex] = {
        ...updatedItens[associatingItemIndex],
        cadastrarNovo: true,
        productId: null,
        productName: tempNewProduct.nome + ' (Novo Cadastro)',
        localDestino: tempNewProduct.localVendaNome || 'Geladeira 1',
        novoProduto: { ...tempNewProduct },
      };

      setXmlData({
        ...xmlData,
        itens: updatedItens,
      });
    }

    setShowNewProductModal(false);
    setAssociatingItemIndex(null);
  };

  // Confirmar associação a um produto existente
  const handleAssociateExisting = (prod: Product) => {
    if (associatingItemIndex !== null && xmlData) {
      const updatedItens = [...xmlData.itens];
      const prodAny = prod as any;
      updatedItens[associatingItemIndex] = {
        ...updatedItens[associatingItemIndex],
        cadastrarNovo: false,
        productId: prod.id,
        productName: prod.nome,
        associatedProductPrecoVenda: prodAny.precoVenda ? Number(prodAny.precoVenda) : null,
        associatedProductPrecoCusto: prodAny.precoCusto ? Number(prodAny.precoCusto) : null,
        associatedProductLocalVendaNome: prodAny.localVendaNome || null,
        localDestino: prodAny.localVendaNome || updatedItens[associatingItemIndex].localDestino || 'DEPOSITO',
        precoVenda: prodAny.precoVenda ? String(prodAny.precoVenda) : (updatedItens[associatingItemIndex].precoVenda || ''),
        novoProduto: undefined,
      };

      setXmlData({
        ...xmlData,
        itens: updatedItens,
      });
    }

    setShowNewProductModal(false);
    setAssociatingItemIndex(null);
  };

  // Alterar preço de venda de um item associado
  const handlePrecoVendaChange = (index: number, val: string) => {
    if (xmlData) {
      const updatedItens = [...xmlData.itens];
      updatedItens[index].precoVenda = val;
      setXmlData({ ...xmlData, itens: updatedItens });
    }
  };

  // Remover associação
  const handleRemoveAssociation = (index: number) => {
    if (xmlData) {
      const updatedItens = [...xmlData.itens];
      updatedItens[index] = {
        ...updatedItens[index],
        productId: null,
        productName: null,
        cadastrarNovo: false,
        novoProduto: undefined,
      };
      setXmlData({ ...xmlData, itens: updatedItens });
    }
  };

  // Alterar fator de conversão
  const handleFatorChange = (index: number, val: string) => {
    if (xmlData) {
      const updatedItens = [...xmlData.itens];
      const factor = parseInt(val) || 1;
      updatedItens[index].fatorConversao = Math.max(1, factor);
      setXmlData({ ...xmlData, itens: updatedItens });
    }
  };

  // Configurar destino de todos os itens do XML em lote
  const handleSetAllXmlDestino = (tipoDestino: 'DEPOSITO' | 'PADRAO') => {
    if (!xmlData) return;
    const updatedItens = xmlData.itens.map((item: any) => ({
      ...item,
      localDestino: tipoDestino === 'PADRAO' ? (item.associatedProductLocalVendaNome || 'Geladeira 1') : 'DEPOSITO',
    }));
    setXmlData({ ...xmlData, itens: updatedItens });
  };

  // Alterar destino de um item específico do XML
  const handleItemDestinoChange = (index: number, localNome: string) => {
    if (!xmlData) return;
    const updatedItens = [...xmlData.itens];
    updatedItens[index] = {
      ...updatedItens[index],
      localDestino: localNome,
    };
    setXmlData({ ...xmlData, itens: updatedItens });
  };

  // Confirmar toda a nota fiscal (XML)
  const handleConfirmXml = async () => {
    if (!xmlData) return;

    // Verificar se todos os itens estão associados
    const naoAssociados = xmlData.itens.filter(item => !item.productId && !item.cadastrarNovo);
    if (naoAssociados.length > 0) {
      Alert.alert(
        'Atenção', 
        `Existem ${naoAssociados.length} itens sem associação. Deseja importá-los mesmo assim (itens não associados serão ignorados)?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Importar Selecionados', onPress: () => sendXmlConfirmation() }
        ]
      );
    } else {
      sendXmlConfirmation();
    }
  };

  const sendXmlConfirmation = async () => {
    setLoading(true);
    try {
      const payload = {
        chave: xmlData!.chave,
        fornecedor: xmlData!.fornecedor,
        itens: xmlData!.itens.map(item => ({
          ...item,
          localDestino: item.localDestino || 'DEPOSITO',
          precoVenda: item.precoVenda ? Number(String(item.precoVenda).replace(',', '.')) : undefined,
        })),
      };

      const res = await api.post('/stock/confirm-xml', payload);
      Alert.alert('Sucesso', `Nota Fiscal integrada! ${res.data.processados} produtos atualizados no estoque.`);
      
      // Limpar estados
      setXmlData(null);
      setSelectedFile(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao processar entrada de nota.');
    } finally {
      setLoading(false);
    }
  };

  // Filtro de produto no modal de busca
  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Movimentação de Estoque</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'transfer' && styles.tabActive]}
          onPress={() => setActiveTab('transfer')}
        >
          <Ionicons name="swap-horizontal" size={20} color={activeTab === 'transfer' ? '#2196F3' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'transfer' && styles.tabTextActive]}>
            {isLargeScreen ? 'Transferência (Depósito ➔ Geladeira)' : 'Transferir'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'manual' && styles.tabActive]}
          onPress={() => setActiveTab('manual')}
        >
          <Ionicons name="hand-right-outline" size={20} color={activeTab === 'manual' ? '#2196F3' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
            {isLargeScreen ? 'Lançamento Manual' : 'Manual'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'xml' && styles.tabActive]}
          onPress={() => setActiveTab('xml')}
        >
          <Ionicons name="document-text-outline" size={20} color={activeTab === 'xml' ? '#2196F3' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'xml' && styles.tabTextActive]}>
            {isLargeScreen ? 'Entrada por XML' : 'Entrada XML'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Processando, por favor aguarde...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'transfer' ? (
          /* ============================================================
             ABA: TRANSFERÊNCIA ENTRE LOCAIS (DEPÓSITO <-> GELADEIRA)
             ============================================================ */
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transferência entre Locais de Estoque</Text>
            <Text style={styles.subtitle}>
              Transfira produtos do Depósito para abastecer a Geladeira/Ponto de Venda ou faça devoluções ao Depósito.
            </Text>

            {/* Selecionar Produto */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Produto para Transferência *</Text>
              <TouchableOpacity 
                style={styles.productPicker}
                onPress={() => {
                  setProductSearchTarget('transfer');
                  setShowProductSearchModal(true);
                }}
              >
                <Text style={transferProduct ? styles.pickerTextSelected : styles.pickerText}>
                  {transferProduct ? transferProduct.nome : 'Toque para selecionar um produto'}
                </Text>
                <Ionicons name="search" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Saldo Atual do Produto Selecionado */}
            {transferProduct && (
              <View style={styles.transferBalancesCard}>
                <Text style={styles.balancesTitle}>Saldos Atuais de {transferProduct.nome}:</Text>
                <View style={styles.balancesRow}>
                  <View style={[styles.balanceBox, { borderColor: '#1565C0', backgroundColor: '#E3F2FD' }]}>
                    <Text style={[styles.balanceBoxLabel, { color: '#0D47A1' }]}>📦 Depósito</Text>
                    <Text style={[styles.balanceBoxValue, { color: '#1565C0' }]}>
                      {transferProduct.estoqueDeposito ?? 0}
                    </Text>
                    <Text style={styles.balanceBoxUnit}>{transferProduct.unidade || 'un'}</Text>
                  </View>

                  <View style={styles.balanceArrow}>
                    <Ionicons 
                      name={transferDirection === 'DEP_TO_GEL' ? 'arrow-forward' : 'arrow-back'} 
                      size={24} 
                      color="#2196F3" 
                    />
                  </View>

                  <View style={[styles.balanceBox, { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.balanceBoxLabel, { color: '#1B5E20' }]}>📍 {(transferProduct as any)?.localVendaNome || 'Geladeira'}</Text>
                    <Text style={[styles.balanceBoxValue, { color: '#2E7D32' }]}>
                      {transferProduct.estoqueGeladeira ?? 0}
                    </Text>
                    <Text style={styles.balanceBoxUnit}>{transferProduct.unidade || 'un'}</Text>
                  </View>
                </View>
                <Text style={styles.balanceTotalText}>
                  Total geral em estoque: <Text style={{ fontWeight: 'bold' }}>{transferProduct.quantidade ?? 0} {transferProduct.unidade || 'un'}</Text>
                </Text>
              </View>
            )}

            {/* Direção da Transferência */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sentido da Transferência *</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    transferDirection === 'DEP_TO_GEL' && styles.radioActive,
                    transferDirection === 'DEP_TO_GEL' && { borderColor: '#2196F3' }
                  ]}
                  onPress={() => setTransferDirection('DEP_TO_GEL')}
                >
                  <Ionicons 
                    name="arrow-down-circle-outline" 
                    size={20} 
                    color={transferDirection === 'DEP_TO_GEL' ? '#2196F3' : '#666'} 
                  />
                  <View>
                    <Text style={[styles.radioText, transferDirection === 'DEP_TO_GEL' && { fontWeight: 'bold', color: '#1565C0' }]}>
                      Depósito ➔ {(transferProduct as any)?.localVendaNome || 'Geladeira'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>Abastecer ponto de venda</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    transferDirection === 'GEL_TO_DEP' && styles.radioActive,
                    transferDirection === 'GEL_TO_DEP' && { borderColor: '#FF9800' }
                  ]}
                  onPress={() => setTransferDirection('GEL_TO_DEP')}
                >
                  <Ionicons 
                    name="arrow-up-circle-outline" 
                    size={20} 
                    color={transferDirection === 'GEL_TO_DEP' ? '#FF9800' : '#666'} 
                  />
                  <View>
                    <Text style={[styles.radioText, transferDirection === 'GEL_TO_DEP' && { fontWeight: 'bold', color: '#E65100' }]}>
                      {(transferProduct as any)?.localVendaNome || 'Geladeira'} ➔ Depósito
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>Devolução ao depósito</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quantidade */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantidade a Transferir *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 12"
                value={transferQty}
                onChangeText={setTransferQty}
                keyboardType="numeric"
              />

              {/* Botões rápidos de atalho */}
              <View style={styles.quickQtyContainer}>
                <Text style={styles.quickQtyLabel}>Atalhos rápidos:</Text>
                {[1, 6, 12, 24].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={styles.quickQtyBtn}
                    onPress={() => {
                      const cur = parseInt(transferQty) || 0;
                      setTransferQty(String(cur + n));
                    }}
                  >
                    <Text style={styles.quickQtyBtnText}>+{n}</Text>
                  </TouchableOpacity>
                ))}
                {transferProduct && transferDirection === 'DEP_TO_GEL' && (transferProduct.estoqueDeposito ?? 0) > 0 && (
                  <TouchableOpacity
                    style={[styles.quickQtyBtn, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}
                    onPress={() => setTransferQty(String(transferProduct.estoqueDeposito))}
                  >
                    <Text style={[styles.quickQtyBtnText, { color: '#1565C0' }]}>
                      Tudo ({transferProduct.estoqueDeposito})
                    </Text>
                  </TouchableOpacity>
                )}
                {transferQty !== '' && (
                  <TouchableOpacity
                    style={[styles.quickQtyBtn, { backgroundColor: '#FFEBEE', borderColor: '#F44336' }]}
                    onPress={() => setTransferQty('')}
                  >
                    <Text style={[styles.quickQtyBtnText, { color: '#C62828' }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Aviso se a quantidade for maior que a origem */}
            {transferProduct && Number(transferQty) > 0 && (
              (() => {
                const maxAvailable = transferDirection === 'DEP_TO_GEL' 
                  ? (transferProduct.estoqueDeposito ?? 0) 
                  : (transferProduct.estoqueGeladeira ?? 0);
                const locNome = transferDirection === 'DEP_TO_GEL' ? 'Depósito' : ((transferProduct as any)?.localVendaNome || 'Geladeira');
                if (Number(transferQty) > maxAvailable) {
                  return (
                    <View style={styles.transferWarningBox}>
                      <Ionicons name="warning-outline" size={18} color="#E65100" />
                      <Text style={styles.transferWarningText}>
                        Aviso: O saldo atual no {locNome} ({maxAvailable} un) é menor que a quantidade a transferir ({transferQty} un). O saldo do {locNome} ficará negativo.
                      </Text>
                    </View>
                  );
                }
                return null;
              })()
            )}

            {/* Observações */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Observações / Motivo (Opcional)</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Ex: Abastecimento da geladeira principal para o turno"
                value={transferObs}
                onChangeText={setTransferObs}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Botão Transferir */}
            <TouchableOpacity 
              style={[
                styles.transferButton,
                (!transferProduct || !transferQty || Number(transferQty) <= 0) && styles.disabledButton
              ]}
              onPress={handleTransferStock}
              disabled={!transferProduct || !transferQty || Number(transferQty) <= 0}
            >
              <Ionicons name="swap-horizontal" size={22} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.transferButtonText}>Confirmar Transferência</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'manual' ? (
          /* ============================================================
             ABA: MANUAL
             ============================================================ */
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Registrar Entrada / Saída Manual</Text>

            {/* Selecionar Produto */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Produto *</Text>
              <TouchableOpacity 
                style={styles.productPicker}
                onPress={() => {
                  setProductSearchTarget('manual');
                  setShowProductSearchModal(true);
                }}
              >
                <Text style={selectedProduct ? styles.pickerTextSelected : styles.pickerText}>
                  {selectedProduct 
                    ? `${selectedProduct.nome} (Total: ${selectedProduct.quantidade} | Dep: ${selectedProduct.estoqueDeposito ?? 0} | 📍 ${(selectedProduct as any).localVendaNome || 'Ponto de Venda'}: ${selectedProduct.estoqueGeladeira ?? 0} ${selectedProduct.unidade || 'un'})` 
                    : 'Toque para selecionar um produto'}
                </Text>
                <Ionicons name="search" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Tipo de Movimento */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo de Movimentação *</Text>
              <View style={styles.row}>
                {(['ENTRADA', 'SAIDA', 'AJUSTE'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.radioOption,
                      movementType === type && styles.radioActive,
                      movementType === type && type === 'ENTRADA' && { borderColor: '#4CAF50' },
                      movementType === type && type === 'SAIDA' && { borderColor: '#F44336' },
                      movementType === type && type === 'AJUSTE' && { borderColor: '#FF9800' },
                    ]}
                    onPress={() => {
                      setMovementType(type);
                      setReason(reasonsInput[type][0].key);
                      if (type === 'ENTRADA') setManualLocal('DEPOSITO');
                      if (type === 'SAIDA') setManualLocal('GELADEIRA');
                    }}
                  >
                    <Ionicons 
                      name={type === 'ENTRADA' ? 'add-circle-outline' : type === 'SAIDA' ? 'remove-circle-outline' : 'git-compare-outline'} 
                      size={18} 
                      color={movementType === type ? (type === 'ENTRADA' ? '#4CAF50' : type === 'SAIDA' ? '#F44336' : '#FF9800') : '#666'} 
                    />
                    <Text style={[styles.radioText, movementType === type && { fontWeight: 'bold' }]}>
                      {type === 'ENTRADA' ? 'Entrada (+)' : type === 'SAIDA' ? 'Saída (-)' : 'Ajuste Saldo'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Local da Movimentação */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Local do Estoque *</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    manualLocal === 'DEPOSITO' && styles.radioActive,
                    manualLocal === 'DEPOSITO' && { borderColor: '#1565C0' }
                  ]}
                  onPress={() => setManualLocal('DEPOSITO')}
                >
                  <Ionicons 
                    name="cube-outline" 
                    size={18} 
                    color={manualLocal === 'DEPOSITO' ? '#1565C0' : '#666'} 
                  />
                  <Text style={[styles.radioText, manualLocal === 'DEPOSITO' && { fontWeight: 'bold', color: '#1565C0' }]}>
                    📦 Depósito
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    manualLocal === 'GELADEIRA' && styles.radioActive,
                    manualLocal === 'GELADEIRA' && { borderColor: '#2E7D32' }
                  ]}
                  onPress={() => setManualLocal('GELADEIRA')}
                >
                  <Ionicons 
                    name="snow-outline" 
                    size={18} 
                    color={manualLocal === 'GELADEIRA' ? '#2E7D32' : '#666'} 
                  />
                  <Text style={[styles.radioText, manualLocal === 'GELADEIRA' && { fontWeight: 'bold', color: '#2E7D32' }]}>
                    📍 {(selectedProduct as any)?.localVendaNome || 'Ponto de Venda'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              {/* Quantidade */}
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Quantidade *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 10"
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                />
              </View>

              {/* Preço de Custo (Opcional) */}
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Novo Preço Custo R$ (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 4.50"
                  value={costPrice}
                  onChangeText={setCostPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Motivo */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Motivo *</Text>
              <View style={styles.reasonsContainer}>
                {reasonsInput[movementType].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.reasonChip, reason === item.key && styles.reasonChipActive]}
                    onPress={() => setReason(item.key)}
                  >
                    <Text style={[styles.reasonChipText, reason === item.key && styles.reasonChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Fornecedor (Opcional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Fornecedor (Opcional)</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={[styles.pickerWrapper, { flex: 1 }]}>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 8,
                      borderColor: '#DDD',
                      borderWidth: 1,
                      paddingLeft: 12,
                      fontSize: 16,
                      backgroundColor: '#FFF',
                      outline: 'none',
                    }}
                  >
                    <option value="">Nenhum / Não informado</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.razaoSocial} ({sup.cnpj})</option>
                    ))}
                  </select>
                </View>
                <TouchableOpacity 
                  style={{
                    backgroundColor: '#4CAF50',
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowSupplierModal(true)}
                >
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Observações */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Observações / Detalhes</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Detalhes sobre a quebra, perda ou entrada..."
                value={obs}
                onChangeText={setObs}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveManual}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Gravar Movimentação</Text>
            </TouchableOpacity>

          </View>
        ) : (
          /* ============================================================
             ABA: XML
             ============================================================ */
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dar Entrada por Nota Fiscal Eletrônica (XML)</Text>
            <Text style={styles.subtitle}>Selecione o arquivo XML da NF-e para processar os itens e importá-los.</Text>

            <View style={{ backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="information-circle" size={20} color="#1565C0" />
              <Text style={{ fontSize: 13, color: '#0D47A1', flex: 1 }}>
                <Text style={{ fontWeight: 'bold' }}>Distribuição de Estoque:</Text> Escolha o destino de cada produto (Depósito, Geladeiras, Balcão, Cozinha, etc.) ou use os botões rápidos abaixo para direcionar tudo ao Depósito ou aos Locais Padrão.
              </Text>
            </View>

            {/* File Input */}
            <View style={styles.xmlUploadArea}>
              <Ionicons name="cloud-upload-outline" size={48} color="#2196F3" />
              <Text style={styles.xmlUploadTitle}>Carregar arquivo .xml de compra</Text>
              <Text style={styles.xmlUploadSubtitle}>Formatos aceitos: XML de NF-e</Text>
              
              <input
                type="file"
                accept=".xml"
                onChange={handleSelectXml}
                style={{
                  marginTop: 16,
                  cursor: 'pointer',
                }}
              />
            </View>

            {/* XML Dados Carregados */}
            {xmlData && (
              <View style={styles.xmlResultContainer}>
                <View style={styles.xmlHeaderCard}>
                  <Text style={styles.xmlTitle}>Chave: {xmlData.chave}</Text>
                  <View style={styles.fornecedorBadge}>
                    <Text style={styles.fornecedorText}>
                      Fornecedor: <Text style={{ fontWeight: 'bold' }}>{xmlData.fornecedor.razaoSocial}</Text>
                    </Text>
                    <Text style={styles.fornecedorSubtext}>CNPJ: {xmlData.fornecedor.cnpj}</Text>
                    {xmlData.fornecedor.novo && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>Novo Fornecedor</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <Text style={styles.tableTitle}>Itens da Nota Fiscal ({xmlData.itens.length})</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity 
                      onPress={() => handleSetAllXmlDestino('DEPOSITO')}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E3F2FD', borderRadius: 6, borderWidth: 1, borderColor: '#90CAF9', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="cube-outline" size={14} color="#1565C0" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1565C0' }}>📦 Tudo para Depósito</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleSetAllXmlDestino('PADRAO')}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#A5D6A7', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="storefront-outline" size={14} color="#2E7D32" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2E7D32' }}>📍 Aplicar Locais Padrão</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {xmlData.itens.map((item, index) => {
                  const fatorNum = Number(item.fatorConversao) || 1;
                  const custoConvertido = (item.vUnCom / fatorNum).toFixed(2);
                  const qtdEntrada = (item.qCom * fatorNum);

                  return (
                    <View key={index} style={styles.xmlItemRow}>
                      <View style={styles.xmlItemLeft}>
                        <Text style={styles.xmlItemName}>{item.xProd}</Text>
                        <Text style={styles.xmlItemEan}>Cód. Barras: {item.cEAN || 'Sem código'}</Text>
                        <Text style={styles.xmlItemDetails}>
                          Qtd XML: <Text style={{ fontWeight: 'bold' }}>{item.qCom} {item.uCom}</Text> | Custo NF: R$ {item.vUnCom.toFixed(2)} | Total: R$ {item.vProd.toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#00838F', marginTop: 3, fontWeight: '600' }}>
                          ➜ Custo Real: R$ {custoConvertido} / un (Entrada: {qtdEntrada} un)
                        </Text>

                        {/* Seletor de Destino do Estoque */}
                        <View style={{ marginTop: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>
                            Destino do Estoque:
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                            <TouchableOpacity
                              onPress={() => handleItemDestinoChange(index, 'DEPOSITO')}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: (!item.localDestino || item.localDestino === 'DEPOSITO') ? '#1E293B' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: (!item.localDestino || item.localDestino === 'DEPOSITO') ? '#1E293B' : '#CBD5E1',
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: (!item.localDestino || item.localDestino === 'DEPOSITO') ? 'bold' : 'normal', color: (!item.localDestino || item.localDestino === 'DEPOSITO') ? '#fff' : '#475569' }}>
                                📦 Depósito
                              </Text>
                            </TouchableOpacity>

                            {locaisEstoque.map(loc => {
                              const isSelected = item.localDestino === loc.nome;
                              return (
                                <TouchableOpacity
                                  key={loc.id}
                                  onPress={() => handleItemDestinoChange(index, loc.nome)}
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                    backgroundColor: isSelected ? '#0284C7' : '#F1F5F9',
                                    borderWidth: 1,
                                    borderColor: isSelected ? '#0284C7' : '#CBD5E1',
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#fff' : '#475569' }}>
                                    {loc.tipo === 'GELADEIRA' ? '❄️ ' : loc.tipo === 'COZINHA' ? '🍳 ' : '📍 '}{loc.nome}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </View>

                      <View style={styles.xmlItemRight}>
                        {/* Fator de conversão */}
                        <View style={styles.fatorGroup}>
                          <Text style={styles.fatorLabel}>Fator Conv.</Text>
                          <TextInput
                            style={styles.fatorInput}
                            value={String(item.fatorConversao)}
                            onChangeText={(val) => handleFatorChange(index, val)}
                            keyboardType="numeric"
                          />
                        </View>

                        {/* Preço de Venda (Ajustar margem caso custo subiu) */}
                        {(item.productId || item.cadastrarNovo) && (
                          <View style={styles.precoVendaGroup}>
                            <Text style={styles.precoVendaLabel}>Preço Venda R$</Text>
                            <TextInput
                              style={styles.precoVendaInput}
                              placeholder="Ex: 10.00"
                              value={item.precoVenda !== undefined ? String(item.precoVenda) : ''}
                              onChangeText={(val) => handlePrecoVendaChange(index, val)}
                              keyboardType="numeric"
                            />
                          </View>
                        )}

                        {/* Produto Associado */}
                        <View style={styles.associationGroup}>
                          {item.productId || item.cadastrarNovo ? (
                            <View style={styles.associationActive}>
                              <Text style={styles.associationText} numberOfLines={1}>
                                Vínculo: {item.productName}
                              </Text>
                              <TouchableOpacity 
                                style={styles.removeAssociationBtn}
                                onPress={() => handleRemoveAssociation(index)}
                              >
                                <Ionicons name="trash-outline" size={14} color="#F44336" />
                                <Text style={styles.removeAssociationText}>Alterar</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={styles.associationPending}>
                              <TouchableOpacity 
                                style={styles.associateBtn}
                                onPress={() => handleItemAssociation(index)}
                              >
                                <Ionicons name="link-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.associateBtnText}>Vincular / Cadastrar</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity 
                  style={styles.confirmXmlButton}
                  onPress={handleConfirmXml}
                >
                  <Ionicons name="cloud-done-outline" size={24} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmXmlButtonText}>Confirmar Entrada da Nota Fiscal</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de Busca de Produtos (Manual) */}
      <Modal
        visible={showProductSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buscar Produto</Text>
              <TouchableOpacity onPress={() => setShowProductSearchModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Digite o nome do produto..."
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productSearchItem}
                  onPress={() => {
                    if (productSearchTarget === 'transfer') {
                      setTransferProduct(item);
                    } else {
                      setSelectedProduct(item);
                    }
                    setShowProductSearchModal(false);
                    setProductSearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productSearchName}>{item.nome}</Text>
                    <Text style={styles.productSearchStock}>
                      Total: {item.quantidade} {item.unidade || 'un'} (📦 Dep: {item.estoqueDeposito ?? 0} | 📍 {(item as any).localVendaNome || 'Ponto de Venda'}: {item.estoqueGeladeira ?? 0})
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Associação / Cadastro de Produto (XML) */}
      <Modal
        visible={showNewProductModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowNewProductModal(false);
          setAssociatingItemIndex(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', width: isLargeScreen ? '60%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Associar Item do XML</Text>
              <TouchableOpacity onPress={() => {
                setShowNewProductModal(false);
                setAssociatingItemIndex(null);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {associatingItemIndex !== null && xmlData && (
                <View style={styles.xmlItemInfoCard}>
                  <Text style={styles.xmlItemInfoTitle}>Item no XML:</Text>
                  <Text style={styles.xmlItemInfoText}>{xmlData.itens[associatingItemIndex].xProd}</Text>
                  {xmlData.itens[associatingItemIndex].cEAN && (
                    <Text style={styles.xmlItemInfoEan}>Cód. Barras: {xmlData.itens[associatingItemIndex].cEAN}</Text>
                  )}
                </View>
              )}

              {/* Opção A: Associar a produto cadastrado */}
              <Text style={styles.subModalTitle}>Opção A: Vincular a Produto Existente</Text>
              
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar produto no catálogo..."
                  value={productSearch}
                  onChangeText={setProductSearch}
                />
              </View>

              <View style={styles.catalogList}>
                {filteredProducts.slice(0, 5).map(prod => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.catalogItem}
                    onPress={() => handleAssociateExisting(prod)}
                  >
                    <View>
                      <Text style={styles.catalogItemName}>{prod.nome}</Text>
                      <Text style={styles.catalogItemStock}>Estoque: {prod.quantidade} {prod.unidade}</Text>
                    </View>
                    <View style={styles.associateLink}>
                      <Text style={styles.associateLinkText}>Vincular</Text>
                      <Ionicons name="link" size={16} color="#2196F3" />
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredProducts.length === 0 && (
                  <Text style={styles.noCatalogText}>Nenhum produto cadastrado com esse termo.</Text>
                )}
              </View>

              {/* Opção B: Cadastrar como novo produto */}
              <Text style={[styles.subModalTitle, { marginTop: 24 }]}>Opção B: Cadastrar como NOVO Produto</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome Comercial no Sistema *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Cerveja Heineken Long Neck 330ml"
                  value={tempNewProduct.nome}
                  onChangeText={(val) => setTempNewProduct({ ...tempNewProduct, nome: val })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Preço de Venda R$ *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 8.50"
                    value={tempNewProduct.precoVenda}
                    onChangeText={(val) => setTempNewProduct({ ...tempNewProduct, precoVenda: val })}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Unidade Medida</Text>
                  <select
                    value={tempNewProduct.unidade}
                    onChange={(e) => setTempNewProduct({ ...tempNewProduct, unidade: e.target.value })}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 8,
                      borderColor: '#DDD',
                      borderWidth: 1,
                      paddingLeft: 12,
                      fontSize: 16,
                      backgroundColor: '#FFF',
                      outline: 'none',
                    }}
                  >
                    <option value="un">un (Unidade)</option>
                    <option value="kg">kg (Quilo)</option>
                    <option value="pc">pc (Peça)</option>
                    <option value="lt">lt (Litro)</option>
                  </select>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Categoria</Text>
                  <select
                    value={tempNewProduct.categoria}
                    onChange={(e) => setTempNewProduct({ ...tempNewProduct, categoria: e.target.value })}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 8,
                      borderColor: '#DDD',
                      borderWidth: 1,
                      paddingLeft: 12,
                      fontSize: 16,
                      backgroundColor: '#FFF',
                      outline: 'none',
                    }}
                  >
                    {categorias.map(cat => (
                      <option key={cat.id || cat.nome} value={cat.nome}>{cat.nome}</option>
                    ))}
                  </select>
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Tipo</Text>
                  <select
                    value={tempNewProduct.tipo}
                    onChange={(e) => setTempNewProduct({ ...tempNewProduct, tipo: e.target.value })}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 8,
                      borderColor: '#DDD',
                      borderWidth: 1,
                      paddingLeft: 12,
                      fontSize: 16,
                      backgroundColor: '#FFF',
                      outline: 'none',
                    }}
                  >
                    {tipos.map(tip => (
                      <option key={tip.id || tip.nome} value={tip.nome}>{tip.nome}</option>
                    ))}
                  </select>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Local de Venda Padrão (Onde o produto fica)</Text>
                <select
                  value={tempNewProduct.localVendaNome}
                  onChange={(e) => setTempNewProduct({ ...tempNewProduct, localVendaNome: e.target.value })}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 8,
                    borderColor: '#DDD',
                    borderWidth: 1,
                    paddingLeft: 12,
                    fontSize: 16,
                    backgroundColor: '#FFF',
                    outline: 'none',
                  }}
                >
                  {locaisEstoque.map(loc => (
                    <option key={loc.id || loc.nome} value={loc.nome}>{loc.nome}</option>
                  ))}
                </select>
              </View>

              <TouchableOpacity 
                style={styles.saveNewProductBtn}
                onPress={handleSaveTempNewProduct}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveNewProductBtnText}>Salvar e Cadastrar Produto</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro de Fornecedor */}
      <Modal
        visible={showSupplierModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', width: isLargeScreen ? '60%' : '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cadastrar Novo Fornecedor</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Seção 1: Dados Gerais */}
              <Text style={styles.subModalTitle}>Dados Principais</Text>
              
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>CNPJ *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 00.000.000/0000-00"
                    value={supplierCnpj}
                    onChangeText={setSupplierCnpj}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Tipo de Fornecedor</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Bebida, Pão, Carnes"
                    value={supplierTipo}
                    onChangeText={setSupplierTipo}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Razão Social *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Fornecedora de Bebidas Ltda"
                  value={supplierRazaoSocial}
                  onChangeText={setSupplierRazaoSocial}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome Fantasia</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Distribuidora Gelo Rápido"
                  value={supplierNomeFantasia}
                  onChangeText={setSupplierNomeFantasia}
                />
              </View>

              {/* Seção 2: Contato */}
              <Text style={[styles.subModalTitle, { marginTop: 16 }]}>Contato</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome do Contato / Vendedor</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: João da Ambev"
                  value={supplierNomeContato}
                  onChangeText={setSupplierNomeContato}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: (11) 99999-9999"
                    value={supplierTelefone}
                    onChangeText={setSupplierTelefone}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: vendas@fornecedor.com"
                    value={supplierEmail}
                    onChangeText={setSupplierEmail}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* Seção 3: Endereço */}
              <Text style={[styles.subModalTitle, { marginTop: 16 }]}>Endereço Completo</Text>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>CEP</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 01000-000"
                    value={supplierCep}
                    onChangeText={setSupplierCep}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 2 }]}>
                  <Text style={styles.label}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: São Paulo"
                    value={supplierCidade}
                    onChangeText={setSupplierCidade}
                  />
                </View>

                <View style={[styles.formGroup, { width: 60 }]}>
                  <Text style={styles.label}>UF</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="SP"
                    value={supplierUf}
                    onChangeText={setSupplierUf}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Bairro</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Centro"
                  value={supplierBairro}
                  onChangeText={setSupplierBairro}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 3, marginRight: 10 }]}>
                  <Text style={styles.label}>Logradouro</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Avenida Paulista"
                    value={supplierLogradouro}
                    onChangeText={setSupplierLogradouro}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Número</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1000"
                    value={supplierNumero}
                    onChangeText={setSupplierNumero}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Complemento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Sala 42 / Bloco A"
                  value={supplierComplemento}
                  onChangeText={setSupplierComplemento}
                />
              </View>

              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveSupplier}
              >
                <Ionicons name="checkmark-done-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Gravar Fornecedor</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    height: 60,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#2196F3',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFF',
  },
  productPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
  },
  pickerText: {
    fontSize: 14,
    color: '#999',
  },
  pickerTextSelected: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  radioOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 8,
    gap: 6,
  },
  radioActive: {
    borderWidth: 2,
    backgroundColor: '#FAF9F9',
  },
  radioText: {
    fontSize: 14,
    color: '#333',
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  reasonChipActive: {
    backgroundColor: '#2196F3',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  reasonChipTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  pickerWrapper: {
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  
  // XML Upload
  xmlUploadArea: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#F4F9FF',
    marginBottom: 20,
  },
  xmlUploadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  xmlUploadSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  xmlResultContainer: {
    marginTop: 10,
  },
  xmlHeaderCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  xmlTitle: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fornecedorBadge: {
    marginTop: 8,
  },
  fornecedorText: {
    fontSize: 16,
    color: '#333',
  },
  fornecedorSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  newBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  xmlItemRow: {
    flexDirection: isLargeScreen ? 'row' : 'column',
    backgroundColor: '#FFF',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: isLargeScreen ? 'center' : 'stretch',
    gap: 12,
  },
  xmlItemLeft: {
    flex: 2,
  },
  xmlItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  xmlItemEan: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  xmlItemDetails: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  xmlItemRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'flex-end',
  },
  fatorGroup: {
    alignItems: 'center',
    width: 70,
  },
  fatorLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  fatorInput: {
    height: 36,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 6,
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  precoVendaGroup: {
    alignItems: 'center',
    width: 90,
  },
  precoVendaLabel: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  precoVendaInput: {
    height: 36,
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 6,
    width: '100%',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0369A1',
    backgroundColor: '#F0F9FF',
  },
  associationGroup: {
    flex: 1,
    minWidth: 150,
  },
  associationActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
  },
  associationText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  removeAssociationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  removeAssociationText: {
    fontSize: 10,
    color: '#F44336',
  },
  associationPending: {
    borderRadius: 6,
  },
  associateBtn: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  associateBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmXmlButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmXmlButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: isLargeScreen ? '40%' : '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  productSearchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productSearchName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  productSearchStock: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  
  // Associar no XML modal
  xmlItemInfoCard: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  xmlItemInfoTitle: {
    fontSize: 11,
    color: '#F57F17',
    fontWeight: 'bold',
  },
  xmlItemInfoText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },
  xmlItemInfoEan: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  subModalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 12,
  },
  catalogList: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  catalogItemStock: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  associateLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  associateLinkText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  noCatalogText: {
    padding: 16,
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
  saveNewProductBtn: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 8,
    marginTop: 16,
  },
  saveNewProductBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Estilos de Transferência
  transferBalancesCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  balancesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  balancesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  balanceBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  balanceBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  balanceBoxUnit: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  balanceArrow: {
    paddingHorizontal: 4,
  },
  balanceTotalText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
  },
  quickQtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickQtyLabel: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 4,
  },
  quickQtyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  quickQtyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  transferWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
    gap: 8,
  },
  transferWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 16,
  },
  transferButton: {
    backgroundColor: '#00838F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#00838F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  transferButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
    elevation: 0,
  },
});
