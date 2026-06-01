// Trilha Medieval Procedural — Moods ADAPTATIVOS em camadas (Onda 4).
// Cada mood = pilha de stems (drone / ritmo / melodia / harmonia), cada um no seu
// GainNode. setAmbientIntensity(0..1) faz crossfade das camadas + abre o filtro
// mestre → a música ESCALA com a tensão do jogo (exploração respira, combate sobe,
// boss/perigo no auge). A melodia é GERADA pelo Composer (forma A·A'·B·A''), então
// NUNCA repete idêntica, mas o leitmotif sempre volta.
//
// API pública (retrocompat): setAmbient(mood), isAmbientEnabled, setAmbientEnabled.
// Novo: setAmbientIntensity(x), getAmbientIntensity().
//
// Moods (mode→mood pela pesquisa §2): exploration-calm (Dorian, leitmotif),
// exploration-tension (Aeolian), combat-skirmish (Mixolydian/saltarello),
// combat-boss (Phrygian/war), danger-low-hp (Phrygian/heartbeat/lamento),
// mystery (Lydian/bells), rest (Ionian/harpa), shop (Dorian/carole),
// tavern (Mixolydian/saltarello/festa), sacred (Dorian/órgãoum/catedral),
// travel (Mixolydian/estampie/leitmotif na estrada), victory (fanfarra one-shot).

import { _getAudioCtx, _getMasterGain } from '../audio';
import {
  padDrone, drumKick, drumTom, drumHat, tabor, bodhran, nakers, churchBell,
  hurdyBuzz, heartbeat, lute, vielle, recorder, shawm, psaltery, harp,
  type InstrumentCtx, type MelodicVoice,
} from './instruments';
import { Sequencer } from './sequencer';
import { getScale, midiToHz, ROOTS, type Mode } from './modes';
import { makeRng } from './theory';
import {
  Composer, drumPattern, RHYTHMS, buildStepMap,
  type DanceForm, type Note, type DrumHit,
} from './composer';
import { themeToFreqs, MAIN_THEME, VICTORY_FANFARE, LAMENT_THEME } from './themes';
import { getMusicInput, setReverbKind, setMusicBrightness, type ReverbKind } from './mixer';
import { computeLayers, intensityToBrightness, type LayerCaps } from './intensity';
// Fase 2 — trilha por loops (alternativa ao motor generativo, ligada por flag).
import { isLoopsEnabled, playLoopForMood, setLoopIntensity, stopLoop } from './loops';

export type AmbientMood =
  | 'silence'
  | 'exploration' | 'exploration-calm' | 'exploration-tension'
  | 'combat' | 'combat-skirmish' | 'combat-boss'
  | 'victory'
  | 'danger-low-hp'
  | 'mystery'
  | 'rest'
  | 'shop'
  | 'tavern'
  | 'sacred'
  | 'travel';

const STORAGE_KEY_AMBIENT = 'jsgame.ambient.enabled';
// Fase 0 (estabilização) — música ambiente DESLIGADA por padrão. A trilha
// generativa procedural soava intrusiva/grating no 1º contato (drone de serra +
// melodia aleatória em loop). Default OFF para de fazer o jogo soar mal de cara;
// quem quiser liga em Ajustes. Os EFEITOS (dado, etc.) seguem ligados (são curtos
// e bons). Quando a trilha for trocada por loops de qualidade, reavaliar o default.
let ambientEnabled = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY_AMBIENT);
    if (v === null) return false;  // default OFF (era true)
    return v !== '0';
  } catch { return false; }
})();

export function isAmbientEnabled(): boolean { return ambientEnabled; }
export function setAmbientEnabled(v: boolean): void {
  ambientEnabled = v;
  try { localStorage.setItem(STORAGE_KEY_AMBIENT, v ? '1' : '0'); }
  catch { /* private mode */ }
  if (!v) { setAmbient('silence'); return; }
  // Religou em Ajustes — retoma o último clima pedido pelo gameplay (se houver),
  // pra música voltar na hora em vez de só na próxima ação.
  if (lastRequestedMood !== 'silence') setAmbient(lastRequestedMood);
}

