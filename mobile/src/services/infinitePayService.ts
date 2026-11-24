import { Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const INFINITEPAY_STORAGE_KEY = '@appbarcash:use_infinitepay';
export const INFINITEPAY_HANDLE_KEY = '@appbarcash:infinitepay_handle';
export const INFINITEPAY_PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=com.cloudwalk.infinitepay';
export const INFINITEPAY_APPSTORE_URL = 'https://apps.apple.com/br/app/infinitepay/id1455589134';

export interface InfinitePayPaymentParams {
  amount: number; // Em Reais (ex: 25.50)
  method: 'credit' | 'debit';
  orderId: string;
  returnScheme?: string;
}

export interface InfinitePayReturnData {
  success: boolean;
  orderId?: string;
  transactionNsu?: string;
  authCode?: string;
  cardBrand?: string;
  amount?: number;
  rawUrl?: string;
  message?: string;
}

/**
 * Detecta se o dispositivo atual é um iPhone, iPad ou Safari no iOS
 */
export function isAppleDevice(): boolean {
  if (Platform.OS === 'ios') return true;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // Detecção de iPad rodando iPadOS (que finge ser Mac)
    if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
      return true;
    }
  }
  return false;
}

/**
 * Consulta se o uso da InfinitePay está habilitado neste dispositivo
 */
export async function getInfinitePayEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(INFINITEPAY_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Salva a preferência de ativação da InfinitePay
 */
export async function setInfinitePayEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(INFINITEPAY_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Erro ao salvar preferência InfinitePay:', e);
  }
}

/**
 * Obtém o identificador/usuário da InfinitePay cadastrado (ex: @meuestabelecimento)
 */
export async function getInfinitePayHandle(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(INFINITEPAY_HANDLE_KEY)) || '';
  } catch {
    return '';
  }
}

/**
 * Salva o identificador/usuário da InfinitePay
 */
export async function setInfinitePayHandle(handle: string): Promise<void> {
  try {
    await AsyncStorage.setItem(INFINITEPAY_HANDLE_KEY, handle.trim());
  } catch (e) {
    console.error('Erro ao salvar handle InfinitePay:', e);
  }
}

/**
 * Aciona a cobrança no celular.
 * No Android: Aciona o app InfinitePay via Deep Link (InfiniteTap por aproximação).
 * No iPhone: Aciona a URL segura HTTPS oficial da InfinitePay (evita erro do Safari e suporta Apple Pay).
 */
export async function openInfinitePayTap({
  amount,
  method,
  orderId,
  returnScheme = 'mobile://infinitepay-callback',
}: InfinitePayPaymentParams): Promise<{ launched: boolean; reason?: string }> {
  const amountInCents = Math.round(amount * 100);

  if (amountInCents <= 0) {
    return { launched: false, reason: 'Valor de cobrança inválido.' };
  }

  const isApple = isAppleDevice();

  // ─── FLUXO IPHONE / SAFARI (iOS) ───
  if (isApple) {
    const rawHandle = await getInfinitePayHandle();
    const cleanHandle = rawHandle.replace('@', '').trim();

    if (cleanHandle) {
      // Monta o Link Oficial HTTPS da InfinitePay com valor pré-preenchido
      // O Safari abre com 100% de sucesso sem nenhum erro de URL inválida!
      const webPaymentUrl = `https://infinitepay.io/${cleanHandle}?amount=${amountInCents}&order_id=${encodeURIComponent(orderId)}`;
      try {
        await Linking.openURL(webPaymentUrl);
        return { launched: true };
      } catch (err: any) {
        console.error('Erro ao abrir link web InfinitePay no iPhone:', err);
      }
    }

    // Se não tiver handle configurado ou se preferir link de checkout direto
    const defaultWebUrl = `https://app.infinitepay.io/pay?amount=${amountInCents}&order_id=${encodeURIComponent(orderId)}`;
    try {
      await Linking.openURL(defaultWebUrl);
      return { launched: true };
    } catch {
      // Fallback
    }

    Alert.alert(
      'Configuração InfinitePay no iPhone',
      'Para abrir cobranças automáticas no iPhone sem erro do Safari, informe o seu usuário da InfinitePay (ex: @seunome) nas Configurações.',
      [{ text: 'OK' }]
    );
    return { launched: false, reason: 'MISSING_HANDLE' };
  }

  // ─── FLUXO ANDROID (InfiniteTap / NFC direto) ───
  const encodedReturn = encodeURIComponent(returnScheme);
  const deepLinkUrl = `infinitepay://pay?amount=${amountInCents}&payment_method=${method}&order_id=${encodeURIComponent(orderId)}&return_url=${encodedReturn}`;

  try {
    const canOpen = await Linking.canOpenURL(deepLinkUrl);

    if (canOpen) {
      await Linking.openURL(deepLinkUrl);
      return { launched: true };
    }

    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(deepLinkUrl);
        return { launched: true };
      } catch {
        // App não instalado
      }
    }

    Alert.alert(
      'InfinitePay não encontrado',
      'O aplicativo da InfinitePay não foi detectado neste aparelho. Deseja abrir a Play Store para instalá-lo ou prefere fazer a baixa manual?',
      [
        { text: 'Baixa Manual', style: 'cancel' },
        {
          text: 'Baixar App',
          onPress: () => {
            Linking.openURL(INFINITEPAY_PLAYSTORE_URL).catch(() => {});
          },
        },
      ]
    );

    return { launched: false, reason: 'APP_NOT_INSTALLED' };
  } catch (error: any) {
    console.error('Erro ao acionar InfinitePay:', error);
    return { launched: false, reason: error?.message || 'Erro ao abrir app' };
  }
}

/**
 * Registra um listener para processar o retorno da InfinitePay
 */
export function listenForInfinitePayReturn(
  onReturn: (data: InfinitePayReturnData) => void
): () => void {
  const handleUrl = (event: { url: string }) => {
    const { url } = event;
    if (!url || !url.includes('infinitepay-callback')) return;

    try {
      const parsedData = parseInfinitePayCallbackUrl(url);
      onReturn(parsedData);
    } catch (err) {
      console.error('Erro ao processar callback InfinitePay:', err);
      onReturn({
        success: false,
        rawUrl: url,
        message: 'Falha ao interpretar dados de retorno da InfinitePay.',
      });
    }
  };

  const subscription = Linking.addEventListener('url', handleUrl);

  Linking.getInitialURL().then(initialUrl => {
    if (initialUrl && initialUrl.includes('infinitepay-callback')) {
      handleUrl({ url: initialUrl });
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Extrai parâmetros do retorno da URL da InfinitePay
 */
export function parseInfinitePayCallbackUrl(url: string): InfinitePayReturnData {
  const queryString = url.split('?')[1] || '';
  const params = new URLSearchParams(queryString);

  const status = params.get('status') || params.get('result') || '';
  const success = status.toLowerCase() === 'success' || status.toLowerCase() === 'approved' || params.get('success') === 'true';

  return {
    success,
    orderId: params.get('order_id') || params.get('order_nsu') || undefined,
    transactionNsu: params.get('transaction_nsu') || params.get('nsu') || undefined,
    authCode: params.get('auth_code') || params.get('authorization_code') || undefined,
    cardBrand: params.get('card_brand') || params.get('brand') || undefined,
    amount: params.get('amount') ? Number(params.get('amount')) / 100 : undefined,
    rawUrl: url,
    message: params.get('message') || undefined,
  };
}
