import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CY, LAYOUT, MEATS, SIDES, PEPPER_LABEL, naira } from './config.js';
import { FLOOR_Y } from './env.js';
import { makePanel, FONT, roundRect, wrapText, countLines, fitFont } from './text.js';
import { audio } from './audio.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const _hv = new THREE.Vector3(), _tgt = new THREE.Vector3(), CASH_OFF = new THREE.Vector3(0, 0.03, 0.02);

// Free everything a throwaway object owns on the GPU: geometries, materials and canvas textures.
export function disposeDeep(o) {
  if (!o) return;
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { if (!mat) continue; mat.map?.dispose(); mat.dispose(); }
  });
}

// ---------------------------------------------------------------- model
export function buildPerson(look) {
  const g = new THREE.Group();
  const H = look.height || 1.72, W = look.build || 1;
  const skin = lambert(look.skin || 0x6b4226);
  const top = lambert(look.top || 0x2a6fb0);
  const bottom = lambert(look.bottom || 0x222831);
  const parts = {};

  const legH = H * 0.47;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.07 * W, legH, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 * W, legH, 0.11), bottom); m.position.y = -legH / 2; leg.add(m);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1 * W, 0.05, 0.16), lambert(0x1a1410)); shoe.position.set(0, -legH + 0.025, 0.025); leg.add(shoe);
    g.add(leg); parts[s < 0 ? 'legL' : 'legR'] = leg;
  }
  const torsoH = H * 0.33;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * W, 0.15 * W, torsoH, 12), top);
  torso.position.y = legH + torsoH / 2; torso.scale.z = 0.7; g.add(torso);
  if (look.robe) {
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * W, 0.28 * W, legH + torsoH * 0.9, 14), top);
    robe.position.y = (legH + torsoH * 0.9) / 2 + 0.04; robe.scale.z = 0.75; g.add(robe);
    if (look.robeTrim) { const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 10), lambert(look.robeTrim)); trim.position.set(0, legH + torsoH * 0.55, 0.11 * W); trim.scale.z = 0.3; g.add(trim); }
  }
  const shoulderY = legH + torsoH - 0.03;
  const armLen = 0.56;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.2 * W, shoulderY, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.075, armLen * 0.55, 0.08), look.robe ? top : top); sleeve.position.y = -armLen * 0.27; arm.add(sleeve);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.06, armLen * 0.45, 0.065), look.longSleeve ? top : skin); fore.position.y = -armLen * 0.77; arm.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skin); hand.position.y = -armLen; hand.scale.set(1, 0.7, 1.2); arm.add(hand);
    g.add(arm);
    parts[s < 0 ? 'armL' : 'armR'] = arm;
    parts[s < 0 ? 'handL' : 'handR'] = hand;
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 8), skin); neck.position.y = legH + torsoH + 0.03; g.add(neck);
  const head = new THREE.Group(); head.position.y = legH + torsoH + 0.15; g.add(head); parts.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), skin); skull.scale.set(0.95, 1.08, 1); head.add(skull);
  const eyeMat = lambert(0x0d0805);
  const white = lambert(0xf2eee8);
  for (const s of [-1, 1]) {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), white); ew.position.set(s * 0.035, 0.015, 0.088); ew.scale.z = 0.5; head.add(ew);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), eyeMat); e.position.set(s * 0.035, 0.015, 0.097); head.add(e);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.007, 0.01), eyeMat); brow.position.set(s * 0.035, 0.045, 0.093); head.add(brow);
    parts[s < 0 ? 'browL' : 'browR'] = brow;
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), lambert(0x5a1a14)); mouth.position.set(0, -0.045, 0.094); head.add(mouth);
  parts.mouth = mouth;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), skin); nose.position.set(0, -0.008, 0.1); nose.scale.set(1.2, 0.8, 0.8); head.add(nose);

  // headwear / accessories
  const hc = lambert(look.hatColor || 0x111111);
  switch (look.hat) {
    case 'gele': {
      // gele: wrapped bands rising into a fanned, pleated crown
      const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc); wrap.position.y = 0.02; head.add(wrap);
      [[0.1, 0.06, 0, 0.0], [0.105, 0.11, 0.22, 0.05], [0.095, 0.155, -0.18, 0.1]].forEach(([r, y, tilt, rx]) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.026, 6, 18), hc);
        band.position.y = y; band.rotation.set(Math.PI / 2 + rx, tilt, 0); band.scale.set(1.15, 1, 0.8); head.add(band);
      });
      const fanG = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.05, 0.11, 10, 1, false, -0.6, Math.PI + 1.2), hc);
      fanG.position.set(0, 0.2, -0.04); fanG.rotation.x = -0.35; fanG.scale.set(1, 1, 0.45); head.add(fanG);
      break;
    }
    case 'cap': {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.104, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), hc); crown.position.y = 0.03; head.add(crown);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.01, 0.09), hc); brim.position.set(0, 0.05, 0.12); brim.rotation.x = 0.15; head.add(brim);
      break;
    }
    case 'fila': {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.09, 14), hc); f.position.set(0, 0.1, 0); f.rotation.z = 0.25; head.add(f);
      break;
    }
    case 'kufi': {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.103, 0.06, 14), hc); f.position.set(0, 0.08, 0); head.add(f);
      break;
    }
    case 'hijab': {
      const hj = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 10), hc); hj.scale.set(1, 1.12, 1.02); hj.position.set(0, 0.0, -0.012); head.add(hj);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), skin); face.position.z = 0.012; face.scale.set(0.82, 0.92, 0.95); head.add(face);
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.22, 14), hc); drape.position.y = -0.17; head.add(drape);
      break;
    }
    case 'short': {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.103, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), lambert(0x0a0806)); hair.position.y = 0.012; head.add(hair);
      break;
    }
  }
  if (look.glasses) {
    const gm = lambert(0x050505);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.008), gm); l.position.set(s * 0.036, 0.015, 0.103); head.add(l); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), gm); br.position.set(0, 0.02, 0.104); head.add(br);
  }
  if (look.chain) {
    const ch = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16), lambert(0xffcc33, { emissive: 0x332200 })); ch.position.set(0, legH + torsoH - 0.06, 0.09); ch.rotation.x = 1.2; g.add(ch);
  }
  if (look.tie) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.01), lambert(look.tie)); t.position.set(0, legH + torsoH - 0.12, 0.112); g.add(t);
  }
  if (look.phone) {
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.075, 0.008), lambert(0x111111, { emissive: 0x223355 })); ph.position.set(0, -armLen - 0.02, 0.04); parts.armL.add(ph);
  }
  if (look.badge) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.005), lambert(0x1a6a2a)); b.position.set(0.08, legH + torsoH - 0.08, 0.105); g.add(b);
  }
  bakePerson(g, parts);
  g.traverse((o) => { o.userData.noRay = true; });
  return { group: g, parts, shoulderY, armLen };
}

