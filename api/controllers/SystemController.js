import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const listDirectories = async (req, res) => {
    try {
        console.log('[SystemController] Listando diretórios...');
        const queryPath = req.query.path || os.homedir(); 
        console.log('[SystemController] Path:', queryPath);
        
        if (!fs.existsSync(queryPath)) {
            console.error('[SystemController] Caminho não existe:', queryPath);
            return res.status(404).json({ error: 'Caminho não encontrado' });
        }

        const items = fs.readdirSync(queryPath, { withFileTypes: true });

        const directories = items
            .filter(item => item.isDirectory() && !item.name.startsWith('.'))
            .map(item => ({
                name: item.name,
                path: path.join(queryPath, item.name),
                type: 'directory'
            }));
            
        // Add ".." option
        const parent = path.dirname(queryPath);
        if (parent !== queryPath) {
             directories.unshift({
                name: '.. (Voltar)',
                path: parent,
                type: 'parent'
            });
        }
        
        console.log(`[SystemController] Encontrados ${directories.length} itens.`);

        res.json({
            currentPath: queryPath,
            directories
        });

    } catch (error) {
        console.error('Erro ao listar diretórios:', error);
        res.status(500).json({ error: 'Erro ao listar diretórios: ' + error.message });
    }
};

function getMysqldumpPath() {
    const candidatePaths = [
        'mysqldump',
        'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysqldump.exe',
        'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
        'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
        'C:\\xampp\\mysql\\bin\\mysqldump.exe',
    ];
    for (const p of candidatePaths) {
        if (p === 'mysqldump') {
            try {
                execSync('mysqldump --version', { stdio: 'ignore' });
                return 'mysqldump';
            } catch (e) {}
        } else if (fs.existsSync(p)) {
            return `"${p}"`;
        }
    }
    return null;
}

