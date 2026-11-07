// Headless smoke test: boots the game in Chrome, plays the Night 1 tutorial order through
// the scripted pointer (same code path as hands), and fails on any console error.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!CHROME) { console.error('No Chrome found; set CHROME_PATH'); process.exit(1); }

const server = await createServer({ root, logLevel: 'error', server: { port: 5199 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
let failed = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5199/' + (process.env.CAM ? '?cam=' + process.env.CAM : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.SUYA && window.SUYA.game, { timeout: 15000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await sleep(800);
  await page.screenshot({ path: path.join(root, 'tests/shot-menu.png') });

  // In-page code calls shot(name); this poller takes the screenshot and releases it.
  let polling = true;
  const poller = (async () => {
    while (polling) {
      const req = await page.evaluate(() => window.__shotReq).catch(() => null);
      if (req) { await page.screenshot({ path: path.join(root, `tests/shot-${req}.png`) }); await page.evaluate(() => { window.__shotReq = null; }); }
      await sleep(60);
    }
  })();
  const result = await page.evaluate(async () => {
    const shot = async (name) => { window.__shotReq = name; while (window.__shotReq) await new Promise((r) => setTimeout(r, 50)); };
    const { game, input, THREE } = window.SUYA;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const frames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = async (p, pinch, n = 2) => { input.setScripted(p, pinch); await frames(n); };
    const moveTo = async (from, to, pinch, steps = 10) => { for (let i = 1; i <= steps; i++) await set(from.clone().lerp(to, i / steps), pinch, 1); };
    const log = [];
    const k = game.kitchen;

    // 1) press the "New story" button with a pinch (UI path)
    const b = game.board.buttons[0];
    const bp = b.group.getWorldPosition(new THREE.Vector3()); window.SUYA.world.worldToLocal(bp); bp.z += 0.01;
    await set(bp, false, 3); await set(bp, true, 3); await set(bp, false, 3);
    log.push('state after New story: ' + game.state);
    if (game.state !== 'story') throw new Error('New story button did not start the intro');

    // 2) jump to night 1
    game.startNight(1);
    await frames(5);
    // wait for Mama Nkechi to arrive and order
    for (let i = 0; i < 400 && !game.customers.some((c) => c.state === 'waiting'); i++) await frames(1);
    await frames(20);
    await shot('customer');
    const cust = game.customers[0];
    log.push('customer: ' + cust.char.name + ' / ' + cust.state + ' / order ' + JSON.stringify(cust.order));

    // 3) fan the coals: a bare sweep must do nothing; the held fan must work
    const g = k.anchor('grill'); g.y += 0.06;
    k.heat = 0.3;
    for (let i = 0; i < 30; i++) await set(V(g.x + (i % 2 ? 0.12 : -0.12), g.y, g.z), false, 1);
    const bareHeat = k.heat;
    log.push('heat after bare sweep: ' + bareHeat.toFixed(2));
    const fa = k.anchor('fan');
    await set(fa, false, 2); await set(fa, true, 2);
    for (let i = 0; i < 40; i++) await set(V(g.x + (i % 2 ? 0.12 : -0.12), g.y, g.z), true, 1);
    await set(g, false, 3);
    log.push('heat after fanning with the fan: ' + k.heat.toFixed(2));
    window.__fanCheck = { bare: bareHeat <= 0.3, fan: k.heat > 0.8 };

    // 4) take beef from the tray, put on grill
    const tray = k.anchor('tray', 'beef'); tray.y += 0.03;
    await set(tray, false, 2); await set(tray, true, 2);
    const grillDrop = k.anchor('grill'); grillDrop.y += 0.05; grillDrop.z += 0.12; // hand at handle
    await moveTo(tray, grillDrop, true);
    await set(grillDrop, false, 2);
    const sk = k.slots.find(Boolean);
    if (!sk) throw new Error('skewer did not land on the grill');
    // cook side A quickly (test speed-up)
    sk.cook[sk.down] = 0.7; await frames(30);
    await shot('grill');
    // flip: pick up and put back
    const skp = sk.group.position.clone(); skp.z += 0.1; skp.y += 0.02;
    await set(skp, false, 2); await set(skp, true, 3); await set(skp, false, 3);
    log.push('down after flip: ' + sk.down + ' cook ' + sk.cook.map((c) => c.toFixed(2)));
    sk.cook[sk.down] = 0.7; await frames(2);

    // 5) to paper
    const sp = sk.group.position.clone(); sp.z += 0.1; sp.y += 0.02;
    const paper = k.anchor('paper'); paper.y += 0.05;
    await set(sp, false, 2); await set(sp, true, 2);
    await moveTo(sp, paper.clone().add(V(0, 0, 0.1)), true);
    await set(paper.clone().add(V(0, 0, 0.1)), false, 2);
    log.push('paper meats: ' + JSON.stringify(k.contents.meats.map((m) => m.type)));

    // 6) yaji: grab shaker, shake over paper 8 times
    const sh = k.anchor('shaker'); sh.y += 0.06;
    await set(sh, false, 2); await set(sh, true, 2);
    const over = paper.clone().add(V(0, 0.18, 0));
    await moveTo(sh, over, true);
    for (let i = 0; i < 18; i++) await set(over.clone().add(V(0, i % 2 ? 0.07 : -0.07, 0)), true, 2);
    await set(over, false, 3);
    log.push('shakes: ' + k.contents.shakes);

    // 7) onions
    const bowl = k.anchor('bowl', 'onions'); bowl.y += 0.03;
    await set(bowl, false, 2); await set(bowl, true, 2);
    await moveTo(bowl, paper, true); await set(paper, false, 2);
    log.push('sides: ' + JSON.stringify(k.contents.sides));
    await shot('paper');

    // 8) wrap: pinch paper and lift
    const pp = k.anchor('paper'); pp.y += 0.03;
    await set(pp, false, 2); await set(pp, true, 2);
    await moveTo(pp, pp.clone().add(V(0, 0.12, 0)), true, 6);
    const pkgHeld = [...k.held.values()].some((h) => h.item.kind === 'package');
    log.push('package held: ' + pkgHeld);

    // 9) serve to customer's hand
    const hand = cust.handLocal();
    await moveTo(pp.clone().add(V(0, 0.12, 0)), hand, true, 12);
    await set(hand, false, 3);
    for (let i = 0; i < 200 && cust.state !== 'paying' && cust.state !== 'leaving'; i++) await frames(1);
    await shot('served');
    log.push('customer after serve: ' + cust.state + ' stars ' + (cust.result && cust.result.stars) + ' main issue ' + (cust.result && cust.result.main));

    // 10) take the cash
    await frames(10);
    if (cust.cash) {
      const cp = cust.cash.position.clone();
      await set(cp, false, 2); await set(cp, true, 2); await set(cp, false, 2);
    }
    log.push('money: ' + game.money + ' tutorial: ' + (game.tutorial ? 'active step ' + game.tutorial.step : 'done'));
    input.clearScripted();
    return { log, fanCheck: window.__fanCheck, money: game.money, stars: cust.result && cust.result.stars, tutorialDone: !game.tutorial };
  });
  polling = false; await poller;
  console.log(result.log.join('\n'));
  await sleep(500);
  await page.screenshot({ path: path.join(root, 'tests/shot-play.png') });

  // Night 2 blackout + night 3 spawn sanity: fast-forward time
  polling = true;
  const poller2 = (async () => {
    while (polling) {
      const req = await page.evaluate(() => window.__shotReq).catch(() => null);
      if (req) { await page.screenshot({ path: path.join(root, `tests/shot-${req}.png`) }); await page.evaluate(() => { window.__shotReq = null; }); }
      await sleep(60);
    }
  })();
  const ff = await page.evaluate(async () => {
    const { game } = window.SUYA;
    const frames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    game.startNight(2);
    game.elapsed = 100; await frames(30);
    for (let i = 0; i < 300 && !game.customers.some((c) => c.state === 'waiting'); i++) await frames(1);
    window.__shotReq = 'blackout'; while (window.__shotReq) await new Promise((r) => setTimeout(r, 50));
    const power = game.env.power;
    game.elapsed = 170; await frames(10);
    const power2 = game.env.power;
    const n2 = game.customers.length;
    window.SUYA.renderer.info.autoReset = true; await frames(2);
    const calls = window.SUYA.renderer.info.render.calls, tris = window.SUYA.renderer.info.render.triangles;
    game.startNight(3);
    game.elapsed = 300; await frames(20);
    for (const c of game.customers) if (c.state === 'waiting') c.patience = 0;
    for (let i = 0; i < 300 && game.state === 'playing'; i++) await frames(1);
    return { blackoutPower: power, afterPower: power2, n2Customers: n2, stateAfterN3: game.state, drawCalls: calls, triangles: tris };
  });
  polling = false; await poller2;
  console.log(JSON.stringify(ff));
  await page.screenshot({ path: path.join(root, 'tests/shot-results.png') });

  const checks = [
    ['bare sweep does not fan', result.fanCheck.bare],
    ['held fan heats the coals', result.fanCheck.fan],
    ['tutorial order earned money', result.money > 0],
    ['perfect order got 5 stars', result.stars === 5],
    ['tutorial completed', result.tutorialDone],
    ['NEPA blackout turns power off', ff.blackoutPower === false],
    ['power returns after blackout', ff.afterPower === true],
    ['night 3 ends in results', ff.stateAfterN3 === 'results'],
    ['no console errors', errors.length === 0],
  ];
  for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed = true; }
  if (errors.length) console.log('Errors:\n' + errors.join('\n'));
} catch (e) {
  console.error('Test crashed:', e);
  if (errors.length) console.log('Errors:\n' + errors.join('\n'));
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
