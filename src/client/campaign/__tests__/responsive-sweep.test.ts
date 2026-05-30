// @vitest-environment happy-dom
// Responsivo F5.1 — Sweep DOM da matriz de tamanhos + predicado device-aware.
//
// LIMITE EXPLÍCITO: happy-dom NÃO faz layout (getBoundingClientRect=0, clamp/vh/
// vmin não computam). Este sweep valida ESTRUTURA + WIRING DE CLASSE + QUAIS
// controles existem por tamanho — NÃO geometria/pixel (esses → guards CSS em
// mobile-polish-css.test.ts + minha medição no preview). O harness de mount é o
// mesmo de bottom-action-bar.test.ts.
//
// O predicado (applyEnvironmentClasses) É testável de verdade aqui: controlamos
// innerWidth/innerHeight + pointer:coarse, então provamos o caminho do CELULAR
// DE TOQUE deitado — que o preview (browser sem toque) NÃO consegue exercitar.
//
// singleFork compartilha window entre arquivos → afterEach RESTAURA innerWidth/
// innerHeight/matchMedia/maxTouchPoints + limpa body.className.

import { describe, it, expect, afterEach } from 'vitest';
import { applyEnvironmentClasses } from '../../environment';
import { CampaignScreen } from '../campaign-screen';
import type { CharacterSheet, CampaignState } from '../../../shared/types';

// ── controle de ambiente (viewport + ponteiro) ──────────────────────────────
const ORIG_W = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const ORIG_H = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const ORIG_MM = window.matchMedia;

function setEnv(w: number, h: number, coarse: boolean): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => h });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => (coarse ? 5 : 0) });
  window.matchMedia = ((q: string) => ({
    matches: /coarse/.test(q) ? coarse : false,
    media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  })) as unknown as typeof window.matchMedia;
  applyEnvironmentClasses();
}

afterEach(() => {
  document.body.className = '';
  window.matchMedia = ORIG_MM;
  if (ORIG_W) Object.defineProperty(window, 'innerWidth', ORIG_W); else delete (window as { innerWidth?: number }).innerWidth;
  if (ORIG_H) Object.defineProperty(window, 'innerHeight', ORIG_H); else delete (window as { innerHeight?: number }).innerHeight;
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 0 });
});

const has = (c: string): boolean => document.body.classList.contains(c);
const PORTRAIT = [[320, 568], [360, 640], [390, 844], [430, 932]] as const;

// ── F5.1a — predicado device-aware (o que o preview não consegue: toque) ─────
describe('F5.1 — applyEnvironmentClasses: predicado device-aware na matriz', () => {
  it('retrato-estreito (qualquer device, w<600) → is-portrait-narrow, sem landscape', () => {
    for (const [w, h] of PORTRAIT) {
      setEnv(w, h, false);
      expect(has('is-portrait-narrow'), `${w}x${h} non-coarse`).toBe(true);
      expect(has('is-landscape-phone'), `${w}x${h} non-coarse`).toBe(false);
      setEnv(w, h, true);
      expect(has('is-portrait-narrow'), `${w}x${h} coarse`).toBe(true);
      expect(has('is-landscape-phone'), `${w}x${h} coarse`).toBe(false);
    }
  });

  it('landscape phone (coarse, h<600, w<950, w>h) → is-portrait-narrow + is-landscape-phone', () => {
    for (const [w, h] of [[844, 390], [740, 360], [667, 375]] as const) {
      setEnv(w, h, true);
      expect(has('is-portrait-narrow'), `${w}x${h}`).toBe(true);
      expect(has('is-landscape-phone'), `${w}x${h}`).toBe(true);
    }
  });

  it('o MESMO 844x390 SEM toque (janela de laptop) NÃO é compact — desktop protegido', () => {
    for (const [w, h] of [[844, 390], [740, 360]] as const) {
      setEnv(w, h, false);
      expect(has('is-portrait-narrow'), `${w}x${h} non-coarse`).toBe(false);
      expect(has('is-landscape-phone'), `${w}x${h} non-coarse`).toBe(false);
    }
  });

  it('desktop largo (1280x800) e janela fina-baixa (900x500) non-coarse: nunca compact', () => {
    setEnv(1280, 800, false);
    expect(has('is-portrait-narrow')).toBe(false);
    expect(has('is-landscape-phone')).toBe(false);
    // 900x500 = o caso que o antigo Math.min(w,h)<600 marcava errado como narrow
    setEnv(900, 500, false);
    expect(has('is-portrait-narrow')).toBe(false);
    expect(has('is-landscape-phone')).toBe(false);
  });

  it('tablet coarse GRANDE fica no desktop (≥950 largo OU h≥600)', () => {
    setEnv(1024, 768, true); // iPad landscape — h≥600
    expect(has('is-portrait-narrow')).toBe(false);
    setEnv(768, 1024, true); // iPad portrait — w<600? não (768); h alto
    expect(has('is-portrait-narrow')).toBe(false);
    setEnv(960, 540, true); // ≥950 largo
    expect(has('is-portrait-narrow')).toBe(false);
  });

  it('phone landscape pequeno (w<600 deitado) é compact via w<600, sem landscape-phone', () => {
    setEnv(568, 320, true); // w<600 → compact; w>=600? não → sem landscape deltas (ok, 568<760)
    expect(has('is-portrait-narrow')).toBe(true);
    expect(has('is-landscape-phone')).toBe(false);
  });
});

