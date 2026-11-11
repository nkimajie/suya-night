// The business ladder: stages (places / chapters) and the playable nights inside them.
// Night numbers are global (1..LEVELS.length) so saves, the HUD and tests can use `n`.
import { MEAT_ORDER, SIDE_ORDER } from './config.js';

export const STAGES = [
  { id: 1, name: 'Mallam Sani’s Corner', place: 'Allen Avenue, Ikeja', nights: [1, 2, 3],
    blurb: 'Save Papa’s stall from the landlord in three nights.' },
  { id: 2, name: 'The Spot Grows', place: 'Allen Avenue, Ikeja', nights: [4, 5, 6, 7, 8],
    blurb: 'New lease. Grow the business: upgrades, regulars and a rival across the road.' },
  { id: 3, name: 'Owambe Contract', place: 'Wedding hall, Ikeja GRA', nights: [], soon: true,
    blurb: 'Cater Mama Nkechi’s daughter’s wedding: fill the party packs before the MC calls for food.' },
  { id: 4, name: 'Match Night', place: 'Viewing centre, Surulere', nights: [], soon: true,
    blurb: 'The rush follows the football. Goals bring crowds, half-time brings waves. Roasted corn and ube.' },
  { id: 5, name: 'Yaba Campus Spot', place: 'Yaba', nights: [], soon: true,
    blurb: 'Students, tech hubs and cold zobo. Group orders paid in five different transfers.' },
  { id: 6, name: 'Sani & Son Suya House', place: 'Lekki, December', nights: [], soon: true,
    blurb: 'Sit-down tables, card payments and the Detty December crowd.' },
  { id: 7, name: 'Barka da Sallah', place: 'Abuja & Kano', nights: [], soon: true,
    blurb: 'A new branch, and Papa takes you to the kilishi masters in Kano.' },
];

