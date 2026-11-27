import { Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseURL } from './api';

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
 * Detecta se o dispositivo atual é Android (app nativo ou navegador Android)
 */
export function isAndroidDevice(): boolean {
  if (Platform.OS === 'android') return true;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return true;
  }
  return false;
}

/**
 * Indica se o dispositivo deve usar o fluxo Web (iPhone/iPad/Safari ou Desktop Windows/Mac/Linux).
 * Apenas Android (app ou navegador Android) usa o deep link infinitepay:// (InfiniteTap).
 */
export function shouldUseInfinitePayWebFlow(): boolean {
  return isAppleDevice() || !isAndroidDevice();
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

export const INFINITEPAY_CHECKOUT_API_URL = 'https://api.checkout.infinitepay.io/links';

/**
 * Normaliza a InfiniteTag/handle removendo espaços, prefixos (@ ou $) e eventuais URLs coladas.
 */
export function sanitizeInfinitePayHandle(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  let value = trimmed;
  // Se o usuário colou uma URL (ex: https://infinitepay.io/$loja ou checkout.infinitepay.io/loja)
  if (/^https?:\/\//i.test(value) || value.includes('infinitepay.io/')) {
    const withoutProtocol = value.replace(/^https?:\/\//i, '');
    const pathPart = withoutProtocol.split('/').slice(1).join('/');
    value = pathPart.split(/[?#]/)[0] || '';
  }

  return value.replace(/^[@$]+/, '').replace(/\s+/g, '').trim();
}

/**
 * Salva o identificador/usuário da InfinitePay
 */
export async function setInfinitePayHandle(handle: string): Promise<void> {
  try {
    await AsyncStorage.setItem(INFINITEPAY_HANDLE_KEY, sanitizeInfinitePayHandle(handle));
  } catch (e) {
    console.error('Erro ao salvar handle InfinitePay:', e);
  }
}

function showInfinitePayAlert(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message, [{ text: 'OK' }]);
}

export const INFINITEPAY_IOS_SCHEME = 'infinitepaydash://infinitetap-app';

/**
 * Retorna o link oficial para acionar o InfiniteTap (aproximação):
 * - No iOS / iPhone: Esquema nativo de pagamento do app InfinitePay (infinitepaydash://infinitetap-app)
 *   Envia valor, método, parcelas (opcional no crédito), order_id e result_url.
 * - No Android: Deep Link customizado (infinitepay://pay)
 */
export function getInfinitePayTapUrl(
  amount: number,
  method: 'credit' | 'debit' = 'credit',
  orderId = '',
  installments?: number | null
): string {
  const amountInCents = Math.round(Number(amount || 0) * 100);
  const returnUrl =
    typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : 'mobile://infinitepay-callback';
  const encodedReturn = encodeURIComponent(returnUrl);

  if (isAppleDevice()) {
    // Contrato OFICIAL do InfiniteTap (https://www.infinitepay.io/checkout-tap):
    // infinitepaydash://infinitetap-app?amount=100&payment_method=credit&installments=1&order_id=...
    //   &result_url=...&app_client_referrer=...&af_force_deeplink=true
    // amount = inteiro em centavos (mínimo 100 = R$ 1,00)
    const queryParams = [
      `amount=${amountInCents}`,
      `payment_method=${method}`,
    ];

    if (method === 'debit') {
      queryParams.push('installments=1');
    } else if (typeof installments === 'number' && Number.isFinite(installments) && installments >= 1) {
      queryParams.push(`installments=${Math.min(12, Math.floor(installments))}`);
    }

    queryParams.push(
      `order_id=${encodeURIComponent(orderId)}`,
      `result_url=${encodedReturn}`,
      `app_client_referrer=AppBarCash`,
      `af_force_deeplink=true`
    );

    return `${INFINITEPAY_IOS_SCHEME}?${queryParams.join('&')}`;
  }

  return `infinitepay://pay?amount=${amountInCents}&payment_method=${method}&order_id=${encodeURIComponent(orderId)}&return_url=${encodedReturn}`;
}

/**
 * Abre o app oficial da InfinitePay diretamente na tela principal/cobrança (sem forçar o Tap imediato),
 * copiando o valor para a área de transferência para que o operador possa configurar parcelas, taxas, etc.
 */
export function openInfinitePayNormalApp(amount: number): { launched: boolean; copied: boolean } {
  const formatted = Number(amount || 0).toFixed(2).replace('.', ',');
  let copied = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(formatted).catch(() => {});
      copied = true;
    }
  } catch {
    // Clipboard opcional
  }

  const url = isAppleDevice() ? 'infinitepaydash://' : 'infinitepay://';

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() => {
        Linking.openURL('infinitepay://').catch(() => {});
      });
    }
  } catch (err) {
    console.error('Erro ao abrir app InfinitePay normal:', err);
  }

  return { launched: true, copied };
}

