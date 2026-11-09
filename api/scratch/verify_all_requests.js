import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';
import path from 'path';

const artifactDir = 'C:/Users/asus/.gemini/antigravity/brain/7c153c08-7ac3-4b60-8723-8f6df5f986bd';

async function verify() {
  console.log('🚀 Iniciando validação visual completa com Puppeteer...');

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

  // Login inicial
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok, usr) => {
    localStorage.setItem('userToken', tok);
    localStorage.setItem('authToken', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('userData', JSON.stringify(usr));
    localStorage.setItem('user', JSON.stringify(usr));
  }, token, userData);

  // 1. Desktop - Tela de Pedidos (Tablet / Bar) - CORRIGIDA
  console.log('📸 1. Capturando Tela de Pedidos (Bar)...');
  await page.goto('http://localhost:4000/tablet', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  const p1 = path.join(artifactDir, 'desktop_tablet_pedidos_fixed.png');
  await page.screenshot({ path: p1 });
  console.log('   Salvo:', p1);

  // 2. Mobile - Tela de Pedidos (Tablet / Bar)
  console.log('📸 2. Capturando Tela de Pedidos Mobile...');
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/tablet', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  const p2 = path.join(artifactDir, 'mobile_tablet_pedidos_fixed.png');
  await page.screenshot({ path: p2 });
  console.log('   Salvo:', p2);

  // 3. Desktop - Home Limpa com apenas os 5 atalhos
  console.log('📸 3. Capturando Home Desktop Limpa...');
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/(tabs)', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  const p3 = path.join(artifactDir, 'desktop_home_clean.png');
  await page.screenshot({ path: p3 });
  console.log('   Salvo:', p3);

  // 4. Desktop - Home com Menu Lateral Aberto
  console.log('📸 4. Abrindo Menu Lateral Retrátil no Desktop...');
  // Simular aproximação do mouse na borda esquerda (x=5, y=300)
  await page.mouse.move(5, 300);
  await new Promise(r => setTimeout(r, 500));
  // Ou clicar no botão do menu hambúrguer
  await page.evaluate(() => {
    const handle = document.querySelector('div[style*="border-top-right-radius"]') || document.querySelector('div[style*="z-index: 9998"]');
    if (handle) {
      handle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
    // Também podemos disparar o evento diretamente se necessário
    if (window.events) window.events.emit('sidebar:open');
  });
  await new Promise(r => setTimeout(r, 1000));
  const p4 = path.join(artifactDir, 'desktop_sidebar_menu_open.png');
  await page.screenshot({ path: p4 });
  console.log('   Salvo:', p4);

  // 5. Mobile - Home com 5 atalhos em destaque
  console.log('📸 5. Capturando Home Mobile...');
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/(tabs)', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  const p5 = path.join(artifactDir, 'mobile_home_clean.png');
  await page.screenshot({ path: p5 });
  console.log('   Salvo:', p5);

  // 6. Mobile - Menu Lateral Aberto no Celular
  console.log('📸 6. Abrindo Menu Lateral no Celular...');
  await page.evaluate(() => {
    // Tocar no botão hambúrguer
    const btns = Array.from(document.querySelectorAll('div[role="button"]'));
    const burger = btns.find(b => b.innerHTML.includes('menu') || b.innerHTML.includes('☰'));
    if (burger) {
      burger.click();
    } else {
      const handle = document.querySelector('div[style*="z-index: 9998"]');
      if (handle) handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  const p6 = path.join(artifactDir, 'mobile_sidebar_menu_open.png');
  await page.screenshot({ path: p6 });
  console.log('   Salvo:', p6);

  await browser.close();
  console.log('🎉 Validação e capturas concluídas com sucesso!');
}

verify().catch(err => {
  console.error('Erro na validação:', err);
  process.exit(1);
});
