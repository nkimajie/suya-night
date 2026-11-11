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
    loyal: ['Aminu, you be my person now! I go tell the whole market.', 'My son! You be family now. Na only here I dey buy suya.'],
  },
  tolu: {
    name: 'Tolu (cab driver)', patience: 0.62, voice: { pitch: 1.0, rate: 1.25 },
    look: { skin: SKIN[2], top: 0x1f1f1f, bottom: 0x34495e, hat: 'short', phone: true, height: 1.76 },
    greet: (o) => `Boss, quick quick abeg! I get ride for five minutes. ${orderSentence(o)}`,
    happy: ['You sharp! Five stars for you, boss.', 'Correct! I dey go. Rider dey wait.'],
    hurry: 'Bros, the rider don dey call me o! Hurry!',
    leave: 'I no fit wait again o! Passenger don cancel!',
    loyal: ['My guy! I don tell all the OyaGo drivers about you.', 'Family! When I buy my own car, first trip na you.'],
  },
  emeka: {
    name: 'Big Boss Emeka', patience: 1.0, tipMul: 2.5, voice: { pitch: 0.85, rate: 0.95 },
    look: { skin: SKIN[1], top: 0xf2f2f2, bottom: 0xf2f2f2, robe: true, robeTrim: 0x2a6a3a, hat: 'kufi', hatColor: 0xb81a1a, chain: true, build: 1.3, height: 1.8 },
    greet: (o) => `My guy! Na me, Big Boss. ${orderSentence(o)} Madam no dey chop pepper o, do am well!`,
    happy: ['See am! Keep the change, my brother. Madam don smile!', 'Correct guy! Big tip for you.'],
    hurry: 'Madam don dey look me anyhow. Oya now!',
    loyal: ['My guy, I dey tell the whole office about you!', 'Aminu, when you ready to expand, call me. I go invest.'],
  },
  fatima: {
    name: 'Corper Fatima', patience: 1.1, voice: { pitch: 1.3, rate: 1.0 },
    look: { skin: SKIN[3], top: 0xc8b27a, bottom: 0x2e6b3a, hat: 'hijab', hatColor: 0x2e7d4f, badge: true, longSleeve: true, height: 1.62 },
    greet: (o) => `Sannu! I'm serving here, from Kano. ${orderSentence(o)} At home we never eat suya without masa.`,
    happy: ['Na gaskiya! This one taste like home.', 'Madalla! You do am the Kano way.'],
    hurry: 'Abeg, I have early CDS tomorrow o.',
    loyal: ['Na gaskiya, you be my Lagos family now.', 'When I go back to Kano, I go send all my people here.'],
  },
  femi: {
    name: 'Uncle Femi', patience: 1.0, voice: { pitch: 0.9, rate: 0.9 },
    look: { skin: SKIN[0], top: 0x22304a, bottom: 0x22304a, tie: 0x8a1a1a, longSleeve: true, hat: 'short', glasses: true, height: 1.75 },
    greet: (o) => `Good evening, my son. It's... for a friend. ${orderSentence(o)} My doctor — I mean, my friend — likes it the proper way.`,
    happy: ['My friend will be very happy. Very happy indeed.', 'Hmm, my friend... has good taste.'],
    hurry: 'My friend is waiting, my son.',
    loyal: ['My friend says you are the best in Lagos.', 'Alright... the friend is me. Don’t tell my doctor, my son.'],
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
    loyal: ['Hmph. You are... growing on me, Aminu.', 'Aminu, the rent can wait one week. Don’t tell anybody.'],
  },
  manager: {
    name: 'Gbam Burger manager', patience: 0.9, voice: { pitch: 1.05, rate: 1.1 },
    look: { skin: SKIN[3], top: 0x1aa59a, bottom: 0x22222a, hat: 'cap', hatColor: 0x6a2aa8, badge: true, height: 1.74 },
    greet: (o) => `Good evening. Area manager, Gbam Burger, across the road. Let me taste the competition. ${orderSentence(o)}`,
    happy: ['Hmm. Your suya is... a problem for us.', 'Come and work for Gbam Burger. We pay salary, you know.'],
    hurry: 'Our burgers take ninety seconds. Just saying.',
    leave: 'Ninety seconds at Gbam Burger. Goodbye.',
  },
  dayo: {
    name: 'Dayo (food blogger)', patience: 1.0, voice: { pitch: 0.8, rate: 0.95 },
    look: { skin: SKIN[2], top: 0x0c0c0c, bottom: 0x111111, hat: 'cap', hatColor: 0x050505, glasses: true, longSleeve: true, phone: true, height: 1.78 },
    greet: (o) => `Dayo again. No disguise this time. My followers want to see the new spot. ${orderSentence(o)}`,
    happy: ['This one go viral. Five stars.', 'Mallam Sani and Son... the standard is still there.'],
    hurry: 'My phone battery dey die o, Aminu.',
    loyal: ['My followers love this spot.', 'Mallam Sani & Son — my number one suya in Lagos.'],
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

// Rush customers: drivers from the (fictional) OyaGo ride app. In a hurry, but they tip.
export function driverCharacter(rng = Math.random) {
  const look = { skin: SKIN[Math.floor(rng() * SKIN.length)], top: 0x1a8a4a, bottom: 0x22262a, hat: 'cap', hatColor: 0x1a8a4a, phone: true, height: 1.68 + rng() * 0.12 };
  return {
    name: 'OyaGo driver', patience: 0.75, tipMul: 1.6, voice: { pitch: 0.85 + rng() * 0.35, rate: 1.2 }, look,
    greet: (o) => pick(['Boss, OyaGo driver! Quick quick. ', 'Tolu send me! ', 'Abeg I get trip now now. ']) + orderSentence(o),
    happy: ['Sharp! I go rate you five stars.', 'Correct! Tolu no lie.'],
    hurry: 'Passenger dey wait o! Abeg!',
    leave: 'I don miss my trip. Na wa!',
  };
}

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
  { title: 'Allen Avenue, Ikeja · 8:47 PM', text: 'This afternoon Mallam Sani collapsed by his suya grill. Tonight his son Aminu — you — must run the stall alone.' },
  { actor: 'adebayo', speaker: 'Chief Adebayo, the landlord', text: 'Your papa owe me rent. Three nights, Aminu. If this stall no make money, the Gbam Burger people go collect the space.' },
];

