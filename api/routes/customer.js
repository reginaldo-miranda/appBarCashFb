import express from "express";
import { getActivePrisma } from "../lib/prisma.js";

const router = express.Router();

const handleByCpf = async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const cpf = req.query.cpf || req.params.cpf || '';
    if (!cpf) return res.status(400).json({ error: "CPF/CNPJ não informado" });
    
    const cpfRaw = String(cpf).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const customers = await prisma.customer.findMany({
      take: 200,
      orderBy: { id: 'desc' }
    });

    const customer = customers.find(c => {
      if (!c.cpf) return false;
      const cRaw = String(c.cpf).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return cRaw === cpfRaw || String(c.cpf).toUpperCase() === String(cpf).toUpperCase();
    });
    
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cliente por CPF" });
  }
};

router.get("/by-cpf", handleByCpf);
router.get("/by-cpf/:cpf", handleByCpf);

// Rota para criar cliente
router.post("/create", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, endereco, cidade, estado, fone, cep, cpf, rg, dataNascimento, ativo, participaFidelidade } = req.body;

    // Verificar se CPF já existe (se informado)
    if (cpf) {
        const customerExistente = await prisma.customer.findUnique({ where: { cpf } });
        if (customerExistente) {
          return res.status(400).json({ error: "CPF já cadastrado" });
        }
    }

    const novoCustomer = await prisma.customer.create({
      data: {
        nome,
        endereco,
        cidade,
        estado,
        fone,
        cep,
        cpf: cpf || null,
        rg,
        dataNascimento,
        dataNascimento,
        ativo: ativo !== undefined ? ativo : true,
        participaFidelidade: participaFidelidade !== undefined ? participaFidelidade : true,
      },
    });

    res.status(201).json({ message: "Cliente cadastrado com sucesso", customer: novoCustomer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar cliente" });
  }
});

// Rota para listar todos os clientes
router.get("/list", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome } = req.query;
    const where = {};
    if (nome) {
      // Busca ampla para incluir NOME, CPF ou TELEFONE, mas apenas se a regex não resultar em vazio
      const searchStr = String(nome).trim();
      const numCpfStr = searchStr.replace(/[^\d.-]/g, '');
      const numFoneStr = searchStr.replace(/[^\d() -]/g, '');
      
      const orConditions = [{ nome: { contains: searchStr } }];
      if (numCpfStr.length > 0) orConditions.push({ cpf: { contains: numCpfStr } });
      if (numFoneStr.length > 0) orConditions.push({ fone: { contains: numFoneStr } });
      
      where.OR = orConditions;
    }
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { dataInclusao: "desc" },
      take: 20
    });
    console.log('API /list customers[0]:', customers.length > 0 ? customers[0] : 'empty');
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar clientes" });
  }
});

router.get("/:id", async (req, res) => {
  console.log(`[DEBUG-CUSTOMER] GET /:id called with params:`, req.params);
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(customer);
  } catch (error) {
    console.error("ERRO COMPLETO EM /customer/:id =>", {
      mensagem: error.message,
      stack: error.stack,
      codigo: error.code,
      meta: error.meta
    });
    res.status(500).json({ error: "Erro ao buscar cliente", detalhes: error.message });
  }
});

// Rota para atualizar cliente
router.put("/update/:id", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { nome, endereco, cidade, estado, fone, cep, cpf, rg, dataNascimento, ativo, participaFidelidade } = req.body;

    // Verificar se CPF já existe em outro cliente
    if (cpf) {
        const customerExistente = await prisma.customer.findFirst({ where: { cpf, id: { not: id } } });
        if (customerExistente) {
            return res.status(400).json({ error: "CPF já cadastrado para outro cliente" });
        }
    }

    const customerAtualizado = await prisma.customer.update({
      where: { id },
      data: { nome, endereco, cidade, estado, fone, cep, cpf: cpf || null, rg, dataNascimento, ativo, participaFidelidade },
    });

    res.json({ message: "Cliente atualizado com sucesso", customer: customerAtualizado });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.status(500).json({ error: "Erro ao atualizar cliente" });
  }
});

// Rota para deletar cliente
router.delete("/delete/:id", async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Cliente deletado com sucesso" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.status(500).json({ error: "Erro ao deletar cliente" });
  }
});

export default router;