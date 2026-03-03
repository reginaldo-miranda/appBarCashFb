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

// POST: Criar ou Atualizar (Upsert logic - garantindo apenas 1 registro)
router.post("/", async (req, res) => {
  const data = req.body;
  console.log('>>> RECEIVING POST /company', JSON.stringify(data, null, 2));
  
  // Converter tipos decimais/numéricos se necessário
  if (data.valorMensalidade) data.valorMensalidade = Number(data.valorMensalidade);
  if (data.serieNfce) data.serieNfce = Number(data.serieNfce);
  if (data.numeroInicialNfce) data.numeroInicialNfce = Number(data.numeroInicialNfce);
  if (data.diaVencimento) data.diaVencimento = Number(data.diaVencimento);
  if (data.cashbackPercent) data.cashbackPercent = Number(data.cashbackPercent);
  if (data.pointsPerCurrency) data.pointsPerCurrency = Number(data.pointsPerCurrency);
  if (data.valorResgate) data.valorResgate = Number(data.valorResgate);
  if (data.pontosParaResgate) data.pontosParaResgate = Number(data.pontosParaResgate);
  // Helper para conversão segura
  const toDec = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
  };
  const toInt = (val, def = null) => {
      if (val === null || val === undefined || val === '') return def;
      const n = Number(val);
      return isNaN(n) ? def : n;
  };

  // Garantir defaults para campos obrigatórios não nulos, se possível
  if (data.pointsPerCurrency === undefined || data.pointsPerCurrency === null) data.pointsPerCurrency = 1;
  data.valorMensalidade = toDec(data.valorMensalidade);
  data.serieNfce = toInt(data.serieNfce, 1);
  data.numeroInicialNfce = toInt(data.numeroInicialNfce, 1);
  data.diaVencimento = toInt(data.diaVencimento, null);
  data.diasAtraso = toInt(data.diasAtraso, 0);
  data.cashbackPercent = toDec(data.cashbackPercent);
  // pointsPerCurrency must be a number, not null.
  const ppc = toDec(data.pointsPerCurrency);
  data.pointsPerCurrency = ppc === null ? 1 : ppc;

  data.valorResgate = toDec(data.valorResgate);
  data.pontosParaResgate = toInt(data.pontosParaResgate, 0);

  // Garantir que campos de texto sejam strings


  // Garantir que campos de texto sejam strings (BrasilAPI retorna números às vezes)
  if (data.ibge) data.ibge = String(data.ibge);
  if (data.cnae) data.cnae = String(data.cnae);
  if (data.cep) data.cep = String(data.cep);
  if (data.numero) data.numero = String(data.numero);
  if (data.cnpj) data.cnpj = String(data.cnpj);


  try {
    // Verifica se já existe
    const existing = await prisma.company.findFirst();

    if (existing) {
      // Atualiza
      console.log('--- UPDATING EXISTING COMPANY ---');
      console.log('Incoming Payload keys:', Object.keys(data));

      // Separate explicit fields we want to ensure are updated
      // Use helper to parse numbers safely from strings or numbers
      const safeNum = (val, isInt = false) => {
         if (val === undefined || val === null || val === '') return undefined;
         if (typeof val === 'string') {
             val = val.replace(',', '.');
         }
         const n = Number(val);
         if (isNaN(n)) return undefined;
         return isInt ? parseInt(n) : n;
      };

      const cashbackPercent = safeNum(req.body.cashbackPercent);
      // Ensure pointsPerCurrency is never null/undefined, default to 1
      const pointsPerCurrencyRaw = safeNum(req.body.pointsPerCurrency);
      const pointsPerCurrency = pointsPerCurrencyRaw !== undefined ? pointsPerCurrencyRaw : 1; 
      
      const pontosParaResgate = safeNum(req.body.pontosParaResgate, true);
      const valorResgate = safeNum(req.body.valorResgate);

      // Construct base payload
      const { 
        deliveryRanges, 
        id, createdAt, updatedAt, products, users, sales, 
        ...otherData 
      } = data;

      const updatePayload = {
        ...otherData,
        pointsPerCurrency: otherData.pointsPerCurrency || 1, // Fallback for base data
        updatedAt: new Date(),
      };

      // Explicitly override/set these fields if they exist in request
      if (cashbackPercent !== undefined) updatePayload.cashbackPercent = cashbackPercent;
      
      // Always update pointsPerCurrency if in request, or ensure it's valid
      if (req.body.pointsPerCurrency !== undefined) {
         updatePayload.pointsPerCurrency = pointsPerCurrency;
      } else if (!updatePayload.pointsPerCurrency) {
         updatePayload.pointsPerCurrency = 1;
      }

      if (pontosParaResgate !== undefined) updatePayload.pontosParaResgate = pontosParaResgate;
      if (valorResgate !== undefined) updatePayload.valorResgate = valorResgate;

      console.log('Final Update Payload:', JSON.stringify(updatePayload, null, 2));

      if (deliveryRanges !== undefined) {
          updatePayload.deliveryRanges = {
            deleteMany: {},
            create: Array.isArray(deliveryRanges) ? deliveryRanges.map(r => ({
              minDist: Number(r.minDist),
              maxDist: Number(r.maxDist),
              price: Number(r.price)
            })) : []
          };
      }

      const updated = await prisma.company.update({
        where: { id: existing.id },
        data: updatePayload,
        include: { deliveryRanges: true }
      });
      return res.json({ message: "Dados atualizados com sucesso", company: updated });
    } else {
      // Cria
      // Cria
      console.log('--- POST /company DEBUG ---');
      console.log('Incoming Data:', JSON.stringify(data, null, 2));

      // Sanitização: remove campos relacionais ou metadados que não devem ser salvos diretamente na tabela Company
      const { 
        deliveryRanges, 
        id, 
        createdAt, 
        updatedAt, 
        products, 
        users, 
        sales, 
        ...companyData 
      } = data;
      
      const updatePayload = {
        ...companyData, 
        updatedAt: new Date()
      };
      
      console.log('Update Payload:', JSON.stringify(updatePayload, null, 2));

      // Se for a primeira criação (via tela de delivery), pode faltar dados obrigatórios da empresa
      // Preencher com defaults para não quebrar
      const payload = {
         razaoSocial: "Minha Empresa (Configurar)",
         nomeFantasia: "Minha Empresa",
         cnpj: "00.000.000/0000-00", // Placeholder inicial
         ...companyData
      };
      
      // Garantir CNPJ único se for placeholder (caso já exista um placeholder, o que não deveria ocorrer pois cairia no update, mas por segurança)
      if (payload.cnpj === "00.000.000/0000-00") {
          const count = await prisma.company.count();
          if (count > 0) payload.cnpj = `00.000.000/0000-${count + 1}`;
      }

      const created = await prisma.company.create({
        data: {
          ...payload,
          deliveryRanges: {
            create: Array.isArray(deliveryRanges) ? deliveryRanges.map(r => ({
              minDist: Number(r.minDist),
              maxDist: Number(r.maxDist),
              price: Number(r.price)
            })) : []
          }
        },
        include: { deliveryRanges: true }
      });
      return res.status(201).json({ message: "Empresa cadastrada com sucesso", company: created });
    }
  } catch (error) {
    console.error("Erro ao salvar dados da empresa:", error);
    // Retornar a mensagem exata do erro para facilitar o debug no frontend
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

