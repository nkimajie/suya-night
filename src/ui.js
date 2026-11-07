import * as THREE from 'three';
import { CY, naira } from './config.js';
import { makePanel, FONT, roundRect, wrapText, fitFont } from './text.js';
import { audio } from './audio.js';

const _v = new THREE.Vector3();
const _inv = new THREE.Matrix4();

// A 3D button you can poke with a fingertip or pinch. Works with the mouse too.
export class Button {
  constructor(label, w, h, onPress, { color = '#ffb347', text = '#2a1408', sub = '' } = {}) {
    this.w = w; this.h = h; this.onPress = onPress;
    this.group = new THREE.Group();
    this.face = makePanel(w, h, { pxPerM: 1400, transparent: true });
    this.face.position.z = 0.006;
    this.label = label; this.color = color; this.textColor = text; this.sub = sub;
    this._draw(false);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.94, 0.012), new THREE.MeshBasicMaterial({ color: 0x1a0c05 }));
    back.position.z = -0.002; back.userData.noRay = true;
    this.group.add(back, this.face);
    this.prevZ = new Map();
    this.cool = 0;
    this.pressT = 1;
    this.enabled = true;
  }
  _draw(hover) {
    const { label, color, textColor, sub } = this;
    this.face.redraw((c, w, h) => {
      roundRect(c, 2, 2, w - 4, h - 4, h * 0.3);
      c.fillStyle = hover ? '#fff1c8' : color; c.fill();
      c.lineWidth = 5; c.strokeStyle = '#2a1408'; c.stroke();
      c.fillStyle = textColor; c.textAlign = 'center';
      if (sub) {
        c.font = FONT(h * 0.36, 800); c.fillText(label, w / 2, h * 0.5);
        c.font = FONT(h * 0.2, 600); c.fillText(sub, w / 2, h * 0.8);
      } else { c.font = FONT(h * 0.42, 800); c.fillText(label, w / 2, h * 0.64); }
    });
  }
  update(dt, pointers, world) {
    this.cool -= dt;
    if (this.pressT < 1) { this.pressT = Math.min(1, this.pressT + dt * 5); this.face.position.z = 0.006 - Math.sin(this.pressT * Math.PI) * 0.006; }
    if (!this.enabled || !isShown(this.group)) return false;
    this.group.updateWorldMatrix(true, false);
    _inv.copy(this.group.matrixWorld).invert();
    let hover = false, pressed = false;
    for (const p of pointers) {
      // pointer positions are stall-local -> world -> button-local
      const tip = _v.copy(p.tip); world.localToWorld(tip); tip.applyMatrix4(_inv);
      const inXY = Math.abs(tip.x) < this.w / 2 + 0.005 && Math.abs(tip.y) < this.h / 2 + 0.005;
      const prev = this.prevZ.has(p) ? this.prevZ.get(p) : 1;
      this.prevZ.set(p, tip.z);
      if (inXY && tip.z < 0.06 && tip.z > -0.05) hover = true;
      if (this.cool > 0 || p.consumed) continue;
      const poke = p.kind === 'hand' && inXY && prev >= 0.01 && tip.z < 0.01 && tip.z > -0.04;
      const pinch = p.pinchStarted && Math.abs(tip.x) < this.w / 2 + 0.012 && Math.abs(tip.y) < this.h / 2 + 0.012 && Math.abs(tip.z) < 0.06;
      if (poke || pinch) { pressed = true; p.consumed = true; }
    }
    if (hover !== this.hover) { this.hover = hover; this._draw(hover); }
    if (pressed) {
      this.cool = 0.5; this.pressT = 0;
      audio.play('click');
      this.onPress();
    }
    return pressed;
  }
  dispose() {
    this.face.material.map.dispose(); this.face.material.dispose(); this.face.geometry.dispose();
  }
}
function isShown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

