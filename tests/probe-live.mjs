import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [], failed = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  await page.goto(process.argv[2], { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.SUYA && window.SUYA.game, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));
  const info = await page.evaluate(() => ({ state: window.SUYA.game.state, enter: document.getElementById('enter').textContent, shakes: typeof window.SUYA.game.updateShakes, quality: window.SUYA.quality?.level }));
  await page.screenshot({ path: process.argv[3] });
  console.log(JSON.stringify(info), 'errors:', errs, 'failed:', failed);
} finally { await browser.close(); }
