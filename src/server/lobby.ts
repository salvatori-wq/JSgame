// JSgame · Lobby manager — pre-game rooms.
// Jogadores entram em lobby antes da campanha. Criam/selecionam PJ.
// Quando todos ready, host inicia → cria Campaign + emite redirect.

import type { LobbyState, LobbyPlayer, LobbyPlayerStatus } from '../shared/types.js';
import type { DmPersonality } from '../dnd/dm-personality.js';

const MAX_PLAYERS_PER_LOBBY = 6;
const LOBBY_TTL_MS = 60 * 60 * 1000; // 1h sem atividade → garbage collect

function shortId(): string {
  // 6 chars alfanuméricos (case-insensitive na lookup)
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class LobbyManager {
  private lobbies = new Map<string, LobbyState>();
  private socketToLobby = new Map<string, string>();
  private gcTimer: NodeJS.Timeout | undefined;

  constructor() {
    // GC a cada 10min de lobbies inativos
    this.gcTimer = setInterval(() => this.garbageCollect(), 10 * 60 * 1000);
  }

  destroy(): void {
    if (this.gcTimer) clearInterval(this.gcTimer);
  }

  private garbageCollect(): void {
    const now = Date.now();
    for (const [id, lobby] of this.lobbies) {
      if (now - lobby.createdAt > LOBBY_TTL_MS && lobby.players.length === 0) {
        this.lobbies.delete(id);
      }
    }
  }

  createLobby(socketId: string, ownerName: string): LobbyState {
    const id = this.generateUniqueId();
    const now = Date.now();
    const host: LobbyPlayer = {
      socketId,
      ownerName: ownerName.trim() || 'Anônimo',
      status: 'joined',
      isHost: true,
      joinedAt: now,
    };
    const lobby: LobbyState = {
      id,
      hostSocketId: socketId,
      players: [host],
      createdAt: now,
    };
    this.lobbies.set(id, lobby);
    this.socketToLobby.set(socketId, id);
    return lobby;
  }

  joinLobby(socketId: string, lobbyId: string, ownerName: string): { ok: boolean; lobby?: LobbyState; reason?: string } {
    const normalizedId = lobbyId.trim().toUpperCase();
    const lobby = this.lobbies.get(normalizedId);
    if (!lobby) return { ok: false, reason: 'lobby não encontrado' };
    if (lobby.campaignId) return { ok: false, reason: 'lobby já virou campanha' };
    if (lobby.players.length >= MAX_PLAYERS_PER_LOBBY) return { ok: false, reason: 'lobby cheio' };

    // Se mesmo socket já está, ignora
    if (lobby.players.some((p) => p.socketId === socketId)) {
      return { ok: true, lobby };
    }

    const player: LobbyPlayer = {
      socketId,
      ownerName: ownerName.trim() || 'Anônimo',
      status: 'joined',
      isHost: false,
      joinedAt: Date.now(),
    };
    lobby.players.push(player);
    this.socketToLobby.set(socketId, normalizedId);
    return { ok: true, lobby };
  }

  leaveLobby(socketId: string): LobbyState | null {
    const lobbyId = this.socketToLobby.get(socketId);
    if (!lobbyId) return null;
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      this.socketToLobby.delete(socketId);
      return null;
    }
    lobby.players = lobby.players.filter((p) => p.socketId !== socketId);
    this.socketToLobby.delete(socketId);

    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
      return null;
    }

    // Se host saiu, promove próximo
    if (lobby.hostSocketId === socketId) {
      const newHost = lobby.players[0]!;
      newHost.isHost = true;
      lobby.hostSocketId = newHost.socketId;
    }
    return lobby;
  }

  updateStatus(
    socketId: string,
    status: LobbyPlayerStatus,
    characterId?: string,
    characterName?: string,
    wizardStep?: string,
  ): LobbyState | null {
    const lobbyId = this.socketToLobby.get(socketId);
    if (!lobbyId) return null;
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.status = status;
    if (characterId !== undefined) player.characterId = characterId;
    if (characterName !== undefined) player.characterName = characterName;
    if (wizardStep !== undefined) player.wizardStep = wizardStep;
    if (status === 'ready' && !player.characterId) {
      // Não pode estar ready sem PJ
      player.status = 'selecting';
    }
    return lobby;
  }

  // Host inicia campanha — todos os players precisam estar ready.
  // Retorna lobby com campaignId setado.
  startCampaign(socketId: string, newCampaignId: string): { ok: boolean; lobby?: LobbyState; reason?: string } {
    const lobbyId = this.socketToLobby.get(socketId);
    if (!lobbyId) return { ok: false, reason: 'não está em lobby' };
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, reason: 'lobby não encontrado' };
    if (lobby.hostSocketId !== socketId) return { ok: false, reason: 'só o host pode iniciar' };
    if (lobby.campaignId) return { ok: false, reason: 'campanha já iniciada' };

    const notReady = lobby.players.filter((p) => p.status !== 'ready');
    if (notReady.length > 0) {
      return { ok: false, reason: `${notReady.map((p) => p.ownerName).join(', ')} ainda não está pronto(s)` };
    }
    if (lobby.players.length < 1) return { ok: false, reason: 'lobby vazio' };

    lobby.campaignId = newCampaignId;
    return { ok: true, lobby };
  }

  // 1C — Host (e só ele) muda personality do DM antes de começar.
  setPersonality(socketId: string, dmPersonality: DmPersonality): { ok: boolean; lobby?: LobbyState; reason?: string } {
    const lobbyId = this.socketToLobby.get(socketId);
    if (!lobbyId) return { ok: false, reason: 'não está em lobby' };
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, reason: 'lobby não encontrado' };
    if (lobby.hostSocketId !== socketId) return { ok: false, reason: 'só o host pode mudar personality' };
    if (lobby.campaignId) return { ok: false, reason: 'campanha já iniciada' };
    lobby.dmPersonality = dmPersonality;
    return { ok: true, lobby };
  }

  getLobby(socketId: string): LobbyState | null {
    const lobbyId = this.socketToLobby.get(socketId);
    if (!lobbyId) return null;
    return this.lobbies.get(lobbyId) ?? null;
  }

  getLobbyById(lobbyId: string): LobbyState | null {
    return this.lobbies.get(lobbyId.trim().toUpperCase()) ?? null;
  }

  // Lista todos os socketIds de um lobby (pra broadcast)
  getSocketsInLobby(lobbyId: string): string[] {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return [];
    return lobby.players.map((p) => p.socketId);
  }

  private generateUniqueId(): string {
    for (let i = 0; i < 10; i++) {
      const candidate = shortId();
      if (!this.lobbies.has(candidate)) return candidate;
    }
    // Fallback: timestamp-based
    return shortId() + Date.now().toString(36).slice(-2).toUpperCase();
  }
}
