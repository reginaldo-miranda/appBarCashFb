import prisma from '../lib/prisma.js';
import nodemailer from 'nodemailer';

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_sender'];

const getConfigValue = async (key) => {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting ? setting.value : '';
};

const setConfigValue = async (key, value) => {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
};

export const getSmtpConfig = async (req, res) => {
  try {
    const config = {};
    for (const key of SMTP_KEYS) {
      config[key.replace('smtp_', '')] = await getConfigValue(key);
    }
    
    // Obfuscate password for frontend
    if (config.password) {
      config.password = '**********'; 
    }

    res.json({ ok: true, data: config });
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error);
    res.status(500).json({ ok: false, message: 'Erro ao buscar configurações' });
  }
};

export const saveSmtpConfig = async (req, res) => {
  try {
    const { host, port, user, password, sender } = req.body;

    if (host !== undefined) await setConfigValue('smtp_host', host);
    if (port !== undefined) await setConfigValue('smtp_port', String(port));
    if (user !== undefined) await setConfigValue('smtp_user', user);
    if (sender !== undefined) await setConfigValue('smtp_sender', sender);
    
    // Only update password if it's not the obfuscated string and not empty
    if (password && password !== '**********') {
      await setConfigValue('smtp_password', password);
    }

    res.json({ ok: true, message: 'Configurações SMTP salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar configuração SMTP:', error);
    res.status(500).json({ ok: false, message: 'Erro ao salvar configurações' });
  }
};

export const testSmtpConnection = async (req, res) => {
  try {
    const { host, port, user, password, sender } = req.body;
    
    let pwToUse = password;
    
    // If password is obfuscated, fetch from DB
    if (password === '**********') {
        const storedPw = await getConfigValue('smtp_password');
        pwToUse = storedPw;
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: Number(port),
      secure: Number(port) === 465, // true for 465, false for other ports
      auth: {
        user: user,
        pass: pwToUse,
      },
    });

    const info = await transporter.sendMail({
      from: `"${sender}" <${user}>`, // sender address
      to: user, // send to themselves for testing
      subject: "Teste de Configuração SMTP - AppBarCash", // Subject line
      text: "Se você recebeu este e-mail, sua configuração SMTP está funcionando perfeitamente no AppBarCash.", // plain text body
      html: "<b>Se você recebeu este e-mail, sua configuração SMTP está funcionando perfeitamente no AppBarCash.</b>", // html body
    });

    res.json({ ok: true, message: 'E-mail de teste enviado com sucesso! Verifique a caixa de entrada de ' + user });
  } catch (error) {
    console.error('Erro ao testar conexão SMTP:', error);
    res.status(500).json({ ok: false, message: 'Falha ao conectar no servidor SMTP: ' + error.message });
  }
};
