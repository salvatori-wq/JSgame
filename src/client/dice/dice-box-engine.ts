// JSgame · Dado 3D com FÍSICA real (@3d-dice/dice-box, BabylonJS + AmmoJS).
//
// Por quê: o dado CSS (dice-3d.ts) é bonito mas não "cai e quica". A dice-box
// roda física de verdade — o player vê o dado despencar, bater na mesa e parar.
//
// Princípios de segurança (o jogo NUNCA pode travar por causa disso):
//   1. LAZY: a lib + assets (~600KB WASM/texturas) só carregam no 1º roll.
//   2. RESULTADO FORÇADO: o SERVIDOR é a fonte da verdade. Usamos a notação
//      predeterminada "1dN@valor" — a física é animada pra cair no número que
//      o server decidiu (mantém aparência aleatória).
//   3. FALLBACK TOTAL: se init falhar (sem WebGL/WASM, browser velho, asset 404),
//      marca indisponível pra sempre e o caller usa o dado CSS. try/catch em tudo.
//   4. TOGGLE: UX pref `physicalDice` (default ON). reduced-motion → desliga.
//
// API pública:
//   physicalDiceEnabled(): boolean          — deve tentar usar o físico?
//   rollPhysicalDie(opts): Promise<boolean> — true se rolou no físico; false → fallback

import DiceBox from '@3d-dice/dice-box';
import { getUxPrefs } from '../ux-prefs';
import { prefersReducedMotion } from './dice-3d';
import type { DieKind } from './dice-3d';

// Assets copiados pra public/dice-assets/ (movidos do default public/assets/ pra
// não colidir com o /assets/ hashado do Vite). Servidos na raiz em runtime.
const ASSET_PATH = '/dice-assets/';

// Estado do singleton. 'unsupported' é terminal: nunca mais tenta.
type EngineState = 'idle' | 'loading' | 'ready' | 'unsupported';
let state: EngineState = 'idle';
let box: DiceBox | null = null;
let initPromise: Promise<boolean> | null = null;

export interface RollPhysicalOpts {
  kind: DieKind;
  /** Valor final já decidido pelo servidor (a física cai nele). */
  final: number;
  /** Dispara no momento em que o dado assenta (pra som/haptic/verdict). */
  onSettle?: () => void;
}

/** O físico deve ser tentado? (pref ligada + não reduced-motion + não marcado unsupported). */
export function physicalDiceEnabled(): boolean {
  if (state === 'unsupported') return false;
  if (prefersReducedMotion()) return false; // reduced-motion → dado CSS leve
  try {
    return getUxPrefs().physicalDice !== false; // default ON
  } catch {
    return false;
  }
}

/** Detecta suporte mínimo a WebGL — sem isso, BabylonJS não roda. */
function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Garante o container DOM full-screen onde a dice-box monta o canvas. */
function ensureMount(): void {
  if (!document.getElementById('dice-box-mount')) {
    const mount = document.createElement('div');
    mount.id = 'dice-box-mount';
    document.body.appendChild(mount);
  }
}

/** Lazy-init idempotente. Resolve true se pronto, false se indisponível. */
async function ensureReady(): Promise<boolean> {
  if (state === 'ready') return true;
  if (state === 'unsupported') return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!hasWebGL()) { state = 'unsupported'; return false; }
    state = 'loading';
    try {
      ensureMount();
      const instance = new DiceBox({
        id: 'jsgame-dice-canvas',
        assetPath: ASSET_PATH,
        container: '#dice-box-mount',
        theme: 'default',
        themeColor: '#c9ad6a', // dourado D&D
        scale: 7,
        gravity: 2,
        settleTimeout: 4000,
      });
      await instance.init();
      box = instance;
      state = 'ready';
      return true;
    } catch (err) {
      // Qualquer falha (WASM 404, WebGL context lost, browser velho) → desiste pra sempre.
      console.warn('[dice-box] init falhou, usando dado CSS:', err);
      state = 'unsupported';
      box = null;
      return false;
    }
  })();

  return initPromise;
}

const SIDES: Record<DieKind, number> = {
  d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100,
};

/**
 * Rola o dado físico com resultado forçado. Resolve `true` quando o dado
 * assentou (já chamou onSettle); `false` se o físico não está disponível —
 * nesse caso o CALLER deve fazer o fallback pro dado CSS.
 *
 * Nunca rejeita: erro = false (fallback). Timeout de segurança garante resolve.
 */
export async function rollPhysicalDie(opts: RollPhysicalOpts): Promise<boolean> {
  if (!physicalDiceEnabled()) return false;
  const ready = await ensureReady();
  const b = box;
  if (!ready || !b) return false;

  const sides = SIDES[opts.kind] ?? 20;
  const value = Math.max(1, Math.min(sides, Math.round(opts.final)));

  return new Promise<boolean>((resolve) => {
    let done = false;
    const settle = (): void => {
      if (done) return;
      done = true;
      try { opts.onSettle?.(); } catch { /* silent */ }
      resolve(true);
    };
    // Timeout de segurança: se onRollComplete não disparar (lib travou), assenta mesmo assim.
    const safety = window.setTimeout(settle, 6000);
    try {
      b.onRollComplete = () => { window.clearTimeout(safety); settle(); };
      b.show();
      // Resultado predeterminado: "1dN@valor" cai exatamente no valor do server.
      void b.roll(`1d${sides}@${value}`);
    } catch (err) {
      window.clearTimeout(safety);
      console.warn('[dice-box] roll falhou, fallback CSS:', err);
      state = 'unsupported';
      resolve(false);
    }
  });
}

/** Limpa o dado da tela (chamado quando o overlay fecha). */
export function clearPhysicalDice(): void {
  try { box?.clear(); box?.hide(); } catch { /* silent */ }
}

// Test-only: reset do singleton entre testes.
export function __resetDiceBoxEngineForTest(): void {
  state = 'idle';
  box = null;
  initPromise = null;
}
