import * as THREE from 'three';
import { CY, LAYOUT, MODES, MEATS, PEPPER_LABEL, naira } from './config.js';
import { Kitchen, doneness } from './kitchen.js';
import { Customer, buildPerson, disposeDeep, animateFace } from './customers.js';
import { CHARACTERS, genericCharacter, driverCharacter, COMPLAINTS, pick, INTRO, NIGHT_INTRO, NIGHT_PASS, NIGHT_FAIL, ENDING_GOOD, ENDING_BAD_BLOGGER, SHOP_INTRO, ACT2_INTRO, ACT2_END } from './story.js';
import { Board, Hud, Notebook, Highlight, Button } from './ui.js';
import { makePanel, FONT, roundRect, fitFont } from './text.js';
import { FLOOR_Y, GEN_AT } from './env.js';
import { audio } from './audio.js';
import { Particles } from './fx.js';
import { LEVELS, LEVEL_COUNT, STAGES, stageOf, nightStars, STAR_STEPS } from './levels.js';
import { UPGRADES, UPGRADE_BY_ID, loyaltyTier, TIER_NAME, TIER_PERK } from './upgrades.js';
import { loadSave, writeSave, clearSave } from './save.js';

// Combo: consecutive 4-5 star serves multiply the tip and add a bonus.
const comboMul = (n) => (n >= 5 ? 3 : n >= 3 ? 2 : n >= 2 ? 1.5 : 1);
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const shortName = (name) => name.split(' (')[0];

// Night 1 tutorial: short words at the spot (label over the arrow), the full sentence in Papa's notebook.
const TUTORIAL = [
  { ev: 'fan', short: 'FIRE LOW! Grab the fan, wave it', text: 'The fire is dying! Pinch the woven FAN and wave it fast over the grill.', at: (k) => k.anchor('fan'), r: 0.07 },
  { ev: 'place', short: 'Pinch a BEEF stick', text: 'Pinch a BEEF stick from the tray and lay it on the grill.', at: (k) => k.anchor('tray', 'beef'), r: 0.035 },
  { ev: 'flip', short: 'Lift & put back = turn it', text: 'Turn it: pinch the stick, lift, put it back. Gauge green = golden.', at: (k) => k.anchor('grillSkewer'), r: 0.06 },
  { ev: 'toPaper', short: 'Drop it on the paper', text: 'Both sides golden? Drop the stick on the newspaper.', at: (k) => k.anchor('paper'), r: 0.1 },
  { ev: 'pepperPlenty', short: 'Shake YAJI 6 times', text: 'Pinch the YAJI shaker, shake it over the paper. Plenty pepper = 6+ shakes.', at: (k) => k.anchor('shaker'), r: 0.04 },
  { ev: 'side', short: 'ONIONS on the paper', text: 'Pinch ONIONS from the bowl and drop them on the paper.', at: (k) => k.anchor('bowl', 'onions'), r: 0.05 },
  { ev: 'wrap', short: 'Pinch paper & lift = wrap', text: 'Pinch the newspaper and lift it to wrap the suya.', at: (k) => k.anchor('paper'), r: 0.1 },
  { ev: 'serve', short: 'Give it to Mama Nkechi', text: 'Hand the wrap to Mama Nkechi: let go near her open hand.', at: (k, g) => g.customerHandAnchor(), r: 0.07 },
  { ev: 'cash', short: 'Pinch the naira', text: 'Pinch the naira note in her hand to take your money.', at: (k, g) => g.customerHandAnchor(), r: 0.07 },
];

const _hw = new THREE.Vector3(), _hs = new THREE.Vector3();

// Papa's Special: one meat pays +₦500 a stick, picked from today's date (no streaks, nothing to lose).
function dailySpecial(meats) {
  const d = new Date();
  const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return meats[seed % meats.length];
}

export class Game {
  constructor(world, env, input) {
    this.world = world;
    this.env = env;
    this.input = input;
    this.state = 'menu';
    this.paused = false;
    this.t = 0;
    this.head = new THREE.Vector3(0, 0, 0);
    this.save = loadSave();
    this.mode = MODES[this.save.mode] ? this.save.mode : 'story';
    audio.voice = this.save.voice;
    this.priceMul = 1; this.tipMul = 1; this.patienceMul = 1;

    this.kitchen = new Kitchen(world, {
      emit: (n, d) => this.onKitchenEvent(n, d),
      findServeTarget: (pos) => this.findServeTarget(pos),
      serve: (c, contents) => this.serve(c, contents),
      takeCash: (pos) => this.takeCash(pos),
      cashAt: (pos) => this.customers.find((c) => c.state === 'paying' && c.cash && c.cash.position.distanceTo(pos) < 0.1)?.cash || null,
      canInteract: () => this.state === 'playing' && !this.paused,
    });
    this.board = new Board(world);
    this.hud = new Hud(world);
    this.notebook = new Notebook(world);
    this.highlight = new Highlight(world);
    this.shakeHint = new Highlight(world); // Lagos handshake prompt (separate from the tutorial arrow)
    this.shakesDone = 0;
    this.customers = [];
    this.actor = null;
    this.reveal = null;

    // toast for feedback
    this.toast = makePanel(0.4, 0.055, { pxPerM: 1500 });
    // Just above the grill's back edge (in view while cooking), below the spot where customers hold out
    // their hand, so messages never cover a hand-over, the order card or the speech bubble.
    this.toast.position.set(0.0, CY + 0.075, -0.6); this.toast.rotation.x = -0.52;
    this.toast.userData.noRay = true; this.toast.visible = false; this.toast.renderOrder = 8;
    this.toast.material.depthTest = false; // always readable, even with a hand or skewer in front
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

    // Counter display: time and money on the counter lip, right under your eyes while you cook
    // (works in a narrow field of view), with the Pause button beside it, an easy seated reach.
    this.strip = makePanel(0.2, 0.036, { pxPerM: 2400 });
    this.strip.position.set(-0.01, CY + 0.016, -0.232); this.strip.rotation.x = -1.0;
    this.strip.userData.noRay = true; this.strip.visible = false; this.strip.renderOrder = 2;
    world.add(this.strip);
    this.stripKey = '';
    this.pauseBtn = new Button('II Pause', 0.07, 0.036, () => this.pause(), { color: '#e8d8b8' });
    this.pauseBtn.group.position.set(-0.165, CY + 0.016, -0.232);
    this.pauseBtn.group.rotation.set(-1.0, 0, 0);
    this.pauseBtn.group.visible = false;
    world.add(this.pauseBtn.group);

    this.applyUpgrades();
    this.showMenu();
  }

