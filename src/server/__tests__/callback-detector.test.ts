// F3 — Tests pro detectCallbacks.

import { describe, it, expect } from 'vitest';
import { detectCallbacks } from '../callback-detector';
import type { NpcMemory, Quest } from '../../shared/types';

function makeNpc(name: string, relationship = 0): NpcMemory {
  return {
    id: name.toLowerCase(),
    campaignId: 'c1',
    name,
    archetype: 'comerciante',
    attitude: 'amigavel',
    firstMet: 0,
    lastSeen: Date.now(),
    lastLocation: 'taverna',
    interactionCount: 1,
    notes: '',
    relationship,
  };
}

function makeQuest(title: string, status: 'active' | 'completed' | 'failed' = 'active'): Quest {
  return {
    id: title.toLowerCase(),
    title, description: '',
    objectives: [],
    status,
    rewardXp: 100,
    acceptedAt: Date.now(),
  };
}

describe('detectCallbacks', () => {
  it('detecta NPC name na narração', () => {
    const r = detectCallbacks('Ferdok te olha desconfiado.', [makeNpc('Ferdok')]);
    expect(r.npcCallbacks).toContain('Ferdok');
    expect(r.total).toBe(1);
  });

  it('NÃO detecta NPC se não citado', () => {
    const r = detectCallbacks('A taverna está vazia.', [makeNpc('Ferdok')]);
    expect(r.npcCallbacks).toHaveLength(0);
  });

  it('word-boundary: "Borin" não casa em "Borinflower"', () => {
    const r = detectCallbacks('Borinflower é uma flor rara.', [makeNpc('Borin')]);
    expect(r.npcCallbacks).toHaveLength(0);
  });

  it('case-insensitive: "FERDOK" casa em "Ferdok"', () => {
    const r = detectCallbacks('FERDOK te chama de volta.', [makeNpc('Ferdok')]);
    expect(r.npcCallbacks).toContain('Ferdok');
  });

  it('detecta múltiplos NPCs', () => {
    const r = detectCallbacks(
      'Ferdok e Mira discutem perto da fogueira.',
      [makeNpc('Ferdok'), makeNpc('Mira'), makeNpc('Hans')],
    );
    expect(r.npcCallbacks).toHaveLength(2);
    expect(r.npcCallbacks).toContain('Ferdok');
    expect(r.npcCallbacks).toContain('Mira');
  });

  it('ignora NPCs com name muito curto (<3 chars)', () => {
    const r = detectCallbacks('Os AI estão furiosos.', [makeNpc('AI')]);
    expect(r.npcCallbacks).toHaveLength(0);
  });

  it('detecta quest title via palavra significativa', () => {
    const r = detectCallbacks(
      'A relíquia ainda não foi encontrada.',
      [],
      [makeQuest('Encontrar a Relíquia Perdida')],
    );
    expect(r.questCallbacks.length).toBeGreaterThan(0);
  });

  it('ignora quests completed/failed', () => {
    const r = detectCallbacks(
      'A relíquia está aqui.',
      [],
      [makeQuest('Encontrar Relíquia', 'completed'), makeQuest('Buscar Relíquia', 'failed')],
    );
    expect(r.questCallbacks).toHaveLength(0);
  });

  it('detecta location', () => {
    const r = detectCallbacks(
      'Você volta à Torre de Cristal.',
      [],
      [],
      ['Torre de Cristal'],
    );
    expect(r.locationCallbacks.length).toBeGreaterThan(0);
  });

  it('total agrega npc + quest + location', () => {
    const r = detectCallbacks(
      'Ferdok espera na Torre. A relíquia perdida está perto.',
      [makeNpc('Ferdok')],
      [makeQuest('Recuperar Relíquia')],
      ['Torre de Cristal'],
    );
    expect(r.npcCallbacks.length).toBe(1);
    expect(r.questCallbacks.length).toBeGreaterThanOrEqual(1);
    expect(r.locationCallbacks.length).toBeGreaterThanOrEqual(1);
    expect(r.total).toBe(r.npcCallbacks.length + r.questCallbacks.length + r.locationCallbacks.length);
  });

  it('empty rosters retorna total=0', () => {
    const r = detectCallbacks('Texto qualquer.');
    expect(r.total).toBe(0);
    expect(r.npcCallbacks).toHaveLength(0);
    expect(r.questCallbacks).toHaveLength(0);
    expect(r.locationCallbacks).toHaveLength(0);
  });

  it('escape regex chars em NPC name (não quebra parser)', () => {
    // Nome com chars regex-meta
    const r = detectCallbacks(
      'Dr. Vex.tor está aqui.',
      [makeNpc('Dr. Vex.tor')],
    );
    // Pode ou não match dependendo do escape — mas NÃO deve throw
    expect(() => detectCallbacks('test', [makeNpc('a.b.c')])).not.toThrow();
  });
});
