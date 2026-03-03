import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, getSecureItem, setSecureItem } from '../src/services/storage';
import { testApiConnection, API_URL, printerService } from '../src/services/api';
import { scanWifiNetworks, connectToWifi, isWifiConnectionRealPossible } from '../src/services/wifi';
import { SafeIcon } from '../components/SafeIcon';
import * as DocumentPicker from 'expo-document-picker';
import NfceService, { NfceConfig } from '../src/services/NfceService';


export default function ConfiguracoesScreen() {
  const router = useRouter();
  // API
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<null | { ok: boolean; message: string }>(null);

  // Printers
  const [printers, setPrinters] = useState<any[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [savingPrinter, setSavingPrinter] = useState(false);

  // WiFi
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [wifiNetworks, setWifiNetworks] = useState<{ ssid: string; signal?: number; security?: string }[]>([]);
  const [selectedSSID, setSelectedSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [savingWifi, setSavingWifi] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [testingWifi, setTestingWifi] = useState(false);
  const [wifiTestStatus, setWifiTestStatus] = useState<null | { ok: boolean; message: string }>(null);
  const [wifiRealCapable, setWifiRealCapable] = useState<boolean | null>(null);
  const [apiTimeoutMs, setApiTimeoutMs] = useState('');

  // Fiscal
  const [csc, setCsc] = useState('');
  const [cscId, setCscId] = useState('');
  const [certPassword, setCertPassword] = useState('');
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [isProd, setIsProd] = useState(false);
  const [serie, setSerie] = useState('1');
  const [numeroInicial, setNumeroInicial] = useState('');
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [savedCertPath, setSavedCertPath] = useState<string | null>(null);
  const [xmlFolder, setXmlFolder] = useState('');
  const [chavePix, setChavePix] = useState(''); // NEW state
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [serverPath, setServerPath] = useState(''); // Current path being browsed
  const [dirList, setDirList] = useState<any[]>([]);
  const [loadingDirs, setLoadingDirs] = useState(false);


  useEffect(() => {
    (async () => {
      try {
        const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
        const storedKey = await getSecureItem(STORAGE_KEYS.API_AUTH_KEY);
        const storedMapKey = await getSecureItem(STORAGE_KEYS.GOOGLE_MAPS_KEY);
        const storedSsid = await getSecureItem(STORAGE_KEYS.WIFI_SSID);
        const storedPwd = await getSecureItem(STORAGE_KEYS.WIFI_PASSWORD);
        const savedTimeoutStr = await AsyncStorage.getItem(STORAGE_KEYS.API_TIMEOUT_MS);
        if (storedUrl) setApiUrl(storedUrl);
        if (!storedUrl) setApiUrl(API_URL);
        if (storedKey) setApiKey(storedKey);
        if (storedMapKey) setGoogleMapsKey(storedMapKey);
        if (storedSsid) setSelectedSSID(storedSsid);
        if (storedPwd) setWifiPassword(storedPwd);
        if (savedTimeoutStr) setApiTimeoutMs(savedTimeoutStr);
      } catch (e) {
        console.warn('Falha ao carregar configurações:', e);
      }
      
      // Carregar dados fiscais do backend se tiver API URL
      const savedApiUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
      const urlToUse = savedApiUrl || API_URL;
      
      if (urlToUse) {
         try {
             // Load Printer Config
             loadPrinters();

             const config = await NfceService.getConfig();
             if (config) {
                 setCsc(config.csc);
                 setCscId(config.cscId);
                 setIsProd(config.ambiente === 'producao');
                 if (config.serie) setSerie(config.serie);
                 if (config.numeroInicial) setNumeroInicial(config.numeroInicial);
                 if (config.certificadoSenha) setCertPassword(config.certificadoSenha);
                 setSavedCertPath(config.certificadoPath || null);
                 if (config.xmlFolder) setXmlFolder(config.xmlFolder);
                 if (config.chavePix) setChavePix(config.chavePix); // Load saved PIX Key
             }
         } catch (e) {
             console.log("Ainda não conectou ou erro ao buscar config fiscal");
         }
      }
    })();
  }, []);

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const res = await printerService.list();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []);
      setPrinters(list);
    } catch (e) {
      console.log('Erro ao carregar impressoras', e);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleAddPrinter = async () => {
    if (!newPrinterName.trim()) {
      Alert.alert('Erro', 'Informe o nome da impressora');
      return;
    }
    setSavingPrinter(true);
    try {
      await printerService.create({ 
        nome: newPrinterName, 
        address: newPrinterAddress, 
        ativo: true 
      });
      setNewPrinterName('');
      setNewPrinterAddress('');
      setPrinterModalVisible(false);
      Alert.alert('Sucesso', 'Impressora cadastrada!');
      loadPrinters();
    } catch (e) {
      Alert.alert('Erro', 'Falha ao cadastrar impressora.');
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    Alert.alert('Confirmar', 'Deseja remover esta impressora?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          try {
            await printerService.delete(id);
            loadPrinters();
          } catch (e) {
            Alert.alert('Erro', 'Falha ao remover impressora.');
          }
      }}
    ]);
  };

  const handleScanWifi = async () => {
    setScanning(true);
    setTestStatus(null);
    try {
      const list = await scanWifiNetworks();
      if (!list || list.length === 0) {
        Alert.alert('WiFi', 'A listagem de redes reais requer build nativa Android. No navegador/Expo Go, use o campo SSID manual.');
      } else {
        setWifiNetworks(list);
        setWifiModalVisible(true);
      }
    } catch (e) {
      Alert.alert('WiFi', 'Falha ao listar redes disponíveis. Verifique permissões e build nativa.');
    } finally {
      setScanning(false);
    }
  };

  // Helpers para evitar URLs locais e facilitar preenchimento
  const isLocalUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
};

