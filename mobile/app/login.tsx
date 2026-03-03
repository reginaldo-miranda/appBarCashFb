import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  Modal,
  Dimensions,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { SafeIcon } from "../components/SafeIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setApiBaseUrl,
  testApiConnection,
  switchServerDbTarget,
  startLocalApi,
} from "../src/services/api";
import { STORAGE_KEYS } from "../src/services/storage";
import Constants from "expo-constants";

// Fallback visual para fundo
const BackgroundGradient = ({ children, style }: any) => {
  return (
    <View style={[{ flex: 1, backgroundColor: '#F0F2F5' }, style]}>
       {children}
    </View>
  );
};


export default function LoginScreen() {
  // const [email, setEmail] = useState("admin@barapp.com");
  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, clearAllStorage } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const ignoreStorageInitRef = useRef(false);

  // Estado para seleção e teste da base da API
  const [dbOption, setDbOption] = useState<"lan" | "railway" | "custom" | "">(
    "lan"
  );
  const [apiUrl, setApiUrl] = useState("");

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000); // Mensagem desaparece após 3 segundos
      return () => clearTimeout(timer);
    }
  }, [showError]);

  // Tentativa automática de conexão LAN ao selecionar/estar em 'lan'
  const autoLanAttemptedRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (autoLanAttemptedRef.current) return;
      autoLanAttemptedRef.current = true;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
        const envUrl =
          (typeof process !== "undefined"
            ? (process.env?.EXPO_PUBLIC_WEB_API_URL || process.env?.EXPO_PUBLIC_API_URL)
            : "") || "";
        let initial = stored || envUrl || "";
        if (initial && isLocalHost(initial)) {
          initial = "";
        }
        if (initial) {
          setApiUrl(initial);
          const fromStored = Boolean(stored);
          setDbOption(
            initial.includes("railway.app")
              ? "railway"
              : fromStored
              ? "custom"
              : "lan"
          );
          setBaseStatus("testing");
          setBaseMessage("Testando base...");
          const res = await retryTestApi(initial, 8, 1500);
          if (res.ok) {
            setBaseStatus("ok");
            const dbTarget =
              res?.data?.dbTarget ||
              (initial.includes("railway") ? "railway" : "local");
            const host = new URL(initial).hostname;
            setActiveDbLabel(
              `API • ${host} | DB • ${String(dbTarget).toUpperCase()}`
            );
            setBaseMessage(
              `Sucesso: Conexão validada! API: ${host} • DB: ${String(
                dbTarget
              ).toUpperCase()}`
            );
            setShowDbModal(false);
          } else {
            setBaseStatus("error");
            setBaseMessage(`Falha ao conectar (status ${res.status || "N/A"})`);
            setDbOption("lan");
            setShowDbModal(true);
            try { await handleSelectLanAuto(); } catch {}
          }
        } else {
          // Nenhuma base válida em storage: abrir modal já com LAN pré-selecionado
          setDbOption("lan");
          setShowDbModal(true);
          try { await handleSelectLanAuto(); } catch {}
        }
      } catch {
        setDbOption("lan");
        setShowDbModal(true);
        try { await handleSelectLanAuto(); } catch {}
      }
    })();
  }, []);
  const [baseStatus, setBaseStatus] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [baseMessage, setBaseMessage] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [activeDbLabel, setActiveDbLabel] = useState("");

  // (removido bloco duplicado de inicialização para evitar conflito de estado)

  // Detecta automaticamente o IP/host da LAN do Metro e monta a URL da API
  const getLanBaseUrl = (): string => {
    const DEFAULT_PORT = 4000;
    try {
      const candidates: string[] = [];
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const host = String(window.location.hostname || "");
        const protocol = String(window.location.protocol || "");
        
        // Correção para Electron (Desktop)
        if (host === '-' || protocol === 'app:' || ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host)) {
           return `http://localhost:${DEFAULT_PORT}/api`;
        }
        
        if (host) {
          return `http://${host}:${DEFAULT_PORT}/api`;
        }
      }
      // Host do bundle JS (mais confiável)
      const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL;
      if (scriptUrl) {
        const parsed = new URL(String(scriptUrl));
        if (parsed.hostname) candidates.push(parsed.hostname);
      }
      // expoGo developer host, expoConfig.hostUri e manifest.debuggerHost como fallbacks
      const devHost = (Constants as any)?.expoGo?.developer?.host;
      if (devHost) candidates.push(String(devHost).split(":")[0]);
      const hostUri = (Constants as any)?.expoConfig?.hostUri;
      if (hostUri) candidates.push(String(hostUri).split(":")[0]);
      const dbgHost = (Constants as any)?.manifest?.debuggerHost;
      if (dbgHost) candidates.push(String(dbgHost).split(":")[0]);
      // REACT_NATIVE_PACKAGER_HOSTNAME como último fallback
      const envPackagerHost =
        (typeof process !== "undefined"
          ? (process as any)?.env?.REACT_NATIVE_PACKAGER_HOSTNAME
          : "") || "";
      if (envPackagerHost) candidates.push(envPackagerHost);

      for (const h of candidates) {
        const host = String(h);
        if (!host) continue;
        if (Platform.OS === "web") {
          const hostOut = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host) ? "localhost" : host;
          return `http://${hostOut}:${DEFAULT_PORT}/api`;
        } else {
          if (!["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host)) {
            return `http://${host}:${DEFAULT_PORT}/api`;
          }
        }
      }
    } catch {}
    return "";
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setInterval(async () => {
      if (baseStatus === "ok") return;
      try {
        const base = getLanBaseUrl();
        try {
          if (base) {
            await startLocalApi('local', base);
          }
        } catch {}
        if (!base) return;
        const res = await retryTestApi(base, 2, 800);
        if (res.ok) {
          setApiUrl(base);
          setBaseStatus("ok");
          const host = new URL(base).hostname;
          const dbTarget = String(res?.data?.dbTarget || "local").toUpperCase();
          setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
          setBaseMessage(`Sucesso: API • ${host} | DB • ${dbTarget}`);
          setShowDbModal(false);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [baseStatus]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const base = getLanBaseUrl();
        if (!base) return;
        for (let i = 0; i < 3; i++) {
          try { await startLocalApi('local', base); } catch {}
          const res = await retryTestApi(base, 1, 900);
          if (res.ok) {
            setApiUrl(base);
            setBaseStatus("ok");
            const host = new URL(base).hostname;
            const dbTarget = String(res?.data?.dbTarget || "local").toUpperCase();
            setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
            setBaseMessage(`Sucesso: API • ${host} | DB • ${dbTarget}`);
            setShowDbModal(false);
            break;
          }
          await new Promise((r) => setTimeout(r, 900));
        }
      } catch {}
    })();
  }, []);

  // URL da API para ambiente Railway a partir do .env (EXPO_PUBLIC_API_URL_RAILWAY) ou heurística
  const getRailwayApiUrl = (): string => {
    try {
      const envRail =
        typeof process !== "undefined"
          ? (process as any)?.env?.EXPO_PUBLIC_API_URL_RAILWAY
          : "";
      if (envRail && !isLocalHost(envRail)) return envRail;
      const envUrl =
        typeof process !== "undefined"
          ? (process as any)?.env?.EXPO_PUBLIC_API_URL
          : "";
      // Se o ENV padrão já aponta para um domínio público (loca.lt/railway), reutilize
      if (
        envUrl &&
        /loca\.lt|railway\.app|rlwy\.net/i.test(envUrl) &&
        !isLocalHost(envUrl)
      )
        return envUrl;
    } catch {}
    return "";
  };

  const handleSelectLanAuto = async () => {
    try {
      setDbOption("lan");
      setSaveLoading(true);
      setBaseStatus("testing");
      setBaseMessage("Detectando IP da LAN e preparando base LOCAL...");

      // Sempre usar detecção do host do bundle (LAN); não depender de ENV/storage
      const autoUrl = getLanBaseUrl();
      if (!autoUrl || isLocalHost(autoUrl)) {
        Alert.alert(
          "Erro",
          "Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente."
        );
        setBaseStatus("error");
        setBaseMessage("Falha ao detectar IP da LAN.");
        return;
      }

      // Persistir URL da API local
      setApiUrl(autoUrl);
      await setApiBaseUrl(autoUrl);

      try {
        await startLocalApi('local', autoUrl);
        await new Promise((r) => setTimeout(r, 600));
      } catch {}

      // Alternar explicitamente o servidor para DB_TARGET=local antes de validar
      setBaseMessage("Alternando servidor para DB • LOCAL...");
      const switched = await switchServerDbTarget(autoUrl, "local");
      if (!switched.ok) {
        setBaseStatus("error");
        const reason = String(
          switched.reason || "Falha ao alternar DB para LOCAL"
        );
        setBaseMessage(reason);
        Alert.alert("Erro", reason);
        return;
      }

      // Validar saúde com tentativas/backoff
      const res = await retryTestApi(autoUrl, 8, 1000);
      const apiHost = new URL(autoUrl).hostname;
      if (res.ok) {
        const detectedDbTarget = String(
          res?.data?.dbTarget || "local"
        ).toUpperCase();
        setBaseStatus("ok");
        setActiveDbLabel(`API • ${apiHost} | DB • ${detectedDbTarget}`);
        setBaseMessage(`Sucesso: API • ${apiHost} | DB • ${detectedDbTarget}`);
        Alert.alert("Sucesso", "Conexão local validada e DB • LOCAL ativo!");
        setShowDbModal(false);
      } else {
        setBaseStatus("error");
        setBaseMessage(`Falha ao conectar (status ${res.status || "N/A"})`);
        Alert.alert(
          "Erro",
          `Falha ao conectar (status ${res.status || "N/A"})`
        );
      }
    } catch (e) {
      setBaseStatus("error");
      setBaseMessage("Erro inesperado ao conectar via LAN.");
      Alert.alert("Erro", "Erro inesperado ao conectar via LAN.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleQuickSelect = async (option: "lan" | "railway" | "custom") => {
    try {
      if (option === "lan") {
        setDbOption("lan");
        await handleSelectLanAuto();
        // Após validar a conexão LAN, alternar explicitamente o DB_TARGET para local e validar
        try {
          const base = apiUrl || getLanBaseUrl();
          if (!base || isLocalHost(base)) {
            Alert.alert(
              "Erro",
              "Falha ao detectar IP da LAN para alternar a base."
            );
            return;
          }
          setBaseStatus("testing");
          setBaseMessage("Alternando servidor para DB • LOCAL...");
          const sw = await switchServerDbTarget(base, "local");
          if (sw.ok) {
            // Validar estado após alternar
            const res = await testApiConnection(base, undefined);
            const apiHost = new URL(base).hostname;
            const detectedDbTarget = String(
              res?.data?.dbTarget || "local"
            ).toUpperCase();
            setActiveDbLabel(`API • ${apiHost} | DB • ${detectedDbTarget}`);
            setBaseStatus(res.ok ? "ok" : "error");
            setBaseMessage(
              res.ok
                ? `Sucesso: API • ${apiHost} | DB • ${detectedDbTarget}`
                : `Falha ao validar após alternar (status ${
                    res.status || "N/A"
                  })`
            );
            if (res.ok)
              Alert.alert(
                "Sucesso",
                "Base local (LAN) selecionada e validada no servidor."
              );
          } else {
            setBaseStatus("error");
            Alert.alert(
              "Erro",
              `Falha ao alternar para base local: ${String(sw.reason || "")}`
            );
          }
        } catch (e) {
          setBaseStatus("error");
          Alert.alert("Erro", "Erro ao alternar para base local.");
        }
        return;
      }
      if (option === "railway") {
        setDbOption("railway");
        // Usar API LOCAL (IP da LAN) e alternar DB_TARGET para 'railway'
        const envUrl =
          typeof process !== "undefined"
            ? ((process as any)?.env?.EXPO_PUBLIC_WEB_API_URL || (process as any)?.env?.EXPO_PUBLIC_API_URL)
            : "";
        let targetBase = envUrl;
        if (!targetBase || isLocalHost(targetBase)) {
          const detected = getLanBaseUrl();
          targetBase = detected;
        }
        if (!targetBase || isLocalHost(targetBase)) {
          Alert.alert(
            "Erro",
            "Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente."
          );
          return;
        }
        setApiUrl(targetBase);
        setSaveLoading(true);
        setBaseStatus("testing");
        setBaseMessage(
          "Selecionando DB Railway na API local, salvando e testando..."
        );
        const saved = await setApiBaseUrl(targetBase);
        if (!saved) {
          setSaveLoading(false);
          setBaseStatus("error");
          Alert.alert("Erro", "Falha ao salvar URL da API local.");
          return;
        }
        const sw = await switchServerDbTarget(targetBase, "railway");
        if (sw.ok) {
          // Validar estado após alternar
          const res = await testApiConnection(targetBase, undefined);
          const apiHost = new URL(targetBase).hostname;
          const detectedDbTarget = String(
            res?.data?.dbTarget || "railway"
          ).toUpperCase();
          setActiveDbLabel(`API • ${apiHost} | DB • ${detectedDbTarget}`);
          setBaseStatus(res.ok ? "ok" : "error");
          setBaseMessage(
            res.ok
              ? `Sucesso: Conexão validada! API: ${apiHost} • DB: ${detectedDbTarget}`
              : `Falha ao validar após alternar (status ${res.status || "N/A"})`
          );
          if (res.ok) {
            Alert.alert(
              "Sucesso",
              "Base Railway selecionada e conexão validada!"
            );
            setShowDbModal(false);
          }
        } else {
          setBaseStatus("error");
          Alert.alert(
            "Erro",
            `Falha ao alternar para Railway: ${String(sw.reason || "")}`
          );
        }
        setSaveLoading(false);
        return;
      }
      if (option === "custom") {
        setDbOption("custom");
        setShowDbModal(true);
        return;
      }
    } catch (e) {
      setBaseStatus("error");
      Alert.alert("Erro", "Erro inesperado ao selecionar base.");
    }
  };

  const handleSaveAndTest = async () => {
    try {
      if (!dbOption) {
        Alert.alert(
          "Seleção obrigatória",
          "Escolha uma opção de base antes de salvar: Local (LAN), API Pública ou URL Personalizada."
        );
        return;
      }

      setSaveLoading(true);
      setBaseStatus("testing");
      setBaseMessage("Salvando URL e testando conexão...");

      let targetUrl = apiUrl?.trim();
      if (dbOption === "lan") {
        const envUrl =
          typeof process !== "undefined"
            ? ((process as any)?.env?.EXPO_PUBLIC_WEB_API_URL || (process as any)?.env?.EXPO_PUBLIC_API_URL)
            : "";
        let autoUrl = envUrl;
        if (!autoUrl || isLocalHost(autoUrl)) {
          const detected = getLanBaseUrl();
          if (!detected || isLocalHost(detected)) {
            Alert.alert(
              "Erro",
              "Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente."
            );
            return;
          }
          autoUrl = detected;
        }
        targetUrl = autoUrl;
        setApiUrl(autoUrl);
      } else if (dbOption === "railway") {
        // Railway usa a MESMA API LOCAL, apenas alterna o DB_TARGET no servidor
        const envUrl =
          typeof process !== "undefined"
            ? (process as any)?.env?.EXPO_PUBLIC_API_URL
            : "";
        let autoUrl = envUrl;
        if (!autoUrl || isLocalHost(autoUrl)) {
          const detected = getLanBaseUrl();
          if (!detected || isLocalHost(detected)) {
            Alert.alert(
              "Erro",
              "Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente."
            );
            return;
          }
          autoUrl = detected;
        }
        targetUrl = autoUrl;
        setApiUrl(autoUrl);
      } else {
        if (!targetUrl) {
          const placeholder = "http://192.168.x.x:4000/api";
          Alert.alert("Erro", `Informe a URL da API (${placeholder}).`);
          return;
        }
      }

      try {
        const u = new URL(String(targetUrl));
        if (!/\/(api)\/?$/.test(u.pathname)) {
          targetUrl = `${u.origin}${u.pathname.replace(/\/$/, "")}/api`;
        }
      } catch {}

      if (isLocalHost(targetUrl)) {
        Alert.alert(
          "Erro",
          "Não use localhost/127.0.0.1 no mobile com Expo Go. Use IP da rede local ou URL pública."
        );
        return;
      }

      // Salvar base selecionada
      await setApiBaseUrl(targetUrl!);

      // Alternar DB_TARGET conforme opção escolhida e validar saúde da API
      if (dbOption === "railway") {
        const sw = await switchServerDbTarget(targetUrl!, "railway");
        if (!sw.ok) {
          setBaseStatus("error");
          const reason = String(sw.reason || "Falha ao alternar para Railway");
          setBaseMessage(reason);
          Alert.alert("Erro", reason);
          setSaveLoading(false);
          return;
        }
      } else if (dbOption === "lan") {
        const swLocal = await switchServerDbTarget(targetUrl!, "local");
        if (!swLocal.ok) {
          setBaseStatus("error");
          const reason = String(
            swLocal.reason || "Falha ao alternar para base local"
          );
          setBaseMessage(reason);
          Alert.alert("Erro", reason);
          setSaveLoading(false);
          return;
        }
      }

      const result = await retryTestApi(targetUrl!, 8, 1500);

      if (result.ok) {
        setBaseStatus("ok");
        const host = new URL(targetUrl!).hostname;
        const dbTargetRaw =
          (result as any)?.data?.dbTarget ||
          (dbOption === "railway" ? "railway" : "local");
        const dbTarget = String(dbTargetRaw).toUpperCase();
        setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
        setApiUrl(targetUrl!);
        setBaseMessage(
          `Sucesso: Conexão validada! API: ${host} • DB: ${dbTarget}`
        );
        Alert.alert("Sucesso", "Base salva e conexão validada!");
        setShowDbModal(false);
      } else {
        setBaseStatus("error");
        const msg = `Falha ao conectar (status ${
          result.status || "N/A"
        }). ${String(result.reason || "")}`;
        setBaseMessage(msg);
        Alert.alert("Erro", msg);
      }
    } catch (err: any) {
      setBaseStatus("error");
      setBaseMessage("Erro inesperado ao salvar/testar a base.");
      Alert.alert("Erro", "Erro inesperado ao salvar/testar a base.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogin = async () => {
    // Bloquear login até que a base seja validada
    if (baseStatus !== "ok") {
      Alert.alert(
        "Seleção obrigatória",
        "Antes de entrar, selecione a base da API, salve e teste a conexão."
      );
      return;
    }
    console.log("🚀 handleLogin chamado com:", { email, password: "***" });

    if (!email.trim() || !password.trim()) {
      Alert.alert("Erro", "Por favor, preencha todos os campos");
      return;
    }

    try {
      setLoginLoading(true);
      console.log("🚀 Chamando função login do contexto...");
      const result = await login({ email, password });
      console.log("🚀 Resultado do login:", result);

      if (result.success) {
        console.log("🚀 Login bem-sucedido, redirecionando...");
        router.replace("/(tabs)");
      } else {
        console.log("🚀 Login falhou:", result.message);
        
        // Exibe mensagem de erro customizada
        setErrorMessage("Usuario ou Senha errado, tente novamente");
        setShowError(true);
        
        // Foca novamente no email para facilitar correcao
        if (emailRef.current) {
            emailRef.current.focus();
        }
      }
    } catch (error: any) {
      console.error("🚀 Erro inesperado no login:", error);
      setErrorMessage("Erro inesperado ao fazer login");
      setShowError(true);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <BackgroundGradient style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.centerContent}>
          
          {/* Top Switcher (Posicionado no Canto mas discreto) */}
          <View style={styles.topRightSwitcher}>
            <TouchableOpacity
              style={styles.connectionBadge}
              onPress={() => setShowDbModal(true)}
            >
              <View style={[styles.connectionDot, { backgroundColor: baseStatus === 'ok' ? '#4CAF50' : '#FF9800' }]} />
              <Text style={styles.connectionText}>
                {activeDbLabel ? 'Conectado' : "Conexão"}
              </Text>
              <SafeIcon name="chevron-down" size={14} color="#666" fallbackText="▼" />
            </TouchableOpacity>
          </View>

          {/* Card Principal de Login */}
          <View style={styles.loginCard}>
            
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                <SafeIcon
                  name="restaurant"
                  size={42}
                  color="#2196F3"
                  fallbackText="🍽"
                />
              </View>
              <Text style={styles.title}>BarApp</Text>
              <Text style={styles.subtitle}>Gestão Inteligente</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.modernInputContainer}>
                  <SafeIcon name="mail" size={20} color="#909090" fallbackText="@" style={styles.inputIcon} />
                  <TextInput
                    ref={emailRef}
                    style={styles.modernInput}
                    placeholder="ex: admin@admin.com"
                    placeholderTextColor="#A0A0A0"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Senha</Text>
                <View style={styles.modernInputContainer}>
                  <SafeIcon name="lock-closed" size={20} color="#909090" fallbackText="🔒" style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.modernInput}
                    placeholder="Digite sua senha"
                    placeholderTextColor="#A0A0A0"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <SafeIcon
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#909090"
                      fallbackText={showPassword ? "🙈" : "👁"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {showError && (
                <View style={styles.errorBanner}>
                  <SafeIcon name="alert-circle" size={16} color="#D32F2F" fallbackText="!" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.ctaButton,
                  (loginLoading || baseStatus !== "ok") && styles.ctaButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loginLoading || baseStatus !== "ok"}
                activeOpacity={0.8}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaButtonText}>Acessar Sistema</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugLink}
                onPress={async () => {
                   Alert.alert(
                    "Confirmação", 
                    "Deseja limpar todos os dados em cache?", 
                    [
                        { text: "Cancelar", style: "cancel" },
                        { 
                            text: "Limpar", 
                            onPress: async () => {
                                await clearAllStorage();
                                Alert.alert("Sucesso", "Cache limpo!");
                            } 
                        }
                    ]
                   )
                }}
              >
                <Text style={styles.debugLinkText}>Problemas com login? Limpar cache</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.footerVersion}>Versão 2.1.0 • BarApp Inc.</Text>

        </View>

        {/* Modal de seleção de base de dados - Estilo Mantido mas limpo */}
        <Modal
          visible={showDbModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDbModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configuração de Conexão</Text>
                <TouchableOpacity onPress={() => setShowDbModal(false)}>
                  <SafeIcon name="close" size={24} color="#666" fallbackText="X" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Selecione onde o servidor da API está sendo executado.
              </Text>

              <View style={styles.selectorRow}>
                <TouchableOpacity
                  style={[styles.selOption, dbOption === "lan" && styles.selOptionActive]}
                  onPress={() => handleQuickSelect("lan")}
                >
                  <SafeIcon name="wifi" size={24} color={dbOption === "lan" ? "#fff" : "#666"} fallbackText="Lan" />
                  <Text style={[styles.selText, dbOption === "lan" && styles.selTextActive]}>Local (LAN)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.selOption, dbOption === "railway" && styles.selOptionActive]}
                  onPress={() => handleQuickSelect("railway")}
                >
                   <SafeIcon name="cloud" size={24} color={dbOption === "railway" ? "#fff" : "#666"} fallbackText="Cloud" />
                   <Text style={[styles.selText, dbOption === "railway" && styles.selTextActive]}>Nuvem</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.selOption, dbOption === "custom" && styles.selOptionActive]}
                  onPress={() => handleQuickSelect("custom")}
                >
                   <SafeIcon name="code-slash" size={24} color={dbOption === "custom" ? "#fff" : "#666"} fallbackText="Custom" />
                   <Text style={[styles.selText, dbOption === "custom" && styles.selTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>

              {(dbOption === "railway" || dbOption === "custom") && (
                <View style={styles.modalInputBox}>
                  <Text style={styles.modalLabel}>URL da API</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="http://..."
                    value={apiUrl}
                    onChangeText={setApiUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSec]}
                  onPress={handleSelectLanAuto}
                  disabled={saveLoading}
                >
                   {saveLoading ? <ActivityIndicator color="#0B67C2" /> : <Text style={styles.actionBtnSecText}>Auto Detectar</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPri]}
                  onPress={handleSaveAndTest}
                  disabled={saveLoading}
                >
                  {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnPriText}>Salvar e Conectar</Text>}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalStatus}>{baseMessage}</Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </BackgroundGradient>
  );
}

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  topRightSwitcher: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    zIndex: 10,
  },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: "#444",
    fontWeight: "600",
    marginRight: 4,
  },
  loginCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    alignItems: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1565C0",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  formSection: {
    width: "100%",
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  modernInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputIcon: {
    marginRight: 12,
  },
  modernInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    height: "100%",
  },
  eyeBtn: {
    padding: 8,
  },
  ctaButton: {
    backgroundColor: "#2196F3",
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    elevation: 4,
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaButtonDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  debugLink: {
    marginTop: 24,
    alignItems: "center",
  },
  debugLinkText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  footerVersion: {
    marginTop: 32,
    color: "#CBD5E1",
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  modalDesc: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
  },
  selectorRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  selOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selOptionActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  selText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    color: '#64748B',
  },
  selTextActive: {
    color: '#fff',
  },
  modalInputBox: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPri: {
    backgroundColor: '#2196F3',
  },
  actionBtnPriText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionBtnSec: {
    backgroundColor: '#E3F2FD',
  },
  actionBtnSecText: {
    color: '#0B67C2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalStatus: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});

// Helper: testar /health com tentativas e backoff
async function retryTestApi(baseUrl: string, attempts = 6, intervalMs = 2000) {
  let last = { ok: false, status: 0, reason: "" } as any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await testApiConnection(baseUrl, undefined);
      if (res?.ok) return res;
      last = res || last;
    } catch (e: any) {
      last = {
        ok: false,
        status: 0,
        reason: e?.message || "Erro ao testar API",
      };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

// Helper para identificar hosts locais inválidos para mobile (localhost/127.0.0.1/::1/0.0.0.0)
const isLocalHost = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(String(url));
    const host = u.hostname;
    if (Platform.OS === "web" || Platform.OS === "windows" || Platform.OS === "macos") return false;
    return (
      host === "localhost" ||
      host.startsWith("127.") ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    if (Platform.OS === "web" || Platform.OS === "windows" || Platform.OS === "macos") return false;
    const s = String(url).toLowerCase();
    const withoutProto = s.includes("://") ? s.split("://")[1] : s;
    const hostOnly = withoutProto.split("/")[0].split(":")[0];
    return (
      hostOnly === "localhost" ||
      hostOnly.startsWith("127.") ||
      hostOnly === "::1" ||
      hostOnly === "0.0.0.0"
    );
  }
};