// The main board for menus, story and results. Floats over the counter facing the player.
export class Board {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.position.set(0, -0.1, -0.55);
    this.group.rotation.x = -0.22;
    world.add(this.group);
    this.W = 0.56; this.H = 0.34;
    this.panel = makePanel(this.W, this.H, { pxPerM: 1500 });
    this.panel.userData.noRay = false;
    this.group.add(this.panel);
    this.buttons = [];
    this.group.visible = false;
  }
  show({ title = '', speaker = '', text = '', footer = '', accent = '#ffb347', buttons = [], portrait = null, big = '' }) {
    this.group.visible = true;
    this.panel.redraw((c, w, h) => {
      roundRect(c, 4, 4, w - 8, h - 8, 34);
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(38,20,10,0.95)'); g.addColorStop(1, 'rgba(20,10,5,0.95)');
      c.fillStyle = g; c.fill(); c.lineWidth = 8; c.strokeStyle = accent; c.stroke();
      let y = h * 0.14;
      c.textAlign = 'center';
      if (title) { c.fillStyle = accent; c.font = FONT(h * 0.095, 900); c.fillText(title, w / 2, y); y += h * 0.1; }
      if (big) { c.fillStyle = '#fff3d6'; c.font = FONT(h * 0.07, 800); y = wrapText(c, big, w / 2, y + h * 0.02, w * 0.88, h * 0.085, 'center'); }
      if (speaker) { c.fillStyle = '#ffcf7a'; c.font = FONT(h * 0.06, 800); c.textAlign = 'left'; c.fillText(speaker.toUpperCase(), w * 0.06, y + h * 0.02); y += h * 0.09; }
      if (text) { c.fillStyle = '#f6e7d0'; c.font = FONT(h * 0.058, 600); y = wrapText(c, text, speaker ? w * 0.06 : w / 2, y + h * 0.02, w * 0.88, h * 0.075, speaker ? 'left' : 'center'); }
      if (footer) { c.fillStyle = 'rgba(246,231,208,0.6)'; c.font = FONT(h * 0.04, 600); c.textAlign = 'center'; c.fillText(footer, w / 2, h * 0.95); }
    });
    for (const b of this.buttons) { this.group.remove(b.group); b.dispose(); }
    this.buttons = [];
    const n = buttons.length;
    const bw = Math.min(0.2, (this.W - 0.06) / Math.max(1, n) - 0.02), bh = 0.058;
    buttons.forEach((def, i) => {
      const b = new Button(def.label, bw, bh, def.onPress, def.style || {});
      b.group.position.set((i - (n - 1) / 2) * (bw + 0.02), -this.H / 2 + bh / 2 + 0.035, 0.01);
      this.group.add(b.group);
      this.buttons.push(b);
    });
  }
  hide() { this.group.visible = false; }
  update(dt, pointers) {
    if (!this.group.visible) return;
    for (const b of this.buttons.slice()) if (b.update(dt, pointers, this.world)) break;
  }
}

// Chalkboard HUD on the left post.
export class Hud {
  constructor(world) {
    this.panel = makePanel(0.2, 0.15, { pxPerM: 1500 });
    this.panel.position.set(0.56, 0.04, -0.6);
    this.panel.rotation.set(-0.05, -0.75, 0, 'YXZ');
    this.panel.userData.noRay = true;
    world.add(this.panel);
    this.last = '';
    this.panel.visible = false;
  }
  set(d) {
    const key = JSON.stringify(d);
    if (key === this.last) return;
    this.last = key;
    this.panel.redraw((c, w, h) => {
      roundRect(c, 4, 4, w - 8, h - 8, 16); c.fillStyle = '#1d2a22'; c.fill(); c.lineWidth = 12; c.strokeStyle = '#7a4a22'; c.stroke();
      c.fillStyle = '#e8f0e0'; c.textAlign = 'left'; c.font = FONT(h * 0.1, 700);
      c.fillText(`NIGHT ${d.night}`, w * 0.07, h * 0.17);
      c.textAlign = 'right'; c.fillText(d.time, w * 0.93, h * 0.17);
      c.textAlign = 'left';
      c.fillStyle = d.money >= d.target ? '#8ff09a' : '#ffe08a'; c.font = FONT(h * 0.16, 900); c.fillText(naira(d.money), w * 0.07, h * 0.42);
      if (d.combo > 1) { c.textAlign = 'right'; c.fillStyle = '#ffb347'; c.font = FONT(h * 0.11, 900); c.fillText(`COMBO ×${d.combo}`, w * 0.93, h * 0.41); c.textAlign = 'left'; }
      c.fillStyle = '#c8d6c0'; c.font = FONT(h * 0.085, 600); c.fillText(`Target ${naira(d.target)}`, w * 0.07, h * 0.56);
      // progress bar
      const pf = Math.min(1, d.money / d.target);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(w * 0.07, h * 0.62, w * 0.86, h * 0.06);
      c.fillStyle = pf >= 1 ? '#8ff09a' : '#ffb347'; c.fillRect(w * 0.07, h * 0.62, w * 0.86 * pf, h * 0.06);
      c.fillStyle = '#ffd34d'; c.font = FONT(h * 0.12, 700);
      const stars = Math.round(d.rating * 2) / 2;
      let s = ''; for (let i = 1; i <= 5; i++) s += stars >= i ? '★' : stars >= i - 0.5 ? '⯨' : '☆';
      c.fillText(d.served ? s : '☆☆☆☆☆', w * 0.07, h * 0.86);
      c.fillStyle = '#c8d6c0'; c.font = FONT(h * 0.075, 600); c.textAlign = 'right';
      c.fillText(d.served ? `${d.rating.toFixed(1)} (${d.served})` : 'no ratings', w * 0.93, h * 0.85);
    });
  }
}

