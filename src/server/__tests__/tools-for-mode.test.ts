// Fase 2e — Tool-set por modo + estado (getToolsForContext).
// As 25 tool defs (~5.6k tokens) iam TODAS em TODA chamada do DM. Agora:
// combate recebe o set enxuto (sem start_combat/open_shop/set_quest...),
// exploração não recebe end_combat_with_outcome/enemy_casts_spell, e tools de
// estado (update_objective/complete_quest/tick_clock/mark_npc_secret/
// reveal_npc_secret) só entram quando o estado correspondente existe.
// Validação server-side (tools.ts) segue cobrindo TODAS — tool alucinada fora
// do set declarado continua sendo dropada.

import { describe, it, expect } from 'vitest';
import { DM_TOOLS, getToolsForContext } from '../dm/prompts.js';
import { DungeonMaster } from '../dm/dm.js';
import type { DMProvider, DMRawResponse, GenerateOpts } from '../dm/providers/base.js';
import type { CampaignState, Quest } from '../../shared/types.js';
import { makeCharacterSheet } from '../../test/factories.js';

function mkCampaign(over: Partial<CampaignState> = {}): CampaignState {
  return {
    id: 'camp', name: 'Test', mode: 'exploration',
    partyCharacterIds: ['pj'],
    currentLocation: 'Taverna do Dragão Caolho',
    currentSceneDescription: '',
    worldFlags: {},
    npcsMet: [],
    recentEvents: [],
    sessionNumber: 1,
    startedAt: 0, lastPlayedAt: 0,
    pendingCheck: null, pendingSave: null,
    combat: null,
    combatDifficulty: 'auto',
    ...over,
  };
}

const combatActive = { active: true } as unknown as CampaignState['combat'];
const names = (c: CampaignState): string[] => getToolsForContext(c).map((t) => t.name);

