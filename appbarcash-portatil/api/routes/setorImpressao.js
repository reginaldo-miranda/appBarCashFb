import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';

const router = express.Router();

async function hasPrinterIdColumn(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'SetorImpressao' AND column_name = 'printerId'"
    );
    const r = Array.isArray(rows) && rows.length > 0 ? rows[0] : { cnt: 0 };
    const cnt = Number(r?.cnt ?? 0);
    return Number.isFinite(cnt) && cnt > 0;
  } catch {
    return false;
  }
}

router.get('/list', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    try {
      const hasPrinter = await hasPrinterIdColumn(prisma);
      const sql = hasPrinter
        ? 'SELECT id, nome, descricao, modoEnvio, whatsappDestino, printerId, ativo, dataInclusao FROM `SetorImpressao` ORDER BY `nome` ASC'
        : 'SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM `SetorImpressao` ORDER BY `nome` ASC';
      const rows = await prisma.$queryRawUnsafe(sql);
      res.json({ success: true, data: rows });
    } catch (_e) {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar setores de impressão' });
  }
});

router.get('/selected', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    try {
      const rows = await prisma.$queryRawUnsafe("SELECT `value` FROM `AppSetting` WHERE `key` = 'defaultSetorImpressaoId' LIMIT 1");
      const val = Array.isArray(rows) && rows.length > 0 ? rows[0]?.value : null;
      const id = val ? Number(val) : null;
      return res.json({ setorId: id });
    } catch (_e) {
      return res.json({ setorId: null });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter setor selecionado' });
  }
});