// Draw-call saver: merge each rigid body part (body, legs, arms, head) into one
// vertex-coloured mesh. A person goes from ~25 draw calls to ~9. The mouth and brows stay
// separate (they animate with mood) and the hands become empty markers for the IK target.
function bakePerson(g, parts) {
  const keep = new Set([parts.mouth, parts.browL, parts.browR]);
  for (const k of ['handL', 'handR']) {
    const h = parts[k], m = new THREE.Object3D();
    m.position.copy(h.position); h.parent.add(m); parts[k] = m;
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const node of [g, parts.legL, parts.legR, parts.armL, parts.armR, parts.head]) {
    const geos = [];
    for (const ch of node.children.slice()) {
      if (!ch.isMesh || keep.has(ch)) continue;
      ch.updateMatrix();
      let geo = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      geo.applyMatrix4(ch.matrix);
      for (const a of Object.keys(geo.attributes)) if (a !== 'position' && a !== 'normal') geo.deleteAttribute(a);
      const c = ch.material.color, n = geo.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(geo);
      node.remove(ch); ch.geometry.dispose();
    }
    if (geos.length) node.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }
}

// ---------------------------------------------------------------- order helpers
export function orderSentence(order) {
  const counts = {};
  for (const m of order.meats) counts[m] = (counts[m] || 0) + 1;
  const meatBits = Object.entries(counts).map(([m, n]) => (n > 1 ? `${n} sticks of ${MEATS[m].name.toLowerCase()}` : MEATS[m].name.toLowerCase()));
  const meatStr = joinAnd(meatBits);
  const pep = order.pepper === 'none' ? 'no pepper' : order.pepper === 'plenty' ? 'plenty pepper' : 'normal pepper';
  const sides = order.sides.length ? 'with ' + joinAnd(order.sides.map((s) => SIDES[s].name.toLowerCase())) : 'no sides';
  return cap(`${meatStr}, ${pep}, ${sides}.`);
}
const joinAnd = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function orderPrice(order) {
  return order.meats.reduce((s, m) => s + MEATS[m].price, 0) + order.sides.reduce((s, x) => s + SIDES[x].price, 0);
}

