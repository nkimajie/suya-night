// Demo autopilot: the game plays itself through the SAME Pointer path a player uses.
// Built for recording the trailer without a headset, and as an attract loop.
//   npm run dev, then /?emulate=1&demo=1  -> Meta's IWER Quest 3 emulator: real tracked-hand
//                                           models pinch, poke, fan and shake on screen.
//   /?demo=1 (any build, desktop)        -> scripted desktop pointer with a visible pinch dot.
// Add &night=N to start on a given night (the menu and story are skipped), or &scene=shop to buy
// every upgrade in turn (each one appears on the stall).
// Nothing in this file runs during normal play.
import * as THREE from 'three';
import { LAYOUT, CY, COOK } from './config.js';

const G = LAYOUT.grill;
const GRATE_Y = CY + G.h;
const SKEWER_Z = G.z + 0.03;
const HOT_SLOTS = 4;
const slotX = (i) => G.x - G.w / 2 + 0.045 + i * 0.05;
const SHAKES = { none: 0, normal: 3, plenty: 7 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const _d = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export function startDemo({ game, input, world, renderer, nextFrame, device = null, startNight = 0, scene = '' }) {
  const k = game.kitchen;
  const inXR = () => !!device && renderer.xr.isPresenting;
  const REST = { right: V(0.17, CY + 0.1, -0.3), left: V(-0.2, CY + 0.08, -0.28) };
  const hands = {
    right: { side: 'right', pos: REST.right.clone(), pinch: false, pv: 0, tip: false },
    left: { side: 'left', pos: REST.left.clone(), pinch: false, pv: 0, tip: false },
  };
  const look = V(0, CY + 0.08, -0.75);
  let running = true;
  let lastT = performance.now();

  // Desktop has no hand model, so show where the scripted pinch point is.
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
  dot.renderOrder = 20; dot.userData.noRay = true; dot.visible = false;
  world.add(dot);

  function pointerFor(side) {
    const i = input.sources.findIndex((s) => s && s.hand && s.handedness === side);
    if (i < 0) return null;
    const p = input.xrPointers[i];
    return p.active ? p : null;
  }

  // Runs once per rendered frame: moves the emulated hands (closed loop on the game's own
  // pinch point / fingertip) or the desktop pointer, and turns the emulated head a little
  // toward the action like a real player would.
  function drive(dt) {
    if (inXR()) {
      for (const h of Object.values(hands)) {
        const ih = device.hands[h.side];
        if (!ih) continue;
        h.pv += ((h.pinch ? 1 : 0) - h.pv) * Math.min(1, dt * 14);
        ih.updatePinchValue(h.pv > 0.97 ? 1 : h.pv < 0.03 ? 0 : h.pv);
        const p = pointerFor(h.side);
        if (!p) continue;
        _d.copy(h.pos).sub(h.tip ? p.tip : p.pos).applyQuaternion(world.quaternion);
        ih.position.x += _d.x; ih.position.y += _d.y; ih.position.z += _d.z;
      }
      // head: ease toward the look point (scaled down so it never stares or swings)
      const tw = world.localToWorld(look.clone());
      const hp = device.position;
      const dx = tw.x - hp.x, dy = tw.y - hp.y, dz = tw.z - hp.z;
      const yaw = Math.atan2(-dx, -dz) * 0.3, pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 0.75, -0.62, 0.05);
      _q.setFromEuler(_e.set(pitch, yaw, 0));
      const dq = device.quaternion;
      _q2.set(dq.x, dq.y, dq.z, dq.w).slerp(_q, Math.min(1, dt * 1.2));
      dq.set(_q2.x, _q2.y, _q2.z, _q2.w);
    } else {
      const h = hands.right;
      input.setScripted(h.pos, h.pinch);
      dot.visible = true;
      dot.position.copy(h.pos);
      dot.material.color.set(h.pinch ? 0xffc030 : 0xffffff);
    }
  }

  async function frame() {
    await nextFrame();
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (running) drive(dt);
  }
  async function wait(s) { const end = performance.now() + s * 1000; while (running && performance.now() < end) await frame(); }
  async function until(fn, maxS = 30) { const end = performance.now() + maxS * 1000; while (running && !fn() && performance.now() < end) await frame(); return fn(); }
  const handFor = (side) => (inXR() ? hands[side] : hands.right); // desktop: one pointer does everything

  // Smooth human-ish reach: eased, a little arc, ~0.6 m/s.
  async function moveTo(h, target, { speed = 0.6, arc = 0.03, min = 0.18 } = {}) {
    const from = h.pos.clone(), dist = from.distanceTo(target);
    const dur = min + dist / speed;
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
      h.pos.lerpVectors(from, target, ease(t));
      h.pos.y += Math.sin(t * Math.PI) * arc * Math.min(1, dist / 0.15);
      if (t >= 1 || !running) break;
      await frame();
    }
  }
  const heldKinds = () => [...k.held.values()].map((x) => x.item.kind);
  async function pinchAt(h, pos, hover = 0.04) {
    await moveTo(h, pos.clone().add(V(0, hover, 0)));
    await moveTo(h, pos, { speed: 0.35, arc: 0, min: 0.12 });
    h.pinch = true;
    await wait(0.22);
  }
  async function release(h) { h.pinch = false; await wait(0.2); }
  async function rest(h) { await moveTo(h, REST[inXR() ? h.side : 'right'], { speed: 0.5 }); }
  const lookAt = (x, y, z) => look.set(x, y, z);

  // ---------------------------------------------------------------- menus (poke like a player)
  async function press(btn) {
    const h = hands.right;
    const pos = world.worldToLocal(btn.group.getWorldPosition(new THREE.Vector3()));
    lookAt(pos.x, pos.y, pos.z);
    if (inXR()) {
      const nrm = btn.group.getWorldDirection(new THREE.Vector3()).applyQuaternion(world.quaternion.clone().invert());
      h.tip = true;
      await moveTo(h, pos.clone().addScaledVector(nrm, 0.06), { speed: 0.5 });
      await moveTo(h, pos.clone().addScaledVector(nrm, -0.02), { speed: 0.3, arc: 0, min: 0.15 });
      await wait(0.15);
      await moveTo(h, pos.clone().addScaledVector(nrm, 0.07), { speed: 0.4, arc: 0 });
      h.tip = false;
    } else {
      await moveTo(h, pos.clone().add(V(0, 0, 0.01)), { speed: 0.5 });
      h.pinch = true; await wait(0.12); h.pinch = false; await wait(0.12);
    }
  }
  const findBtn = (re) => game.board.buttons.find((b) => re.test(b.label));
  async function handleBoard() {
    const b = game.board;
    if (!b.group.visible || !b.buttons.length) { await wait(0.3); return; }
    const st = game.state;
    // give viewers time to read
    await wait(st === 'story' ? 3.2 : st === 'results' ? 4 : 2.2);
    if (game.board.buttons !== b.buttons || game.state !== st) return; // board changed while reading
    if (st === 'shop') {
      const sel = game.shopSel;
      const buy = findBtn(/^Buy/);
      if (sel && buy) { await press(buy); return; }
      const tile = b.tiles.find((t) => !/OWNED|Owned|✓/.test(t.sub || '') && /₦/.test(t.sub || '') && game.save.savings >= parseInt((t.sub || '').replace(/[^\d]/g, ''), 10));
      if (tile && (!sel || game.save.upgrades[sel])) { await press(tile); return; } // after a purchase the bought tile stays selected
      const done = findBtn(/^(Done|Back|Start)/) || b.buttons[b.buttons.length - 1];
      await press(done); return;
    }
    const want = findBtn(/^(Next|Continue|Start|New story|Night \d|Grow|Play|OK)/) || b.buttons[0];
    await press(want);
  }

  // ---------------------------------------------------------------- cooking
  async function ensureHeat(min = 0.5) {
    if (k.heat >= min) return;
    const h = handFor('left');
    lookAt(G.x, GRATE_Y, G.z);
    await pinchAt(h, k.anchor('fan'), 0.03);
    if (!heldKinds().includes('fan')) { await release(h); return; }
    const c = V(G.x, GRATE_Y + 0.1, G.z);
    await moveTo(h, c, { arc: 0.06 });
    const t0 = performance.now();
    while (running && k.heat < 0.92 && performance.now() - t0 < 4500) {
      const s = (performance.now() - t0) / 1000;
      h.pos.set(c.x + Math.sin(s * 15) * 0.09, c.y + Math.cos(s * 15) * 0.015, c.z);
      await frame();
    }
    await moveTo(h, k.anchor('fan').add(V(0, 0.05, 0)), { arc: 0.04 });
    await release(h);
    await rest(h);
  }

  const freeHotSlot = () => { for (let i = 0; i < HOT_SLOTS; i++) if (!k.slots[i]) return i; return -1; };
  async function placeSkewer(meat) {
    const slot = freeHotSlot();
    if (slot < 0) return null;
    const h = handFor('right');
    const tray = k.anchor('tray', meat); tray.y += 0.03;
    lookAt(tray.x, tray.y, tray.z);
    await pinchAt(h, tray);
    if (!heldKinds().includes('skewer')) { await release(h); return null; }
    lookAt(G.x, GRATE_Y, G.z);
    await moveTo(h, V(slotX(slot), GRATE_Y + 0.045, SKEWER_Z + 0.1), { arc: 0.06 });
    await release(h);
    return k.slots[slot] || null;
  }
  const handleOf = (s) => s.group.position.clone().add(V(0, 0.02, 0.1));
  async function flip(s) {
    const h = handFor('right');
    const at = handleOf(s);
    await pinchAt(h, at, 0.03);
    await moveTo(h, at.clone().add(V(0, 0.05, 0)), { speed: 0.4, arc: 0, min: 0.15 });
    await moveTo(h, at.clone().add(V(0, 0.01, 0)), { speed: 0.4, arc: 0, min: 0.12 });
    await release(h);
  }
  async function toPaper(s) {
    const h = handFor('right');
    await pinchAt(h, handleOf(s), 0.03);
    const paper = k.anchor('paper');
    lookAt(paper.x, paper.y, paper.z);
    await moveTo(h, paper.clone().add(V(0, 0.05, 0.1)), { arc: 0.07 });
    await release(h);
  }
  async function pepper(level) {
    const need = SHAKES[level] || 0;
    if (!need) return;
    const h = handFor('right');
    const sh = k.anchor('shaker'); sh.y += 0.06;
    await pinchAt(h, sh, 0.03);
    if (!heldKinds().includes('shaker')) { await release(h); return; }
    const over = k.anchor('paper').add(V(0, 0.18, 0));
    await moveTo(h, over, { arc: 0.04 });
    const t0 = performance.now();
    while (running && k.contents.shakes < need && performance.now() - t0 < 6000) {
      const s = (performance.now() - t0) / 1000;
      h.pos.set(over.x + Math.sin(s * 9) * 0.012, over.y + Math.sin(s * 19) * 0.05, over.z);
      await frame();
    }
    await moveTo(h, over.clone().add(V(-0.12, 0.08, 0.1)), { speed: 0.9, arc: 0, min: 0.1 });
    await release(h);
  }
  async function addSide(side) {
    const h = handFor('right');
    const b = k.anchor('bowl', side); b.y += 0.03;
    lookAt(b.x, b.y, b.z);
    await pinchAt(h, b);
    if (!heldKinds().includes('side')) { await release(h); return; }
    await moveTo(h, k.anchor('paper').add(V(0, 0.06, 0)), { arc: 0.05 });
    await release(h);
  }
  async function wrapAndServe(c) {
    const h = handFor('right');
    const pp = k.anchor('paper'); pp.y += 0.03;
    await pinchAt(h, pp, 0.03);
    await moveTo(h, pp.clone().add(V(0, 0.12, 0)), { speed: 0.4, arc: 0, min: 0.2 });
    if (!heldKinds().includes('package')) { await release(h); return false; }
    const hand = c.handLocal();
    lookAt(hand.x, hand.y + 0.25, hand.z);
    await moveTo(h, hand, { arc: 0.05, speed: 0.5 });
    await release(h);
    return true;
  }
  async function takePay(c) {
    const h = handFor('right');
    for (let tries = 0; tries < 3 && running; tries++) {
      if (!(await until(() => c.cash && c.state === 'paying', 5))) return;
      await wait(0.5);
      if (!c.cash) return;
      await pinchAt(h, c.cash.position.clone(), 0.03);
      await release(h);
      await wait(0.6);
      if (!c.cash || c.state !== 'paying') break;
    }
    if (c.state === 'shake') await handshake(c, h);
  }

  // Lagos handshake: draw the hand back, slap palms, pinch-snap as the hands part.
  async function handshake(c, h) {
    const hand = c.handLocal();
    await moveTo(h, hand.clone().add(V(0.02, 0.03, 0.2)), { speed: 0.7, arc: 0 });
    await wait(0.15);
    await moveTo(h, hand.clone().add(V(0, 0, 0.01)), { speed: 1.4, arc: 0, min: 0.1 });
    await wait(0.12);
    await moveTo(h, hand.clone().add(V(0.01, 0.02, 0.09)), { speed: 0.8, arc: 0, min: 0.08 });
    h.pinch = true; await wait(0.18);
    h.pinch = false; await wait(0.5);
  }

  async function serveCustomer(c) {
    const o = c.order;
    lookAt(c.handLocal().x, CY + 0.35, c.handLocal().z);
    await wait(1.2); // listen to the order
    await ensureHeat(0.55);
    const sticks = [];
    for (const m of o.meats) {
      if (!running) return;
      const s = await placeSkewer(m);
      if (s) sticks.push(s);
    }
    await rest(handFor('right'));
    const ready = (s, side) => s.cook[side] >= COOK.GOLDEN + 0.13;
    for (const pass of [0, 1]) {
      for (const s of sticks) {
        await until(() => { if (k.heat < 0.38 && !k.held.size) return true; return ready(s, s.down); }, 25);
        if (!ready(s, s.down)) { await ensureHeat(0.6); await until(() => ready(s, s.down), 25); }
        if (pass === 0 && s.state === 'grill') await flip(s);
      }
      if (pass === 0) await rest(handFor('right'));
    }
    for (const s of sticks) if (s.state === 'grill') await toPaper(s);
    await pepper(o.pepper);
    for (const side of o.sides) await addSide(side);
    if (c.state === 'waiting' && (await wrapAndServe(c))) await takePay(c);
    await rest(handFor('right'));
    lookAt(0, CY + 0.08, -0.75);
  }

  // ---------------------------------------------------------------- main loop
  (async () => {
    await until(() => !device || renderer.xr.isPresenting, 60);
    await wait(1.2); // let recentering settle before moving the head or hands
    if (scene === 'shop') {
      // trailer shot: buy every upgrade in turn and watch each one appear on the stall
      game.save.savings = Math.max(game.save.savings, 45000); game.save.act1Done = true; game.save.upgrades.sign = true;
      game.applyUpgrades();
      game.showShop(() => game.showMenu());
    } else if (startNight) game.startNight(startNight);
    for (;;) {
      if (!running) return;
      if (game.state === 'playing' && !game.paused) {
        const c = game.customers.find((x) => x.state === 'waiting');
        if (c) await serveCustomer(c);
        else { if (k.heat < 0.45) await ensureHeat(0.7); else await wait(0.25); }
      } else if (game.state === 'reveal') await wait(0.3);
      else await handleBoard();
    }
  })().catch((e) => console.warn('demo stopped', e));

  return { stop() { running = false; dot.visible = false; input.clearScripted?.(); } };
}
