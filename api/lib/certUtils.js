import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

/**
 * Resolve o caminho do certificado de forma segura (absoluto ou relativo ao projeto)
 */
export function resolveCertPath(certPath) {
  if (!certPath) return null;
  if (fs.existsSync(certPath)) return path.resolve(certPath);

  const candidates = [
    path.resolve(process.cwd(), certPath),
    path.resolve(process.cwd(), 'api', certPath),
    path.resolve(process.cwd(), '..', 'api', certPath),
    path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'certs', path.basename(certPath)),
    path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', certPath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.resolve(process.cwd(), certPath);
}

/**
 * Lê e analisa a validade e dados do certificado A1 (.pfx)
 * @param {string} certPath - Caminho do arquivo .pfx
 * @param {string} password - Senha do certificado
 * @returns {object} Informações sobre a validade do certificado
 */
export function getCertInfo(certPath, password = '') {
  if (!certPath) {
    return { exists: false, message: 'Caminho do certificado não informado' };
  }

  const resolved = resolveCertPath(certPath);

  if (!fs.existsSync(resolved)) {
    return { exists: false, resolvedPath: resolved, message: 'Arquivo do certificado não encontrado no disco' };
  }

  try {
    const pfxBuffer = fs.readFileSync(resolved);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');

    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    if (!certBag || !certBag.length) {
      return { exists: true, error: 'Nenhum certificado encontrado dentro do arquivo PFX' };
    }

    const cert = certBag[0].cert;
    const notAfter = cert.validity.notAfter;
    const notBefore = cert.validity.notBefore;
    const now = new Date();
    const vencido = now > notAfter;
    const diasRestantes = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const pad = (n) => String(n).padStart(2, '0');
    const d = notAfter;
    const dataValidadeFormatada = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const cnAttr = cert.subject.attributes.find((a) => a.name === 'commonName');
    const titular = cnAttr ? cnAttr.value : '';

    return {
      exists: true,
      valido: !vencido,
      vencido,
      dataValidade: notAfter.toISOString(),
      dataValidadeFormatada,
      dataInicioValidade: notBefore.toISOString(),
      diasRestantes,
      titular,
      caminhoArquivo: resolved
    };
  } catch (err) {
    return {
      exists: true,
      error: 'Senha incorreta ou arquivo de certificado inválido (' + err.message + ')'
    };
  }
}
