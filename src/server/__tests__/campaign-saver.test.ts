// Fase 0d — guards do saver coalescido: N schedules viram 1 save; o flush grava
// a versao MAIS RECENTE; cancel evita gravar; flushAll cobre o shutdown; e o
// timer auto-dispara apos a janela.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { initPersistence, getDbClient, loadCampaign } from '../persistence';
import {
  scheduleSaveCampaign, flushCampaign, cancelScheduledSave, flushAllCampaigns, _pendingSaveCount,
} from '../campaign-saver';
import type { CampaignState } from '../../shared/types';

function mkCampaign(id: string, location = 'Taverna'): CampaignState {
  return {
    id, name: 'Teste', mode: 'exploration',
    partyCharacterIds: ['pj'],
    currentLocation: location,
    currentSceneDescription: '',
    worldFlags: {},
    npcsMet: [],
    recentEvents: [],
    sessionNumber: 1,
    startedAt: 1, lastPlayedAt: 1,
    pendingCheck: null, pendingSave: null,
    combat: null,
  };
}

describe('campaign-saver — Fase 0d debounce', () => {
  beforeAll(async () => { await initPersistence(); });
  beforeEach(async () => {
    await getDbClient().execute({ sql: 'DELETE FROM campaigns', args: [] });
    // garante que nada ficou pendente de um teste anterior
    await flushAllCampaigns();
    await getDbClient().execute({ sql: 'DELETE FROM campaigns', args: [] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('coalesce: 3 schedules → 1 pendente, nada gravado ainda', async () => {
    const s = mkCampaign('camp-x');
    scheduleSaveCampaign(s);
    scheduleSaveCampaign(s);
    scheduleSaveCampaign(s);
    expect(_pendingSaveCount()).toBe(1);
    expect(await loadCampaign('camp-x')).toBeNull(); // nada no DB antes do flush
    await flushCampaign('camp-x');
    expect(_pendingSaveCount()).toBe(0);
    expect((await loadCampaign('camp-x'))?.id).toBe('camp-x');
  });

  it('flush grava a versao MAIS RECENTE do state vivo (coalesce real)', async () => {
    const s = mkCampaign('camp-y', 'Taverna');
    scheduleSaveCampaign(s);
    s.currentLocation = 'Masmorra Profunda'; // muta o mesmo objeto depois de agendar
    scheduleSaveCampaign(s);
    await flushCampaign('camp-y');
    expect((await loadCampaign('camp-y'))?.currentLocation).toBe('Masmorra Profunda');
  });

  it('cancelScheduledSave NÃO grava (usado no delete)', async () => {
    const s = mkCampaign('camp-z');
    scheduleSaveCampaign(s);
    cancelScheduledSave('camp-z');
    expect(_pendingSaveCount()).toBe(0);
    await flushCampaign('camp-z'); // no-op
    expect(await loadCampaign('camp-z')).toBeNull();
  });

  it('flushAllCampaigns grava tudo que está pendente (shutdown)', async () => {
    scheduleSaveCampaign(mkCampaign('camp-a'));
    scheduleSaveCampaign(mkCampaign('camp-b'));
    expect(_pendingSaveCount()).toBe(2);
    await flushAllCampaigns();
    expect(_pendingSaveCount()).toBe(0);
    expect((await loadCampaign('camp-a'))?.id).toBe('camp-a');
    expect((await loadCampaign('camp-b'))?.id).toBe('camp-b');
  });

  it('o timer auto-dispara o flush depois da janela', async () => {
    vi.useFakeTimers();
    scheduleSaveCampaign(mkCampaign('camp-timer'));
    expect(_pendingSaveCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(_pendingSaveCount()).toBe(0);
    vi.useRealTimers();
    expect((await loadCampaign('camp-timer'))?.id).toBe('camp-timer');
  });
});
