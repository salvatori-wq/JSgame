// JSgame · ο.8 — UX Preferences (density, font scale, contrast, hit targets, anim speed).
// Persiste em localStorage. Aplica via CSS vars no documentElement.
// initUxPrefs() chamado no boot pra aplicar prefs salvas antes de qualquer render.

import { setSfxVolume } from './audio';
import { setMusicVolume, setReverbAmount } from './audio/mixer';

const STORAGE_KEY = 'jsgame.uxPrefs';

export type Density = 'compact' | 'standard' | 'comfortable';
export type FontScale = 0.9 | 1.0 | 1.15 | 1.3;
export type AnimSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type TypewriterSpeed = 'instant' | 'slow' | 'normal' | 'fast';

export interface UxPrefs {
  density: Density;
  fontScale: FontScale;
  contrastBoost: boolean;
  hitTargetBoost: boolean;
  animSpeed: AnimSpeed;
  typewriterSpeed: TypewriterSpeed;
  /** Ω.1 — Forçar animações cinematográficas mesmo com prefers-reduced-motion: reduce.
   * Default ON: maioria dos players quer ver dado caindo. Player com sensibilidade
   * desativa pra respeitar OS. */
  forceMotion: boolean;
  /** Dado 3D com física real (@3d-dice/dice-box) — cai e quica. Default ON.
   * Fallback automático pro dado CSS se off, sem WebGL, ou se a lib falhar. */
  physicalDice: boolean;
  /** Onda 6 — volume da música (0..1.5). Aplica no bus de música do mixer. */
  musicVolume: number;
  /** Onda 6 — volume dos efeitos sonoros (0..1.5). Aplica no bus de SFX. */
  sfxVolume: number;
  /** Onda 6 — quantidade de reverb/eco da música (0..1). */
  reverbAmount: number;
}

export const DEFAULT_PREFS: UxPrefs = {
  density: 'standard',
  fontScale: 1.0,
  contrastBoost: false,
  hitTargetBoost: false,
  animSpeed: 'normal',
  typewriterSpeed: 'normal',
  forceMotion: true,
  // Dado físico 3D (dice-box) default OFF: em mobile ele carrega ~600KB lazy e
  // o canvas full-screen (#dice-box-mount, z-9600) cobria o dado CSS do skill-
  // check (z-9000) → "dado não cai" no celular. O dado CSS (dice-3d) é o
  // confiável e sempre visível. Físico vira opt-in em Ajustes.
  physicalDice: false,
  musicVolume: 1.0,
  sfxVolume: 1.0,
  reverbAmount: 0.3,
};

let cached: UxPrefs | null = null;

export function getUxPrefs(): UxPrefs {
  if (cached) return cached;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UxPrefs>;
      cached = { ...DEFAULT_PREFS, ...sanitize(parsed) };
      return cached;
    }
  } catch (err) {
    console.warn('[ux-prefs] load failed:', err);
  }
  cached = { ...DEFAULT_PREFS };
  return cached;
}

export function setUxPrefs(patch: Partial<UxPrefs>): UxPrefs {
  const current = getUxPrefs();
  cached = { ...current, ...sanitize(patch) };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    }
  } catch (err) {
    console.warn('[ux-prefs] save failed:', err);
  }
  applyUxPrefs(cached);
  return cached;
}

export function applyUxPrefs(prefs: UxPrefs = getUxPrefs()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Font scale
  root.style.setProperty('--ux-font-scale', String(prefs.fontScale));

  // Density → padding multiplier
  const densityMul = prefs.density === 'compact' ? 0.75
    : prefs.density === 'comfortable' ? 1.25
    : 1.0;
  root.style.setProperty('--ux-density-pad', String(densityMul));

  // Hit target boost
  root.style.setProperty('--ux-hit-min', prefs.hitTargetBoost ? '56px' : '44px');

  // Anim speed multiplier (multiplica todas durações respeitando reduced-motion)
  const animMul = prefs.animSpeed === 'instant' ? 0
    : prefs.animSpeed === 'fast' ? 0.6
    : prefs.animSpeed === 'slow' ? 1.6
    : 1.0;
  root.style.setProperty('--ux-anim-multiplier', String(animMul));

  // Contrast boost — adiciona classe
  document.body.classList.toggle('ux-contrast-boost', prefs.contrastBoost);
  document.body.classList.toggle('ux-density-compact', prefs.density === 'compact');
  document.body.classList.toggle('ux-density-comfortable', prefs.density === 'comfortable');

  // Ω.1 — Force motion: override de prefers-reduced-motion via body class.
  // CSS em dice.css usa body.force-motion .die-3d.is-rolling { animation: ... !important }
  // pra ignorar media query do OS.
  document.body.classList.toggle('force-motion', prefs.forceMotion);

  // Onda 6 — aplica volumes/reverb nos buses de áudio (no-op se o AudioContext
  // ainda não existe; o mixer/sfx lêem esses valores ao montar no 1º gesto).
  try {
    setMusicVolume(prefs.musicVolume);
    setSfxVolume(prefs.sfxVolume);
    setReverbAmount(prefs.reverbAmount);
  } catch { /* áudio indisponível — ignora */ }
}

