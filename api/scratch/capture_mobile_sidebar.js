import puppeteer from 'puppeteer';

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 869, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4000/(tabs)', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  // Find hamburger element
  const clicked = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const btn = divs.find(d => {
      const s = window.getComputedStyle(d);
      return (s.marginRight === '12px' || d.style.marginRight === '12px') && s.cursor === 'pointer';
    });
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (!clicked) {
    // Click on coordinate of hamburger icon in header
    await page.mouse.click(40, 36);
  }

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:/Users/asus/.gemini/antigravity/brain/7c153c08-7ac3-4b60-8723-8f6df5f986bd/mobile_sidebar_menu_open.png' });
  await browser.close();
  console.log('Mobile sidebar screenshot saved successfully!');
}

capture().catch(console.error);
