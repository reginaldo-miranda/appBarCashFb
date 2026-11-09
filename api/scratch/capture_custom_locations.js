import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';
import path from 'path';

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const token = jwt.sign(
    { id: 1, name: 'Administrador', email: 'admin@bar.com', role: 'admin', admin: true },
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

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/login', { waitUntil: 'networkidle2' });

  // Injetar autenticação
  await page.evaluate((tok, usr) => {
    localStorage.setItem('userToken', tok);
    localStorage.setItem('authToken', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('userData', JSON.stringify(usr));
    localStorage.setItem('user', JSON.stringify(usr));
  }, token, userData);

  // 1. Desktop - Admin Produtos (com filtros de locais)
  await page.goto('http://localhost:4000/(tabs)/admin-produtos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  const p1 = path.join(artifactDir, 'desktop_admin_produtos_locais_custom.png');
  await page.screenshot({ path: p1 });
  console.log('📸 Salvo:', p1);

  // 2. Mobile - Admin Produtos
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/(tabs)/admin-produtos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  const p2 = path.join(artifactDir, 'mobile_admin_produtos_locais_custom.png');
  await page.screenshot({ path: p2 });
  console.log('📸 Salvo:', p2);

  // 3. Desktop - Transferência de Estoque
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/estoque/movimentacao?tab=transfer&productId=1', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  const p3 = path.join(artifactDir, 'desktop_estoque_transferencia_custom.png');
  await page.screenshot({ path: p3 });
  console.log('📸 Salvo:', p3);

  // 4. Mobile - Transferência de Estoque
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/estoque/movimentacao?tab=transfer&productId=1', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  const p4 = path.join(artifactDir, 'mobile_estoque_transferencia_custom.png');
  await page.screenshot({ path: p4 });
  console.log('📸 Salvo:', p4);

  // 5. Desktop - Importação XML (Aba XML)
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/estoque/movimentacao?tab=xml', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  const p5 = path.join(artifactDir, 'desktop_estoque_xml_custom.png');
  await page.screenshot({ path: p5 });
  console.log('📸 Salvo:', p5);

  await browser.close();
  console.log('🎉 Todas as screenshots salvas com sucesso!');
}

capture().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
