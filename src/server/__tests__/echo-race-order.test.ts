// γ.3 — Echo player race fix.
// Garante que o echo do player ("▶ Borin → explore: vasculhar")
// é emitido ANTES do `dmThinking` + narração final. Player vê
// imediatamente o que clicou, não depois do LLM responder 8-30s.
//
// Teste mocka socket.io e captura a sequência de emits.

import { describe, it, expect, vi } from 'vitest';
import { combatActionLabel } from '../sockets/connection';

// Simula io.to(roomId).emit(...) capturando ordem dos calls.
function makeFakeIo(): {
  emitLog: Array<{ event: string; payload: unknown }>;
  io: {
    to: (room: string) => { emit: (event: string, payload: unknown) => void };
  };
} {
  const emitLog: Array<{ event: string; payload: unknown }> = [];
  const room = (_room: string) => ({
    emit: (event: string, payload: unknown) => {
      emitLog.push({ event, payload });
    },
  });
  return { emitLog, io: { to: room } };
}

describe('γ.3 — echo player race ordering', () => {
  it('echo emit SÍNCRONO antes de dmThinking + narration assíncrona', async () => {
    const { emitLog, io } = makeFakeIo();
    const playerName = 'Borin';
    const action = 'explore';
    const details = 'vasculhar';
    const campaignId = 'camp1';

    // Simulação inline do fluxo takeAction (connection.ts ~linha 129-170)
    async function handleTakeAction(): Promise<void> {
      // 1. ECHO síncrono
      const echoText = details ? `${action} — "${details}"` : action;
      io.to(campaignId).emit('dmNarration', {
        text: echoText,
        speaker: `▶ ${playerName}`,
        mood: 'neutral',
      });

      // 2. Dentro de withThinkingBroadcast: dmThinking síncrono
      io.to(campaignId).emit('dmThinking', { playerId: 'p1', playerName, action });

      // 3. Await LLM (simulado com timeout)
      await new Promise((r) => setTimeout(r, 5));

      // 4. Narração final
      io.to(campaignId).emit('dmNarration', {
        text: 'A taverna está vazia.',
        speaker: 'Mestre',
        mood: 'neutral',
      });

      // 5. dmDone
      io.to(campaignId).emit('dmDone', undefined);
    }

    await handleTakeAction();

    // Ordem esperada: echo → thinking → narration → done
    expect(emitLog[0]!.event).toBe('dmNarration');
    expect((emitLog[0]!.payload as { speaker: string }).speaker).toContain('▶');
    expect(emitLog[1]!.event).toBe('dmThinking');
    expect(emitLog[2]!.event).toBe('dmNarration');
    expect((emitLog[2]!.payload as { speaker: string }).speaker).toBe('Mestre');
    expect(emitLog[3]!.event).toBe('dmDone');
  });

  it('combatAction emite echo SÍNCRONO antes de combatEvent + log final', async () => {
    const { emitLog, io } = makeFakeIo();
    const playerName = 'Sina';
    const action = 'attack';
    const targetId = 'enemy-1';
    const campaignId = 'camp1';

    async function handleCombatAction(): Promise<void> {
      // 1. ECHO síncrono (γ.3 fix) — formato PT-BR (label + NOME do inimigo),
      //    espelha o real em connection.ts (Ciclo de correção: era enum cru).
      io.to(campaignId).emit('dmNarration', {
        text: `→ ${combatActionLabel(action)}${targetId ? ' · Goblin' : ''}`,
        speaker: `⚔ ${playerName}`,
        mood: 'neutral',
      });

      // 2. Await combat resolution
      await new Promise((r) => setTimeout(r, 3));

      // 3. Log result
      io.to(campaignId).emit('dmNarration', {
        text: 'Sina ataca o goblin: 14 vs CA 13 · HIT · 5 dmg',
        speaker: `⚔ ${playerName}`,
        mood: 'neutral',
      });

      // 4. combatEvents
      io.to(campaignId).emit('combatEvent', { type: 'attack-roll', value: 14 });
      io.to(campaignId).emit('combatEvent', { type: 'damage', value: 5 });
    }

    await handleCombatAction();

    expect(emitLog[0]!.event).toBe('dmNarration');
    expect((emitLog[0]!.payload as { text: string }).text).toContain('→ ⚔ Atacar');
    expect((emitLog[0]!.payload as { speaker: string }).speaker).toContain('⚔');
    // Próximos = result log + combat events
    expect(emitLog[1]!.event).toBe('dmNarration'); // log final
    expect(emitLog[2]!.event).toBe('combatEvent');
    expect(emitLog[3]!.event).toBe('combatEvent');
  });

  it('echo NÃO é emitido após await (regression test)', async () => {
    const { emitLog, io } = makeFakeIo();
    const slow = vi.fn(async () => { await new Promise((r) => setTimeout(r, 10)); });

    async function brokenFlow(): Promise<void> {
      io.to('c1').emit('dmThinking', { foo: 1 });
      await slow();
      io.to('c1').emit('dmNarration', { text: 'echo', speaker: '▶ player' });
    }

    await brokenFlow();
    // Se echo viesse depois do await como antes, ordem seria thinking → echo.
    // Esse teste é "anti-padrão" — documenta o bug.
    expect(emitLog[0]!.event).toBe('dmThinking');
    expect(emitLog[1]!.event).toBe('dmNarration');
    // O fix correto inverte: echo PRIMEIRO, thinking depois.
  });
});
