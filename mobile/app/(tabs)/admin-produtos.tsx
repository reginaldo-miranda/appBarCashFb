import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import {
  View,
  Linking,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeIcon } from '../../components/SafeIcon';
import { Ionicons } from '@expo/vector-icons';
import api, { productService, categoryService, typeService, unidadeMedidaService, setorImpressaoService, stockService, getProductImageUrl } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { testApiConnection, getCurrentBaseUrl } from '../../src/services/api';
import BulkProductModal from '../../src/components/BulkProductModal';
import BulkFiscalModal from '../../src/components/BulkFiscalModal';
import SmartBatchProductModal from '../../src/components/SmartBatchProductModal';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isLargeScreen = width > 768;

interface Product {
  _id: string;
  nome: string;
  descricao: string;
  precoCusto: number;
  precoVenda: number;
  categoria: string;
  tipo: string;
  grupo: string;
  unidade: string;
  ativo: boolean;
  quantidade: number;
  estoqueDeposito?: number;
  estoqueGeladeira?: number;
  localVendaId?: number;
  localVendaNome?: string;
  disponivel: boolean;
  imagem?: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  csosn?: string;
  origem?: number;
  ibsCst?: string;
  ibsClassTrib?: string;
  ibsAliquota?: number;
  cbsCst?: string;
  cbsClassTrib?: string;
  cbsAliquota?: number;
  isAliquota?: number;
}