// ── Configuração de cada mood ────────────────────────────────────────────────
type Percussion = 'dance' | 'heartbeat' | 'none';

interface MoodConfig {
  mode: Mode;
  rootMidi: number;
  form: DanceForm;
  reverb: ReverbKind;
  melody: MelodicVoice;
  harmony?: MelodicVoice;
  melodyGain?: number;
  harmonyGain?: number;
  /** Tema-semente (leitmotif) usado como base da melodia. */
  seedTheme?: Note[];
  droneType?: OscillatorType;
  droneLowpass?: number;
  baseIntensity: number;
  caps?: LayerCaps;
  percussion?: Percussion;
  /** Buzz do hurdy-gurdy no tempo forte (festa/combate). */
  buzz?: boolean;
  /** Sino/sparkle esporádico (mística/sagrado). */
  sparkle?: { voice: MelodicVoice; chance: number; gain?: number };
  seed: number;
}

export const MOOD_CONFIGS: Record<string, MoodConfig> = {
  'exploration-calm': {
    mode: 'dorian', rootMidi: ROOTS.D3, form: 'ductia', reverb: 'hall',
    melody: recorder, harmony: vielle, melodyGain: 0.13, harmonyGain: 0.09,
    seedTheme: MAIN_THEME, droneLowpass: 2200, baseIntensity: 0.28, seed: 101,
  },
  'exploration-tension': {
    mode: 'aeolian', rootMidi: ROOTS.D3, form: 'estampie', reverb: 'cave',
    melody: vielle, harmony: vielle, melodyGain: 0.12, harmonyGain: 0.08,
    droneLowpass: 1600, baseIntensity: 0.42, caps: { harmony: 0.6 }, seed: 202,
  },
  'combat-skirmish': {
    mode: 'mixolydian', rootMidi: ROOTS.E3, form: 'saltarello', reverb: 'hall',
    melody: lute, harmony: shawm, melodyGain: 0.14, harmonyGain: 0.1,
    droneLowpass: 2400, baseIntensity: 0.58, buzz: true, seed: 303,
  },
  'combat-boss': {
    mode: 'phrygian', rootMidi: ROOTS.D3, form: 'war', reverb: 'cathedral',
    melody: shawm, harmony: shawm, melodyGain: 0.13, harmonyGain: 0.12,
    droneLowpass: 1400, baseIntensity: 0.82, seed: 404,
  },
  'danger-low-hp': {
    mode: 'phrygian', rootMidi: ROOTS.A2, form: 'basse-danse', reverb: 'cave',
    melody: vielle, melodyGain: 0.12, seedTheme: LAMENT_THEME,
    droneType: 'sine', droneLowpass: 900, baseIntensity: 0.5,
    percussion: 'heartbeat', caps: { rhythm: 0.6 }, seed: 212,
  },
  mystery: {
    mode: 'lydian', rootMidi: ROOTS.E4, form: 'basse-danse', reverb: 'cathedral',
    melody: harp, melodyGain: 0.12, droneType: 'sine', droneLowpass: 3000,
    baseIntensity: 0.2, percussion: 'none', caps: { rhythm: 0 },
    sparkle: { voice: churchBell, chance: 0.22, gain: 0.1 }, seed: 505,
  },
  rest: {
    mode: 'major', rootMidi: ROOTS.C4, form: 'basse-danse', reverb: 'hall',
    melody: harp, melodyGain: 0.13, droneType: 'sine', droneLowpass: 2600,
    baseIntensity: 0.14, percussion: 'none', caps: { rhythm: 0, harmony: 0.4 }, seed: 606,
  },
  shop: {
    mode: 'dorian', rootMidi: ROOTS.D4, form: 'carole', reverb: 'tavern',
    melody: lute, melodyGain: 0.14, droneLowpass: 2800, baseIntensity: 0.4, seed: 707,
  },
  tavern: {
    mode: 'mixolydian', rootMidi: ROOTS.D4, form: 'saltarello', reverb: 'tavern',
    melody: lute, harmony: psaltery, melodyGain: 0.14, harmonyGain: 0.1,
    droneLowpass: 3000, baseIntensity: 0.5, buzz: true, seed: 808,
  },
  sacred: {
    mode: 'dorian', rootMidi: ROOTS.A3, form: 'basse-danse', reverb: 'cathedral',
    melody: harp, harmony: recorder, melodyGain: 0.12, harmonyGain: 0.1,
    droneType: 'sine', droneLowpass: 2400, baseIntensity: 0.3, percussion: 'none',
    caps: { rhythm: 0 }, sparkle: { voice: churchBell, chance: 0.1, gain: 0.09 }, seed: 909,
  },
  travel: {
    mode: 'mixolydian', rootMidi: ROOTS.G3, form: 'estampie', reverb: 'hall',
    melody: recorder, harmony: vielle, melodyGain: 0.13, harmonyGain: 0.09,
    seedTheme: MAIN_THEME, droneLowpass: 2400, baseIntensity: 0.45, seed: 111,
  },
};

