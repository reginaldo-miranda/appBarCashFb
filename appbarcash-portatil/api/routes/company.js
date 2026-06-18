import express from "express";
import prisma from "../lib/prisma.js";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios'; // Ensure axios is imported



// Configuração do Multer para upload de certificados
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Multer com DiskStorage para maior controle
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Garante que SEMPRE salva em api/certs, independente de onde rodar o node
    const dir = path.join(__dirname, '../certs');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Manter extensão original ou .pfx
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cert-' + uniqueSuffix + '.pfx');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = express.Router();

// GET: Retornar dados da empresa (único registro)
router.get("/", async (req, res) => {
  try {
    const company = await prisma.company.findFirst({
      include: { deliveryRanges: true }
    });
    res.json(company || {}); // Retorna objeto vazio se não houver cadastro ainda
  } catch (error) {
    console.error("Erro ao buscar dados da empresa:", error);
    res.status(500).json({ error: "Erro interno ao buscar empresa" });
  }
});

// Lista de todos os campos válidos do model Company (usada para sanitizar o payload)
const COMPANY_VALID_FIELDS = new Set([
  'razaoSocial', 'nomeFantasia', 'cnpj', 'inscricaoEstadual', 'inscricaoMunicipal',
  'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'ibge',
  'telefone', 'telefoneSecundario', 'email', 'whatsapp',
  'regimeTributario', 'cnae', 'contribuinteIcms', 'ambienteFiscal',
  'logo', 'nomeImpressao', 'mensagemRodape', 'serieNfce', 'numeroInicialNfce',
  'respNome', 'respCpf', 'respCargo', 'respTelefone', 'respEmail',
  'plano', 'valorMensalidade', 'diaVencimento', 'dataInicioCobranca', 'status',
  'formaCobranca', 'emailCobranca',
  'banco', 'agencia', 'conta', 'tipoConta', 'chavePix',
  'ultimoPagamento', 'proximoVencimento', 'diasAtraso', 'observacoes',
  'latitude', 'longitude', 'deliveryRadius',
  'cashbackPercent', 'pointsPerCurrency', 'pontosParaResgate', 'valorResgate',
  'csc', 'cscId', 'certificadoNome', 'certificadoSenha', 'certificadoPath', 'xmlFolder',
]);

/**
 * Remove campos inválidos (relacionais, metadados, campos desconhecidos) do payload
 * antes de enviar ao Prisma, evitando erros de "Unknown field".
 */
function sanitizeCompanyPayload(data) {
  const clean = {};
  for (const key of Object.keys(data)) {
    if (COMPANY_VALID_FIELDS.has(key)) {
      clean[key] = data[key];
    } else {
      console.log(`[sanitize] Campo ignorado: ${key}`);
    }
  }
  return clean;
}

