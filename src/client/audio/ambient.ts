// Trilha Medieval Procedural — Web Audio API + Sequencer + Modos eclesiásticos.
// API: setAmbient(mood) troca trilha com crossfade. setAmbientEnabled(false) silencia tudo.
//
// Moods medievais:
//   silence              — sem música
//   exploration-calm     — Dorian em A3, pad + flauta esparsa (default exploration)
//   exploration-tension  — Aeolian em D3, drone grave + ostinato lento
//   combat-skirmish      — Mixolydian em E3, frame drum 6/8 + bass pulsante (default combat)
//   combat-boss          — Phrygian em D3, drum mais intenso + drone agudo dissonante + pluck
//   victory              — Lydian em G3, plucked fanfare ascendente (one-shot, volta a calm)
//   danger-low-hp        — Phrygian em A2, heartbeat low + bell distante
//   mystery              — Lydian em E4, bells aleatórias + pad etéreo
//   rest                 — Major em C4, harpa arpejo + pad warm
//   shop                 — Dorian em D4, alaúde walking arpeggio jovial
//
// Aliases legacy: 'exploration' → 'exploration-calm', 'combat' → 'combat-skirmish'.

import { _getAudioCtx, _getMasterGain, isSfxEnabled } from '../audio';
import {
  pluck, flute, drumKick, drumTom, drumHat, bell, heartbeat, padDrone,
  type InstrumentCtx,
} from './instruments';
import { Sequencer } from './sequencer';
import { getScale, midiToHz, ROOTS, degree, type Mode } from './modes';

export type AmbientMood =
  | 'silence'
  | 'exploration' | 'exploration-calm' | 'exploration-tension'
  | 'combat' | 'combat-skirmish' | 'combat-boss'
  | 'victory'
  | 'danger-low-hp'
  | 'mystery'
  | 'rest'
  | 'shop';

const STORAGE_KEY_AMBIENT = 'jsgame.ambient.enabled';
// Sprint X.A2 — default ON (era OFF/intrusivo). Consultores D&D + Mobile
// convergiram em "som diegético = gap #1" pós Sprint W. Ambient procedural
// já é baixo volume (gain via masterGain 0.35) e respeita scene mood
// (exploration-calm / combat-skirmish / rest etc). Player que não gostar
// muta em UX Settings → "🎵 Ambient" toggle. SFX dice + page-turn permanecem
// independentes (jsgame.sfx.enabled — default ON desde sempre).
let ambientEnabled = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY_AMBIENT);
    if (v === null) return true;  // primeira vez = ON
    return v !== '0';              // explicit '0' = OFF
  }
  catch { return true; }
})();

export function isAmbientEnabled(): boolean { return ambientEnabled; }
export function setAmbientEnabled(v: boolean): void {
  ambientEnabled = v;
  try { localStorage.setItem(STORAGE_KEY_AMBIENT, v ? '1' : '0'); }
  catch { /* private mode */ }
  if (!v) setAmbient('silence');
}

// ── Estado interno ─────────────────────────────────────────────────────────
interface ActiveMood {
  mood: AmbientMood;
  pads: Array<{ stop: (release: number) => void; gainNode: GainNode }>;
  sequencers: Sequencer[];
  oneShotTimeouts: Array<ReturnType<typeof setTimeout>>;
  /** Master gain pra fade-out coordenado. */
  bus: GainNode;
}

let activeMood: ActiveMood | null = null;
let currentMoodName: AmbientMood = 'silence';

/** Normaliza alias legacy → canonical. */
function canonical(mood: AmbientMood): AmbientMood {
  if (mood === 'exploration') return 'exploration-calm';
  if (mood === 'combat') return 'combat-skirmish';
  return mood;
}

