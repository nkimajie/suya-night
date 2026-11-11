// Shop upgrades bought with Papa's savings. Every one changes the stall you can see.
// Effects are applied in Game.applyUpgrades(); visuals live in env.setUpgrades / kitchen.setUpgrades.
export const UPGRADES = [
  { id: 'tin', name: 'Tip tin', price: 4000, desc: 'A tin on the counter: customers tip 15% more.' },
  { id: 'lights', name: 'Canopy lights', price: 5000, desc: 'Bulbs strung across the stall: customers wait 20% longer.' },
  { id: 'charcoal', name: 'Hardwood charcoal', price: 6000, desc: 'Hotter, brighter coals: meat cooks 15% faster.' },
  { id: 'fan', name: 'Big abebe fan', price: 7000, desc: 'A bigger woven fan: fanning 50% stronger, fire dies 30% slower.' },
  { id: 'yaji', name: 'Papa’s yaji blend', price: 9000, desc: 'The secret recipe in a gold-cap shaker: +10% on every order.' },
  { id: 'generator', name: 'Generator', price: 12000, desc: 'When NEPA takes light, the gen starts in a few seconds.' },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// Regulars become friends, then family, the more 4★+ orders you serve them.
export const LOYALTY = { friend: 2, family: 5 };
export const loyaltyTier = (count) => (count >= LOYALTY.family ? 2 : count >= LOYALTY.friend ? 1 : 0);
export const TIER_NAME = ['', 'FRIEND', 'FAMILY'];
export const TIER_PERK = [
  { patience: 1, tip: 1 },
  { patience: 1.15, tip: 1.25 },
  { patience: 1.3, tip: 1.6 },
];
