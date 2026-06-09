// Fase 1c — SMOKE E2E golden: dirige uma sessão inteira pela Campaign REAL com um
// DM "scriptado" determinístico (respostas canned com toolCalls), e faz assert no
// CampaignState a cada marco. Cobre a CLASSE de bug que mais machucou o JOGO e que
// nenhum unit test pegava:
//   - V.2 "DM narra lindo mas o combate NUNCA inicia" (toolCalls perdidas entre o
//     narrate e a aplicação) → garante que start_combat aplica MESMO com narração vazia.
//   - M1 "vitória dá 0 XP" → garante que end_combat_with_outcome(victory) concede XP.
// Roda via `npm run smoke` (arquivo isolado) E no `npm test` (suite). Sem DB, sem
// rede, sem LLM — tudo na Campaign in-memory + buildPrefabCharacter.

import { describe, it, expect, beforeAll } from 'vitest';
import { initPersistence } from '../persistence';
import type { Campaign } from '../campaign';
import type { DMInterface } from '../dm/dm';
import { ScriptedDM, makeCampaign, makeCharacterSheet } from '../../test/factories';

function freshCampaign(dm: ScriptedDM, id: string): { camp: Campaign; pcId: string } {
  const camp = makeCampaign(dm as unknown as DMInterface, id);
  const pc = makeCharacterSheet('borin', 'João');
  camp.addCharacter(pc);
  return { camp, pcId: pc.id };
}

// Ação NEUTRA: não casa com detectImpliedSkillCheck (não tem verbo que implique
// teste), então takeAction de fato CHAMA o DM em vez de auto-injetar um pendingCheck.
const NEUTRAL = 'esperar um instante';