const getEnvApiUrl = (): string | undefined => {
  try {
    // @ts-ignore
    return typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined;
  } catch {
    return undefined;
  }
};

  const handleSaveApi = async () => {
    if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
      Alert.alert('Configuração da API', 'Informe uma URL válida (http/https).');
      return;
    }
    // Evita salvar localhost/127.0.0.1
    if (isLocalUrl(apiUrl) && Platform.OS !== 'web') {
      Alert.alert('Configuração da API', 'URL local (localhost/127.0.0.1) não funciona fora do servidor. Informe a URL pública ou IP acessível na rede.');
      return;
    }
    setSavingApi(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, apiUrl);
      if (apiKey) await setSecureItem(STORAGE_KEYS.API_AUTH_KEY, apiKey);
      else await setSecureItem(STORAGE_KEYS.API_AUTH_KEY, '');

      if (googleMapsKey) await setSecureItem(STORAGE_KEYS.GOOGLE_MAPS_KEY, googleMapsKey);
      else await setSecureItem(STORAGE_KEYS.GOOGLE_MAPS_KEY, '');

      Alert.alert('Configuração da API', 'Configurações salvas com sucesso.');
    } catch (e) {
      Alert.alert('Configuração da API', 'Falha ao salvar as configurações.');
    } finally {
      setSavingApi(false);
    }
  };

  const handleFillAuto = () => {
    const envUrl = getEnvApiUrl();
    const candidate = envUrl || API_URL;
    if (!candidate) {
      Alert.alert('Configuração da API', 'Não foi possível detectar a URL. Informe manualmente.');
      return;
    }
    if (isLocalUrl(candidate) && Platform.OS !== 'web') {
      Alert.alert('Configuração da API', 'Detecção automática retornou endereço local (localhost/127.0.0.1). Informe o IP/DNS acessível da rede.');
      return;
    }
    setApiUrl(candidate);
  };

  const handleClearApi = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
      const envUrl = getEnvApiUrl();
      setApiUrl(envUrl || '');
      Alert.alert('Configuração da API', 'URL salva removida. Defina novamente ou use ENV.');
    } catch (e) {
      Alert.alert('Configuração da API', 'Falha ao limpar URL.');
    }
  };

  const handleUseEnv = () => {
    const envUrl = getEnvApiUrl();
    if (!envUrl) {
      Alert.alert('Configuração da API', 'Nenhuma EXPO_PUBLIC_API_URL disponível. Informe manualmente.');
      return;
    }
    if (isLocalUrl(envUrl) && Platform.OS !== 'web') {
      Alert.alert('Configuração da API', 'ENV aponta para localhost/127.0.0.1, isso não funciona fora da máquina do servidor.');
      return;
    }
    setApiUrl(envUrl);
  };

  // Salvar Timeout da API (ms)
  const handleSaveApiTimeout = async () => {
    const val = Number(apiTimeoutMs);
    if (!Number.isFinite(val) || val < 3000 || val > 60000) {
      Alert.alert('Timeout da API', 'Informe um valor entre 3000 e 60000 ms.');
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_TIMEOUT_MS, String(val));
      Alert.alert('Timeout da API', 'Timeout salvo com sucesso. As próximas requisições usarão este valor.');
    } catch (e) {
      Alert.alert('Timeout da API', 'Falha ao salvar o timeout.');
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
      Alert.alert('Teste de Conexão', 'Informe uma URL válida para a API.');
      return;
    }
    setTesting(true);
    setTestStatus(null);
    const result = await testApiConnection(apiUrl, apiKey);
    if (result.ok) {
      setTestStatus({ ok: true, message: `Conectado (status ${result.status}).` });
    } else {
      setTestStatus({ ok: false, message: `Falha (status ${result.status}): ${String(result.reason)}` });
    }
    setTesting(false);
  };

  const handleSaveWifi = async () => {
    if (!selectedSSID) {
      Alert.alert('Configuração de WiFi', 'Selecione uma rede WiFi (SSID).');
      return;
    }
    if (!wifiPassword) {
      Alert.alert('Configuração de WiFi', 'Informe a senha da rede WiFi.');
      return;
    }
    setSavingWifi(true);
    try {
      // Simula tentativa de conexão (mock) e salva credenciais com segurança
      await connectToWifi(selectedSSID, wifiPassword);
      await setSecureItem(STORAGE_KEYS.WIFI_SSID, selectedSSID);
      await setSecureItem(STORAGE_KEYS.WIFI_PASSWORD, wifiPassword);
      Alert.alert('Configuração de WiFi', 'Configurações salvas com sucesso.');
    } catch (e) {
      Alert.alert('Configuração de WiFi', 'Falha ao conectar/salvar configuração.');
    } finally {
      setSavingWifi(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const capable = await isWifiConnectionRealPossible();
        setWifiRealCapable(capable);
      } catch {
        setWifiRealCapable(false);
      }
    })();
  }, []);

  const handleTestWifi = async () => {
    setWifiTestStatus(null);
    const realPossible = await isWifiConnectionRealPossible();
    if (!selectedSSID) {
      Alert.alert('Teste de WiFi', 'Informe ou selecione uma rede WiFi (SSID).');
      setWifiTestStatus({ ok: false, message: 'SSID ausente.' });
      return;
    }
    if (!wifiPassword) {
      Alert.alert('Teste de WiFi', 'Informe a senha da rede WiFi.');
      setWifiTestStatus({ ok: false, message: 'Senha ausente.' });
      return;
    }
    setTestingWifi(true);
    try {
      const res = await connectToWifi(selectedSSID, wifiPassword);
      const msg = res?.success
        ? realPossible
          ? `Conexão bem-sucedida à rede ${selectedSSID}.`
          : `Teste simulado concluído com sucesso para ${selectedSSID} (Web/Expo Go/iOS).`
        : 'Falha ao conectar.';
      setWifiTestStatus({ ok: !!res?.success, message: msg });
      Alert.alert('Teste de WiFi', msg);
    } catch (e) {
      const msg = realPossible ? 'Falha ao conectar. Verifique SSID/senha e permissões.' : 'Falha ao simular teste. Verifique SSID/senha.';
      setWifiTestStatus({ ok: false, message: msg });
      Alert.alert('Teste de WiFi', msg);
    } finally {
      setTestingWifi(false);
    }
  };

  // Handlers Fiscais
  const handleSelectCert = async () => {
    try {
      console.log('Iniciando seleção de certificado...');
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/x-pkcs12', // .pfx or .p12
        copyToCacheDirectory: true,
        multiple: false
      });
      
      console.log('Resultado DocumentPicker:', res);

      if (res.canceled) {
        console.log('Seleção cancelada');
        return;
      }
      
      const file = res.assets ? res.assets[0] : (res as any); // Compatibilidade
      if (!file) {
        Alert.alert('Erro', 'Arquivo não identificado.');
        return;
      }

      console.log('Arquivo selecionado:', file);
      setSelectedCert(file);
      
      // On Web, alert immediately to confirm selection
      if (Platform.OS === 'web') {
        window.alert(`Arquivo selecionado: ${file.name}`);
      } else {
        Alert.alert('Certificado', `Arquivo selecionado: ${file.name}`);
      }
    } catch (e) {
      console.error('Erro handleSelectCert:', e);
      Alert.alert('Erro', 'Falha ao selecionar arquivo: ' + String(e));
    }
  };

  const fetchDirectories = useCallback(async (path?: string) => {
      setLoadingDirs(true);
      try {
          const u = apiUrl || API_URL;
          if (!u) {
              setLoadingDirs(false);
              return;
          }
          const endpoint = `${u}/system/directories${path ? `?path=${encodeURIComponent(path)}` : ''}`;
          // Add auth header if available
          const token = await getSecureItem(STORAGE_KEYS.API_AUTH_KEY); // Assuming token key logic
          // Actually, configuracoes usually uses apiKey or JWT. Let's use getSecureItem logic.
          // Re-using testApiConnection logic or similar fetch
          const fullApiKey = await getSecureItem(STORAGE_KEYS.API_AUTH_KEY);
          
          const headers: any = { 'Content-Type': 'application/json' };
          // If we have an auth expectation. server.js expects "Authorization: Bearer <JWT>". 
          // The admin panel usually has a token from login. 
          // However, configuracoes might be accessible. 
          // *CRITICAL*: The user mentioned "not saving path", so maybe they aren't logged in properly?
          // We will use the stored JWT if available.
          const userToken = await AsyncStorage.getItem('userToken'); // Assuming standard storage
          if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
          
          const res = await fetch(endpoint, { headers });
          if (!res.ok) throw new Error('Falha ao listar pastas');
          
          const data = await res.json();
          setServerPath(data.currentPath);
          setDirList(data.directories || []);
      } catch (e) {
          Alert.alert('Erro', 'Não foi possível listar diretórios do servidor.');
      } finally {
          setLoadingDirs(false);
      }
  }, [apiUrl]);

  useEffect(() => {
     if (folderModalVisible) {
        fetchDirectories(serverPath || undefined);
     }
  }, [folderModalVisible]);


  const handleSaveFiscal = async () => {
    if (!csc || !cscId) {
      Alert.alert('Fiscal', 'Preencha CSC e ID CSC.');
      return;
    }
    setSavingFiscal(true);
    try {
      const config: NfceConfig = {
        csc,
        cscId,
        certificadoSenha: certPassword,
        ambiente: isProd ? 'producao' : 'homologacao',
        serie,
        numeroInicial,
        xmlFolder,
        chavePix // Include in update
      };
      await NfceService.updateConfig(config, selectedCert);
      Alert.alert('Fiscal', 'Configurações fiscais salvas com sucesso.');
    } catch (e: any) {
      Alert.alert('Fiscal', typeof e === 'string' ? e : 'Erro ao salvar configurações.');
    } finally {
      setSavingFiscal(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ScreenIdentifier screenName="Configurações" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações do Aplicativo</Text>
        <Text style={styles.headerSubtitle}>Defina a URL da API e as credenciais WiFi.</Text>
      </View>

      <View style={{ margin: 16, marginBottom: 0 }}>
        <TouchableOpacity 
            style={[styles.button, styles.primaryButton, { backgroundColor: '#ff9800', justifyContent: 'flex-start' }]} 
            onPress={() => router.push('/delivery-config')}
            activeOpacity={0.8}
        >
            <Ionicons name="bicycle" size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={[styles.primaryButtonText, { fontSize: 16 }]}>Configurar Delivery</Text>
        </TouchableOpacity>
      </View>

      {/* Seção API */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="globe" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Configuração da API</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>URL da API</Text>
          <TextInput
            placeholder="http://192.168.0.10:4000/api"
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
          />
          <View style={[styles.row, { marginTop: 10 }]}> 
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleFillAuto} activeOpacity={0.8}>
              <Ionicons name="flash" size={18} color="#2196F3" />
              <Text style={[styles.buttonText, { color: '#2196F3' }]}> Preencher automaticamente</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
            Detectado: {API_URL || '(sem detecção)'}
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Chave de Autenticação (opcional)</Text>
          <TextInput
            placeholder="Cole aqui a chave (se aplicável)"
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
           <Text style={styles.label}>Google Maps API Key (Opcional)</Text>
           <TextInput
             placeholder="AIzaSy..."
             style={styles.input}
             value={googleMapsKey}
             onChangeText={setGoogleMapsKey}
             autoCapitalize="none"
           />
           <Text style={{fontSize:10, color:'#666', marginTop:4}}>
              Necessária para cálculo preciso de rotas e mapas.
           </Text>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleTestConnection} activeOpacity={0.8}>
            {testing ? (
              <ActivityIndicator color="#2196F3" />
            ) : (
              <>
                <SafeIcon name="link" size={18} color="#2196F3" fallbackText="🔗" />
                <Text style={[styles.buttonText, { color: '#2196F3' }]}> Testar Conexão</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSaveApi} activeOpacity={0.8}>
            {savingApi ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SafeIcon name="save" size={18} color="#fff" fallbackText="💾" />
                <Text style={styles.primaryButtonText}> Salvar API</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.row, { marginTop: 10 }]}> 
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleClearApi} activeOpacity={0.8}>
            <Ionicons name="trash" size={18} color="#b71c1c" />
            <Text style={[styles.buttonText, { color: '#b71c1c' }]}> Limpar URL da API</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleUseEnv} activeOpacity={0.8}>
            <Ionicons name="globe-outline" size={18} color="#2196F3" />
            <Text style={[styles.buttonText, { color: '#2196F3' }]}> Usar ENV</Text>
          </TouchableOpacity>
        </View>

        {testStatus && (
          <View style={[styles.testResult, testStatus.ok ? styles.testOk : styles.testFail]}>
            <Ionicons name={testStatus.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={testStatus.ok ? '#2e7d32' : '#b71c1c'} fallbackText={testStatus.ok ? '✓' : '!'} />
            <Text style={[styles.testResultText, { color: testStatus.ok ? '#2e7d32' : '#b71c1c' }]}>
              {testStatus.message}
            </Text>
          </View>
        )}
      </View>

      {/* Seção WiFi */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="wifi" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Configuração de WiFi</Text>
          {wifiRealCapable !== null && (
            <View style={[styles.statusBadge, wifiRealCapable ? styles.statusBadgeReal : styles.statusBadgeSimulated]}>
              <Ionicons name={wifiRealCapable ? 'checkmark' : 'information-circle'} size={14} color={wifiRealCapable ? '#2e7d32' : '#1a237e'} />
              <Text style={[styles.statusBadgeText, { color: wifiRealCapable ? '#2e7d32' : '#1a237e' }]}>
                {wifiRealCapable ? 'Modo: Real' : 'Modo: Simulado'}
              </Text>
            </View>
          )}
        </View>

        {/* Campo para SSID manual */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Rede (SSID)</Text>
          <TextInput
            placeholder="Digite o SSID ou use Buscar Redes"
            style={styles.input}
            value={selectedSSID}
            onChangeText={setSelectedSSID}
            autoCapitalize="none"
          />
          <View style={[styles.row, { marginTop: 10 }]}>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleScanWifi} activeOpacity={0.8}>
              {scanning ? (
                <ActivityIndicator color="#2196F3" />
              ) : (
                <>
                  <Ionicons name="search" size={18} color="#2196F3" />
                  <Text style={[styles.buttonText, { color: '#2196F3' }]}> Buscar Redes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleTestWifi} activeOpacity={0.8}>
              {testingWifi ? (
                <ActivityIndicator color="#2196F3" />
              ) : (
                <>
                  <Ionicons name="wifi" size={18} color="#2196F3" />
                  <Text style={[styles.buttonText, { color: '#2196F3' }]}> Testar WiFi</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setWifiTestStatus(null)} activeOpacity={0.8}>
              <Ionicons name="close-circle" size={18} color="#9E9E9E" />
              <Text style={[styles.buttonText, { color: '#9E9E9E' }]}> Limpar resultado</Text>
            </TouchableOpacity>
          </View>

          {wifiTestStatus && (
            <View style={[styles.testResult, wifiTestStatus.ok ? styles.testOk : styles.testFail]}>
              <Ionicons name={wifiTestStatus.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={wifiTestStatus.ok ? '#2e7d32' : '#b71c1c'} />
              <Text style={[styles.testResultText, { color: wifiTestStatus.ok ? '#2e7d32' : '#b71c1c' }]}>
                {wifiTestStatus.message}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Senha do WiFi"
              style={[styles.input, { flex: 1 }]}
              secureTextEntry={!showPassword}
              value={wifiPassword}
              onChangeText={setWifiPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)} activeOpacity={0.8}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSaveWifi} activeOpacity={0.8}>
          {savingWifi ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}> Salvar WiFi</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Seção Fiscal (NFC-e) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt" size={20} color="#673AB7" />
          <Text style={styles.sectionTitle}>Configuração NFC-e</Text>
          <View style={[styles.statusBadge, isProd ? {backgroundColor:'#FFEBEE', borderColor:'#FFCDD2'} : {backgroundColor:'#E8F5E9', borderColor:'#C8E6C9'}]}>
             <Text style={{fontSize:10, fontWeight:'bold', color: isProd ? '#C62828' : '#2E7D32'}}>
               {isProd ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
             </Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Ambiente</Text>
          <View style={{flexDirection:'row', gap:10}}>
             <TouchableOpacity 
               style={[styles.button, !isProd ? styles.primaryButton : styles.secondaryButton, {flex:1, backgroundColor: !isProd ? '#4CAF50' : '#fff'}]} 
               onPress={() => setIsProd(false)}
             >
               <Text style={[styles.buttonText, {color: !isProd ? '#fff' : '#333'}]}>Homologação</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.button, isProd ? styles.primaryButton : styles.secondaryButton, {flex:1, backgroundColor: isProd ? '#F44336' : '#fff', borderColor: isProd ? '#F44336' : '#ddd'}]}
               onPress={() => setIsProd(true)}
             >
                <Text style={[styles.buttonText, {color: isProd ? '#fff' : '#333'}]}>Produção</Text>
             </TouchableOpacity>
          </View>
        </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>Série</Text>
           <TextInput
             placeholder="Ex: 1"
             style={styles.input}
             value={serie}
             onChangeText={setSerie}
             keyboardType="numeric"
           />
         </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>Último Número do Cupom (ou Inicial)</Text>
           <TextInput
             placeholder="Ex: 100"
             style={styles.input}
             value={numeroInicial}
             onChangeText={setNumeroInicial}
             keyboardType="numeric"
           />
         </View>




         <View style={styles.formGroup}>
           <Text style={styles.label}>Chave PIX (Para QR Code)</Text>
           <TextInput
             placeholder="E-mail, CPF, Telefone ou Aleatória"
             style={styles.input}
             value={chavePix}
             onChangeText={setChavePix}
             autoCapitalize="none"
           />
           <Text style={{fontSize:10, color:'#666', marginTop:4}}>
              O Nome e Cidade serão pegos do cadastro da empresa automaticamente.
           </Text>
         </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>Pasta para Salvar XMLs (No Servidor)</Text>
           <TextInput
             placeholder="Ex: C:\Nfce\Xmls ou /home/user/xmls"
             style={styles.input}
             value={xmlFolder}
             onChangeText={setXmlFolder}
             autoCapitalize="none"
           />
           <Text style={{fontSize:10, color:'#666', marginTop:4}}>
              Se vazio, usa pasta padrão. Subpastas (jan2026) criadas automaticamente.
           </Text>
           <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginTop: 10 }]} onPress={() => { setServerPath(''); setFolderModalVisible(true); }}>
              <Ionicons name="folder-open" size={18} color="#2196F3" />
              <Text style={[styles.buttonText, { color: '#2196F3' }]}> Buscar Pasta no Servidor</Text>
           </TouchableOpacity>
         </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>ID CSC (Token)</Text>
          <TextInput
            placeholder="Ex: 000001"
            style={styles.input}
            value={cscId}
            onChangeText={setCscId}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>NFC-e ID (Token)</Text>
          <TextInput
             placeholder="Ex: 000001"
             style={styles.input}
             value={cscId}
             onChangeText={setCscId}
             keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Certificado Digital (A1 .pfx)</Text>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSelectCert} activeOpacity={0.8}>
             <Ionicons name={selectedCert ? "checkmark-circle" : "document-text"} size={20} color={selectedCert ? "green" : "#666"} />
             <Text style={styles.buttonText}>
               {selectedCert 
                 ? `Selecionado: ${selectedCert.name}` 
                 : savedCertPath 
                   ? `📂 Atual: ${savedCertPath.split(/[/\\]/).pop()} (Toque para trocar)`
                   : 'Selecionar Arquivo .pfx'}
             </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Senha do Certificado</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Senha do arquivo .pfx"
              style={[styles.input, { flex: 1 }]}
              secureTextEntry={!showCertPassword}
              value={certPassword}
              onChangeText={setCertPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCertPassword((v) => !v)} activeOpacity={0.8}>
              <Ionicons name={showCertPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSaveFiscal} activeOpacity={0.8}>
           {savingFiscal ? (
             <ActivityIndicator color="#fff" />
           ) : (
             <>
               <Ionicons name="save" size={18} color="#fff" />
               <Text style={styles.primaryButtonText}> Salvar Fiscal</Text>
             </>
           )}
        </TouchableOpacity>
      </View>

      <ConfiguracaoFidelidade />

      {/* Seção Gestão de Impressoras */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="print" size={20} color="#FF5722" />
          <Text style={styles.sectionTitle}>Gestão de Impressoras</Text>
        </View>

        {loadingPrinters ? (
           <ActivityIndicator size="small" color="#FF5722" style={{ marginVertical: 10 }} />
        ) : (
           <View>
             {printers.length === 0 ? (
               <Text style={{ textAlign: 'center', color: '#666', marginBottom: 10, fontStyle: 'italic' }}>
                 Nenhuma impressora cadastrada.
               </Text>
             ) : (
               printers.map((p) => (
                 <View key={p.id} style={styles.printerItem}>
                   <View style={{ flex: 1 }}>
                     <Text style={styles.printerName}>{p.nome}</Text>
                     <Text style={styles.printerInfo}>
                       {p.address || 'Sem endereço/rede'} {p.modelo ? `• ${p.modelo}` : ''}
                     </Text>
                   </View>
                   <TouchableOpacity onPress={() => handleDeletePrinter(p.id)} style={{ padding: 8 }}>
                     <Ionicons name="trash-outline" size={20} color="#F44336" />
                   </TouchableOpacity>
                 </View>
               ))
             )}
           </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton, { marginTop: 10, borderColor: '#FF5722' }]} 
          onPress={() => setPrinterModalVisible(true)} 
          activeOpacity={0.8}
        >
           <Ionicons name="add-circle" size={18} color="#FF5722" />
           <Text style={[styles.buttonText, { color: '#FF5722' }]}> Adicionar Impressora</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />

      <Modal visible={printerModalVisible} transparent animationType="fade" onRequestClose={() => setPrinterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Impressora</Text>
              <TouchableOpacity onPress={() => setPrinterModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
               <View style={styles.formGroup}>
                 <Text style={styles.label}>Nome da Impressora *</Text>
                 <TextInput
                   placeholder="Ex: Cozinha, Caixa, Delivery"
                   style={styles.input}
                   value={newPrinterName}
                   onChangeText={setNewPrinterName}
                 />
                 <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                   Nomes sugeridos: Caixa, Delivery, Cozinha
                 </Text>
               </View>

               <View style={styles.formGroup}>
                  <Text style={styles.label}>Endereço / Caminho (Opcional)</Text>
                  <TextInput
                    placeholder="Ex: \\PC-CAIXA\Impressora ou 192.168.1.200"
                    style={styles.input}
                    value={newPrinterAddress}
                    onChangeText={setNewPrinterAddress}
                  />
               </View>

               <TouchableOpacity 
                 style={[styles.button, styles.primaryButton, { backgroundColor: '#FF5722', marginTop: 10 }]} 
                 onPress={handleAddPrinter}
               >
                 {savingPrinter ? (
                   <ActivityIndicator color="#fff" />
                 ) : (
                   <>
                     <Ionicons name="save" size={18} color="#fff" />
                     <Text style={styles.primaryButtonText}> Salvar Impressora</Text>
                   </>
                 )}
               </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Seleção de WiFi */}
      <Modal visible={wifiModalVisible} transparent animationType="fade" onRequestClose={() => setWifiModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redes Disponíveis</Text>
              <TouchableOpacity onPress={() => setWifiModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {wifiNetworks.map((net, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.networkItem, selectedSSID === net.ssid && styles.networkItemSelected]}
                  onPress={() => {
                    setSelectedSSID(net.ssid);
                    setWifiModalVisible(false);
                  }}
                >
                  <View style={styles.networkRow}>
                    <Text style={styles.networkSsid}>{net.ssid}</Text>
                    <Text style={styles.networkMeta}>{net.security || '—'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

      </Modal>

      {/* Modal de Seleção de Pasta (Server Side) */}
      <Modal visible={folderModalVisible} transparent animationType="fade" onRequestClose={() => setFolderModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Navegador de Arquivos (Servidor)</Text>
              <TouchableOpacity onPress={() => setFolderModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={{padding:10, backgroundColor:'#f0f0f0', borderBottomWidth:1, borderColor:'#ddd'}}>
               <Text style={{fontSize:12, color:'#666'}}>Caminho Atual:</Text>
               <Text style={{fontWeight:'bold'}}>{serverPath || '(Início)'}</Text>
            </View>

            {loadingDirs ? (
               <View style={{padding:20, alignItems:'center'}}><ActivityIndicator size="large" color="#2196F3"/></View>
            ) : (
               <FlatList
                 data={dirList}
                 keyExtractor={(item) => item.path}
                 style={{maxHeight: 400}}
                 renderItem={({item}) => (
                   <TouchableOpacity 
                     style={[styles.networkItem, {flexDirection:'row', alignItems:'center'}]}
                     onPress={() => fetchDirectories(item.path)}
                   >
                     <Ionicons name={item.type === 'parent' ? 'arrow-up' : 'folder'} size={24} color="#FBC02D" style={{marginRight:10}} />
                     <View>
                        <Text style={styles.networkSsid}>{item.name}</Text>
                        <Text style={styles.networkMeta}>{item.path}</Text>
                     </View>
                   </TouchableOpacity>
                 )}
                 ListEmptyComponent={<Text style={{padding:20, textAlign:'center'}}>Nenhuma pasta encontrada.</Text>}
               />
            )}
            
            <View style={{padding:10, borderTopWidth:1, borderColor:'#eee', flexDirection:'row', justifyContent:'flex-end', gap:10}}>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setFolderModalVisible(false)}>
                    <Text>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => { 
                    console.log('Selecionando:', serverPath);
                    setXmlFolder(serverPath); 
                    setFolderModalVisible(false);
                    // Force feedback
                    Alert.alert('Pasta Selecionada', `Pasta definida: ${serverPath}`);
                }}>
                    <Text style={{color:'#fff'}}>Selecionar Pasta Atual</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


function ConfiguracaoFidelidade() {
    const [cashbackPercent, setCashbackPercent] = useState('0');
    const [pontosResgate, setPontosResgate] = useState('0');
    const [valorResgate, setValorResgate] = useState('0');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { companyService } = require('../src/services/api');
            const res = await companyService.get();
            if (res.data) {
                // Ensure we handle both numbers and strings safely
                const cb = res.data.cashbackPercent !== undefined ? String(res.data.cashbackPercent) : '0';
                const pr = res.data.pontosParaResgate !== undefined ? String(res.data.pontosParaResgate) : '0';
                const vr = res.data.valorResgate !== undefined ? String(res.data.valorResgate) : '0';
                
                setCashbackPercent(cb.replace('.', ','));
                setPontosResgate(pr);
                setValorResgate(vr.replace('.', ','));
            }
        } catch (e) {
            console.log('Erro ao carregar fidelidade:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { companyService } = require('../src/services/api');
            
            // Clean inputs: replace commas with dots, remove non-numeric chars (except dot)
            const parseDecimal = (val) => {
                if (!val) return 0;
                const clean = val.replace(',', '.');
                return parseFloat(clean) || 0;
            };
            
            const parseIntSafe = (val) => {
               if (!val) return 0;
               return parseInt(val.replace(/\D/g, '')) || 0;
            };

            const payload = {
                cashbackPercent: parseDecimal(cashbackPercent),
                pontosParaResgate: parseIntSafe(pontosResgate),
                valorResgate: parseDecimal(valorResgate),
                pointsPerCurrency: 1 // Default/Fixed value to prevent backend error
            };
            
            console.log('Saving Fidelidade:', payload);

            await companyService.update(payload);
            Alert.alert('Fidelidade', 'Configurações de Cashback salvas com sucesso!');
            
            // Reload to confirm format
            loadData();
        } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Falha ao salvar configurações de fidelidade.');
        } finally {
            setSaving(false);
        }
    };

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="gift" size={20} color="#E91E63" />
          <Text style={styles.sectionTitle}>Fidelidade e Cashback</Text>
        </View>

        {loading ? (
            <ActivityIndicator size="small" color="#E91E63" />
        ) : (
            <>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>% Cashback por Venda</Text>
                    <TextInput
                        placeholder="Ex: 5"
                        style={styles.input}
                        value={cashbackPercent}
                        onChangeText={setCashbackPercent}
                        keyboardType="numeric"
                    />
                    <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                        Porcentagem do valor da venda que volta como crédito para o cliente.
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Regra: Pontos Necessários</Text>
                        <TextInput
                            placeholder="Ex: 100"
                            style={styles.input}
                            value={pontosResgate}
                            onChangeText={setPontosResgate}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Valor do Resgate (R$)</Text>
                        <TextInput
                            placeholder="Ex: 10"
                            style={styles.input}
                            value={valorResgate}
                            onChangeText={setValorResgate}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
                <Text style={{ fontSize: 10, color: '#666', marginTop: -10, marginBottom: 16 }}>
                    Ex: A cada {pontosResgate || 100} pontos, o cliente pode abater R$ {valorResgate || 10}.
                </Text>

                <TouchableOpacity style={[styles.button, styles.primaryButton, { backgroundColor: '#E91E63' }]} onPress={handleSave} activeOpacity={0.8}>
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="save" size={18} color="#fff" />
                            <Text style={styles.primaryButtonText}> Salvar Fidelidade</Text>
                        </>
                    )}
                </TouchableOpacity>
            </>
        )}
      </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#2196F3' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#fff', opacity: 0.9, marginTop: 4 },

  section: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: '#333' },

  formGroup: { marginBottom: 14 },
  label: { fontSize: 14, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  primaryButton: { backgroundColor: '#2196F3' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  secondaryButton: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#BBDEFB' },
  buttonText: { fontWeight: '600' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#BBDEFB' },
  statusBadgeReal: { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' },
  statusBadgeSimulated: { backgroundColor: '#EDE7F6', borderColor: '#D1C4E9' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  testResult: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: '#f5f5f5' },
  testOk: { backgroundColor: '#E8F5E9' },
  testFail: { backgroundColor: '#FFEBEE' },
  testResultText: { fontSize: 13 },

  selectedField: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  selectedText: { marginLeft: 8, color: '#333' },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeButton: { marginLeft: 8, padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  networkItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  networkItemSelected: { backgroundColor: '#E3F2FD' },
  networkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  networkSsid: { fontSize: 14, color: '#333', fontWeight: '600' },
  networkMeta: { fontSize: 12, color: '#666' },
  accessDeniedSubtext: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },
  printerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#eee', 
    marginBottom: 8 
  },
  printerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  printerInfo: { fontSize: 12, color: '#666' }
});