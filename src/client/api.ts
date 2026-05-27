// JSgame · Client API helpers. Fetch tipado pros endpoints REST.

import type { CharacterSheet, MemoryFact, MemoryFactKind } from '../shared/types';
import type { CharacterSummary } from '../server/persistence';

export interface ApiHealth {
  ok: boolean;
  service?: string;
  uptime?: number;
  dmProvider?: string;
  activeProvider?: string;
  hasGemini?: boolean;
  hasGroq?: boolean;
  hasAnthropic?: boolean;
  hasEmail?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Auth (F15) — magic link passwordless
// ════════════════════════════════════════════════════════════════════════════

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export async function getMe(): Promise<AuthUser | null> {
  const data = await fetchJson<{ user: AuthUser | null }>('/api/auth/me', { credentials: 'include' });
  return data.user;
}

export async function requestMagicLink(email: string): Promise<{ ok: boolean; mode?: string; devLink?: string; expiresAt?: number; error?: string }> {
  return fetchJson<{ ok: boolean; mode?: string; devLink?: string; expiresAt?: number; error?: string }>('/api/auth/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
}

export async function logout(): Promise<void> {
  await fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function updateDisplayName(displayName: string): Promise<void> {
  await fetchJson<{ ok: boolean }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
    credentials: 'include',
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',  // cookie de sessão sempre enviado
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

// POLISH-0 + Sprint π — Telemetria client-side (whitelist server-side).
// Fire-and-forget — falhas não bloqueiam fluxo nem aparecem em log do user.
export function trackClientMetric(
  kind: 'home_loaded' | 'prefab_clicked' | 'bottom_tab_tap',
  payload?: Record<string, unknown>,
): void {
  try {
    void fetch('/api/metrics/track', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    }).catch(() => { /* silent — telemetria nunca quebra UX */ });
  } catch { /* fetch sync throw — também silencioso */ }
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
  // ι.2 — Preview rico
  currentLocation?: string;
  lastNarrationSnippet?: string;
  // ι.5 — Vidas em risco
  partyAnyAtRisk?: boolean;
  partyAtRiskName?: string;
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const data = await fetchJson<{ campaigns: CampaignSummary[] }>('/api/campaigns');
  return data.campaigns;
}

export async function deleteCampaign(id: string): Promise<void> {
  await fetchJson(`/api/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// F20 — Daily streak
export interface StreakDTO {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalDays: number;
}
export async function getStreak(): Promise<StreakDTO | null> {
  const data = await fetchJson<{ streak: StreakDTO | null }>('/api/streak');
  return data.streak;
}

// F20 — Highlights
export interface HighlightDTO {
  id: string;
  userId: string | null;
  campaignId: string;
  characterId: string | null;
  characterName: string | null;
  summary: string;
  kind: 'moment' | 'kill' | 'speech' | 'choice' | 'twist';
  createdAt: number;
}
export async function listHighlights(): Promise<HighlightDTO[]> {
  const data = await fetchJson<{ highlights: HighlightDTO[] }>('/api/highlights');
  return data.highlights;
}

// A4 — Friend graph
export interface FriendDTO {
  userId: string;
  displayName: string | null;
  email: string;
  status: 'pending' | 'accepted';
  iRequested: boolean;
  createdAt: number;
}
export async function listFriends(): Promise<FriendDTO[]> {
  const data = await fetchJson<{ friends: FriendDTO[] }>('/api/friends');
  return data.friends;
}
export async function requestFriendship(userId: string): Promise<void> {
  await fetchJson('/api/friends/request', { method: 'POST', body: JSON.stringify({ userId }) });
}
export async function acceptFriendship(userId: string): Promise<void> {
  await fetchJson('/api/friends/accept', { method: 'POST', body: JSON.stringify({ userId }) });
}
export async function removeFriendship(userId: string): Promise<void> {
  await fetchJson(`/api/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}
export async function inviteFriendByEmail(email: string, lobbyCode?: string): Promise<{ ok: boolean; mode: string; devLink?: string }> {
  return fetchJson<{ ok: boolean; mode: string; devLink?: string }>(
    '/api/friends/invite',
    { method: 'POST', body: JSON.stringify({ email, lobbyCode }) },
  );
}

// F19 — Tombstones (lápides) do user logado. Anon = lista vazia.
export interface TombstoneDTO {
  id: string;
  userId: string | null;
  characterId: string;
  characterName: string;
  raceId: string;
  classId: string;
  level: number;
  campaignId: string | null;
  campaignName: string | null;
  diedAt: number;
  epitaph: string;
  cause: string | null;
}
export async function listTombstones(): Promise<TombstoneDTO[]> {
  const data = await fetchJson<{ tombstones: TombstoneDTO[] }>('/api/tombstones');
  return data.tombstones;
}

// F17 — Achievements progress (precisa user logado, retorna 401 anon)
import type { Achievement } from '../dnd/achievements';
export interface AchievementStatusDTO {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt: number | null;
}
export async function getAchievementProgress(): Promise<{ progress: AchievementStatusDTO[]; counters: Record<string, number> }> {
  return fetchJson<{ progress: AchievementStatusDTO[]; counters: Record<string, number> }>('/api/achievements');
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