export function setAmbient(mood: AmbientMood): void {
  const target = canonical(mood);
  if (currentMoodName === target) return;
  // Fade-out atual + start novo
  stopActive(0.6);
  currentMoodName = target;
  if (!ambientEnabled || target === 'silence') return;

  const ctx = _getAudioCtx();
  const master = _getMasterGain();
  if (!ctx || !master) return;

  // Bus de mood novo — entra fade-in suave
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.2); // master mood gain
  bus.connect(master);

  const ic: InstrumentCtx = { ctx, dest: bus };
  activeMood = {
    mood: target,
    pads: [],
    sequencers: [],
    oneShotTimeouts: [],
    bus,
  };

  switch (target) {
    case 'exploration-calm':       buildExplorationCalm(ic); break;
    case 'exploration-tension':    buildExplorationTension(ic); break;
    case 'combat-skirmish':        buildCombatSkirmish(ic); break;
    case 'combat-boss':            buildCombatBoss(ic); break;
    case 'victory':                buildVictory(ic); break;
    case 'danger-low-hp':          buildDangerLowHp(ic); break;
    case 'mystery':                buildMystery(ic); break;
    case 'rest':                   buildRest(ic); break;
    case 'shop':                   buildShop(ic); break;
  }
}

function stopActive(releaseSec: number): void {
  if (!activeMood) return;
  // Fade-out do bus
  const ctx = _getAudioCtx();
  if (ctx) {
    activeMood.bus.gain.cancelScheduledValues(ctx.currentTime);
    activeMood.bus.gain.setValueAtTime(activeMood.bus.gain.value, ctx.currentTime);
    activeMood.bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + releaseSec);
  }
  // Stop pads
  for (const p of activeMood.pads) p.stop(releaseSec);
  // Stop sequencers
  for (const s of activeMood.sequencers) s.stop();
  // Cancel one-shots
  for (const t of activeMood.oneShotTimeouts) clearTimeout(t);
  // Limpar referência depois do fade
  const captured = activeMood;
  setTimeout(() => {
    try { captured.bus.disconnect(); } catch { /* */ }
  }, releaseSec * 1000 + 100);
  activeMood = null;
}

// ════════════════════════════════════════════════════════════════════════════
// Mood builders — cada um monta pads + sequencers + one-shots
// ════════════════════════════════════════════════════════════════════════════

/** Dorian em A3 — pad warm + flauta esparsa a cada ~6s. */
function buildExplorationCalm(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.A3, 'dorian');
  // Pad: fundamental + 5ª + oitava
  const pad = padDrone(ic, [midiToHz(ROOTS.A2), scale[0]!, scale[4]!], 'sine');
  registerPad(pad);

  // Sequencer pra flauta esparsa: BPM 70, 8 steps de 1/2 tempo (semicolcheia bem lenta).
  // Toca uma nota da escala em steps específicos do pattern.
  const flutePattern = [0, -1, -1, 2, -1, -1, 4, -1]; // -1 = silêncio, números = grau-1 da escala
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 70, patternLength: 8, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      const noteIdx = flutePattern[step % flutePattern.length]!;
      if (noteIdx >= 0) flute(ic, scale[noteIdx]!, time, 1.6, 0.10);
    },
  });
  seq.start();
  registerSeq(seq);
}

/** Aeolian em D3 — drone grave + ostinato bass lento (sensação de "algo pode acontecer"). */
function buildExplorationTension(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.D3, 'aeolian');
  // Drone grave
  const pad = padDrone(ic, [midiToHz(ROOTS.A2), scale[0]!], 'sine', 600);
  registerPad(pad);

  // Ostinato pluck na fundamental + 5ª, BPM 60
  const pattern = [0, -1, -1, 4, -1, 0, -1, -1, -1, 4, -1, -1]; // 12 steps = 4 compassos 3/4
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 60, patternLength: 12, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      const idx = pattern[step % pattern.length]!;
      if (idx >= 0) pluck(ic, scale[idx]! / 2, time, 1.0, 0.13);
    },
  });
  seq.start();
  registerSeq(seq);
}

