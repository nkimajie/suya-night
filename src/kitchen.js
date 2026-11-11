import * as THREE from 'three';
import { CY, LAYOUT, MEATS, MEAT_ORDER, TRAY_ORDER, SIDES, SIDE_ORDER, COOK, HEAT, pepperLevel } from './config.js';
import { makePanel, FONT, fitFont } from './text.js';
import { Particles } from './fx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { audio } from './audio.js';

const G = LAYOUT.grill, T = LAYOUT.tray, B = LAYOUT.board, BW = LAYOUT.bowls, SH = LAYOUT.shaker, BIN = LAYOUT.bin, FAN = LAYOUT.fan;
const GRATE_Y = CY + G.h;
const SLOT_COUNT = 6;
const HOT_SLOTS = 4; // slots 4-5 sit over no coals: the KEEP WARM end, where cooked sticks wait
const HOT_W = 0.05 * HOT_SLOTS + 0.02; // width of the coal bed (grill-local, from the left wall)
const slotX = (i) => G.x - G.w / 2 + 0.045 + i * 0.05;
const SKEWER_Z = G.z + 0.03; // handle sticks out toward the player
const PAPER = { w: 0.22, d: 0.18, y: CY + 0.022 };
const TIMER = { w: 0.044, row: 0.016 }; // gauges on the grill's front wall, one under each slot

const _v = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color();
const CHAR = new THREE.Color(0x1a1009);
const GOLD_TINT = new THREE.Color(0xc98a3a);
const HEAT_HI = new THREE.Color(0xffe060);
const _aim = new THREE.Vector3();
const AIM_RING = new THREE.RingGeometry(0.86, 1, 32); // scaled to each target's size

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const noRay = (o) => { o.traverse((c) => { c.userData.noRay = true; }); return o; };
const setRay = (o, on) => o.traverse((c) => { c.userData.noRay = !on; });

// Colour for a given cook level of a meat (no allocations: this runs for every stick every frame).
const COOKED = Object.fromEntries(Object.entries(MEATS).map(([k, m]) => [k, new THREE.Color(m.cooked)]));
function cookColor(meat, level, out) {
  const m = MEATS[meat];
  const raw = _c.set(m.raw);
  if (level < COOK.GOLDEN) {
    out.copy(raw).lerp(COOKED[meat], (level / COOK.GOLDEN) * 0.75);
  } else if (level < COOK.BURNT) {
    const t = (level - COOK.GOLDEN) / (COOK.BURNT - COOK.GOLDEN);
    out.set(m.cooked).lerp(GOLD_TINT, 0.25 * (1 - Math.abs(t - 0.4))).multiplyScalar(1.05 - t * 0.15);
  } else {
    out.set(m.cooked).lerp(CHAR, Math.min(1, 0.55 + (level - COOK.BURNT) * 1.5));
  }
  return out;
}
export function doneness(cook) {
  const lo = Math.min(cook[0], cook[1]), hi = Math.max(cook[0], cook[1]);
  if (hi > COOK.BURNT) return 'burnt';
  if (lo < COOK.GOLDEN) return 'raw';
  return 'golden';
}

// Shared geometries
const GEO = {
  stick: new THREE.CylinderGeometry(0.0022, 0.0022, 0.27, 5).rotateX(Math.PI / 2),
};

// Merge 5 chunks into one geometry with 3 groups: 0 = +Y faces (side 0),
// 1 = -Y faces (side 1), 2 = everything else. One mesh = 3 draw calls per skewer.
const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _qq = new THREE.Quaternion(), _sv = new THREE.Vector3(), _pv = new THREE.Vector3();
function chunkGeometry(shape) {
  const pos = [], nor = [], idx = [[], [], []];
  let base = 0;
  for (let i = 0; i < 5; i++) {
    let g = shape === 'ball' ? new THREE.IcosahedronGeometry(0.014, 0) : new THREE.BoxGeometry(shape === 'slice' ? 0.034 : 0.03, shape === 'slice' ? 0.012 : 0.02, shape === 'slice' ? 0.02 : 0.026);
    if (!g.index) g = mergeVertsIndex(g);
    _m4.compose(_pv.set((Math.random() - 0.5) * 0.004, 0, -0.105 + i * 0.034), _qq.setFromEuler(_e.set(0, (Math.random() - 0.5) * 0.5, 0)), _sv.setScalar(0.85 + Math.random() * 0.3));
    g.applyMatrix4(_m4);
    const P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array;
    for (let k = 0; k < P.length; k++) { pos.push(P[k]); nor.push(N[k]); }
    const groups = g.groups.length ? g.groups : [{ start: 0, count: I.length, materialIndex: -1 }];
    for (const gr of groups) {
      for (let k = gr.start; k < gr.start + gr.count; k += 3) {
        let bucket = 2;
        if (gr.materialIndex === 2) bucket = 0; else if (gr.materialIndex === 3) bucket = 1;
        if (gr.materialIndex === -1) { const ny = N[I[k] * 3 + 1] + N[I[k + 1] * 3 + 1] + N[I[k + 2] * 3 + 1]; bucket = ny > 1.5 ? 0 : ny < -1.5 ? 1 : 2; }
        idx[bucket].push(I[k] + base, I[k + 1] + base, I[k + 2] + base);
      }
    }
    base += P.length / 3;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const all = [...idx[0], ...idx[1], ...idx[2]];
  geo.setIndex(all);
  geo.addGroup(0, idx[0].length, 0);
  geo.addGroup(idx[0].length, idx[1].length, 1);
  geo.addGroup(idx[0].length + idx[1].length, idx[2].length, 2);
  return geo;
}
function mergeVertsIndex(g) {
  const n = g.attributes.position.count; const I = []; for (let i = 0; i < n; i++) I.push(i); g.setIndex(I); return g;
}

// ------------------------------------------------------------------ Skewer
class Skewer {
  constructor(meat) {
    this.kind = 'skewer';
    this.meat = meat;
    this.cook = [0, 0];
    this.down = 1; // index of the side facing the coals
    this.state = 'held';
    this.slot = -1;
    this.flipT = 1;
    this.group = new THREE.Group();
    const stick = new THREE.Mesh(GEO.stick, lambert(0xd9b98a));
    stick.position.z = 0.01;
    this.group.add(stick);
    this.chunkRoot = new THREE.Group();
    this.group.add(this.chunkRoot);
    this.mats = [lambert(MEATS[meat].raw), lambert(MEATS[meat].raw), lambert(MEATS[meat].raw)]; // side0, side1, mix
    const chunks = new THREE.Mesh(chunkGeometry(MEATS[meat].shape), this.mats);
    this.chunkRoot.add(chunks);
    this.refresh();
  }
  get up() { return 1 - this.down; }
  grabPoint(out) { return out.copy(this.group.position); }
  // distance from p to the skewer's segment
  dist(p) {
    const gp = this.group.position;
    const z = THREE.MathUtils.clamp(p.z - gp.z, -0.12, 0.14);
    return _v.set(gp.x, gp.y, gp.z + z).distanceTo(p);
  }
  flip() {
    this.down = 1 - this.down;
    this.flipT = 0;
  }
  refresh() {
    cookColor(this.meat, this.cook[0], this.mats[0].color);
    cookColor(this.meat, this.cook[1], this.mats[1].color);
    cookColor(this.meat, (this.cook[0] + this.cook[1]) / 2, this.mats[2].color);
  }
  update(dt) {
    // Side 0 is on the +Y face of the chunks when down === 1 (rotation 0).
    const target = this.down === 1 ? 0 : Math.PI;
    if (this.flipT < 1) {
      this.flipT = Math.min(1, this.flipT + dt * 4);
      const from = target === 0 ? Math.PI : 0;
      this.chunkRoot.rotation.z = from + (target - from) * easeOut(this.flipT);
      this.chunkRoot.position.y = Math.sin(this.flipT * Math.PI) * 0.03;
    } else {
      this.chunkRoot.rotation.z = target;
      this.chunkRoot.position.y = 0;
    }
  }
  dispose() { this.mats.forEach((m) => m.dispose()); this.chunkRoot.children[0]?.geometry.dispose(); }
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ------------------------------------------------------------------ Side piece
function sideMesh(side) {
  const col = SIDES[side].color;
  let m;
  if (side === 'onions') m = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0035, 5, 12), lambert(col)), m.rotation.x = Math.PI / 2;
  else if (side === 'cabbage') m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.004, 0.012), lambert(col));
  else if (side === 'tomatoes') m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10), lambert(col));
  else m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12), lambert(col));
  const g = new THREE.Group(); g.add(m);
  return g;
}