interface Categoria {
  _id: string;
  id?: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface Tipo {
  _id: string;
  id?: string;
  nome: string;
  ativo: boolean;
}

interface UnidadeMedida {
  _id: string;
  id?: string;
  nome: string;
  sigla: string;
  ativo: boolean;
}

interface SetorImpressao {
  id: string;
  nome: string;
  modoEnvio: 'impressora' | 'whatsapp';
}

export default function AdminProdutosScreen() {
  const { hasPermission } = useAuth() as any;
  const [products, setProducts] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'nome' | 'categoria' | 'preco'>('nome');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterSemSetor, setFilterSemSetor] = useState(false);
  const [filterSemFiscal, setFilterSemFiscal] = useState(false);
  const [showBulkFiscalModal, setShowBulkFiscalModal] = useState(false);
  const [showSmartBatchModal, setShowSmartBatchModal] = useState(false);
  const [dbTarget, setDbTarget] = useState('');
  const [apiHost, setApiHost] = useState('');
  const [setores, setSetores] = useState<SetorImpressao[]>([]);
  const [selectedSetores, setSelectedSetores] = useState<string[] | null>(null);
  const [locaisEstoque, setLocaisEstoque] = useState<any[]>([]);
  const [selectedLocalFilter, setSelectedLocalFilter] = useState<string>('');
  const [showLocalMenu, setShowLocalMenu] = useState(false);
  const [showModalNovoLocal, setShowModalNovoLocal] = useState(false);
  const [novoLocalNome, setNovoLocalNome] = useState('');
  const [novoLocalTipo, setNovoLocalTipo] = useState('GELADEIRA');
  const [showModalNovaCategoria, setShowModalNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [loadingNovaCategoria, setLoadingNovaCategoria] = useState(false);

  // Filtros para o SearchAndFilter
  const categoryFilters = [
    { key: '', label: 'Todas' },
    ...(categorias || []).map(categoria => ({ key: categoria.nome, label: categoria.nome }))
  ];

  const statusFilters = [
    { key: '', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'inativo', label: 'Inativos' },
    { key: 'sem-setor', label: 'Sem Setor' }
  ];

  const handleFilterChange = (filterKey: string) => {
    if (statusFilters.some(filter => filter.key === filterKey)) {
      // É um filtro de status ou setor
      if (filterKey === '') {
        setFilterActive(null);
        setFilterSemSetor(false);
      } else if (filterKey === 'ativo') {
        setFilterActive(true);
        setFilterSemSetor(false);
      } else if (filterKey === 'inativo') {
        setFilterActive(false);
        setFilterSemSetor(false);
      } else if (filterKey === 'sem-setor') {
        setFilterActive(null);
        setFilterSemSetor(true);
      }
    } else {
      // É um filtro de categoria
      setSelectedCategory(filterKey);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    precoCusto: '',
    precoVenda: '',
    categoria: '',
    tipo: '',
    grupo: '',
    unidade: 'un',
    ativo: true,
    quantidade: '0',
    estoqueDeposito: '0',
    estoqueGeladeira: '0',
    localVendaNome: 'Geladeira 1',
    localVendaId: null as number | null,
    disponivel: true,
    imagem: '',
    ncm: '',
    cest: '',
    cfop: '',
    csosn: '102',
    origem: '0',
    ibsCst: '410',
    ibsClassTrib: '410031',
    ibsAliquota: '',
    cbsCst: '410',
    cbsClassTrib: '410031',
    cbsAliquota: '',
    isAliquota: '',
    temTamanhos: false,
    temVariacao: false,
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [tamanhos, setTamanhos] = useState<{ id?: number; nome: string; preco: string }[]>([]);
  const [showNcmMenu, setShowNcmMenu] = useState(false);
  const [showReformaTributaria, setShowReformaTributaria] = useState(false);

  // Defaults fiscais configuráveis da Reforma Tributária
  const [fiscalDefaults, setFiscalDefaults] = useState({
    ibsCst: '410',
    ibsClassTrib: '410031',
    ibsAliquota: '',
    cbsCst: '410',
    cbsClassTrib: '410031',
    cbsAliquota: '',
    isAliquota: '',
  });
  const [puxadoIndividualFeedback, setPuxadoIndividualFeedback] = useState(false);

  const loadFiscalDefaults = async () => {
    try {
      const res = await api.get('/config/fiscal-reforma');
      if (res.data?.ok && res.data?.data) {
        setFiscalDefaults({
          ibsCst: res.data.data.defaultIbsCst ?? '410',
          ibsClassTrib: res.data.data.defaultIbsClassTrib ?? '410031',
          ibsAliquota: res.data.data.defaultIbsAliquota || '',
          cbsCst: res.data.data.defaultCbsCst ?? '410',
          cbsClassTrib: res.data.data.defaultCbsClassTrib ?? '410031',
          cbsAliquota: res.data.data.defaultCbsAliquota || '',
          isAliquota: res.data.data.defaultIsAliquota || '',
        });
      }
    } catch {}
  };

  const handlePuxarConfigReformaIndividual = async () => {
    try {
      const res = await api.get('/config/fiscal-reforma');
      if (res.data?.ok && res.data?.data) {
        const d = res.data.data;
        setFormData(prev => ({
          ...prev,
          ibsCst: d.defaultIbsCst ?? '410',
          ibsClassTrib: d.defaultIbsClassTrib ?? '410031',
          ibsAliquota: d.defaultIbsAliquota || '',
          cbsCst: d.defaultCbsCst ?? '410',
          cbsClassTrib: d.defaultCbsClassTrib ?? '410031',
          cbsAliquota: d.defaultCbsAliquota || '',
          isAliquota: d.defaultIsAliquota || '',
        }));
        setShowReformaTributaria(true);
        setPuxadoIndividualFeedback(true);
        setTimeout(() => setPuxadoIndividualFeedback(false), 3000);
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert('Erro: Não foi possível carregar as configurações da Reforma Tributária.');
      } else {
        Alert.alert('Erro', 'Não foi possível carregar as configurações da Reforma Tributária.');
      }
    }
  };

  const handleSearchNcm = (engine: 'cosmos' | 'google') => {
    setShowNcmMenu(false);
    const termo = (formData.nome || '').trim();
    let url = '';
    if (engine === 'cosmos') {
      url = termo 
        ? `https://cosmos.bluesoft.com.br/pesquisa?q=${encodeURIComponent(termo)}`
        : 'https://cosmos.bluesoft.com.br/';
    } else {
      url = termo
        ? `https://www.google.com/search?q=NCM+${encodeURIComponent(termo)}+tabela+TIPI`
        : 'https://www.google.com/search?q=tabela+NCM+consulta';
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    } else {
      Linking.openURL(url).catch(err => {
        Alert.alert('Erro', 'Não foi possível abrir o navegador.');
      });
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkModal(false);
    setModalVisible(false);
    loadInitialData();
    Alert.alert('Sucesso', 'Produtos replicados com sucesso!');
  };

  const getBaseProductForBulk = () => {
    const parseValue = (val: any) => {
      if (!val) return 0;
      return parseFloat(val.toString().replace(',', '.')) || 0;
    };
    return {
      nome: formData.nome,
      descricao: formData.descricao,
      preco: formData.precoVenda,
      precoVenda: parseValue(formData.precoVenda),
      precoCusto: parseValue(formData.precoCusto),
      categoria: formData.categoria,
      tipo: formData.tipo,
      grupo: formData.grupo,
      unidade: formData.unidade || 'un',
      ativo: formData.ativo,
      quantidade: (parseInt(formData.estoqueDeposito) || 0) + (parseInt(formData.estoqueGeladeira) || 0),
      estoqueDeposito: parseInt(formData.estoqueDeposito) || 0,
      estoqueGeladeira: parseInt(formData.estoqueGeladeira) || 0,
      localVendaNome: formData.localVendaNome || 'Geladeira 1',
      localVendaId: formData.localVendaId || undefined,
      disponivel: formData.disponivel,
      imagem: formData.imagem || null,
      temVariacao: formData.temVariacao,
      temTamanhos: formData.temTamanhos,
      tamanhos: tamanhos,
      ncm: formData.ncm,
      cest: formData.cest,
      cfop: formData.cfop,
      csosn: formData.csosn ? formData.csosn.replace(/\D/g, '') : '102',
      origem: parseInt(formData.origem) || 0,
      ibsCst: formData.ibsCst ? formData.ibsCst.replace(/\D/g, '') : (formData.ibsClassTrib?.startsWith('410') ? '410' : (fiscalDefaults.ibsCst || '000')),
      ibsClassTrib: formData.ibsClassTrib ? formData.ibsClassTrib.replace(/\D/g, '') : (fiscalDefaults.ibsClassTrib || '410031'),
      ibsAliquota: formData.ibsAliquota !== '' ? parseFloat(formData.ibsAliquota.replace(',', '.')) : null,
      cbsCst: formData.cbsCst ? formData.cbsCst.replace(/\D/g, '') : (formData.cbsClassTrib?.startsWith('410') ? '410' : (fiscalDefaults.cbsCst || '000')),
      cbsClassTrib: formData.cbsClassTrib ? formData.cbsClassTrib.replace(/\D/g, '') : (fiscalDefaults.cbsClassTrib || '410031'),
      cbsAliquota: formData.cbsAliquota !== '' ? parseFloat(formData.cbsAliquota.replace(',', '.')) : null,
      isAliquota: formData.isAliquota !== '' ? parseFloat(formData.isAliquota.replace(',', '.')) : null,
      setoresImpressaoIds: selectedSetores !== null ? selectedSetores.map((id) => Number(id)) : undefined,
    };
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            setUploadingImage(true);
            const data = new FormData();
            data.append('image', file);
            const res = await productService.uploadImage(data);
            if (res.data?.imageUrl) {
              setFormData((prev: any) => ({ ...prev, imagem: res.data.imageUrl }));
            }
          } catch (err: any) {
            console.error('Erro no upload de foto:', err);
            const msg = err?.response?.data?.error || err.message || 'Erro ao enviar foto';
            Alert.alert('Erro', msg);
          } finally {
            setUploadingImage(false);
          }
        };
        input.click();
      } catch (err: any) {
        console.error('Erro ao abrir seletor web:', err);
      }
    } else {
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: 'image/*',
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (res.canceled) return;
        const file = res.assets ? res.assets[0] : (res as any);
        if (!file) return;

        setUploadingImage(true);
        const data = new FormData();
        data.append('image', {
          uri: file.uri,
          name: file.name || 'foto_produto.jpg',
          type: file.mimeType || 'image/jpeg',
        } as any);

        const response = await productService.uploadImage(data);
        if (response.data?.imageUrl) {
          setFormData((prev: any) => ({ ...prev, imagem: response.data.imageUrl }));
        }
      } catch (err: any) {
        console.error('Erro ao selecionar foto:', err);
        const msg = err?.response?.data?.error || err.message || 'Erro ao carregar foto';
        Alert.alert('Erro', msg);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    const off = events.on('dbTargetChanged', () => {
      loadInitialData();
    });
    return () => { off && off(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const base = getCurrentBaseUrl();
        const res = await testApiConnection(base, undefined);
        if (res?.ok) {
          const host = new URL(base).hostname;
          setApiHost(host);
          setDbTarget(String(res?.data?.dbTarget || ''));
        }
      } catch {}
    })();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([
      loadProducts(),
      loadCategorias(),
      loadTipos(),
      loadUnidades(),
      loadSetores(),
      loadLocaisEstoque(),
      loadFiscalDefaults()
    ]);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getAll();
      setProducts(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      Alert.alert('Erro', 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorias = async () => {
    try {
      const response = await categoryService.getAll();
      setCategorias(Array.isArray(response) ? response : []);
    } catch (error: any) {
      console.error('❌ Erro ao carregar categorias:', error);
    }
  };

  const loadTipos = async () => {
    try {
      const tipos = await typeService.getAll();
      setTipos(Array.isArray(tipos) ? tipos : []);
    } catch (error: any) {
      console.error('Erro ao carregar tipos:', error);
    }
  };

  const loadUnidades = async () => {
    try {
      const unidades = await unidadeMedidaService.getAll();
      setUnidades(Array.isArray(unidades) ? unidades : []);
    } catch (error: any) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const loadSetores = async () => {
    try {
      const body = await setorImpressaoService.getAll();
      const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      const mapped: SetorImpressao[] = list.map((s: any) => ({ id: String(s.id ?? s._id), nome: s.nome, modoEnvio: String(s.modoEnvio || 'impressora') as any }));
      setSetores(mapped);
    } catch (error: any) {
    }
  };

  const loadLocaisEstoque = async () => {
    try {
      const res = await stockService.getLocations();
      setLocaisEstoque(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('Erro ao carregar locais de estoque:', e);
    }
  };

  const handleCreateNovoLocal = async () => {
    if (!novoLocalNome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do local.');
      return;
    }
    try {
      setLoading(true);
      const res = await stockService.createLocation({
        nome: novoLocalNome.trim(),
        tipo: novoLocalTipo,
      });
      const novo = res.data?.location;
      await loadLocaisEstoque();
      if (novo) {
        setFormData((prev: any) => ({
          ...prev,
          localVendaNome: novo.nome,
          localVendaId: novo.id
        }));
      }
      setNovoLocalNome('');
      setShowModalNovoLocal(false);
      Alert.alert('Sucesso', 'Local cadastrado com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao cadastrar local.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNovaCategoria = async () => {
    const nomeLimpo = novaCategoriaNome.trim();
    if (!nomeLimpo) {
      if (Platform.OS === 'web') {
        window.alert('Informe o nome da categoria.');
      } else {
        Alert.alert('Atenção', 'Informe o nome da categoria.');
      }
      return;
    }
    try {
      setLoadingNovaCategoria(true);
      await categoryService.create({ nome: nomeLimpo });
      await loadCategorias();
      setFormData((prev: any) => ({
        ...prev,
        categoria: nomeLimpo
      }));
      setNovaCategoriaNome('');
      setShowModalNovaCategoria(false);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Erro ao cadastrar categoria.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Erro', msg);
      }
    } finally {
      setLoadingNovaCategoria(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.nome || !formData.precoVenda || !formData.categoria) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios (Nome, Preço de Venda, Categoria)');
      return;
    }

    setLoading(true);
    try {
      const parseValue = (val: any) => {
        if (!val) return 0;
        return parseFloat(val.toString().replace(',', '.')) || 0;
      };

      const productData: any = {
        nome: formData.nome,
        descricao: formData.descricao,
        precoCusto: parseValue(formData.precoCusto),
        precoVenda: parseValue(formData.precoVenda),
        categoria: formData.categoria,
        tipo: formData.tipo,
        grupo: formData.grupo,
        unidade: formData.unidade,
        ativo: formData.ativo,
        quantidade: (parseInt(formData.estoqueDeposito) || 0) + (parseInt(formData.estoqueGeladeira) || 0),
        estoqueDeposito: parseInt(formData.estoqueDeposito) || 0,
        estoqueGeladeira: parseInt(formData.estoqueGeladeira) || 0,
        localVendaNome: formData.localVendaNome || 'Geladeira 1',
        localVendaId: formData.localVendaId || undefined,
        disponivel: formData.disponivel,
        imagem: formData.imagem || null,
        ncm: formData.ncm,
        cest: formData.cest,
        cfop: formData.cfop,
        csosn: formData.csosn ? formData.csosn.replace(/\D/g, '') : '102',
        origem: parseInt(formData.origem) || 0,
        ibsCst: formData.ibsCst ? formData.ibsCst.replace(/\D/g, '') : (formData.ibsClassTrib?.startsWith('410') ? '410' : (fiscalDefaults.ibsCst || '000')),
        ibsClassTrib: formData.ibsClassTrib ? formData.ibsClassTrib.replace(/\D/g, '') : (fiscalDefaults.ibsClassTrib || '410031'),
        ibsAliquota: formData.ibsAliquota !== '' ? parseFloat(formData.ibsAliquota.replace(',', '.')) : null,
        cbsCst: formData.cbsCst ? formData.cbsCst.replace(/\D/g, '') : (formData.cbsClassTrib?.startsWith('410') ? '410' : (fiscalDefaults.cbsCst || '000')),
        cbsClassTrib: formData.cbsClassTrib ? formData.cbsClassTrib.replace(/\D/g, '') : (fiscalDefaults.cbsClassTrib || '410031'),
        cbsAliquota: formData.cbsAliquota !== '' ? parseFloat(formData.cbsAliquota.replace(',', '.')) : null,
        isAliquota: formData.isAliquota !== '' ? parseFloat(formData.isAliquota.replace(',', '.')) : null,
      };

      productData.temVariacao = !!formData.temVariacao;
      productData.temTamanhos = !!formData.temTamanhos;
      if (formData.temTamanhos) {
        productData.tamanhos = tamanhos
          .filter(t => t.nome && t.nome.trim() !== '')
          .map(t => ({
            id: t.id,
            nome: t.nome.trim(),
            preco: parseValue(t.preco)
          }));
        if (productData.tamanhos.length > 0 && (!productData.precoVenda || productData.precoVenda === 0)) {
          productData.precoVenda = productData.tamanhos[0].preco;
        }
      } else {
        productData.tamanhos = [];
      }

      if (selectedSetores !== null) {
        productData.setoresImpressaoIds = selectedSetores.map((id) => Number(id));
      }

      let response;
      if (editingProduct) {
        response = await productService.update(editingProduct._id, productData);
      } else {
        response = await productService.create(productData);
      }

      Alert.alert('Sucesso', editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
      setModalVisible(false);
      loadInitialData();
    } catch (error: any) {
      console.error('❌ Erro ao salvar produto:', error);
      Alert.alert('Erro', 'Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (product: Product) => {
    setFormData({
      nome: product.nome || '',
      descricao: product.descricao || '',
      precoCusto: (product.precoCusto ?? 0).toString(),
      precoVenda: (product.precoVenda ?? 0).toString(),
      categoria: product.categoria || '',
      tipo: product.tipo || '',
      grupo: product.grupo || '',
      unidade: product.unidade || 'un',
      ativo: product.ativo !== undefined ? product.ativo : true,
      quantidade: (product.quantidade ?? 0).toString(),
      estoqueDeposito: (product.estoqueDeposito ?? 0).toString(),
      estoqueGeladeira: (product.estoqueGeladeira ?? (product.quantidade ?? 0)).toString(),
      localVendaNome: product.localVendaNome || 'Geladeira 1',
      localVendaId: product.localVendaId || null,
      disponivel: product.disponivel !== undefined ? product.disponivel : true,
      imagem: (product as any).imagem || '',
      ncm: product.ncm || '',
      cest: product.cest || '',
      cfop: product.cfop || '',
      csosn: (product as any).csosn || '102',
      origem: (product.origem ?? 0).toString(),
      ibsCst: (product as any).ibsCst || ((product as any).ibsClassTrib?.startsWith('410') ? '410' : '410'),
      ibsClassTrib: (product as any).ibsClassTrib || '410031',
      ibsAliquota: (product as any).ibsAliquota !== null && (product as any).ibsAliquota !== undefined ? String((product as any).ibsAliquota) : '',
      cbsCst: (product as any).cbsCst || ((product as any).cbsClassTrib?.startsWith('410') ? '410' : '410'),
      cbsClassTrib: (product as any).cbsClassTrib || '410031',
      cbsAliquota: (product as any).cbsAliquota !== null && (product as any).cbsAliquota !== undefined ? String((product as any).cbsAliquota) : '',
      isAliquota: (product as any).isAliquota !== null && (product as any).isAliquota !== undefined ? String((product as any).isAliquota) : '',
      temVariacao: !!(product as any).temVariacao,
      temTamanhos: !!(product as any).temTamanhos,
    });
    setShowNcmMenu(false);
    setShowReformaTributaria(false);
    if (Array.isArray((product as any).tamanhos) && (product as any).tamanhos.length > 0) {
      setTamanhos((product as any).tamanhos.map((t: any) => ({
        id: t.id,
        nome: t.nome || '',
        preco: (t.preco !== undefined && t.preco !== null ? t.preco : 0).toString()
      })));
    } else {
      setTamanhos([]);
    }
    setEditingProduct(product);
    setSelectedSetores(null);
    try {
      const resp = await productService.getById(product._id);
      const sids = Array.isArray(resp?.data?.setoresImpressaoIds) ? resp.data.setoresImpressaoIds.map((n: any) => String(n)) : [];
      setSelectedSetores(sids);
    } catch {
      setSelectedSetores([]);
    }
    setModalVisible(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o produto "${product.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(product._id);
              Alert.alert('Sucesso', 'Produto excluído com sucesso');
              loadInitialData();
            } catch (error: any) {
              Alert.alert('Erro', 'Erro ao excluir produto');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setShowNcmMenu(false);
    setShowReformaTributaria(false);
    setFormData({
      nome: '',
      descricao: '',
      precoCusto: '',
      precoVenda: '',
      categoria: '',
      tipo: '',
      grupo: '',
      unidade: 'un',
      ativo: true,
      quantidade: '0',
      estoqueDeposito: '0',
      estoqueGeladeira: '0',
      localVendaNome: 'Geladeira 1',
      localVendaId: null as number | null,
      disponivel: true,
      imagem: '',
      ncm: '',
      cest: '',
      cfop: '',
      csosn: '102',
      origem: '0',
      ibsCst: fiscalDefaults.ibsCst || '410',
      ibsClassTrib: fiscalDefaults.ibsClassTrib || '410031',
      ibsAliquota: fiscalDefaults.ibsAliquota || '',
      cbsCst: fiscalDefaults.cbsCst || '410',
      cbsClassTrib: fiscalDefaults.cbsClassTrib || '410031',
      cbsAliquota: fiscalDefaults.cbsAliquota || '',
      isAliquota: fiscalDefaults.isAliquota || '',
    });
    setEditingProduct(null);
    setSelectedSetores([]);
  };

  const getFilteredAndSortedProducts = () => {
    const q = String(searchText || '').toLowerCase();
    let filtered = products.filter(product => {
      const nome = String(product?.nome || '').toLowerCase();
      const categoria = String(product?.categoria || '').toLowerCase();
      const descricao = String(product?.descricao || '').toLowerCase();
      
      const sids = (product as any)?.setoresImpressaoIds || [];
      const matchesSemSetor = !filterSemSetor || sids.length === 0;
      const matchesLocal = !selectedLocalFilter || (product.localVendaNome || 'Geladeira 1') === selectedLocalFilter;
      const hasValidNcm = !!(product.ncm && String(product.ncm).replace(/\D/g, '').length === 8);
      const matchesSemFiscal = !filterSemFiscal || !hasValidNcm;

      return (nome.includes(q) || categoria.includes(q) || descricao.includes(q)) &&
             (!selectedCategory || product.categoria === selectedCategory) &&
             (filterActive === null || product.ativo === filterActive) &&
             matchesSemSetor &&
             matchesLocal &&
             matchesSemFiscal;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nome': return a.nome.localeCompare(b.nome);
        case 'categoria': return a.categoria.localeCompare(b.categoria);
        case 'preco': return a.precoVenda - b.precoVenda;
        default: return 0;
      }
    });

    return filtered;
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={[
        styles.productCard,
        viewMode === 'grid' ? styles.gridCard : styles.listCard
      ]}
      onPress={() => handleEditProduct(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {item.imagem ? (
          <Image
            source={{ uri: getProductImageUrl(item.imagem) || '' }}
            style={styles.cardThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardThumbnailPlaceholder}>
            <SafeIcon name="cube-outline" size={20} color="#94A3B8" fallbackText="📦" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.nome}</Text>
          <Text style={styles.productCategory}>{item.categoria}</Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEditProduct(item)}>
            <SafeIcon name="pencil" size={18} color="#2196F3" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteProduct(item)}>
            <SafeIcon name="trash" size={18} color="#f44336" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>
      
      {viewMode === 'list' && (
        <Text style={styles.productDescription} numberOfLines={2}>{item.descricao}</Text>
      )}
      
      <View style={styles.priceContainer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Venda:</Text>
          <Text style={[styles.priceValue, styles.sellPrice]}>R$ {item.precoVenda.toFixed(2)}</Text>
        </View>
      </View>

      {/* Saldo de Estoque por Local */}
      <View style={styles.stockBreakdownContainer}>
        <Text style={styles.stockMainText}>
          Estoque Total: <Text style={{ fontWeight: 'bold' }}>{item.quantidade ?? 0}</Text> {item.unidade || 'un'}
        </Text>
        <Text style={styles.stockSubText}>
          📦 Dep: <Text style={{ fontWeight: 'bold', color: '#1565C0' }}>{item.estoqueDeposito ?? 0}</Text> | 📍 {item.localVendaNome || 'Geladeira'}: <Text style={{ fontWeight: 'bold', color: (item.estoqueGeladeira ?? 0) <= 0 ? '#E65100' : '#2E7D32' }}>{item.estoqueGeladeira ?? 0}</Text>
        </Text>
      </View>
      
      <View style={styles.statusContainer}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
          <View style={[styles.statusBadge, { backgroundColor: item.ativo ? '#E8F5E8' : '#FFEBEE' }]}>
            <Text style={[styles.statusText, { color: item.ativo ? '#4CAF50' : '#f44336' }]}>
              {item.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
          {(item.estoqueGeladeira ?? 0) <= 0 && (item.estoqueDeposito ?? 0) > 0 && (
            <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0', borderColor: '#FF9800', borderWidth: 1 }]}>
              <Text style={[styles.statusText, { color: '#E65100', fontWeight: 'bold' }]}>
                ⚠️ Repor {item.localVendaNome || 'Geladeira'} ({item.estoqueDeposito} no dep.)
              </Text>
            </View>
          )}
          {(item.quantidade ?? 0) <= 0 && (
            <View style={[styles.statusBadge, { backgroundColor: '#FFEBEE', borderColor: '#F44336', borderWidth: 1 }]}>
              <Text style={[styles.statusText, { color: '#C62828', fontWeight: 'bold' }]}>
                🚫 Esgotado
              </Text>
            </View>
          )}
          {((item as any)?.setoresImpressaoIds || []).length === 0 && (
            <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.statusText, { color: '#E65100', fontWeight: 'bold' }]}>
                ⚠️ Sem Setor
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.quickTransferButton}
          onPress={(e: any) => {
            e.stopPropagation?.();
            router.push({
              pathname: '/estoque/movimentacao',
              params: { tab: 'transfer', productId: item._id }
            } as any);
          }}
        >
          <SafeIcon name="swap-horizontal" size={14} color="#00838F" fallbackText="⇄" />
          <Text style={styles.quickTransferText}>Transferir</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* 1. Barra Superior com Título, Badge e Ações Principais */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 150 }}>
          <Text style={[styles.pageTitle, !isLargeScreen && { fontSize: 18 }]} numberOfLines={1}>
            Gerenciar Produtos
          </Text>
          {dbTarget ? (
             <View style={styles.dbBadge}>
               <SafeIcon name="server-outline" size={12} color="#64748B" fallbackText="DB" />
               <Text style={styles.dbText}>{dbTarget.toUpperCase()}</Text>
             </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Botão Novo Produto em destaque no topo */}
          <TouchableOpacity 
            style={[styles.novoProdutoHeaderBtn, !isLargeScreen && { paddingHorizontal: 10, paddingVertical: 7 }]}
            onPress={() => {
              resetForm();
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <SafeIcon name="add" size={16} color="#fff" fallbackText="+" />
            <Text style={styles.novoProdutoHeaderBtnText}>
              {isLargeScreen ? 'Novo Produto' : 'Novo'}
            </Text>
          </TouchableOpacity>

          {/* Botão Estoque & Transferência */}
          <TouchableOpacity 
            style={isLargeScreen ? styles.estoqueXmlHeaderButton : styles.estoqueMobileHeaderButton}
            onPress={() => router.push('/estoque/movimentacao' as any)}
            activeOpacity={0.8}
          >
            <SafeIcon name="cube-outline" size={15} color="#fff" fallbackText="📦" />
            <Text style={isLargeScreen ? styles.estoqueXmlHeaderButtonText : styles.estoqueMobileButtonText}>
              {isLargeScreen ? 'Estoque & Transferência' : 'Estoque'}
            </Text>
          </TouchableOpacity>

          {/* Botão Fiscal em Massa */}
          <TouchableOpacity 
            style={[
              isLargeScreen ? styles.estoqueXmlHeaderButton : styles.estoqueMobileHeaderButton,
              { backgroundColor: '#D97706', borderColor: '#B45309' }
            ]}
            onPress={() => setShowBulkFiscalModal(true)}
            activeOpacity={0.8}
          >
            <SafeIcon name="flash" size={15} color="#fff" fallbackText="⚡" />
            <Text style={isLargeScreen ? styles.estoqueXmlHeaderButtonText : styles.estoqueMobileButtonText}>
              {isLargeScreen ? 'Fiscal em Massa' : 'Fiscal'}
            </Text>
          </TouchableOpacity>

          {/* Botão Cadastro Inteligente */}
          <TouchableOpacity 
            style={[
              isLargeScreen ? styles.estoqueXmlHeaderButton : styles.estoqueMobileHeaderButton,
              { backgroundColor: '#7C3AED', borderColor: '#6D28D9' }
            ]}
            onPress={() => setShowSmartBatchModal(true)}
            activeOpacity={0.8}
          >
            <SafeIcon name="sparkles" size={15} color="#fff" fallbackText="🤖" />
            <Text style={isLargeScreen ? styles.estoqueXmlHeaderButtonText : styles.estoqueMobileButtonText}>
              {isLargeScreen ? 'Cadastro Inteligente' : 'Inteligente'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Barra Unificada: Busca + Filtro de Status + Ordenação e Grade/Lista */}
      <View style={styles.searchAndControlsRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Buscar produtos..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Chips de Status (Totalmente independentes das Categorias!) */}
        <View style={styles.statusChipsRow}>
          {[
            { key: 'todos', label: 'Todos', active: filterActive === null && !filterSemSetor && !filterSemFiscal },
            { key: 'ativo', label: 'Ativos', active: filterActive === true && !filterSemSetor && !filterSemFiscal },
            { key: 'inativo', label: 'Inativos', active: filterActive === false && !filterSemSetor && !filterSemFiscal },
            { key: 'sem-setor', label: 'Sem Setor', active: filterSemSetor && !filterSemFiscal },
            { key: 'sem-fiscal', label: 'Sem Fiscal 🚨', active: filterSemFiscal },
          ].map(st => (
            <TouchableOpacity
              key={st.key}
              onPress={() => {
                if (st.key === 'todos') {
                  setFilterActive(null);
                  setFilterSemSetor(false);
                  setFilterSemFiscal(false);
                } else if (st.key === 'ativo') {
                  setFilterActive(true);
                  setFilterSemSetor(false);
                  setFilterSemFiscal(false);
                } else if (st.key === 'inativo') {
                  setFilterActive(false);
                  setFilterSemSetor(false);
                  setFilterSemFiscal(false);
                } else if (st.key === 'sem-setor') {
                  setFilterActive(null);
                  setFilterSemSetor(true);
                  setFilterSemFiscal(false);
                } else if (st.key === 'sem-fiscal') {
                  setFilterSemFiscal(!filterSemFiscal);
                }
              }}
              style={[
                styles.statusChipBtn,
                st.active && styles.statusChipBtnActive,
                st.key === 'sem-fiscal' && st.active && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.statusChipBtnText,
                st.active && styles.statusChipBtnTextActive,
                st.key === 'sem-fiscal' && st.active && { color: '#DC2626', fontWeight: 'bold' }
              ]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ordenação, Seletor de Local e Alternador de Grade/Lista */}
        <View style={styles.sortAndViewModeRow}>
          {/* Seletor Compacto de Local de Estoque */}
          {locaisEstoque.length > 0 && (
            <TouchableOpacity
              style={[
                styles.localDropdownButton,
                selectedLocalFilter !== '' && styles.localDropdownButtonActive,
              ]}
              onPress={() => setShowLocalMenu(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  selectedLocalFilter === ''
                    ? 'apps'
                    : (locaisEstoque.find(l => l.nome === selectedLocalFilter)?.tipo === 'GELADEIRA' ? 'snow' : 'storefront')
                }
                size={13}
                color={selectedLocalFilter !== '' ? '#0284C7' : '#64748B'}
              />
              <Text
                style={[
                  styles.localDropdownText,
                  selectedLocalFilter !== '' && styles.localDropdownTextActive,
                ]}
                numberOfLines={1}
              >
                {selectedLocalFilter === '' ? 'Todos os Locais' : selectedLocalFilter}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={selectedLocalFilter !== '' ? '#0284C7' : '#94A3B8'}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const sortOptions = ['nome', 'categoria', 'preco'] as const;
              const nextIndex = (sortOptions.indexOf(sortBy) + 1) % sortOptions.length;
              setSortBy(sortOptions[nextIndex]);
            }}
            activeOpacity={0.7}
          >
            <SafeIcon name="swap-vertical" size={15} color="#64748B" fallbackText="↕" />
            <Text style={styles.sortText}>
              {sortBy === 'nome' ? 'Nome' : sortBy === 'categoria' ? 'Categoria' : 'Preço'}
            </Text>
          </TouchableOpacity>

          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <SafeIcon name="grid" size={16} color={viewMode === 'grid' ? '#2196F3' : '#94A3B8'} fallbackText="▦" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <SafeIcon name="list" size={16} color={viewMode === 'list' ? '#2196F3' : '#94A3B8'} fallbackText="≡" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Fita de Categorias com Scroll Horizontal Suave */}
      <View style={styles.categoriesRibbon}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategory('')}
            style={[
              styles.categoryChip,
              selectedCategory === '' && styles.categoryChipActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === '' && styles.categoryChipTextActive,
              ]}
            >
              Todas as Categorias
            </Text>
          </TouchableOpacity>

          {(categorias || []).map(cat => {
            const isSel = selectedCategory === cat.nome;
            return (
              <TouchableOpacity
                key={cat.id || cat.nome}
                onPress={() => setSelectedCategory(isSel ? '' : cat.nome)}
                style={[
                  styles.categoryChip,
                  isSel && styles.categoryChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSel && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.nome}
                </Text>
              </TouchableOpacity>
            );
          })}

          {selectedCategory !== '' && (
            <>
              <TouchableOpacity
                onPress={() => setShowBulkFiscalModal(true)}
                style={styles.categoryFiscalPill}
                activeOpacity={0.7}
              >
                <SafeIcon name="flash" size={12} color="#D97706" fallbackText="⚡" />
                <Text style={styles.categoryFiscalPillText}>
                  Padronizar Fiscal de "{selectedCategory}"
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowSmartBatchModal(true)}
                style={[styles.categoryFiscalPill, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', marginLeft: 6 }]}
                activeOpacity={0.7}
              >
                <SafeIcon name="sparkles" size={12} color="#7C3AED" fallbackText="🤖" />
                <Text style={[styles.categoryFiscalPillText, { color: '#6D28D9' }]}>
                  + Adicionar Marcas em "{selectedCategory}"
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );

  if (!hasPermission('produtos')) return null;

  const filteredProducts = getFilteredAndSortedProducts();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenIdentifier screenName="Admin - Produtos" />
      <View style={styles.container}>
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          numColumns={viewMode === 'grid' ? (isLargeScreen ? 3 : (width > 600 ? 2 : 1)) : 1}
          key={viewMode + (isLargeScreen ? '_large' : (width > 600 ? '_med' : '_small'))}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadInitialData} colors={['#2196F3']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SafeIcon name="cube-outline" size={48} color="#CBD5E1" fallbackText="📦" />
              <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
            </View>
          }
        />

        {/* Modal de Cadastro/Edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
             <View style={styles.modalHeaderWrapper}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!formData.nome?.trim() || !formData.precoVenda?.toString().trim()) {
                          Alert.alert('Atenção', 'Preencha pelo menos Nome e Preço de Venda antes de replicar.');
                          return;
                        }
                        setShowBulkModal(true);
                      }}
                      style={styles.replicarBtn}
                      activeOpacity={0.7}
                    >
                      <SafeIcon name="copy-outline" size={16} color="#2563EB" fallbackText="📑" />
                      <Text style={styles.replicarBtnText}>Replicar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                       <SafeIcon name="close" size={24} color="#64748B" fallbackText="X" />
                    </TouchableOpacity>
                  </View>
               </View>
             </View>

             <KeyboardAvoidingView
               style={{ flex: 1 }}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
             >
                <ScrollView 
                   style={styles.modalContent}
                   contentContainerStyle={styles.formContentContainer}
                   keyboardShouldPersistTaps="handled"
                >
                   {/* Layout centralizado para telas grandes */}
                   <View style={styles.formCard}>
                      {/* Validações para borda vermelha obrigatória */}
                      {(() => {
                        const isNomeMissing = !formData.nome?.trim();
                        const isPrecoVendaMissing = !formData.precoVenda?.toString().trim();
                        const isCategoriaMissing = !formData.categoria;
                        const isNcmMissing = !formData.ncm || formData.ncm.replace(/\D/g, '').length !== 8;
                        const hasReformaValues = !!(formData.ibsCst || formData.ibsClassTrib || formData.ibsAliquota || formData.cbsCst || formData.cbsClassTrib || formData.cbsAliquota || formData.isAliquota);

                        return (
                          <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 14 }}>
                            {/* ── COLUNA ESQUERDA: Informações do Produto, Preços & Classificação ── */}
                            <View style={{ flex: isLargeScreen ? 1 : undefined, gap: 10 }}>
                              {/* 1. Informações Básicas com Foto Integrada */}
                              <View style={styles.subCard}>
                                <Text style={styles.subCardLabel}>Informações Gerais</Text>
                                
                                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                                  {/* Foto Miniatura 70x70 com upload/remover */}
                                  <View style={styles.compactPhotoBox}>
                                    {formData.imagem ? (
                                      <View style={styles.compactPhotoWrapper}>
                                        <Image
                                          source={{ uri: getProductImageUrl(formData.imagem) || '' }}
                                          style={styles.compactPhoto}
                                          resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                          style={styles.compactPhotoRemove}
                                          onPress={() => setFormData({ ...formData, imagem: '' })}
                                          activeOpacity={0.7}
                                        >
                                          <Ionicons name="trash" size={11} color="#fff" />
                                        </TouchableOpacity>
                                      </View>
                                    ) : (
                                      <TouchableOpacity
                                        style={[styles.compactPhotoPlaceholder, uploadingImage && { opacity: 0.5 }]}
                                        onPress={handlePickImage}
                                        disabled={uploadingImage}
                                        activeOpacity={0.7}
                                      >
                                        {uploadingImage ? (
                                          <ActivityIndicator size="small" color="#2196F3" />
                                        ) : (
                                          <>
                                            <Ionicons name="camera-outline" size={20} color="#94A3B8" />
                                            <Text style={styles.compactPhotoText}>Foto</Text>
                                          </>
                                        )}
                                      </TouchableOpacity>
                                    )}
                                    {formData.imagem && (
                                      <TouchableOpacity
                                        style={styles.compactPhotoChangeBtn}
                                        onPress={handlePickImage}
                                        disabled={uploadingImage}
                                      >
                                        <Text style={styles.compactPhotoChangeText}>Trocar</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>

                                  {/* Nome e Descrição */}
                                  <View style={{ flex: 1, gap: 6 }}>
                                    <View>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                        <Text style={[styles.labelCompact, isNomeMissing && styles.labelRequired]}>
                                          Nome do Produto *
                                        </Text>
                                        {isNomeMissing && <Text style={styles.requiredTag}>Obrigatório</Text>}
                                      </View>
                                      <TextInput
                                        style={[
                                          styles.inputCompact,
                                          isNomeMissing && styles.inputRequired
                                        ]}
                                        value={formData.nome}
                                        onChangeText={(t) => setFormData({...formData, nome: t})}
                                        placeholder="Ex: Coca-Cola Lata 350ml"
                                        placeholderTextColor="#94A3B8"
                                      />
                                    </View>

                                    <View>
                                      <Text style={styles.labelCompact}>Descrição</Text>
                                      <TextInput
                                        style={[styles.inputCompact, { height: 32, paddingVertical: 4 }]}
                                        value={formData.descricao}
                                        onChangeText={(t) => setFormData({...formData, descricao: t})}
                                        placeholder="Detalhes opcionais"
                                        placeholderTextColor="#94A3B8"
                                      />
                                    </View>
                                  </View>
                                </View>
                              </View>

                              {/* 2. Preços (Custo e Venda lado a lado) */}
                              <View style={styles.subCard}>
                                <Text style={styles.subCardLabel}>Preços</Text>
                                <View style={styles.row}>
                                  <View style={[styles.inputGroupCompact, { flex: 1, marginRight: 6 }]}>
                                    <Text style={styles.labelCompact}>Preço de Custo (R$)</Text>
                                    <TextInput
                                      style={styles.inputCompact}
                                      value={formData.precoCusto}
                                      onChangeText={(t) => setFormData({...formData, precoCusto: t})}
                                      keyboardType="numeric"
                                      placeholder="0.00"
                                    />
                                  </View>
                                  <View style={[styles.inputGroupCompact, { flex: 1, marginLeft: 6 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                      <Text style={[styles.labelCompact, isPrecoVendaMissing ? styles.labelRequired : { color: '#0284C7' }]}>
                                        Preço de Venda (R$) *
                                      </Text>
                                      {isPrecoVendaMissing && <Text style={styles.requiredTag}>Obrigatório</Text>}
                                    </View>
                                    <TextInput
                                      style={[
                                        styles.inputCompact,
                                        isPrecoVendaMissing ? styles.inputRequired : { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF', fontWeight: 'bold' }
                                      ]}
                                      value={formData.precoVenda}
                                      onChangeText={(t) => setFormData({...formData, precoVenda: t})}
                                      keyboardType="numeric"
                                      placeholder="0.00"
                                    />
                                  </View>
                                </View>

                                {/* Linha de Switches: Tamanhos e Variações */}
                                <View style={styles.switchesPrecoRow}>
                                  <View style={styles.switchOptionCompact}>
                                    <Switch
                                      value={formData.temTamanhos}
                                      onValueChange={(val) => {
                                        setFormData(prev => ({ ...prev, temTamanhos: val }));
                                        if (val && tamanhos.length === 0) {
                                          setTamanhos([
                                            { nome: 'P', preco: formData.precoVenda || '' },
                                            { nome: 'M', preco: '' },
                                            { nome: 'G', preco: '' },
                                          ]);
                                        }
                                      }}
                                      trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                                      thumbColor="#fff"
                                    />
                                    <Text style={styles.switchOptionLabel}>Com Tamanhos (P, M, G...)</Text>
                                  </View>

                                  <View style={styles.switchOptionCompact}>
                                    <Switch
                                      value={formData.temVariacao}
                                      onValueChange={(val) => setFormData(prev => ({ ...prev, temVariacao: val }))}
                                      trackColor={{ false: '#CBD5E1', true: '#8B5CF6' }}
                                      thumbColor="#fff"
                                    />
                                    <Text style={styles.switchOptionLabel}>Com Variação</Text>
                                  </View>
                                </View>

                                {/* Lista Dinâmica de Tamanhos */}
                                {formData.temTamanhos && (
                                  <View style={styles.tamanhosBox}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <Text style={styles.tamanhosTitle}>Tamanhos & Preços</Text>
                                      <TouchableOpacity
                                        style={styles.addTamanhoBtn}
                                        onPress={() => setTamanhos(prev => [...prev, { nome: '', preco: '' }])}
                                        activeOpacity={0.7}
                                      >
                                        <Ionicons name="add" size={13} color="#0284C7" />
                                        <Text style={styles.addTamanhoBtnText}>+ Tamanho</Text>
                                      </TouchableOpacity>
                                    </View>

                                    {tamanhos.map((tam, idx) => (
                                      <View key={idx} style={styles.tamanhoRow}>
                                        <TextInput
                                          style={[styles.inputCompact, { flex: 1.5, height: 28, fontSize: 11 }]}
                                          placeholder="Tamanho (Ex: P, M, 500ml)"
                                          placeholderTextColor="#94A3B8"
                                          value={tam.nome}
                                          onChangeText={(t) => {
                                            const updated = [...tamanhos];
                                            updated[idx].nome = t;
                                            setTamanhos(updated);
                                          }}
                                        />
                                        <TextInput
                                          style={[styles.inputCompact, { flex: 1, height: 28, fontSize: 11 }]}
                                          placeholder="R$ Preço"
                                          placeholderTextColor="#94A3B8"
                                          keyboardType="numeric"
                                          value={tam.preco}
                                          onChangeText={(t) => {
                                            const updated = [...tamanhos];
                                            updated[idx].preco = t;
                                            setTamanhos(updated);
                                            // Atualiza precoVenda base com o primeiro tamanho se vazio
                                            if (idx === 0) {
                                              setFormData(prev => ({ ...prev, precoVenda: t }));
                                            }
                                          }}
                                        />
                                        <TouchableOpacity
                                          style={styles.removeTamanhoBtn}
                                          onPress={() => setTamanhos(prev => prev.filter((_, i) => i !== idx))}
                                          activeOpacity={0.7}
                                        >
                                          <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                        </TouchableOpacity>
                                      </View>
                                    ))}
                                    {tamanhos.length === 0 && (
                                      <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 }}>
                                        Nenhum tamanho configurado. Clique em "+ Tamanho" acima.
                                      </Text>
                                    )}
                                  </View>
                                )}
                              </View>

                              {/* 3. Classificação & Impressão */}
                              <View style={styles.subCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.subCardLabel}>Classificação & Impressão</Text>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setNovaCategoriaNome('');
                                        setShowModalNovaCategoria(true);
                                      }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        backgroundColor: '#EFF6FF',
                                        borderColor: '#BFDBFE',
                                        borderWidth: 1,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 6,
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <SafeIcon name="add-circle-outline" size={14} color="#2563EB" fallbackText="+" />
                                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                                        + Nova Categoria
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                  {isCategoriaMissing && <Text style={styles.requiredTag}>Categoria Obrigatória *</Text>}
                                </View>

                                {/* Categoria */}
                                <View style={{ marginBottom: 10 }}>
                                  <Text style={[styles.labelCompact, isCategoriaMissing && styles.labelRequired, { marginBottom: 4 }]}>Categoria *</Text>
                                  <View style={[
                                    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
                                    isCategoriaMissing && styles.chipScrollRequired
                                  ]}>
                                     {(categorias || []).map(cat => (
                                       <TouchableOpacity
                                         key={cat._id}
                                         style={[
                                           styles.chipCompact, 
                                           formData.categoria === cat.nome && styles.chipActiveCompact,
                                           { marginRight: 0 }
                                         ]}
                                         onPress={() => setFormData({...formData, categoria: cat.nome})}
                                       >
                                          <Text style={[styles.chipTextCompact, formData.categoria === cat.nome && styles.chipTextActiveCompact]} numberOfLines={1}>
                                            {cat.nome}
                                          </Text>
                                       </TouchableOpacity>
                                     ))}
                                  </View>
                                </View>

                                {/* Setor (linha própria espaçosa) */}
                                <View style={{ marginBottom: 10 }}>
                                  <Text style={[styles.labelCompact, { marginBottom: 4 }]}>Setor (Impressão)</Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {(setores || []).map((s) => (
                                      <TouchableOpacity
                                        key={s.id}
                                        style={[
                                          styles.chipCompact, 
                                          (selectedSetores || []).includes(String(s.id)) && styles.chipActiveCompact,
                                          { marginRight: 0 }
                                        ]}
                                        onPress={() => {
                                          const id = String(s.id);
                                          setSelectedSetores((prev) => {
                                            const current = prev || [];
                                            return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
                                          });
                                        }}
                                      >
                                        <Text style={[styles.chipTextCompact, (selectedSetores || []).includes(String(s.id)) && styles.chipTextActiveCompact]} numberOfLines={1}>
                                          {s.nome}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>

                                {/* Tipo e Unidade dividindo a linha seguinte */}
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                  {/* Tipo */}
                                  <View style={{ flex: 2, minWidth: 0 }}>
                                    <Text style={[styles.labelCompact, { marginBottom: 4 }]}>Tipo</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                      {(tipos || []).map(t => (
                                        <TouchableOpacity
                                          key={t._id}
                                          style={[
                                            styles.chipCompact, 
                                            formData.tipo === t.nome && styles.chipActiveCompact,
                                            { marginRight: 0 }
                                          ]}
                                          onPress={() => setFormData({...formData, tipo: t.nome})}
                                        >
                                          <Text style={[styles.chipTextCompact, formData.tipo === t.nome && styles.chipTextActiveCompact]} numberOfLines={1}>
                                            {t.nome}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>

                                  {/* Unidade */}
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.labelCompact, { marginBottom: 4 }]}>Unid.</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                      {(unidades || []).map(u => (
                                        <TouchableOpacity
                                          key={u._id}
                                          style={[
                                            styles.chipCompact, 
                                            formData.unidade === u.sigla && styles.chipActiveCompact,
                                            { marginRight: 0 }
                                          ]}
                                          onPress={() => setFormData({...formData, unidade: u.sigla})}
                                        >
                                          <Text style={[styles.chipTextCompact, formData.unidade === u.sigla && styles.chipTextActiveCompact]} numberOfLines={1}>
                                            {u.sigla}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                </View>
                              </View>
                            </View>

                            {/* ── COLUNA DIREITA: Estoque & Dados Fiscais ── */}
                            <View style={{ flex: isLargeScreen ? 1 : undefined, gap: 10 }}>
                              {/* 1. Estoque & Disponibilidade */}
                              <View style={styles.subCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <Text style={styles.subCardLabel}>Estoque & Disponibilidade</Text>
                                  <TouchableOpacity 
                                    onPress={() => setShowModalNovoLocal(true)}
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}
                                  >
                                    <Ionicons name="add-circle-outline" size={13} color="#0284C7" />
                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0284C7', marginLeft: 3 }}>+ Local</Text>
                                  </TouchableOpacity>
                                </View>

                                {/* Local de Venda */}
                                <View style={styles.locaisSelectorContainerCompact}>
                                  {locaisEstoque.map(loc => {
                                    const isSelected = formData.localVendaNome === loc.nome;
                                    return (
                                      <TouchableOpacity
                                        key={loc.id}
                                        onPress={() => setFormData({ ...formData, localVendaNome: loc.nome, localVendaId: loc.id })}
                                        style={[
                                          styles.localSelectorChipCompact,
                                          isSelected && styles.localSelectorChipActive
                                        ]}
                                        activeOpacity={0.7}
                                      >
                                        <Ionicons 
                                          name={loc.tipo === 'GELADEIRA' ? 'snow' : loc.tipo === 'COZINHA' ? 'restaurant' : 'storefront'} 
                                          size={12} 
                                          color={isSelected ? '#fff' : '#475569'} 
                                        />
                                        <Text style={[
                                          styles.localSelectorChipTextCompact,
                                          isSelected && styles.localSelectorChipTextActive
                                        ]}>
                                          {loc.nome}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                {/* Estoques e Total em linha */}
                                <View style={[styles.row, { marginTop: 8 }]}>
                                  <View style={[styles.inputGroupCompact, { flex: 1, marginRight: 5 }]}>
                                    <Text style={styles.labelCompact}>📦 Depósito</Text>
                                    <TextInput
                                       style={styles.inputCompact}
                                       value={formData.estoqueDeposito}
                                       onChangeText={(t) => {
                                         const dep = parseInt(t) || 0;
                                         const gel = parseInt(formData.estoqueGeladeira) || 0;
                                         setFormData({...formData, estoqueDeposito: t, quantidade: (dep + gel).toString()});
                                       }}
                                       keyboardType="numeric"
                                       placeholder="0"
                                    />
                                  </View>

                                  <View style={[styles.inputGroupCompact, { flex: 1, marginHorizontal: 3 }]}>
                                    <Text style={styles.labelCompact} numberOfLines={1}>📍 {formData.localVendaNome || 'Local Venda'}</Text>
                                    <TextInput
                                       style={styles.inputCompact}
                                       value={formData.estoqueGeladeira}
                                       onChangeText={(t) => {
                                         const gel = parseInt(t) || 0;
                                         const dep = parseInt(formData.estoqueDeposito) || 0;
                                         setFormData({...formData, estoqueGeladeira: t, quantidade: (dep + gel).toString()});
                                       }}
                                       keyboardType="numeric"
                                       placeholder="0"
                                    />
                                  </View>

                                  <View style={[styles.inputGroupCompact, { flex: 0.9, marginLeft: 3, justifyContent: 'center' }]}>
                                    <Text style={[styles.labelCompact, { color: '#64748B' }]}>Total</Text>
                                    <View style={styles.totalEstoqueBox}>
                                      <Text style={styles.totalEstoqueVal}>
                                        {(parseInt(formData.estoqueDeposito) || 0) + (parseInt(formData.estoqueGeladeira) || 0)} {formData.unidade || 'un'}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* Switches em linha */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderColor: '#F1F5F9' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Switch
                                      value={formData.ativo}
                                      onValueChange={(v) => setFormData({...formData, ativo: v})}
                                      trackColor={{ false: '#E2E8F0', true: '#2196F3' }}
                                      thumbColor={'#fff'}
                                      style={{ transform: Platform.OS === 'web' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [] }}
                                    />
                                    <Text style={styles.switchLabelCompact}>Ativo</Text>
                                  </View>

                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Switch
                                      value={formData.disponivel}
                                      onValueChange={(v) => setFormData({...formData, disponivel: v})}
                                      trackColor={{ false: '#E2E8F0', true: '#2196F3' }}
                                      thumbColor={'#fff'}
                                      style={{ transform: Platform.OS === 'web' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [] }}
                                    />
                                    <Text style={styles.switchLabelCompact}>Disponível Venda</Text>
                                  </View>
                                </View>
                              </View>

                              {/* 2. Dados Fiscais com Busca de NCM */}
                              <View style={styles.subCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <Text style={styles.subCardLabel}>Dados Fiscais (NFC-e)</Text>
                                  
                                  {/* Botões Diretos de Busca de NCM */}
                                  <View style={{ flexDirection: "row", gap: 6 }}>
                                    <TouchableOpacity 
                                      style={styles.ncmDirectBtnCosmos}
                                      onPress={() => handleSearchNcm("cosmos")}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="search" size={12} color="#0284C7" />
                                      <Text style={styles.ncmDirectBtnCosmosText}>Cosmos Bluesoft</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                      style={styles.ncmDirectBtnGoogle}
                                      onPress={() => handleSearchNcm("google")}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="logo-google" size={12} color="#EA4335" />
                                      <Text style={styles.ncmDirectBtnGoogleText}>Google</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                {/* NCM e CEST */}
                                <View style={styles.row}>
                                  <View style={[styles.inputGroupCompact, { flex: 1.2, marginRight: 6 }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                      <Text style={[styles.labelCompact, isNcmMissing && styles.labelRequired]}>
                                        NCM (8 dígitos) *
                                      </Text>
                                      {isNcmMissing && <Text style={styles.requiredTag}>Obrigatório</Text>}
                                    </View>
                                    <TextInput
                                      style={[
                                        styles.inputCompact,
                                        isNcmMissing && styles.inputRequired
                                      ]}
                                      value={formData.ncm}
                                      onChangeText={(t) => setFormData({...formData, ncm: t})}
                                      keyboardType="numeric"
                                      maxLength={8}
                                      placeholder="Ex: 22021000"
                                    />
                                  </View>

                                  <View style={[styles.inputGroupCompact, { flex: 0.8, marginLeft: 6 }]}>
                                    <Text style={styles.labelCompact}>CEST</Text>
                                    <TextInput
                                      style={styles.inputCompact}
                                      value={formData.cest}
                                      onChangeText={(t) => setFormData({...formData, cest: t})}
                                      keyboardType="numeric"
                                      placeholder="0300700"
                                    />
                                  </View>
                                </View>

                                {/* CFOP, CSOSN e Origem */}
                                <View style={styles.row}>
                                  <View style={[styles.inputGroupCompact, { flex: 1, marginRight: 4 }]}>
                                    <Text style={styles.labelCompact}>CFOP</Text>
                                    <TextInput
                                      style={styles.inputCompact}
                                      value={formData.cfop}
                                      onChangeText={(t) => setFormData({...formData, cfop: t})}
                                      keyboardType="numeric"
                                      placeholder="5102"
                                    />
                                  </View>

                                  <View style={[styles.inputGroupCompact, { flex: 1, marginHorizontal: 4 }]}>
                                    <Text style={styles.labelCompact}>CSOSN</Text>
                                    <TextInput
                                      style={styles.inputCompact}
                                      value={formData.csosn}
                                      onChangeText={(t) => setFormData({...formData, csosn: t})}
                                      keyboardType="numeric"
                                      placeholder="102"
                                    />
                                  </View>

                                  <View style={[styles.inputGroupCompact, { flex: 0.8, marginLeft: 4 }]}>
                                    <Text style={styles.labelCompact}>Origem</Text>
                                    <TextInput
                                      style={styles.inputCompact}
                                      value={formData.origem}
                                      onChangeText={(t) => setFormData({...formData, origem: t})}
                                      keyboardType="numeric"
                                      maxLength={1}
                                      placeholder="0"
                                    />
                                  </View>
                                </View>

                                {/* Acordeão Retrátil Reforma Tributária */}
                                <View style={styles.accordionHeader}>
                                  <TouchableOpacity 
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingVertical: 2 }}
                                    onPress={() => setShowReformaTributaria(!showReformaTributaria)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="calculator-outline" size={14} color="#6A1B9A" />
                                    <Text style={styles.accordionTitle}>Reforma Tributária (IBS / CBS)</Text>
                                    {hasReformaValues && (
                                      <View style={styles.badgePreenchido}>
                                        <Text style={styles.badgePreenchidoText}>Preenchido</Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        backgroundColor: puxadoIndividualFeedback ? '#DCFCE7' : '#F3E8FF',
                                        borderWidth: 1,
                                        borderColor: puxadoIndividualFeedback ? '#86EFAC' : '#D8B4FE',
                                        borderRadius: 6,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                      }}
                                      onPress={handlePuxarConfigReformaIndividual}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons
                                        name={puxadoIndividualFeedback ? 'checkmark-circle' : 'cloud-download-outline'}
                                        size={12}
                                        color={puxadoIndividualFeedback ? '#15803D' : '#7C3AED'}
                                        style={{ marginRight: 2 }}
                                      />
                                      <Text style={{ fontSize: 11, fontWeight: '700', color: puxadoIndividualFeedback ? '#15803D' : '#7C3AED' }}>
                                        {puxadoIndividualFeedback ? 'Puxado!' : 'Puxar da Configuração'}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => setShowReformaTributaria(!showReformaTributaria)}
                                      style={{ padding: 4 }}
                                      activeOpacity={0.7}
                                    >
                                      <Ionicons 
                                        name={showReformaTributaria ? "chevron-up" : "chevron-down"} 
                                        size={14} 
                                        color="#64748B" 
                                      />
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                {showReformaTributaria && (
                                  <View style={styles.accordionBody}>
                                    {/* IBS */}
                                    <Text style={[styles.labelCompact, { color: '#6A1B9A', fontWeight: 'bold', marginBottom: 4 }]}>IBS</Text>
                                    <View style={[styles.row, { marginBottom: 6 }]}>
                                      <View style={[styles.inputGroupCompact, { flex: 1, marginRight: 4 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#6A1B9A' }]}>CST IBS</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.ibsCst}
                                          onChangeText={(t) => setFormData({...formData, ibsCst: t})}
                                          keyboardType="numeric"
                                          maxLength={3}
                                          placeholder="000"
                                        />
                                      </View>
                                      <View style={[styles.inputGroupCompact, { flex: 1.2, marginHorizontal: 2 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#6A1B9A' }]}>Cl.Trib.IBS</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.ibsClassTrib}
                                          onChangeText={(t) => setFormData({...formData, ibsClassTrib: t})}
                                          keyboardType="numeric"
                                          maxLength={6}
                                          placeholder="410031"
                                        />
                                      </View>
                                      <View style={[styles.inputGroupCompact, { flex: 1, marginLeft: 4 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#6A1B9A' }]}>Alíq. %</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.ibsAliquota}
                                          onChangeText={(t) => setFormData({...formData, ibsAliquota: t})}
                                          keyboardType="decimal-pad"
                                          placeholder="0.00"
                                        />
                                      </View>
                                    </View>

                                    {/* CBS */}
                                    <Text style={[styles.labelCompact, { color: '#E65100', fontWeight: 'bold', marginBottom: 4 }]}>CBS & Imposto Seletivo</Text>
                                    <View style={styles.row}>
                                      <View style={[styles.inputGroupCompact, { flex: 1, marginRight: 3 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#E65100' }]}>CST CBS</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.cbsCst}
                                          onChangeText={(t) => setFormData({...formData, cbsCst: t})}
                                          keyboardType="numeric"
                                          maxLength={3}
                                          placeholder="000"
                                        />
                                      </View>
                                      <View style={[styles.inputGroupCompact, { flex: 1.1, marginHorizontal: 2 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#E65100' }]}>Cl.Trib.CBS</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.cbsClassTrib}
                                          onChangeText={(t) => setFormData({...formData, cbsClassTrib: t})}
                                          keyboardType="numeric"
                                          maxLength={6}
                                          placeholder="410031"
                                        />
                                      </View>
                                      <View style={[styles.inputGroupCompact, { flex: 1, marginHorizontal: 2 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#E65100' }]}>Alíq. %</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.cbsAliquota}
                                          onChangeText={(t) => setFormData({...formData, cbsAliquota: t})}
                                          keyboardType="decimal-pad"
                                          placeholder="0.00"
                                        />
                                      </View>
                                      <View style={[styles.inputGroupCompact, { flex: 0.9, marginLeft: 3 }]}>
                                        <Text style={[styles.labelCompact, { fontSize: 10, color: '#B71C1C' }]}>IS %</Text>
                                        <TextInput
                                          style={styles.inputCompact}
                                          value={formData.isAliquota}
                                          onChangeText={(t) => setFormData({...formData, isAliquota: t})}
                                          keyboardType="decimal-pad"
                                          placeholder="0.00"
                                        />
                                      </View>
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })()}
                   </View>
                   <View style={{height: 40}} />
                </ScrollView>
             </KeyboardAvoidingView>
             
             <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setModalVisible(false)}>
                   <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleSaveProduct}>
                   <Text style={styles.modalButtonTextPrimary}>Salvar Produto</Text>
                </TouchableOpacity>
             </View>
          </View>
        </Modal>

        {/* Modal de Replicação em Massa */}
        <BulkProductModal
          visible={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          baseProduct={getBaseProductForBulk()}
          onSuccess={handleBulkSuccess}
        />

        {/* Modal de Aplicação Fiscal em Massa */}
        <BulkFiscalModal
          visible={showBulkFiscalModal}
          onClose={() => setShowBulkFiscalModal(false)}
          initialCategory={selectedCategory}
          categorias={categorias || []}
          products={products || []}
          onSuccess={() => loadInitialData()}
        />

        {/* Modal de Cadastro Inteligente de Produtos */}
        <SmartBatchProductModal
          visible={showSmartBatchModal}
          onClose={() => setShowSmartBatchModal(false)}
          initialCategory={selectedCategory}
          categorias={categorias || []}
          products={products || []}
          onSuccess={() => loadInitialData()}
        />

        {/* Modal de Cadastro Rápido de Nova Categoria */}
        <Modal
          visible={showModalNovaCategoria}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            if (!loadingNovaCategoria) setShowModalNovaCategoria(false);
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 99999 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SafeIcon name="pricetag" size={20} color="#2563EB" fallbackText="🏷️" />
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1E293B' }}>Nova Categoria</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowModalNovaCategoria(false)}
                  disabled={loadingNovaCategoria}
                >
                  <SafeIcon name="close" size={22} color="#64748B" fallbackText="X" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
                Digite o nome da categoria. Ela será gravada no banco e selecionada automaticamente neste produto.
              </Text>

              <Text style={[styles.label, { marginBottom: 4 }]}>Nome da Categoria *</Text>
              <TextInput
                style={[styles.input, { marginBottom: 18 }]}
                placeholder="Ex: Sobremesas, Vinhos, Combos"
                value={novaCategoriaNome}
                onChangeText={setNovaCategoriaNome}
                autoFocus={true}
                onSubmitEditing={handleCreateNovaCategoria}
                returnKeyType="done"
                editable={!loadingNovaCategoria}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowModalNovaCategoria(false)}
                  disabled={loadingNovaCategoria}
                  style={{ flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateNovaCategoria}
                  disabled={loadingNovaCategoria}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: 8,
                    backgroundColor: loadingNovaCategoria ? '#93C5FD' : '#2563EB',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {loadingNovaCategoria ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <SafeIcon name="checkmark" size={16} color="#fff" fallbackText="✓" />
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>Salvar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal de Cadastro Rápido de Novo Local */}
        <Modal
          visible={showModalNovoLocal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowModalNovoLocal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>📍 Novo Local de Estoque</Text>
                <TouchableOpacity onPress={() => setShowModalNovoLocal(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
                Cadastre um local físico onde os produtos ficam disponíveis para venda (ex: Geladeira 3, Chapa 2, Expositor, Freezer).
              </Text>

              <Text style={[styles.label, { marginBottom: 4 }]}>Nome do Local *</Text>
              <TextInput
                style={[styles.input, { marginBottom: 14 }]}
                placeholder="Ex: Geladeira 3, Chapa 2, Balcão Doces"
                value={novoLocalNome}
                onChangeText={setNovoLocalNome}
              />

              <Text style={[styles.label, { marginBottom: 6 }]}>Tipo do Local:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {[
                  { tipo: 'GELADEIRA', label: 'Geladeira / Freezer', icon: 'snow' },
                  { tipo: 'BALCAO', label: 'Balcão / Vitrine', icon: 'storefront' },
                  { tipo: 'COZINHA', label: 'Cozinha / Chapa', icon: 'restaurant' },
                  { tipo: 'BAR', label: 'Bar / Doses', icon: 'wine' },
                  { tipo: 'OUTRO', label: 'Outro', icon: 'location' }
                ].map(item => {
                  const isSel = novoLocalTipo === item.tipo;
                  return (
                    <TouchableOpacity
                      key={item.tipo}
                      onPress={() => setNovoLocalTipo(item.tipo)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: isSel ? '#0284C7' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isSel ? '#0284C7' : '#CBD5E1',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Ionicons name={item.icon as any} size={14} color={isSel ? '#fff' : '#475569'} />
                      <Text style={{ fontSize: 12, fontWeight: isSel ? 'bold' : 'normal', color: isSel ? '#fff' : '#334155' }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowModalNovoLocal(false)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateNovoLocal}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#0284C7', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>Salvar Local</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Dropdown Flutuante de Seleção de Local de Estoque */}
        <Modal
          visible={showLocalMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLocalMenu(false)}
        >
          <TouchableOpacity
            style={styles.localModalOverlay}
            activeOpacity={1}
            onPress={() => setShowLocalMenu(false)}
          >
            <View style={styles.localModalCard}>
              <View style={styles.localModalHeader}>
                <Ionicons name="location" size={16} color="#0284C7" />
                <Text style={styles.localModalTitle}>Filtrar por Local de Estoque</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.localDropdownItem,
                  selectedLocalFilter === '' && styles.localDropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedLocalFilter('');
                  setShowLocalMenu(false);
                }}
              >
                <Ionicons name="apps" size={15} color={selectedLocalFilter === '' ? '#0284C7' : '#64748B'} />
                <Text style={[styles.localDropdownItemText, selectedLocalFilter === '' && styles.localDropdownItemTextActive]}>
                  Todos os Locais
                </Text>
                {selectedLocalFilter === '' && <Ionicons name="checkmark" size={16} color="#0284C7" />}
              </TouchableOpacity>

              {locaisEstoque.map(loc => {
                const isSel = selectedLocalFilter === loc.nome;
                return (
                  <TouchableOpacity
                    key={loc.id}
                    style={[
                      styles.localDropdownItem,
                      isSel && styles.localDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedLocalFilter(isSel ? '' : loc.nome);
                      setShowLocalMenu(false);
                    }}
                  >
                    <Ionicons
                      name={loc.tipo === 'GELADEIRA' ? 'snow' : loc.tipo === 'COZINHA' ? 'restaurant' : 'storefront'}
                      size={15}
                      color={isSel ? '#0284C7' : '#64748B'}
                    />
                    <Text style={[styles.localDropdownItemText, isSel && styles.localDropdownItemTextActive]}>
                      {loc.nome}
                    </Text>
                    {isSel && <Ionicons name="checkmark" size={16} color="#0284C7" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  novoProdutoHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  novoProdutoHeaderBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  estoqueXmlHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00838F',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#00838F',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  estoqueXmlHeaderButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  estoqueMobileHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00838F',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  estoqueMobileButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  dbText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  searchAndControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  statusChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  statusChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusChipBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusChipBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statusChipBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  sortAndViewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoriesRibbon: {
    marginBottom: 6,
  },
  horizontalScrollContent: {
    gap: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  categoryFiscalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginLeft: 6,
  },
  categoryFiscalPillText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#92400E',
  },
  localDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 175,
  },
  localDropdownButtonActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#38BDF8',
  },
  localDropdownText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    maxWidth: 120,
  },
  localDropdownTextActive: {
    color: '#0369A1',
    fontWeight: 'bold',
  },
  localModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  localModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  localModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  localModalTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  localDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  localDropdownItemActive: {
    backgroundColor: '#F0F9FF',
  },
  localDropdownItemText: {
    flex: 1,
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
  },
  localDropdownItemTextActive: {
    color: '#0284C7',
    fontWeight: 'bold',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  sortText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    padding: 6,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridCard: {
    flex: 1,
    margin: 6,
  },
  listCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  productDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  priceContainer: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  sellPrice: {
    color: '#2196F3',
    fontSize: 16,
  },
  stockBreakdownContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stockMainText: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 2,
  },
  stockSubText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickTransferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#B2EBF2',
  },
  quickTransferText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#00838F',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeaderWrapper: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  replicarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  replicarBtnText: {
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 13,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  modalContent: {
    flex: 1,
  },
  formContentContainer: {
    padding: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  switchesPrecoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  switchOptionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchOptionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tamanhosBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tamanhosTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  addTamanhoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  addTamanhoBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  tamanhoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  removeTamanhoBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subCardLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  compactPhotoBox: {
    alignItems: 'center',
    gap: 4,
  },
  compactPhotoWrapper: {
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  compactPhoto: {
    width: '100%',
    height: '100%',
  },
  compactPhotoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPhotoPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 2,
  },
  compactPhotoText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  compactPhotoChangeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  compactPhotoChangeText: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: 'bold',
  },
  labelCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 3,
  },
  labelRequired: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  requiredTag: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: 'bold',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  inputCompact: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 34,
  },
  inputRequired: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  inputGroupCompact: {
    marginBottom: 6,
  },
  chipScrollRequired: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 8,
    padding: 3,
    backgroundColor: '#FEF2F2',
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActiveCompact: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  chipTextCompact: {
    fontSize: 11,
    color: '#64748B',
  },
  chipTextActiveCompact: {
    color: '#0284C7',
    fontWeight: 'bold',
  },
  locaisSelectorContainerCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  localSelectorChipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  localSelectorChipTextCompact: {
    fontSize: 11,
    color: '#334155',
  },
  totalEstoqueBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 34,
  },
  totalEstoqueVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  switchLabelCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  ncmDirectBtnCosmos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ncmDirectBtnCosmosText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  ncmDirectBtnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ncmDirectBtnGoogleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6A1B9A',
  },
  badgePreenchido: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  badgePreenchidoText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6A1B9A',
  },
  accordionBody: {
    backgroundColor: '#FCFAFF',
    borderWidth: 1,
    borderColor: '#F3E8FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  locaisSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  localSelectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  localSelectorChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  localSelectorChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  localSelectorChipTextActive: {
    fontWeight: 'bold',
    color: '#fff',
  },
  formSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#2196F3',
  },
  chipText: {
    fontSize: 14,
    color: '#64748B',
  },
  chipTextActive: {
    color: '#0284C7',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#334155',
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Thumbnail na listagem
  cardThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#F1F5F9',
  },
  cardThumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Foto no modal
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoPreviewWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  photoPreview: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  photoPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  photoActionsBox: {
    flex: 1,
    justifyContent: 'center',
  },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8,
  },
  pickPhotoBtnDisabled: {
    opacity: 0.6,
  },
  pickPhotoBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  photoHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 15,
  },
});
