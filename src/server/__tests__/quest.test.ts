// Tests F18 — Quest tracking via DM tools.
// Cobre: validação tools.ts + handler campaign.ts (set/update/complete).

import { describe, it, expect, beforeEach } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

// DM fake — não chama LLM, retorna narração canned
class FakeDM implements DMInterface {
  async narrate(): Promise<DMResponse> {
    return { narration: 'fake', speaker: 'Mestre', toolCalls: [] };
  }
  async summarize(): Promise<string | null> { return null; }
}

function makePJ(id: string, name: string, overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: ['Comum'], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...overrides,
  };
}

describe('F18 — validateToolCall set_quest', () => {
  it('valida estrutura mínima', () => {
    const r = validateToolCall({
      name: 'set_quest',
      input: {
        questId: 'salvar-vila',
        title: 'Salvar a vila',
        description: 'Goblins atacam a vila ao norte.',
        objectives: [{ id: 'obj-1', description: 'Eliminar líder goblin' }],
      },
    });
    expect(r?.kind).toBe('set_quest');
    if (r?.kind === 'set_quest') {
      expect(r.objectives).toHaveLength(1);
      expect(r.rewardXp).toBe(100); // default
    }
  });

  it('rejeita quest sem objetivos', () => {
    const r = validateToolCall({
      name: 'set_quest',
      input: { questId: 'x', title: 't', description: 'd', objectives: [] },
    });
    expect(r).toBeNull();
  });

  it('rejeita quest sem título', () => {
    const r = validateToolCall({
      name: 'set_quest',
      input: { questId: 'x', title: '', description: 'd', objectives: [{ id: 'a', description: 'X' }] },
    });
    expect(r).toBeNull();
  });

  it('clampa rewardXp', () => {
    const r = validateToolCall({
      name: 'set_quest',
      input: {
        questId: 'x', title: 't', description: 'd',
        objectives: [{ id: 'a', description: 'X' }],
        rewardXp: 99999,
      },
    });
    expect(r?.kind === 'set_quest' && r.rewardXp).toBe(10000);
  });

  it('limita 8 objetivos', () => {
    const objs = Array.from({ length: 15 }, (_, i) => ({ id: `o${i}`, description: `obj${i}` }));
    const r = validateToolCall({
      name: 'set_quest',
      input: { questId: 'x', title: 't', description: 'd', objectives: objs },
    });
    expect(r?.kind === 'set_quest' && r.objectives.length).toBe(8);
  });

  it('gera questId se não fornecido', () => {
    const r = validateToolCall({
      name: 'set_quest',
      input: {
        title: 't', description: 'd',
        objectives: [{ id: 'a', description: 'X' }],
      },
    });
    expect(r?.kind === 'set_quest' && r.questId.length).toBeGreaterThan(0);
  });
});

describe('F18 — validateToolCall update_objective', () => {
  it('valida com done=true default', () => {
    const r = validateToolCall({
      name: 'update_objective',
      input: { questId: 'q1', objectiveId: 'obj-1' },
    });
    expect(r?.kind === 'update_objective' && r.done).toBe(true);
  });

  it('respeita done=false', () => {
    const r = validateToolCall({
      name: 'update_objective',
      input: { questId: 'q1', objectiveId: 'obj-1', done: false },
    });
    expect(r?.kind === 'update_objective' && r.done).toBe(false);
  });

  it('rejeita sem questId', () => {
    const r = validateToolCall({
      name: 'update_objective',
      input: { objectiveId: 'obj-1' },
    });
    expect(r).toBeNull();
  });
});

describe('F18 — validateToolCall complete_quest', () => {
  it('valida success', () => {
    const r = validateToolCall({
      name: 'complete_quest',
      input: { questId: 'q1', outcome: 'success', summary: 'Vila salva.' },
    });
    expect(r?.kind === 'complete_quest' && r.outcome).toBe('success');
  });

  it('valida failure', () => {
    const r = validateToolCall({
      name: 'complete_quest',
      input: { questId: 'q1', outcome: 'failure', summary: 'Vila caiu.' },
    });
    expect(r?.kind === 'complete_quest' && r.outcome).toBe('failure');
  });

  it('outcome inválido cai pra success', () => {
    const r = validateToolCall({
      name: 'complete_quest',
      input: { questId: 'q1', outcome: 'lulz', summary: 's' },
    });
    expect(r?.kind === 'complete_quest' && r.outcome).toBe('success');
  });
});

