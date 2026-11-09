import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';
import path from 'path';

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Token de autenticação
  const token = jwt.sign(
    { id: 1, name: 'Administrador', email: 'admin@bar.com', role: 'admin' },
    process.env.JWT_SECRET || 'thunder'
  );

  const userData = {
    id: 1,
    name: 'Administrador',
    email: 'admin@bar.com',
    role: 'admin',
    tipo: 'admin',
    permissoes: { admin: true, produtos: true, estoque: true, caixa: true, mesas: true, comandas: true }
  };

  const artifactDir = 'C:/Users/asus/.gemini/antigravity/brain/7c153c08-7ac3-4b60-8723-8f6df5f986bd';

  // 1. Desktop - Movimentação / Transferência
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/login', { waitUntil: 'networkidle2' });

  // Injetar token no localStorage
  await page.evaluate((tok, usr) => {
    localStorage.setItem('userToken', tok);
    localStorage.setItem('authToken', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('userData', JSON.stringify(usr));
    localStorage.setItem('user', JSON.stringify(usr));
  }, token, userData);

  // Navegar para estoque/movimentacao com produto 1 pré-selecionado
  await page.goto('http://localhost:4000/estoque/movimentacao?tab=transfer&productId=1', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, 'desktop_estoque_transferencia.png') });
  console.log('📸 Screenshot desktop_estoque_transferencia.png gravada');

  // 2. Mobile - Movimentação / Transferência
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/estoque/movimentacao?tab=transfer&productId=1', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, 'mobile_estoque_transferencia.png') });
  console.log('📸 Screenshot mobile_estoque_transferencia.png gravada');

  // 3. Desktop - Admin Produtos (com saldos Depósito | Geladeira)
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/(tabs)/admin-produtos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, 'desktop_admin_produtos_locais.png') });
  console.log('📸 Screenshot desktop_admin_produtos_locais.png gravada');

  // 4. Mobile - Admin Produtos
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/(tabs)/admin-produtos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, 'mobile_admin_produtos_locais.png') });
  console.log('📸 Screenshot mobile_admin_produtos_locais.png gravada');

  await browser.close();
  console.log('🎉 Todas as screenshots foram capturadas com sucesso!');
}

takeScreenshots().catch(err => {
  console.error('Erro ao capturar screenshots:', err);
  process.exit(1);
});

