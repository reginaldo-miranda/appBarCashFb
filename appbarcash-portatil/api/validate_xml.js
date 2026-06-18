import fs from 'fs';
import libxml from 'libxmljs2';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validate() {
    try {
        console.log("=== Iniciando Validação Local de Schema ===");

        // 1. Ler o XML gerado (debug_soap_sent.xml)
        const soapPath = path.join(__dirname, 'debug_soap_sent.xml');
        if (!fs.existsSync(soapPath)) {
            throw new Error("Arquivo debug_soap_sent.xml não encontrado!");
        }
        const soapContent = fs.readFileSync(soapPath, 'utf8');

        // 2. Extrair o bloco <enviNFe>...</enviNFe>
        // O XSD valida o enviNFe, não o Envelope SOAP inteiro
        const enviNFeMatch = soapContent.match(/<enviNFe[\s\S]*?<\/enviNFe>/);
        if (!enviNFeMatch) {
            throw new Error("Bloco <enviNFe> não encontrado no SOAP!");
        }
        const xmlContent = enviNFeMatch[0];
        console.log("Bloco XML Extraído com sucesso (tamanho: " + xmlContent.length + " bytes)");

        // 3. Salvar XML extraído para debug/xmllint
        const tempXmlPath = path.join(__dirname, 'temp_validation.xml');
        fs.writeFileSync(tempXmlPath, xmlContent);
        console.log(`XML extraído salvo em: ${tempXmlPath}`);

        // 4. Ler o XSD com Contexto de Diretório (para resolver imports relative)
        const schemaDir = 'C:\\brainwinBeta\\Schemas400';
        const xsdFile = 'enviNFe_v4.00.xsd';
        const xsdPath = path.join(schemaDir, xsdFile);
        
        if (!fs.existsSync(xsdPath)) {
            throw new Error(`Arquivo XSD não encontrado: ${xsdPath}`);
        }

        // MUDAR CWD para a pasta do schema para o libxmljs resolver os includes
        const currentDir = process.cwd();
        try {
            process.chdir(schemaDir);
            console.log(`Diretório alterado para: ${process.cwd()} (para carregar XSDs)`);
            
            const xsdContent = fs.readFileSync(xsdFile, 'utf8');
            const xsdDoc = libxml.parseXml(xsdContent);
            const xmlDoc = libxml.parseXml(xmlContent); // XML string da memória (ou file)

            console.log("Validando contra o Schema...");
            const isValid = xmlDoc.validate(xsdDoc);

            if (!isValid) {
                console.error("\n❌ ERRO DE VALIDAÇÃO DO SCHEMA:");
                xmlDoc.validationErrors.forEach((err, index) => {
                    console.error(`[Erro ${index + 1}] Linha ${err.line}: ${err.message}`);
                });
            } else {
                console.log("\n✅ XML VÁLIDO! O Schema local aprovou.");
            }
        } finally {
            process.chdir(currentDir); // Restaurar diretório
        }

    } catch (error) {
        console.error("\n❌ Erro Fatal:", error.message);
    }
}

validate();
