
// Implementação do padrão EMV QRCPS MPM para PIX Estático (BR Code)
// Documentação base: Manual de Padrões para Iniciação do Pix (BCB)

/**
 * Calcula o CRC16-CCITT (0xFFFF) conforme especificação do Bacen
 */
function crc16(str: string): string {
    let crc = 0xFFFF;
    const strlen = str.length;

    for (let c = 0; c < strlen; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }

    // Retorna hexadecimal em maiúsculo com 4 dígitos
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formata um campo TLV (Type-Length-Value)
 */
function tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

/**
 * Normaliza strings (remove acentos e caracteres especiais indesejados para BR Code)
 */
function normalize(str: string, maxLength?: number): string {
    const normalized = str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9\s.*-]/g, ""); // Remove chars inválidos (exceto alfanum, espaço, ., *, -)

    if (maxLength && normalized.length > maxLength) {
        return normalized.substring(0, maxLength);
    }
    return normalized;
}

/**
 * Valida o dígito verificador de um CPF para diferenciação precisa
 */
function isValidCPF(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    return rev === parseInt(cpf.charAt(10));
}

/**
 * Limpa e padroniza a chave Pix com base na especificação do Banco Central
 */
function cleanPixKey(key: string): string {
    let clean = key.trim();

    // Se parecer um e-mail (contém @)
    if (clean.includes('@')) {
        return clean.toLowerCase();
    }

    // Se parecer uma chave aleatória UUID (formato 8-4-4-4-12)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(clean)) {
        return clean.toLowerCase();
    }

    // Remover todos os caracteres não alfanuméricos exceto o '+' (importante para telefone celular)
    const numbersAndPlus = clean.replace(/[^0-9+]/g, '');

    // Se for telefone celular no formato internacional (começa com +55 ou similar)
    if (numbersAndPlus.startsWith('+')) {
        return numbersAndPlus;
    }

    // Se contiver apenas números ou for um telefone/CPF/CNPJ formatado
    const onlyNumbers = clean.replace(/\D/g, '');

    // CNPJ (14 dígitos)
    if (onlyNumbers.length === 14) {
        return onlyNumbers;
    }

    // CPF (11 dígitos e CPF matematicamente válido)
    if (onlyNumbers.length === 11 && isValidCPF(onlyNumbers)) {
        return onlyNumbers;
    }

    // Se for celular brasileiro sem o código do país (ex: 19999999999 ou 1999999999, e não é CPF válido)
    if (onlyNumbers.length === 10 || onlyNumbers.length === 11) {
        return `+55${onlyNumbers}`;
    }

    return clean;
}


/**
 * Sanitiza o TxID para garantir que seja 100% alfanumérico e compatível com todos os bancos (Max 25 chars)
 */
function cleanTxid(txid: string | undefined): string {
    if (!txid) return '***';
    if (txid === '***') return '***';

    // Remove acentos
    let normalized = txid.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Mantém apenas letras maiúsculas, minúsculas e números
    normalized = normalized.replace(/[^a-zA-Z0-9]/g, "");

    if (normalized.length === 0) {
        return '***';
    }

    return normalized.substring(0, 25);
}

interface PixPayloadParams {
    key: string;       // Chave PIX
    name: string;      // Nome do recebedor (Max 25)
    city: string;      // Cidade do recebedor (Max 15)
    amount: number;    // Valor (opcional, se 0 ou null, não é incluído fixamente)
    txid?: string;     // Identificador da transação (padrão '***')
}

export function generatePixPayload({ key, name, city, amount, txid }: PixPayloadParams): string {
    // 0. Limpeza rigorosa dos dados de entrada cruciais
    const cleanedKey = cleanPixKey(key);
    const cleanedTxid = cleanTxid(txid);

    // 1. Payload Format Indicator (00)
    const pfi = tlv('00', '01');

    // 2. Merchant Account Information (26)
    //    GUI (00) = br.gov.bcb.pix
    //    Key (01) = chave pix limpa
    const gui = tlv('00', 'br.gov.bcb.pix');
    const pixKey = tlv('01', cleanedKey);
    const merchantAccount = tlv('26', gui + pixKey);

    // 3. Merchant Category Code (52) - 0000 (Default/General)
    const mcc = tlv('52', '0000');

    // 4. Transaction Currency (53) - 986 (BRL)
    const currency = tlv('53', '986');

    // 5. Transaction Amount (54) - Opcional. Se fornecido, formatar 0.00
    let amt = '';
    if (amount && amount > 0) {
        amt = tlv('54', amount.toFixed(2));
    }

    // 6. Country Code (58) - BR
    const country = tlv('58', 'BR');

    // 7. Merchant Name (59) - Max 25 chars
    const merchantName = tlv('59', normalize(name, 25));

    // 8. Merchant City (60) - Max 15 chars
    const merchantCity = tlv('60', normalize(city, 15));

    // 9. Additional Data Field Template (62)
    //    TxID (05) - Max 25 chars. Default '***'
    const addData = tlv('62', tlv('05', cleanedTxid));

    // --- Montagem Parcial ---
    const payloadInfo = pfi + merchantAccount + mcc + currency + amt + country + merchantName + merchantCity + addData;

    // 10. CRC16 (63)
    // Adiciona o ID '63' e o Length '04' para calcular o CRC do conjunto
    const payloadForCrc = payloadInfo + '6304';
    const crc = crc16(payloadForCrc);

    return payloadForCrc + crc;
}