// ---------------------------------------------------------------- Customer
export class Customer {
  constructor(world, char, order, slotIndex, opts) {
    this.world = world;
    this.char = char;
    this.order = order;
    this.slot = slotIndex;
    this.price = orderPrice(order);
    this.patienceMax = opts.patience * (char.patience || 1);
    this.patience = this.patienceMax;
    this.infinite = !!opts.infinite;
    this.tag = opts.tag || 0; // loyalty tier: 1 friend, 2 family
    this.state = 'arriving';
    this.t = 0;
    this.stateT = 0;
    this.result = null;
    this.cash = null;
    this.cashT = 0;

    const person = buildPerson(char.look);
    this.person = person;
    this.group = new THREE.Group();
    this.group.add(person.group);
    this.x = LAYOUT.slots[slotIndex];
    this.serveArm = this.x > 0.01 ? person.parts.armL : person.parts.armR;
    this.fromX = this.x < 0 || (this.x === 0 && Math.random() < 0.5) ? -2.4 : 2.4;
    this.group.position.set(this.fromX, FLOOR_Y, LAYOUT.customerZ - 0.35);
    world.add(this.group);

    // speech bubble
    this.bubble = makePanel(0.3, 0.13, { pxPerM: 1500 });
    this.bubble.renderOrder = 4;
    this.bubble.visible = false;
    this.bubble.userData.noRay = true;
    world.add(this.bubble);
    // order card (hovering over the counter edge)
    this.card = makePanel(0.2, 0.15, { pxPerM: 1500 });
    this.card.visible = false;
    this.card.userData.noRay = true;
    this.card.renderOrder = 3;
    world.add(this.card);
    this.cardDrawnPatience = -1;
  }

  get handWorld() { return (this.serveArm === this.person.parts.armR ? this.person.parts.handR : this.person.parts.handL).getWorldPosition(new THREE.Vector3()); }
  handLocal(out = new THREE.Vector3()) {
    (this.serveArm === this.person.parts.armR ? this.person.parts.handR : this.person.parts.handL).getWorldPosition(out);
    return this.world.worldToLocal(out);
  }

  say(text, kind = 'talk') {
    this.bubbleText = text;
    this.bubble.visible = true;
    this.bubbleT = 0;
    const name = this.char.name;
    const border = kind === 'happy' ? '#3fbf5f' : kind === 'angry' ? '#e0443a' : '#ffb347';
    this.bubble.redraw((c, w, h) => {
      c.font = FONT(h * 0.17, 600);
      roundRect(c, 4, 4, w - 8, h - 8, h * 0.12); c.fillStyle = 'rgba(255,250,240,0.96)'; c.fill();
      c.lineWidth = 6; c.strokeStyle = border; c.stroke();
      c.fillStyle = '#7a3a10'; c.font = FONT(h * 0.13, 800); c.textAlign = 'left'; c.fillText(name.toUpperCase(), w * 0.04, h * 0.2);
      c.fillStyle = '#1a120c';
      let fs = h * 0.15;
      for (; fs > h * 0.08; fs *= 0.92) { c.font = FONT(fs, 600); if (countLines(c, text, w * 0.92) * fs * 1.18 <= h * 0.66) break; }
      wrapText(c, text, w * 0.04, h * 0.27 + fs, w * 0.92, fs * 1.18);
    });
    audio.say(text, this.char.voice || {});
  }