// POST: Criar ou Atualizar (Upsert logic - garantindo apenas 1 registro)
router.post("/", async (req, res) => {
  const rawData = req.body;
  console.log('>>> RECEIVING POST /company, keys:', Object.keys(rawData));

  // Helpers de conversão segura
  const toDec = (val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string') val = val.replace(',', '.');
    const n = Number(val);
    return isNaN(n) ? null : n;
  };
  const toInt = (val, def = null) => {
    if (val === null || val === undefined || val === '') return def;
    const n = Number(val);
    return isNaN(n) ? def : n;
  };

  // Extrair deliveryRanges antes de sanitizar (campo relacional tratado à parte)
  const { deliveryRanges, ...rest } = rawData;

  // Sanitizar: manter apenas campos do model Company
  const data = sanitizeCompanyPayload(rest);

  // Conversão de tipos para campos numéricos/decimais
  if (data.ibge !== undefined) data.ibge = String(data.ibge);
  if (data.cnae !== undefined) data.cnae = String(data.cnae);
  if (data.cep !== undefined) data.cep = String(data.cep);
  if (data.numero !== undefined) data.numero = String(data.numero);
  if (data.cnpj !== undefined) data.cnpj = String(data.cnpj);

  data.valorMensalidade = toDec(data.valorMensalidade);
  data.serieNfce        = toInt(data.serieNfce, 1);
  data.numeroInicialNfce = toInt(data.numeroInicialNfce, 1);
  data.diaVencimento    = toInt(data.diaVencimento, null);
  data.diasAtraso       = toInt(data.diasAtraso, 0);
  data.cashbackPercent  = toDec(data.cashbackPercent) || 5.00;
  data.pontosParaResgate = toInt(data.pontosParaResgate) || 0;
  data.valorResgate = toDec(data.valorResgate) || 0;

  // pointsPerCurrency nunca pode ser null (tem NOT NULL no schema)
  const ppc = toDec(data.pointsPerCurrency);
  data.pointsPerCurrency = ppc || 1.00;

  // Campos booleanos
  if (data.contribuinteIcms !== undefined) data.contribuinteIcms = Boolean(data.contribuinteIcms);

  console.log('Payload sanitizado:', JSON.stringify(data, null, 2));

  try {
    const existing = await prisma.company.findFirst();

    if (existing) {
      // ── UPDATE ──────────────────────────────────────────────────────────────
      console.log('--- ATUALIZANDO EMPRESA id:', existing.id);

      const updatePayload = { ...data, updatedAt: new Date() };

      if (deliveryRanges !== undefined) {
        updatePayload.deliveryRanges = {
          deleteMany: {},
          create: Array.isArray(deliveryRanges) ? deliveryRanges.map(r => ({
            minDist: Number(r.minDist),
            maxDist: Number(r.maxDist),
            price:   Number(r.price),
          })) : [],
        };
      }

      const updated = await prisma.company.update({
        where: { id: existing.id },
        data: updatePayload,
        include: { deliveryRanges: true },
      });
      return res.json({ message: "Dados atualizados com sucesso", company: updated });

    } else {
      // ── CREATE ──────────────────────────────────────────────────────────────
      console.log('--- CRIANDO NOVA EMPRESA');

      // Defaults obrigatórios para primeiro cadastro
      const payload = {
        razaoSocial: "Minha Empresa (Configurar)",
        nomeFantasia: "Minha Empresa",
        cnpj: "00000000000000",
        ...data,
      };

      // Garantir CNPJ único se for placeholder
      if (payload.cnpj === "00000000000000") {
        const count = await prisma.company.count();
        if (count > 0) payload.cnpj = `0000000000000${count + 1}`;
      }

      const created = await prisma.company.create({
        data: {
          ...payload,
          deliveryRanges: {
            create: Array.isArray(deliveryRanges) ? deliveryRanges.map(r => ({
              minDist: Number(r.minDist),
              maxDist: Number(r.maxDist),
              price:   Number(r.price),
            })) : [],
          },
        },
        include: { deliveryRanges: true },
      });
      return res.status(201).json({ message: "Empresa cadastrada com sucesso", company: created });
    }

  } catch (error) {
    console.error("Erro ao salvar dados da empresa:", error);
    res.status(500).json({ error: "Erro ao salvar empresa: " + (error.message || error) });
  }
});

// PUT: Atualizar (mesma lógica do POST para simplificar frontend, mas explicito)
router.put("/", async (req, res) => {
  // Redireciona para lógica de POST que já faz upsert
  // Mas vamos manter separado se quiser lógica específica
  // Por enquanto, vou redirecionar a chamada internamente ou copiar lógica.
  // Melhor expor a rota e deixar o frontend chamar POST ou PUT.
  // Vamos implementar PUT igual Update.
  const data = req.body;
  if (data.valorMensalidade) data.valorMensalidade = Number(data.valorMensalidade);

  try {
    const existing = await prisma.company.findFirst();
    if (!existing) {
      return res.status(404).json({ message: "Cadastro não encontrado para atualização" });
    }

    const updated = await prisma.company.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() }
    });
    res.json({ message: "Dados atualizados com sucesso", company: updated });

  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST: Salvar Configurações NFC-e (com upload de certificado)