/** Mixolydian em E3 — frame drum 6/8 + bass pulsante. Heroico mas urgente. */
function buildCombatSkirmish(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.E3, 'mixolydian');
  // Bass drone leve + 5ª pra dar peso
  const pad = padDrone(ic, [midiToHz(ROOTS.A2), scale[0]!], 'sawtooth', 250);
  registerPad(pad);

  // Frame drum 6/8: kick-h-h-tom-h-h (compasso ternário medieval)
  const drumSeq = new Sequencer({
    ctx: ic.ctx, bpm: 110, patternLength: 6, stepsPerBeat: 3,
    onStep: ({ step, time }) => {
      const s = step % 6;
      if (s === 0) drumKick(ic, time, 0.40);
      else if (s === 3) drumTom(ic, time, 180, 0.30);
      else drumHat(ic, time, 0.08);
    },
  });
  drumSeq.start();
  registerSeq(drumSeq);
}

/** Phrygian em D3 — drum intenso + drone agudo dissonante + pluck threatening. */
function buildCombatBoss(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.D3, 'phrygian');
  // Dois drones: bass + dissonância aguda (b2 do phrygian é o que dá o "exótico ameaçador")
  const pad1 = padDrone(ic, [midiToHz(ROOTS.A2), scale[0]!], 'sawtooth', 350);
  const pad2 = padDrone(ic, [scale[1]! * 2], 'sine'); // 2ª menor uma oitava acima — dissonância icônica
  registerPad(pad1); registerPad(pad2);

  // Drum mais agressivo, BPM mais alto
  const drumSeq = new Sequencer({
    ctx: ic.ctx, bpm: 130, patternLength: 8, stepsPerBeat: 4,
    onStep: ({ step, time }) => {
      const s = step % 8;
      if (s === 0 || s === 4) drumKick(ic, time, 0.50);
      if (s === 2 || s === 6) drumTom(ic, time, 160, 0.35);
      drumHat(ic, time, 0.10);
    },
  });
  drumSeq.start();
  registerSeq(drumSeq);

  // Pluck threatening: toca grau 1, b2, 5 num pattern de 16 steps
  const pluckPattern = [0, -1, -1, -1, -1, 4, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1];
  const pluckSeq = new Sequencer({
    ctx: ic.ctx, bpm: 130, patternLength: 16, stepsPerBeat: 4,
    onStep: ({ step, time }) => {
      const idx = pluckPattern[step % pluckPattern.length]!;
      if (idx >= 0) pluck(ic, scale[idx]!, time, 0.7, 0.16);
    },
  });
  pluckSeq.start();
  registerSeq(pluckSeq);
}

/** Lydian em G3 — fanfare ascendente plucked. One-shot 4s, volta a calm. */
function buildVictory(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.G3, 'lydian');
  // Plucked fanfare ascendente: arpejo 1-3-5-8 + bell sustentada
  const t0 = ic.ctx.currentTime;
  pluck(ic, scale[0]!, t0 + 0.0, 1.2, 0.30);
  pluck(ic, scale[2]!, t0 + 0.18, 1.2, 0.30);
  pluck(ic, scale[4]!, t0 + 0.36, 1.2, 0.32);
  pluck(ic, scale[7]!, t0 + 0.54, 1.5, 0.36);
  bell(ic, scale[0]! * 2, t0 + 0.4, 3.5, 0.20);

  // One-shot: depois de 4.5s volta pra exploration-calm
  const to = setTimeout(() => setAmbient('exploration-calm'), 4500);
  if (activeMood) activeMood.oneShotTimeouts.push(to);
}