// ------------------------------------------------------------------ Kitchen
export class Kitchen {
  constructor(world, hooks) {
    this.world = world;
    this.hooks = hooks; // { emit(name,data), findServeTarget(pos), takeCash(pos), cashAt(pos), canInteract() }
    this.root = new THREE.Group();
    world.add(this.root);
    this.heat = HEAT.start;
    this.slots = new Array(SLOT_COUNT).fill(null);
    this.loose = []; // items resting on the counter (skewers / packages)
    this.held = new Map(); // pointer -> {item, offset, t, from, startPos}
    this.paperGrab = null;
    this.available = { meats: MEAT_ORDER.slice(), sides: SIDE_ORDER.slice() };
    this.fanTime = 0;
    this.cookMul = 1;
    this.fanMul = 1;        // shop: big abebe fan
    this.heatDecayMul = 1;  // shop: big abebe fan (fire dies slower)
    this.coalBoost = 1;     // shop: hardwood charcoal glows brighter

    this.smoke = new Particles(220, { soft: 0.0 });
    this.embers = new Particles(160, { additive: true, soft: 0.2 });
    this.pepperFx = new Particles(160, { soft: 0.3 });
    this.root.add(this.smoke.points, this.embers.points, this.pepperFx.points);

    this._buildGrill();
    this._buildTray();
    this._buildBoard();
    this._buildBowls();
    this._buildShaker();
    this._buildBin();
    this._buildFan();
    this._buildTimers();
    this.resetPaper();
  }

