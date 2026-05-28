// α.1 — Tests suggest_actions tool (validator + handler + integration).
//
// Cobre:
//   - Validator: clamp 4, normalize action enum, fallback 'custom', rejeita vazio.
//   - Handler: salva em state.suggestedActions.
//   - Integration: applyDMResponse reseta antes de processar tools.

import { describe, it, expect, beforeEach } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string, name: string): CharacterSheet {
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
  };
}

describe('α.1 — validateToolCall suggest_actions', () => {
  it('valida 2-4 ações corretamente', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {
        actions: [
          { label: 'Examinar corpo', action: 'investigate', details: 'olhar marcas no pescoço' },
          { label: 'Falar com guarda', action: 'talk', hint: 'Persuasão', details: 'perguntar se viu alguém' },
        ],
      },
    });
    expect(r?.kind).toBe('suggest_actions');
    if (r?.kind === 'suggest_actions') {
      expect(r.actions).toHaveLength(2);
      expect(r.actions[0]!.label).toBe('Examinar corpo');
      expect(r.actions[0]!.action).toBe('investigate');
      expect(r.actions[1]!.hint).toBe('Persuasão');
    }
  });

  // W3.6 — Sprint W: clamp em 3 (era 4). Consultor D&D: "PHB DM Style Guide
  // pede 3 ou menos pra manter peso narrativo. Chips em quantidade = menu
  // RPG japonês".
  it('clampa a 3 itens (W3.6)', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {
        actions: Array.from({ length: 7 }, (_, i) => ({
          label: `A${i}`, action: 'explore', details: `det ${i}`,
        })),
      },
    });
    expect(r?.kind === 'suggest_actions' && r.actions).toHaveLength(3);
  });

  it('normaliza action inválido pra "custom"', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {
        actions: [{ label: 'X', action: 'fly-to-moon', details: 'eu voo' }],
      },
    });
    expect(r?.kind === 'suggest_actions' && r.actions[0]!.action).toBe('custom');
  });

  it('rejeita array vazio', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: { actions: [] },
    });
    expect(r).toBeNull();
  });

  it('rejeita input sem actions array', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {},
    });
    expect(r).toBeNull();
  });

  it('filtra ações sem label ou details', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {
        actions: [
          { label: 'OK', action: 'explore', details: 'detalhes' },
          { label: '', action: 'explore', details: 'sem label' },
          { label: 'Sem details', action: 'explore', details: '' },
        ],
      },
    });
    expect(r?.kind === 'suggest_actions' && r.actions).toHaveLength(1);
  });

  it('limita label a 40 chars e details a 200', () => {
    const r = validateToolCall({
      name: 'suggest_actions',
      input: {
        actions: [{
          label: 'a'.repeat(100),
          action: 'explore',
          details: 'd'.repeat(500),
        }],
      },
    });
    if (r?.kind === 'suggest_actions') {
      expect(r.actions[0]!.label.length).toBeLessThanOrEqual(40);
      expect(r.actions[0]!.details.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('α.1 — Campaign suggest_actions handler', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(fakeDM, { id: 'camp-test', name: 'Test' });
    camp.addCharacter(makePJ('pj-1', 'Borin'));
  });

  it('handler salva ações em state.suggestedActions', () => {
    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'suggest_actions',
      actions: [
        { label: 'Lutar', action: 'attack', details: 'investir contra o orc' },
        { label: 'Fugir', action: 'sneak', details: 'usar a saída lateral' },
      ],
    });
    expect(camp.state.suggestedActions).toHaveLength(2);
    expect(camp.state.suggestedActions![0]!.label).toBe('Lutar');
  });

  it('handler sobrescreve sugestões anteriores (não acumula)', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    apply({ kind: 'suggest_actions', actions: [{ label: 'A1', action: 'explore', details: 'd' }] });
    apply({ kind: 'suggest_actions', actions: [{ label: 'B1', action: 'talk', details: 'd' }, { label: 'B2', action: 'sneak', details: 'd' }] });
    expect(camp.state.suggestedActions).toHaveLength(2);
    expect(camp.state.suggestedActions![0]!.label).toBe('B1');
  });

  it('applyDMResponse reseta chips antigos + injeta fallback se DM não chamou suggest_actions', async () => {
    // Setup: chips de "cena anterior" no state
    camp.state.suggestedActions = [{ label: 'Velho', action: 'explore', details: 'velho' }];

    // DMResponse SEM suggest_actions tool — chips "velhos" somem,
    // mas fallback contextual entra (player NUNCA fica sem opções).
    const apply = (camp as unknown as { applyDMResponse: (r: DMResponse) => void }).applyDMResponse.bind(camp);
    apply({ narration: 'cena nova', speaker: 'Mestre', toolCalls: [], raw: '' });

    const chips = camp.state.suggestedActions ?? [];
    // Chip "Velho" desapareceu (não acumula)
    expect(chips.find((c) => c.label === 'Velho')).toBeUndefined();
    // Fallback exploration entrou (4 chips genéricos)
    expect(chips.length).toBe(4);
    expect(chips.some((c) => c.label === 'Observar arredores')).toBe(true);
  });

  it('applyDMResponse sobrescreve chips quando DM manda novo suggest_actions', () => {
    camp.state.suggestedActions = [{ label: 'Velho', action: 'explore', details: 'velho' }];

    const apply = (camp as unknown as { applyDMResponse: (r: DMResponse) => void }).applyDMResponse.bind(camp);
    apply({
      narration: 'cena nova',
      speaker: 'Mestre',
      toolCalls: [{
        name: 'suggest_actions',
        input: {
          actions: [
            { label: 'Novo1', action: 'investigate', details: 'novo1' },
            { label: 'Novo2', action: 'talk', details: 'novo2' },
          ],
        },
      }],
      raw: '',
    });

    expect(camp.state.suggestedActions).toHaveLength(2);
    expect(camp.state.suggestedActions![0]!.label).toBe('Novo1');
  });
});