/** Migração one-time: completa o 289673f. Aquele commit virou o default de
 * physicalDice ON→OFF (o canvas físico z-9600 tapava o dado CSS do skill-check
 * no celular), MAS getUxPrefs faz {...DEFAULT, ...stored} — então quem já jogou
 * tem physicalDice:true salvo e o novo default nunca o alcança. Resultado: o
 * João (e qualquer player antigo) segue no dado físico mesmo após o deploy.
 * Aqui resetamos UMA vez pro novo default. Quem quiser o físico reativa em
 * Ajustes (o flag impede re-clobber depois). Mesma pegada do tutorial-seen flag. */
const PHYSICAL_DICE_MIGRATION_KEY = 'jsgame:physicalDiceDefaultMigratedV2';

export function migratePhysicalDiceDefault(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(PHYSICAL_DICE_MIGRATION_KEY) === '1') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UxPrefs>;
      // Só age sobre quem tinha o ANTIGO default (physicalDice:true). Quem já
      // está em false, ou nunca salvou pref, não é tocado.
      if (parsed && parsed.physicalDice === true) {
        setUxPrefs({ physicalDice: false });
      }
    }
    localStorage.setItem(PHYSICAL_DICE_MIGRATION_KEY, '1');
  } catch { /* best-effort — migração nunca pode travar o boot */ }
}

/** Inicializa: migra prefs legadas + load + apply. Chamar no boot do main.ts. */
export function initUxPrefs(): void {
  migratePhysicalDiceDefault();
  applyUxPrefs(getUxPrefs());
}

/** Reset pra defaults. */
export function resetUxPrefs(): void {
  cached = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore */ }
  applyUxPrefs(DEFAULT_PREFS);
}

function sanitize(patch: Partial<UxPrefs>): Partial<UxPrefs> {
  const out: Partial<UxPrefs> = {};
  if (patch.density && ['compact', 'standard', 'comfortable'].includes(patch.density)) {
    out.density = patch.density;
  }
  if (typeof patch.fontScale === 'number' && [0.9, 1.0, 1.15, 1.3].includes(patch.fontScale)) {
    out.fontScale = patch.fontScale as FontScale;
  }
  if (typeof patch.contrastBoost === 'boolean') out.contrastBoost = patch.contrastBoost;
  if (typeof patch.hitTargetBoost === 'boolean') out.hitTargetBoost = patch.hitTargetBoost;
  if (patch.animSpeed && ['slow', 'normal', 'fast', 'instant'].includes(patch.animSpeed)) {
    out.animSpeed = patch.animSpeed;
  }
  if (patch.typewriterSpeed && ['instant', 'slow', 'normal', 'fast'].includes(patch.typewriterSpeed)) {
    out.typewriterSpeed = patch.typewriterSpeed;
  }
  if (typeof patch.forceMotion === 'boolean') out.forceMotion = patch.forceMotion;
  if (typeof patch.physicalDice === 'boolean') out.physicalDice = patch.physicalDice;
  if (typeof patch.musicVolume === 'number' && isFinite(patch.musicVolume)) {
    out.musicVolume = Math.max(0, Math.min(1.5, patch.musicVolume));
  }
  if (typeof patch.sfxVolume === 'number' && isFinite(patch.sfxVolume)) {
    out.sfxVolume = Math.max(0, Math.min(1.5, patch.sfxVolume));
  }
  if (typeof patch.reverbAmount === 'number' && isFinite(patch.reverbAmount)) {
    out.reverbAmount = Math.max(0, Math.min(1, patch.reverbAmount));
  }
  return out;
}

/** Reset cache pra tests. */
export function _resetCacheForTest(): void {
  cached = null;
}
