// JSgame · Client API helpers. Fetch tipado pros endpoints REST.

import type { CharacterSheet } from '@shared/types';
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
