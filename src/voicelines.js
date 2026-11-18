// Every recorded voice line, grouped into short recording sections (F = female voice, M = male).
// The recording script docs/VOICE_SCRIPT.md is generated from this list (`npm run voice-script`), and
// `npm run voices` cuts voices-raw/<CODE>.* into public/voices/<CODE>-<nn>.m4a in this order.
// At runtime a line is found by speaker sex + its exact text (see audio.js), so the game, the script
// and the clips can never disagree. Lines without a clip fall back to the murmur.
import { CHARACTERS as C, COMPLAINTS as K, LINES as L, GENERIC_GREETS, GENERIC_HAPPY, DRIVER, INTRO, NIGHT_FAIL, NIGHT_PASS, ACT2_INTRO, ACT2_END, ENDING_GOOD, ENDING_BAD_BLOGGER } from './story.js';

const trim = (a) => a.map((s) => s.trim());
const everyday = (sex, n) => {
  const who = sex === 'f' ? 'Everyday woman in the queue' : 'Everyday man in the queue';
  const dir = sex === 'f'
    ? 'Any Lagos woman buying suya after work: nurse, aunty, tailor. Natural street Pidgin. Vary the energy a little from line to line.'
    : 'Any Lagos man buying suya: okada rider, student, security man, banker, mechanic. Natural street Pidgin. Vary the energy a little.';
  return [
    { code: sex.toUpperCase() + n[0], sex, round: 1, who: `${who}: hello`, dir: dir + ' The order itself shows in the speech bubble, so just say the greeting.', lines: [...trim(GENERIC_GREETS), L.hurry, L.nepa] },
    { code: sex.toUpperCase() + n[1], sex, round: 1, who: `${who}: happy / leaving`, dir: 'Happy and satisfied, except the last two: fed up of waiting and walking away.', lines: [...GENERIC_HAPPY, L.notBad, ...K.leave] },
    { code: sex.toUpperCase() + n[2], sex, round: 1, who: `${who}: the Lagos handshake`, dir: 'A friendly regular offering a handshake, then laughing when the snap lands. Big and warm.', lines: [...L.shakeOffer, ...L.snap, L.noSnap, ...L.shakeTimeout] },
    { code: sex.toUpperCase() + n[3], sex, round: 2, who: `${who}: complaints (meat)`, dir: 'Annoyed customer. Lagos-annoyed, not shouting-angry. The last two are said after a complaint.', lines: [...K.wrongMeat, ...K.missingMeat, ...K.extraMeat, ...K.raw, ...K.burnt, L.payHalf, L.payNone] },
    { code: sex.toUpperCase() + n[4], sex, round: 2, who: `${who}: complaints (pepper and sides)`, dir: 'Same annoyed customer. The pepper ones can be dramatic.', lines: [...K.pepperMissing, ...K.pepperExtra, ...K.pepperWrong, ...K.sides, L.smallThing] },
    { code: sex.toUpperCase() + n[5], sex, round: 3, who: `${who}: bank transfer`, dir: 'Paying by phone transfer. First three: the transfer failed, slightly embarrassed, paying cash instead.', lines: [...L.transferCash, L.transferPending, ...L.transferSent] },
  ];
};
const [fHello, fHappy, fShake, fMeat, fPepper, fBank] = everyday('f', ['2', '3', '4', '5', '6', '8']);
const [mHello, mHappy, mShake, mMeat, mPepper, mBank] = everyday('m', ['2', '3', '4', '5', '6', '13']);
const asCustomer = (c) => [c.greetVoice, ...(c.happy || []), c.hurry, c.leave, ...(c.loyal || [])].filter((s) => s && s !== '...');

export const VOICE_SECTIONS = [
  // ---------------------------------------------------------------- female voice
  { code: 'F1', sex: 'f', round: 1, who: 'Mama Nkechi (the tutorial customer, Papa’s oldest customer)',
    dir: 'Older market woman, warm and motherly, a little teasing. She has known Aminu since he was small. Every player hears her first.',
    lines: [...asCustomer(C.nkechi), L.shakeOfferTutorial, ACT2_END[1].text] },
  fHello, fHappy, fShake, fMeat, fPepper,
  { code: 'F7', sex: 'f', round: 2, who: 'Corper Fatima (NYSC corps member from Kano)',
    dir: 'Young, bright and friendly, far from home. Sannu = hello, Na gaskiya = it’s true, Madalla = well done (Hausa).',
    lines: [...asCustomer(C.fatima), NIGHT_PASS[6].text] },
  fBank,
  // ---------------------------------------------------------------- male voice
  { code: 'M1', sex: 'm', round: 1, who: 'Chief Adebayo (the landlord): story',
    dir: 'Rich landlord. Deep, slow, proud, a bit dramatic. "Hmph" is a disapproving grunt. His first line is the first voice in the game.',
    lines: [INTRO[1].text, NIGHT_FAIL.text, ACT2_INTRO[0].text, ENDING_GOOD[1].text, NIGHT_PASS[2].text, NIGHT_PASS[7].text] },
  mHello, mHappy, mShake, mMeat, mPepper,
  { code: 'M7', sex: 'm', round: 2, who: 'Mallam Sani (Aminu’s father)',
    dir: 'Older man, just out of hospital: tired, gentle, proud of his son. Slow, with pauses where you see "...".',
    lines: [ACT2_INTRO[1].text, ACT2_END[2].text, ENDING_GOOD[2].text, NIGHT_PASS[4].text] },
  { code: 'M8', sex: 'm', round: 2, who: 'Dayo (the quiet man in the black cap, secretly a food blogger)',
    dir: 'Cool, few words. First two lines: barely impressed. The two long ones are his big reveal at the end of Act 1; the rest is Act 2, now relaxed and friendly.',
    lines: [...asCustomer(C.blackcap), ENDING_GOOD[0].text, ENDING_BAD_BLOGGER, ...asCustomer(C.dayo), ACT2_END[0].text] },
  { code: 'M9', sex: 'm', round: 2, who: 'Chief Adebayo as a customer', dir: 'Same landlord, now tasting the suya himself. Grudging.', lines: asCustomer(C.adebayo) },
  { code: 'M10', sex: 'm', round: 2, who: 'Big Boss Emeka', dir: 'Loud, jolly big man in agbada, generous, buying for his wife ("Madam").', lines: asCustomer(C.emeka) },
  { code: 'M11', sex: 'm', round: 2, who: 'Tolu (ride-hail driver)', dir: 'Always rushing. Talks fast.', lines: [...asCustomer(C.tolu), NIGHT_PASS[5].text] },
  { code: 'M12', sex: 'm', round: 2, who: 'Uncle Femi', dir: 'Polite older office man, sheepish: the suya is "for a friend" but really for himself (his doctor said no).', lines: asCustomer(C.femi) },
  mBank,
  { code: 'M14', sex: 'm', round: 3, who: 'Gbam Burger manager (the rival)', dir: 'Smooth corporate voice, a bit smug.', lines: asCustomer(C.manager) },
  { code: 'M15', sex: 'm', round: 3, who: 'OyaGo drivers', dir: 'Hurried and friendly, phone in hand.', lines: [...trim(DRIVER.greets), ...DRIVER.happy, DRIVER.hurry, DRIVER.leave] },
];

export const clipName = (code, i) => `${code}-${String(i + 1).padStart(2, '0')}`;