  drawCard() {
    const o = this.order;
    const pf = this.infinite ? 1 : Math.max(0, this.patience / this.patienceMax);
    this.cardDrawnPatience = Math.round(pf * 40);
    this.card.redraw((c, w, h) => {
      roundRect(c, 3, 3, w - 6, h - 6, 16); c.fillStyle = 'rgba(250,244,228,0.97)'; c.fill();
      c.lineWidth = 5; c.strokeStyle = '#3a2412'; c.stroke();
      c.fillStyle = '#7a3a10'; c.textAlign = 'left';
      const nm = this.char.name.toUpperCase() + (this.tag ? (this.tag === 2 ? ' ♥♥' : ' ♥') : '');
      fitFont(c, nm, w * 0.62, h * 0.085, 800); c.fillText(nm, w * 0.05, h * 0.12);
      c.font = FONT(h * 0.085, 800);
      c.textAlign = 'right'; c.fillStyle = '#1a6a2a'; c.fillText(naira(this.price), w * 0.95, h * 0.12);
      let y = h * 0.26;
      c.textAlign = 'left';
      const counts = {};
      for (const m of o.meats) counts[m] = (counts[m] || 0) + 1;
      for (const [m, n] of Object.entries(counts)) {
        c.fillStyle = '#' + new THREE.Color(MEATS[m].cooked).getHexString(); c.beginPath(); c.arc(w * 0.08, y - h * 0.03, h * 0.03, 0, 7); c.fill();
        c.fillStyle = '#1a120c'; c.font = FONT(h * 0.1, 800); c.fillText(`${n > 1 ? n + ' × ' : ''}${MEATS[m].name}`, w * 0.13, y);
        y += h * 0.12;
      }
      c.font = FONT(h * 0.09, 800);
      c.fillStyle = o.pepper === 'none' ? '#555' : o.pepper === 'plenty' ? '#c41a0a' : '#c86a10';
      c.fillText(PEPPER_LABEL[o.pepper] + (o.pepper === 'plenty' ? '  ★★' : o.pepper === 'normal' ? '  ★' : ''), w * 0.05, y); y += h * 0.115;
      c.fillStyle = '#2a4a1a';
      const sidesLine = o.sides.length ? '+ ' + o.sides.map((s) => SIDES[s].name).join(', ') : 'No sides';
      fitFont(c, sidesLine, w * 0.9, h * 0.085, 700); c.fillText(sidesLine, w * 0.05, y);
      // patience bar
      const bx = w * 0.05, by = h * 0.86, bw = w * 0.9, bh = h * 0.07;
      c.fillStyle = '#d8cdb8'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = pf > 0.5 ? '#3fae4f' : pf > 0.25 ? '#e0a020' : '#d63a2a';
      c.fillRect(bx, by, bw * pf, bh);
    });
  }

