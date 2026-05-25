// Tests pro LobbyManager (F10.1)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LobbyManager } from '../lobby.js';

describe('LobbyManager', () => {
  let lm: LobbyManager;

  beforeEach(() => {
    lm = new LobbyManager();
  });

  afterEach(() => {
    lm.destroy();
  });

  describe('createLobby', () => {
    it('cria lobby com host como primeiro player', () => {
      const lobby = lm.createLobby('sock-1', 'João');
      expect(lobby.id).toHaveLength(6);
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0]!.isHost).toBe(true);
      expect(lobby.players[0]!.ownerName).toBe('João');
      expect(lobby.hostSocketId).toBe('sock-1');
    });

    it('IDs únicos pra lobbies diferentes', () => {
      const l1 = lm.createLobby('s1', 'A');
      const l2 = lm.createLobby('s2', 'B');
      expect(l1.id).not.toBe(l2.id);
    });
  });

  describe('joinLobby', () => {
    it('joina segundo player', () => {
      const l = lm.createLobby('s1', 'Host');
      const r = lm.joinLobby('s2', l.id, 'Guest');
      expect(r.ok).toBe(true);
      expect(r.lobby?.players).toHaveLength(2);
      expect(r.lobby?.players[1]!.isHost).toBe(false);
    });

    it('case-insensitive no ID', () => {
      const l = lm.createLobby('s1', 'Host');
      const r = lm.joinLobby('s2', l.id.toLowerCase(), 'Guest');
      expect(r.ok).toBe(true);
    });

    it('rejeita lobby inexistente', () => {
      const r = lm.joinLobby('s1', 'XPTONO', 'X');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/não encontrado/i);
    });

    it('idempotente — mesmo socket joinando 2x não duplica', () => {
      const l = lm.createLobby('s1', 'Host');
      const r1 = lm.joinLobby('s2', l.id, 'Guest');
      const r2 = lm.joinLobby('s2', l.id, 'Guest');
      expect(r1.ok && r2.ok).toBe(true);
      expect(r2.lobby?.players).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('atualiza status com characterId', () => {
      const l = lm.createLobby('s1', 'H');
      const updated = lm.updateStatus('s1', 'ready', 'char-1', 'Borin');
      expect(updated?.players[0]!.status).toBe('ready');
      expect(updated?.players[0]!.characterId).toBe('char-1');
      expect(updated?.players[0]!.characterName).toBe('Borin');
    });

    it('ready sem characterId vira selecting', () => {
      lm.createLobby('s1', 'H');
      const updated = lm.updateStatus('s1', 'ready'); // sem characterId
      expect(updated?.players[0]!.status).toBe('selecting');
    });

    it('atualiza wizard step', () => {
      lm.createLobby('s1', 'H');
      const updated = lm.updateStatus('s1', 'wizard', undefined, undefined, 'abilities');
      expect(updated?.players[0]!.wizardStep).toBe('abilities');
    });
  });

  describe('leaveLobby', () => {
    it('remove player do lobby', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.joinLobby('s2', l.id, 'Guest');
      const after = lm.leaveLobby('s2');
      expect(after?.players).toHaveLength(1);
    });

    it('promove novo host se host sai', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.joinLobby('s2', l.id, 'Guest');
      const after = lm.leaveLobby('s1');
      expect(after?.hostSocketId).toBe('s2');
      expect(after?.players[0]!.isHost).toBe(true);
    });

    it('deleta lobby se último player sai', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.leaveLobby('s1');
      expect(lm.getLobbyById(l.id)).toBeNull();
    });
  });

  describe('startCampaign', () => {
    it('só host pode iniciar', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.joinLobby('s2', l.id, 'Guest');
      lm.updateStatus('s1', 'ready', 'c1', 'A');
      lm.updateStatus('s2', 'ready', 'c2', 'B');
      const fromGuest = lm.startCampaign('s2', 'camp-1');
      expect(fromGuest.ok).toBe(false);
      expect(fromGuest.reason).toMatch(/host/i);
    });

    it('rejeita se algum player não ready', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.joinLobby('s2', l.id, 'Guest');
      lm.updateStatus('s1', 'ready', 'c1', 'A');
      // s2 não ready
      const r = lm.startCampaign('s1', 'camp-1');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/Guest/);
    });

    it('inicia campanha quando todos ready', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.joinLobby('s2', l.id, 'Guest');
      lm.updateStatus('s1', 'ready', 'c1', 'A');
      lm.updateStatus('s2', 'ready', 'c2', 'B');
      const r = lm.startCampaign('s1', 'camp-1');
      expect(r.ok).toBe(true);
      expect(r.lobby?.campaignId).toBe('camp-1');
    });

    it('rejeita segunda chamada', () => {
      const l = lm.createLobby('s1', 'Host');
      lm.updateStatus('s1', 'ready', 'c1', 'A');
      lm.startCampaign('s1', 'camp-1');
      const r2 = lm.startCampaign('s1', 'camp-2');
      expect(r2.ok).toBe(false);
    });
  });
});
