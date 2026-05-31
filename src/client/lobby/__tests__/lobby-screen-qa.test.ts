// @vitest-environment happy-dom
// QA-lançamento — Ciclo Coop (F). Guards dos fixes do Caça-Jargão na sala:
//  - a sala NÃO escutava 'error' → código errado deixava o jogador travado em
//    "Conectando…" sem feedback (reproduzido: o server emite 'lobby não encontrado').
//  - jargão na UI da sala: "No wizard", "passo level4" (slug cru), título "Lobby".

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../toast', () => ({ showToast: vi.fn() }));
vi.mock('../../api', () => ({ listCharacters: vi.fn(async () => []) }));
import { showToast } from '../../toast';
import { LobbyScreen } from '../lobby-screen';
import type { LobbyState } from '../../../shared/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
function stubSocket() {
  const h: Record<string, (...a: unknown[]) => void> = {};
  return {
    id: 'sock-me',
    on: (e: string, f: (...a: unknown[]) => void) => { h[e] = f; },
    off: () => {},
    emit: () => {},
    fire: (e: string, ...a: unknown[]) => h[e]?.(...a),
    has: (e: string) => typeof h[e] === 'function',
  };
}

function mkLobby(): LobbyState {
  return {
    id: 'ABC123', hostSocketId: 'sock-me', createdAt: 0,
    players: [
      { socketId: 'sock-me', ownerName: 'Alice', status: 'ready', isHost: true, joinedAt: 0, characterId: 'c1', characterName: 'Lyra' },
      { socketId: 'sock-bob', ownerName: 'Bob', status: 'wizard', isHost: false, joinedAt: 0, wizardStep: 'level4' },
    ],
  } as LobbyState;
}

function mkScreen(socket: any, onExit: () => void = () => {}) {
  return new LobbyScreen(document.createElement('div'), {
    socket, ownerName: 'Alice', onCampaignStart: () => {}, onCreateCharacter: () => {}, onExit,
  } as any);
}

describe('QA-lançamento Coop — lobby-screen', () => {
  beforeEach(() => {
    (showToast as any).mockClear();
    document.body.innerHTML = '';
  });

  it('agora ESCUTA "error" do servidor (antes a sala engolia o erro)', async () => {
    const socket = stubSocket();
    const screen = mkScreen(socket);
    await screen.start();
    expect(socket.has('error')).toBe(true);
  });

  it('código errado → toast humanizado (sem "lobby") + volta pra home', async () => {
    const socket = stubSocket();
    let exited = false;
    const screen = mkScreen(socket, () => { exited = true; });
    await screen.start();
    socket.fire('error', 'lobby não encontrado'); // string crua que o server emite
    expect(showToast).toHaveBeenCalledTimes(1);
    const arg = (showToast as any).mock.calls[0][0];
    expect(arg.message).toContain('sala');
    expect(arg.message).not.toContain('lobby');
    expect(arg.kind).toBe('error');
    expect(exited).toBe(true);
  });

  it('UI da sala PT-BR: "Sala" / "Criando PJ" / "passo Talento" (sem slug/jargão)', async () => {
    const socket = stubSocket();
    const container = document.createElement('div');
    const screen = new LobbyScreen(container, {
      socket: socket as any, ownerName: 'Alice', onCampaignStart: () => {}, onCreateCharacter: () => {}, onExit: () => {},
    } as any);
    await screen.start();
    socket.fire('lobbyState', mkLobby());
    const txt = container.textContent ?? '';
    expect(txt).toContain('🏛 Sala');
    expect(txt).not.toContain('Lobby');
    expect(txt).toContain('Criando PJ');
    expect(txt).not.toContain('No wizard');
    expect(txt).toContain('passo Talento');
    expect(txt).not.toContain('level4');
  });
});