  // ------------------------------------------------------------------ progress helpers
  persist() { this.save.mode = this.mode; this.save.voice = audio.voice; writeSave(this.save); }
  unlocked(n) { return n === 1 || this.save.allOpen || (this.save.levels[n - 1]?.stars || 0) >= 1; }
  nextLevel() {
    for (let n = 1; n <= LEVEL_COUNT; n++) if (this.unlocked(n) && !(this.save.levels[n]?.stars >= 1)) return n;
    return LEVEL_COUNT;
  }
  targetFor(L) { return Math.round(L.target * MODES[this.mode].target / 500) * 500; }
  totalStars() { return Object.values(this.save.levels).reduce((a, l) => a + (l.stars || 0), 0); }

  applyUpgrades() {
    const u = this.save.upgrades, mode = MODES[this.mode];
    this.kitchen.cookMul = mode.cook * (u.charcoal ? 1.15 : 1);
    this.kitchen.fanMul = u.fan ? 1.5 : 1;
    this.kitchen.heatDecayMul = u.fan ? 0.7 : 1;
    this.kitchen.setUpgrades(u);
    this.env.setUpgrades(u);
    this.priceMul = u.yaji ? 1.1 : 1;
    this.tipMul = u.tin ? 1.15 : 1;
    this.patienceMul = u.lights ? 1.2 : 1;
    this.kitchen.autoHeat = !!this.save.oneHand;
  }

  hideHud() { this.hud.panel.visible = false; this.strip.visible = false; this.notebook.hide(); this.highlight.at(null); this.pauseBtn.group.visible = false; this.pop.visible = false; }

  // ------------------------------------------------------------------ menus
  showMenu() {
    this.state = 'menu';
    this.clearNight();
    this.hideHud();
    this.setActor(null);
    this.env.setRival(false);
    const started = this.save.allOpen || Object.keys(this.save.levels).length > 0;
    const next = this.nextLevel();
    const owedEnding = (this.save.levels[3]?.stars || 0) >= 1 && !this.save.act1Done; // closed the app on the Night 3 results
    const buttons = [{ label: 'New story', onPress: () => this.playIntro(), style: { color: '#ffb347' } }];
    if (started) {
      buttons.push(owedEnding
        ? { label: 'Act 1 ending', onPress: () => this.playEnding(), style: { color: '#9be08a', sub: 'continue' } }
        : { label: `Night ${next}`, onPress: () => this.showNightIntro(next), style: { color: '#9be08a', sub: 'continue' } });
      buttons.push({ label: 'Map & shop', onPress: () => this.showMap(stageOf(next).id, () => this.showMenu()), style: { color: '#ffd34d', sub: `${naira(this.save.savings)} saved` } });
    }
    buttons.push({ label: 'Settings', onPress: () => this.showSettings(), style: { color: '#c8e0f0' } });
    this.board.show({
      title: 'SUYA NIGHT',
      big: 'Save your father’s Lagos suya stall — then grow it.',
      text: 'Fan the coals, grill, spice and wrap every order with your bare hands.',
      footer: this.inXR() ? 'Poke a button with your fingertip, or pinch it.' : 'Desktop preview: click = pinch. Drag the woven fan fast over the grill to fan.',
      buttons,
    });
  }

  inXR() { return !!this.input.renderer?.xr?.isPresenting || this.input.mode === 'xr'; }