  // ---------------------------------------------------------------- building
  _buildGrill() {
    const g = new THREE.Group(); g.position.set(G.x, CY, G.z); this.root.add(g);
    const metal = lambert(0x3a3330);
    const wallT = 0.012;
    const parts = [
      [G.w, G.h * 0.7, wallT, 0, G.h * 0.35, G.d / 2], [G.w, G.h * 0.7, wallT, 0, G.h * 0.35, -G.d / 2],
      [wallT, G.h * 0.7, G.d, G.w / 2, G.h * 0.35, 0], [wallT, G.h * 0.7, G.d, -G.w / 2, G.h * 0.35, 0],
      [G.w, 0.01, G.d, 0, 0.012, 0],
    ];
    g.add(new THREE.Mesh(mergeGeometries(parts.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))), metal)); // 1 draw call
    // legs hidden in counter; grate bars
    const barMat = lambert(0x222222);
    const bars = [];
    for (let i = 0; i < 9; i++) {
      bars.push(new THREE.CylinderGeometry(0.0025, 0.0025, G.w, 4).rotateZ(Math.PI / 2).translate(0, G.h, -G.d / 2 + 0.02 + i * ((G.d - 0.04) / 8)));
    }
    g.add(new THREE.Mesh(mergeGeometries(bars), barMat));
    // coals
    // Charcoal: dark lumps with glowing faces. Unlit + vertex colours; the material colour follows
    // the heat each frame, so ember faces flare when you fan while the black faces stay black.
    this.coalMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const coalGeos = [];
    const ash = new THREE.Color(0x1a1311), ember = new THREE.Color(), tmp = new THREE.Color();
    for (let i = 0; i < 52; i++) {
      const cg = new THREE.DodecahedronGeometry(0.018, 0);
      _m4.compose(_pv.set(-G.w / 2 + 0.015 + Math.random() * (HOT_W - 0.01), 0.03 + Math.random() * 0.03, (Math.random() - 0.5) * (G.d - 0.03)),
        _qq.setFromEuler(_e.set(Math.random() * 3, Math.random() * 3, 0)), _sv.set(0.7 + Math.random() * 0.6, 0.55 + Math.random() * 0.35, 0.7 + Math.random() * 0.6));
      cg.applyMatrix4(_m4);
      const n = cg.attributes.position.count, col = new Float32Array(n * 3);
      for (let f = 0; f < n; f += 9) { // one dodecahedron face = 3 triangles = 9 vertices
        const hot = Math.random() < 0.62;
        if (hot) ember.setRGB(1, 0.07 + Math.random() * 0.12, 0.004 + Math.random() * 0.012).multiplyScalar(0.7 + Math.random() * 0.4); // linear: deep orange-red
        tmp.copy(hot ? ember : ash);
        for (let v = f; v < Math.min(n, f + 9); v++) { col[v * 3] = tmp.r; col[v * 3 + 1] = tmp.g; col[v * 3 + 2] = tmp.b; }
      }
      cg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      cg.deleteAttribute('uv'); cg.deleteAttribute('normal');
      coalGeos.push(cg);
    }
    // a bed of grey ash under the coals
    const bed = new THREE.PlaneGeometry(HOT_W - 0.01, G.d - 0.02).rotateX(-Math.PI / 2).translate(-G.w / 2 + HOT_W / 2 + 0.002, 0.02, 0);
    bed.deleteAttribute('uv'); bed.deleteAttribute('normal');
    const bc = new Float32Array(bed.attributes.position.count * 3).fill(0.018);
    bed.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    coalGeos.push(bed.index ? bed.toNonIndexed() : bed);
    g.add(new THREE.Mesh(mergeGeometries(coalGeos.map((x) => (x.index ? x.toNonIndexed() : x))), this.coalMat));
    this.grillLight = new THREE.PointLight(0xff5a1a, 1.2, 1.4, 1.5);
    this.grillLight.position.set(G.x - G.w / 2 + HOT_W / 2, GRATE_Y + 0.08, G.z);
    this.root.add(this.grillLight);
    this.grillGroup = g;
    // KEEP WARM sign standing at the back of the coal-free end
    const warm = makePanel(0.1, 0.022, { pxPerM: 2400, draw: (c, w, h) => { c.fillStyle = 'rgba(20,10,5,0.85)'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd38a'; fitFont(c, 'KEEP WARM', w * 0.9, h * 0.62, 900); c.textAlign = 'center'; c.fillText('KEEP WARM', w / 2, h * 0.74); } });
    warm.position.set((slotX(HOT_SLOTS) + slotX(SLOT_COUNT - 1)) / 2, GRATE_Y + 0.02, G.z - G.d / 2 + 0.01); warm.rotation.x = -0.4;
    warm.userData.noRay = true;
    this.root.add(warm);
  }

  _buildTray() {
    const g = new THREE.Group(); g.position.set(T.x, CY, T.z); this.root.add(g);
    // base, rims and dividers: one vertex-coloured mesh (1 draw call instead of 9)
    const steel = new THREE.Color(0xb8bcc0), rimC = new THREE.Color(0x9aa0a6);
    const shell = [colorize(new THREE.BoxGeometry(T.w, 0.012, T.d).translate(0, 0.006, 0), steel)];
    for (const [w, d, x, z] of [[T.w, 0.006, 0, T.d / 2], [T.w, 0.006, 0, -T.d / 2], [0.006, T.d, T.w / 2, 0], [0.006, T.d, -T.w / 2, 0]]) {
      shell.push(colorize(new THREE.BoxGeometry(w, 0.02, d).translate(x, 0.012, z), rimC));
    }
    this.trayComps = [];
    const cw = T.w / TRAY_ORDER.length;
    TRAY_ORDER.forEach((meat, i) => {
      const cx = -T.w / 2 + cw * (i + 0.5);
      if (i > 0) shell.push(colorize(new THREE.BoxGeometry(0.003, 0.016, T.d).translate(-T.w / 2 + cw * i, 0.012, 0), rimC));
      // decorative raw skewers: one vertex-coloured mesh per compartment (1 draw call)
      const parts = [];
      const raw = new THREE.Color(MEATS[meat].raw), wood = new THREE.Color(0xd9b98a);
      for (let k = 0; k < 2; k++) {
        const ox = cx + (k - 0.5) * 0.02, oy = 0.022 + k * 0.004;
        parts.push(colorize(new THREE.CylinderGeometry(0.0022, 0.0022, 0.25, 4).rotateX(Math.PI / 2).translate(ox, oy, -0.01), wood));
        for (let i = 0; i < 5; i++) {
          const cg = MEATS[meat].shape === 'ball' ? new THREE.IcosahedronGeometry(0.012, 0) : new THREE.BoxGeometry(0.026, 0.017, 0.024);
          parts.push(colorize(cg, raw).translate(ox, oy, -0.115 + i * 0.031));
        }
      }
      const deco = new THREE.Mesh(mergeGeometries(parts.map(stripUV)), new THREE.MeshLambertMaterial({ vertexColors: true }));
      g.add(deco);
      this.trayComps.push({ meat, x: T.x + cx, z: T.z, w: cw, deco });
    });
    g.add(new THREE.Mesh(mergeGeometries(shell.map(stripUV)), new THREE.MeshLambertMaterial({ vertexColors: true })));
    // label strip standing along the BACK edge of the tray, leaning toward the player
    // (the front edge is where the waste bin sits, and hands would cover it)
    this.trayLabel = makePanel(T.w, 0.045, { pxPerM: 2000 });
    this.trayLabel.rotation.x = -0.45; this.trayLabel.position.set(T.x, CY + 0.04, T.z - T.d / 2 + 0.005);
    this.root.add(this.trayLabel);
    this._drawTrayLabel();
  }
  _drawTrayLabel() {
    const cw = 1 / TRAY_ORDER.length;
    this.trayLabel.redraw((c, w, h) => {
      c.fillStyle = 'rgba(20,10,5,0.85)'; c.fillRect(0, 0, w, h);
      TRAY_ORDER.forEach((m, i) => {
        const on = this.available.meats.includes(m);
        c.fillStyle = on ? '#ffe2b0' : '#5a4a40'; fitFont(c, MEATS[m].name.toUpperCase(), w * cw * 0.92, h * 0.5); c.textAlign = 'center';
        c.fillText(MEATS[m].name.toUpperCase(), w * cw * (i + 0.5), h * 0.66);
      });
    });
  }

  _buildBoard() {
    const board = new THREE.Mesh(new THREE.BoxGeometry(B.w, 0.018, B.d), lambert(0xa87a4a));
    board.position.set(B.x, CY + 0.009, B.z); this.root.add(board);
    this.paperTex = makeNewspaperTexture();
    this.paper = new THREE.Group(); this.paper.position.set(B.x, PAPER.y, B.z); this.root.add(this.paper);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(PAPER.w, PAPER.d), lambert(0xffffff, { map: this.paperTex }));
    sheet.rotation.x = -Math.PI / 2; this.paper.add(sheet);
    this.pepperLayer = new THREE.Mesh(new THREE.PlaneGeometry(PAPER.w * 0.8, PAPER.d * 0.75), new THREE.MeshBasicMaterial({ map: makeSpeckleTexture(), transparent: true, opacity: 0, depthWrite: false }));
    this.pepperLayer.rotation.x = -Math.PI / 2; this.pepperLayer.position.y = 0.024; this.pepperLayer.renderOrder = 2;
    noRay(this.pepperLayer);
    this.paper.add(this.pepperLayer);
    this.paperContent = new THREE.Group(); this.paper.add(this.paperContent);
  }

  _buildBowls() {
    this.bowls = [];
    const pts = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; pts.push(new THREE.Vector2(0.012 + Math.sin(a) * (BW.r - 0.012), 0.04 - Math.cos(a) * 0.04)); }
    const shells = [];
    SIDE_ORDER.forEach((side, i) => {
      const g = new THREE.Group(); g.position.set(BW.xs[i], CY, BW.z); this.root.add(g);
      shells.push(stripUV(colorize(new THREE.LatheGeometry(pts, 16).translate(BW.xs[i], CY, BW.z), new THREE.Color([0x2a6fb0, 0xd8d0c0, 0xc8402a, 0x3a8a4a][i]))));
      // 7 pieces in the bowl, merged into one mesh (1 draw call per bowl)
      const pieces = [];
      for (let k = 0; k < 7; k++) {
        const p = sideMesh(side); const a = Math.random() * Math.PI * 2, r = Math.random() * 0.022;
        p.position.set(Math.cos(a) * r, 0.03 + Math.random() * 0.008, Math.sin(a) * r); p.rotation.y = Math.random() * 3;
        p.updateMatrixWorld(true);
        const m = p.children[0];
        const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
        geo.deleteAttribute('uv');
        pieces.push(geo);
      }
      const fill = new THREE.Mesh(mergeGeometries(pieces), lambert(SIDES[side].color));
      g.add(fill);
      this.bowls.push({ side, group: g, fill, x: BW.xs[i], z: BW.z });
    });
    this.root.add(new THREE.Mesh(mergeGeometries(shells), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    // one label strip in front of the row of bowls (1 draw call)
    const x0 = BW.xs[0] - 0.04, x1 = BW.xs[BW.xs.length - 1] + 0.04;
    this.bowlLabel = makePanel(x1 - x0, 0.024, { pxPerM: 2000 });
    this.bowlLabel.position.set((x0 + x1) / 2, CY + 0.012, BW.z + BW.r + 0.014); this.bowlLabel.rotation.x = -Math.PI / 2 + 0.6;
    this.bowlLabel.userData.noRay = true;
    this.root.add(this.bowlLabel);
    this._bowlSpan = [x0, x1];
    this._drawBowlLabels();
  }
  _drawBowlLabels() {
    const [x0, x1] = this._bowlSpan;
    this.bowlLabel.redraw((c, w, h) => {
      for (const b of this.bowls) {
        const on = this.available.sides.includes(b.side);
        const cx = ((b.x - x0) / (x1 - x0)) * w, cw = (0.078 / (x1 - x0)) * w;
        c.fillStyle = 'rgba(20,10,5,0.85)'; c.fillRect(cx - cw / 2, 0, cw, h);
        c.fillStyle = on ? '#ffe2b0' : '#5a4a40'; fitFont(c, SIDES[b.side].name.toUpperCase(), cw * 0.9, h * 0.62); c.textAlign = 'center';
        c.fillText(SIDES[b.side].name.toUpperCase(), cx, h * 0.74);
        b.fill.visible = on;
      }
    });
  }

  _buildShaker() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.085, 12), lambert(0xc0281a)); body.position.y = 0.0425; g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.016, 12), lambert(0xd8d8d8)); cap.position.y = 0.093; g.add(cap);
    const label = makePanel(0.05, 0.03, { pxPerM: 1600 });
    label.position.set(0, 0.045, 0.0225); g.add(label);
    this.shakerParts = { body, cap, label };
    this._drawShakerLabel(false);
    g.position.set(SH.x, CY, SH.z);
    this.root.add(g);
    this.shaker = { kind: 'shaker', group: g, state: 'rest', home: new THREE.Vector3(SH.x, CY, SH.z), lastDir: null, cool: 0 };
  }

  _drawShakerLabel(papa) {
    this.shakerParts.label.redraw((c, w, h) => {
      c.fillStyle = papa ? '#1a1208' : '#f7d36a'; c.fillRect(0, 0, w, h);
      c.fillStyle = papa ? '#ffd34d' : '#7a1408'; c.textAlign = 'center';
      if (papa) { c.font = FONT(h * 0.3, 900); c.fillText('PAPA’S', w / 2, h * 0.38); c.font = FONT(h * 0.42, 900); c.fillText('YAJI', w / 2, h * 0.84); }
      else { c.font = FONT(h * 0.55, 900); c.fillText('YAJI', w / 2, h * 0.72); }
    });
  }

  // Shop upgrades that change how the kitchen looks (effects are set by the Game).
  setUpgrades(u) {
    const big = !!u.fan;
    if (this._bigFan !== big) {
      this._bigFan = big;
      this.fanBlade.scale.set(big ? 1.18 : 1, 1, big ? 1.18 : 1);
      this.fanMat.map = big ? (this._bigFanTex ||= makeWovenTexture(true)) : this.fanTex;
      this.fanMat.needsUpdate = true;
    }
    const papa = !!u.yaji;
    if (this._papaYaji !== papa) {
      this._papaYaji = papa;
      this.shakerParts.body.material.color.set(papa ? 0x7a1208 : 0xc0281a);
      this.shakerParts.cap.material.color.set(papa ? 0xe0a820 : 0xd8d8d8);
      this.shaker.group.scale.setScalar(papa ? 1.12 : 1);
      this._drawShakerLabel(papa);
    }
    this.coalBoost = u.charcoal ? 1.3 : 1;
  }

  _buildBin() {
    const g = new THREE.Group(); g.position.set(BIN.x, CY, BIN.z); this.root.add(g);
    const pts = [new THREE.Vector2(0.036, 0), new THREE.Vector2(0.05, 0.075), new THREE.Vector2(0.052, 0.08)];
    const bucket = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), lambert(0x2f5f8f, { side: THREE.DoubleSide })); g.add(bucket);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.036, 16), lambert(0x1a2a3a)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.004; g.add(bottom);
    const label = makePanel(0.09, 0.022, { pxPerM: 2000, draw: (c, w, h) => { c.fillStyle = '#ffffff'; c.font = FONT(h * 0.7, 800); c.textAlign = 'center'; c.fillText('WASTE', w / 2, h * 0.75); } });
    label.position.set(0, 0.04, 0.048); g.add(label);
  }

  // Woven hand fan (abebe): pinch it and wave it over the grill. Open-hand waving also works.
  _buildFan() {
    const g = new THREE.Group();
    const tex = makeWovenTexture();
    this.fanMat = lambert(0xffffff, { map: tex, emissive: 0xff8a20, emissiveIntensity: 0 });
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.005, 20), this.fanMat);
    blade.position.set(0, 0, -0.07); g.add(blade);
    this.fanBlade = blade; this.fanTex = tex;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.07, 6).rotateX(Math.PI / 2), lambert(0x8a5a2a));
    handle.position.set(0, 0, -0.005); g.add(handle);
    // group origin = the handle (where you pinch); the blade sits beyond it
    g.position.set(FAN.x, CY + 0.012, FAN.z);
    g.rotation.y = Math.PI / 2; // handle toward the grill, blade toward the tray
    this.root.add(g);
    this.fan = { kind: 'fan', group: g, state: 'rest', home: g.position.clone(), homeRot: Math.PI / 2, phase: 0 };
  }
  _returnFan(instant = false) {
    const f = this.fan;
    for (const [p, h] of this.held) if (h.item === f) this.held.delete(p);
    if (instant) { f.group.position.copy(f.home); f.group.rotation.set(0, f.homeRot, 0); f.state = 'rest'; return; }
    f.state = 'returning';
  }

  // Burn timers: a two-row gauge on the grill's front wall under each grilled skewer (row 1 = side on the
  // coals, row 2 = side facing up). Green notch = golden; bar flashes red just before burning.
  // One InstancedMesh for all slots = 1 draw call.
  _buildTimers() {
    const N = SLOT_COUNT * 4 + 2; // + heat bar (bg, fill)
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
    mesh.userData.noRay = true;
    mesh.frustumCulled = false;
    for (let i = 0; i < N; i++) { mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); mesh.setColorAt(i, new THREE.Color(0)); }
    this.root.add(mesh);
    this.timerMesh = mesh;
    this.timerQ = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const c = new THREE.Vector3(slotX(i), CY + 0.045, G.z + G.d / 2 + 0.02);
      this.timerQ.push({ c, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0)) }); // leans back slightly toward the eye
    }
  }
  _setBar(idx, slot, x, y, w, h, color, zOff) {
    const { c, q } = this.timerQ[slot];
    _pv.set(x, y, zOff).applyQuaternion(q).add(c);
    _m4.compose(_pv, q, _sv.set(Math.max(w, 1e-5), h, 1));
    this.timerMesh.setMatrixAt(idx, _m4);
    this.timerMesh.setColorAt(idx, _c.set(color));
  }
  _updateTimers(t) {
    const W = TIMER.w, R = TIMER.row;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = this.slots[i], b = i * 4;
      if (!s) { for (let k = 0; k < 4; k++) this.timerMesh.setMatrixAt(b + k, _m4.makeScale(0, 0, 0)); continue; }
      this._setBar(b, i, 0, 0, W + 0.006, R * 2 + 0.008, 0x14100c, 0);
      for (let row = 0; row < 2; row++) {
        const lv = s.cook[row === 0 ? s.down : s.up], f = Math.min(1, lv / COOK.BURNT);
        let col = lv < COOK.GOLDEN ? 0xffb030 : lv < COOK.BURNT - 0.18 ? 0x4cd964 : lv < COOK.BURNT ? (Math.sin(t * 20) > 0 ? 0xff3020 : 0xffd040) : 0x7a1010;
        if (row === 1) col = _c2.set(col).multiplyScalar(0.7).getHex();
        const h = row === 0 ? R : R * 0.7;
        const y = row === 0 ? R * 0.5 + 0.001 : -R * 0.5;
        this._setBar(b + 1 + row, i, -W / 2 + (W * f) / 2, y, W * f, h, col, 0.0005);
      }
      this._setBar(b + 3, i, -W / 2 + W * (COOK.GOLDEN / COOK.BURNT), 0, 0.0015, R * 2 + 0.008, 0xffffff, 0.001);
      // one warning ping as the side on the coals nears burning
      const worst = s.cook[s.down];
      if (worst > COOK.BURNT - 0.18 && !s.warnedSoon) { s.warnedSoon = true; audio.play('warn'); }
      if (worst < COOK.BURNT - 0.18) s.warnedSoon = false;
    }
    // heat bar along the top of the grill's front wall
    const hb = SLOT_COUNT * 4, HW = G.w - 0.03, low = this.heat < HEAT.low;
    const hc = low ? (Math.sin(t * 12) > 0 ? 0x3a6aff : 0xff3020) : _c2.set(0xff3a10).lerp(HEAT_HI, this.heat).getHex();
    _pv.set(G.x, CY + 0.076, G.z + G.d / 2 + 0.008);
    _qq.setFromEuler(_e.set(-0.35, 0, 0));
    this.timerMesh.setMatrixAt(hb, _m4.compose(_pv, _qq, _sv.set(HW + 0.006, 0.013, 1)));
    this.timerMesh.setColorAt(hb, _c.set(0x14100c));
    const f = Math.max(0.02, this.heat);
    _pv.set(G.x - HW / 2 + (HW * f) / 2, CY + 0.076, G.z + G.d / 2 + 0.0095);
    this.timerMesh.setMatrixAt(hb + 1, _m4.compose(_pv, _qq, _sv.set(HW * f, 0.008, 1)));
    this.timerMesh.setColorAt(hb + 1, _c.set(hc));
    this.timerMesh.instanceMatrix.needsUpdate = true;
    if (this.timerMesh.instanceColor) this.timerMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- state
  setAvailable(meats, sides) {
    this.available = { meats: meats.slice(), sides: sides.slice() };
    this.trayComps.forEach((tc) => { tc.deco.visible = meats.includes(tc.meat); });
    this._drawTrayLabel();
    this._drawBowlLabels();
  }

  reset() {
    for (const s of this.slots) if (s) this._removeItem(s);
    this.slots.fill(null);
    for (const it of this.loose) this._removeItem(it);
    this.loose.length = 0;
    for (const [, h] of this.held) if (h.item.kind !== 'shaker' && h.item.kind !== 'fan') this._removeItem(h.item);
    this.held.clear();
    this.paperGrab = null;
    this._returnShaker(true);
    this._returnFan(true);
    this.heat = HEAT.start;
    this.lowWarned = false;
    this.resetPaper();
  }

  resetPaper() {
    this.contents = { meats: [], shakes: 0, sides: [] };
    for (const ch of this.paperContent.children) disposeTree(ch); // chunk geometry + materials came from the (discarded) skewer
    this.paperContent.clear();
    this.pepperLayer.material.opacity = 0;
    this.paperTex.offset.set(Math.random() * 0.5, Math.random() * 0.5);
  }

  _removeItem(it) {
    if (!it) return;
    if (it.group.parent) it.group.parent.remove(it.group);
    if (it.dispose) it.dispose();
    else if (it.kind === 'side' || it.kind === 'package') disposeTree(it.group);
  }

  isGrillEmpty() { return this.slots.every((s) => !s); }

  // ---------------------------------------------------------------- per-frame
  update(dt, pointers, t) {
    const canPlay = this.hooks.canInteract();
    // 1) pointer interactions
    for (const p of pointers) {
      const h = this.held.get(p);
      if (h) {
        // follow
        h.item.group.position.copy(p.pos).add(h.offset);
        if (h.item.kind === 'fan') this._fanWith(p, h.item, dt);
        if (h.item.kind === 'shaker') h.item.group.position.y = Math.max(h.item.group.position.y, CY + 0.07);
        if (h.item.kind === 'shaker') this._updateShaking(h.item, p, dt);
        if (p.pinchEnded || !p.pinching) this._release(p, h);
        continue;
      }
      if (this.paperGrab && this.paperGrab.p === p) {
        if (!p.pinching) { this.paperGrab = null; continue; }
        const dy = p.pos.y - this.paperGrab.start.y, dist = p.pos.distanceTo(this.paperGrab.start);
        if (dy > 0.03 || dist > 0.05 || performance.now() - this.paperGrab.t > 300) this._wrap(p);
        continue;
      }
      if (p.pinchStarted && canPlay && !p.consumed) this._tryGrab(p);
    }
    // pointers that vanished (hand lost tracking) drop what they hold
    for (const [p, h] of this.held) if (!pointers.includes(p)) this._release(p, h);
    this._updateAim(pointers, canPlay, t);

    // 2) heat + coals
    if (canPlay) this.heat = Math.max(HEAT.floor, this.heat - HEAT.decay * this.heatDecayMul * dt);
    if (canPlay && this.heat < HEAT.low && !this.lowWarned) { this.lowWarned = true; audio.play('warn'); this.hooks.emit('heatLow'); }
    if (this.heat > HEAT.low + 0.15) this.lowWarned = false;
    // the fan glows while the fire is low, so you know what to grab
    this.fanMat.emissiveIntensity = this.heat < HEAT.low && this.fan.state === 'rest' ? 0.35 + Math.sin(t * 6) * 0.25 : 0;
    const fn = this.fan;
    if (fn.state === 'returning') {
      fn.group.position.lerp(fn.home, Math.min(1, dt * 10));
      fn.group.rotation.x *= 0.8; fn.group.rotation.z *= 0.8; fn.group.rotation.y += (fn.homeRot - fn.group.rotation.y) * 0.2;
      if (fn.group.position.distanceTo(fn.home) < 0.002) this._returnFan(true);
    }
    const flicker = 0.9 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23.7) * 0.05;
    const ck = (0.28 + this.heat * 0.95) * flicker * this.coalBoost;
    this.coalMat.color.setRGB(ck, ck * (0.55 + 0.9 * this.heat), ck * (0.5 + 0.8 * this.heat)); // hotter = more yellow
    this.grillLight.intensity = (0.25 + this.heat * 1.6) * flicker;
    if (Math.random() < this.heat * dt * 6) this.embers.emit(G.x - G.w / 2 + 0.015 + Math.random() * (HOT_W - 0.02), GRATE_Y, G.z + (Math.random() - 0.5) * G.d * 0.8, { vy: 0.25, spread: 0.08, life: 0.9, size: 0.006, color: 0xffa040 });

    // 3) cooking
    const rate = COOK.baseRate * this.cookMul * (0.18 + this.heat);
    let sizzle = 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const warm = i >= HOT_SLOTS;
      if (canPlay) {
        if (warm) { s.cook[s.down] += rate * 0.04 * dt; s.cook[s.up] += rate * 0.04 * dt; }
        else { s.cook[s.down] += rate * dt; s.cook[s.up] += rate * 0.12 * dt; }
      }
      s.refresh();
      s.update(dt);
      if (warm) continue;
      sizzle += 0.4 + this.heat;
      const worst = s.cook[s.down];
      const sx = s.group.position.x, sz = s.group.position.z;
      if (worst > COOK.BURNT) {
        if (Math.random() < dt * 9) this.smoke.emit(sx, GRATE_Y + 0.03, sz + (Math.random() - 0.5) * 0.15, { vy: 0.2, spread: 0.05, life: 1.5, size: 0.03, grow: 0.05, color: 0x1a1612, alpha: 0.75 });
        if (!s.warnedBurnt) { s.warnedBurnt = true; this.hooks.emit('burnt', { meat: s.meat }); }
      } else if (worst > COOK.BURNT - 0.18) {
        if (Math.random() < dt * 8) this.smoke.emit(sx, GRATE_Y + 0.03, sz + (Math.random() - 0.5) * 0.15, { vy: 0.16, spread: 0.04, life: 1.5, size: 0.025, grow: 0.045, color: 0x555049, alpha: 0.5 });
      } else if (Math.random() < dt * (1 + this.heat * 3)) {
        this.smoke.emit(sx, GRATE_Y + 0.03, sz + (Math.random() - 0.5) * 0.15, { vy: 0.14, spread: 0.03, life: 1.6, size: 0.02, grow: 0.06, color: 0xb0a8a0, alpha: 0.28 });
      }
      if (this.heat > 0.75 && Math.random() < dt * 1.5) this.embers.emit(sx, GRATE_Y + 0.01, sz, { vy: 0.35, spread: 0.12, life: 0.5, size: 0.018, color: 0xff7a20 });
    }
    for (const it of this.loose) if (it.kind === 'skewer') it.update(dt);
    for (const [, h] of this.held) if (h.item.kind === 'skewer') h.item.update(dt);
    audio.setGrill(sizzle, this.heat);
    this._updateTimers(t);

    // 4) shaker returning home
    const sh = this.shaker;
    if (sh.state === 'returning') {
      sh.group.position.lerp(sh.home, Math.min(1, dt * 10));
      sh.group.rotation.z *= 0.8;
      if (sh.group.position.distanceTo(sh.home) < 0.002) { sh.group.position.copy(sh.home); sh.state = 'rest'; }
    }

    this.smoke.update(dt); this.embers.update(dt); this.pepperFx.update(dt);
  }

  // Waving the held fan: like an open hand but stronger. The blade tilts with the motion.
  _fanWith(p, f, dt) {
    const g = f.group;
    const overGrill = Math.abs(g.position.x - G.x) < G.w / 2 + 0.05 && Math.abs(g.position.z - G.z) < G.d / 2 + 0.05;
    g.position.y = Math.max(g.position.y, overGrill ? GRATE_Y + 0.05 : CY + 0.03);
    const v = p.vel, speed = v.length();
    f.phase += dt * (4 + speed * 10);
    g.rotation.set(-0.9 + Math.sin(f.phase) * 0.35 * Math.min(1, speed), 0.4, 0); // blade up, facing the coals
    this._fanAt(g.position, speed, 1.6 * this.fanMul, dt); // only the held fan fans: a bare hand or mouse sweep does nothing
  }
  _fanAt(pl, speed, mult, dt) {
    const inZone = Math.abs(pl.x - G.x) < G.w / 2 + 0.07 && Math.abs(pl.z - G.z) < G.d / 2 + 0.07 && pl.y > CY + 0.02 && pl.y < GRATE_Y + 0.42;
    if (!inZone) return;
    if (speed < 0.4) return;
    this.heat = Math.min(1, this.heat + (speed - 0.3) * 0.6 * mult * dt);
    this.fanTime += dt;
    if (this.fanTime > 0.5) { this.fanTime = 0; this.hooks.emit('fan'); }
    if (Math.random() < dt * 25) this.embers.emit(G.x - G.w / 2 + 0.015 + Math.random() * (HOT_W - 0.02), GRATE_Y + 0.01, G.z + (Math.random() - 0.5) * G.d * 0.8, { vy: 0.5 + Math.random() * 0.4, spread: 0.2, life: 0.8, size: 0.007, color: 0xffb050 });
  }

  // ---------------------------------------------------------------- aim feedback
  // Each free hand shows a soft ring on the thing a pinch would grab right now, so pinch drift
  // and depth are never a guess. Uses the same rules as _tryGrabAt, without side effects.
  _updateAim(pointers, canPlay, t) {
    this.aimRings ||= new Map();
    const used = new Set();
    for (const p of pointers) {
      let ring = this.aimRings.get(p);
      const free = canPlay && !this.held.get(p) && !(this.paperGrab && this.paperGrab.p === p) && !p.pinching;
      const at = free ? this._pickAt(p.pos) : null;
      if (!at) { if (ring) ring.visible = false; continue; }
      if (!ring) {
        ring = new THREE.Mesh(AIM_RING, new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.renderOrder = 12; ring.userData.noRay = true;
        this.root.add(ring); this.aimRings.set(p, ring);
      }
      used.add(ring);
      if (!ring.visible || ring.userData.target !== at.item) { ring.userData.target = at.item; if (p.kind === 'hand') audio.play('tick'); }
      ring.visible = true;
      ring.position.copy(at.pos);
      ring.scale.setScalar(at.r * (1 + Math.sin(t * 8) * 0.06));
    }
    for (const r of this.aimRings.values()) if (!used.has(r)) r.visible = false;
  }
  // What a pinch at `pos` would take: { item, pos (ring centre), r (ring radius) } or null.
  _pickAt(pos) {
    const cash = this.hooks.cashAt?.(pos);
    if (cash) return { item: cash, pos: _aim.copy(cash.position), r: 0.05 };
    let best = null, bestD = 0.065;
    const consider = (item) => {
      const d = item.kind === 'skewer' ? item.dist(pos) : item.group.position.distanceTo(pos) - 0.03;
      if (d < bestD) { bestD = d; best = item; }
    };
    this.slots.forEach((sk) => sk && consider(sk));
    this.loose.forEach(consider);
    if (this.shaker.state !== 'held') {
      const sp = _v.copy(this.shaker.group.position); sp.y += 0.05;
      const d = sp.distanceTo(pos) - 0.025;
      if (d < bestD) { bestD = d; best = this.shaker; }
    }
    if (this.fan.state !== 'held') {
      const fp = this.fan.group.position;
      const d = Math.min(fp.distanceTo(pos), _v.set(0, 0, -0.07).applyQuaternion(this.fan.group.quaternion).add(fp).distanceTo(pos) - 0.02);
      if (d < bestD) { bestD = d; best = this.fan; }
    }
    if (best) {
      const gp = best.group.position;
      if (best.kind === 'skewer') return { item: best, pos: _aim.set(gp.x, gp.y + 0.012, THREE.MathUtils.clamp(pos.z, gp.z - 0.1, gp.z + 0.12)), r: 0.022 };
      if (best.kind === 'shaker') return { item: best, pos: _aim.set(gp.x, CY + 0.004, gp.z), r: 0.032 };
      if (best.kind === 'fan') return { item: best, pos: _aim.copy(gp).add(_v.set(0, 0, -0.07).applyQuaternion(this.fan.group.quaternion)).setY(gp.y + 0.006), r: 0.055 };
      return { item: best, pos: _aim.copy(gp).setY(gp.y + 0.01), r: 0.05 };
    }
    if (pos.y < CY + 0.13) {
      let tc = null, bx = 0.034;
      for (const c of this.trayComps) { const dx = Math.abs(pos.x - c.x); if (dx < bx && Math.abs(pos.z - c.z) < T.d / 2 + 0.03) { bx = dx; tc = c; } }
      if (tc && this.available.meats.includes(tc.meat)) return { item: tc, pos: _aim.set(tc.x, CY + 0.034, THREE.MathUtils.clamp(pos.z, tc.z - 0.1, tc.z + 0.1)), r: 0.024 };
    }
    if (pos.y < CY + 0.15) {
      for (const b of this.bowls) if (Math.hypot(pos.x - b.x, pos.z - b.z) < BW.r + 0.02 && this.available.sides.includes(b.side)) return { item: b, pos: _aim.set(b.x, CY + 0.042, b.z), r: 0.036 };
    }
    if (this.contents.meats.length && Math.abs(pos.x - B.x) < PAPER.w / 2 + 0.02 && Math.abs(pos.z - B.z) < PAPER.d / 2 + 0.02 && pos.y < PAPER.y + 0.12) {
      return { item: this.paper, pos: _aim.set(B.x, PAPER.y + 0.004, B.z), r: 0.09 };
    }
    return null;
  }

  // ---------------------------------------------------------------- grabbing
  _isHeld(item) { for (const [, h] of this.held) if (h.item === item) return true; return false; }

  _tryGrab(p) {
    for (const pos of p.candidates ? p.candidates() : [p.pos]) if (this._tryGrabAt(p, pos)) return;
  }

  // Returns true if something was grabbed (or the pinch was used) at `pos`.
  _tryGrabAt(p, pos) {
    // cash first
    if (this.hooks.takeCash(pos)) { p.consumed = true; return true; }
    // loose / grill items
    let best = null, bestD = 0.065;
    const consider = (item) => {
      if (this._isHeld(item)) return;
      const d = item.kind === 'skewer' ? item.dist(pos) : item.group.position.distanceTo(pos) - 0.03;
      if (d < bestD) { bestD = d; best = item; }
    };
    this.slots.forEach((s) => s && consider(s));
    this.loose.forEach(consider);
    if (this.shaker.state !== 'held') {
      const sp = _v.copy(this.shaker.group.position); sp.y += 0.05;
      const d = sp.distanceTo(pos) - 0.025;
      if (d < bestD) { bestD = d; best = this.shaker; }
    }
    if (this.fan.state !== 'held') {
      const fp = this.fan.group.position;
      const d = Math.min(fp.distanceTo(pos), _v.set(0, 0, -0.07).applyQuaternion(this.fan.group.quaternion).add(fp).distanceTo(pos) - 0.02);
      if (d < bestD) { bestD = d; best = this.fan; }
    }
    if (best) { this._grab(p, best); return true; }
    // tray compartments
    if (pos.y < CY + 0.13) {
      let tc = null, bx = 0.034;
      for (const c of this.trayComps) { const dx = Math.abs(pos.x - c.x); if (dx < bx && Math.abs(pos.z - c.z) < T.d / 2 + 0.03) { bx = dx; tc = c; } }
      if (tc) {
        {
          if (!this.available.meats.includes(tc.meat)) { audio.play('click'); this.hooks.emit('unavailable', { meat: tc.meat }); return true; }
          const s = new Skewer(tc.meat);
          this.root.add(s.group);
          s.group.position.copy(pos).add(new THREE.Vector3(0, -0.01, -0.1));
          this._grab(p, s, new THREE.Vector3(0, -0.01, -0.1));
          this.hooks.emit('pickMeat', { meat: tc.meat });
          return true;
        }
      }
    }
    // bowls
    if (pos.y < CY + 0.15) {
      for (const b of this.bowls) {
        if (Math.hypot(pos.x - b.x, pos.z - b.z) < BW.r + 0.02) {
          if (!this.available.sides.includes(b.side)) { audio.play('click'); return true; }
          const g = sideMesh(b.side);
          const item = { kind: 'side', side: b.side, group: g };
          this.root.add(g); g.position.copy(pos);
          this._grab(p, item, new THREE.Vector3(0, -0.012, 0));
          return true;
        }
      }
    }
    // paper (lift to wrap)
    if (Math.abs(pos.x - B.x) < PAPER.w / 2 + 0.02 && Math.abs(pos.z - B.z) < PAPER.d / 2 + 0.02 && pos.y < PAPER.y + 0.12) {
      if (this.contents.meats.length > 0) { this.paperGrab = { p, start: p.pos.clone(), t: performance.now() }; audio.play('grab'); }
      else this.hooks.emit('emptyPaper');
      return true;
    }
    return false;
  }

  _grab(p, item, offset) {
    const off = offset ? offset.clone() : item.group.position.clone().sub(p.pos);
    if (item.kind === 'skewer') {
      const from = item.state;
      if (item.state === 'grill') { this.slots[item.slot] = null; }
      if (item.state === 'rest') this.loose.splice(this.loose.indexOf(item), 1);
      item.from = from;
      item.state = 'held';
      off.y += 0.015;
    } else if (item.kind === 'package') {
      const i = this.loose.indexOf(item); if (i >= 0) this.loose.splice(i, 1);
      item.state = 'held';
    } else if (item.kind === 'fan') {
      item.state = 'held';
      off.set(0, 0, 0);
      this.hooks.emit('fanGrab');
    } else if (item.kind === 'shaker') {
      item.state = 'held';
      off.set(0, -0.06, 0);
      item.lastDir = null;
    }
    setRay(item.group, false);
    this.held.set(p, { item, offset: off, t: performance.now(), startPos: p.pos.clone() });
    audio.play('grab');
  }

  _release(p, h) {
    this.held.delete(p);
    const it = h.item;
    const pos = it.group.position;
    setRay(it.group, true);
    const overGrill = Math.abs(pos.x - G.x) < G.w / 2 + 0.03 && Math.abs(pos.z - SKEWER_Z) < G.d / 2 + 0.06 && pos.y < GRATE_Y + 0.25;
    const overPaper = Math.abs(pos.x - B.x) < PAPER.w / 2 + 0.04 && Math.abs(pos.z - B.z) < PAPER.d / 2 + 0.05 && pos.y < PAPER.y + 0.28;
    const overBin = Math.hypot(pos.x - BIN.x, pos.z - BIN.z) < BIN.r + 0.06 && pos.y < CY + 0.3;

    if (it.kind === 'shaker') { this._returnShaker(); return; }
    if (it.kind === 'fan') { this._returnFan(); return; }

    if (it.kind === 'side') {
      if (overPaper) this._addSide(it);
      else { audio.play('drop'); }
      this._removeItem(it);
      return;
    }

    if (it.kind === 'skewer') {
      if (overBin) { this._removeItem(it); audio.play('drop'); this.hooks.emit('discard'); return; }
      if (overGrill) {
        const slot = this._nearestFreeSlot(pos.x, it.from === 'grill' ? it.slot : -1);
        if (slot >= 0) {
          const flipping = it.from === 'grill';
          this.slots[slot] = it; it.slot = slot; it.state = 'grill';
          it.group.position.set(slotX(slot), GRATE_Y + 0.012, SKEWER_Z);
          if (flipping) { it.flip(); audio.play('flip'); this.hooks.emit('flip'); }
          else { audio.play('sizzleHit'); this.hooks.emit('place', { meat: it.meat }); }
          return;
        }
      }
      if (overPaper) { this._skewerToPaper(it); return; }
      this._rest(it, 0.012);
      return;
    }

    if (it.kind === 'package') {
      const target = this.hooks.findServeTarget(pos);
      if (target) { this.hooks.serve(target, it.contents); this._removeItem(it); audio.play('serve'); this.hooks.emit('serve'); return; }
      if (overBin) { this._removeItem(it); audio.play('drop'); this.hooks.emit('discard'); return; }
      this._rest(it, 0.025);
    }
  }

  _rest(it, y) {
    const C = LAYOUT.counter;
    it.group.position.x = THREE.MathUtils.clamp(it.group.position.x, C.x0 + 0.05, C.x1 - 0.05);
    it.group.position.z = THREE.MathUtils.clamp(it.group.position.z, C.z0 + 0.12, C.z1 - 0.02);
    it.group.position.y = CY + y;
    it.state = 'rest';
    this.loose.push(it);
    audio.play('drop');
  }

  _nearestFreeSlot(x, prefer) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.slots[i]) continue;
      const d = Math.abs(slotX(i) - x) - (i === prefer ? 0.03 : 0);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  _returnShaker(instant = false) {
    const sh = this.shaker;
    for (const [p, h] of this.held) if (h.item === sh) this.held.delete(p);
    if (instant) { sh.group.position.copy(sh.home); sh.group.rotation.set(0, 0, 0); sh.state = 'rest'; return; }
    sh.state = 'returning';
  }

  _updateShaking(sh, p, dt) {
    sh.cool -= dt;
    const gp = sh.group.position;
    const overPaper = Math.abs(gp.x - B.x) < PAPER.w / 2 + 0.05 && Math.abs(gp.z - B.z) < PAPER.d / 2 + 0.06 && gp.y < PAPER.y + 0.45;
    const v = p.vel, speed = v.length();
    sh.group.rotation.z = THREE.MathUtils.lerp(sh.group.rotation.z, overPaper ? 2.4 : 0, Math.min(1, dt * 8)); // tilt to pour
    if (!overPaper) { sh.pour = 0; }
    let shake = false;
    if (speed > 0.22) {
      const dir = _pv.copy(v).divideScalar(speed);
      if (!sh.lastDir) sh.lastDir = dir.clone();
      else if (dir.dot(sh.lastDir) < -0.2 && sh.cool <= 0) { sh.lastDir.copy(dir); sh.cool = 0.07; shake = overPaper; }
    }
    // Holding the tilted shaker still over the paper also pours, slowly (one shake every 0.6 s).
    // Shaking is faster; this makes pepper possible for anyone whose shakes don't register.
    if (overPaper && !shake) { sh.pour = (sh.pour || 0) + dt; if (sh.pour > 0.6) { sh.pour = 0; shake = true; } }
    if (shake) {
      sh.pour = 0;
      this.contents.shakes++;
      this.pepperLayer.material.opacity = Math.min(0.95, this.contents.shakes / 7);
      audio.play('shake');
      for (let i = 0; i < 14; i++) this.pepperFx.emit(gp.x + (Math.random() - 0.5) * 0.02, gp.y - 0.01, gp.z + (Math.random() - 0.5) * 0.02, { vy: -0.3, spread: 0.18, life: 0.6, size: 0.004, color: Math.random() < 0.5 ? 0x8a2a10 : 0xb8642a, gravity: 2 });
      this.hooks.emit('pepper', { shakes: this.contents.shakes, level: pepperLevel(this.contents.shakes) });
    }
  }

  _skewerToPaper(s) {
    const n = this.contents.meats.length;
    this.contents.meats.push({ type: s.meat, cook: s.cook.slice() });
    // copy chunks onto the paper in a little pile
    const base = new THREE.Vector3((n % 2 ? 0.045 : -0.045) + (Math.random() - 0.5) * 0.02, 0.008 + Math.floor(n / 2) * 0.014, (n % 2 ? -0.01 : 0.01));
    const ch = s.chunkRoot.children[0];
    const c = new THREE.Mesh(ch.geometry, s.mats); // keep materials: skewer is discarded without disposing them
    c.position.set(base.x, base.y, base.z);
    c.rotation.set(0, Math.PI / 2 + (Math.random() - 0.5) * 0.5, s.down === 1 ? 0 : Math.PI);
    if (s.down !== 1) c.position.y += 0.012;
    noRay(c);
    this.paperContent.add(c);
    if (s.group.parent) s.group.parent.remove(s.group);
    audio.play('slide');
    this.hooks.emit('toPaper', { meat: s.meat, done: doneness(s.cook) });
  }

  _addSide(it) {
    const count = this.paperContent.children.filter((c) => c.userData.side === it.side).length;
    if (!this.contents.sides.includes(it.side)) this.contents.sides.push(it.side);
    if (count < 4) {
      for (let k = 0; k < 2; k++) {
        const g = sideMesh(it.side); g.userData.side = it.side;
        g.position.set((Math.random() - 0.5) * 0.15, 0.022 + Math.random() * 0.01, (Math.random() - 0.5) * 0.12);
        g.rotation.y = Math.random() * 3;
        noRay(g);
        this.paperContent.add(g);
      }
    }
    audio.play('side');
    this.hooks.emit('side', { side: it.side });
  }

  _wrap(p) {
    this.paperGrab = null;
    const contents = { ...this.contents, meats: this.contents.meats.slice(), sides: this.contents.sides.slice(), pepper: pepperLevel(this.contents.shakes) };
    const g = new THREE.Group();
    const bundle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.075), lambert(0xffffff, { map: this.paperTex }));
    bundle.rotation.y = 0.2;
    g.add(bundle);
    const twist = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), lambert(0xe8e2d0, { map: this.paperTex }));
    twist.position.set(0.06, 0, 0); twist.rotation.z = Math.PI / 2; g.add(twist);
    if (contents.shakes > 0) {
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0x8a3a10, transparent: true, opacity: 0.35 }));
      stain.rotation.x = -Math.PI / 2; stain.position.y = 0.0231; stain.rotation.z = 0.4; g.add(stain);
    }
    const item = { kind: 'package', group: g, contents, state: 'held' };
    this.root.add(g);
    g.position.copy(p.pos).add(new THREE.Vector3(0, -0.02, 0));
    this.resetPaper();
    setRay(g, false);
    this.held.set(p, { item, offset: new THREE.Vector3(0, -0.02, 0), t: performance.now(), startPos: p.pos.clone() });
    audio.play('wrap');
    this.hooks.emit('wrap', { contents });
  }

  // anchors for tutorial highlights (stall-local)
  anchor(name, arg) {
    switch (name) {
      case 'grill': return new THREE.Vector3(G.x, GRATE_Y + 0.02, G.z);
      case 'tray': { const tc = this.trayComps.find((c) => c.meat === arg) || this.trayComps[0]; return new THREE.Vector3(tc.x, CY + 0.03, tc.z); }
      case 'paper': return new THREE.Vector3(B.x, PAPER.y + 0.01, B.z);
      case 'fan': return this.fan.home.clone().add(new THREE.Vector3(-0.04, 0.01, 0));
      case 'shaker': return this.shaker.home.clone().add(new THREE.Vector3(0, 0.005, 0));
      case 'bowl': { const b = this.bowls.find((x) => x.side === arg) || this.bowls[0]; return new THREE.Vector3(b.x, CY + 0.005, b.z); }
      case 'grillSkewer': { const s = this.slots.find(Boolean); return s ? s.group.position.clone() : this.anchor('grill'); }
    }
    return null;
  }
}