/** Phrygian A2 — heartbeat low + bell distante. Crítico, último fôlego. */
function buildDangerLowHp(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.A2, 'phrygian');
  // Drone bem baixo
  const pad = padDrone(ic, [scale[0]!], 'sine', 200);
  registerPad(pad);

  // Heartbeat a cada 1.6s (~37 BPM, mais lento que coração — sensação de exaustão)
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 37, patternLength: 1, stepsPerBeat: 1,
    onStep: ({ time }) => heartbeat(ic, time, 0.40),
  });
  seq.start();
  registerSeq(seq);

  // Bell distante esporádico
  const bellSeq = new Sequencer({
    ctx: ic.ctx, bpm: 20, patternLength: 4, stepsPerBeat: 1,
    onStep: ({ step, time }) => {
      if (step === 0) bell(ic, scale[1]! * 2, time, 4.0, 0.10);
    },
  });
  bellSeq.start();
  registerSeq(bellSeq);
}

/** Lydian em E4 — bells aleatórias + pad etéreo. Sensação mística. */
function buildMystery(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.E4, 'lydian');
  // Pad etéreo agudo
  const pad = padDrone(ic, [scale[0]!, scale[2]!, scale[4]!], 'sine');
  registerPad(pad);

  // Bells em positions aleatórias do pattern, BPM lento
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 45, patternLength: 16, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      // 35% chance de tocar bell em step com uma nota da escala
      if (Math.random() < 0.35) {
        const noteIdx = Math.floor(Math.random() * scale.length);
        bell(ic, scale[noteIdx]!, time, 2.8, 0.12);
      }
    },
  });
  seq.start();
  registerSeq(seq);
}

/** Major em C4 — harpa arpejo + pad warm. Descanso reconfortante. */
function buildRest(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.C4, 'major');
  const pad = padDrone(ic, [midiToHz(ROOTS.C4 - 12), scale[0]!, scale[4]!], 'sine');
  registerPad(pad);

  // Harpa arpejo (1-3-5-8-5-3) repeating, BPM 80
  const arpeggio = [0, 2, 4, 7, 4, 2];
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 80, patternLength: 6, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      const idx = arpeggio[step % arpeggio.length]!;
      pluck(ic, scale[idx]!, time, 1.4, 0.13);
    },
  });
  seq.start();
  registerSeq(seq);
}

/** Dorian em D4 — alaúde walking arpeggio. Loja jovial, pé pra cima. */
function buildShop(ic: InstrumentCtx): void {
  const scale = getScale(ROOTS.D4, 'dorian');
  // Walking pluck: 1-3-5-3-1-3-5-7, BPM 100
  const walking = [0, 2, 4, 2, 0, 2, 4, 6];
  const seq = new Sequencer({
    ctx: ic.ctx, bpm: 100, patternLength: 8, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      const idx = walking[step % walking.length]!;
      pluck(ic, scale[idx]!, time, 0.6, 0.16);
    },
  });
  seq.start();
  registerSeq(seq);

  // Bass simples pluck na fundamental a cada 2 compassos
  const bassSeq = new Sequencer({
    ctx: ic.ctx, bpm: 100, patternLength: 16, stepsPerBeat: 2,
    onStep: ({ step, time }) => {
      if (step === 0 || step === 8) pluck(ic, scale[0]! / 2, time, 1.4, 0.18);
    },
  });
  bassSeq.start();
  registerSeq(bassSeq);
}

function registerPad(pad: { stop: (r: number) => void; gainNode: GainNode }): void {
  if (activeMood) activeMood.pads.push(pad);
}
function registerSeq(seq: Sequencer): void {
  if (activeMood) activeMood.sequencers.push(seq);
}

// Test-only helper pra inspecionar estado interno
export function _getCurrentMood(): AmbientMood { return currentMoodName; }
export function _getActiveSequencersCount(): number { return activeMood?.sequencers.length ?? 0; }
export function _getActivePadsCount(): number { return activeMood?.pads.length ?? 0; }

// Quando SFX é desabilitado, ambient também silencia (consistência UX)
void isSfxEnabled; // só re-export marker; ambient tem própria flag
