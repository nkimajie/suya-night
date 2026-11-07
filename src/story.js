import { orderSentence } from './customers.js';

// Skin tones and outfits are all procedural; colours chosen for readability at night.
const SKIN = [0x3b2416, 0x4a2c1a, 0x5a3520, 0x6b4226, 0x7a4b2c, 0x8a5a36];

export const CHARACTERS = {
  nkechi: {
    name: 'Mama Nkechi', patience: 1.6, voice: { pitch: 1.25, rate: 0.95 },
    look: { skin: SKIN[3], top: 0xd23a7a, bottom: 0x2a6fb0, robe: true, robeTrim: 0xffd34d, hat: 'gele', hatColor: 0xf0a020, build: 1.15, height: 1.64 },
    greet: (o) => `Ah, Aminu! Where your papa? ... Ehen. Give me ${lc(orderSentence(o))} Your papa know.`,
    happy: ['Ehen! Na so your papa dey do am. God bless you, my son.', 'This one sweet well well! Mallam Sani go proud of you.'],
    hurry: 'Aminu, my legs dey pain me o. Hurry small.',
  },
  tolu: {
    name: 'Tolu (cab driver)', patience: 0.62, voice: { pitch: 1.0, rate: 1.25 },
    look: { skin: SKIN[2], top: 0x1f1f1f, bottom: 0x34495e, hat: 'short', phone: true, height: 1.76 },
    greet: (o) => `Boss, quick quick abeg! I get ride for five minutes. ${orderSentence(o)}`,
    happy: ['You sharp! Five stars for you, boss.', 'Correct! I dey go. Rider dey wait.'],
    hurry: 'Bros, the rider don dey call me o! Hurry!',
    leave: 'I no fit wait again o! Passenger don cancel!',
  },
  emeka: {
    name: 'Big Boss Emeka', patience: 1.0, tipMul: 2.5, voice: { pitch: 0.85, rate: 0.95 },
    look: { skin: SKIN[1], top: 0xf2f2f2, bottom: 0xf2f2f2, robe: true, robeTrim: 0x2a6a3a, hat: 'kufi', hatColor: 0xb81a1a, chain: true, build: 1.3, height: 1.8 },
    greet: (o) => `My guy! Na me, Big Boss. ${orderSentence(o)} Madam no dey chop pepper o, do am well!`,
    happy: ['See am! Keep the change, my brother. Madam don smile!', 'Correct guy! Big tip for you.'],
    hurry: 'Madam don dey look me anyhow. Oya now!',
  },
  fatima: {
    name: 'Corper Fatima', patience: 1.1, voice: { pitch: 1.3, rate: 1.0 },
    look: { skin: SKIN[3], top: 0xc8b27a, bottom: 0x2e6b3a, hat: 'hijab', hatColor: 0x2e7d4f, badge: true, longSleeve: true, height: 1.62 },
    greet: (o) => `Sannu! I'm serving here, from Kano. ${orderSentence(o)} At home we never eat suya without masa.`,
    happy: ['Na gaskiya! This one taste like home.', 'Madalla! You do am the Kano way.'],
    hurry: 'Abeg, I have early CDS tomorrow o.',
  },
  femi: {
    name: 'Pastor Femi', patience: 1.0, voice: { pitch: 0.9, rate: 0.9 },
    look: { skin: SKIN[0], top: 0x22304a, bottom: 0x22304a, tie: 0x8a1a1a, longSleeve: true, hat: 'short', glasses: true, height: 1.75 },
    greet: (o) => `Good evening, my son. It's... for a friend. ${orderSentence(o)} My friend likes it the proper way.`,
    happy: ['My friend will be very happy. Very happy indeed.', 'Hmm, my friend... has good taste.'],
    hurry: 'My friend is waiting, my son.',
  },
  blackcap: {
    name: 'Man in the black cap', patience: 1.0, voice: { pitch: 0.8, rate: 0.85 },
    look: { skin: SKIN[2], top: 0x0c0c0c, bottom: 0x111111, hat: 'cap', hatColor: 0x050505, glasses: true, longSleeve: true, height: 1.78 },
    greet: (o) => `... ${orderSentence(o)}`,
    happy: ['Hmm.', '... Not bad.'],
    hurry: '...',
  },
  adebayo: {
    name: 'Chief Adebayo', patience: 0.9, voice: { pitch: 0.75, rate: 0.9 },
    look: { skin: SKIN[4], top: 0x5a2a7a, bottom: 0x5a2a7a, robe: true, robeTrim: 0xffd34d, hat: 'fila', hatColor: 0x5a2a7a, build: 1.35, height: 1.78 },
    greet: (o) => `So this is the famous suya. Let me taste it myself. ${orderSentence(o)}`,
    happy: ['Hmm. It is... edible. We shall see.', 'I will not lie, this one sweet. Hmph.'],
    hurry: 'Is this how you will serve Lagos? Hurry up!',
  },
  sani: {
    name: 'Mallam Sani', patience: 1, voice: { pitch: 0.8, rate: 0.85 },
    look: { skin: SKIN[1], top: 0xf4f1e8, bottom: 0xf4f1e8, robe: true, robeTrim: 0xc0a060, hat: 'kufi', hatColor: 0xe8e0c8, height: 1.7 },
  },
};