// Papa's notebook: tutorial steps and tips.
export class Notebook {
  constructor(world) {
    this.panel = makePanel(0.22, 0.17, { pxPerM: 1500 });
    this.panel.position.set(-0.47, -0.04, -0.5);
    this.panel.rotation.set(-0.25, 0.75, 0.0);
    this.panel.userData.noRay = true;
    world.add(this.panel);
    this.panel.visible = false;
  }
  show(title, lines, highlightIndex = -1, done = []) {
    this.panel.visible = true;
    this.panel.redraw((c, w, h) => {
      c.fillStyle = '#efe4c8'; roundRect(c, 4, 4, w - 8, h - 8, 12); c.fill();
      c.strokeStyle = 'rgba(80,120,200,0.25)'; c.lineWidth = 2;
      for (let y = h * 0.22; y < h; y += h * 0.075) { c.beginPath(); c.moveTo(10, y); c.lineTo(w - 10, y); c.stroke(); }
      c.strokeStyle = 'rgba(200,60,60,0.4)'; c.beginPath(); c.moveTo(w * 0.08, 6); c.lineTo(w * 0.08, h - 6); c.stroke();
      c.fillStyle = '#5a2a0a'; fitFont(c, title, w * 0.85, h * 0.085); c.textAlign = 'left'; c.fillText(title, w * 0.11, h * 0.12);
      let y = h * 0.24;
      lines.forEach((ln, i) => {
        const isCur = i === highlightIndex, isDone = done[i];
        c.fillStyle = isDone ? 'rgba(40,90,40,0.75)' : isCur ? '#9a1a0a' : '#2a1a0a';
        c.font = FONT(h * (isCur ? 0.068 : 0.058), isCur ? 800 : 600);
        y = wrapText(c, (isDone ? '✓ ' : isCur ? '▶ ' : '• ') + ln, w * 0.11, y + h * 0.03, w * 0.85, h * (isCur ? 0.075 : 0.065));
      });
    });
  }
  hide() { this.panel.visible = false; }
}

// Pulsing ring + bobbing arrow that points at the next thing to do.
export class Highlight {
  constructor(world) {
    this.group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 10;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.035, 10), new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false }));
    arrow.rotation.x = Math.PI; arrow.renderOrder = 10;
    this.group.add(ring, arrow);
    this.group.traverse((o) => { o.userData.noRay = true; });
    this.ring = ring; this.arrow = arrow;
    world.add(this.group);
    this.group.visible = false;
  }
  at(pos, radius = 0.05) {
    if (!pos) { this.group.visible = false; return; }
    this.group.visible = true;
    this.group.position.copy(pos);
    this.radius = radius;
  }
  update(t) {
    if (!this.group.visible) return;
    const s = (this.radius / 0.05) * (1 + Math.sin(t * 5) * 0.12);
    this.ring.scale.set(s, s, s);
    this.arrow.position.y = 0.1 + Math.sin(t * 4) * 0.015;
  }
}

export { CY };
