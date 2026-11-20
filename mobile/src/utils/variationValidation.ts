import { Alert, Platform } from 'react-native';
import { variationTypeService } from '../services/api';

export interface VariationCheckResult {
  ok: boolean;
  reason?: 'none' | 'maxOpcoes' | 'error';
  message?: string;
}

/**
 * Extracts a human-readable error message from an API/Axios error.
 */
export function extractApiErrorMessage(error: any, fallback: string): string {
  const apiMsg =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message;
  if (typeof apiMsg === 'string' && apiMsg.trim().length > 0) {
    return apiMsg.trim();
  }
  return fallback;
}

/**
 * Shows an alert dialog that works reliably on both Web and Native.
 */
export function showFeedbackAlert(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Checks if there is an active VariationType configured with maxOpcoes >= 2
 * for the given product category.
 */
export async function validateVariationConfigForCategory(params: {
  categoriaId?: number | string | null;
  categoriaNome?: string | null;
}): Promise<VariationCheckResult> {
  try {
    const resp = await variationTypeService.list();
    const list: any[] = Array.isArray(resp?.data) ? resp.data : [];
    const active = list.filter((t) => t && t.ativo !== false);

    const catIdNum = Number(params.categoriaId || 0);
    const catLabel = (params.categoriaNome || '').trim() || 'selecionada';

    const matching = active.filter((t) => {
      const ids = Array.isArray(t.categoriasIds) ? t.categoriasIds.map(Number) : [];
      if (ids.length === 0) return true;
      return Number.isInteger(catIdNum) && catIdNum > 0 && ids.includes(catIdNum);
    });

    if (matching.length === 0) {
      return {
        ok: false,
        reason: 'none',
        message: `Não há nenhum Tipo de Variação (ex.: 2 sabores / meio a meio) cadastrado para a categoria "${catLabel}".\n\nDeseja abrir a tela de Tipos de Variação para cadastrar agora?`,
      };
    }

    const hasMultiOption = matching.some((t) => Number(t.maxOpcoes || 0) >= 2);
    if (!hasMultiOption) {
      return {
        ok: false,
        reason: 'maxOpcoes',
        message: `O Tipo de Variação da categoria "${catLabel}" está configurado com no máximo 1 opção. Para vender com 2 ou mais sabores/opções, é preciso configurar 2 ou mais opções.\n\nDeseja abrir a tela de Tipos de Variação para ajustar agora?`,
      };
    }

    return { ok: true };
  } catch {
    // Se falhar a consulta de rede, não bloqueia o usuário silenciosamente
    return { ok: true };
  }
}

/**
 * Prompts the user to navigate to the Variation Types configuration screen.
 */
export function promptOpenVariationTypes(message: string, onOpen: () => void): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(message)) {
      onOpen();
    }
    return;
  }

  Alert.alert('Configuração de Variação', message, [
    { text: 'Agora não', style: 'cancel' },
    { text: 'Abrir Tipos de Variação', onPress: onOpen },
  ]);
}
