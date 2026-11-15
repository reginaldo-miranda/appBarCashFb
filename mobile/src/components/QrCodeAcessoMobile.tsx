import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { events } from '../utils/eventBus';
import api from '../services/api';

/**
 * Componente QR Code para acesso mobile via navegador.
 * Exibido APENAS na versão web (desktop).
 * Gera um QR Code com a URL do sistema (/login) para o funcionário escanear com o celular.
 * Suporta alternância entre Wi-Fi Local e Túnel Cloudflare (4G/remoto).
 */
export default function QrCodeAcessoMobile({ hideButton = false }: { hideButton?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Estados do Túnel Cloudflare
  const [tunnelActive, setTunnelActive] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Estados de Rede Local
  const [lanIp, setLanIp] = useState('');
  const [webPort, setWebPort] = useState('4000');

  // Só renderiza na web
  if (Platform.OS !== 'web') return null;

  // Detecta o IP da LAN para gerar o QR Code local
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    const { hostname, port } = window.location;
    const currentPort = port || '4000';
    setWebPort(currentPort);

    // Se já está acessando via IP da LAN, usa direto
    if (!LOCAL_HOSTS.includes(hostname)) {
      setLanIp(hostname);
      return;
    }

    // Fluxo assíncrono para obter IP dinâmico da máquina host
    (async () => {
      const isVirtualIp = (ip: string) => {
        if (!ip) return true;
        if (LOCAL_HOSTS.includes(ip)) return true;
        if (ip.startsWith('169.254.')) return true;
        if (ip.startsWith('172.')) return true;
        return false;
      };

      const tryExtractLanIp = (): string | null => {
        try {
          const apiUrl = (typeof process !== 'undefined')
            ? (process.env?.EXPO_PUBLIC_API_URL || '')
            : '';
          if (apiUrl) {
            const parsed = new URL(apiUrl);
            if (!isVirtualIp(parsed.hostname)) {
              return parsed.hostname;
            }
          }
        } catch {}
        try {
          const packagerHost = (typeof process !== 'undefined')
            ? (process.env?.REACT_NATIVE_PACKAGER_HOSTNAME || '')
            : '';
          if (packagerHost && !isVirtualIp(packagerHost)) {
            return packagerHost;
          }
        } catch {}
        return null;
      };

      // 1. Tentar buscar IP via API de saúde (/health)
      try {
        const res = await api.get('/health', { timeout: 3000 });
        if (res?.data?.lanIp && !isVirtualIp(res.data.lanIp)) {
          setLanIp(res.data.lanIp);
          return;
        }
      } catch (e) {
        console.log('Erro ao consultar /health no acesso mobile:', e);
      }

      // 2. Extrair das variáveis de ambiente/Metro
      const extractedLan = tryExtractLanIp();
      if (extractedLan) {
        setLanIp(extractedLan);
        return;
      }

      // 3. Fallback: usar WebRTC para detectar IP local
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          pc.onicecandidate = (e) => {
            if (!e.candidate) { resolve(); return; }
            const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (match && !LOCAL_HOSTS.includes(match[1]) && !match[1].startsWith('0.')) {
              setLanIp(match[1]);
              pc.close();
              resolve();
            }
          };
          setTimeout(() => { pc.close(); resolve(); }, 3000);
        });
      } catch {}

      // 4. Último recurso: usar hostname atual
      setLanIp(hostname);
    })();
  }, []);

  // Determinar a URL final de acesso (Túnel vs Wi-Fi Local)
  const isUsingTunnel = Boolean(tunnelActive && tunnelUrl);
  const cleanTunnel = isUsingTunnel ? String(tunnelUrl).replace(/\/$/, '') : '';
  const hostClean = lanIp || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const activeUrl = isUsingTunnel
    ? `${cleanTunnel}/login`
    : `http://${hostClean}:${webPort}/login`;

  // Gera QR Code como data URL usando canvas na web
  useEffect(() => {
    if (!activeUrl || Platform.OS !== 'web') return;
    (async () => {
      try {
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(activeUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1E293B',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        setQrDataUrl(dataUrl);
      } catch (e) {
        console.warn('Erro ao gerar QR Code:', e);
      }
    })();
  }, [activeUrl]);

  // Abre modal e atualiza status do túnel
  const handleOpen = useCallback(async () => {
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    try {
      const res = await api.get('/config/tunnel/status');
      if (res?.data) {
        setTunnelActive(Boolean(res.data.active && res.data.url));
        setTunnelUrl(res.data.url || null);
      }
    } catch (e) {
      console.warn('Erro ao verificar status do túnel:', e);
    }
  }, [fadeAnim]);

  // Alterna ligar/desligar túnel Cloudflare
  const handleToggleTunnel = async () => {
    if (tunnelLoading) return;
    setTunnelLoading(true);
    try {
      if (tunnelActive) {
        await api.post('/config/tunnel/stop');
        setTunnelActive(false);
        setTunnelUrl(null);
      } else {
        const res = await api.post('/config/tunnel/start');
        if (res?.data?.active && res?.data?.url) {
          setTunnelActive(true);
          setTunnelUrl(res.data.url);
        } else {
          if (typeof window !== 'undefined') {
            window.alert(res?.data?.error || 'Não foi possível iniciar o túnel externo.');
          }
        }
      }
    } catch (e: any) {
      if (typeof window !== 'undefined') {
        window.alert('Falha ao alternar o túnel: ' + (e?.message || ''));
      }
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [fadeAnim]);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(activeUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }, [activeUrl]);

  // Escuta o evento global para abrir o modal a partir do menu superior
  useEffect(() => {
    const off = events.on('qrcode:open', () => {
      handleOpen();
    });
    return () => off();
  }, [handleOpen]);

  return (
    <>
      {/* Botão flutuante no canto inferior esquerdo - ocultado se hideButton for true */}
      {!hideButton && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpen}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>📱</Text>
          <Text style={styles.fabText}>Acesso Celular</Text>
        </TouchableOpacity>
      )}

      {/* Modal com QR Code */}
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <ScrollView
              contentContainerStyle={{ alignItems: 'center', width: '100%' }}
              showsVerticalScrollIndicator={false}
              style={{ width: '100%' }}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerIcon}>📱</Text>
                  <Text style={styles.headerTitle}>Acesso via Celular</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Instruções */}
              <Text style={styles.instructions}>
                Escaneie o QR Code com a câmera do celular para abrir a tela de Login do sistema no navegador.
              </Text>

              {/* Controle Ligar / Desligar Túnel */}
              <View style={[
                styles.tunnelBox,
                isUsingTunnel ? styles.tunnelBoxActive : styles.tunnelBoxInactive
              ]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[
                    styles.tunnelTitle,
                    { color: isUsingTunnel ? '#2E7D32' : '#1E293B' }
                  ]} numberOfLines={1}>
                    {isUsingTunnel ? '🟢 Túnel 4G Ligado' : '⚪ Só Wi-Fi Local'}
                  </Text>
                  <Text style={[
                    styles.tunnelSubtitle,
                    { color: isUsingTunnel ? '#388E3C' : '#64748B' }
                  ]}>
                    {isUsingTunnel
                      ? 'Acesso liberado de qualquer local (Wi-Fi ou 4G)'
                      : 'Ligue p/ abrir no 4G de qualquer lugar'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleToggleTunnel}
                  disabled={tunnelLoading}
                  style={[
                    styles.tunnelBtn,
                    { backgroundColor: isUsingTunnel ? '#D32F2F' : '#2196F3' }
                  ]}
                  activeOpacity={0.8}
                >
                  {tunnelLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.tunnelBtnText}>
                      {isUsingTunnel ? 'Desligar' : 'Ligar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* QR Code */}
              <View style={styles.qrContainer}>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code de acesso"
                    style={{ width: 190, height: 190, borderRadius: 8 }}
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.qrPlaceholderText}>Gerando QR Code...</Text>
                  </View>
                )}
              </View>

              {/* URL */}
              <View style={styles.urlBox}>
                <Text style={styles.urlLabel}>
                  Link de Acesso ({isUsingTunnel ? 'Túnel 4G' : 'Wi-Fi Local'}):
                </Text>
                <Text style={styles.urlText} selectable>{activeUrl}</Text>
              </View>

              {/* Botão Copiar */}
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                  {copied ? '✓ Copiado com Sucesso!' : '📋 Copiar Link de Acesso'}
                </Text>
              </TouchableOpacity>

              {/* Dica PWA */}
              <View style={styles.tipBox}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={styles.tipText}>
                  Dica: No celular, o funcionário faz login com seu usuário ou PIN e tem acesso conforme seu perfil.
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    zIndex: 100,
  },
  fabIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '700',
  },
  instructions: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  tunnelBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tunnelBoxActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
  },
  tunnelBoxInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  tunnelTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  tunnelSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  tunnelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  tunnelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  qrPlaceholder: {
    width: 190,
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  qrPlaceholderText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  urlBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  urlLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  urlText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  copyBtn: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  copyBtnSuccess: {
    backgroundColor: '#E8F5E9',
  },
  copyBtnText: {
    color: '#1565C0',
    fontSize: 13,
    fontWeight: '700',
  },
  copyBtnTextSuccess: {
    color: '#2E7D32',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipIcon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1,
  },
  tipText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
});
