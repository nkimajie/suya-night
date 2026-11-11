// Shared constants: stall layout (stall-local metres, origin = seated head position,
// player faces -Z), meats, sides, pricing and per-night tuning.

export const CY = -0.42; // counter top height relative to the seated head

// Everything you touch stays within ~0.6 m of the head (seated two-foot rule); tests/smoke.mjs checks it.
export const LAYOUT = {
  counter: { x0: -0.58, x1: 0.58, z0: -0.80, z1: -0.20 },
  tray: { x: -0.36, z: -0.46, w: 0.25, d: 0.30 },          // raw skewer tray
  grill: { x: -0.02, z: -0.47, w: 0.34, d: 0.30, h: 0.12 }, // grate top = CY + h
  board: { x: 0.33, z: -0.44, w: 0.27, d: 0.23 },          // newspaper on the cutting board
  bowls: { z: -0.27, xs: [0.27, 0.35, 0.43, 0.51], r: 0.038 }, // sides: a row in front of the paper (clear of the shaker)
  shaker: { x: 0.155, z: -0.275 },
  bin: { x: -0.5, z: -0.25, r: 0.05 },
  fan: { x: -0.29, z: -0.255 },        // woven hand fan: handle end; blade lies in front of the tray
  tin: { x: 0.52, z: -0.58 },          // tip tin (shop upgrade), behind-right of the paper (look, don't touch)
  customerZ: -1.0,
  handZ: -0.64,                        // where customers hold out their hand / the naira
  slots: [-0.32, 0.0, 0.32],
};
// Tray compartments left -> right: the two Night 1 meats sit nearest the grill (and the hand).
export const TRAY_ORDER = ['kidney', 'gizzard', 'ram', 'chicken', 'beef'];

export const MEATS = {
  beef:    { name: 'Beef',    price: 2500, raw: 0x9a2424, cooked: 0x6e3518, shape: 'chunk' },
  ram:     { name: 'Ram',     price: 3500, raw: 0x7e1d2a, cooked: 0x5b2b14, shape: 'chunk' },
  chicken: { name: 'Chicken', price: 3000, raw: 0xeab0a0, cooked: 0xbd7a32, shape: 'chunk' },
  gizzard: { name: 'Gizzard', price: 2500, raw: 0x6c1a28, cooked: 0x4c2510, shape: 'ball' },
  kidney:  { name: 'Kidney',  price: 3000, raw: 0x5e2030, cooked: 0x4a210f, shape: 'slice' },
};
export const MEAT_ORDER = ['beef', 'ram', 'chicken', 'gizzard', 'kidney'];

export const SIDES = {
  onions:   { name: 'Onions',   color: 0xe9d6ee, price: 0 },
  cabbage:  { name: 'Cabbage',  color: 0x9fd07a, price: 0 },
  tomatoes: { name: 'Tomatoes', color: 0xd8342a, price: 0 },
  masa:     { name: 'Masa',     color: 0xf3e6c4, price: 500 },
};
export const SIDE_ORDER = ['onions', 'cabbage', 'tomatoes', 'masa'];

export const PEPPER = ['none', 'normal', 'plenty'];
export const PEPPER_LABEL = { none: 'No pepper', normal: 'Normal pepper', plenty: 'PLENTY pepper' };
export function pepperLevel(shakes) {
  if (shakes <= 0) return 'none';
  if (shakes < 6) return 'normal';
  return 'plenty';
}

// Cooking: each skewer side has a cook value. < GOLDEN = raw, > BURNT = burnt.
export const HEAT = { start: 0.75, decay: 0.014, floor: 0.12, low: 0.3 }; // full -> floor in ~60 s
export const COOK = { GOLDEN: 0.5, BURNT: 1.05, baseRate: 0.11 };

// Per-night tuning, scripts and tips live in levels.js.


// Difficulty multipliers. Story mode is the default so anyone can finish.
export const MODES = {
  story: { label: 'Story', patience: 1.35, target: 0.8, cook: 0.9 },
  rush:  { label: 'Rush',  patience: 0.85, target: 1.0, cook: 1.15 },
};

export const naira = (n) => '₦' + Math.round(n).toLocaleString('en-US');