/** Moods "tocáveis" (sem silence/victory/aliases) — pro harness de audição (Onda 7). */
export const LISTED_MOODS: AmbientMood[] = [
  'exploration-calm', 'exploration-tension', 'combat-skirmish', 'combat-boss',
  'danger-low-hp', 'mystery', 'rest', 'shop', 'tavern', 'sacred', 'travel', 'victory',
];

// ── Estado interno ───────────────────────────────────────────────────────────
interface MoodLayers { drone: GainNode; rhythm: GainNode; melody: GainNode; harmony: GainNode; }

interface ActiveMood {
  mood: AmbientMood;
  pads: Array<{ stop: (release: number) => void; gainNode: GainNode }>;
  sequencers: Sequencer[];
  oneShotTimeouts: Array<ReturnType<typeof setTimeout>>;
  bus: GainNode;
  layers: MoodLayers | null;
  caps: LayerCaps;
}

let activeMood: ActiveMood | null = null;
let currentMoodName: AmbientMood = 'silence';
let currentIntensity = 0.3;
// Último mood "real" pedido pelo gameplay (≠ silence). Permite que religar a
// música em Ajustes (setAmbientEnabled(true)) retome o clima certo na hora,
// não só na próxima ação do jogador.
let lastRequestedMood: AmbientMood = 'silence';

function canonical(mood: AmbientMood): AmbientMood {
  if (mood === 'exploration') return 'exploration-calm';
  if (mood === 'combat') return 'combat-skirmish';
  return mood;
}

export function setAmbient(mood: AmbientMood): void {
  const target = canonical(mood);
  if (target !== 'silence') lastRequestedMood = target;
  if (currentMoodName === target) return;

  // Fase 2 — se a trilha por LOOPS está ligada, ela é a fonte do som. Para o
  // motor generativo (pra não tocar junto) e roteia o mood pro loop player
  // (que cai em silêncio gracioso se o .ogg do mood não estiver presente).
  if (isLoopsEnabled()) {
    stopActive(0.6);
    currentMoodName = target;
    if (!ambientEnabled || target === 'silence') { stopLoop(0.6); return; }
    void playLoopForMood(target);
    return;
  }

  stopActive(0.6);
  currentMoodName = target;
  if (!ambientEnabled || target === 'silence') return;

  const ctx = _getAudioCtx();
  const master = _getMasterGain();
  if (!ctx || !master) return;

  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 1.2); // presença sem clipping
  bus.connect(getMusicInput() ?? master);

  const ic: InstrumentCtx = { ctx, dest: bus };
  activeMood = { mood: target, pads: [], sequencers: [], oneShotTimeouts: [], bus, layers: null, caps: {} };

  if (target === 'victory') { buildVictory(ic); return; }

  const cfg = MOOD_CONFIGS[target];
  if (!cfg) return;
  setReverbKind(cfg.reverb);
  buildLayeredMood(ic, cfg);
  currentIntensity = cfg.baseIntensity;
  applyIntensity();
}