  showSettings(confirmReset = false) {
    this.state = 'menu';
    const s = this.save;
    const tiles = [
      { id: 'mode', label: `${MODES[this.mode].label} mode`, sub: this.mode === 'story' ? 'relaxed timers' : 'the real Lagos pace', onPress: () => { this.mode = this.mode === 'story' ? 'rush' : 'story'; this.persist(); this.applyUpgrades(); this.showSettings(); }, style: { color: '#d8c8f0' } },
      { id: 'voice', label: audio.voice ? 'Voices ON' : 'Voices OFF', sub: 'speech bubbles always show', onPress: () => { audio.voice = !audio.voice; this.persist(); this.showSettings(); }, style: { color: '#c8e0f0' } },
      { id: 'onehand', label: s.oneHand ? 'One hand ✓' : 'One-hand play', sub: s.oneHand ? 'fire stays hot by itself' : 'no fanning needed', onPress: () => { s.oneHand = !s.oneHand; this.persist(); this.applyUpgrades(); this.showSettings(); }, style: { color: s.oneHand ? '#9be08a' : '#e8d8b0' } },
      { id: 'counter', label: `Counter: ${['lower', 'normal', 'higher'][s.counter + 1]}`, sub: 'tap to change height', onPress: () => { s.counter = s.counter === 0 ? 1 : s.counter === 1 ? -1 : 0; this.persist(); this.onRecenter?.(); this.showSettings(); }, style: { color: '#e8d8b0' } },
      { id: 'judge', label: s.allOpen ? 'All nights open ✓' : 'Open all nights', sub: s.allOpen ? 'judge pass on' : 'judge pass: + ₦30,000', onPress: () => { if (!s.allOpen) { s.allOpen = true; s.savings += 30000; this.persist(); } this.showSettings(); }, style: { color: s.allOpen ? '#9be08a' : '#ffd34d' } },
      confirmReset
        ? { id: 'reset', label: 'Tap to erase', sub: 'all progress', onPress: () => { this.save = clearSave(); this.mode = 'story'; this.persist(); this.applyUpgrades(); this.showMenu(); }, style: { color: '#e0443a', text: '#fff' } }
        : { id: 'reset', label: 'Reset', sub: 'start again', onPress: () => this.showSettings(true), style: { color: '#b0705a', text: '#fff' } },
    ];
    this.board.show({
      title: 'Settings',
      text: 'Saves in this browser. Short on time? Open all nights, then pick one on the Map.',
      grid: { cols: 3, tiles }, // 3 × 2: taller tiles, easier to poke
      buttons: [{ label: 'Back', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } }],
    });
  }

  // First play goes straight from two story cards into Night 1: the first action (fanning) comes within seconds.
  playIntro() { this.playStory(INTRO, () => (this.save.tutorialDone ? this.showNightIntro(1) : this.startNight(1))); }

  playStory(steps, onDone, i = 0) {
    this.state = 'story';
    if (i >= steps.length) { this.setActor(null); onDone(); return; }
    const s = steps[i];
    this.setActor(s.actor || null);
    this.actorTalk = s.actor && s.speaker ? Math.min(5, 0.8 + s.text.length * 0.045) : 0;
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
    if (this.actor) { this.world.remove(this.actor.group); disposeDeep(this.actor.group); this.actor = null; }
    if (!id) return;
    const p = buildPerson(CHARACTERS[id].look);
    p.group.position.set(0.12, FLOOR_Y, LAYOUT.customerZ - 0.05);
    this.world.add(p.group);
    this.actor = { id, group: p.group, parts: p.parts, face: {} };
  }

  showNightIntro(n) {
    this.state = 'nightIntro';
    this.clearNight();
    this.hideHud();
    this.setActor(null);
    const L = LEVELS[n - 1];
    const target = this.targetFor(L);
    const best = this.save.levels[n];
    this.env.setRival(!!L.rival);
    this.board.show({
      title: NIGHT_INTRO[n].title,
      text: NIGHT_INTRO[n].text + (n >= 2 ? `\nPapa’s special today: ${MEATS[dailySpecial(L.meats)].name} +₦500 a stick.` : '') + `\n\n★ ${naira(target)}   ★★ ${naira(target * STAR_STEPS[1])}   ★★★ ${naira(target * STAR_STEPS[2])} + 4★ rating` + (best?.stars ? `\nYour best: ${starStr(best.stars)}` : ''),
      buttons: [
        { label: `Start Night ${n}`, onPress: () => this.startNight(n), style: { color: '#9be08a' } },
        { label: 'Shop', onPress: () => this.showShop(() => this.showNightIntro(n)), style: { color: '#ffd34d', sub: naira(this.save.savings) } },
        { label: 'Map', onPress: () => this.showMap(stageOf(n).id, () => this.showNightIntro(n)), style: { color: '#e8d8b8' } },
        { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } },
      ],
    });
  }

  // Level select: one page per stage. Later stages are shown as the road ahead ("coming soon").
  showMap(stageId, onBack) {
    this.state = 'map';
    this.hideHud();
    this.setActor(null);
    // Pages: every playable stage, then ONE "coming next" page (the rest of the road is listed on it).
    const firstSoon = STAGES.findIndex((s) => s.soon);
    const pages = firstSoon < 0 ? STAGES : STAGES.slice(0, firstSoon + 1);
    const idx = Math.max(0, Math.min(pages.length - 1, pages.findIndex((s) => s.id === stageId) < 0 ? pages.length - 1 : pages.findIndex((s) => s.id === stageId)));
    const st = pages[idx];
    const nav = [
      { label: '◀ Prev', onPress: () => this.showMap(pages[Math.max(0, idx - 1)].id, onBack), style: { color: idx > 0 ? '#e8d8b8' : '#5a4a3a', text: idx > 0 ? '#2a1408' : '#999' } },
      { label: 'Shop', onPress: () => this.showShop(() => this.showMap(st.id, onBack)), style: { color: '#ffd34d', sub: naira(this.save.savings) } },
      { label: 'Back', onPress: () => onBack(), style: { color: '#8a7a6a', text: '#fff' } },
      { label: 'Next ▶', onPress: () => this.showMap(pages[Math.min(pages.length - 1, idx + 1)].id, onBack), style: { color: idx < pages.length - 1 ? '#e8d8b8' : '#5a4a3a', text: idx < pages.length - 1 ? '#2a1408' : '#999' } },
    ];
    const title = `Stage ${st.id} · ${st.name}`;
    if (st.soon) {
      const later = STAGES.slice(firstSoon + 1).map((x) => x.name).join(' · ');
      this.board.show({ title: `Coming next · ${st.name}`, accent: '#b0a090', speaker: st.place, text: `${st.blurb}\n\nAfter that, the road goes on: ${later}.`, buttons: nav });
      return;
    }
    const got = st.nights.reduce((a, n) => a + (this.save.levels[n]?.stars || 0), 0);
    const tiles = st.nights.map((n) => {
      const open = this.unlocked(n), stars = this.save.levels[n]?.stars || 0;
      return {
        id: `night${n}`, label: `Night ${n}`, sub: open ? `${LEVELS[n - 1].title}  ${starStr(stars)}` : 'locked',
        onPress: open ? () => this.showNightIntro(n) : () => {},
        style: { color: !open ? '#5a4a3a' : stars ? '#9be08a' : '#ffb347', text: open ? '#2a1408' : '#bbb' },
      };
    });
    this.board.show({ title, text: `${st.place} · ★ ${got} of ${st.nights.length * 3}\n${st.blurb}`, grid: { cols: 3, tiles }, buttons: nav });
  }

  // Shop: poke a tile to see what it does, then Buy. Two steps so a stray poke never spends money.
  showShop(onBack, sel = null) {
    this.state = 'shop';
    this.shopBack = onBack;
    this.shopSel = sel;
    this.notebook.hide(); this.highlight.at(null); this.pauseBtn.group.visible = false;
    const u = this.save.upgrades, sv = this.save.savings;
    const first = !this.save.shopSeen;
    if (first) { this.save.shopSeen = true; this.persist(); }
    const tiles = UPGRADES.map((up) => {
      const owned = !!u[up.id], afford = sv >= up.price, on = sel === up.id;
      return {
        id: up.id, label: up.name, sub: owned ? 'OWNED ✓' : naira(up.price),
        onPress: () => this.showShop(onBack, up.id),
        style: { color: on ? '#fff3c0' : owned ? '#9be08a' : afford ? '#ffb347' : '#a89880' },
      };
    });
    const S = sel ? UPGRADE_BY_ID[sel] : null;
    let text = first ? SHOP_INTRO.text : 'Poke an upgrade to see what it does. Every one changes your stall.';
    if (S) text = `${S.name}: ${S.desc}`;
    const buttons = [];
    if (S && !u[S.id]) {
      buttons.push(sv >= S.price
        ? { label: `Buy ${naira(S.price)}`, onPress: () => this.buy(S.id), style: { color: '#9be08a' } }
        : { label: `Need ${naira(S.price - sv)}`, onPress: () => {}, style: { color: '#6a5a4a', text: '#ddd', sub: 'more savings' } });
    }
    buttons.push({ label: 'Done', onPress: () => onBack(), style: { color: '#c8e0f0' } });
    this.board.show({ title: `Papa’s savings tin: ${naira(sv)}`, accent: '#ffd34d', text, grid: { cols: 3, tiles }, buttons });
  }

  buy(id) {
    const up = UPGRADE_BY_ID[id];
    if (!up || this.save.upgrades[id] || this.save.savings < up.price) return;
    this.save.savings -= up.price;
    this.save.upgrades[id] = true;
    this.persist();
    this.applyUpgrades();
    audio.play('buy');
    // show it: hide the board, point at the new thing on the stall, then come back to the shop
    this.board.hide();
    this.state = 'reveal';
    const back = this.shopBack;
    this.reveal = { t: 2.6, back: () => this.showShop(back, id) };
    this.highlight.at(this.upgradeAnchor(id), 0.08, `NEW: ${up.name.toUpperCase()}`);
    this.showToast(`New for the stall: ${up.name}!`, '#9be08a', 2.6);
  }

  upgradeAnchor(id) {
    const k = this.kitchen;
    switch (id) {
      case 'tin': return new THREE.Vector3(LAYOUT.tin.x, CY + 0.07, LAYOUT.tin.z);
      case 'lights': return new THREE.Vector3(0, 0.5, -0.86);
      case 'charcoal': return k.anchor('grill');
      case 'fan': return k.anchor('fan');
      case 'yaji': return k.anchor('shaker');
      case 'generator': return new THREE.Vector3(GEN_AT.x, FLOOR_Y + 0.98, GEN_AT.z);
      default: return null;
    }
  }

  // ------------------------------------------------------------------ night
  clearNight() {
    for (const c of this.customers) c.dispose();
    this.customers = [];
    this.paused = false;   // "Menu" from the pause board must not leave the stall frozen
    this.tutorial = null;  // nor the tutorial arrow hanging over the menus
    for (const id of this.timers || []) clearTimeout(id);
    this.timers = [];
    this.kitchen.reset();
    this.rushOn = false;
    this.env.setGenRunning(false);
    if (!this.env.power) { this.env.setPower(true); audio.setPower(true); }
  }

  startNight(n) {
    this.clearNight();
    const L = LEVELS[n - 1];
    this.night = L;
    this.n = n;
    this.target = this.targetFor(L);
    this.elapsed = 0;
    this.money = 0;
    this.stars = [];
    this.served = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.script = (L.script || []).map((s) => ({ ...s, spawned: false }));
    this.nextSpawn = 0;
    this.blackout = 'before';
    this.genStarted = false;
    this.rushDone = false;
    this.bloggerStars = null;
    this.closing = false;
    this.reveal = null;
    this.tutorial = n === 1 && !this.save.tutorialDone ? { step: 0, done: TUTORIAL.map(() => false) } : null;
    this.special = n >= 2 ? dailySpecial(L.meats) : null;
    if (n >= 4 && !this.save.upgrades.sign) { this.save.upgrades.sign = true; this.persist(); } // Act 2 = the new sign is up
    this.applyUpgrades();
    this.env.setRival(!!L.rival);
    this.kitchen.setAvailable(L.meats, L.sides);
    if (this.tutorial) { // the fire is dying: the very first thing you do is fan it (one-hand mode skips that step)
      if (this.save.oneHand) this.tutorial.done[0] = true; else this.kitchen.heat = 0.32;
    }
    this.setActor(null);
    this.board.hide();
    this.hud.panel.visible = true;
    this.strip.visible = true; this.stripKey = '';
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
    const tips = (this.night.tips || []).slice();
    if (this.special) tips.unshift(`TODAY’S SPECIAL: ${MEATS[this.special].name.toUpperCase()} +₦500 a stick (changes every day)`);
    this.notebook.show(`Papa’s notebook — Night ${this.n}`, tips);
  }

  refreshTutorial() {
    const tu = this.tutorial;
    if (!tu) return;
    tu.step = tu.done.findIndex((d) => !d);
    if (tu.step < 0) {
      this.tutorial = null;
      this.save.tutorialDone = true; this.persist();
      this.showToast('Tutorial done! The night has started.', '#9be08a');
      this.showTips();
      return;
    }
    this.notebook.show('Papa’s notebook — How to suya', TUTORIAL.map((s) => s.text).slice(Math.max(0, tu.step - 1), tu.step + 2), tu.step > 0 ? 1 : 0, tu.done.slice(Math.max(0, tu.step - 1), tu.step + 2));
    const s = TUTORIAL[tu.step];
    this.highlight.at(s.at(this.kitchen, this), s.r, s.short);
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
    if (name === 'place' && !this.gaugeTip) { this.gaugeTip = true; this.showToast('Gauge under the stick: GREEN = golden. RED = burning!', '#9fe8a0', 3.5); }
    if (name === 'toPaper' && d.done !== 'golden') this.showToast(d.done === 'raw' ? 'Careful: that meat is still raw' : 'That meat is burnt', '#ff9a5a');
    this.tutorialEvent(name);
  }

  // ------------------------------------------------------------------ customers
  spawn(entry) {
    const used = new Set(this.customers.filter((c) => c.state !== 'leaving' && c.state !== 'gone').map((c) => c.slot));
    // one customer: centre. Two at once: far left and far right so wide outfits and bubbles never overlap.
    const slot = (this.night.concurrent === 1 ? [1] : Math.random() < 0.5 ? [0, 2] : [2, 0]).find((s) => !used.has(s));
    if (slot === undefined) return false;
    const who = entry.who || null;
    const char = who ? CHARACTERS[who] : this.rushOn && Math.random() < 0.75 ? driverCharacter() : genericCharacter();
    const ord = entry.order || this.randomOrder();
    const tier = who && char.loyal ? loyaltyTier(this.save.loyalty[who] || 0) : 0;
    const patience = this.night.patience * MODES[this.mode].patience * this.patienceMul * TIER_PERK[tier].patience;
    const c = new Customer(this.world, char, ord, slot, { patience, infinite: !!entry.tutorial && !!this.tutorial, tag: tier });
    c.who = who;
    c.tutorialCustomer = !!entry.tutorial && !!this.tutorial;
    const special = this.special ? ord.meats.filter((m) => m === this.special).length * 500 : 0;
    c.price = Math.round((c.price * this.priceMul) / 50) * 50 + special;
    c.transfer = this.n >= 4 && !entry.tutorial && Math.random() < 0.35;
    c.transferPending = c.transfer && Math.random() < 0.22;
    c.onTimeout = () => this.customerTimeout(c);
    c.onJudged = () => this.customerJudged(c);
    c.onCashTimeout = () => this.collect(c, true);
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
        if (c.cashPending) {
          audio.play('warn');
          c.say(pick(['Ehn… network wahala. Abeg take cash.', 'E never land? Na the bank o! Here, cash.', 'Pending again? Okay okay, take cash.']), 'talk');
          c.showCash(c.cashAmount);
          return true;
        }
        this.collect(c);
        return true;
      }
    }
    return false;
  }

  // Lagos handshake: pull your hand back, slap palms with the customer's open hand, then pinch
  // (the snap) as the hands part. Purely for fun: no score, no penalty, it times out by itself.
  updateShakes(pointers) {
    let hint = null, hintText = '';
    for (const c of this.customers) {
      if (c.state !== 'shake' || this.paused) continue;
      const hand = c.handLocal(_hs);
      if (!c.slapped) {
        for (const p of pointers) {
          if (this.kitchen.held.get(p)) continue;
          const d = Math.min(p.pos.distanceTo(hand), p.tip ? p.tip.distanceTo(hand) : 9);
          if (d > 0.14) c.shakeArmed.add(p); // the hand must come in from a little way off: a real slap
          else if (d < 0.08 && c.shakeArmed.has(p)) {
            c.slapped = true; c.slapAt = c.stateT;
            audio.play('slap'); c.hop();
            for (let i = 0; i < 10; i++) this.coins.emit(hand.x, hand.y, hand.z, { vy: 0.25, spread: 0.5, life: 0.4, size: 0.008, color: 0xfff2c0, gravity: 0.5 });
            break;
          }
        }
        if (!c.slapped && this.shakesDone < 2 && c.stateT > 1.1) { hint = hand; hintText = 'SLAP HANDS!'; } // after the money pop
      } else if (!c.shook) {
        const snap = pointers.find((p) => p.pinchStarted && p.pos.distanceTo(hand) < 0.3);
        if (snap || c.stateT - c.slapAt > 1.8) {
          c.shook = true; c.stateT = 0; this.shakesDone++;
          if (snap) {
            this.snaps = (this.snaps || 0) + 1;
            audio.play('snap'); c.hop();
            c.say(pick(['Hehe! Correct guy!', 'Na so! You sabi am!', 'Eheh! Original Lagos handshake!']), 'happy');
            this.showPop(hand.clone(), 'RESPECT!', 'Lagos handshake', '#ff8ad8');
          } else c.say('Hehe! Next time, snap am!', 'happy');
        } else if (this.shakesDone < 2) { hint = hand; hintText = 'NOW PINCH = SNAP!'; }
      }
    }
    this.shakeHint.at(hint, 0.06, hintText);
  }

  collect(c, auto = false) {
    const at = c.cash ? c.cash.position.clone() : c.handLocal();
    const amt = c.collectCash();
    if (c.wantShake && !auto && this.state === 'playing') {
      c.offerShake(c.tutorialCustomer
        ? 'Ehen! You be Mallam Sani pikin true true. Oya, shake me!'
        : pick(['My guy! Shake me jare!', 'Oya, give me Lagos handshake!', 'Family! Bring hand!']));
      c.shakeArmed = new Set();
    }
    this.money += amt;
    if (amt > 0) {
      audio.play('cash');
      this.showPop(at, `+${naira(amt)}`, c.comboMul > 1 ? `COMBO ×${c.comboMul}` : c.cashTransfer ? 'TRANSFER' : c.tip ? `tip ${naira(c.tip)}` : '', c.comboMul > 1 ? '#ffb347' : '#9be08a');
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
      if (r.score >= 0.95) tip = c.price * (0.1 + 0.3 * pf) * (c.char.tipMul || 1);
    } else if (r.score >= 0.35) pay = Math.round(c.price / 2 / 50) * 50;
    tip = Math.round((tip * this.tipMul * TIER_PERK[c.tag || 0].tip) / 50) * 50;
    if (r.stars >= 4) { this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); } else this.combo = 0;
    const mul = r.stars >= 4 ? comboMul(this.combo) : 1;
    c.comboMul = mul;
    if (mul > 1) {
      tip = Math.round(((tip || 0) * mul + c.price * (mul - 1) * 0.25) / 50) * 50; // multiplied tip + combo bonus
      audio.play('combo');
      if (comboMul(this.combo - 1) < mul) this.showToast(`COMBO ×${mul}! Keep serving 4★+ to keep it`, '#ffb347');
    }
    tip = Math.min(tip, Math.round((c.price * 1.2) / 50) * 50); // big family + combo tips stay fun, never game-breaking
    c.tip = tip;
    this.stars.push(r.stars);
    this.served++;
    if (c.char === CHARACTERS.blackcap && this.n === 3) this.bloggerStars = r.stars;
    // loyalty: regulars you serve well become friends, then family
    let tierUp = 0;
    if (r.stars >= 4 && c.who && c.char.loyal) {
      const before = loyaltyTier(this.save.loyalty[c.who] || 0);
      this.save.loyalty[c.who] = (this.save.loyalty[c.who] || 0) + 1;
      const after = loyaltyTier(this.save.loyalty[c.who]);
      this.persist();
      if (after > before) tierUp = after;
    }
    // A Lagos handshake for Mama Nkechi after the tutorial order, regulars who just moved up, and family.
    c.wantShake = r.stars >= 4 && (c.tutorialCustomer || tierUp > 0 || (c.tag || 0) >= 2);
    if (r.stars >= 4) {
      c.mood = 'happy'; audio.play('happy');
      if (tierUp) {
        c.say(c.char.loyal[tierUp - 1], 'happy');
        audio.play('loyal');
        this.showToast(`♥ ${shortName(c.char.name)} is now ${TIER_NAME[tierUp]}: more patience, bigger tips`, '#ff8ad8', 3.5);
      } else c.say(r.stars === 5 ? pick(c.char.happy || ['Correct!']) : `Not bad o. ${pick(COMPLAINTS[r.main] || ['Small thing missing.'])}`, 'happy');
      if (r.stars === 5) c.cheer();
    } else {
      c.mood = 'angry'; audio.play('angry');
      const line = pick(COMPLAINTS[r.main] || ['E no correct.']);
      c.say(pay < c.price && pay > 0 ? `${line} I dey pay half.` : pay === 0 ? `${line} I no dey pay for this!` : line, 'angry');
    }
    c.stateT = 0;
    if (pay + tip > 0) {
      c.state = 'paying';
      c.showCash(pay + tip, { transfer: c.transfer, pending: c.transferPending });
      if (c.transfer && r.stars >= 4 && !tierUp) c.say(c.transferPending ? 'I don send am! E go soon land.' : pick(['I don transfer am! Check the alert.', 'Sent! Check your alert, boss.']), 'happy');
    }
    else { c.leave(); this.tutorialEvent('cash'); }
    this.updateHud();
  }

  customerTimeout(c) {
    if (c.char === CHARACTERS.blackcap && this.n === 3) this.bloggerStars = 1;
    c.mood = 'angry';
    c.say(c.char.leave || pick(COMPLAINTS.leave), 'angry');
    audio.play('angry');
    this.stars.push(1);
    this.served++;
    const lost = this.combo >= 2;
    this.combo = 0;
    c.leave();
    this.showToast(lost ? `Combo lost! ${shortName(c.char.name)} walked away. ★` : `${shortName(c.char.name)} walked away. ★`, '#ff6a5a');
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
    this.hideHud();
    this.rushOn = false;
    this.env.setGenRunning(false);
    for (const c of this.customers) if (c.state !== 'gone') c.leave();
    const n = this.n, L = this.night, T = this.target;
    const rating = this.rating();
    const need = L.minRating || 0;
    const stars = nightStars(this.money, T, rating, need);
    const pass = stars > 0;
    // Rent first, the rest na your own: only money above the target goes into Papa's savings tin.
    const extra = pass ? Math.max(0, this.money - T) : 0;
    const prev = this.save.levels[n] || { stars: 0, best: 0 };
    this.save.levels[n] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, this.money) };
    this.save.savings += extra;
    this.save.earned += this.money;
    this.persist();
    audio.play(pass ? 'win' : 'lose');
    for (let i = 0; i < stars; i++) this.timers.push(setTimeout(() => audio.play('star'), 900 + i * 380));

    let lines = `Money ${naira(this.money)} of ${naira(T)} · Rating ${rating.toFixed(1)}★ (${this.served})${need ? ` · need ${need}★` : ''}`;
    if (pass) lines += `\nSavings tin +${naira(extra)} = ${naira(this.save.savings)}${this.bestCombo >= 2 ? ` · best combo ${this.bestCombo}` : ''}`;
    if (pass && stars < 3) {
      const nextT = T * STAR_STEPS[stars];
      const bits = [];
      if (this.money < nextT) bits.push(`${naira(Math.ceil((nextT - this.money) / 50) * 50)} more`);
      if (stars === 2 && rating < 4) bits.push('a 4★ rating');
      if (bits.length) lines += `\nNext time: ${bits.join(' and ')} for ${starStr(stars + 1).replace(/☆/g, '')}`;
    }
    const afford = UPGRADES.find((u) => !this.save.upgrades[u.id] && u.price <= this.save.savings);
    if (afford) lines += `\nYou can afford: ${afford.name}! Visit the SHOP.`;
    const shopBtn = { label: 'Shop', onPress: () => this.showShop(() => this.showResults()), style: { color: '#ffd34d', sub: afford ? 'NEW!' : naira(this.save.savings) } };
    const mapBtn = { label: 'Map', onPress: () => this.showMap(stageOf(n).id, () => this.showResults()), style: { color: '#e8d8b8' } };

    if (!pass) {
      this.setActor('adebayo');
      audio.say(NIGHT_FAIL.text, CHARACTERS.adebayo.voice);
      const why = this.money >= T && rating < need ? `\nThe money was enough, but the rating must be ${need}★ or better.` : '';
      this.resultsDef = {
        title: `Night ${n} — Not enough`, accent: '#e0443a', speaker: NIGHT_FAIL.speaker, text: `${NIGHT_FAIL.text}\n\n${lines}${why}`,
        buttons: [{ label: `Retry Night ${n}`, onPress: () => this.startNight(n), style: { color: '#ffb347' } }, shopBtn, mapBtn],
      };
    } else if (n === 3) {
      this.resultsDef = {
        title: `Night 3 complete! ${starStr(stars)}`, accent: '#9be08a', text: `You saved the stall.\n\n${lines}`,
        buttons: [{ label: 'Continue', onPress: () => this.playEnding(), style: { color: '#9be08a' } }, shopBtn],
      };
    } else if (n === LEVEL_COUNT) {
      this.resultsDef = {
        title: `Night ${n} complete! ${starStr(stars)}`, accent: '#9be08a', text: `Dayo’s review goes up tonight.\n\n${lines}`,
        buttons: [{ label: 'Continue', onPress: () => this.playAct2End(), style: { color: '#9be08a' } }, shopBtn],
      };
    } else {
      const p = NIGHT_PASS[n] || { speaker: '', text: '' };
      this.resultsDef = {
        title: `Night ${n} complete! ${starStr(stars)}`, accent: '#9be08a', speaker: p.speaker, text: `${p.text}\n\n${lines}`,
        buttons: [{ label: `Night ${n + 1}`, onPress: () => this.showNightIntro(n + 1), style: { color: '#9be08a', sub: 'next' } }, shopBtn, mapBtn],
      };
    }
    this.board.show(this.resultsDef);
  }

  showResults() {
    this.state = 'results';
    this.hideHud();
    if (this.resultsDef) this.board.show(this.resultsDef); else this.showMenu();
  }

  // Act 1 ending: the blogger reveal, the lease, and Papa. Then the business opens up.
  playEnding() {
    this.clearNight();
    this.hideHud();
    const steps = ENDING_GOOD.slice();
    if (this.bloggerStars !== null && this.bloggerStars < 4) steps[0] = { ...steps[0], text: ENDING_BAD_BLOGGER + ' But the street has spoken: this stall stays.' };
    this.playStory(steps, () => {
      this.save.act1Done = true;
      this.save.upgrades.sign = true; // story reward: the new "Mallam Sani & Son" sign
      this.persist();
      this.applyUpgrades();
      this.state = 'ending';
      this.setActor('sani');
      audio.play('win');
      this.board.show({
        title: 'ACT 1 COMPLETE', accent: '#ffd34d',
        big: 'The spot na your own now.',
        text: 'Look up: the new sign says MALLAM SANI & SON.\nNext: grow the business. Five new nights, upgrades, regulars, and a rival across the road.',
        buttons: [
          { label: 'Grow the business', onPress: () => this.playStory(ACT2_INTRO, () => this.showShop(() => this.showNightIntro(4))), style: { color: '#9be08a' } },
          { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } },
        ],
      });
    });
  }

  // Act 2 ending: Dayo's review, then Mama Nkechi's wedding invitation leads to the next stage.
  playAct2End() {
    this.clearNight();
    this.hideHud();
    this.playStory(ACT2_END, () => {
      this.save.act2Done = true;
      this.persist();
      this.state = 'ending';
      this.setActor('nkechi');
      audio.play('win');
      const max = LEVEL_COUNT * 3;
      this.board.show({
        title: 'TO BE CONTINUED', accent: '#ffd34d',
        big: 'Next: Stage 3 — Owambe Contract',
        text: `You grew Mallam Sani’s corner into the talk of Allen Avenue.\nStars ${this.totalStars()} of ${max} · Savings ${naira(this.save.savings)} · Replay nights for ★★★.\nThank you for playing Suya Night — made for the Meta VR Start Developer Competition 2026.`,
        buttons: [
          { label: 'Map', onPress: () => this.showMap(3, () => this.showMenu()), style: { color: '#ffd34d' } },
          { label: 'Menu', onPress: () => this.showMenu(), style: { color: '#8a7a6a', text: '#fff' } },
        ],
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

    for (const c of this.customers) c.update(this.paused ? 0 : dt, this.head, this.paused);
    this.updateShakes(pointers);
    for (const c of this.customers.filter((x) => x.state === 'gone')) c.dispose();
    this.customers = this.customers.filter((x) => x.state !== 'gone');

    // cash glow pulse
    for (const c of this.customers) if (c.cash) c.cash.userData.glow.scale.setScalar(1 + Math.sin(this.t * 6) * 0.15);

    if (this.actor) {
      this.actorTalk = Math.max(0, (this.actorTalk || 0) - dt);
      animateFace(this.actor.parts, this.actor.face, dt, this.actorTalk > 0);
      this.actor.parts.head.rotation.y = Math.sin(this.t * 0.8) * 0.1;
      this.actor.group.position.y = FLOOR_Y + Math.sin(this.t * 1.5) * 0.004;
    }

    if (live) this.tickNight(dt);

    if (this.state === 'reveal' && this.reveal) {
      this.reveal.t -= dt;
      if (this.reveal.t <= 0) { const back = this.reveal.back; this.reveal = null; this.highlight.at(null); back(); }
    }

    // generator exhaust while it carries the stall through a blackout
    if (this.env.genRunning && Math.random() < dt * 8) {
      const ex = this.env.genExhaust;
      this.kitchen.smoke.emit(ex.x, ex.y, ex.z, { vy: 0.3, spread: 0.06, life: 1.6, size: 0.05, grow: 0.12, color: 0x5a5650, alpha: 0.45 });
    }

    if (this.tutorial && this.state === 'playing') {
      const s = TUTORIAL[this.tutorial.step];
      if (s && (s.ev === 'flip' || s.ev === 'serve' || s.ev === 'cash')) this.highlight.at(s.at(this.kitchen, this), s.r, s.short);
    }
    this.highlight.update(this.t, this.world.localToWorld(_hw.copy(this.head)));
    this.shakeHint.update(this.t, _hw);
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

    // RUSH event: OyaGo drivers arrive much faster for a while
    const ru = this.night.rush;
    if (ru) {
      if (!this.rushOn && !this.rushDone && e >= ru.start) {
        this.rushOn = true; this.nextSpawn = Math.min(this.nextSpawn, e + 1);
        audio.play('bell');
        this.showToast('RUSH! Tolu don send the OyaGo drivers! Quick quick!', '#ffb347', 4);
      } else if (this.rushOn && e >= ru.end) {
        this.rushOn = false; this.rushDone = true;
        this.showToast('Rush over. Breathe small.', '#9be08a', 3);
      }
    }
    const gapMul = this.rushOn ? 0.35 : 1;

    // spawning
    if (!this.closing && this.activeCount() < this.night.concurrent) {
      const due = this.script.find((s) => !s.spawned && e >= s.at);
      if (due) { if (this.spawn(due)) { due.spawned = true; this.nextSpawn = e + rand(this.night.gap) * gapMul; } }
      else if (e >= this.nextSpawn && !tutorialHold) { if (this.spawn({})) this.nextSpawn = e + (rand(this.night.gap) + 6) * gapMul; }
    }

    // NEPA blackout (a bought generator brings the light back after a few seconds)
    const bo = this.night.blackout;
    if (bo) {
      if (this.blackout === 'before' && e >= bo.start) {
        this.blackout = 'during'; this.env.setPower(false); audio.setPower(false); audio.play('powerOff');
        this.showToast(this.save.upgrades.generator ? 'NEPA don take light! Starting the gen…' : 'NEPA don take light! Work by lantern.', '#ffb347', 4);
        const c = this.customers.find((x) => x.state === 'waiting'); if (c) c.say('Ah! NEPA don take light again!', 'talk');
      } else if (this.blackout === 'during' && this.save.upgrades.generator && !this.genStarted && e >= bo.start + 6) {
        this.genStarted = true; this.env.setPower(true); audio.setPower(true); audio.play('gen'); this.env.setGenRunning(true);
        this.showToast('Gen don start! Light is back. Money well spent.', '#9be08a', 3.5);
      } else if (this.blackout === 'during' && e >= bo.end) {
        this.blackout = 'after';
        if (!this.genStarted) { this.env.setPower(true); audio.setPower(true); }
        this.env.setGenRunning(false); audio.play('powerOn');
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
    const time = this.tutorial ? 'TUTORIAL' : this.closing ? 'CLOSING' : this.rushOn ? 'RUSH!' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    this.hud.set({ night: this.n, money: this.money, target: this.target, time, rating: this.rating(), served: this.served, combo: comboMul(this.combo), steps: STAR_STEPS });
    const key = `${time}|${this.money}|${this.target}`;
    if (key !== this.stripKey) {
      this.stripKey = key;
      const met = this.money >= this.target;
      this.strip.redraw((c, w, h) => {
        roundRect(c, 2, 2, w - 4, h - 4, h * 0.3); c.fillStyle = 'rgba(16,10,6,0.92)'; c.fill();
        c.lineWidth = 4; c.strokeStyle = met ? '#8ff09a' : '#ffb347'; c.stroke();
        c.textBaseline = 'middle';
        c.textAlign = 'left'; c.fillStyle = this.closing || this.rushOn || this.tutorial ? '#ffb347' : '#f6e7d0';
        fitFont(c, time, w * 0.3, h * 0.5, 900);
        c.fillText(time, w * 0.05, h * 0.55);
        c.textAlign = 'right'; c.fillStyle = met ? '#8ff09a' : '#ffe08a';
        fitFont(c, `${naira(this.money)} / ${naira(this.target)}`, w * 0.56, h * 0.52, 900);
        c.fillText(`${naira(this.money)} / ${naira(this.target)}`, w * 0.95, h * 0.55);
      });
    }
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

}

const rand = ([a, b]) => a + Math.random() * (b - a);
export { PEPPER_LABEL };
