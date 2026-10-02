import { Mix } from './soundscape';

// ─── Sound ─────────────────────────────────────────────────────────────
// Everything is synthesised with Web Audio unless a recording exists: drop a
// file named after a sound into src/row/sounds/ (e.g. `horn.m4a`, `day.mp3`,
// `yell_1.m4a`) and it's used instead — no code changes. Voices without a
// recording use the phone's built-in speech.
//
// Browsers (iOS especially) only allow sound after a tap, so `start()` is
// called on the first touch / key.

/** Recordings that exist at build time: sounds/<name>.<ext> → url. */
const FILES = import.meta.glob('./sounds/*.{mp3,m4a,wav,ogg,aac}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const fileFor = (name: string) => Object.entries(FILES).find(([p]) => p.replace(/^.*\//, '').replace(/\.[^.]+$/, '') === name)?.[1];
const filesLike = (prefix: string) => Object.entries(FILES).filter(([p]) => p.replace(/^.*\//, '').startsWith(prefix)).map(([, u]) => u);

/** Overall loudness (before the limiter): phone speakers need it. */
const LOUD = 2.2;

type Bed = 'birds' | 'crickets' | 'wind' | 'road' | 'crowd' | 'room' | 'engine' | 'tyres' | 'skid';
/** Which recording (if any) replaces each always-on bed. */
const BED_FILE: Partial<Record<Bed, string>> = { birds: 'day', crickets: 'night', road: 'traffic', crowd: 'crowd', room: 'room' };

export type Shot = 'horn' | 'carDoor' | 'houseDoor' | 'glassDoor' | 'thud' | 'jump' | 'land';
const SHOT_FILE: Record<Shot, string> = {
  horn: 'horn', carDoor: 'car_door', houseDoor: 'house_door', glassDoor: 'glass_door', thud: 'thud', jump: 'jump', land: 'land',
};

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private beds = new Map<Bed, GainNode>();
  private engine?: { a: OscillatorNode; b: OscillatorNode; f: BiquadFilterNode };
  private tyreFilter?: BiquadFilterNode;
  private buffers = new Map<string, AudioBuffer>();
  private noise!: AudioBuffer;
  private chirpAt = 0;
  private cricketAt = 0;
  private mix: Mix | null = null;
  muted = false;
  /** for tests / debugging: what's been played */
  readonly log: string[] = [];

  constructor() {
    try { this.muted = localStorage.getItem('vora.row.muted') === '1'; } catch { /* ignore */ }
  }

  get started() { return this.ctx !== null && this.ctx.state === 'running'; }

  /**
   * Call from a user gesture (every tap is fine — it's cheap). iPhones are picky:
   *  - sound only unlocks on the *end* of a tap (touchend / click), not touch-down;
   *  - with the ring/silent switch on silent, web audio is muted unless the page says it's media
   *    (`navigator.audioSession.type = 'playback'`, Safari 16.4+), and on older iOS unless an
   *    <audio> element is playing — so we also loop a silent one.
   */
  start() {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) { try { session.type = 'playback'; } catch { /* ignore */ } }
    this.keepAwake();
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume();
      this.blip();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    if (ctx.state !== 'running') void ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : LOUD;
    // a limiter at the end, so it can be loud on a phone speaker without crackling
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -14; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.2;
    this.master.connect(lim).connect(ctx.destination);
    // two seconds of white noise to filter into wind, road, tyres, crowd
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.blip();
    this.buildBeds();
    for (const url of Object.values(FILES)) void this.load(url);
    if (this.mix) this.setMix(this.mix, 0);
  }

  /** Play one silent sample through the context: the classic iOS unlock. */
  private blip() {
    const ctx = this.ctx;
    if (!ctx) return;
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }

  private silent: HTMLAudioElement | null = null;
  /** A looping, silent <audio> element: on older iOS this is what lets sound through the silent switch. */
  private keepAwake() {
    if (!this.silent) {
      // 0.1 s of 8-bit mono silence as a WAV
      const n = 800, bytes = new Uint8Array(44 + n), v = new DataView(bytes.buffer);
      const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
      v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
      bytes.fill(128, 44);
      const a = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
      a.loop = true;
      a.setAttribute('playsinline', '');
      this.silent = a;
    }
    if (this.silent.paused) void this.silent.play().catch(() => { /* not allowed yet: next tap */ });
  }

  /** What the browser thinks (for the debug hook). */
  get state() { return this.ctx?.state ?? 'none'; }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('vora.row.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : LOUD, this.ctx.currentTime, 0.05);
    if (m) speechSynthesis?.cancel();
  }

  /** Pause while the page is hidden. */
  suspend(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend(); else void this.ctx.resume();
  }

  private async load(url: string) {
    try {
      const res = await fetch(url);
      this.buffers.set(url, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
      // a recording for a bed: start it looping now
      for (const [bed, name] of Object.entries(BED_FILE) as [Bed, string][]) if (fileFor(name) === url) this.loopFile(bed, url);
    } catch { /* a bad file: stay synthesised */ }
  }

  private noiseSource(rate = 1) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start();
    return s;
  }

  private bedGain(bed: Bed) {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    this.beds.set(bed, g);
    return g;
  }

  /** The synthesised beds: each is filtered noise or oscillators into its own gain (the mix sets the gains). */
  private buildBeds() {
    const ctx = this.ctx!;
    const filt = (type: BiquadFilterType, f: number, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    // wind: low band of noise, slowly swelling
    const wind = filt('bandpass', 380, 0.6), wg = this.bedGain('wind'), swell = ctx.createGain();
    this.noiseSource(0.6).connect(wind).connect(swell).connect(wg);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const depth = ctx.createGain(); depth.gain.value = 0.45; swell.gain.value = 0.6;
    lfo.connect(depth).connect(swell.gain); lfo.start();
    // road: the low rumble of High Street
    const road = filt('lowpass', 260), road2 = filt('lowpass', 520);
    this.noiseSource(0.5).connect(road).connect(road2).connect(this.bedGain('road'));
    // crowd: mid-band noise with a fast, uneven flutter, like many voices
    const crowd = filt('bandpass', 750, 1.2), flutter = ctx.createGain(), cg = this.bedGain('crowd');
    this.noiseSource(1).connect(crowd).connect(flutter).connect(cg);
    for (const f of [3.1, 5.3, 7.9]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const a = ctx.createGain(); a.gain.value = 0.18;
      o.connect(a).connect(flutter.gain); o.start();
    }
    flutter.gain.value = 0.5;
    // room tone: a soft hum (air handling) for indoors
    const room = filt('lowpass', 180);
    this.noiseSource(0.4).connect(room).connect(this.bedGain('room'));
    // your engine: two detuned saws, low-passed
    const a = ctx.createOscillator(), b = ctx.createOscillator(), ef = filt('lowpass', 420, 2);
    a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = 40; b.frequency.value = 40.7;
    const eg = this.bedGain('engine');
    a.connect(ef); b.connect(ef); ef.connect(eg); a.start(); b.start();
    this.engine = { a, b, f: ef };
    // tyres on the ground, and the squeal of a skid
    this.tyreFilter = filt('bandpass', 500, 0.8);
    this.noiseSource(1).connect(this.tyreFilter).connect(this.bedGain('tyres'));
    const sq = filt('bandpass', 1900, 9);
    this.noiseSource(1).connect(sq).connect(this.bedGain('skid'));
    // birds + crickets are scheduled chirps (see tick); they just need their gains
    this.bedGain('birds');
    this.bedGain('crickets');
  }

  private loopFile(bed: Bed, url: string) {
    const buf = this.buffers.get(url);
    if (!buf || !this.ctx) return;
    // replace the synthesised bed's gain with a fresh one fed by the recording
    const old = this.beds.get(bed);
    const g = this.ctx.createGain();
    g.gain.value = old?.gain.value ?? 0;
    old?.disconnect();
    g.connect(this.master);
    this.beds.set(bed, g);
    this.synthOff.add(bed);
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.connect(g); s.start(0, Math.random() * buf.duration);
  }
  private synthOff = new Set<Bed>();

  /** Fade the always-on beds toward a mix. */
  setMix(m: Mix, dt = 0.1) {
    this.mix = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, tc = Math.max(0.05, dt * 3);
    for (const bed of ['birds', 'crickets', 'wind', 'road', 'crowd', 'room', 'engine', 'tyres', 'skid'] as Bed[]) {
      this.beds.get(bed)?.gain.setTargetAtTime(m[bed], t, tc);
    }
    if (this.engine) {
      this.engine.a.frequency.setTargetAtTime(m.rpm, t, 0.08);
      this.engine.b.frequency.setTargetAtTime(m.rpm * 1.012, t, 0.08);
      this.engine.f.frequency.setTargetAtTime(260 + m.rpm * 3, t, 0.1);
    }
    this.tyreFilter?.frequency.setTargetAtTime(m.tyreTone, t, 0.2);
  }

  /** Birdsong and cricket chirps, scheduled a little ahead (unless recordings are playing). */
  tick() {
    if (!this.ctx || !this.mix) return;
    const now = this.ctx.currentTime;
    if (!this.synthOff.has('birds') && this.mix.birds > 0.02 && now > this.chirpAt) {
      this.chirp(now + 0.05);
      this.chirpAt = now + 0.25 + Math.random() * (Math.random() < 0.3 ? 2.2 : 0.7);
    }
    if (!this.synthOff.has('crickets') && this.mix.crickets > 0.02 && now > this.cricketAt) {
      this.cricket(now + 0.05);
      this.cricketAt = now + 0.45 + Math.random() * 0.6;
    }
  }

  private chirp(t: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    const f0 = 2600 + Math.random() * 2200, n = 1 + Math.floor(Math.random() * 4);
    o.type = 'sine';
    g.gain.value = 0;
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.11;
      o.frequency.setValueAtTime(f0 * (1 + Math.random() * 0.15), s);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.5), s + 0.07);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.25, s + 0.01);
      g.gain.linearRampToValueAtTime(0, s + 0.08);
    }
    o.connect(g).connect(this.beds.get('birds')!);
    o.start(t); o.stop(t + n * 0.11 + 0.1);
  }

  private cricket(t: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 4300 + Math.random() * 400;
    g.gain.value = 0;
    for (let i = 0; i < 4; i++) {
      const s = t + i * 0.045;
      g.gain.setValueAtTime(0.0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.006);
      g.gain.linearRampToValueAtTime(0, s + 0.03);
    }
    o.connect(g).connect(this.beds.get('crickets')!);
    o.start(t); o.stop(t + 0.25);
  }

  /** A one-off sound, `vol` 0..1, panned −1 (left) … +1 (right). */
  play(shot: Shot, vol = 1, pan = 0) {
    this.log.push(shot);
    if (!this.ctx || vol <= 0.01) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = vol;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p).connect(this.master); } else out.connect(this.master);
    const url = fileFor(SHOT_FILE[shot]), buf = url && this.buffers.get(url);
    if (buf) {
      const s = ctx.createBufferSource(); s.buffer = buf;
      s.playbackRate.value = 0.95 + Math.random() * 0.1;
      s.connect(out); s.start(t);
      return;
    }
    const env = (g: GainNode, a: number, peak: number, d: number, at = t) => {
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.001, at + a + d);
    };
    const osc = (type: OscillatorType, f: number, at = t, len = 0.5) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.start(at); o.stop(at + len); return o;
    };
    const noiseBurst = (f: number, q: number, peak: number, d: number, at = t) => {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      const g = ctx.createGain(); env(g, 0.003, peak, d, at);
      s.connect(b).connect(g).connect(out); s.start(at, Math.random()); s.stop(at + d + 0.05);
    };
    switch (shot) {
      case 'horn': { // two flat tones a third apart, sometimes twice
        const twice = Math.random() < 0.4;
        for (const at of twice ? [t, t + 0.32] : [t]) {
          const len = twice ? 0.22 : 0.42 + Math.random() * 0.25;
          const g = ctx.createGain(); env(g, 0.01, 0.22, len, at);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
          for (const f of [415, 523]) osc('square', f + Math.random() * 6, at, len + 0.1).connect(lp);
          lp.connect(g).connect(out);
        }
        break;
      }
      case 'carDoor': case 'houseDoor': case 'glassDoor': { // the latch click + the body's thunk (+ glass ring)
        noiseBurst(shot === 'glassDoor' ? 3200 : 1800, 1.5, 0.5, 0.05);
        const g = ctx.createGain(); env(g, 0.004, shot === 'houseDoor' ? 0.9 : 0.7, shot === 'carDoor' ? 0.18 : 0.3, t + 0.03);
        const o = osc('sine', shot === 'carDoor' ? 95 : 70, t + 0.03, 0.4);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
        o.connect(g).connect(out);
        if (shot === 'glassDoor') { const r = ctx.createGain(); env(r, 0.005, 0.08, 0.5, t + 0.04); osc('sine', 2400, t + 0.04, 0.6).connect(r).connect(out); }
        break;
      }
      case 'thud': { // a body against a car: low boom + a slap
        const g = ctx.createGain(); env(g, 0.003, 1, 0.35);
        const o = osc('sine', 120, t, 0.45); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
        o.connect(g).connect(out);
        noiseBurst(900, 0.8, 0.7, 0.12);
        break;
      }
      case 'jump': noiseBurst(600, 1, 0.12, 0.08); break; // a scuff off the ground
      case 'land': noiseBurst(300, 0.9, 0.25, 0.1); break;
    }
  }

  /**
   * Someone says something out loud. A recording `yell_*` (for hit/jack lines) or `hey_*` (greetings)
   * if there are any; otherwise the phone's own speech, with a random-ish voice.
   */
  say(text: string, kind: 'yell' | 'greet', vol = 1) {
    this.log.push(`say:${text}`);
    if (this.muted || vol <= 0.05) return;
    const files = filesLike(kind === 'yell' ? 'yell_' : 'hey_');
    if (files.length && this.ctx) {
      const buf = this.buffers.get(files[Math.floor(Math.random() * files.length)]);
      if (buf) {
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = buf; g.gain.value = vol; s.connect(g).connect(this.master); s.start();
        return;
      }
    }
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    if (voices.length) u.voice = voices[Math.floor(Math.random() * voices.length)];
    u.rate = kind === 'yell' ? 1.15 + Math.random() * 0.2 : 1.0;
    u.pitch = 0.8 + Math.random() * 0.6;
    u.volume = Math.min(1, vol);
    speechSynthesis.cancel(); // don't queue up a backlog of yelling
    speechSynthesis.speak(u);
  }
}