  // Called each frame. head = player head position in stall-local coords.
  update(dt, head, paused) {
    this.t += dt;
    this.stateT += dt;
    const P = this.person.parts;
    const g = this.group;
    const targetPos = _v.set(this.x, FLOOR_Y, LAYOUT.customerZ);
    let walking = false;

    switch (this.state) {
      case 'arriving': {
        const d = targetPos.x - g.position.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), dt * 1.6);
        g.position.x += step;
        g.position.z += (LAYOUT.customerZ - g.position.z) * Math.min(1, dt * 1.5);
        g.rotation.y = Math.sign(d) * Math.PI / 2 * Math.min(1, Math.abs(d) * 2);
        walking = Math.abs(d) > 0.01;
        if (!walking) { g.position.copy(targetPos); g.rotation.y = 0; this.state = 'ordering'; this.stateT = 0; this.say(this.char.greet ? this.char.greet(this.order) : orderSentence(this.order)); }
        break;
      }
      case 'ordering':
        if (this.stateT > 1.0) { this.state = 'waiting'; this.stateT = 0; this.card.visible = true; this.drawCard(); }
        break;
      case 'waiting': {
        if (!paused && !this.infinite) this.patience -= dt;
        const pf = this.patience / this.patienceMax;
        if (Math.round(Math.max(0, pf) * 40) !== this.cardDrawnPatience) this.drawCard();
        if (pf < 0.25 && !this.warned) { this.warned = true; this.say(this.char.hurry || 'Oga, abeg hurry up!', 'angry'); }
        if (this.patience <= 0) this.onTimeout();
        break;
      }
      case 'judging':
        if (this.stateT > 1.1) this.onJudged();
        break;
      case 'paying':
        this.cashT += dt;
        if (this.cash) this.handLocal(this.cash.position).add(CASH_OFF);
        if (this.cashT > 9 && this.cash) this.onCashTimeout();
        break;
      case 'leaving': {
        const dir = this.fromX;
        g.rotation.y = Math.sign(dir) * Math.PI / 2;
        g.position.x += Math.sign(dir) * dt * 1.7;
        walking = true;
        if (Math.abs(g.position.x) > 2.6) { this.state = 'gone'; }
        break;
      }
    }

    // serving arm reaches toward a point over the counter, nearer the player's centre
    const reach = this.state === 'waiting' || this.state === 'paying' ? 1 : this.state === 'judging' ? 0.5 : 0;
    this.reach = THREE.MathUtils.lerp(this.reach || 0, reach, Math.min(1, dt * 4));
    const arm = this.serveArm;
    const W = this.char.look.build || 1;
    const sx = this.x + (arm === P.armR ? 0.2 : -0.2) * W;
    const tgt = _tgt.set(this.x * 0.45 - sx, CY + 0.17 - (FLOOR_Y + this.person.shoulderY), LAYOUT.handZ - LAYOUT.customerZ).normalize();
    _q.setFromUnitVectors(DOWN, tgt);

    // walking cycle / idle
    const swing = walking ? Math.sin(this.t * 9) * 0.5 : 0;
    P.legL.rotation.x = swing; P.legR.rotation.x = -swing;
    const other = arm === P.armR ? P.armL : P.armR;
    const sgn = (a) => (a === P.armR ? 1 : -1);
    other.rotation.set(sgn(other) * swing * 0.6 + (other === P.armL && this.char.look.phone && !walking ? -1.1 : 0), 0, 0);
    if (this.reach < 0.02) arm.rotation.set(sgn(arm) * swing * 0.6, 0, 0);
    else arm.quaternion.slerpQuaternions(_q0, _q, this.reach);
    this.person.group.position.y = walking ? Math.abs(Math.sin(this.t * 9)) * 0.02 : Math.sin(this.t * 1.5) * 0.004;

    // face
    const mood = this.mood || 'neutral';
    P.mouth.scale.y = mood === 'happy' ? 2.2 : mood === 'angry' ? 0.8 : 1;
    P.mouth.scale.x = mood === 'happy' ? 1.3 : mood === 'angry' ? 0.8 : 1;
    P.browL.rotation.z = mood === 'angry' ? -0.4 : 0; P.browR.rotation.z = mood === 'angry' ? 0.4 : 0;
    P.head.rotation.y = mood === 'angry' && this.stateT < 1 ? Math.sin(this.t * 25) * 0.15 : Math.sin(this.t * 0.7) * 0.08;
    if (this.state === 'judging') P.head.rotation.x = 0.35; else P.head.rotation.x *= 0.9;
    if (mood === 'happy' && this.stateT < 0.6) this.person.group.position.y += Math.abs(Math.sin(this.stateT * 10)) * 0.04;

    // bubble floats in front of the customer's chest (comfortable eye level), facing the player
    this.bubble.position.set(g.position.x, 0.03, Math.max(g.position.z, LAYOUT.customerZ) + 0.24);
    this.world.localToWorld(_v.copy(head));
    this.bubble.lookAt(_v);
    if (this.bubble.visible) { this.bubbleT += dt; if (this.bubbleT > 7 && this.state !== 'paying') this.bubble.visible = false; }

    // card
    this.card.position.set(this.x + (this.serveArm === P.armR ? -0.15 : 0.15), CY + 0.25, LAYOUT.customerZ + 0.26);
    this.card.lookAt(_v);
  }

  // events wired by the Game
  onTimeout() {}
  onJudged() {}
  onCashTimeout() { this.collectCash(); }

  receive(result) {
    this.state = 'judging'; this.stateT = 0; this.result = result;
    this.card.visible = false;
  }

  // Payment held out in the customer's hand: a naira note, or (pay by transfer) a phone showing the
  // credit alert. A "pending" alert is the Lagos classic: check it and they pay cash instead.
  showCash(amount, { transfer = false, pending = false } = {}) {
    this.cashAmount = amount;
    this.cashPending = transfer && pending;
    this.cashTransfer = transfer;
    if (amount <= 0) return;
    if (this.cash) { this.world.remove(this.cash); disposeDeep(this.cash); this.cash = null; }
    const note = transfer
      ? makePanel(0.07, 0.1, { pxPerM: 1800, transparent: false, draw: (c, w, h) => {
        c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
        c.fillStyle = pending ? '#3a2a08' : '#0c3a1e'; c.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.86);
        c.textAlign = 'center';
        c.fillStyle = pending ? '#ffb347' : '#6af08a'; fitFont(c, pending ? 'PENDING…' : 'CREDIT ALERT', w * 0.78, h * 0.1, 900); c.fillText(pending ? 'PENDING…' : 'CREDIT ALERT', w / 2, h * 0.28);
        c.fillStyle = '#fff'; fitFont(c, naira(amount), w * 0.78, h * 0.16, 900); c.fillText(naira(amount), w / 2, h * 0.52);
        c.fillStyle = '#aaa'; fitFont(c, 'BANK ALERT', w * 0.78, h * 0.08, 700); c.fillText('BANK ALERT', w / 2, h * 0.74);
      } })
      : makePanel(0.09, 0.045, { pxPerM: 1800, transparent: false, draw: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5b3a8a'); g.addColorStop(1, '#2f6a5a');
        c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8e0c0'; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10);
        c.fillStyle = '#fff6d0'; c.font = FONT(h * 0.42, 900); c.textAlign = 'center'; c.fillText(naira(amount), w / 2, h * 0.65);
      } });
    note.material.side = THREE.DoubleSide;
    const grp = new THREE.Group(); grp.add(note); note.rotation.x = transfer ? -0.5 : -0.9;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; grp.add(glow); grp.userData.glow = glow;
    grp.traverse((o) => { o.userData.noRay = true; });
    this.world.add(grp);
    this.cash = grp;
    this.cashT = 0;
  }

  collectCash(auto = false) {
    if (!this.cash) { this.leave(); return 0; }
    const amt = this.cashAmount;
    this.world.remove(this.cash);
    disposeDeep(this.cash);
    this.cash = null;
    this.leave();
    return auto ? amt : amt;
  }

  leave() { this.state = 'leaving'; this.stateT = 0; this.card.visible = false; }

  // Leaving customers must free their canvases and meshes: ~1 MB each, 40+ customers a session.
  dispose() {
    this.world.remove(this.group);
    this.world.remove(this.bubble);
    this.world.remove(this.card);
    if (this.cash) this.world.remove(this.cash);
    for (const o of [this.group, this.bubble, this.card, this.cash]) disposeDeep(o);
    this.cash = null;
  }
}
