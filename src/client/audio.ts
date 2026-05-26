// JSgame · SFX procedurais via Web Audio API.
// Síntese pura — sem samples baixados, sem dependência externa, zero bytes extra.
// Cada SFX é uma curva curta de oscilador + envelope. Soa "8-bit chic" não realista,
// mas combina com tema D&D estilo retrô. Total: < 5KB de código.
//
// AudioContext exige gesture (mobile policy). Init lazy no primeiro `play*` —
// se gesture ainda não veio, silenciosamente skip e tenta de novo na próxima.

const STORAGE_KEY = 'jsgame.sfx.enabled';
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; }
  catch { return true; }
})();

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    // AudioContext webkit prefix pra Safari antigo
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor() as AudioContext;
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;  // headroom — sounds doidos não estouram
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

// Resume context em primeiro click (mobile autoplay policy).
// Caller chama setupAudioGesture() uma vez na init do app.
let gestureBound = false;
export function setupAudioGesture(): void {
  if (gestureBound) return;
  gestureBound = true;
  const resume = (): void => {
    const c = ensureCtx();
    if (c && c.state === 'suspended') {
      void c.resume();
    }
  };
  document.addEventListener('click', resume, { once: false, passive: true });
  document.addEventListener('keydown', resume, { once: false, passive: true });
  document.addEventListener('touchstart', resume, { once: false, passive: true });
}

export function isSfxEnabled(): boolean { return enabled; }
export function setSfxEnabled(v: boolean): void {
  enabled = v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); }
  catch { /* private mode → ignore */ }
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — todos chamam ensureCtx() e early-return se SFX off.
// ════════════════════════════════════════════════════════════════════════════

function tone(opts: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  freqEnd?: number;
  gain?: number;
  delay?: number;
}): void {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.duration);
  }
  const env = c.createGain();
  const peak = opts.gain ?? 0.4;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + (opts.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.001, now + opts.duration);
  osc.connect(env);
  env.connect(masterGain);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

function noise(opts: {
  duration: number;
  attack?: number;
  gain?: number;
  bandpass?: { freq: number; q: number };
  delay?: number;
}): void {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const bufferSize = Math.floor(c.sampleRate * opts.duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  let node: AudioNode = src;
  if (opts.bandpass) {
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.bandpass.freq;
    filter.Q.value = opts.bandpass.q;
    src.connect(filter);
    node = filter;
  }
  const env = c.createGain();
  const peak = opts.gain ?? 0.3;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + (opts.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.001, now + opts.duration);
  node.connect(env);
  env.connect(masterGain);
  src.start(now);
  src.stop(now + opts.duration + 0.05);
}

// ════════════════════════════════════════════════════════════════════════════
// SFX públicos — chame em eventos do jogo.
// ════════════════════════════════════════════════════════════════════════════

/** d20 rolando: noise burst rápido tipo tilintar de dado. */
export function playD20(): void {
  noise({ duration: 0.18, attack: 0.005, gain: 0.35, bandpass: { freq: 1800, q: 4 } });
  // Pequeno "clack" final como impacto
  tone({ freq: 900, freqEnd: 400, duration: 0.08, type: 'square', gain: 0.25, delay: 0.15 });
}

/** Hit de combate — golpe baixo, slap curto. */
export function playHit(): void {
  tone({ freq: 180, freqEnd: 60, duration: 0.15, type: 'sawtooth', gain: 0.5 });
  noise({ duration: 0.08, gain: 0.25, bandpass: { freq: 600, q: 2 } });
}

/** Crit — triple thump + chime ascendente. */
export function playCrit(): void {
  playHit();
  tone({ freq: 880, duration: 0.12, type: 'triangle', gain: 0.35, delay: 0.08 });
  tone({ freq: 1320, duration: 0.18, type: 'triangle', gain: 0.35, delay: 0.16 });
  tone({ freq: 1760, duration: 0.25, type: 'triangle', gain: 0.4, delay: 0.24 });
}

/** Miss — whoosh leve, sem impacto. */
export function playMiss(): void {
  noise({ duration: 0.18, gain: 0.18, bandpass: { freq: 3200, q: 1.5 } });
}

/** Level up — arpeggio ascendente maior (C-E-G-C). */
export function playLevelUp(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    tone({ freq, duration: 0.25, type: 'triangle', gain: 0.35, delay: i * 0.08 });
  });
}

/** NPC speaks — chime suave de atenção. */
export function playNpcSpeaks(): void {
  tone({ freq: 660, duration: 0.18, type: 'triangle', gain: 0.25 });
  tone({ freq: 880, duration: 0.18, type: 'triangle', gain: 0.2, delay: 0.06 });
}

/** Damage taken (player) — bass thud + leve distorção. */
export function playDamage(): void {
  tone({ freq: 120, freqEnd: 50, duration: 0.3, type: 'sawtooth', gain: 0.55 });
}

/** Death save success — chime relief. */
export function playDeathSaveSuccess(): void {
  tone({ freq: 440, duration: 0.15, type: 'sine', gain: 0.3 });
  tone({ freq: 660, duration: 0.25, type: 'sine', gain: 0.3, delay: 0.1 });
}

