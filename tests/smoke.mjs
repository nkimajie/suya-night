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

  // Business layer: shop (pointer), map, stars + savings, generator, loyalty, Act 1 -> Act 2, save migration, budget
  polling = true;
  const poller3 = (async () => {
    while (polling) {
      const req = await page.evaluate(() => window.__shotReq).catch(() => null);
      if (req) { await page.screenshot({ path: path.join(root, `tests/shot-${req}.png`) }); await page.evaluate(() => { window.__shotReq = null; }); }
      await sleep(60);
    }
  })();
  const biz = await page.evaluate(async () => {
    const { game, input, world, THREE, renderer } = window.SUYA;
    const frames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const shot = async (name) => { window.__shotReq = name; while (window.__shotReq) await new Promise((r) => setTimeout(r, 50)); };
    const press = async (btn) => {
      const p = btn.group.getWorldPosition(new THREE.Vector3()); world.worldToLocal(p); p.z += 0.01;
      input.setScripted(p, false); await frames(3); input.setScripted(p, true); await frames(3); input.setScripted(p, false); await frames(3);
    };
    const out = {};
    out.loyaltyAfterTutorial = game.save.loyalty.nkechi || 0;
    // shop: select a tile, then Buy, with the pointer
    game.save.savings = 20000; game.save.upgrades = {}; game.applyUpgrades();
    game.showShop(() => game.showMenu());
    await frames(3);
    await shot('shop');
    await press(game.board.tiles.find((t) => t.id === 'generator'));
    out.selected = game.shopSel;
    await press(game.board.buttons[0]);
    out.boughtGen = !!game.save.upgrades.generator;
    out.savingsAfterBuy = game.save.savings;
    out.revealState = game.state;
    await frames(10);
    await shot('reveal');
    for (let i = 0; i < 400 && game.state === 'reveal'; i++) await frames(1);
    out.backInShop = game.state === 'shop';
    // generator shortens the Night 6 blackout
    game.startNight(6); game.elapsed = 72; await frames(5);
    out.n6powerOff = game.env.power === false;
    game.elapsed = 78; await frames(5);
    out.n6genOn = game.env.power === true && game.env.genRunning === true;
    // stars + savings: a big night gives 3 stars and the extra goes into the tin
    game.startNight(4); await frames(3);
    const before = game.save.savings;
    game.money = game.target * 1.6; game.stars = [5, 5, 4]; game.served = 3;
    game.endNight(); await frames(3);
    out.n4stars = game.save.levels[4]?.stars;
    out.savedExtra = game.save.savings - before === game.money - game.target;
    out.resultsState = game.state;
    // map: Stage 2 page, press Night 4
    game.save.levels[3] = { stars: 1, best: 0 };
    game.showMap(2, () => game.showMenu()); await frames(3);
    await shot('map');
    await press(game.board.tiles.find((t) => t.id === 'night4'));
    out.mapToIntro = game.state === 'nightIntro';
    // Act 1 ending -> sign reward -> Act 2 story -> shop
    game.playEnding(); await frames(3);
    for (let i = 0; i < 8 && game.state === 'story'; i++) { game.board.buttons[0].onPress(); await frames(2); }
    out.act1Done = game.save.act1Done && !!game.save.upgrades.sign && game.state === 'ending';
    game.board.buttons[0].onPress(); await frames(2);
    for (let i = 0; i < 8 && game.state === 'story'; i++) { game.board.buttons[0].onPress(); await frames(2); }
    out.act2OpensShop = game.state === 'shop';
    // budget with every upgrade on Night 7 (rival sign) and two customers ordering
    for (const id of ['tin', 'lights', 'charcoal', 'fan', 'yaji', 'generator', 'sign']) game.save.upgrades[id] = true;
    game.startNight(7); game.elapsed = 40; await frames(5);
    for (let i = 0; i < 400 && game.customers.filter((c) => c.state === 'waiting').length < 2; i++) await frames(1);
    await frames(20);
    await shot('upgraded');
    renderer.info.autoReset = true; await frames(2);
    out.callsAllUpgrades = renderer.info.render.calls;
    let lights = 0; world.traverse((o) => { if (o.isLight && o.visible) lights++; });
    out.lights = lights;
    // save migration v1 -> v2
    const { migrateV1 } = await import('/src/save.js');
    const m = migrateV1({ unlocked: 3, tutorialDone: true, mode: 'rush', finished: false });
    out.migrated = m.v === 2 && m.levels[1].stars === 1 && m.levels[2].stars === 1 && !m.levels[3] && m.mode === 'rush' && m.tutorialDone;
    game.showMenu();
    return out;
  });
  polling = false; await poller3;
  console.log(JSON.stringify(biz));

  // Seated reach (two-foot rule) and GPU memory over many customers
  const qa = await page.evaluate(async () => {
    const { game, world, renderer, THREE } = window.SUYA;
    const frames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const k = game.kitchen;
    const far = [];
    const check = (name, v) => { const d = Math.hypot(v.x, v.z); if (d > 0.66 || v.y > 0.05) far.push(`${name} ${d.toFixed(2)}m y${v.y.toFixed(2)}`); };
    const wpos = (o) => world.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    for (const m of ['beef', 'ram', 'chicken', 'gizzard', 'kidney']) check('tray:' + m, k.anchor('tray', m));
    for (const sd of ['onions', 'cabbage', 'tomatoes', 'masa']) check('bowl:' + sd, k.anchor('bowl', sd));
    for (const n of ['grill', 'paper', 'shaker', 'fan']) check(n, k.anchor(n));
    check('pause', wpos(game.pauseBtn.group));
    game.showMenu(); await frames(2);
    for (const b of game.board.buttons) check('menu:' + b.label, wpos(b.group));
    game.save.savings = 99999; game.showShop(() => game.showMenu()); await frames(2);
    for (const b of [...game.board.tiles, ...game.board.buttons]) check('shop:' + b.label, wpos(b.group));
    // customers' hands (where you hand over the wrap and take the naira) in every slot
    game.save.tutorialDone = true;
    const hands = async (n) => {
      game.startNight(n); game.elapsed = 1;
      for (let i = 0; i < 900 && game.customers.filter((c) => c.state === 'waiting' && c.reach > 0.97).length < game.night.concurrent; i++) await frames(1);
      for (const c of game.customers.filter((x) => x.state === 'waiting')) check('hand:slot' + c.slot, c.handLocal());
      return game.customers.filter((x) => x.state === 'waiting').length;
    };
    const seen = (await hands(1)) + (await hands(4));
    // memory: 24 customers come, order, pay and leave; textures and geometries must not pile up
    game.startNight(5); game.closing = true; await frames(2);
    const cycle = async () => {
      game.spawn({}); const c = game.customers[game.customers.length - 1];
      c.group.position.x = c.x; await frames(3);
      c.stateT = 2; await frames(3);
      c.showCash(1000); await frames(2);
      c.collectCash(); c.state = 'gone'; await frames(2);
    };
    for (let i = 0; i < 4; i++) await cycle();
    const m0 = { ...renderer.info.memory };
    for (let i = 0; i < 24; i++) await cycle();
    const m1 = { ...renderer.info.memory };
    // regressions from QA: Pause -> Menu must not leave the stall frozen or the tutorial arrow up
    game.save.tutorialDone = false; game.startNight(1); await frames(5);
    game.pause(); await frames(2);
    game.board.buttons.find((b) => b.label === 'Menu').onPress(); await frames(3);
    const menuClean = !game.paused && !game.tutorial && !game.highlight.group.visible;
    // customers do not pay or leave while paused
    game.save.tutorialDone = true; game.startNight(4); game.elapsed = 1;
    for (let i = 0; i < 600 && !game.customers.some((c) => c.state === 'waiting'); i++) await frames(1);
    const cw = game.customers.find((c) => c.state === 'waiting');
    game.pause(); cw.receive({ score: 1, stars: 5, main: null, issues: {} }); await frames(90);
    const frozen = cw.state === 'judging' && game.money === 0;
    game.resume();
    // judge pass on a fresh save shows the Map
    const keep = game.save;
    game.save = { ...keep, levels: {}, allOpen: true };
    game.showMenu(); await frames(2);
    const judgeMap = game.board.buttons.some((b) => b.label === 'Map & shop');
    game.save = keep;
    // one-hand mode (Settings tile): the tutorial skips the fan step and the fire never runs low
    game.showSettings(); await frames(2);
    game.board.tiles.find((t) => t.id === 'onehand').onPress(); await frames(2);
    game.save.tutorialDone = false; game.startNight(1); await frames(5);
    const step = game.tutorial && game.tutorial.step;
    game.kitchen.heat = 0.1; await frames(30);
    const oneHand = game.save.oneHand && step === 1 && game.kitchen.heat >= 0.7;
    game.save.oneHand = false; game.applyUpgrades(); game.clearNight();
    game.showMenu();
    return { far, seen, m0, m1, menuClean, frozen, judgeMap, oneHand };
  });
  console.log(JSON.stringify(qa));

  const checks = [
    ['loyalty counts the tutorial serve', biz.loyaltyAfterTutorial === 1],
    ['shop tile selects by pointer', biz.selected === 'generator'],
    ['shop Buy spends savings', biz.boughtGen && biz.savingsAfterBuy === 8000],
    ['purchase reveal returns to shop', biz.revealState === 'reveal' && biz.backInShop],
    ['generator ends blackout early', biz.n6powerOff && biz.n6genOn],
    ['big night earns 3 stars', biz.n4stars === 3 && biz.resultsState === 'results'],
    ['extra money goes to savings', biz.savedExtra],
    ['map tile opens a night', biz.mapToIntro],
    ['Act 1 ending gives the new sign', biz.act1Done],
    ['Act 2 intro leads to the shop', biz.act2OpensShop],
    ['all upgrades stay under 150 draw calls', biz.callsAllUpgrades <= 150],
    ['no more than 4 lights', biz.lights <= 4],
    ['v1 save migrates', biz.migrated],
    ['everything you touch is within seated reach', qa.far.length === 0 && qa.seen >= 3],
    ['Pause -> Menu leaves nothing frozen or highlighted', qa.menuClean],
    ['customers wait while the game is paused', qa.frozen],
    ['"Open all nights" shows the Map on a fresh save', qa.judgeMap],
    ['one-hand mode: no fanning step, fire stays hot', qa.oneHand],
    ['no GPU memory growth over 24 customers', qa.m1.textures - qa.m0.textures <= 2 && qa.m1.geometries - qa.m0.geometries <= 4],
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
