import * as THREE from 'three';
import { CY, LAYOUT } from './config.js';
import { makePanel, FONT, roundRect, fitFont } from './text.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FLOOR_Y = -1.2; // seated eye height ≈ 1.2 m above the street
export const GEN_AT = { x: -1.14, z: -1.02 }; // bought generator on its crate, clear of the counter

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

// Builds the night street + stall shell. Everything is parented to `world` (the stall root)
// so recentering moves the whole scene with the player.
export function buildEnvironment(world) {
  const env = { lights: {} };

  // --- Sky dome ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x050816) }, mid: { value: new THREE.Color(0x15122e) }, glow: { value: new THREE.Color(0x4a2a32) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 glow;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){ float y = vP.y; vec3 c = mix(glow, mid, smoothstep(-0.02, 0.25, y)); c = mix(c, top, smoothstep(0.25, 0.9, y));
          vec2 g = floor(vP.xz / max(0.2, y) * 140.0); float s = step(0.9975, h(g)) * smoothstep(0.3, 0.6, y);
          gl_FragColor = vec4(c + s * 0.7, 1.0); }`,
    }),
  );
  sky.userData.noRay = true;
  world.add(sky);

  // --- Ground with road ---
  const groundTex = makeGroundTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lambert(0xffffff, { map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR_Y;
  ground.userData.noRay = true;
  world.add(ground);

  // --- Buildings across the road with lit windows ---
  const winTex = makeWindowTexture();
  const rng = mulberry(7);
  const bGeos = [], wGeos = [];
  let x = -16;
  while (x < 16) {
    const w = 2.5 + rng() * 3.5, h = 3 + rng() * 7, d = 4;
    const col = new THREE.Color().setHSL(0.06 + rng() * 0.08, 0.15, 0.12 + rng() * 0.08);
    const bz = -12 - rng() * 2;
    const bg = new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x + w / 2, FLOOR_Y + h / 2, bz);
    bg.deleteAttribute('uv');
    const cols = new Float32Array(bg.attributes.position.count * 3);
    for (let i = 0; i < cols.length; i += 3) { cols[i] = col.r; cols[i + 1] = col.g; cols[i + 2] = col.b; }
    bg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    bGeos.push(bg);
    // window plane with the repeat/offset baked into its UVs so all windows share one draw call
    const wg = new THREE.PlaneGeometry(w * 0.9, h * 0.85).translate(x + w / 2, FLOOR_Y + h / 2, bz + d / 2 + 0.01);
    const rx = Math.max(1, Math.round(w / 1.6)), ry = Math.max(1, Math.round(h / 2.2)), ox = Math.floor(rng() * 4) / 4, oy = Math.floor(rng() * 4) / 4;
    const uv = wg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx + ox, uv.getY(i) * ry + oy);
    wGeos.push(wg);
    x += w + 0.3 + rng() * 1.2;
  }
  const buildings = new THREE.Mesh(mergeGeometries(bGeos), lambert(0xffffff, { vertexColors: true }));
  buildings.userData.noRay = true; world.add(buildings);
  const windows = new THREE.Mesh(mergeGeometries(wGeos), new THREE.MeshBasicMaterial({ map: winTex, transparent: true, toneMapped: false }));
  windows.userData.noRay = true; world.add(windows);

  // --- Street lights (emissive + fake glow, no real light) ---
  const glowTex = makeGlowTexture();
  for (const sx of [-5, 4.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.5, 8), lambert(0x2a2a2a));
    pole.position.set(sx, FLOOR_Y + 2.75, -6); pole.userData.noRay = true; world.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb25a }));
    lamp.position.set(sx, FLOOR_Y + 5.5, -5.6); lamp.userData.noRay = true; world.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a3c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    glow.scale.set(3, 3, 1); glow.position.copy(lamp.position); world.add(glow);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff8a2a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(sx, FLOOR_Y + 0.01, -5.6); pool.userData.noRay = true; world.add(pool);
  }

  // --- Neighbour kiosk (music source) ---
  const kiosk = new THREE.Group(); kiosk.position.set(2.7, FLOOR_Y, -2.6); kiosk.rotation.y = -0.5; world.add(kiosk);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 1.4), lambert(0x2b3a4a)); kb.position.y = 1.15; kiosk.add(kb);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 1.42), new THREE.MeshBasicMaterial({ color: 0xc04cff })); strip.position.y = 2.0; kiosk.add(strip);
  const ksign = makePanel(1.6, 0.4, { pxPerM: 300, draw: (c, w, h) => {
    c.fillStyle = '#16101f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffdd55'; c.font = FONT(h * 0.36, 800); c.textAlign = 'center';
    c.fillText('BEST BROS MUSIC', w / 2, h * 0.45); c.fillStyle = '#7ff'; c.font = FONT(h * 0.24, 700); c.fillText('& PHONE ACCESSORIES', w / 2, h * 0.82);
  } });
  ksign.position.set(0, 2.35, 0.72); kiosk.add(ksign);
  const kopen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.2), new THREE.MeshBasicMaterial({ color: 0x3a1d50 })); kopen.position.set(0, 1.1, 0.71); kiosk.add(kopen);
  kiosk.traverse((o) => { o.userData.noRay = true; });
  const shopLight = new THREE.PointLight(0xb05cff, 3, 6, 2); shopLight.position.set(2.3, FLOOR_Y + 1.6, -1.9); world.add(shopLight);
  env.lights.shop = shopLight; env.kioskStrip = strip; env.kioskOpen = kopen;

  // --- Generator behind-left of the player ---
  const gen = new THREE.Group(); gen.position.set(-1.25, FLOOR_Y, 0.35); world.add(gen);
  const gbody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.42), lambert(0xc8a020)); gbody.position.y = 0.3; gen.add(gbody);
  const gframe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.46), lambert(0x222222)); gframe.position.y = 0.06; gen.add(gframe);
  gen.traverse((o) => { o.userData.noRay = true; });
  env.generator = gen;

  // --- Parked okada ---
  const bike = buildOkada(); bike.position.set(-2.4, FLOOR_Y, -2.2); bike.rotation.y = 0.9; world.add(bike);

  // --- The stall shell ---
  const C = LAYOUT.counter;
  const wood = makeWoodTexture();
  const counterH = CY - FLOOR_Y;
  const body = new THREE.Mesh(new THREE.BoxGeometry(C.x1 - C.x0 + 0.1, counterH - 0.03, C.z1 - C.z0 + 0.06), lambert(0x6b4226, { map: wood }));
  body.position.set((C.x0 + C.x1) / 2, FLOOR_Y + (counterH - 0.03) / 2, (C.z0 + C.z1) / 2 - 0.02);
  world.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(C.x1 - C.x0 + 0.14, 0.03, C.z1 - C.z0 + 0.1), lambert(0x8a5a33, { map: wood }));
  top.position.set((C.x0 + C.x1) / 2, CY - 0.015, (C.z0 + C.z1) / 2 - 0.02);
  top.name = 'counterTop';
  world.add(top);
  env.counterTop = top;

  // Front sign facing the street (customers' side) and a painted sign facing the player
  const front = makePanel(1.2, 0.3, { pxPerM: 500, transparent: false, draw: (c, w, h) => drawStallSign(c, w, h) });
  env.signs = [front];
  front.position.set(0, CY - 0.2, C.z0 - 0.06); front.rotation.y = Math.PI; front.userData.noRay = true; world.add(front);

  const posts = [];
  for (const [px, pz] of [[C.x0 - 0.03, C.z0 - 0.02], [C.x1 + 0.03, C.z0 - 0.02], [C.x0 - 0.03, 0.25], [C.x1 + 0.03, 0.25]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), lambert(0x4a2e1a, { map: wood }));
    p.position.set(px, FLOOR_Y + 1.1, pz); p.userData.noRay = true; world.add(p); posts.push(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 1.5), lambert(0x7d8790, { map: makeCorrugatedTexture() }));
  roof.position.set(0, FLOOR_Y + 2.22, -0.3); roof.rotation.x = -0.08; roof.userData.noRay = true; world.add(roof);
  const valance = makePanel(1.3, 0.24, { pxPerM: 500, transparent: false, draw: (c, w, h) => drawStallSign(c, w, h) });
  env.signs.push(valance);
  valance.position.set(0, FLOOR_Y + 2.05, C.z0 - 0.08); valance.rotation.y = Math.PI; valance.userData.noRay = true; world.add(valance);
  // Inner valance facing the player (readable)
  const drawInner = (son) => (c, w, h) => {
    c.fillStyle = son ? '#0f4a2a' : '#20120a'; c.fillRect(0, 0, w, h); c.fillStyle = son ? '#ffd34d' : '#ffcf7a'; c.textAlign = 'center';
    fitFont(c, son ? 'MALLAM SANI & SON SUYA • SINCE 1996' : 'MALLAM SANI SUYA • SINCE 1996', w * 0.94, h * 0.42, 800);
    c.fillText(son ? 'MALLAM SANI & SON SUYA • SINCE 1996' : 'MALLAM SANI SUYA • SINCE 1996', w / 2, h * 0.6);
  };
  const inner = makePanel(1.1, 0.16, { pxPerM: 500, transparent: false, draw: drawInner(false) });
  inner.position.set(0, FLOOR_Y + 2.0, C.z0 - 0.04); inner.userData.noRay = true; world.add(inner);

  // Hanging bulb
  const roofY = FLOOR_Y + 2.2, bulbY = 0.5;
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, roofY - bulbY, 4), lambert(0x111111));
  wire.position.set(0.0, (roofY + bulbY) / 2, -0.55); wire.userData.noRay = true; world.add(wire);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  bulb.position.set(0.0, bulbY, -0.55); bulb.userData.noRay = true; world.add(bulb);
  const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  bulbGlow.scale.set(0.5, 0.5, 1); bulbGlow.position.copy(bulb.position); world.add(bulbGlow);
  const bulbLight = new THREE.PointLight(0xffc27a, 2.2, 5, 1.6); bulbLight.position.copy(bulb.position); world.add(bulbLight);
  env.bulb = bulb; env.bulbGlow = bulbGlow; env.lights.bulb = bulbLight;

  // Lantern (used during NEPA blackout)
  const lantern = buildLantern(glowTex); lantern.position.set(-0.52, CY, -0.70); lantern.visible = false; world.add(lantern);
  env.lantern = lantern;

  const hemi = new THREE.HemisphereLight(0x5a6aa8, 0x2a1a10, 0.9); world.add(hemi);
  env.lights.hemi = hemi;

  // ---- Shop upgrades & story props (all emissive / unlit: no extra lights) ----
  // Canopy lights: a sagging string of coloured bulbs across the front of the stall (1 draw call).
  const bulbGeos = [], bulbCols = [0xffd34d, 0xff5a3a, 0x5ae07a, 0x5aa0ff, 0xff8ad8];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, bx = -0.64 + t * 1.28, by = 0.7 - 0.06 * (1 - (2 * t - 1) ** 2);
    const bg = new THREE.SphereGeometry(0.016, 6, 4).toNonIndexed().translate(bx, by, C.z0 - 0.07);
    bg.deleteAttribute('uv'); bg.deleteAttribute('normal');
    const col = new THREE.Color(bulbCols[i % bulbCols.length]);
    const arr = new Float32Array(bg.attributes.position.count * 3);
    for (let k = 0; k < arr.length; k += 3) { arr[k] = col.r; arr[k + 1] = col.g; arr[k + 2] = col.b; }
    bg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    bulbGeos.push(bg);
  }
  const lightString = new THREE.Mesh(mergeGeometries(bulbGeos), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  lightString.userData.noRay = true; lightString.visible = false; world.add(lightString);
  const lightGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.3), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  lightGlow.scale.set(1, 1, 1); lightGlow.position.set(0, 0.67, C.z0 - 0.08); lightGlow.userData.noRay = true; lightGlow.visible = false; world.add(lightGlow);
  env.lightString = lightString;

  // Tip tin on the counter (right of the cutting board)
  const tinGeos = [];
  const tinC = (geo, c) => { geo = geo.toNonIndexed(); geo.deleteAttribute('uv'); const col = new THREE.Color(c); const a = new Float32Array(geo.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = col.r; a[k + 1] = col.g; a[k + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  tinGeos.push(tinC(new THREE.CylinderGeometry(0.034, 0.034, 0.06, 14, 1, true).translate(0, 0.03, 0), 0xb8c0c8));
  tinGeos.push(tinC(new THREE.CylinderGeometry(0.031, 0.031, 0.004, 14).translate(0, 0.05, 0), 0x6a4ab0));
  for (let k = 0; k < 4; k++) tinGeos.push(tinC(new THREE.BoxGeometry(0.03, 0.002, 0.014).rotateY(k * 0.8).translate((k - 1.5) * 0.008, 0.053 + k * 0.002, (k % 2) * 0.006), k % 2 ? 0x2f6a5a : 0x8a5aba));
  tinGeos.push(tinC(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 14).translate(0, 0.004, 0), 0xc0282a));
  const tin = new THREE.Mesh(mergeGeometries(tinGeos), lambert(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  tin.position.set(LAYOUT.tin.x, CY, LAYOUT.tin.z); tin.userData.noRay = true; tin.visible = false; world.add(tin);
  env.tin = tin;

  // Gbam Burger (fictional chain) "Suya Burger" shop sign across the road (Night 7+). Teal and purple, no real brand's colours.
  const rival = makePanel(2.6, 0.75, { pxPerM: 160, transparent: false, draw: (c, w, h) => {
    c.fillStyle = '#0f7f78'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a1f96'; c.fillRect(0, h * 0.78, w, h * 0.22);
    c.fillStyle = '#e8fff9'; c.textAlign = 'center'; fitFont(c, 'GBAM BURGER!', w * 0.9, h * 0.5, 900); c.fillText('GBAM BURGER!', w / 2, h * 0.52);
    c.fillStyle = '#f3e6ff'; fitFont(c, 'NOW SELLING SUYA BURGER', w * 0.8, h * 0.17, 900); c.fillText('NOW SELLING SUYA BURGER', w / 2, h * 0.95);
  } });
  rival.material.toneMapped = false;
  rival.position.set(0, FLOOR_Y + 4.6, -9.8); rival.userData.noRay = true; rival.visible = false; world.add(rival);
  env.rival = rival;

  // The bought generator: on a crate front-left so it shows above the counter (1 merged mesh)
  const ng = [];
  const box = (w, h, d, x, y, z, c) => ng.push(tinC(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c));
  box(0.62, 0.5, 0.46, 0, 0.25, 0, 0x4a2e1a);                 // crate
  box(0.5, 0.32, 0.34, 0, 0.66, 0, 0xe0b020);                  // body
  box(0.52, 0.03, 0.36, 0, 0.5, 0, 0x1a1a1a);                  // base frame
  for (const [fx, fz] of [[-0.25, -0.17], [0.25, -0.17], [-0.25, 0.17], [0.25, 0.17]]) box(0.025, 0.4, 0.025, fx, 0.7, fz, 0x1a1a1a);
  box(0.52, 0.025, 0.025, 0, 0.9, -0.17, 0x1a1a1a); box(0.52, 0.025, 0.025, 0, 0.9, 0.17, 0x1a1a1a); // carry bars
  box(0.2, 0.12, 0.01, 0.08, 0.64, 0.175, 0x2a2a30);           // control panel
  box(0.03, 0.03, 0.012, 0.03, 0.65, 0.182, 0xe03020); box(0.03, 0.03, 0.012, 0.11, 0.65, 0.182, 0x30a040);
  ng.push(tinC(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10).translate(-0.12, 0.835, 0), 0xc02020)); // fuel cap
  ng.push(tinC(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8).rotateZ(Math.PI / 2).translate(0.32, 0.6, -0.08), 0x777777)); // exhaust
  const newGen = new THREE.Mesh(mergeGeometries(ng), lambert(0xffffff, { vertexColors: true }));
  newGen.position.set(GEN_AT.x, FLOOR_Y, GEN_AT.z); newGen.rotation.y = 0.55; newGen.userData.noRay = true; newGen.visible = false; world.add(newGen);
  const genHome = gen.position.clone();
  env.genExhaust = new THREE.Vector3();
  env.genRunning = false;
  env.setUpgrades = (u) => {
    lightString.visible = lightGlow.visible = !!u.lights;
    env.brighter = u.lights ? 1 : 0;
    tin.visible = !!u.tin;
    // Bought generator stands front-left where you can see it; before that, the old one hides behind you.
    newGen.visible = !!u.generator; gen.visible = !u.generator;
    env.genExhaust.set(GEN_AT.x + Math.cos(0.55) * 0.4, FLOOR_Y + 0.62, GEN_AT.z - Math.sin(0.55) * 0.4);
    const son = !!u.sign;
    if (env._son !== son) {
      env._son = son;
      for (const p of env.signs) p.redraw((c, w, h) => drawStallSign(c, w, h, son));
      inner.redraw(drawInner(son));
    }
    env.setPower(env.power);
  };
  env.setRival = (on) => { rival.visible = !!on; };
  env.setGenRunning = (on) => { env.genRunning = on; if (!on) newGen.position.y = FLOOR_Y; };

  env.power = true;
  env.setPower = (on) => {
    env.power = on;
    bulb.visible = on; bulbGlow.visible = on;
    lantern.visible = !on;
    bulbLight.color.set(on ? 0xffc27a : 0xff9a40);
    bulbLight.intensity = on ? 2.2 + (env.brighter || 0) * 0.5 : 0.9;
    lightString.material.color.setScalar(on ? 1 : 0.15);
    bulbLight.position.copy(on ? bulb.position : lantern.position.clone().add(new THREE.Vector3(0, 0.2, 0)));
    shopLight.intensity = on ? 3 : 0;
    strip.material.color.set(on ? 0xc04cff : 0x222222);
    kopen.material.color.set(on ? 0x3a1d50 : 0x0c0a10);
    hemi.intensity = on ? 0.9 + (env.brighter || 0) * 0.15 : 0.45;
  };
  env.update = (t) => {
    if (!on()) {
      bulbLight.intensity = 0.8 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
      lantern.userData.flame.scale.y = 1 + Math.sin(t * 17) * 0.1;
    } else {
      strip.material.color.setHSL((t * 0.05) % 1, 0.8, 0.55);
    }
    if (env.genRunning) newGen.position.y = FLOOR_Y + Math.abs(Math.sin(t * 40)) * 0.004; // gen shakes while running
  };
  const on = () => env.power;
  return env;
}

function drawStallSign(c, w, h, son = false) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0f6b3a'); g.addColorStop(1, '#09482a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = son ? '#ffd34d' : '#f5f1e6'; c.lineWidth = h * 0.05; c.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  c.fillStyle = '#ffd34d'; c.textAlign = 'center';
  const name = son ? 'MALLAM SANI & SON' : 'MALLAM SANI SUYA';
  fitFont(c, name, w * 0.86, h * 0.42, 900);
  c.fillText(name, w / 2, h * 0.52);
  c.fillStyle = '#fff'; c.font = FONT(h * 0.2, 700); c.fillText('ALLEN AVENUE • HOT YAJI • SINCE 1996', w / 2, h * 0.82);
}

function buildLantern(glowTex) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 12), lambert(0x8a1a1a)); base.position.y = 0.02; g.add(base);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.1, 12), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.45 })); glass.position.y = 0.09; g.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 })); flame.position.y = 0.09; flame.scale.set(1, 1.8, 1); g.add(flame);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 0.03, 12), lambert(0x8a1a1a)); cap.position.y = 0.155; g.add(cap);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  glow.scale.set(0.35, 0.35, 1); glow.position.y = 0.09; g.add(glow);
  g.userData.flame = flame;
  g.traverse((o) => { o.userData.noRay = true; });
  return g;
}

function buildOkada() {
  const g = new THREE.Group();
  const tire = lambert(0x111111), red = lambert(0xa01818), metal = lambert(0x777777);
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 16), tire); w.position.set(0, 0.32, z); w.rotation.y = Math.PI / 2; g.add(w);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), red); body.position.set(0, 0.6, 0); g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.5), lambert(0x1a1a1a)); seat.position.set(0, 0.78, 0.15); g.add(seat);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), metal); bar.position.set(0, 0.95, -0.5); bar.rotation.z = Math.PI / 2; g.add(bar);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), metal); fork.position.set(0, 0.62, -0.52); fork.rotation.x = 0.3; g.add(fork);
  g.traverse((o) => { o.userData.noRay = true; });
  return g;
}

// ---- Procedural textures ----
function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function makeGroundTexture() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#2a2622'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const v = 30 + Math.random() * 30; c.fillStyle = `rgb(${v},${v - 3},${v - 6})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    // road band: plane is 60m; road from z=-4..-9 → rows ~ (30-9)/60..(30-4)/60 of texture height
    const y0 = h * (21 / 60), y1 = h * (26 / 60);
    c.fillStyle = '#1b1a1c'; c.fillRect(0, y0, w, y1 - y0);
    c.fillStyle = '#d8d0b0'; for (let x = 0; x < w; x += 24) c.fillRect(x, (y0 + y1) / 2 - 1, 12, 2);
    c.fillStyle = '#3b352e'; c.fillRect(0, y1, w, 3);
  });
}
function makeWindowTexture() {
  return canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const lit = Math.random() < 0.45;
      c.fillStyle = lit ? (Math.random() < 0.7 ? '#ffcf7a' : '#bfe0ff') : 'rgba(10,10,20,0.85)';
      c.globalAlpha = lit ? 0.75 + Math.random() * 0.25 : 1;
      c.fillRect(x * 32 + 6, y * 32 + 6, 20, 18);
    }
    c.globalAlpha = 1;
  }, [1, 1]);
}
function makeGlowTexture() {
  const t = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  return t;
}
function makeWoodTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#9a6a40'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(60,30,10,${0.1 + Math.random() * 0.25})`; c.lineWidth = 1 + Math.random() * 2; const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); c.stroke(); }
    c.fillStyle = 'rgba(40,20,5,0.5)'; for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 2);
  }, [2, 1]);
}
function makeCorrugatedTexture() {
  return canvasTex(128, 128, (c, w, h) => {
    for (let x = 0; x < w; x++) { const v = 110 + Math.sin(x / 4) * 40; c.fillStyle = `rgb(${v},${v + 5},${v + 10})`; c.fillRect(x, 0, 1, h); }
    c.fillStyle = 'rgba(120,60,20,0.35)'; for (let i = 0; i < 30; i++) c.fillRect(Math.random() * w, Math.random() * h, 8, 6);
  }, [4, 1]);
}
export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export { roundRect };