/** Intensidade adaptativa 0..1 — dirigida pelo gameplay (Onda 5). */
export function setAmbientIntensity(x: number): void {
  currentIntensity = Math.max(0, Math.min(1, x));
  if (isLoopsEnabled()) { setLoopIntensity(currentIntensity); return; }
  applyIntensity();
}

/** Fase 2 — troca o motor (loops <-> generativo) sem mudar o mood. O João
 *  liga/desliga "Música por loops" em Ajustes; isto re-aplica o mood corrente
 *  forçando o rebuild na fonte certa (setAmbient faz early-return por mood). */
export function reapplyAmbientEngine(): void {
  const mood = currentMoodName;
  stopActive(0);
  stopLoop(0.3);
  currentMoodName = 'silence';  // força setAmbient a reconstruir do zero
  if (mood !== 'silence') setAmbient(mood);
}
export function getAmbientIntensity(): number { return currentIntensity; }

function applyIntensity(): void {
  if (!activeMood || !activeMood.layers) return;
  const ctx = _getAudioCtx();
  const now = ctx ? ctx.currentTime : 0;
  const L = computeLayers(currentIntensity, activeMood.caps);
  rampGain(activeMood.layers.drone, L.drone, now);
  rampGain(activeMood.layers.rhythm, L.rhythm, now);
  rampGain(activeMood.layers.melody, L.melody, now);
  rampGain(activeMood.layers.harmony, L.harmony, now);
  setMusicBrightness(intensityToBrightness(currentIntensity));
}

function rampGain(g: GainNode, target: number, now: number): void {
  try {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(target, now + 1.5); // fade 1.5s (pesquisa: 1-4s)
  } catch { g.gain.value = target; }
}

function makeLayers(ic: InstrumentCtx): MoodLayers {
  const mk = (): GainNode => {
    const g = ic.ctx.createGain();
    g.gain.value = 0;
    g.connect(ic.dest);
    return g;
  };
  return { drone: mk(), rhythm: mk(), melody: mk(), harmony: mk() };
}

function fireDrum(ic: InstrumentCtx, hit: DrumHit, time: number, tonicHz: number): void {
  switch (hit.drum) {
    case 'kick': drumKick(ic, time, hit.gain); break;
    case 'tom': drumTom(ic, time, 170, hit.gain); break;
    case 'hat': drumHat(ic, time, hit.gain); break;
    case 'tabor': tabor(ic, time, hit.gain); break;
    case 'bodhran': bodhran(ic, time, hit.gain); break;
    case 'nakers': nakers(ic, tonicHz, time, hit.gain); break;
  }
}