describe('SMOKE E2E — arco golden prompt→tool→state (Fase 1c)', () => {
  // Persistência local pra telemetria fire-and-forget (trackMetricEvent) não cuspir
  // warning. Nenhuma asserção depende do DB — é só pra silenciar ruído.
  beforeAll(async () => { await initPersistence(); });

  it('cold-open: addCharacter + startSession deixa o jogo jogável (exploração + cena)', async () => {
    const { camp } = freshCampaign(new ScriptedDM(), 'cold');
    const resp = await camp.startSession();
    expect(resp).not.toBeNull();
    expect((resp?.narration ?? '').length).toBeGreaterThan(0);
    expect(camp.state.mode).toBe('exploration');
    // O cold-open de 1 player na sessão 1 é instantâneo (sem LLM): tem cena.
    expect((camp.state.currentSceneDescription ?? camp.state.currentLocation ?? '').length).toBeGreaterThan(0);
  });

  it('skill check via TOOL: takeAction → request_skill_check seta pendingCheck (valores do tool)', async () => {
    const dm = new ScriptedDM().script({
      narration: 'Algo cintila nas runas da parede.',
      toolCalls: [{ name: 'request_skill_check', input: { skill: 'arcanismo', dc: 17, reason: 'decifrar as runas', playerId: 'active' } }],
    });
    const { camp, pcId } = freshCampaign(dm, 'skill');
    await camp.takeAction(pcId, NEUTRAL);
    expect(camp.state.pendingCheck).not.toBeNull();
    // DC/skill DISTINTIVOS (17/arcanismo) provam que veio do TOOL, não do detector implícito.
    expect(camp.state.pendingCheck?.dc).toBe(17);
    expect(camp.state.pendingCheck?.skill).toBe('arcanismo');
  });

  it('resolve do skill check: rola d20, limpa pendingCheck e aplica o tool da resolução', async () => {
    const dm = new ScriptedDM().script(
      { toolCalls: [{ name: 'request_skill_check', input: { skill: 'percepcao', dc: 12, reason: 'notar emboscada', playerId: 'active' } }] },
      // a narração da RESOLUÇÃO já inicia o combate:
      { narration: 'A emboscada estoura!', toolCalls: [{ name: 'start_combat', input: { surprise: false, enemies: [{ name: 'Bandido', hp: 7, ac: 12, attackBonus: 3, damageDice: '1d6', damageBonus: 1, xpAward: 50 }] } }] },
    );
    const { camp, pcId } = freshCampaign(dm, 'resolve');
    await camp.takeAction(pcId, NEUTRAL);
    expect(camp.state.pendingCheck).not.toBeNull();
    const result = await camp.resolveSkillCheck(pcId);
    expect(result).not.toBeNull();
    expect(result!.roll.total).toBeGreaterThanOrEqual(1);
    expect(camp.state.pendingCheck).toBeNull(); // limpou após rolar
    expect(camp.state.combat?.active).toBe(true); // tool da resolução aplicou
    expect(camp.state.combat?.enemies.length).toBe(1);
  });

  it('V.2 GUARD: start_combat aplica MESMO com narração VAZIA (toolCalls não se perdem)', async () => {
    const dm = new ScriptedDM().script({
      narration: '', // <-- o caso que quebrava: DM cuspiu tools sem texto
      toolCalls: [{ name: 'start_combat', input: { surprise: false, enemies: [{ name: 'Goblin', hp: 5, ac: 11, attackBonus: 2, damageDice: '1d4', damageBonus: 0, xpAward: 25 }] } }],
    });
    const { camp, pcId } = freshCampaign(dm, 'v2');
    await camp.takeAction(pcId, NEUTRAL);
    expect(camp.state.combat).not.toBeNull();
    expect(camp.state.combat?.active).toBe(true);
    expect(camp.state.mode).toBe('combat');
    expect(camp.state.combat?.enemies[0]?.name).toBe('Goblin');
  });

  it('M1 GUARD: end_combat_with_outcome(victory) via takeAction concede XP à party', async () => {
    const dm = new ScriptedDM().script(
      { narration: '', toolCalls: [{ name: 'start_combat', input: { surprise: false, enemies: [{ name: 'Orc', hp: 10, ac: 13, attackBonus: 4, damageDice: '1d8', damageBonus: 2, xpAward: 75 }] } }] },
      { narration: 'O orc se rende e foge.', toolCalls: [{ name: 'end_combat_with_outcome', input: { outcome: 'victory', reason: 'o orc se rendeu' } }] },
    );
    const { camp, pcId } = freshCampaign(dm, 'm1');
    const xpBefore = camp.party[0]!.xp;
    await camp.takeAction(pcId, NEUTRAL);       // inicia combate
    expect(camp.state.combat?.active).toBe(true);
    await camp.takeAction(pcId, NEUTRAL);       // DM narra vitória → encerra
    expect(camp.state.combat?.active ?? false).toBe(false);
    expect(camp.lastCombatXpAwards.length).toBe(1);
    // O valor exato é computado pelo validateToolCall (proxy de CR), não o literal —
    // o que importa pro M1 é que a vitória concede XP > 0 (o bug dava ZERO).
    const awarded = camp.lastCombatXpAwards[0]!.xpAwarded;
    expect(awarded).toBeGreaterThan(0);
    expect(camp.party[0]!.xp).toBe(xpBefore + awarded); // XP de verdade na ficha
  });

  it('M1 contraste: end_combat_with_outcome(defeat) NÃO concede XP', async () => {
    const dm = new ScriptedDM().script(
      { narration: '', toolCalls: [{ name: 'start_combat', input: { surprise: false, enemies: [{ name: 'Dragão', hp: 200, ac: 18, attackBonus: 11, damageDice: '2d10', damageBonus: 6, isBoss: true, xpAward: 1800 }] } }] },
      { narration: 'A chama os engole.', toolCalls: [{ name: 'end_combat_with_outcome', input: { outcome: 'defeat', reason: 'bola de fogo' } }] },
    );
    const { camp, pcId } = freshCampaign(dm, 'defeat');
    const xpBefore = camp.party[0]!.xp;
    await camp.takeAction(pcId, NEUTRAL);
    await camp.takeAction(pcId, NEUTRAL);
    expect(camp.lastCombatXpAwards.length).toBe(0);
    expect(camp.party[0]!.xp).toBe(xpBefore);
  });
});
