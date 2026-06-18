
import { SignedXml } from 'xml-crypto';
import crypto from 'crypto';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pemKey = privateKey.export({ type: 'pkcs1', format: 'pem' });
const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe123"><elem>Teste</elem></infNFe></NFe>`;

console.log("\n--- Tentativa FINAL: addReference com OBJETO (API v6) ---");
try {
  const sig = new SignedXml();
  
  // Algoritmos explícitos (Standard)
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.privateKey = pemKey; // v6 uses privateKey property directly

  // PASSING OBJECT AS REQUIRED BY v6 SOURCE CODE
  sig.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: [
          "http://www.w3.org/2000/09/xmldsig#enveloped-signature", 
          "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
      ],
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
  });

  sig.computeSignature(xml);
  console.log("✅ SUCESSO! Assinatura gerada corretament com API de Objeto.");
} catch (e) {
  console.error("❌ ERRO Tentativa FINAL:", e.message);
  console.error(e.stack);
}
