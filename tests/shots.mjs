// `npm run shots`: renders the README / Devpost gallery screenshots from inside Meta's IWER
// Quest 3 emulator (tracked-hand models, seated head view) while the demo autopilot plays,
// plus the social preview (public/og.png) and the app icons (public/icon-*.png).
// Output: docs/screenshots/*.png. Not part of `npm test`.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'docs/screenshots');
mkdirSync(OUT, { recursive: true });
const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const PORT = 5195;
const server = await createServer({ root, logLevel: 'error', server: { port: PORT } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const saved = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const snap = async (name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); saved.push(name); console.log('shot', name); };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const waitFor = async (fn, maxMs = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { if (await ev(fn).catch(() => false)) return true; await sleep(120); }
    console.log('  (timed out waiting)'); return false;
  };

  // ---------------------------------------------------------------- icons (rendered from public/icon.svg)
  const svg = readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
  await page.goto(`http://localhost:${PORT}/?clean=1`, { waitUntil: 'load' });
  for (const size of [192, 512]) {
    const b64 = await ev(async (src, s) => {
      const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(src); await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = s; c.getContext('2d').drawImage(img, 0, 0, s, s);
      return c.toDataURL('image/png').split(',')[1];
    }, svg, size);
    writeFileSync(path.join(root, `public/icon-${size}.png`), Buffer.from(b64, 'base64'));
  }

  // ---------------------------------------------------------------- headset session with the autopilot
  await page.goto(`http://localhost:${PORT}/?emulate=1&demo=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SUYA_XR && !document.getElementById('enter').disabled, { timeout: 20000 });
  await ev(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.SUYA_XR && !document.getElementById('enter').disabled, { timeout: 20000 });
  await page.click('#enter');
  await page.waitForFunction(() => window.SUYA.renderer.xr.isPresenting, { timeout: 15000 });
  await sleep(2500);
  await snap('01-menu');
  await waitFor(() => [...window.SUYA.game.kitchen.held.values()].some((h) => h.item.kind === 'fan') && window.SUYA.game.kitchen.heat > 0.6);
  await snap('03-fan-the-coals');
  await waitFor(() => window.SUYA.game.kitchen.slots.some((s) => s && s.cook[s.down] > 0.45));
  await snap('04-grill');
  await waitFor(() => [...window.SUYA.game.kitchen.held.values()].some((h) => h.item.kind === 'shaker') && window.SUYA.game.kitchen.contents.shakes >= 3);
  await snap('05-yaji-shake');
  await waitFor(() => [...window.SUYA.game.kitchen.held.values()].some((h) => h.item.kind === 'package'));
  await sleep(900);
  await snap('06-serve');
  await waitFor(() => window.SUYA.game.money > 0);
  await sleep(250);
  await snap('07-paid');

  // Night 2: NEPA takes light while the autopilot keeps cooking
  await ev(() => { window.SUYA.game.startNight(2); window.SUYA.game.elapsed = 92; });
  await waitFor(() => !window.SUYA.game.env.power && window.SUYA.game.kitchen.slots.some((s) => s && s.cook[s.down] > 0.3), 90000);
  await sleep(600);
  await snap('08-blackout');

  // Stop the autopilot; stage the story and business screens directly
  await ev(() => { window.SUYA_DEMO.stop(); const q = window.SUYA_XR.quaternion; const t = -0.12; q.set(Math.sin(t / 2), 0, 0, Math.cos(t / 2)); }); // look ahead again
  await ev(async () => { const { INTRO } = await import('/src/story.js'); const g = window.SUYA.game; g.clearNight(); g.hideHud(); g.playStory([INTRO[1]], () => g.showMenu()); });
  await sleep(1500);
  await snap('02-story-landlord');
  await ev(() => {
    const g = window.SUYA.game;
    g.save.levels = { 1: { stars: 3, best: 0 }, 2: { stars: 2, best: 0 }, 3: { stars: 1, best: 0 } };
    g.save.act1Done = true; g.save.upgrades = { sign: true, tin: true }; g.save.savings = 16500; g.save.shopSeen = true;
    g.applyUpgrades();
    g.setActor(null);
    g.showShop(() => g.showMenu(), 'generator');
  });
  await sleep(1200);
  await snap('09-shop');
  await ev(() => { const g = window.SUYA.game; g.showMap(2, () => g.showMenu()); });
  await sleep(1000);
  await snap('10-map');
  await ev(() => {
    const g = window.SUYA.game;
    for (const id of ['tin', 'lights', 'charcoal', 'fan', 'yaji', 'generator', 'sign']) g.save.upgrades[id] = true;
    g.save.loyalty = { nkechi: 6, adebayo: 3 };
    g.startNight(7); g.elapsed = 1;
  });
  await waitFor(() => window.SUYA.game.customers.some((c) => c.state === 'waiting'), 30000);
  await sleep(1500);
  await snap('11-grown-stall');
  await ev(() => { const g = window.SUYA.game; g.startNight(4); g.money = g.target * 1.62; g.stars = [5, 5, 4, 5]; g.served = 4; g.bestCombo = 3; g.endNight(); });
  await sleep(1800);
  await snap('12-results');

  // ---------------------------------------------------------------- social preview 1200x630, cropped from the serve shot
  const src = readFileSync(path.join(OUT, '06-serve.png')).toString('base64');
  const og = await ev(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const x = c.getContext('2d');
    const sh = img.width * 630 / 1200; x.drawImage(img, 0, (img.height - sh) / 2, img.width, sh, 0, 0, 1200, 630);
    const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, 'rgba(10,5,2,0.85)'); g.addColorStop(1, 'rgba(10,5,2,0)');
    x.fillStyle = g; x.fillRect(0, 0, 1200, 200);
    x.font = '900 76px system-ui, sans-serif'; x.fillStyle = '#ffb347'; x.textAlign = 'center'; x.fillText('SUYA NIGHT', 600, 92);
    x.font = '600 28px system-ui, sans-serif'; x.fillStyle = '#fff3d6'; x.fillText('A hands-only VR cooking story from Lagos', 600, 138);
    return c.toDataURL('image/png').split(',')[1];
  }, src);
  writeFileSync(path.join(root, 'public/og.png'), Buffer.from(og, 'base64'));
  console.log('wrote public/og.png and public/icon-192/512.png');

  // ---------------------------------------------------------------- Devpost gallery: 3:2, 1500x1000, captioned
  const GAL = path.join(root, 'docs/gallery');
  mkdirSync(GAL, { recursive: true });
  const gallery = [
    ['06-serve', '1-hand-it-over', 'Hand the wrap to the customer — then pinch the naira from her hand'],
    ['03-fan-the-coals', '2-fan-the-coals', 'Pinch the woven fan and wave it: the coals flare and the embers fly'],
    ['05-yaji-shake', '3-shake-the-yaji', 'Shake the yaji: 1–5 shakes = normal, 6+ = PLENTY pepper'],
    ['08-blackout', '4-nepa-blackout', 'NEPA takes the light: cook by lantern while the queue waits'],
    ['11-grown-stall', '5-grow-the-stall', 'Grow the business: every upgrade you buy appears on your stall'],
    ['09-shop', '6-papas-savings', 'Rent first, the rest na your own: spend Papa’s savings in the shop'],
    ['02-story-landlord', '7-the-landlord', 'Three nights to save Papa’s stall from Chief Adebayo'],
  ];
  for (const [from, name, caption] of gallery) {
    const b64 = readFileSync(path.join(OUT, from + '.png')).toString('base64');
    const out = await ev(async (src, cap) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
      const c = document.createElement('canvas'); c.width = 1500; c.height = 1000;
      const x = c.getContext('2d');
      const sw = img.height * 1.5; x.drawImage(img, (img.width - sw) / 2, 0, sw, img.height, 0, 0, 1500, 1000);
      const g = x.createLinearGradient(0, 820, 0, 1000); g.addColorStop(0, 'rgba(10,5,2,0)'); g.addColorStop(1, 'rgba(10,5,2,0.9)');
      x.fillStyle = g; x.fillRect(0, 820, 1500, 180);
      x.font = '800 40px system-ui, sans-serif'; x.fillStyle = '#fff3d6'; x.fillText(cap, 48, 958);
      x.fillStyle = 'rgba(18,9,5,0.82)'; x.beginPath(); x.roundRect(1236, 26, 238, 52, 26); x.fill();
      x.font = '900 26px system-ui, sans-serif'; x.fillStyle = '#ffb347'; x.textAlign = 'center'; x.fillText('SUYA NIGHT', 1355, 62);
      return c.toDataURL('image/png').split(',')[1];
    }, b64, caption);
    writeFileSync(path.join(GAL, name + '.png'), Buffer.from(out, 'base64'));
  }
  console.log('wrote docs/gallery/*.png (3:2 for Devpost)');
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await server.close();
}
console.log(`${saved.length} screenshots in docs/screenshots/`);
