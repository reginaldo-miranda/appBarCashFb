import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para obter o caminho real da pasta de XML
async function getXmlRootFolder() {
  const company = await prisma.company.findFirst();
  if (company && company.xmlFolder && company.xmlFolder.trim() !== '') {
    return company.xmlFolder;
  }
  return path.join(__dirname, '../../xml_nfce');
}

export const listXmlFolders = async (req, res) => {
  try {
    const rootFolder = await getXmlRootFolder();
    
    if (!fs.existsSync(rootFolder)) {
      return res.json({ ok: true, folders: [] });
    }

    const items = fs.readdirSync(rootFolder, { withFileTypes: true });
    
    // Pega apenas diretórios
    const folders = items
      .filter(item => item.isDirectory())
      .map(item => item.name);

    // Sempre adiciona a opção raiz para pegar os XMLs da pasta principal
    folders.unshift('Raiz (Mês Atual ou Todos)');

    res.json({ ok: true, folders });
  } catch (error) {
    console.error('Erro ao listar pastas de XML:', error);
    res.status(500).json({ ok: false, message: 'Erro ao listar as pastas de XML' });
  }
};

export const exportXmls = async (req, res) => {
  try {
    const { folder, sendEmail, emailTo } = req.body;

    if (!folder) {
      return res.status(400).json({ ok: false, message: 'É obrigatório selecionar uma pasta.' });
    }

    if (sendEmail && !emailTo) {
      return res.status(400).json({ ok: false, message: 'O e-mail de destino é obrigatório.', emailError: true });
    }

    const rootFolder = await getXmlRootFolder();
    
    // Se escolheu a Raiz, compacta a pasta inteira. Senão compacta a subpasta.
    const sourceFolder = (folder === 'Raiz (Mês Atual ou Todos)') ? rootFolder : path.join(rootFolder, folder);

    if (!fs.existsSync(sourceFolder)) {
      return res.status(404).json({ ok: false, message: 'A pasta selecionada não foi encontrada.' });
    }

    // Criar um zip temporário
    const tmpDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const zipFilePath = path.join(tmpDir, `Exportacao_XML_${folder}.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Envolver a lógica em Promise para retornar só depois de zipado (ou enviado)
    await new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.directory(sourceFolder, false);
      archive.finalize();
    });

    if (sendEmail) {
      // Puxar config de SMTP
      const getConfigValue = async (key) => {
        const setting = await prisma.appSetting.findUnique({ where: { key } });
        return setting ? setting.value : '';
      };

      const host = await getConfigValue('smtp_host');
      const port = await getConfigValue('smtp_port');
      const user = await getConfigValue('smtp_user');
      const pass = await getConfigValue('smtp_password');
      const sender = await getConfigValue('smtp_sender');

      if (!host || !user || !pass) {
        return res.status(400).json({ ok: false, message: 'Configuração SMTP incompleta. Acesse as Configurações de E-mail antes.', emailError: true });
      }

      const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass }
      });

      await transporter.sendMail({
        from: `"${sender}" <${user}>`,
        to: emailTo,
        subject: `Exportação de XMLs - ${folder}`,
        text: `Olá!\n\nSegue em anexo o arquivo contendo todos os XMLs NFC-e da pasta: ${folder}.\n\nEnviado via AppBarCash.`,
        attachments: [
          {
            filename: `XMLs_${folder}.zip`,
            path: zipFilePath
          }
        ]
      });
      
      // Remove o ZIP para economizar espaço já que foi enviado por e-mail
      if (fs.existsSync(zipFilePath)) {
         fs.unlinkSync(zipFilePath);
      }
      
      res.json({ ok: true, message: 'Arquivo ZIP criado e enviado para o e-mail com sucesso!' });
    } else {
      // Se não enviou por e-mail, mantém o arquivo gerado na pasta temp do servidor e avisa o caminho
      res.json({ ok: true, message: `Arquivo ZIP criado com sucesso no servidor do sistema no caminho:\n\n${zipFilePath}` });
    }
  } catch (error) {
    console.error('Erro na exportação de XML:', error);
    res.status(500).json({ ok: false, message: 'Erro ao processar/enviar arquivos: ' + error.message });
  }
};