// ── Builder genérico em camadas ──────────────────────────────────────────────
function buildLayeredMood(ic: InstrumentCtx, cfg: MoodConfig): void {
  const scale = getScale(cfg.rootMidi, cfg.mode); // 8 freqs (oitava incluída)
  const layers = makeLayers(ic);
  if (activeMood) { activeMood.layers = layers; activeMood.caps = cfg.caps ?? {}; }

  // Drone (sempre presente): oitava abaixo + tônica + 5ª (quinta aberta medieval).
  const droneDest: InstrumentCtx = { ctx: ic.ctx, dest: layers.drone };
  const drone = padDrone(
    droneDest,
    [midiToHz(cfg.rootMidi - 12), scale[0]!, scale[4]!],
    cfg.droneType ?? 'sawtooth',
    cfg.droneLowpass ?? 2200,
  );
  registerPad(drone);

  const rhythmIc: InstrumentCtx = { ctx: ic.ctx, dest: layers.rhythm };
  const melodyIc: InstrumentCtx = { ctx: ic.ctx, dest: layers.melody };
  const harmonyIc: InstrumentCtx = { ctx: ic.ctx, dest: layers.harmony };

  const spec = RHYTHMS[cfg.form];
  const stepDur = 60 / spec.bpm / spec.stepsPerBeat;
  const tonicLow = scale[0]! / 2;

  // Melodia generativa — Composer com leitmotif opcional.
  const composer = new Composer({
    rng: makeRng(cfg.seed), bars: 2, stepsPerBar: 6, ...(cfg.seedTheme ? { seedTheme: cfg.seedTheme } : {}),
  });
  const phraseSteps = composer.phraseSteps();
  let melMap = buildStepMap(themeToFreqs(composer.nextPhrase(), scale));
  const fxRng = makeRng(cfg.seed ^ 0x5151);
  const percussion: Percussion = cfg.percussion ?? 'dance';

  const seq = new Sequencer({
    ctx: ic.ctx, bpm: spec.bpm, patternLength: phraseSteps, stepsPerBeat: spec.stepsPerBeat,
    onStep: ({ step, time }) => {
      // ── Percussão ──
      if (percussion === 'dance') {
        for (const hit of drumPattern(cfg.form, step)) fireDrum(rhythmIc, hit, time, tonicLow);
        if (cfg.buzz && step % spec.length === 0) hurdyBuzz(rhythmIc, time, 0.1);
      }
      // ── Melodia (regenera a frase a cada loop → evolui) ──
      const offset = ((step % phraseSteps) + phraseSteps) % phraseSteps;
      if (offset === 0 && step !== 0) {
        melMap = buildStepMap(themeToFreqs(composer.nextPhrase(), scale));
      }
      const fn = melMap[offset];
      if (fn) {
        const dur = Math.max(0.12, fn.durSteps * stepDur * 0.92);
        cfg.melody(melodyIc, fn.freq, time, dur, cfg.melodyGain ?? 0.13);
        // Harmonia: organum (5ª abaixo) na nota da melodia.
        if (cfg.harmony) {
          cfg.harmony(harmonyIc, fn.freq * Math.pow(2, -7 / 12), time, dur, cfg.harmonyGain ?? 0.09);
        }
      }
      // ── Sparkle (sinos místicos) ──
      if (cfg.sparkle && fxRng() < cfg.sparkle.chance) {
        const note = scale[3 + Math.floor(fxRng() * 5)] ?? scale[4]!;
        cfg.sparkle.voice(melodyIc, note, time, 2.6, cfg.sparkle.gain ?? 0.1);
      }
    },
  });
  seq.start();
  registerSeq(seq);

  // Heartbeat (perigo) — sequencer lento separado na camada de ritmo.
  if (percussion === 'heartbeat') {
    const hb = new Sequencer({
      ctx: ic.ctx, bpm: 37, patternLength: 1, stepsPerBeat: 1,
      onStep: ({ time }) => heartbeat(rhythmIc, time, 0.4),
    });
    hb.start();
    registerSeq(hb);
  }
}

/** Vitória — fanfarra ascendente one-shot (Lydian), volta a exploration-calm. */
function buildVictory(ic: InstrumentCtx): void {
  setReverbKind('cathedral');
  setMusicBrightness(0.9);
  const scale = getScale(ROOTS.G3, 'lydian');
  const notes = themeToFreqs(VICTORY_FANFARE, scale);
  const stepDur = 0.22;
  let t = ic.ctx.currentTime + 0.02;
  for (const n of notes) {
    shawm(ic, n.freq, t, Math.max(0.18, n.durSteps * stepDur * 0.95), 0.13);
    psaltery(ic, n.freq * 2, t, 1.2, 0.08);
    t += n.durSteps * stepDur;
  }
  churchBell(ic, scale[0]! * 2, t + 0.1, 3.5, 0.16);
  const to = setTimeout(() => setAmbient('exploration-calm'), 4500);
  if (activeMood) activeMood.oneShotTimeouts.push(to);
}

