import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const rows = await prisma.$queryRawUnsafe('SELECT id, nome, modelo, address, driver, ativo, dataInclusao FROM `Printer` WHERE `ativo` = true ORDER BY `nome` ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar impressoras' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, modelo, address, driver, ativo } = req.body;
    const n = String(nome || '').trim();
    if (!n) return res.status(400).json({ error: 'Nome é obrigatório' });
    const d = driver ? String(driver) : null;
    const a = address ? String(address) : null;
    await prisma.$executeRawUnsafe(`INSERT INTO \`Printer\` (nome, modelo, address, driver, ativo, dataInclusao) VALUES ('${n.replace(/'/g, "''")}', ${modelo ? `'${String(modelo).replace(/'/g, "''")}'` : 'NULL'}, ${a ? `'${a.replace(/'/g, "''")}'` : 'NULL'}, ${d ? `'${d.replace(/'/g, "''")}'` : 'NULL'}, ${ativo === undefined ? 1 : (!!ativo ? 1 : 0)}, NOW())`);
    const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, modelo, address, driver, ativo, dataInclusao FROM \`Printer\` WHERE nome = '${n.replace(/'/g, "''")}' ORDER BY id DESC LIMIT 1`);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.status(201).json({ message: 'Impressora cadastrada com sucesso', printer: created });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar impressora' });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const { nome, modelo, address, driver, ativo } = req.body;
    const fields = [];
    if (nome !== undefined) fields.push(`nome = '${String(nome).replace(/'/g, "''")}'`);
    if (modelo !== undefined) fields.push(`modelo = ${modelo ? `'${String(modelo).replace(/'/g, "''")}'` : 'NULL'}`);
    if (address !== undefined) fields.push(`address = ${address ? `'${String(address).replace(/'/g, "''")}'` : 'NULL'}`);
    if (driver !== undefined) fields.push(`driver = ${driver ? `'${String(driver).replace(/'/g, "''")}'` : 'NULL'}`);
    if (ativo !== undefined) fields.push(`ativo = ${!!ativo ? 1 : 0}`);
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    await prisma.$executeRawUnsafe(`UPDATE \`Printer\` SET ${fields.join(', ')} WHERE id = ${id}`);
    const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, modelo, address, driver, ativo, dataInclusao FROM \`Printer\` WHERE id = ${id}`);
    const updated = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.json({ message: 'Impressora atualizada com sucesso', printer: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar impressora' });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    await prisma.$executeRawUnsafe(`UPDATE \`Printer\` SET ativo = 0 WHERE id = ${id}`);
    res.json({ message: 'Impressora removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover impressora' });
  }
});

export default router;