import prisma from '../lib/prisma.js';
import nodemailer from 'nodemailer';
import { getTunnelStatus, startTunnel, stopTunnel } from '../services/TunnelService.js';

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
      const normalizedPassword = String(host || '').toLowerCase().includes('gmail')
        ? String(password).replace(/\s+/g, '')
        : password;
      await setConfigValue('smtp_password', normalizedPassword);
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

    if (String(host || '').toLowerCase().includes('gmail') && pwToUse) {
      pwToUse = String(pwToUse).replace(/\s+/g, '');
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
    const rawMsg = error?.message || '';
    if (
      error?.code === 'EAUTH' ||
      rawMsg.includes('534') ||
      rawMsg.includes('535') ||
      rawMsg.includes('Application-specific password required')
    ) {
      return res.status(400).json({
        ok: false,
        message:
          'O Gmail recusou a senha normal. Ative a Verificação em duas etapas na sua Conta Google, gere uma "Senha de App" (16 letras) e cadastre-a neste campo de Senha SMTP.'
      });
    }
    res.status(500).json({ ok: false, message: 'Falha ao conectar no servidor SMTP: ' + rawMsg });
  }
};

export const getCardapioIpConfig = async (req, res) => {
  try {
    const ip = await getConfigValue('cardapio_ip_fixo');
    res.json({ ok: true, ip });
  } catch (error) {
    console.error('Erro ao buscar IP fixo do cardápio:', error);
    res.status(500).json({ ok: false, message: 'Erro ao buscar configurações' });
  }
};

export const saveCardapioIpConfig = async (req, res) => {
  try {
    const { ip } = req.body;
    await setConfigValue('cardapio_ip_fixo', ip ? ip.trim() : '');
    res.json({ ok: true, message: 'IP do cardápio salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar IP do cardápio:', error);
    res.status(500).json({ ok: false, message: 'Erro ao salvar configurações' });
  }
};

export const getCardapioTunnelStatus = async (req, res) => {
  try {
    return res.json(getTunnelStatus());
  } catch (error) {
    return res.status(500).json({ ok: false, active: false, url: null, error: error.message });
  }
};

export const startCardapioTunnel = async (req, res) => {
  try {
    const status = await startTunnel(process.env.PORT || 4000);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ ok: false, active: false, url: null, error: error.message });
  }
};

export const stopCardapioTunnel = async (req, res) => {
  try {
    const status = stopTunnel();
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ ok: false, active: false, url: null, error: error.message });
  }
};