function colorize(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function stripUV(g) { g.deleteAttribute('uv'); return g; }
// Free GPU memory of a throwaway object (geometries + materials; shared textures are left alone).
function disposeTree(o) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat?.dispose();
  });
}

function makeNewspaperTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#e8e3d4'; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#2a2a2a'; x.font = FONT(44, 900); x.fillText('DAILY GIST', 20, 56);
  x.font = FONT(20, 700); x.fillText('NEPA PROMISES 24-HOUR LIGHT (AGAIN)', 20, 92);
  for (let col = 0; col < 3; col++) for (let row = 0; row < 26; row++) {
    x.fillStyle = `rgba(40,40,40,${0.35 + Math.random() * 0.3})`;
    x.fillRect(20 + col * 165, 115 + row * 15, 140 - Math.random() * 30, 6);
  }
  x.fillStyle = '#9a9a9a'; x.fillRect(200, 300, 130, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.7, 0.7);
  return t;
}
function makeWovenTexture(dyed = false) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c99a52'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const odd = (i + j) % 2;
    x.fillStyle = dyed && (i + j) % 6 < 2 ? (odd ? '#c0302a' : '#2a7a4a') : odd ? '#e0b86c' : '#a87436';
    x.fillRect(i * 8 + (odd ? 1 : 0), j * 8 + (odd ? 0 : 1), odd ? 6 : 8, odd ? 8 : 6);
  }
  x.strokeStyle = '#7a2a1a'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = '#2a6a3a'; x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 30, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeSpeckleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const r = Math.random();
    x.fillStyle = r < 0.5 ? 'rgba(140,40,10,0.9)' : r < 0.85 ? 'rgba(190,100,40,0.85)' : 'rgba(60,20,5,0.9)';
    const rx = 128 + (Math.random() - 0.5) * 240 * Math.sqrt(Math.random()), ry = 128 + (Math.random() - 0.5) * 240 * Math.sqrt(Math.random());
    x.fillRect(rx, ry, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
