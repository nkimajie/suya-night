// `npm run voice-script`: writes docs/VOICE_SCRIPT.md (the recording script) from src/voicelines.js.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VOICE_SECTIONS } from '../src/voicelines.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const count = (sex) => VOICE_SECTIONS.filter((s) => s.sex === sex).reduce((n, s) => n + s.lines.length, 0);
const ROUND = {
  1: 'Round 1: the first five minutes (every judge hears these)',
  2: 'Round 2: complaints, the regulars and the story endings',
  3: 'Round 3: Act 2 extras',
};
let md = `# Suya Night: voice recording script

${count('f')} short lines for a **female** voice (F sections) and ${count('m')} for a **male** voice (M sections).
Record in round order and stop wherever you run out of time: any line that is not recorded yet
just plays the soft murmur it plays today. The speech bubble always shows the written line.

## How to record
- **One file per section**, named with the section code: \`F1.m4a\`, \`M3.m4a\` … (m4a, mp3 or wav;
  a phone voice-memo app is fine).
- Say the lines **in the order shown**, with **2 seconds of silence** before the first line and between lines.
  The files are cut automatically at the pauses, so don't talk or laugh in the gaps.
- **Mistake?** Stop, delete, and record that section again. They're short.
- Quiet room: switch off the fan, AC, TV and generator. Standing in front of a wardrobe full of clothes sounds great.
  Phone 20–30 cm from your mouth, a little to the side, in the same spot for the whole session.
- **Act it.** These are characters on a busy street at night, so speak up and play them big. Say each
  line in your own natural Pidgin; small wording changes are fine as long as the meaning stays the same.
  Where you see "...", leave a short dramatic pause (shorter than the 2 seconds between lines).
- One woman and one man can voice everyone. The game shifts each character's pitch slightly,
  but changing your voice a little for each named character helps a lot.
- Put every file in the \`voices-raw/\` folder in the project (no subfolders) and say which names to credit.
`;
for (const round of [1, 2, 3]) {
  md += `\n## ${ROUND[round]}\n`;
  for (const sex of ['f', 'm']) {
    for (const s of VOICE_SECTIONS.filter((x) => x.round === round && x.sex === sex)) {
      md += `\n### ${s.code}: ${s.who} (${sex === 'f' ? 'female' : 'male'})\n_${s.dir}_\n\n`;
      s.lines.forEach((l, i) => { md += `${i + 1}. ${l}\n`; });
    }
  }
}
writeFileSync(path.join(root, 'docs/VOICE_SCRIPT.md'), md);
console.log(`docs/VOICE_SCRIPT.md: ${VOICE_SECTIONS.length} sections, ${count('f')} female + ${count('m')} male lines`);