// ── F5.1b — sweep do shell (estrutura, NÃO pixel) ────────────────────────────
const makeChar = (): CharacterSheet => ({
  id: 'pc-1', ownerId: 'o1', raceId: 'dwarf', classId: 'fighter',
  characterName: 'Borin', level: 1, xp: 0, armorClass: 18,
  currentHp: 13, maxHp: 13, hitDiceRemaining: 1,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  savingThrows: {} as Record<string, boolean>, proficientSkills: [], conditions: [],
  inventory: [], proficiencyBonus: 2, speed: 30, spellSlots: {},
  abilityScoreIncreases: 0, feats: [], proficiencies: [],
  deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0, inspirations: 0,
} as unknown as CharacterSheet);

const exploreState = (): CampaignState => ({ id: 'c1', mode: 'exploration' } as unknown as CampaignState);
const combatState = (): CampaignState => ({
  id: 'c1', mode: 'combat',
  combat: {
    active: true, round: 1, currentTurnIndex: 0,
    initiativeOrder: [{ id: 'pc-1', name: 'Borin', kind: 'player', initiative: 10 }],
    enemies: [], actionEconomy: { 'pc-1': { action: true, bonusAction: true, movement: 30, reaction: true } }, log: [],
  },
} as unknown as CampaignState);

function mount(state: CampaignState): HTMLElement {
  const container = document.createElement('div');
  const screen = new CampaignScreen(container, {
    characterId: 'pc-1', socket: { emit: () => {} } as unknown as never, ownerName: 'João', onExit: () => {},
  } as never);
  const s = screen as unknown as {
    character: CharacterSheet; party: CharacterSheet[]; currentState: CampaignState;
    buildShell(): void; updateMainContent(): void; updateBottomTabBar(): void;
  };
  s.character = makeChar();
  s.party = [makeChar()];
  s.currentState = state;
  s.buildShell();
  s.updateMainContent();
  s.updateBottomTabBar();
  return container;
}

describe('F5.1 — Sweep do shell compacto na matriz (estrutura)', () => {
  it('todo tamanho compacto (retrato + landscape phone) monta a barra de ações no rodapé', () => {
    const cases = [
      [320, 568, false], [360, 640, false], [390, 844, false], [430, 932, false],
      [844, 390, true], // landscape phone (coarse)
    ] as const;
    for (const [w, h, coarse] of cases) {
      setEnv(w, h, coarse);
      const c = mount(exploreState());
      expect(c.querySelector('.camp-screen'), `${w}x${h} camp-screen`).toBeTruthy();
      expect(c.querySelector('.ch-slot-bottom-tabs .camp-action-bar'), `${w}x${h} action bar`).toBeTruthy();
    }
  });

  it('landscape 844x390 (coarse) em combate: is-landscape-phone + Atacar dominante e ATIVO', () => {
    setEnv(844, 390, true);
    expect(has('is-landscape-phone')).toBe(true);
    const c = mount(combatState());
    const atk = c.querySelector('.camp-action-bar.is-combat .cab-btn.is-primary') as HTMLButtonElement | null;
    expect(atk).toBeTruthy();
    expect(atk!.querySelector('.cab-label')?.textContent).toBe('Atacar');
    expect(atk!.hasAttribute('disabled')).toBe(false);
  });

  it('desktop 1280x800 (non-coarse): SEM barra inferior — usa o dock no main-content', () => {
    setEnv(1280, 800, false);
    const c = mount(exploreState());
    expect(c.querySelector('.ch-slot-bottom-tabs .camp-action-bar')).toBeNull();
    expect(c.querySelector('.ch-slot-main-content .camp-actions')).toBeTruthy();
  });
});
