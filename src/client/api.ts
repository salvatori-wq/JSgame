// JSgame · Client API helpers. Fetch tipado pros endpoints REST.

import type { CharacterSheet, MemoryFact, MemoryFactKind } from '../shared/types';
import type { CharacterSummary } from '../server/persistence';

export interface ApiHealth {
  ok: boolean;
  service?: string;
  uptime?: number;
  dmProvider?: string;
  hasGroq?: boolean;
  hasAnthropic?: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<ApiHealth> {
  return fetchJson<ApiHealth>('/api/health');
}

export async function listCharacters(ownerName: string): Promise<CharacterSummary[]> {
  const data = await fetchJson<{ characters: CharacterSummary[] }>(
    `/api/characters?owner=${encodeURIComponent(ownerName)}`,
  );
  return data.characters;
}

export async function getCharacter(id: string): Promise<CharacterSheet> {
  const data = await fetchJson<{ character: CharacterSheet }>(`/api/characters/${encodeURIComponent(id)}`);
  return data.character;
}

export async function saveCharacter(sheet: CharacterSheet): Promise<{ ok: boolean; id: string }> {
  return fetchJson<{ ok: boolean; id: string }>('/api/characters', {
    method: 'POST',
    body: JSON.stringify(sheet),
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  await fetchJson<{ ok: boolean }>(`/api/characters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface CampaignSummary {
  id: string;
  name: string;
  sessionNumber: number;
  lastPlayedAt: number;
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const data = await fetchJson<{ campaigns: CampaignSummary[] }>('/api/campaigns');
  return data.campaigns;
}

// Memória RAG da campanha — debug/UI. Filtros opcionais.
export async function getCampaignMemory(
  campaignId: string,
  opts: { q?: string; kinds?: MemoryFactKind[]; limit?: number } = {},
): Promise<{ facts: MemoryFact[]; total: number }> {
  const qs = new URLSearchParams();
  if (opts.q) qs.set('q', opts.q);
  if (opts.kinds && opts.kinds.length > 0) qs.set('kind', opts.kinds.join(','));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const url = `/api/campaigns/${encodeURIComponent(campaignId)}/memory${qs.toString() ? '?' + qs.toString() : ''}`;
  return fetchJson<{ facts: MemoryFact[]; total: number }>(url);
}
