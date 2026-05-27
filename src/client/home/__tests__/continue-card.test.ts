// @vitest-environment happy-dom
// Ω.2 — Tests do Continue Card.

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  const memStore: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memStore[k] ?? null,
    setItem: (k: string, v: string) => { memStore[k] = String(v); },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  });
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.resetModules();
});

describe('maybeRenderContinueCard', () => {
  it('retorna null quando não há lastSession', async () => {
    const { maybeRenderContinueCard } = await import('../sections/continue-card');
    const card = await maybeRenderContinueCard({ onContinue: () => {} });
    expect(card).toBeNull();
  });

  it('retorna card com skeleton inicial quando há lastSession', async () => {
    localStorage.setItem('jsgame:lastSession', JSON.stringify({
      characterId: 'c1',
      campaignId: 'k1',
    }));
    // Stub fetch pra não bater no server
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaigns: [] }),
    }));
    const { maybeRenderContinueCard } = await import('../sections/continue-card');
    const card = await maybeRenderContinueCard({ onContinue: () => {} });
    expect(card).not.toBeNull();
    expect(card?.classList.contains('home-continue')).toBe(true);
    expect(card?.querySelector('.home-continue-skeleton')).toBeTruthy();
  });

  it('CTA chama onContinue com characterId+campaignId corretos', async () => {
    localStorage.setItem('jsgame:lastSession', JSON.stringify({
      characterId: 'pc-99',
      campaignId: 'camp-77',
    }));
    // Mock fetch retornando crônica que match
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        campaigns: [{
          id: 'camp-77',
          name: 'Beco sem saída',
          sessionNumber: 2,
          lastPlayedAt: new Date().toISOString(),
          currentLocation: 'Taverna',
          lastNarrationSnippet: 'A patrulha chegou.',
          partyAnyAtRisk: false,
        }],
      }),
    }));
    const onContinue = vi.fn();
    const { maybeRenderContinueCard } = await import('../sections/continue-card');
    const card = await maybeRenderContinueCard({ onContinue });
    expect(card).not.toBeNull();
    document.body.appendChild(card!);
    // Aguarda fetch async populate
    await new Promise((r) => setTimeout(r, 30));
    const cta = card!.querySelector('.home-continue-cta') as HTMLButtonElement | null;
    expect(cta).toBeTruthy();
    cta!.click();
    expect(onContinue).toHaveBeenCalledWith({ characterId: 'pc-99', campaignId: 'camp-77' });
  });

  it('aplica is-risk quando partyAnyAtRisk=true', async () => {
    localStorage.setItem('jsgame:lastSession', JSON.stringify({
      characterId: 'c1',
      campaignId: 'k1',
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        campaigns: [{
          id: 'k1',
          name: 'X',
          sessionNumber: 1,
          lastPlayedAt: new Date().toISOString(),
          partyAnyAtRisk: true,
          partyAtRiskName: 'Borin',
        }],
      }),
    }));
    const { maybeRenderContinueCard } = await import('../sections/continue-card');
    const card = await maybeRenderContinueCard({ onContinue: () => {} });
    document.body.appendChild(card!);
    await new Promise((r) => setTimeout(r, 30));
    const inner = card!.querySelector('.home-continue-inner');
    expect(inner?.classList.contains('is-risk')).toBe(true);
    expect(card!.querySelector('.home-continue-risk')?.textContent).toContain('Borin');
  });
});