const GENERIC = [
  { name: 'Okada rider', look: { top: 0xd8a020, bottom: 0x2a2a2a, hat: 'cap', hatColor: 0x2a4a8a } },
  { name: 'Nurse Bisi', look: { top: 0xe8f0f8, bottom: 0xe8f0f8, longSleeve: false, hat: 'short', height: 1.65 } },
  { name: 'Student', look: { top: 0x2a8a6a, bottom: 0x1f3a5a, hat: 'short', height: 1.7 } },
  { name: 'Security man', look: { top: 0x2a3a2a, bottom: 0x1a1a1a, hat: 'cap', hatColor: 0x1a2a1a, height: 1.8, build: 1.1 } },
  { name: 'Aunty Joy', look: { top: 0xe85a2a, bottom: 0x6a2a8a, robe: true, robeTrim: 0x2ab0a0, hat: 'gele', hatColor: 0x2ab0a0, height: 1.63, build: 1.1 } },
  { name: 'Banker', look: { top: 0xdde6f0, bottom: 0x1a1f2a, tie: 0x1a3a8a, longSleeve: true, hat: 'short', height: 1.77 } },
  { name: 'Mechanic Ola', look: { top: 0x3a4a6a, bottom: 0x3a4a6a, longSleeve: true, hat: 'short', height: 1.74, build: 1.1 } },
  { name: 'Tailor Ronke', look: { top: 0x9a2a5a, bottom: 0x2a2a6a, hat: 'gele', hatColor: 0xe0c020, height: 1.6 } },
];
const GENERIC_GREETS = [
  'Good evening o! ', 'Oga, how far? ', 'Abeg, ', 'Sannu, ', 'Evening boss. ', 'Wetin dey happen? Abeg ', 'Na you dey here today? Okay. ',
];
const GENERIC_HAPPY = ['Correct suya!', 'Oya, this one sweet die!', 'Thank you o! I go come back tomorrow.', 'E choke! Well done.', 'Na so! Your papa train you well.'];

export function genericCharacter(rng = Math.random) {
  const base = GENERIC[Math.floor(rng() * GENERIC.length)];
  const look = { ...base.look, skin: SKIN[Math.floor(rng() * SKIN.length)] };
  const greetPre = GENERIC_GREETS[Math.floor(rng() * GENERIC_GREETS.length)];
  return {
    name: base.name, patience: 1, voice: { pitch: 0.85 + rng() * 0.4, rate: 1 + rng() * 0.15 }, look,
    greet: (o) => greetPre + lcFirst(orderSentence(o), greetPre),
    happy: GENERIC_HAPPY,
  };
}

