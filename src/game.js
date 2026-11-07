import * as THREE from 'three';
import { CY, LAYOUT, NIGHTS, MODES, MEATS, PEPPER_LABEL, naira } from './config.js';
import { Kitchen, doneness } from './kitchen.js';
import { Customer, buildPerson } from './customers.js';
import { CHARACTERS, genericCharacter, COMPLAINTS, pick, INTRO, NIGHT_INTRO, NIGHT_PASS, NIGHT_FAIL, ENDING_GOOD, ENDING_BAD_BLOGGER } from './story.js';
import { Board, Hud, Notebook, Highlight, Button } from './ui.js';
import { makePanel, FONT, roundRect, fitFont } from './text.js';
import { FLOOR_Y } from './env.js';
import { audio } from './audio.js';
import { Particles } from './fx.js';

// Combo: consecutive 4-5 star serves multiply the tip and add a bonus.
const comboMul = (n) => (n >= 5 ? 3 : n >= 3 ? 2 : n >= 2 ? 1.5 : 1);

// Scripted arrivals per night. Orders are fixed so the story beats always land.
const SCRIPTS = {
  1: [
    { at: 0, who: 'nkechi', order: { meats: ['beef'], pepper: 'plenty', sides: ['onions'] }, tutorial: true },
    { at: 70, who: 'tolu', order: { meats: ['chicken'], pepper: 'normal', sides: [] } },
    { at: 170, who: 'blackcap', order: { meats: ['beef'], pepper: 'none', sides: [] } },
  ],
  2: [
    { at: 4, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa'] } },
    { at: 45, who: 'emeka', order: { meats: ['ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage'] } },
    { at: 110, who: 'femi', order: { meats: ['kidney'], pepper: 'plenty', sides: [] } },
    { at: 175, who: 'tolu', order: { meats: ['beef'], pepper: 'normal', sides: ['onions'] } },
    { at: 225, who: 'blackcap', order: { meats: ['gizzard'], pepper: 'normal', sides: ['tomatoes'] } },
  ],
  3: [
    { at: 3, who: 'nkechi', order: { meats: ['beef', 'beef'], pepper: 'plenty', sides: ['onions'] } },
    { at: 40, who: 'adebayo', order: { meats: ['beef'], pepper: 'normal', sides: ['cabbage'] } },
    { at: 100, who: 'emeka', order: { meats: ['ram', 'ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage', 'masa'] } },
    { at: 150, who: 'femi', order: { meats: ['kidney', 'chicken'], pepper: 'plenty', sides: [] } },
    { at: 190, who: 'blackcap', order: { meats: ['ram', 'kidney', 'gizzard'], pepper: 'plenty', sides: ['onions', 'tomatoes', 'masa'] } },
    { at: 240, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa'] } },
  ],
};

const TUTORIAL = [
  { ev: 'fan', text: 'Pinch the woven FAN and wave it fast over the grill. Watch the fire bar on the grill fill up.', at: (k) => k.anchor('fan'), r: 0.07 },
  { ev: 'place', text: 'Pinch a BEEF stick from the tray and lay it on the grill.', at: (k) => k.anchor('tray', 'beef'), r: 0.035 },
  { ev: 'flip', text: 'Turn it: pinch the stick, lift and put it back down. Cook BOTH sides golden, not black.', at: (k) => k.anchor('grillSkewer'), r: 0.06 },
  { ev: 'toPaper', text: 'Golden on both sides? Drop the stick on the newspaper. The meat slides off.', at: (k) => k.anchor('paper'), r: 0.1 },
  { ev: 'pepperPlenty', text: 'Pinch the YAJI shaker and shake it over the paper. Plenty pepper = 6+ shakes.', at: (k) => k.anchor('shaker'), r: 0.04 },
  { ev: 'side', text: 'Pinch ONIONS from the bowl and drop them on the paper.', at: (k) => k.anchor('bowl', 'onions'), r: 0.05 },
  { ev: 'wrap', text: 'Pinch the newspaper and lift it to wrap the suya.', at: (k) => k.anchor('paper'), r: 0.1 },
  { ev: 'serve', text: 'Hand the wrap to Mama Nkechi: let go near her open hand.', at: (k, g) => g.customerHandAnchor(), r: 0.07 },
  { ev: 'cash', text: 'Pinch the naira note in her hand to take your money.', at: (k, g) => g.customerHandAnchor(), r: 0.07 },
];

const TIPS = {
  1: ['Fire bar low? Grab the fan: cold coals cook slowly.', 'Serve 4★+ in a row for a COMBO bonus.', 'Turn sticks before they smoke black.', 'Read the order card on the counter.', 'Wrong stick? Drop it in the WASTE bucket.'],
  2: ['Two customers at once: grill ahead!', 'Masa costs ₦500 extra.', 'Cooked early? Park sticks on the KEEP WARM end.', 'NEPA fit take light. Watch the smoke.'],
  3: ['Rating must stay 3.5★ or more.', 'Big orders: use many grill slots.', 'No pepper means NO shakes at all.', 'The man in the black cap is watching...'],
};

const STORAGE_KEY = 'suya-night-progress-v1';

export class Game {
  constructor(world, env, input) {
    this.world = world;
    this.env = env;
    this.input = input;
    this.state = 'menu';
    this.paused = false;
    this.t = 0;
    this.head = new THREE.Vector3(0, 0, 0);
    this.mode = 'story';
    this.progress = loadProgress();
    if (this.progress.mode && MODES[this.progress.mode]) this.mode = this.progress.mode;

    this.kitchen = new Kitchen(world, {
      emit: (n, d) => this.onKitchenEvent(n, d),
      findServeTarget: (pos) => this.findServeTarget(pos),
      serve: (c, contents) => this.serve(c, contents),
      takeCash: (pos) => this.takeCash(pos),
      canInteract: () => this.state === 'playing' && !this.paused,
    });
    this.board = new Board(world);
    this.hud = new Hud(world);
    this.notebook = new Notebook(world);
    this.highlight = new Highlight(world);
    this.customers = [];
    this.actor = null;

    // toast for feedback
    this.toast = makePanel(0.4, 0.055, { pxPerM: 1500 });
    this.toast.position.set(0.05, -0.2, -0.5); this.toast.rotation.x = -0.35;
    this.toast.userData.noRay = true; this.toast.visible = false; this.toast.renderOrder = 8;
    world.add(this.toast);
    this.toastT = 0;

    // money pop-up that floats up from the customer's hand, plus a coin burst
    this.pop = makePanel(0.22, 0.07, { pxPerM: 1400 });
    this.pop.userData.noRay = true; this.pop.visible = false; this.pop.renderOrder = 9;
    this.pop.material.depthTest = false;
    world.add(this.pop);
    this.popT = 0;
    this.coins = new Particles(80, { soft: 0.15 });
    world.add(this.coins.points);

    // Pause button (hands-first: poke it)
    this.pauseBtn = new Button('II  Pause', 0.1, 0.045, () => this.pause(), { color: '#e8d8b8' });
    this.pauseBtn.group.position.set(0.5, CY + 0.17, -0.36);
    this.pauseBtn.group.rotation.set(-0.5, -0.7, 0, 'YXZ');
    this.pauseBtn.group.visible = false;
    world.add(this.pauseBtn.group);

    this.showMenu();
  }

  // ------------------------------------------------------------------ menus
  showMenu() {
    this.state = 'menu';
    this.clearNight();
    this.hud.panel.visible = false; this.notebook.hide(); this.highlight.at(null); this.pauseBtn.group.visible = false;
    this.setActor(null);
    const unlocked = this.progress.unlocked || 1;
    const buttons = [{ label: 'New story', onPress: () => this.playIntro(), style: { color: '#ffb347' } }];
    if (unlocked > 1) buttons.push({ label: `Night ${unlocked}`, onPress: () => this.showNightIntro(unlocked), style: { color: '#9be08a', sub: 'continue' } });
    buttons.push({ label: `${MODES[this.mode].label} mode`, onPress: () => { this.mode = this.mode === 'story' ? 'rush' : 'story'; this.saveProgress(); this.showMenu(); }, style: { color: '#d8c8f0', sub: this.mode === 'story' ? 'relaxed' : 'hard' } });
    buttons.push({ label: audio.voice ? 'Voices on' : 'Voices off', onPress: () => { audio.voice = !audio.voice; this.showMenu(); }, style: { color: '#c8e0f0' } });
    this.board.show({
      title: 'SUYA NIGHT',
      big: 'Save your father’s Lagos suya stand in 3 nights.',
      text: 'Fan the coals, grill, spice and wrap every order with your bare hands.',
      footer: this.input.mode === 'xr' ? 'Poke a button with your fingertip, or pinch it.' : 'Desktop test mode: click = pinch. Drag the woven fan fast over the grill to fan.',
      buttons,
    });
  }

  playIntro() { this.playStory(INTRO, () => this.showNightIntro(1)); }

  playStory(steps, onDone, i = 0) {
    this.state = 'story';
    if (i >= steps.length) { this.setActor(null); onDone(); return; }
    const s = steps[i];
    this.setActor(s.actor || null);
    this.board.show({
      title: s.title || '', speaker: s.speaker || '', text: s.text,
      buttons: [
        { label: i < steps.length - 1 ? 'Next' : 'Continue', onPress: () => this.playStory(steps, onDone, i + 1) },
        ...(steps.length > 1 && i < steps.length - 1 ? [{ label: 'Skip', onPress: () => this.playStory(steps, onDone, steps.length), style: { color: '#8a7a6a', text: '#fff' } }] : []),
      ],
    });
    if (s.actor && s.speaker) audio.say(s.text, CHARACTERS[s.actor]?.voice || {});
  }

  setActor(id) {
    if (this.actor && this.actor.id === id) return;
    if (this.actor) { this.world.remove(this.actor.group); this.actor = null; }
    if (!id) return;
    const p = buildPerson(CHARACTERS[id].look);
    p.group.position.set(0.12, FLOOR_Y, LAYOUT.customerZ - 0.05);
    this.world.add(p.group);
    this.actor = { id, group: p.group, parts: p.parts };
  }

  showNightIntro(n) {
    this.state = 'nightIntro';
    this.clearNight();
    this.setActor(null);
    const night = NIGHTS[n - 1];
    const target = Math.round(night.target * MODES[this.mode].target / 500) * 500;
    this.board.show({
      title: NIGHT_INTRO[n].title,
      text: NIGHT_INTRO[n].text + `\n\nTarget: ${naira(target)} in ${Math.round(night.duration / 60)} minutes.`,
      buttons: [
        { label: `Start Night ${n}`, onPress: () => this.startNight(n), style: { color: '#9be08a' } },
        { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } },
      ],
    });
  }

  // ------------------------------------------------------------------ night
  clearNight() {
    for (const c of this.customers) c.dispose();
    this.customers = [];
    this.kitchen.reset();
    if (!this.env.power) { this.env.setPower(true); audio.setPower(true); }
  }

  startNight(n) {
    this.clearNight();
    const night = NIGHTS[n - 1];
    const mode = MODES[this.mode];
    this.night = night;
    this.n = n;
    this.target = Math.round(night.target * mode.target / 500) * 500;
    this.elapsed = 0;
    this.money = 0;
    this.stars = [];
    this.served = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.script = SCRIPTS[n].map((s) => ({ ...s, spawned: false }));
    this.nextSpawn = 0;
    this.blackout = 'before';
    this.bloggerStars = null;
    this.closing = false;
    this.tutorial = n === 1 && !this.progress.tutorialDone ? { step: 0, done: TUTORIAL.map(() => false) } : null;
    this.kitchen.cookMul = mode.cook;
    this.kitchen.setAvailable(night.meats, night.sides);
    this.board.hide();
    this.hud.panel.visible = true;
    this.pauseBtn.group.visible = true;
    this.state = 'playing';
    this.paused = false;
    audio.play('bell');
    if (this.tutorial) this.refreshTutorial();
    else this.showTips();
    this.updateHud();
  }

  showTips() {
    this.highlight.at(null);
    this.notebook.show(`Papa’s notebook — Night ${this.n}`, TIPS[this.n]);
  }

  refreshTutorial() {
    const tu = this.tutorial;
    if (!tu) return;
    tu.step = tu.done.findIndex((d) => !d);
    if (tu.step < 0) {
      this.tutorial = null;
      this.progress.tutorialDone = true; this.saveProgress();
      this.showToast('Tutorial done! The night has started.', '#9be08a');
      this.showTips();
      return;
    }
    this.notebook.show('Papa’s notebook — How to suya', TUTORIAL.map((s) => s.text).slice(Math.max(0, tu.step - 1), tu.step + 2), tu.step > 0 ? 1 : 0, tu.done.slice(Math.max(0, tu.step - 1), tu.step + 2));
    const s = TUTORIAL[tu.step];
    this.highlight.at(s.at(this.kitchen, this), s.r);
  }

  customerHandAnchor() {
    const c = this.customers.find((x) => x.state === 'waiting' || x.state === 'paying' || x.state === 'judging');
    return c ? c.handLocal() : null;
  }

  tutorialEvent(ev) {
    const tu = this.tutorial;
    if (!tu) return;
    const idx = TUTORIAL.findIndex((s) => s.ev === ev);
    if (idx < 0) return;
    for (let i = 0; i <= idx; i++) tu.done[i] = true;
    this.refreshTutorial();
  }

  onKitchenEvent(name, d) {
    if (name === 'pepper') {
      if (d.level === 'plenty') this.tutorialEvent('pepperPlenty');
      this.showToast(`Yaji: ${d.shakes} shake${d.shakes > 1 ? 's' : ''} = ${d.level === 'plenty' ? 'PLENTY pepper' : 'normal pepper'}${d.level === 'normal' ? ` (${6 - d.shakes} more for plenty)` : ''}`, '#ff9a5a');
      return;
    }
    if (name === 'heatLow') { if (this.state === 'playing') this.showToast('Fire dey die! Grab the fan and wave it over the grill', '#ffb04a'); return; }
    if (name === 'fanGrab') return;
    if (name === 'unavailable') { this.showToast(`No ${MEATS[d.meat].name.toLowerCase()} tonight`, '#ccc'); return; }
    if (name === 'emptyPaper') { if (this.state === 'playing') this.showToast('Put meat on the paper before wrapping', '#ccc'); return; }
    if (name === 'burnt') { this.showToast(`Your ${MEATS[d.meat].name.toLowerCase()} is burning! Turn it or bin it`, '#ff6a5a'); return; }
    if (name === 'place' && !this.gaugeTip) { this.gaugeTip = true; this.showToast('Gauge under the grill: top bar = side on the fire. Green = golden, flashing red = about to burn!', '#9fe8a0'); }
    if (name === 'toPaper' && d.done !== 'golden') this.showToast(d.done === 'raw' ? 'Careful: that meat is still raw' : 'That meat is burnt', '#ff9a5a');
    this.tutorialEvent(name);
  }

  // ------------------------------------------------------------------ customers
  spawn(entry) {
    const used = new Set(this.customers.filter((c) => c.state !== 'leaving' && c.state !== 'gone').map((c) => c.slot));
    // one customer: centre. Two at once: far left and far right so wide outfits and bubbles never overlap.
    const slot = (this.night.concurrent === 1 ? [1] : Math.random() < 0.5 ? [0, 2] : [2, 0]).find((s) => !used.has(s));
    if (slot === undefined) return false;
    const char = entry.who ? CHARACTERS[entry.who] : genericCharacter();
    const ord = entry.order || this.randomOrder();
    const c = new Customer(this.world, char, ord, slot, { patience: this.night.patience * MODES[this.mode].patience, infinite: !!entry.tutorial && !!this.tutorial });
    c.onTimeout = () => this.customerTimeout(c);
    c.onJudged = () => this.customerJudged(c);
    c.onCashTimeout = () => this.collect(c);
    this.customers.push(c);
    return true;
  }

  activeCount() { return this.customers.filter((c) => c.state !== 'leaving' && c.state !== 'gone').length; }

  randomOrder() {
    const n = this.night;
    let count = 1;
    if (n.maxSkewers > 1 && Math.random() < 0.35) count++;
    if (n.maxSkewers > 2 && Math.random() < 0.15) count++;
    const meats = [];
    for (let i = 0; i < count; i++) meats.push(pick(n.meats));
    const r = Math.random();
    const pepper = r < 0.25 ? 'none' : r < 0.7 ? 'normal' : 'plenty';
    const sides = n.sides.filter((s) => Math.random() < (s === 'masa' ? 0.2 : 0.28));
    return { meats, pepper, sides };
  }

  findServeTarget(pos) {
    let best = null, bd = 0.2;
    const waiting = this.customers.filter((c) => c.state === 'waiting');
    for (const c of waiting) {
      const d = c.handLocal().distanceTo(pos);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) return best;
    // Lenient: released past the front of the grill, toward a customer -> the customer in that direction.
    if (pos.z < LAYOUT.handZ + 0.1 && pos.y > CY + 0.03) {
      let ba = 0.4;
      const a = Math.atan2(pos.x, -pos.z);
      for (const c of waiting) { const h = c.handLocal(); const d = Math.abs(Math.atan2(h.x, -h.z) - a); if (d < ba) { ba = d; best = c; } }
    }
    return best;
  }

  takeCash(pos) {
    for (const c of this.customers) {
      if (c.state === 'paying' && c.cash && c.cash.position.distanceTo(pos) < 0.1) {
        this.collect(c);
        return true;
      }
    }
    return false;
  }

  collect(c) {
    const at = c.cash ? c.cash.position.clone() : c.handLocal();
    const amt = c.collectCash();
    this.money += amt;
    if (amt > 0) {
      audio.play('cash');
      this.showPop(at, `+${naira(amt)}`, c.comboMul > 1 ? `COMBO ×${c.comboMul}` : c.tip ? `tip ${naira(c.tip)}` : '', c.comboMul > 1 ? '#ffb347' : '#9be08a');
      for (let i = 0; i < 26; i++) this.coins.emit(at.x, at.y + 0.02, at.z, { vy: 0.5 + Math.random() * 0.5, spread: 0.45, life: 0.9, size: 0.012, color: Math.random() < 0.5 ? 0xffd34d : 0xffa020, gravity: 2.2 });
    }
    this.tutorialEvent('cash');
    this.updateHud();
  }

  evaluate(order, contents) {
    const issues = {}; let penalty = 0;
    const add = (k, v) => { issues[k] = (issues[k] || 0) + v; penalty += v; };
    const want = {}, got = {};
    order.meats.forEach((m) => (want[m] = (want[m] || 0) + 1));
    contents.meats.forEach((m) => (got[m.type] = (got[m.type] || 0) + 1));
    let missing = 0, extra = 0;
    for (const m of Object.keys({ ...want, ...got })) { const w = want[m] || 0, g = got[m] || 0; if (g < w) missing += w - g; if (g > w) extra += g - w; }
    if (missing && extra) add('wrongMeat', 0.3 * Math.min(missing, extra) + 0.25 * Math.abs(missing - extra));
    else if (missing) add('missingMeat', 0.3 * missing);
    else if (extra) add('extraMeat', 0.08 * extra);
    for (const m of contents.meats) {
      const dn = doneness(m.cook);
      if (dn === 'raw') add('raw', 0.28);
      if (dn === 'burnt') add('burnt', 0.28);
    }
    const lv = { none: 0, normal: 1, plenty: 2 };
    const w = lv[order.pepper], g = lv[contents.pepper];
    if (w !== g) {
      const diff = Math.abs(w - g);
      if (g === 0) add('pepperMissing', 0.2 * diff + 0.05);
      else if (w === 0) add('pepperExtra', 0.22 * diff + 0.08);
      else add('pepperWrong', 0.15);
    }
    for (const s of order.sides) if (!contents.sides.includes(s)) add('sides', 0.1);
    for (const s of contents.sides) if (!order.sides.includes(s)) add('sides', 0.07);
    const score = Math.max(0, 1 - penalty);
    const stars = score >= 0.95 ? 5 : score >= 0.8 ? 4 : score >= 0.6 ? 3 : score >= 0.35 ? 2 : 1;
    let main = null, mv = 0;
    for (const [k, v] of Object.entries(issues)) if (v > mv) { mv = v; main = k; }
    return { score, stars, main, issues };
  }

  serve(c, contents) {
    const res = this.evaluate(c.order, contents);
    c.receive(res);
  }

  customerJudged(c) {
    const r = c.result;
    const pf = Math.max(0, c.patience / c.patienceMax);
    let pay = 0, tip = 0;
    if (r.score >= 0.6) {
      pay = c.price;
      if (r.score >= 0.95) tip = Math.round((c.price * (0.1 + 0.3 * pf) * (c.char.tipMul || 1)) / 50) * 50;
    } else if (r.score >= 0.35) pay = Math.round(c.price / 2 / 50) * 50;
    if (r.stars >= 4) { this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); } else this.combo = 0;
    const mul = r.stars >= 4 ? comboMul(this.combo) : 1;
    c.comboMul = mul;
    if (mul > 1) {
      tip = Math.round(((tip || 0) * mul + c.price * (mul - 1) * 0.25) / 50) * 50; // multiplied tip + combo bonus
      audio.play('combo');
      if (comboMul(this.combo - 1) < mul) this.showToast(`COMBO ×${mul}! Keep serving 4★+ to keep it`, '#ffb347');
    }
    c.tip = tip;
    this.stars.push(r.stars);
    this.served++;
    if (c.char === CHARACTERS.blackcap && this.n === 3) this.bloggerStars = r.stars;
    if (r.stars >= 4) {
      c.mood = 'happy'; audio.play('happy');
      c.say(r.stars === 5 ? pick(c.char.happy || ['Correct!']) : `Not bad o. ${pick(COMPLAINTS[r.main] || ['Small thing missing.'])}`, 'happy');
    } else {
      c.mood = 'angry'; audio.play('angry');
      const line = pick(COMPLAINTS[r.main] || ['E no correct.']);
      c.say(pay < c.price && pay > 0 ? `${line} I dey pay half.` : pay === 0 ? `${line} I no dey pay for this!` : line, 'angry');
    }
    c.stateT = 0;
    if (pay + tip > 0) { c.state = 'paying'; c.showCash(pay + tip); }
    else { c.leave(); this.tutorialEvent('cash'); }
    this.updateHud();
  }

  customerTimeout(c) {
    c.mood = 'angry';
    c.say(c.char.leave || pick(COMPLAINTS.leave), 'angry');
    audio.play('angry');
    this.stars.push(1);
    this.served++;
    if (this.combo >= 2) this.showToast(`Combo lost! ${c.char.name} walked away. ★`, '#ff6a5a');
    this.combo = 0;
    c.leave();
    this.showToast(`${c.char.name} walked away. ★`, '#ff6a5a');
    this.updateHud();
  }

  rating() { return this.stars.length ? this.stars.reduce((a, b) => a + b, 0) / this.stars.length : 0; }

  // ------------------------------------------------------------------ pause
  pause() {
    if (this.state !== 'playing' || this.paused) return;
    this.paused = true;
    this.toast.visible = false;
    audio.stopSpeech();
    this.pauseBtn.group.visible = false;
    this.board.show({
      title: 'Paused', text: 'The coals will wait for you.',
      buttons: [
        { label: 'Resume', onPress: () => this.resume(), style: { color: '#9be08a' } },
        { label: 'Restart night', onPress: () => this.startNight(this.n) },
        ...(this.input.mode === 'xr' ? [{ label: 'Recenter', onPress: () => { this.onRecenter?.(); }, style: { color: '#c8e0f0' } }] : []),
        { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } },
      ],
    });
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.board.hide();
    this.pauseBtn.group.visible = true;
  }
  // Called when the headset is taken off / system menu opens.
  systemPause() { if (this.state === 'playing' && !this.paused) this.pause(); }

  // ------------------------------------------------------------------ results
  endNight() {
    this.state = 'results';
    this.toast.visible = false;
    this.highlight.at(null);
    this.pauseBtn.group.visible = false;
    for (const c of this.customers) if (c.state !== 'gone') c.leave();
    const rating = this.rating();
    const needRating = this.night.minRating || 0;
    const pass = this.money >= this.target && rating >= needRating;
    if (pass && this.n < 3) { this.progress.unlocked = Math.max(this.progress.unlocked || 1, this.n + 1); this.saveProgress(); }
    audio.play(pass ? 'win' : 'lose');
    const lines = `Money: ${naira(this.money)} / ${naira(this.target)}\nRating: ${rating.toFixed(1)} ★ from ${this.served} customer${this.served === 1 ? '' : 's'}${needRating ? ` (need ${needRating})` : ''}${this.bestCombo >= 2 ? `\nBest combo: ${this.bestCombo} in a row` : ''}`;
    if (!pass) {
      this.setActor('adebayo');
      audio.say(NIGHT_FAIL.text, CHARACTERS.adebayo.voice);
      this.board.show({
        title: `Night ${this.n} — Not enough`, accent: '#e0443a', speaker: NIGHT_FAIL.speaker, text: `${NIGHT_FAIL.text}\n\n${lines}`,
        buttons: [{ label: `Retry Night ${this.n}`, onPress: () => this.startNight(this.n), style: { color: '#ffb347' } }, { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } }],
      });
      return;
    }
    if (this.n < 3) {
      const p = NIGHT_PASS[this.n];
      this.board.show({
        title: `Night ${this.n} complete!`, accent: '#9be08a', speaker: p.speaker, text: `${p.text}\n\n${lines}`,
        buttons: [{ label: `Night ${this.n + 1}`, onPress: () => this.showNightIntro(this.n + 1), style: { color: '#9be08a' } }, { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } }],
      });
      return;
    }
    this.progress.finished = true; this.saveProgress();
    this.board.show({
      title: 'Night 3 complete!', accent: '#9be08a', text: `You saved the stall.\n\n${lines}`,
      buttons: [{ label: 'Continue', onPress: () => this.playEnding(), style: { color: '#9be08a' } }],
    });
  }

  playEnding() {
    this.clearNight();
    this.hud.panel.visible = false; this.notebook.hide();
    const steps = ENDING_GOOD.slice();
    if (this.bloggerStars !== null && this.bloggerStars < 4) steps[0] = { ...steps[0], text: ENDING_BAD_BLOGGER + ' But the street has spoken: this stall stays.' };
    this.playStory(steps, () => {
      this.state = 'ending';
      this.setActor('sani');
      audio.play('win');
      this.board.show({
        title: 'THE END', accent: '#ffd34d',
        big: 'The spot na your own now.',
        text: 'Thank you for playing Suya Night.\nMade for the Meta VR Start Developer Competition 2026.',
        buttons: [{ label: 'Play again', onPress: () => this.playIntro() }, { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } }],
      });
    });
  }

  // ------------------------------------------------------------------ frame
  update(dt, pointers, head) {
    this.t += dt;
    this.head.copy(head);
    for (const p of pointers) p.consumed = false;

    this.board.update(dt, pointers);
    if (this.state === 'playing' && !this.paused) this.pauseBtn.update(dt, pointers, this.world);

    const live = this.state === 'playing' && !this.paused;
    if (!this.paused) this.kitchen.update(dt, pointers, this.t);

    for (const c of this.customers) c.update(dt, this.head, this.paused);
    for (const c of this.customers.filter((x) => x.state === 'gone')) c.dispose();
    this.customers = this.customers.filter((x) => x.state !== 'gone');

    // cash glow pulse
    for (const c of this.customers) if (c.cash) c.cash.userData.glow.scale.setScalar(1 + Math.sin(this.t * 6) * 0.15);

    if (this.actor) {
      this.actor.parts.head.rotation.y = Math.sin(this.t * 0.8) * 0.1;
      this.actor.group.position.y = FLOOR_Y + Math.sin(this.t * 1.5) * 0.004;
    }

    if (live) this.tickNight(dt);

    if (this.tutorial) {
      const s = TUTORIAL[this.tutorial.step];
      if (s && (s.ev === 'flip' || s.ev === 'serve' || s.ev === 'cash')) this.highlight.at(s.at(this.kitchen, this), s.r);
    }
    this.highlight.update(this.t);
    this.env.update(this.t);

    if (this.pop.visible) {
      this.popT -= dt;
      this.pop.position.y = this.popBase + (1.4 - this.popT) * 0.06;
      this.pop.material.opacity = Math.min(1, this.popT * 2);
      if (this.popT <= 0) this.pop.visible = false;
    }
    this.coins.update(dt);
    if (this.toast.visible) { this.toastT -= dt; if (this.toastT <= 0) this.toast.visible = false; }
  }

  tickNight(dt) {
    const tutorialHold = !!this.tutorial;
    if (!tutorialHold) this.elapsed += dt;
    const e = this.elapsed;

    // spawning
    if (!this.closing && this.activeCount() < this.night.concurrent) {
      const due = this.script.find((s) => !s.spawned && e >= s.at);
      if (due) { if (this.spawn(due)) { due.spawned = true; this.nextSpawn = e + rand(this.night.gap); } }
      else if (e >= this.nextSpawn && !tutorialHold) { if (this.spawn({})) this.nextSpawn = e + rand(this.night.gap) + 6; }
    }

    // NEPA blackout
    const bo = this.night.blackout;
    if (bo) {
      if (this.blackout === 'before' && e >= bo.start) {
        this.blackout = 'during'; this.env.setPower(false); audio.setPower(false); audio.play('powerOff');
        this.showToast('NEPA don take light! Work by lantern.', '#ffb347', 4);
        const c = this.customers.find((x) => x.state === 'waiting'); if (c) c.say('Ah! NEPA don take light again!', 'talk');
      } else if (this.blackout === 'during' && e >= bo.end) {
        this.blackout = 'after'; this.env.setPower(true); audio.setPower(true); audio.play('powerOn');
        this.showToast('UP NEPA! Light don come back!', '#9be08a', 4);
      }
    }

    if (!this.closing && e >= this.night.duration) {
      this.closing = true;
      this.showToast('Closing time! Finish the last orders.', '#ffb347', 4);
      for (const c of this.customers) if (c.state === 'arriving' || c.state === 'ordering') c.leave();
    }
    if (this.closing) {
      const busy = this.customers.some((c) => c.state === 'waiting' || c.state === 'judging' || c.state === 'paying');
      if (!busy || e > this.night.duration + 45) this.endNight();
    }
    if (Math.floor(e * 2) !== this._lastHudTick) { this._lastHudTick = Math.floor(e * 2); this.updateHud(); }
  }

  updateHud() {
    if (!this.night) return;
    const left = Math.max(0, this.night.duration - this.elapsed);
    const time = this.tutorial ? 'TUTORIAL' : this.closing ? 'CLOSING' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    this.hud.set({ night: this.n, money: this.money, target: this.target, time, rating: this.rating(), served: this.served, combo: comboMul(this.combo) });
  }

  showPop(at, big, small, color) {
    this.pop.position.set(at.x, at.y + 0.08, at.z + 0.03);
    this.pop.lookAt(this.world.localToWorld(this.head.clone())); // head is stall-local; lookAt wants world
    this.popBase = this.pop.position.y;
    this.popT = 1.4;
    this.pop.visible = true;
    this.pop.redraw((c, w, h) => {
      c.textAlign = 'center'; c.lineJoin = 'round';
      c.font = FONT(h * 0.5, 900); c.lineWidth = h * 0.08; c.strokeStyle = 'rgba(20,10,4,0.9)';
      c.strokeText(big, w / 2, h * 0.52); c.fillStyle = '#ffe680'; c.fillText(big, w / 2, h * 0.52);
      if (small) { c.font = FONT(h * 0.3, 900); c.strokeText(small, w / 2, h * 0.9); c.fillStyle = color; c.fillText(small, w / 2, h * 0.9); }
    });
  }

  showToast(text, color = '#fff', secs = 2.5) {
    this.toast.visible = true;
    this.toastT = secs;
    this.toast.redraw((c, w, h) => {
      roundRect(c, 3, 3, w - 6, h - 6, h * 0.4); c.fillStyle = 'rgba(15,8,4,0.88)'; c.fill();
      c.lineWidth = 4; c.strokeStyle = color; c.stroke();
      c.fillStyle = color; fitFont(c, text, w * 0.92, h * 0.42); c.textAlign = 'center'; c.fillText(text, w / 2, h * 0.64);
    });
  }

  saveProgress() {
    this.progress.mode = this.mode;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress)); } catch { /* storage unavailable */ }
  }
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { unlocked: 1 }; } catch { return { unlocked: 1 }; }
}
const rand = ([a, b]) => a + Math.random() * (b - a);
export { PEPPER_LABEL };
