import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
} from 'react-native';

// QRCode SVG só funciona em native; na web usamos canvas via a lib 'qrcode'
let QRCodeCanvas: any = null;
if (Platform.OS !== 'web') {
  try {
    QRCodeCanvas = require('react-native-qrcode-svg').default;
  } catch {}
}

/**
 * Componente QR Code para acesso mobile via navegador.
 * Exibido APENAS na versão web (desktop).
 * Gera um QR Code com a URL do sistema para o operador escanear com o celular.
 */
export default function QrCodeAcessoMobile() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Só renderiza na web
  if (Platform.OS !== 'web') return null;

  // Detecta o IP da LAN para gerar o QR Code (nunca usa localhost)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    const { protocol, hostname, port } = window.location;
    const webPort = port || '8082';

    // Se já está acessando via IP da LAN, usa direto
    if (!LOCAL_HOSTS.includes(hostname)) {
      setUrl(`${protocol}//${hostname}:${webPort}`);
      return;
    }

    // Tentar extrair IP da LAN das variáveis de ambiente do Expo
    const tryExtractLanIp = (): string | null => {
      try {
        const apiUrl = (typeof process !== 'undefined')
          ? (process.env?.EXPO_PUBLIC_API_URL || '')
          : '';
        if (apiUrl) {
          const parsed = new URL(apiUrl);
          if (!LOCAL_HOSTS.includes(parsed.hostname)) {
            return parsed.hostname;
          }
        }
      } catch {}
      try {
        const packagerHost = (typeof process !== 'undefined')
          ? (process.env?.REACT_NATIVE_PACKAGER_HOSTNAME || '')
          : '';
        if (packagerHost && !LOCAL_HOSTS.includes(packagerHost)) {
          return packagerHost;
        }
      } catch {}
      return null;
    };

    const lanIp = tryExtractLanIp();
    if (lanIp) {
      setUrl(`http://${lanIp}:${webPort}`);
      return;
    }

    // Fallback: tentar buscar IP via API de saúde (a API roda na mesma máquina)
    (async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/health`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        // O servidor pode retornar info de rede, se não, usar heurística
        if (data?.lanIp && !LOCAL_HOSTS.includes(data.lanIp)) {
          setUrl(`http://${data.lanIp}:${webPort}`);
          return;
        }
      } catch {}

      // Último recurso: usar WebRTC para detectar IP local
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
              setUrl(`http://${match[1]}:${webPort}`);
              pc.close();
              resolve();
            }
          };
          setTimeout(() => { pc.close(); resolve(); }, 3000);
        });
      } catch {}

      // Se nada funcionou, mostrar localhost mesmo com aviso
      if (!url) {
        setUrl(`http://${hostname}:${webPort}`);
      }
    })();
  }, []);

  // Gera QR Code como data URL usando canvas na web
  useEffect(() => {
    if (!url || Platform.OS !== 'web') return;
    (async () => {
      try {
        // Importar qrcode dinamicamente (dependência de react-native-qrcode-svg)
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(url, {
          width: 220,
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
  }, [url]);

  const handleOpen = useCallback(() => {
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }, [url]);

  return (
    <>
      {/* Botão flutuante no canto inferior esquerdo */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpen}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>📱</Text>
        <Text style={styles.fabText}>Acesso Celular</Text>
      </TouchableOpacity>

      {/* Modal com QR Code */}
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
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
              Escaneie o QR Code abaixo com a câmera do celular para abrir o sistema no navegador.
              Não precisa instalar nenhum aplicativo!
            </Text>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code de acesso"
                  style={{ width: 220, height: 220, borderRadius: 8 }}
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>Gerando QR Code...</Text>
                </View>
              )}
            </View>

            {/* URL */}
            <View style={styles.urlBox}>
              <Text style={styles.urlLabel}>URL de acesso:</Text>
              <Text style={styles.urlText} selectable>{url}</Text>
            </View>

            {/* Botão Copiar */}
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                {copied ? '✓ Copiado!' : '📋 Copiar URL'}
              </Text>
            </TouchableOpacity>

            {/* Dica PWA */}
            <View style={styles.tipBox}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>
                Dica: No celular, toque em "Adicionar à tela inicial" no navegador para usar como um app!
              </Text>
            </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 420,
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
  },
  instructions: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  qrPlaceholderText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  urlBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  urlLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  urlText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  copyBtn: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  copyBtnSuccess: {
    backgroundColor: '#E8F5E9',
  },
  copyBtnText: {
    color: '#1565C0',
    fontSize: 14,
    fontWeight: '700',
  },
  copyBtnTextSuccess: {
    color: '#2E7D32',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  tipText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
});
