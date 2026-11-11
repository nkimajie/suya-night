// Procedural Web Audio: ambience (generator, charcoal crackle, grill sizzle, street),
// an Afrobeats-style loop "from the shop next door", SFX and optional speech synthesis.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = true;
    this.musicOn = true;
    this.sizzleLevel = 0;
    this.crackleLevel = 0.3;
    this.powerOn = true;
  }

  // Must be called from a user gesture (button click / XR session start).
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);

    // white noise buffer reused by many sounds
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._ambience();
    this._music();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop; return s;
  }

  _ambience() {
    const ctx = this.ctx;
    // Generator hum: two detuned saws, low-passed.
    this.genGain = ctx.createGain(); this.genGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    for (const f of [49, 98.6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start();
    }
    lp.connect(this.genGain); this.genGain.connect(this.master);

    // Sizzle: band-passed noise, level driven by grill state.
    const sz = this._noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 3500;
    this.sizzleGain = ctx.createGain(); this.sizzleGain.gain.value = 0;
    sz.connect(bp); bp.connect(this.sizzleGain); this.sizzleGain.connect(this.master); sz.start();

    // Street bed: very low brown-ish noise.
    const st = this._noiseSrc(); const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 400;
    const sg = ctx.createGain(); sg.gain.value = 0.025; st.connect(lp2); lp2.connect(sg); sg.connect(this.master); st.start();

    // Charcoal crackle + occasional far-off okada horn, scheduled randomly.
    this._crackleTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const n = Math.random() < this.crackleLevel ? 1 + (Math.random() * 3) | 0 : 0;
      for (let i = 0; i < n; i++) this._click(ctx.currentTime + Math.random() * 0.1, 0.05 + Math.random() * 0.08 * this.crackleLevel);
      if (Math.random() < 0.004) this._horn();
    }, 90);
  }

  _click(t, vol) {
    const ctx = this.ctx;
    const s = this._noiseSrc(false); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 3000; f.Q.value = 2;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.05);
  }

  _horn() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 420 + Math.random() * 60;
    const g = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.02);
    g.gain.setValueAtTime(0.025, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 0.3);
    o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
  }

  // ---- Afrobeats-style loop, low-passed so it sounds like it's from next door ----
  _music() {
    const ctx = this.ctx;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.32;
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 1400;
    this.musicGain.connect(this.musicLP); this.musicLP.connect(this.master);
    const bpm = 104, step = 60 / bpm / 4; // 16th notes
    let next = ctx.currentTime + 0.2, idx = 0;
    // A minor-ish log-drum bassline and a two-chord pluck pattern.
    const bass = [45, 0, 0, 45, 0, 0, 48, 0, 0, 0, 50, 0, 48, 0, 45, 0, 43, 0, 0, 43, 0, 0, 45, 0, 0, 0, 48, 0, 45, 0, 0, 0];
    const pluck = [[69, 72, 76], [67, 71, 74]];
    const pluckSteps = [2, 5, 7, 10, 13, 15];
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') { next = this.ctx ? this.ctx.currentTime + 0.1 : 0; return; }
      while (next < ctx.currentTime + 0.15) {
        if (this.musicOn && this.powerOn) {
          const s = idx % 16, bar = (idx >> 4) % 2;
          if (s % 4 === 0) this._kick(next);
          if (s === 4 || s === 12) this._clap(next);
          if (s % 2 === 1 || s === 6) this._shaker(next, s % 4 === 3 ? 0.05 : 0.03);
          if (s === 3 || s === 11 || s === 14) this._rim(next);
          const b = bass[idx % 32]; if (b) this._logDrum(next, b);
          if (pluckSteps.includes(s)) for (const n of pluck[bar]) this._pluck(next, n);
        }
        next += step; idx++;
      }
    }, 25);
  }
  _mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  _env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  _kick(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this._env(g, t, 0.003, 0.9, 0.22); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.3);
  }
  _clap(t) {
    const s = this._noiseSrc(false), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.8;
    this._env(g, t, 0.002, 0.35, 0.12); s.connect(f); f.connect(g); g.connect(this.musicGain); s.start(t, Math.random()); s.stop(t + 0.2);
  }
  _shaker(t, v) {
    const s = this._noiseSrc(false), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 6000;
    this._env(g, t, 0.004, v * 4, 0.04); s.connect(f); f.connect(g); g.connect(this.musicGain); s.start(t, Math.random()); s.stop(t + 0.08);
  }
  _rim(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = 820;
    this._env(g, t, 0.001, 0.18, 0.05); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.08);
  }
  _logDrum(t, m) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine';
    const f = this._mtof(m); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    this._env(g, t, 0.005, 0.55, 0.32); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.4);
  }
  _pluck(t, m) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = this._mtof(m);
    this._env(g, t, 0.004, 0.07, 0.18); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.25);
  }

  // ---- Per-frame levels ----
  setGrill(sizzle, heat) {
    if (!this.ctx) return;
    this.sizzleLevel = sizzle;
    this.crackleLevel = 0.15 + heat * 0.6;
    this.sizzleGain.gain.setTargetAtTime(Math.min(0.12, sizzle * 0.045), this.ctx.currentTime, 0.15);
  }
  setPower(on) {
    this.powerOn = on;
    if (!this.ctx) return;
    this.genGain.gain.setTargetAtTime(on ? 0.05 : 0.0, this.ctx.currentTime, on ? 0.4 : 0.15);
  }

  // ---- SFX ----
  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.sfxBus;
    const tone = (f, dur, type = 'sine', vol = 0.2, at = 0, slide = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur);
      this._env(g, t + at, 0.005, vol, dur); o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + dur + 0.05);
    };
    const noise = (dur, freq, type = 'bandpass', vol = 0.3, at = 0, q = 1) => {
      const s = this._noiseSrc(false), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      this._env(g, t + at, 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(out); s.start(t + at, Math.random()); s.stop(t + at + dur + 0.05);
    };
    switch (name) {
      case 'grab': tone(520, 0.06, 'sine', 0.12, 0, 1.4); break;
      case 'drop': tone(300, 0.08, 'triangle', 0.12, 0, 0.7); break;
      case 'clank': tone(1200, 0.12, 'square', 0.04); noise(0.08, 2500, 'bandpass', 0.2); break;
      case 'sizzleHit': noise(0.5, 5000, 'highpass', 0.18); break;
      case 'flip': noise(0.25, 4500, 'highpass', 0.15); tone(700, 0.05, 'triangle', 0.06); break;
      case 'slide': noise(0.18, 1800, 'bandpass', 0.2, 0, 2); break;
      case 'shake': noise(0.07, 7000, 'highpass', 0.22); break;
      case 'side': noise(0.08, 900, 'lowpass', 0.25); break;
      case 'wrap': noise(0.35, 3000, 'bandpass', 0.22, 0, 0.5); noise(0.2, 2000, 'bandpass', 0.15, 0.18, 0.5); break;
      case 'serve': tone(660, 0.1, 'triangle', 0.12); tone(880, 0.15, 'triangle', 0.12, 0.08); break;
      case 'cash': tone(1318, 0.08, 'square', 0.06); tone(1760, 0.25, 'square', 0.06, 0.07); noise(0.1, 6000, 'highpass', 0.1); break;
      case 'happy': tone(523, 0.1, 'sine', 0.15); tone(659, 0.1, 'sine', 0.15, 0.1); tone(784, 0.2, 'sine', 0.15, 0.2); break;
      case 'angry': tone(220, 0.25, 'sawtooth', 0.08, 0, 0.7); tone(180, 0.3, 'sawtooth', 0.06, 0.15, 0.7); break;
      case 'bell': tone(988, 0.4, 'sine', 0.12); tone(1480, 0.5, 'sine', 0.05); break;
      case 'click': tone(900, 0.04, 'square', 0.06); break;
      case 'tick': tone(1500, 0.025, 'sine', 0.025); break; // hand is now over something grabbable
      case 'combo': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.05, i * 0.05)); break;
      case 'warn': tone(1046, 0.08, 'square', 0.07); tone(1046, 0.08, 'square', 0.07, 0.14); break;
      case 'whoosh': noise(0.3, 600, 'bandpass', 0.2, 0, 0.6); break;
      case 'powerOff': tone(110, 0.6, 'sawtooth', 0.12, 0, 0.3); noise(0.2, 300, 'lowpass', 0.4); break;
      case 'powerOn': tone(60, 0.5, 'sawtooth', 0.1, 0, 2); tone(880, 0.1, 'sine', 0.08, 0.4); break;
      case 'buy': tone(1568, 0.06, 'square', 0.06); tone(2093, 0.3, 'square', 0.06, 0.06); noise(0.15, 5000, 'highpass', 0.12, 0.02); tone(523, 0.15, 'triangle', 0.1, 0.1); break;
      case 'star': tone(1318, 0.18, 'triangle', 0.12); tone(1976, 0.3, 'sine', 0.06, 0.05); break;
      case 'gen': noise(0.25, 200, 'lowpass', 0.5); noise(0.25, 200, 'lowpass', 0.5, 0.3); tone(55, 1.0, 'sawtooth', 0.08, 0.6, 1.4); break;
      case 'loyal': [659, 880, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, i * 0.08)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.12)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.16)); break;
    }
  }

  // Short murmur so customers "speak" even with speech synthesis off.
  murmur(pitch = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = (140 + Math.random() * 60) * pitch;
      f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 900; f.Q.value = 3;
      this._env(g, t + i * 0.11, 0.02, 0.1, 0.08); o.connect(f); f.connect(g); g.connect(this.sfxBus);
      o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.15);
    }
  }

  say(text, { pitch = 1, rate = 1 } = {}) {
    if (!this.voice || !('speechSynthesis' in window)) { this.murmur(pitch); return; }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_]/g, ''));
      const voices = synth.getVoices();
      if (!voices.length) this.murmur(pitch); // some headsets ship no voices: never leave a customer silent
      const v = voices.find((x) => /en[-_]NG/i.test(x.lang)) || voices.find((x) => /en[-_]GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.pitch = pitch; u.rate = rate; u.volume = 0.9;
      synth.speak(u);
    } catch { this.murmur(pitch); }
  }
  stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
}

export const audio = new AudioEngine();