// Reactions to a wrong order, keyed by the main problem.
export const COMPLAINTS = {
  wrongMeat: ['Na wetin be this? No be wetin I order!', 'I talk one thing, you give me another thing!'],
  missingMeat: ['Where the rest of my meat?', 'Na only this one? I order more than this!'],
  extraMeat: ['I no order all this one o, but I no go pay for am.'],
  raw: ['This meat still dey moo! E never done!', 'Haba! Na raw meat you wan give me?'],
  burnt: ['Na charcoal you wan sell me?!', 'This one don burn finish!'],
  pepperMissing: ['Where the pepper? Na plain meat be this?', 'I talk say make you put pepper!'],
  pepperExtra: ['Who tell you say I want pepper?!', 'Ehn! This pepper go kill me o!'],
  pepperWrong: ['The pepper no correct at all.', 'Pepper no reach. Or e too much. E no correct.'],
  sides: ['Where my sides?', 'You forget my onions and the rest.', 'I no ask for this one inside.'],
  leave: ['I don tire to wait. I dey go!', 'Na wa o. Make I find another suya spot.'],
};

export const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const lcFirst = (s, pre) => (/[,.!?]\s*$/.test(pre.trim()) || pre.trim() === '' ? s : lc(s));

// ---------------------------------------------------------------- story beats
export const INTRO = [
  { title: 'Allen Avenue, Ikeja', text: '8:47 PM. For thirty years, Mallam Sani’s suya has fed this street. Drivers, nurses, bankers, pastors — everybody passes through.' },
  { title: 'Tonight is different', text: 'This afternoon, Mallam Sani collapsed by the grill and was rushed to hospital. His son Aminu — that’s you — has never run the grill alone.' },
  { actor: 'adebayo', speaker: 'Chief Adebayo, the landlord', text: 'Aminu. Your papa owe me three months rent. If this stall no make money in three nights, I go give the space to Crunchy King people. Dem dey wait.' },
  { speaker: 'Papa’s notebook', text: '“Fan the fire. Watch the meat. Respect the customer.” That’s all you have. Three nights. Let’s cook.' },
];

export const NIGHT_INTRO = {
  1: { title: 'Night 1 — The First Night', text: 'Beef and chicken only tonight. Mama Nkechi, Papa’s oldest customer, will show you how it’s done.' },
  2: { title: 'Night 2 — Friday Rush', text: 'Friday night: all five meats, masa is on the menu, and customers come two at a time. And this is Lagos — NEPA fit take light any moment.' },
  3: { title: 'Night 3 — The Inspection', text: 'Chief Adebayo is coming to taste for himself. And the quiet man in the black cap is back. Hit the target AND keep your rating at 3.5 stars or better.' },
};

export const NIGHT_PASS = {
  1: { speaker: 'Papa’s notebook', text: '“The first night is the hardest. The fire remembers you now.” You made it through Night 1.' },
  2: { speaker: 'Chief Adebayo (on the phone)', text: 'I hear say you sell well tonight. Hmph. Tomorrow I go come myself. We go see.' },
};
export const NIGHT_FAIL = {
  speaker: 'Chief Adebayo', text: 'Na this one you call money? Crunchy King people go pay me ten times this. Try again — or pack your load.',
};

export const ENDING_GOOD = [
  { actor: 'blackcap', speaker: 'Man in the black cap', text: 'I’m Dayo. People online know me as “Eat Lagos with Dayo”. I’ve been coming here three nights to see if the young man could keep his father’s standard. He did. My review goes up tonight.' },
  { actor: 'adebayo', speaker: 'Chief Adebayo', text: 'Hmph... With this kind of crowd, Crunchy King can wait. The space is yours, Aminu. But the rent — on time!' },
  { actor: 'sani', speaker: 'Mallam Sani', text: 'I discharge myself to come see. ... Give me one stick. ... Aminu... you don use my yaji well. The spot na your own now.' },
];
export const ENDING_BAD_BLOGGER = 'I’m Dayo, “Eat Lagos with Dayo”. I came to see if the son could keep his father’s standard. ... Not yet. Maybe next time.';