export const NIGHT_INTRO = {
  1: { title: 'Night 1 — The First Night', text: 'Beef and chicken only tonight. Mama Nkechi, Papa’s oldest customer, will show you how it’s done.' },
  2: { title: 'Night 2 — Friday Rush', text: 'Friday night: all five meats, masa is on the menu, and customers come two at a time. And this is Lagos — NEPA fit take light any moment.' },
  3: { title: 'Night 3 — The Inspection', text: 'Chief Adebayo is coming to taste for himself. And the quiet man in the black cap is back. Hit the target AND keep your rating at 3.5 stars or better.' },
  4: { title: 'Night 4 — New Lease', text: 'The lease is signed. Papa is resting at home. Tonight the regulars come back to see the new boss of the grill.' },
  5: { title: 'Night 5 — Driver Rush', text: 'Tolu don tell every OyaGo driver on Allen Avenue. Around the 1:30 mark, expect a RUSH of drivers in a hurry.' },
  6: { title: 'Night 6 — Light Off Again', text: 'The whole street is talking about NEPA. Light go go early tonight, and stay off long. A generator would help…' },
  7: { title: 'Night 7 — Across the Road', text: 'Gbam Burger has opened a “Suya Burger” shop right across the road. Their manager wants to taste yours. Keep your rating 3.5★+.' },
  8: { title: 'Night 8 — The Review', text: 'Dayo the food blogger is back — no disguise this time — and every regular is coming. Rating must stay 3.8★+.' },
};

export const NIGHT_PASS = {
  1: { speaker: 'Papa’s notebook', text: '“The first night is the hardest. The fire remembers you now.” You made it through Night 1.' },
  2: { speaker: 'Chief Adebayo (on the phone)', text: 'I hear say you sell well tonight. Hmph. Tomorrow I go come myself. We go see.' },
  4: { speaker: 'Mallam Sani (on the phone)', text: 'Mama Nkechi call me. She say you dey do am like me. Keep the tin growing, my son.' },
  5: { speaker: 'Tolu', text: 'Boss! The drivers dey talk about you for the group chat. You don blow!' },
  6: { speaker: 'Corper Fatima', text: 'Even in the dark, your suya no fail. My service year ends soon — I will tell all of Kano.' },
  7: { speaker: 'Chief Adebayo', text: 'Their burger shop was empty tonight. Hmph. I knew this stall had something.' },
};
export const SHOP_INTRO = { speaker: 'Papa’s notebook', text: '“Rent first — the rest na your own.” Everything above the target goes into Papa’s savings tin. Spend it on the stall.' };

export const ACT2_INTRO = [
  { actor: 'adebayo', speaker: 'Chief Adebayo', text: 'I don sign your new lease. One year. Rent every night, on time. Na business, Aminu.' },
  { actor: 'sani', speaker: 'Mallam Sani', text: 'The doctor say make I rest. So na you be the boss now. Grow this spot, my son. I paint new sign for you.' },
];
export const ACT2_END = [
  { actor: 'dayo', speaker: 'Dayo, “Eat Lagos with Dayo”', text: 'Lekki people dey ask me where Mallam Sani & Son dey. Gbam Burger no fit. Five stars — again.' },
  { actor: 'nkechi', speaker: 'Mama Nkechi', text: 'Aminu! My daughter Adaeze dey marry next month. Na you go cater the owambe. Three hundred guests!' },
  { actor: 'sani', speaker: 'Mallam Sani', text: 'Three hundred sticks... My son, we go need a bigger fire.' },
];

export const NIGHT_FAIL = {
  speaker: 'Chief Adebayo', text: 'Na this one you call money? Gbam Burger people go pay me ten times this. Try again — or pack your load.',
};

export const ENDING_GOOD = [
  { actor: 'blackcap', speaker: 'Man in the black cap', text: 'I’m Dayo. People online know me as “Eat Lagos with Dayo”. I’ve been coming here three nights to see if the young man could keep his father’s standard. He did. My review goes up tonight.' },
  { actor: 'adebayo', speaker: 'Chief Adebayo', text: 'Hmph... With this kind of crowd, Gbam Burger can wait. The space is yours, Aminu. But the rent — on time!' },
  { actor: 'sani', speaker: 'Mallam Sani', text: 'I discharge myself to come see. ... Give me one stick. ... Aminu... you don use my yaji well. The spot na your own now.' },
];
export const ENDING_BAD_BLOGGER = 'I’m Dayo, “Eat Lagos with Dayo”. I came to see if the son could keep his father’s standard. ... Not yet. Maybe next time.';
