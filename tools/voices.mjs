// `npm run voices`: turns the voice recordings in voices-raw/ into game clips (needs ffmpeg).
//   voices-raw/F1.m4a     one file per section, lines in script order, ~2 s of silence between lines
//   voices-raw/F1-03.m4a  (optional) one file per line; overrides that line from the section file
// Output: public/voices/<CODE>-<nn>.mp3 (mono, loudness-matched) + public/voices/index.json,
// which maps "f|<line>" / "m|<line>" to a clip. See src/voicelines.js and docs/VOICE_SCRIPT.md.
// `node tools/voices.mjs --in <dir>` reads another folder (used to test the pipeline).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VOICE_SECTIONS, clipName } from '../src/voicelines.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argIn = process.argv.indexOf('--in');
const RAW = argIn > 0 ? path.resolve(process.argv[argIn + 1]) : path.join(root, 'voices-raw');
const OUT = path.join(root, 'public/voices');
const AUDIO = /\.(m4a|mp3|wav|aac|ogg|opus|webm|flac|aiff?|caf|amr|3gp|mp4)$/i;

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const ffLog = (args) => String(spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args, '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''); // analysis filters log to stderr
const probeDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// Speech segments of a recording: silences found relative to its own loudness, then the shortest
// gaps merged until the count matches the script (pauses inside a line are shorter than the 2 s between lines).
function segments(file, want) {
  const vol = ffLog(['-i', file, '-af', 'volumedetect']);
  const peak = Number((vol.match(/max_volume:\s*(-?[\d.]+)/) || [])[1] ?? -10);
  const noise = Math.max(-62, Math.min(-28, peak - 32));
  const log = ffLog(['-i', file, '-af', `highpass=f=90,silencedetect=noise=${noise}dB:d=0.35`]);
  const dur = probeDur(file);
  const starts = [...log.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Math.max(0, +m[1]));
  const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => +m[1]);
  let segs = [], cursor = 0;
  starts.forEach((s, i) => { if (s > cursor) segs.push([cursor, s]); cursor = ends[i] ?? dur; });
  if (cursor < dur) segs.push([cursor, dur]);
  segs = segs.filter(([a, b]) => b - a > 0.22); // clicks, breaths
  while (segs.length > want) {
    let best = 1;
    for (let i = 2; i < segs.length; i++) if (segs[i][0] - segs[i - 1][1] < segs[best][0] - segs[best - 1][1]) best = i;
    segs.splice(best - 1, 2, [segs[best - 1][0], segs[best][1]]);
  }
  return { segs, noise, dur };
}

function encode(file, out, from, to) {
  const a = from === undefined ? [] : ['-ss', Math.max(0, from - 0.08).toFixed(3), '-to', (to + 0.18).toFixed(3)];
  const filt = 'highpass=f=80,afftdn=nf=-30,silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.015';
  ff(['-y', ...a, '-i', file, '-af', filt, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '56k', out]);
}

if (!existsSync(RAW)) { console.log(`No ${path.relative(root, RAW)}/ folder yet.`); process.exit(0); }
const files = readdirSync(RAW).filter((f) => AUDIO.test(f));
const find = (base) => files.find((f) => f.replace(AUDIO, '').toUpperCase() === base.toUpperCase());
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.mp3')) rmSync(path.join(OUT, f));

const clips = {};
const report = [];
let made = 0;
for (const sec of VOICE_SECTIONS) {
  const n = sec.lines.length;
  const whole = find(sec.code);
  let segs = null, note = '';
  if (whole) {
    const r = segments(path.join(RAW, whole), n);
    if (r.segs.length === n) segs = r.segs;
    else note = `found ${r.segs.length} of ${n} lines (pause between lines too short, or a line missing?)`;
  }
  let got = 0;
  sec.lines.forEach((line, i) => {
    const name = clipName(sec.code, i);
    const single = find(name);
    const out = path.join(OUT, name + '.mp3');
    try {
      if (single) encode(path.join(RAW, single), out);
      else if (segs) encode(path.join(RAW, whole), out, segs[i][0], segs[i][1]);
      else return;
      clips[`${sec.sex}|${line}`] = `voices/${name}.mp3`;
      got++; made++;
      // a clip far shorter or longer than its text suggests the lines are out of step
      const d = probeDur(out), expect = 0.35 + line.length * 0.06;
      if (d < expect * 0.35 || d > expect * 3) note += ` ${name} is ${d.toFixed(1)} s (expected ~${expect.toFixed(1)} s)?`;
    } catch (e) { note += ` ${name} failed: ${String(e.stderr || e.message).split('\n').filter(Boolean).pop()}`; }
  });
  if (whole || got) report.push(`${sec.code.padEnd(4)} ${String(got).padStart(2)}/${n}${note ? '  ⚠ ' + note.trim() : ''}`);
}
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ clips }, null, 1) + '\n');
const unknown = files.filter((f) => !VOICE_SECTIONS.some((s) => f.toUpperCase().startsWith(s.code.toUpperCase())));
console.log(report.join('\n') || 'No recordings matched a section code.');
if (unknown.length) console.log('Not used (name does not match a section code): ' + unknown.join(', '));
const total = VOICE_SECTIONS.reduce((a, s) => a + s.lines.length, 0);
console.log(`${made}/${total} lines → public/voices/`);
