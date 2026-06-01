// JSgame · Trilha por LOOPS (Fase 2 estabilização — "Menos é Mais").
//
// Toca loops medievais CC0/CC-BY (arquivos .ogg em public/audio/) por mood,
// roteados pelo MIXER (reverb/compressor + volume da música) — alternativa à
// trilha GENERATIVA (composer/instruments sintetizados), que soou intrusiva no
// 1º contato (drone de serra + melodia aleatória). Reusa o que já é bom:
//   • pickAmbientMood (campaign-screen) decide o mood
//   • computeIntensity (music-intensity) decide a intensidade
//   • mixer (getMusicInput) dá reverb + volume
// Só troca a FONTE do som: arquivo gravado em vez de síntese.
//
// ADITIVO e DESLIGADO por padrão: o motor generativo continua intacto. Isto só
// entra quando `loopsEnabled` está ON (flag em Ajustes) — aí setAmbient roteia
// pra cá em vez de sintetizar. Sem o .ogg do mood, é no-op gracioso (silêncio).
//
// Como usar: dropar os .ogg em public/audio/ (ver public/audio/README.md) e
// ligar "Música por loops" em Ajustes. O João é o ouvido — escolhe/aprova.

import { _getAudioCtx, _getMasterGain } from '../audio';
import { getMusicInput } from './mixer';
import type { AmbientMood } from './ambient';

const STORAGE_KEY_LOOPS = 'jsgame.audio.loops';

let loopsEnabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY_LOOPS) === '1'; }
  catch { return false; }  // default OFF — não muda o comportamento atual
})();

export function isLoopsEnabled(): boolean { return loopsEnabled; }
export function setLoopsEnabled(v: boolean): void {
  loopsEnabled = v;
  try { localStorage.setItem(STORAGE_KEY_LOOPS, v ? '1' : '0'); }
  catch { /* private mode */ }
}

// Mood → chave de loop. 6 arquivos cobrem os 12 moods (moods próximos
// compartilham um loop). Drop em public/audio/<chave>.ogg.
export const MOOD_TO_LOOP: Record<string, string> = {
  'exploration': 'exploration',
  'exploration-calm': 'exploration',
  'travel': 'exploration',
  'exploration-tension': 'tension',
  'danger-low-hp': 'tension',
  'combat': 'combat',
  'combat-skirmish': 'combat',
  'combat-boss': 'combat',
  'mystery': 'mystery',
  'rest': 'rest',
  'sacred': 'rest',
  'shop': 'tavern',
  'tavern': 'tavern',
  'victory': 'tavern',
};

export const LOOP_KEYS = ['exploration', 'tension', 'combat', 'rest', 'mystery', 'tavern'] as const;

export function loopKeyForMood(mood: AmbientMood): string | null {
  return MOOD_TO_LOOP[mood] ?? null;
}
export function loopUrlForKey(key: string): string {
  return `/audio/${key}.ogg`;
}

/** Intensidade 0..1 → ganho do loop. Conservador pra não competir com narração
 *  e efeitos: sussurro de exploração (0.12) → auge de combate (0.42). */
export function intensityToLoopGain(x: number): number {
  return 0.12 + Math.max(0, Math.min(1, x)) * 0.30;
}

// Cache de buffers decodificados + chaves sabidamente ausentes (404/erro), pra
// não re-fetchar a cada troca de mood quando o arquivo não existe.
const bufferCache = new Map<string, AudioBuffer>();
const missingKeys = new Set<string>();

interface ActiveLoop { key: string; src: AudioBufferSourceNode; gain: GainNode; }
let activeLoop: ActiveLoop | null = null;
let currentIntensity = 0.4;
// Token de requisição — descarta resultado de load que ficou obsoleto (mood
// trocou de novo enquanto o fetch/decode rodava).
let requestToken = 0;

async function loadBuffer(key: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(key);
  if (cached) return cached;
  if (missingKeys.has(key)) return null;
  const ctx = _getAudioCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(loopUrlForKey(key));
    if (!res.ok) { missingKeys.add(key); return null; }
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.set(key, buf);
    return buf;
  } catch {
    missingKeys.add(key);  // sem arquivo / decode falhou — não re-tenta
    return null;
  }
}

/** Toca o loop do mood (async, crossfade do anterior). No-op gracioso se não
 *  houver arquivo pro mood (silêncio — não quebra nada). */
export async function playLoopForMood(mood: AmbientMood): Promise<void> {
  const key = loopKeyForMood(mood);
  const myToken = ++requestToken;
  if (!key) { stopLoop(0.6); return; }
  if (activeLoop && activeLoop.key === key) return; // já tocando esse loop
  const buf = await loadBuffer(key);
  if (myToken !== requestToken) return; // mood trocou enquanto carregava
  if (!buf) { stopLoop(0.6); return; }  // sem arquivo → silêncio gracioso
  const ctx = _getAudioCtx();
  const dest = getMusicInput() ?? _getMasterGain();
  if (!ctx || !dest) return;
  stopLoop(0.8);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(intensityToLoopGain(currentIntensity), ctx.currentTime + 1.2);
  gain.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain);
  src.start();
  activeLoop = { key, src, gain };
}

/** Intensidade adaptativa (combate sobe, exploração respira) — espelha
 *  setAmbientIntensity do motor generativo, mas só mexe no ganho do loop. */
export function setLoopIntensity(x: number): void {
  currentIntensity = Math.max(0, Math.min(1, x));
  if (!activeLoop) return;
  const ctx = _getAudioCtx();
  const now = ctx ? ctx.currentTime : 0;
  const target = intensityToLoopGain(currentIntensity);
  try {
    activeLoop.gain.gain.cancelScheduledValues(now);
    activeLoop.gain.gain.setValueAtTime(activeLoop.gain.gain.value, now);
    activeLoop.gain.gain.linearRampToValueAtTime(target, now + 1.5);
  } catch { activeLoop.gain.gain.value = target; }
}

export function stopLoop(releaseSec = 0.6): void {
  if (!activeLoop) return;
  const captured = activeLoop;
  activeLoop = null;
  const ctx = _getAudioCtx();
  if (ctx) {
    try {
      captured.gain.gain.cancelScheduledValues(ctx.currentTime);
      captured.gain.gain.setValueAtTime(captured.gain.gain.value, ctx.currentTime);
      captured.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + releaseSec);
    } catch { /* */ }
  }
  setTimeout(() => {
    try { captured.src.stop(); } catch { /* */ }
    try { captured.src.disconnect(); captured.gain.disconnect(); } catch { /* */ }
  }, releaseSec * 1000 + 100);
}

// ── Test helpers ─────────────────────────────────────────────────────────────
export function _resetLoopState(): void {
  bufferCache.clear();
  missingKeys.clear();
  activeLoop = null;
  currentIntensity = 0.4;
  requestToken = 0;
}
export function _hasActiveLoop(): boolean { return !!activeLoop; }