function parseDbUrl(urlString) {
    try {
        const u = new URL(urlString);
        return {
            user: decodeURIComponent(u.username || 'root'),
            password: decodeURIComponent(u.password || ''),
            host: u.hostname || 'localhost',
            port: u.port || '3306',
            database: u.pathname.replace(/^\//, '') || 'appbarcash'
        };
    } catch (e) {
        return {
            user: 'root',
            password: '',
            host: 'localhost',
            port: '3306',
            database: 'appbarcash'
        };
    }
}

export const resetMovements = async (req, res) => {
    try {
        const { username, password, confirmWord, options } = req.body;

        if (!confirmWord || confirmWord.trim().toUpperCase() !== 'ZERAR') {
            return res.status(400).json({ error: 'Palavra de confirmação inválida. Digite ZERAR exatamente como solicitado.' });
        }

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
        }

        const adminFixo = { email: "admin@admin.com", password: "123456" };
        let isValidAdmin = false;
        let adminNome = "";

        if (username === adminFixo.email && password === adminFixo.password) {
            isValidAdmin = true;
            adminNome = "Admin Fixo";
        } else {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: username },
                        { nome: username }
                    ]
                }
            });

            if (user && user.ativo && (user.tipo === 'admin' || user.permissoes?.configuracoes)) {
                const match = await bcrypt.compare(password, user.senha);
                if (match) {
                    isValidAdmin = true;
                    adminNome = user.nome;
                }
            }
        }

        if (!isValidAdmin) {
            return res.status(401).json({ error: 'Credenciais de administrador inválidas ou usuário sem permissão de acesso.' });
        }

        // 1. Gerar Backup Preventivo
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const backupFilename = `backup_pre_zeramento_${timestamp}.sql`;
        const backupFilePath = path.join(backupDir, backupFilename);

        const mysqldumpBin = getMysqldumpPath();
        const dbConn = parseDbUrl(process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL || 'mysql://root:@localhost:3306/appbarcash');

        if (mysqldumpBin) {
            try {
                const passParam = dbConn.password ? `-p"${dbConn.password}"` : '';
                const dumpCmd = `${mysqldumpBin} -u "${dbConn.user}" ${passParam} -h "${dbConn.host}" -P ${dbConn.port} "${dbConn.database}" > "${backupFilePath}"`;
                execSync(dumpCmd, { stdio: 'pipe', shell: 'cmd.exe' });
                console.log(`[SystemController] Backup gerado com sucesso: ${backupFilePath}`);
            } catch (dumpErr) {
                console.error('[SystemController] Erro ao executar mysqldump:', dumpErr);
                return res.status(500).json({ error: 'Falha ao gerar backup preventivo antes da exclusão. Nenhuma alteração foi feita no banco.' });
            }
        } else {
            console.warn('[SystemController] mysqldump não encontrado no servidor');
            return res.status(500).json({ error: 'Ferramenta de backup (mysqldump) não localizada no servidor. Nenhuma exclusão foi realizada.' });
        }

        // 2. Executar Limpeza Selecionada dentro de uma Transação Prisma
        const opt = options || {};
        const summary = {};

        await prisma.$transaction(async (tx) => {
            // Fiscal (NFC-e) precisa ser limpo antes de Vendas se vendas forem apagadas
            if (opt.sales || opt.nfce) {
                const evDel = await tx.nfceEvent.deleteMany({});
                const nfDel = await tx.nfce.deleteMany({});
                summary.nfce = (nfDel.count || 0) + (evDel.count || 0);
            }

            // Vendas e Comandas
            if (opt.sales) {
                // Resetar status das mesas para livre
                await tx.mesa.updateMany({
                    data: {
                        vendaAtualId: null,
                        clientesAtuais: 0,
                        status: "livre",
                        funcionarioResponsavelId: null,
                        nomeResponsavel: null,
                        horaAbertura: null,
                        observacoes: null
                    }
                });

                const itemsDel = await tx.saleItem.deleteMany({});
                const cvDel = await tx.caixaVenda.deleteMany({});
                const sDel = await tx.sale.deleteMany({});
                summary.vendas = sDel.count || 0;
                summary.itensVenda = itemsDel.count || 0;
            }

            // Caixa
            if (opt.caixa) {
                await tx.caixaVenda.deleteMany({});
                const cDel = await tx.caixa.deleteMany({});
                summary.caixas = cDel.count || 0;
            }

            // Movimentações de Estoque
            if (opt.stockMovements) {
                const smDel = await tx.stockMovement.deleteMany({});
                summary.movimentacoesEstoque = smDel.count || 0;
            }

            // Zerar Saldo Atual de Estoque dos Produtos (se explicitamente marcado)
            if (opt.zeroProductStock) {
                const pUp = await tx.product.updateMany({
                    data: {
                        quantidade: 0,
                        estoqueDeposito: 0,
                        estoqueGeladeira: 0
                    }
                });
                summary.produtosEstoqueZerado = pUp.count || 0;
            }

            // Logs e Filas de Impressão / WhatsApp
            if (opt.logs) {
                const pjDel = await tx.printJob.deleteMany({});
                const waDel = await tx.whatsAppMessageLog.deleteMany({});
                summary.impressaoLogs = (pjDel.count || 0) + (waDel.count || 0);
            }

            // Clientes (opcional)
            if (opt.customers) {
                const custDel = await tx.customer.deleteMany({});
                summary.clientes = custDel.count || 0;
            }
        });

        console.log(`[SystemController] Limpeza concluída por ${adminNome}. Resumo:`, summary);

        return res.json({
            success: true,
            message: 'Limpeza de movimentações concluída com sucesso!',
            backupFilename,
            downloadUrl: `/api/system/download-backup/${backupFilename}`,
            summary,
            adminNome
        });

    } catch (error) {
        console.error('[SystemController] Erro ao realizar limpeza de movimentações:', error);
        return res.status(500).json({ error: 'Erro ao processar limpeza da base: ' + (error.message || error) });
    }
};

export const downloadBackup = async (req, res) => {
    try {
        const rawFilename = req.params.filename;
        const filename = path.basename(rawFilename);
        const backupDir = path.join(__dirname, '..', 'backups');
        const filePath = path.join(backupDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo de backup não encontrado no servidor.' });
        }

        res.download(filePath, filename);
    } catch (error) {
        console.error('[SystemController] Erro ao baixar backup:', error);
        res.status(500).json({ error: 'Erro ao realizar download do backup' });
    }
};