/** Death save fail — descending dread. */
export function playDeathSaveFail(): void {
  tone({ freq: 220, freqEnd: 110, duration: 0.4, type: 'sawtooth', gain: 0.4 });
}

/** Spell cast — shimmer crescente. */
export function playSpellCast(): void {
  tone({ freq: 600, freqEnd: 1200, duration: 0.35, type: 'sine', gain: 0.3 });
  tone({ freq: 800, freqEnd: 1600, duration: 0.35, type: 'triangle', gain: 0.2, delay: 0.05 });
}

// ════════════════════════════════════════════════════════════════════════════
// F21 — Combo crit (dois crits seguidos < 5s) — chime ascendente épico.
// Combat-screen rastreia + chama. Estado mantido aqui pra fácil reuso global.
// ════════════════════════════════════════════════════════════════════════════

let lastCritAt = 0;
const COMBO_WINDOW_MS = 5000;

/** Hook do crit normal — chama playCrit() OU se houve crit recente, dispara combo. */
export function notifyCrit(): { wasCombo: boolean } {
  const now = Date.now();
  const wasCombo = (now - lastCritAt) < COMBO_WINDOW_MS;
  lastCritAt = now;
  if (wasCombo) {
    playComboCrit();
    return { wasCombo: true };
  }
  playCrit();
  return { wasCombo: false };
}

export function playComboCrit(): void {
  // Triplo arpeggio ascendente + sustained bell
  const notes = [523, 659, 784, 1047, 1318];
  notes.forEach((f, i) => {
    tone({ freq: f, duration: 0.32, type: 'triangle', gain: 0.4, delay: i * 0.06 });
  });
  // Bell sustentado por baixo
  tone({ freq: 261, duration: 1.2, type: 'sine', gain: 0.25 });
}

// ════════════════════════════════════════════════════════════════════════════
// F21 — Ambient music procedural. Pad sustained em loop, varia por mood.
// "exploration" = pad grave longo + flauta esparsa.
// "combat" = bass pulsante + dissonância sub.
// "silence" = stop.
// Mobile-friendly: pad é apenas 2 osciladores sustentados, gain baixo (0.05).
// ════════════════════════════════════════════════════════════════════════════

type AmbientMood = 'exploration' | 'combat' | 'silence';
let ambientNodes: Array<OscillatorNode | GainNode | AudioBufferSourceNode> = [];
let currentMood: AmbientMood = 'silence';

const STORAGE_KEY_AMBIENT = 'jsgame.ambient.enabled';
let ambientEnabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY_AMBIENT) === '1'; } // default OFF (intrusivo)
  catch { return false; }
})();

export function isAmbientEnabled(): boolean { return ambientEnabled; }
export function setAmbientEnabled(v: boolean): void {
  ambientEnabled = v;
  try { localStorage.setItem(STORAGE_KEY_AMBIENT, v ? '1' : '0'); }
  catch { /* private mode */ }
  if (!v) setAmbient('silence');
}

export function setAmbient(mood: AmbientMood): void {
  if (currentMood === mood) return;
  stopAmbient();
  currentMood = mood;
  if (!ambientEnabled) return;
  if (mood === 'silence') return;
  const c = ensureCtx();
  if (!c || !masterGain) return;

  const ambGain = c.createGain();
  ambGain.gain.value = 0.0;
  ambGain.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.5); // fade-in 1.5s
  ambGain.connect(masterGain);
  ambientNodes.push(ambGain);

  if (mood === 'exploration') {
    // Pad em Am (A=110, C=130.81, E=164.81)
    const notes = [110, 130.81, 164.81];
    for (const f of notes) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      // LFO leve pra dar movimento (vibrato 4Hz, ±0.5Hz)
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15 + Math.random() * 0.2;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(ambGain);
      osc.start();
      lfo.start();
      ambientNodes.push(osc, lfo, lfoGain);
    }
  } else if (mood === 'combat') {
    // Bass pulsante + dissonância (D + Eb = tritone-ish tensão)
    const notes = [73.42, 87.31]; // D2, E2b — bem dissonante = tensão
    for (const f of notes) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      // Filtro lowpass pra suavizar serra
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 300;
      filt.Q.value = 2;
      osc.connect(filt).connect(ambGain);
      osc.start();
      ambientNodes.push(osc, filt);
    }
  }
}

function stopAmbient(): void {
  const c = ctx;
  if (!c) {
    ambientNodes = [];
    return;
  }
  // Fade-out via primeiro GainNode (se houver)
  const gain = ambientNodes.find((n) => n instanceof GainNode) as GainNode | undefined;
  if (gain) {
    gain.gain.cancelScheduledValues(c.currentTime);
    gain.gain.linearRampToValueAtTime(0.0, c.currentTime + 0.5);
  }
  // Stop osciladores depois do fade
  setTimeout(() => {
    for (const n of ambientNodes) {
      try {
        if ('stop' in n && typeof n.stop === 'function') n.stop();
      } catch { /* já stopado */ }
    }
    ambientNodes = [];
  }, 600);
}
