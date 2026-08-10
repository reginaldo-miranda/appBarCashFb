/**
 * Validação de CPF, CNPJ (numérico) e CNPJ Alfanumérico (novo formato 2026+)
 * 
 * Regras:
 * - CPF: 11 dígitos numéricos, validação por módulo 11
 * - CNPJ numérico: 14 dígitos numéricos, validação por módulo 11
 * - CNPJ alfanumérico: 14 caracteres alfanuméricos (letras A-Z + dígitos 0-9),
 *   validação por módulo 11 com conversão de letras (A=10, B=11...Z=35)
 */

/**
 * Converte um caractere alfanumérico para seu valor numérico
 * Dígitos: 0-9 → 0-9
 * Dígitos: 0-9 → 0-9
 * Letras:  A-Z → 17-42 (ASCII - 48, conforme regra da Receita Federal)
 */
function charToValue(char: string): number {
  const c = char.toUpperCase();
  const code = c.charCodeAt(0);
  // Tanto dígitos quanto letras usam code - 48 (regra Receita Federal)
  if (code >= 48 && code <= 57) return code - 48;  // 0-9
  if (code >= 65 && code <= 90) return code - 48;  // A=17, B=18...Z=42
  return 0;
}

/**
 * Valida CPF (11 dígitos numéricos)
 * Retorna true se o CPF é válido
 */
export function validarCpf(cpf: string): boolean {
  // Remove formatação, mantendo apenas dígitos
  const clean = cpf.replace(/\D/g, '');
  
  if (clean.length !== 11) return false;
  
  // Rejeita sequências de números iguais (111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  
  if (parseInt(clean.charAt(9)) !== firstDigit) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;
  
  return parseInt(clean.charAt(10)) === secondDigit;
}

/**
 * Valida CNPJ numérico tradicional (14 dígitos)
 * Retorna true se o CNPJ é válido
 */
export function validarCnpjNumerico(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  
  if (clean.length !== 14) return false;
  
  // Rejeita sequências de números iguais
  if (/^(\d)\1{13}$/.test(clean)) return false;
  
  // Pesos para o primeiro DV
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i)) * pesos1[i];
  }
  let dv1 = 11 - (sum % 11);
  if (dv1 >= 10) dv1 = 0;
  
  if (parseInt(clean.charAt(12)) !== dv1) return false;
  
  // Pesos para o segundo DV
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i)) * pesos2[i];
  }
  let dv2 = 11 - (sum % 11);
  if (dv2 >= 10) dv2 = 0;
  
  return parseInt(clean.charAt(13)) === dv2;
}

/**
 * Valida CNPJ alfanumérico (14 caracteres, letras A-Z + dígitos 0-9)
 * Novo formato a partir de julho 2026
 * 
 * Os 12 primeiros caracteres são a base, os 2 últimos são os DVs numéricos.
 * Para o cálculo dos DVs, cada caractere alfanumérico é convertido:
 * 0-9 → valor 0-9, A-Z → valor 10-35
 * Os pesos são os mesmos do CNPJ tradicional.
 */
export function validarCnpjAlfanumerico(cnpj: string): boolean {
  // Remove caracteres especiais, mantém alfanuméricos
  const clean = cnpj.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (clean.length !== 14) return false;
  
  // Os 2 últimos devem ser dígitos numéricos (DVs)
  const dv1Char = clean.charAt(12);
  const dv2Char = clean.charAt(13);
  if (!/^\d$/.test(dv1Char) || !/^\d$/.test(dv2Char)) return false;
  
  // Verifica se todos os caracteres são iguais (rejeita)
  const allSame = clean.split('').every(c => c === clean[0]);
  if (allSame) return false;
  
  // Pesos para o primeiro DV (12 posições)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += charToValue(clean.charAt(i)) * pesos1[i];
  }
  let dv1 = 11 - (sum % 11);
  if (dv1 >= 10) dv1 = 0;
  
  if (parseInt(dv1Char) !== dv1) return false;
  
  // Pesos para o segundo DV (13 posições)
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += charToValue(clean.charAt(i)) * pesos2[i];
  }
  let dv2 = 11 - (sum % 11);
  if (dv2 >= 10) dv2 = 0;
  
  return parseInt(dv2Char) === dv2;
}

/**
 * Verifica se a string contém alguma letra (indica CNPJ alfanumérico)
 */
function temLetra(str: string): boolean {
  return /[A-Za-z]/.test(str);
}

/**
 * Resultado da validação de documento
 */
export interface ResultadoValidacao {
  valido: boolean;
  tipo: 'CPF' | 'CNPJ' | 'CNPJ_ALFA' | null;
  mensagem: string;
}

/**
 * Função principal: detecta o tipo de documento e valida
 * @param doc - CPF ou CNPJ (com ou sem formatação)
 * @returns ResultadoValidacao com valido, tipo e mensagem
 */
export function validarDocumento(doc: string): ResultadoValidacao {
  if (!doc || doc.trim().length === 0) {
    return { valido: false, tipo: null, mensagem: 'Informe o CPF ou CNPJ.' };
  }
  
  // Remove caracteres especiais, mantém alfanuméricos
  const raw = doc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (raw.length < 11) {
    return { valido: false, tipo: null, mensagem: 'CPF/CNPJ incompleto. Verifique a quantidade de dígitos.' };
  }
  
  // CPF: exatamente 11 caracteres numéricos
  if (raw.length === 11) {
    if (temLetra(raw)) {
      return { valido: false, tipo: null, mensagem: 'CPF deve conter apenas números.' };
    }
    if (validarCpf(raw)) {
      return { valido: true, tipo: 'CPF', mensagem: 'CPF válido ✓' };
    }
    return { valido: false, tipo: 'CPF', mensagem: 'CPF inválido! Verifique o dígito verificador.' };
  }
  
  // CNPJ: exatamente 14 caracteres
  if (raw.length === 14) {
    if (temLetra(raw)) {
      // CNPJ alfanumérico
      if (validarCnpjAlfanumerico(raw)) {
        return { valido: true, tipo: 'CNPJ_ALFA', mensagem: 'CNPJ alfanumérico válido ✓' };
      }
      return { valido: false, tipo: 'CNPJ_ALFA', mensagem: 'CNPJ alfanumérico inválido! Verifique o dígito verificador.' };
    } else {
      // CNPJ numérico tradicional
      if (validarCnpjNumerico(raw)) {
        return { valido: true, tipo: 'CNPJ', mensagem: 'CNPJ válido ✓' };
      }
      return { valido: false, tipo: 'CNPJ', mensagem: 'CNPJ inválido! Verifique o dígito verificador.' };
    }
  }
  
  // Tamanho entre 12-13 ou > 14
  if (raw.length > 11 && raw.length < 14) {
    return { valido: false, tipo: null, mensagem: 'CNPJ incompleto. Deve ter 14 caracteres.' };
  }
  
  return { valido: false, tipo: null, mensagem: 'Documento com tamanho inválido. CPF=11 dígitos, CNPJ=14 caracteres.' };
}

/**
 * Formata CPF ou CNPJ para exibição
 * CPF: 123.456.789-01
 * CNPJ: 12.345.678/0001-01
 * CNPJ Alfanumérico: AB.CDE.FGH/IJ01-23
 */
export function formatarDocumento(doc: string): string {
  const raw = doc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (raw.length === 11 && !temLetra(raw)) {
    // CPF: 123.456.789-01
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
  }
  
  if (raw.length === 14) {
    // CNPJ: 12.345.678/0001-01 (funciona para alfanumérico também)
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  }
  
  return doc;
}
