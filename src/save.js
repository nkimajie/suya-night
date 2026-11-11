// Versioned save in localStorage. Everything is offline; clearing browser data resets it.
import { LEVEL_COUNT } from './levels.js';
import { UPGRADES } from './upgrades.js';

const KEY = 'suya-night-save-v2';
const OLD_KEY = 'suya-night-progress-v1';
export const START_SAVINGS = 5000; // Papa's tin: enough for one small upgrade after Night 1

export function defaultSave() {
  return {
    v: 2, mode: 'story', voice: false, tutorialDone: false, allOpen: false,
    act1Done: false, act2Done: false, shopSeen: false,
    levels: {},        // n -> { stars 0..3, best money }
    savings: START_SAVINGS, earned: 0,
    upgrades: {},      // id -> true
    loyalty: {},       // character id -> good (4★+) orders served
  };
}

export function loadSave() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  if (!raw) {
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_KEY)); } catch { old = null; }
    raw = old ? migrateV1(old) : null;
  }
  return sanitize(raw);
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable (private mode) */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch { /* ignore */ }
  return defaultSave();
}

// v1 = { unlocked, tutorialDone, mode, finished }
export function migrateV1(o) {
  const s = defaultSave();
  if (o.mode === 'story' || o.mode === 'rush') s.mode = o.mode;
  s.tutorialDone = !!o.tutorialDone;
  const unlocked = Math.max(1, Math.min(4, Number(o.unlocked) || 1));
  for (let n = 1; n < unlocked; n++) s.levels[n] = { stars: 1, best: 0 };
  if (o.finished) { for (let n = 1; n <= 3; n++) s.levels[n] = { stars: 1, best: 0 }; s.act1Done = true; }
  return s;
}

function sanitize(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.mode === 'story' || raw.mode === 'rush') s.mode = raw.mode;
  for (const k of ['voice', 'tutorialDone', 'act1Done', 'act2Done', 'shopSeen', 'allOpen']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
  const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  s.savings = Math.round(num(raw.savings, 0, 1e9, START_SAVINGS));
  s.earned = Math.round(num(raw.earned, 0, 1e10, 0));
  if (raw.levels && typeof raw.levels === 'object') {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const l = raw.levels[n];
      if (l && typeof l === 'object') s.levels[n] = { stars: Math.round(num(l.stars, 0, 3, 0)), best: Math.round(num(l.best, 0, 1e9, 0)) };
    }
  }
  const known = new Set([...UPGRADES.map((u) => u.id), 'sign']);
  if (raw.upgrades && typeof raw.upgrades === 'object') for (const [k, v] of Object.entries(raw.upgrades)) if (known.has(k) && v === true) s.upgrades[k] = true;
  if (s.act1Done) s.upgrades.sign = true; // the Act 1 reward (also for migrated v1 saves)
  if (raw.loyalty && typeof raw.loyalty === 'object') for (const [k, v] of Object.entries(raw.loyalty)) if (/^[a-z]+$/.test(k)) s.loyalty[k] = Math.round(num(v, 0, 999, 0));
  return s;
}