router.post('/select', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { setorId } = req.body;
    const sid = Number(setorId);
    if (!Number.isInteger(sid) || sid <= 0) {
      return res.status(400).json({ error: 'Setor não selecionado' });
    }
    const exists = await prisma.$queryRawUnsafe(`SELECT id FROM \`SetorImpressao\` WHERE id = ${sid} LIMIT 1`);
    const ok = Array.isArray(exists) && exists.length > 0;
    if (!ok) {
      return res.status(404).json({ error: 'Setor não encontrado' });
    }
    try {
      await prisma.$executeRawUnsafe(
        "CREATE TABLE IF NOT EXISTS `AppSetting` (\n          `key` VARCHAR(191) NOT NULL,\n          `value` VARCHAR(191) NULL,\n          `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n          PRIMARY KEY (`key`)\n        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
      );
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`INSERT INTO \`AppSetting\` (\`key\`, \`value\`, \`updatedAt\`) VALUES ('defaultSetorImpressaoId', '${sid}', NOW()) ON DUPLICATE KEY UPDATE \`value\`='${sid}', \`updatedAt\`=NOW()`);
    } catch (e1) {
      try {
        await prisma.$executeRawUnsafe(`REPLACE INTO \`AppSetting\` (\`key\`, \`value\`, \`updatedAt\`) VALUES ('defaultSetorImpressaoId', '${sid}', NOW())`);
      } catch (e2) {
        const rows = await prisma.$queryRawUnsafe("SELECT `value` FROM `AppSetting` WHERE `key` = 'defaultSetorImpressaoId' LIMIT 1");
        if (Array.isArray(rows) && rows.length > 0) {
          await prisma.$executeRawUnsafe(`UPDATE \`AppSetting\` SET \`value\`='${sid}', \`updatedAt\`=NOW() WHERE \`key\`='defaultSetorImpressaoId'`);
        } else {
          await prisma.$executeRawUnsafe(`INSERT INTO \`AppSetting\` (\`key\`, \`value\`, \`updatedAt\`) VALUES ('defaultSetorImpressaoId', '${sid}', NOW())`);
        }
      }
    }
    return res.json({ ok: true, message: 'Setor de impressão gravado com sucesso!', setorId: sid });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao gravar setor de impressão' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const hasPrinter = await hasPrinterIdColumn(prisma);
    const sql = hasPrinter
      ? `SELECT id, nome, descricao, modoEnvio, whatsappDestino, printerId, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`
      : `SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`;
    const rows = await prisma.$queryRawUnsafe(sql);
    const setor = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!setor) return res.status(404).json({ error: 'Setor não encontrado' });
    res.json(setor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar setor' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, descricao, modoEnvio, whatsappDestino, ativo, printerId } = req.body;
    const n = String(nome || '').trim();
    if (!n) return res.status(400).json({ error: 'Nome é obrigatório' });
    const mv = String(modoEnvio || 'impressora').toLowerCase();
    const m = mv === 'whatsapp' ? 'whatsapp' : 'impressora';
    const w = whatsappDestino ? String(whatsappDestino) : null;
    const a = ativo === undefined ? true : !!ativo;
    const hasPrinter = await hasPrinterIdColumn(prisma);
    if (hasPrinter) {
      const pId = printerId !== undefined && printerId !== null ? Number(printerId) : null;
      const pCol = pId && Number.isInteger(pId) && pId > 0 ? String(pId) : 'NULL';
      await prisma.$executeRawUnsafe(`INSERT INTO \`SetorImpressao\` (nome, descricao, modoEnvio, whatsappDestino, printerId, ativo, dataInclusao) VALUES ('${n.replace(/'/g, "''")}', ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : 'NULL'}, '${m}', ${w ? `'${w.replace(/'/g, "''")}'` : 'NULL'}, ${pCol}, ${a ? 1 : 0}, NOW())`);
      const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, descricao, modoEnvio, whatsappDestino, printerId, ativo, dataInclusao FROM \`SetorImpressao\` WHERE nome = '${n.replace(/'/g, "''")}' ORDER BY id DESC LIMIT 1`);
      const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return res.status(201).json({ message: 'Setor cadastrado com sucesso', setor: created });
    } else {
      await prisma.$executeRawUnsafe(`INSERT INTO \`SetorImpressao\` (nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao) VALUES ('${n.replace(/'/g, "''")}', ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : 'NULL'}, '${m}', ${w ? `'${w.replace(/'/g, "''")}'` : 'NULL'}, ${a ? 1 : 0}, NOW())`);
      const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE nome = '${n.replace(/'/g, "''")}' ORDER BY id DESC LIMIT 1`);
      const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return res.status(201).json({ message: 'Setor cadastrado com sucesso', setor: created });
    }
  } catch (error) {
    const msg = String(error?.message || '');
    if (/duplicate/i.test(msg) || /UNIQUE/i.test(msg)) {
      return res.status(400).json({ error: 'Já existe um setor com este nome' });
    }
    console.error('setorImpressao.create error:', error);
    res.status(500).json({ error: 'Erro ao cadastrar setor', details: String(error?.message || error) });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nome, descricao, modoEnvio, whatsappDestino, ativo, printerId } = req.body;
    const fields = [];
    if (nome !== undefined) fields.push(`nome = '${String(nome).replace(/'/g, "''")}'`);
    if (descricao !== undefined) fields.push(`descricao = ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : 'NULL'}`);
    if (modoEnvio !== undefined) {
      const mv = String(modoEnvio).toLowerCase();
      const m = mv === 'whatsapp' ? 'whatsapp' : 'impressora';
      fields.push(`modoEnvio = '${m}'`);
    }
    if (whatsappDestino !== undefined) fields.push(`whatsappDestino = ${whatsappDestino ? `'${String(whatsappDestino).replace(/'/g, "''")}'` : 'NULL'}`);
    if (ativo !== undefined) fields.push(`ativo = ${!!ativo ? 1 : 0}`);
    const hasPrinter = await hasPrinterIdColumn(prisma);
    if (hasPrinter && printerId !== undefined) {
      const pId = printerId !== null ? Number(printerId) : null;
      const pVal = pId && Number.isInteger(pId) && pId > 0 ? String(pId) : 'NULL';
      fields.push(`printerId = ${pVal}`);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    await prisma.$executeRawUnsafe(`UPDATE \`SetorImpressao\` SET ${fields.join(', ')} WHERE id = ${id}`);
    const sql = hasPrinter
      ? `SELECT id, nome, descricao, modoEnvio, whatsappDestino, printerId, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`
      : `SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`;
    const rows = await prisma.$queryRawUnsafe(sql);
    const updated = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.json({ message: 'Setor atualizado com sucesso', setor: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar setor' });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await prisma.$executeRawUnsafe(`DELETE FROM \`SetorImpressao\` WHERE id = ${id}`);
    res.json({ message: 'Setor removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover setor' });
  }
});

export default router;