router.post("/nfce-config", upload.single('certificado'), async (req, res) => {
  console.log("POST /nfce-config - Body:", req.body);
  console.log("POST /nfce-config - File:", req.file ? { 
      originalname: req.file.originalname, 
      mimetype: req.file.mimetype, 
      size: req.file.size,
      path: req.file.path
  } : "Nenhum arquivo recebido");

  try {
    const { csc, cscId, certificadoSenha, ambiente, xmlFolder, chavePix } = req.body;
    let certificadoPath = null;

    if (req.file) {
      certificadoPath = req.file.path;
      console.log("[DEBUG] Novo certificado salvo em:", certificadoPath);
    }

    // Busca empresa existente
    const existing = await prisma.company.findFirst();
    
    if (existing) {
      // Atualiza
      const updateData = {
        csc,
        cscId,
        ambienteFiscal: ambiente === 'producao' ? 'producao' : 'homologacao',
      };

      if (chavePix !== undefined) updateData.chavePix = chavePix; // Save PIX Key
      
      if (certificadoSenha) {
          updateData.certificadoSenha = certificadoSenha;
      }
      if (certificadoPath) {
          updateData.certificadoPath = certificadoPath;
      }
      
      // Novos campos
      if (req.body.serie) updateData.serieNfce = Number(req.body.serie);
      if (req.body.numeroInicial) updateData.numeroInicialNfce = Number(req.body.numeroInicial);
      if (xmlFolder !== undefined) updateData.xmlFolder = xmlFolder;

      const updated = await prisma.company.update({
        where: { id: existing.id },
        data: updateData
      });
      
      return res.json({ message: "Configuração NFC-e salva com sucesso", company: updated });
    } else {
        // Se não existir empresa, Cria uma nova com dados padrão + config fiscal
        console.log("Nenhuma empresa encontrada. Criando nova para salvar config fiscal.");
        
        // Dados mínimos para criar empresa (placeholders)
        const newCompanyData = {
           razaoSocial: "Minha Empresa (Fiscal)",
           nomeFantasia: "Minha Empresa",
           cnpj: "00.000.000/0000-00", // Será ajustado se duplicado
           status: 'ativa',
           
           // Config Fiscal
           csc,
           cscId,
           ambienteFiscal: ambiente === 'producao' ? 'producao' : 'homologacao',
           xmlFolder,
        };

        if (chavePix !== undefined) newCompanyData.chavePix = chavePix;
        if (certificadoSenha) newCompanyData.certificadoSenha = certificadoSenha;
        if (certificadoPath) newCompanyData.certificadoPath = certificadoPath;
        
        // Garantir CNPJ único se for placeholder
        const count = await prisma.company.count();
        if (count > 0) newCompanyData.cnpj = `00.000.000/0000-${count + 1}`;

        const created = await prisma.company.create({
            data: newCompanyData
        });
        
        return res.status(201).json({ message: "Configuração NFC-e salva (Empresa criada)", company: created });
    }

  } catch (error) {
    console.error("Erro ao salvar config NFC-e:", error);
    res.status(500).json({ error: "Erro ao salvar configuração: " + error.message });
  }
});

// GET: Consultar CNPJ na BrasilAPI
router.get("/cnpj/:cnpj", async (req, res) => {
  const { cnpj } = req.params;
  // Remove caracteres não numéricos
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (cleanCnpj.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve conter 14 dígitos." });
  }

  try {
    console.log(`[CNPJ] Consultando BrasilAPI para: ${cleanCnpj}`);
    
    // Usar axios em vez de fetch para garantir compatibilidade
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    const data = response.data;

    // Mapear dados para o formato do nosso sistema
    const mappedData = {
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia || data.razao_social,
      cnpj: cleanCnpj,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.municipio,
      uf: data.uf,
      cep: data.cep,
      ibge: data.codigo_municipio_ibge, // IMPORTANTE: IBGE para NFC-e
      telefone: data.ddd_telefone_1,
      cnae: data.cnae_fiscal,
      dataAbertura: data.data_inicio_atividade
    };

    console.log(`[CNPJ] Sucesso! IBGE: ${mappedData.ibge}`);
    res.json(mappedData);

  } catch (error) {
    console.error("Erro ao consultar CNPJ:", error.message);
    if (error.response) {
        console.error("BrasilAPI Response:", error.response.data);
        if (error.response.status === 404) return res.status(404).json({ error: "CNPJ não encontrado na base pública." });
    }
    res.status(500).json({ error: "Erro ao consultar serviço de CNPJ: " + error.message });
  }
});


export default router;

