// XR path test with Meta's IWER emulator: enters an immersive session with tracked hands,
// checks recentering, then uses real hand-joint pinches to take a skewer to the grill and wave the fan.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const server = await createServer({ root, logLevel: 'error', server: { port: 5198 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let failed = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5198/?emulate=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SUYA_XR && !document.getElementById('enter').disabled, { timeout: 20000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.click('#enter');
  await page.waitForFunction(() => window.SUYA.renderer.xr.isPresenting, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const { game, input, world, renderer, THREE } = window.SUYA;
    const dev = window.SUYA_XR;
    const frames = (n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const out = {};
    await frames(40);
    out.handsSeen = input.handsSeen;
    const head = renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    out.recenterError = +world.position.distanceTo(head).toFixed(3);
    const hand = dev.hands.right;
    const ptr = () => input.xrPointers.find((p) => p.active && p.hand && p.hand === renderer.xr.getHand(input.sources.findIndex((s) => s && s.handedness === 'right')));
    // closed-loop: move the emulated hand until our pinch point is at a stall-local target
    const moveTo = async (local) => {
      for (let i = 0; i < 6; i++) {
        await frames(2);
        const p = ptr(); if (!p) return false;
        const diff = local.clone().sub(p.pos).applyQuaternion(world.quaternion);
        if (diff.length() < 0.004) return true;
        hand.position.x += diff.x; hand.position.y += diff.y; hand.position.z += diff.z;
      }
      return true;
    };
    const pinch = async (v) => { hand.updatePinchValue(v); await frames(12); };

    game.startNight(1);
    await frames(10);
    out.pointerFound = !!ptr();
    const k = game.kitchen;
    // pick beef from tray with a real pinch
    const tray = k.anchor('tray', 'beef'); tray.y += 0.03;
    await moveTo(tray); await pinch(1);
    out.pinching = ptr()?.pinching;
    out.holding = [...k.held.values()].map((h) => h.item.kind);
    const g = k.anchor('grill'); g.y += 0.05; g.z += 0.12;
    await moveTo(g); await pinch(0);
    out.onGrill = k.slots.filter(Boolean).length;
    // fan: pinch the woven fan and sweep it over the grill
    k.heat = 0.2;
    await moveTo(k.anchor('fan')); await pinch(1);
    out.fanHeld = [...k.held.values()].some((h) => h.item.kind === 'fan');
    const c = k.anchor('grill'); c.y += 0.12;
    for (let i = 0; i < 30; i++) { await moveTo(c.clone().add(new THREE.Vector3(i % 2 ? 0.12 : -0.12, 0, 0))); }
    await pinch(0);
    out.heatAfterFan = +k.heat.toFixed(2);
    return out;
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: path.join(root, 'tests/shot-xr.png') });
  const checks = [
    ['hand tracking detected', r.handsSeen],
    ['stall recentred on head', r.recenterError < 0.05],
    ['hand pinch grabs a skewer', r.holding && r.holding.includes('skewer')],
    ['release places it on the grill', r.onGrill === 1],
    ['hand pinch picks up the fan', r.fanHeld],
    ['waving the fan heats the coals', r.heatAfterFan > 0.3],
    ['no console errors', errors.length === 0],
  ];
  for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed = true; }
  if (errors.length) console.log('Errors:\n' + errors.join('\n'));
} catch (e) {
  console.error('XR test crashed:', e);
  if (errors.length) console.log('Errors:\n' + errors.join('\n'));
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