describe('Fase 2e — getToolsForContext (tool-set por modo + estado)', () => {
  it('exploração fresca: mantém os pivôs, exclui tools de combate e de estado inexistente', () => {
    const t = names(mkCampaign());
    // Pivôs e features de exploração presentes
    for (const must of ['request_skill_check', 'request_saving_throw', 'start_combat', 'start_combat_balanced',
      'give_item', 'suggest_actions', 'set_quest', 'open_shop', 'npc_speaks', 'describe_scene',
      'advance_time', 'create_clock', 'grant_inspiration', 'apply_advantage']) {
      expect(t, `exploração deve declarar ${must}`).toContain(must);
    }
    // Exclusivas do turno de combate
    expect(t).not.toContain('end_combat_with_outcome');
    expect(t).not.toContain('enemy_casts_spell');
    // Tools de estado sem o estado correspondente
    expect(t).not.toContain('update_objective');
    expect(t).not.toContain('complete_quest');
    expect(t).not.toContain('tick_clock');
    expect(t).not.toContain('mark_npc_secret');
    expect(t).not.toContain('reveal_npc_secret');
  });

  it('combate: set enxuto — com end_combat/enemy_casts_spell, sem start_combat/set_quest/open_shop', () => {
    const t = names(mkCampaign({ mode: 'combat', combat: combatActive }));
    for (const must of ['end_combat_with_outcome', 'enemy_casts_spell', 'apply_damage', 'apply_condition',
      'request_saving_throw', 'request_skill_check', 'apply_advantage', 'suggest_actions', 'give_item']) {
      expect(t, `combate deve declarar ${must}`).toContain(must);
    }
    for (const never of ['start_combat', 'start_combat_balanced', 'set_quest', 'open_shop',
      'advance_time', 'describe_scene', 'npc_speaks', 'apply_exhaustion', 'mark_npc_secret']) {
      expect(t, `combate NÃO deve declarar ${never}`).not.toContain(never);
    }
  });

  it('fonte da verdade é combat.active — combate encerrado volta pro set de exploração', () => {
    const t = names(mkCampaign({ mode: 'combat', combat: { active: false } as unknown as CampaignState['combat'] }));
    expect(t).toContain('start_combat');
    expect(t).not.toContain('end_combat_with_outcome');
  });

  it('quest ativa libera update_objective/complete_quest; quest fechada não', () => {
    const quest: Quest = { id: 'q1', title: 'T', description: 'd', objectives: [], status: 'active', rewardXp: 100, acceptedAt: 0 };
    const active = names(mkCampaign({ quests: [quest] }));
    expect(active).toContain('update_objective');
    expect(active).toContain('complete_quest');
    const done = names(mkCampaign({ quests: [{ ...quest, status: 'completed' }] }));
    expect(done).not.toContain('update_objective');
    expect(done).not.toContain('complete_quest');
  });

  it('clock ativo libera tick_clock em exploração E em combate', () => {
    const activeClocks = [{ id: 'c1', label: 'Ritual', progress: 1, max: 6, trigger: 'ritual completa' }];
    expect(names(mkCampaign({ activeClocks }))).toContain('tick_clock');
    expect(names(mkCampaign({ mode: 'combat', combat: combatActive, activeClocks }))).toContain('tick_clock');
    // create_clock fica disponível mesmo sem clock (é quem cria o estado)
    expect(names(mkCampaign())).toContain('create_clock');
  });

  it('npcsMet libera mark_npc_secret; segredo PENDENTE libera reveal_npc_secret', () => {
    const npc = { name: 'Garra', archetype: 'Mercador', attitude: 'neutro' as const, lastSeen: 'Taverna' };
    const withNpc = names(mkCampaign({ npcsMet: [npc] }));
    expect(withNpc).toContain('mark_npc_secret');
    expect(withNpc).not.toContain('reveal_npc_secret'); // nada pendente pra revelar

    const secret = { id: 's1', secret: 'é irmã do bandido', revealCondition: 'manual', revealed: false, createdAt: 0 };
    expect(names(mkCampaign({ npcsMet: [npc], npcSecrets: { garra: [secret] } }))).toContain('reveal_npc_secret');
    expect(names(mkCampaign({ npcsMet: [npc], npcSecrets: { garra: [{ ...secret, revealed: true }] } })))
      .not.toContain('reveal_npc_secret');
  });

  it('guard: todo set retornado é subconjunto de DM_TOOLS e combate < exploração < total', () => {
    const all = new Set(DM_TOOLS.map((t) => t.name));
    const exploration = names(mkCampaign());
    const combat = names(mkCampaign({ mode: 'combat', combat: combatActive }));
    for (const n of [...exploration, ...combat]) {
      expect(all.has(n), `${n} não existe em DM_TOOLS (typo no set?)`).toBe(true);
    }
    expect(combat.length).toBeGreaterThan(0);
    expect(combat.length).toBeLessThan(exploration.length);
    expect(exploration.length).toBeLessThan(DM_TOOLS.length);
  });

  it('integração: DungeonMaster declara o set filtrado pro provider conforme o modo', async () => {
    class CaptureProvider implements DMProvider {
      readonly name = 'capture';
      captured: Array<string[] | undefined> = [];
      async generate(opts: GenerateOpts): Promise<DMRawResponse> {
        this.captured.push(opts.tools?.map((t) => t.name));
        return { text: '{"narration":"A cena segue.","speaker":"Mestre"}', toolCalls: [] };
      }
    }
    const provider = new CaptureProvider();
    const dm = new DungeonMaster(provider);
    const party = [makeCharacterSheet()];

    await dm.narrate({ campaign: mkCampaign(), party, recentNarrations: [] });
    expect(provider.captured[0]).toContain('start_combat');
    expect(provider.captured[0]).not.toContain('end_combat_with_outcome');

    await dm.narrate({
      campaign: mkCampaign({ mode: 'combat', combat: combatActive }),
      party,
      playerAction: { playerId: party[0]!.id, action: 'custom', details: 'grito de guerra' },
      recentNarrations: [],
    });
    expect(provider.captured[1]).toContain('end_combat_with_outcome');
    expect(provider.captured[1]).not.toContain('start_combat');
  });
});