function stopActive(releaseSec: number): void {
  if (!activeMood) return;
  const ctx = _getAudioCtx();
  if (ctx) {
    activeMood.bus.gain.cancelScheduledValues(ctx.currentTime);
    activeMood.bus.gain.setValueAtTime(activeMood.bus.gain.value, ctx.currentTime);
    activeMood.bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + releaseSec);
  }
  for (const p of activeMood.pads) p.stop(releaseSec);
  for (const s of activeMood.sequencers) s.stop();
  for (const t of activeMood.oneShotTimeouts) clearTimeout(t);
  const captured = activeMood;
  setTimeout(() => {
    try { captured.bus.disconnect(); } catch { /* */ }
  }, releaseSec * 1000 + 100);
  activeMood = null;
}

function registerPad(pad: { stop: (r: number) => void; gainNode: GainNode }): void {
  if (activeMood) activeMood.pads.push(pad);
}
function registerSeq(seq: Sequencer): void {
  if (activeMood) activeMood.sequencers.push(seq);
}

// ── Stingers musicais — curtos, EM TOM com o mood ativo (Onda 5) ─────────────
// Tocados em eventos (level-up, descoberta, NPC, troca de cena). Usam a escala
// do mood corrente → sempre soam "dentro da música", com reverb do salão.
export type StingerKind = 'level-up' | 'discovery' | 'npc' | 'scene-change';

const STINGER_NOTES: Record<StingerKind, Note[]> = {
  'level-up':     [{ degree: 0, durSteps: 1 }, { degree: 2, durSteps: 1 }, { degree: 4, durSteps: 1 }, { degree: 7, durSteps: 2 }],
  discovery:      [{ degree: 4, durSteps: 1 }, { degree: 7, durSteps: 2 }],
  npc:            [{ degree: 4, durSteps: 1 }, { degree: 2, durSteps: 1 }],
  'scene-change': [{ degree: 7, durSteps: 1 }, { degree: 4, durSteps: 1 }, { degree: 0, durSteps: 2 }],
};

const STINGER_VOICE: Record<StingerKind, MelodicVoice> = {
  'level-up': psaltery, discovery: churchBell, npc: recorder, 'scene-change': harp,
};

/** Graus do stinger (pra tests). */
export function stingerNotes(kind: StingerKind): Note[] { return STINGER_NOTES[kind]; }

/** Toca um stinger curto na escala do mood ativo, roteado pela música (reverb). */
export function playStinger(kind: StingerKind): void {
  if (!ambientEnabled) return;
  const ctx = _getAudioCtx();
  if (!ctx) return;
  const cfg = activeMood ? MOOD_CONFIGS[activeMood.mood] : undefined;
  const mode = cfg?.mode ?? 'dorian';
  const root = (cfg?.rootMidi ?? ROOTS.D4) + 12; // oitava acima → brilha sobre a cama
  const scale = getScale(root, mode);
  const dest = getMusicInput() ?? _getMasterGain();
  if (!dest) return;

  const g = ctx.createGain();
  g.gain.value = 0.55;
  g.connect(dest);
  const ic: InstrumentCtx = { ctx, dest: g };
  const voice = STINGER_VOICE[kind];
  const notes = themeToFreqs(STINGER_NOTES[kind], scale);
  const stepDur = 0.16;
  let t = ctx.currentTime + 0.01;
  for (const n of notes) {
    voice(ic, n.freq, t, Math.max(0.3, n.durSteps * stepDur * 2.2), 0.16);
    t += n.durSteps * stepDur;
  }
  setTimeout(() => { try { g.disconnect(); } catch { /* */ } }, 4500);
}

// ── Test helpers ─────────────────────────────────────────────────────────────
export function _getCurrentMood(): AmbientMood { return currentMoodName; }
export function _getActiveSequencersCount(): number { return activeMood?.sequencers.length ?? 0; }
export function _getActivePadsCount(): number { return activeMood?.pads.length ?? 0; }