// Tuning per night. `script` arrivals have fixed orders so story beats always land; random
// customers fill the gaps. Events: blackout {start,end}; rush {start,end} (OyaGo drivers).
export const LEVELS = [
  {
    id: 1, stage: 1, title: 'The First Night', duration: 300, target: 15000,
    meats: ['beef', 'chicken'], sides: ['onions', 'cabbage', 'tomatoes'],
    concurrent: 1, maxSkewers: 1, patience: 95, gap: [4, 8],
    script: [
      { at: 0, who: 'nkechi', order: { meats: ['beef'], pepper: 'plenty', sides: ['onions'] }, tutorial: true },
      { at: 70, who: 'tolu', order: { meats: ['chicken'], pepper: 'normal', sides: [] } },
      { at: 170, who: 'blackcap', order: { meats: ['beef'], pepper: 'none', sides: [] } },
    ],
    tips: ['Fire bar low? Grab the fan: cold coals cook slowly.', 'Serve 4★+ in a row for a COMBO bonus.', 'Turn sticks before they smoke black.', 'Read the order card on the counter.', 'Wrong stick? Drop it in the WASTE bucket.'],
  },
  {
    id: 2, stage: 1, title: 'Friday Rush', duration: 300, target: 30000,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 2, patience: 100, gap: [3, 7],
    blackout: { start: 95, end: 165 },
    script: [
      { at: 4, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa'] } },
      { at: 45, who: 'emeka', order: { meats: ['ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage'] } },
      { at: 110, who: 'femi', order: { meats: ['kidney'], pepper: 'plenty', sides: [] } },
      { at: 175, who: 'tolu', order: { meats: ['beef'], pepper: 'normal', sides: ['onions'] } },
      { at: 225, who: 'blackcap', order: { meats: ['gizzard'], pepper: 'normal', sides: ['tomatoes'] } },
    ],
    tips: ['Two customers at once: grill ahead!', 'Masa costs ₦500 extra.', 'Cooked early? Park sticks on the KEEP WARM end.', 'NEPA fit take light. Watch the smoke.'],
  },
  {
    id: 3, stage: 1, title: 'The Inspection', duration: 300, target: 40000, minRating: 3.5,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 3, patience: 100, gap: [2, 6],
    script: [
      { at: 3, who: 'nkechi', order: { meats: ['beef', 'beef'], pepper: 'plenty', sides: ['onions'] } },
      { at: 40, who: 'adebayo', order: { meats: ['beef'], pepper: 'normal', sides: ['cabbage'] } },
      { at: 100, who: 'emeka', order: { meats: ['ram', 'ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage', 'masa'] } },
      { at: 150, who: 'femi', order: { meats: ['kidney', 'chicken'], pepper: 'plenty', sides: [] } },
      { at: 190, who: 'blackcap', order: { meats: ['ram', 'kidney', 'gizzard'], pepper: 'plenty', sides: ['onions', 'tomatoes', 'masa'] } },
      { at: 240, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa'] } },
    ],
    tips: ['Rating must stay 3.5★ or more.', 'Big orders: use many grill slots.', 'No pepper means NO shakes at all.', 'The man in the black cap is watching...'],
  },
  // ---------------------------------------------------------------- Stage 2: The Spot Grows
  {
    id: 4, stage: 2, title: 'New Lease', duration: 270, target: 34000,
    meats: ['beef', 'ram', 'chicken', 'gizzard'], sides: ['onions', 'cabbage', 'tomatoes'],
    concurrent: 2, maxSkewers: 2, patience: 105, gap: [3, 7],
    script: [
      { at: 2, who: 'nkechi', order: { meats: ['beef', 'chicken'], pepper: 'normal', sides: ['onions'] } },
      { at: 40, who: 'tolu', order: { meats: ['gizzard'], pepper: 'plenty', sides: [] } },
      { at: 100, who: 'adebayo', order: { meats: ['ram'], pepper: 'normal', sides: ['cabbage'] } },
      { at: 165, who: 'femi', order: { meats: ['chicken'], pepper: 'plenty', sides: ['tomatoes'] } },
      { at: 215, who: 'emeka', order: { meats: ['ram', 'ram'], pepper: 'none', sides: ['onions', 'tomatoes'] } },
    ],
    tips: ['Beat the target: the extra goes into Papa’s savings tin.', '★★ = 125% of target. ★★★ = 150% and 4★ rating.', 'Regulars who love your suya become FRIENDS: more patience, bigger tips.', 'Spend savings in the SHOP between nights.'],
  },
  {
    id: 5, stage: 2, title: 'Driver Rush', duration: 280, target: 40000,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 2, patience: 100, gap: [3, 7],
    rush: { start: 80, end: 170 },
    script: [
      { at: 3, who: 'tolu', order: { meats: ['beef'], pepper: 'normal', sides: ['onions'] } },
      { at: 45, who: 'fatima', order: { meats: ['chicken', 'chicken'], pepper: 'normal', sides: ['masa'] } },
      { at: 185, who: 'nkechi', order: { meats: ['beef', 'gizzard'], pepper: 'plenty', sides: ['onions', 'tomatoes'] } },
      { at: 235, who: 'emeka', order: { meats: ['ram', 'kidney'], pepper: 'none', sides: ['cabbage', 'masa'] } },
    ],
    tips: ['RUSH: OyaGo drivers are in a hurry, but they tip well.', 'Keep 2 sticks cooking at all times.', 'Park ready sticks on KEEP WARM.', 'Fan between orders, not during wrapping.'],
  },
  {
    id: 6, stage: 2, title: 'Light Off Again', duration: 280, target: 40000,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 3, patience: 100, gap: [3, 6],
    blackout: { start: 70, end: 170 },
    script: [
      { at: 5, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa', 'onions'] } },
      { at: 60, who: 'femi', order: { meats: ['kidney', 'beef'], pepper: 'plenty', sides: [] } },
      { at: 120, who: 'emeka', order: { meats: ['ram', 'ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage'] } },
      { at: 200, who: 'nkechi', order: { meats: ['beef', 'beef'], pepper: 'plenty', sides: ['onions'] } },
      { at: 245, who: 'tolu', order: { meats: ['gizzard', 'chicken'], pepper: 'normal', sides: [] } },
    ],
    tips: ['NEPA go take light tonight. A GENERATOR (shop) brings it back fast.', 'In the dark, watch the gauges under the grill.', 'Big orders: use 3 grill slots.'],
  },
  {
    id: 7, stage: 2, title: 'Across the Road', duration: 280, target: 44000, minRating: 3.5, rival: true,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 3, patience: 95, gap: [2, 6],
    script: [
      { at: 3, who: 'nkechi', order: { meats: ['beef'], pepper: 'plenty', sides: ['onions', 'cabbage'] } },
      { at: 35, who: 'manager', order: { meats: ['ram', 'chicken'], pepper: 'normal', sides: ['tomatoes'] } },
      { at: 100, who: 'adebayo', order: { meats: ['beef', 'ram'], pepper: 'normal', sides: ['cabbage'] } },
      { at: 160, who: 'femi', order: { meats: ['kidney', 'chicken'], pepper: 'plenty', sides: ['onions'] } },
      { at: 230, who: 'emeka', order: { meats: ['ram', 'ram', 'gizzard'], pepper: 'none', sides: ['onions', 'cabbage', 'masa'] } },
    ],
    tips: ['Gbam Burger opened across the road. Keep your rating 3.5★+.', 'Regulars stay loyal if you treat them well.', 'The last customer is a big order: save a slot.'],
  },
  {
    id: 8, stage: 2, title: 'The Review', duration: 300, target: 50000, minRating: 3.8, rival: true,
    meats: MEAT_ORDER, sides: SIDE_ORDER,
    concurrent: 2, maxSkewers: 3, patience: 95, gap: [2, 6],
    script: [
      { at: 15, who: 'dayo', order: { meats: ['ram', 'kidney', 'gizzard'], pepper: 'plenty', sides: ['onions', 'tomatoes'] } },
      { at: 70, who: 'nkechi', order: { meats: ['beef', 'beef'], pepper: 'plenty', sides: ['onions'] } },
      { at: 120, who: 'fatima', order: { meats: ['chicken'], pepper: 'normal', sides: ['masa'] } },
      { at: 170, who: 'tolu', order: { meats: ['beef', 'gizzard'], pepper: 'normal', sides: [] } },
      { at: 215, who: 'adebayo', order: { meats: ['ram'], pepper: 'normal', sides: ['cabbage', 'tomatoes'] } },
      { at: 260, who: 'emeka', order: { meats: ['ram', 'ram', 'chicken'], pepper: 'none', sides: ['onions', 'cabbage', 'masa'] } },
    ],
    tips: ['Dayo the food blogger is back. Rating must stay 3.8★+.', 'Everybody you know is coming tonight.', 'Combos pay: keep serving 4★+.'],
  },
];

export const LEVEL_COUNT = LEVELS.length;
export const stageOf = (n) => STAGES.find((s) => s.nights.includes(n)) || STAGES[0];

// Night stars: 1 = target (and rating rule), 2 = 125%, 3 = 150% with a 4★+ average.
export const STAR_STEPS = [1, 1.25, 1.5];
export function nightStars(money, target, rating, minRating = 0) {
  if (money < target || rating < minRating) return 0;
  let s = 1;
  if (money >= target * STAR_STEPS[1]) s++;
  if (money >= target * STAR_STEPS[2] && rating >= 4) s++;
  return s;
}