/**
 * Abre o app oficial da InfinitePay diretamente no InfiniteTap (aproximação NFC).
 * No iPhone, utiliza o esquema nativo infinitepaydash://infinitetap-app.
 */
export function openInfinitePayAppForTap(
  amount: number,
  method: 'credit' | 'debit' = 'credit',
  orderId = '',
  installments?: number | null
): { launched: boolean; copied: boolean } {
  const formatted = Number(amount || 0).toFixed(2).replace('.', ',');
  let copied = false;

  // Copia o valor em segundo plano
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(formatted).catch(() => {});
      copied = true;
    }
  } catch {
    // Clipboard opcional
  }

  const url = getInfinitePayTapUrl(amount, method, orderId, installments);

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() => {});
    }
  } catch (err) {
    console.error('Erro ao acionar InfinitePay:', err);
  }

  return { launched: true, copied };
}

/**
 * Aciona a cobrança no celular.
 * No Android: Aciona o app InfinitePay via Deep Link (InfiniteTap por aproximação).
 * No iPhone: Gera um link oficial via API de Checkout Integrado da InfinitePay e abre no Safari.
 */
export async function openInfinitePayTap({
  amount,
  method,
  orderId,
  returnScheme = 'mobile://infinitepay-callback',
}: InfinitePayPaymentParams): Promise<{ launched: boolean; reason?: string; message?: string }> {
  const amountInCents = Math.round(amount * 100);

  if (amountInCents <= 0) {
    return { launched: false, reason: 'Valor de cobrança inválido.', message: 'Valor de cobrança inválido.' };
  }

  const useWebFlow = shouldUseInfinitePayWebFlow();

  // ─── FLUXO WEB (iPhone / Safari / Desktop Windows e Mac) ───
  if (useWebFlow) {
    const rawHandle = await getInfinitePayHandle();
    const cleanHandle = sanitizeInfinitePayHandle(rawHandle);

    if (!cleanHandle) {
      const msg = 'Para cobrar no iPhone pelo Safari, informe a sua InfiniteTag (ex: $seunome ou seunome) nas Configurações.';
      showInfinitePayAlert('Configuração InfinitePay no iPhone', msg);
      return { launched: false, reason: 'MISSING_HANDLE', message: msg };
    }

    const isWebRuntime = Platform.OS === 'web';
    const endpoint = isWebRuntime
      ? `${getBaseURL()}/infinitepay/checkout-link`
      : INFINITEPAY_CHECKOUT_API_URL;
    const redirectUrl =
      isWebRuntime && typeof window !== 'undefined' ? window.location.href : returnScheme;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: cleanHandle,
          order_nsu: orderId,
          redirect_url: redirectUrl,
          items: [
            {
              description: `Pedido ${orderId}`,
              price: amountInCents,
              quantity: 1,
            },
          ],
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.url) {
        if (isWebRuntime && typeof window !== 'undefined') {
          const opened = window.open(data.url, '_blank', 'noopener,noreferrer');
          // Safari iOS bloqueia window.open após chamada assíncrona; faz fallback na aba atual
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = data.url;
          }
          return { launched: true };
        }

        await Linking.openURL(data.url);
        return { launched: true };
      }

      const apiMessage =
        data?.message ||
        data?.error ||
        `Não foi possível gerar o link de pagamento (HTTP ${response.status}).`;

      const fullMsg = `${apiMessage}\n\nVerifique se a InfiniteTag "${cleanHandle}" está correta e se o Checkout Integrado está habilitado no app da InfinitePay.`;
      console.error('Erro na API Checkout InfinitePay:', response.status, data);
      showInfinitePayAlert('Erro ao gerar link InfinitePay', fullMsg);
      return { launched: false, reason: 'CHECKOUT_API_ERROR', message: fullMsg };
    } catch (err: any) {
      const netMsg = 'Não foi possível conectar à InfinitePay para gerar o link de pagamento. Verifique sua internet ou faça a baixa manual.';
      console.error('Erro ao chamar API Checkout InfinitePay no iPhone:', err);
      showInfinitePayAlert('Erro de conexão com InfinitePay', netMsg);
      return { launched: false, reason: err?.message || 'NETWORK_ERROR', message: netMsg };
    }
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