describe('F18 — Campaign quest lifecycle', () => {
  let camp: Campaign;
  let pj: CharacterSheet;

  beforeEach(() => {
    camp = new Campaign(new FakeDM(), { id: 'camp-test', name: 'Test' });
    pj = makePJ('pj-1', 'Borin');
    camp.addCharacter(pj);
    camp['narrationLog'] = [];
  });

  it('set_quest adiciona quest ativa em CampaignState.quests', () => {
    // Acessa applyValidatedTool via método privado (test internals)
    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'set_quest',
      questId: 'q1',
      title: 'Salvar Vila',
      description: 'Goblins atacam.',
      objectives: [
        { id: 'o1', description: 'Achar acampamento' },
        { id: 'o2', description: 'Eliminar líder' },
      ],
      rewardXp: 300,
      giver: 'Anciã',
    });
    expect(camp.state.quests).toHaveLength(1);
    const q = camp.state.quests![0]!;
    expect(q.title).toBe('Salvar Vila');
    expect(q.status).toBe('active');
    expect(q.objectives).toHaveLength(2);
    expect(q.objectives[0]!.done).toBe(false);
  });

  it('set_quest com mesmo ID atualiza ao invés de duplicar', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V1', description: 'D1',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 100,
    });
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V2 update', description: 'D2',
      objectives: [{ id: 'o1', description: 'A modificado' }, { id: 'o2', description: 'B' }],
      rewardXp: 200,
    });
    expect(camp.state.quests).toHaveLength(1);
    const q = camp.state.quests![0]!;
    expect(q.title).toBe('V2 update');
    expect(q.objectives).toHaveLength(2);
  });

  it('set_quest com mesmo ID preserva flag done de objetivos existentes', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 100,
    });
    apply({ kind: 'update_objective', questId: 'q1', objectiveId: 'o1', done: true });
    expect(camp.state.quests![0]!.objectives[0]!.done).toBe(true);

    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }, { id: 'o2', description: 'B' }],
      rewardXp: 100,
    });
    expect(camp.state.quests![0]!.objectives[0]!.done).toBe(true); // preservado
    expect(camp.state.quests![0]!.objectives[1]!.done).toBe(false); // novo
  });

  it('update_objective marca objetivo como feito', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 100,
    });
    apply({ kind: 'update_objective', questId: 'q1', objectiveId: 'o1', done: true });
    expect(camp.state.quests![0]!.objectives[0]!.done).toBe(true);
  });

  it('update_objective com done=false desfaz', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 100,
    });
    apply({ kind: 'update_objective', questId: 'q1', objectiveId: 'o1', done: true });
    apply({ kind: 'update_objective', questId: 'q1', objectiveId: 'o1', done: false });
    expect(camp.state.quests![0]!.objectives[0]!.done).toBe(false);
  });

  it('update_objective em quest completa não faz nada', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 100,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 'feito' });
    apply({ kind: 'update_objective', questId: 'q1', objectiveId: 'o1', done: false });
    // Quest completed, objetivo não pode ser desfeito
    expect(camp.state.quests![0]!.status).toBe('completed');
  });

  it('complete_quest success distribui XP', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 300,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 'feito!' });
    expect(camp.state.quests![0]!.status).toBe('completed');
    // PJ vivo solo recebe todo o XP
    expect(pj.xp).toBe(300);
    expect(pj.level).toBe(2); // 300 XP → nível 2
  });

  it('complete_quest failure NÃO distribui XP', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 300,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'failure', summary: 'fudeu' });
    expect(camp.state.quests![0]!.status).toBe('failed');
    expect(pj.xp).toBe(0);
  });

  it('complete_quest 2x não duplica XP', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 300,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 's' });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 's' });
    expect(pj.xp).toBe(300); // não duplicou
  });

  it('complete_quest com 2 PJs vivos divide XP', () => {
    const pj2 = makePJ('pj-2', 'Lyra');
    camp.addCharacter(pj2);
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 600,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 's' });
    expect(pj.xp).toBe(300);
    expect(pj2.xp).toBe(300);
  });

  it('complete_quest com PJ caído não dá XP pro caído', () => {
    const pj2 = makePJ('pj-2', 'Lyra', { currentHp: 0 });
    camp.addCharacter(pj2);
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({
      kind: 'set_quest', questId: 'q1', title: 'V', description: 'D',
      objectives: [{ id: 'o1', description: 'A' }], rewardXp: 600,
    });
    apply({ kind: 'complete_quest', questId: 'q1', outcome: 'success', summary: 's' });
    expect(pj.xp).toBe(600);  // PJ vivo solo
    expect(pj2.xp).toBe(0);
  });
});
