// Fase 0b — guard: toClientCampaignState NUNCA pode vazar segredos NÃO-revelados
// pro client. O texto do segredo + a condição de reveal são SERVER-ONLY (Sprint Y).
// Este teste FALHA se um segredo oculto aparecer no payload serializado.

import { describe, it, expect } from 'vitest';
import { toClientCampaignState } from '../sockets/helpers';
import type { CampaignState, NpcSecret } from '../../shared/types';

function makeState(npcSecrets?: CampaignState['npcSecrets']): CampaignState {
  // Só nos importa o campo npcSecrets — o resto do state não é tocado pela função.
  return { npcSecrets } as unknown as CampaignState;
}

const HIDDEN_TEXT = 'É irmã do bandido procurado pelo capitão';
const HIDDEN_COND = 'insight>=15';
const REVEALED_TEXT = 'Esconde um grimório proibido no porão da capela';

describe('toClientCampaignState — Fase 0b strip de npcSecrets', () => {
  it('remove segredos NÃO-revelados (texto + condição não vazam no JSON)', () => {
    const secret: NpcSecret = {
      id: 's1', secret: HIDDEN_TEXT, revealCondition: HIDDEN_COND,
      revealed: false, createdAt: 1,
    };
    const client = toClientCampaignState(makeState({ Olga: [secret] }));
    const json = JSON.stringify(client);
    expect(json).not.toContain(HIDDEN_TEXT);
    expect(json).not.toContain(HIDDEN_COND);
    // NPC sem NENHUM segredo revelado some do mapa.
    expect(client.npcSecrets?.Olga).toBeUndefined();
  });

  it('mantém apenas os segredos JÁ revelados (esses são públicos por design)', () => {
    const hidden: NpcSecret = { id: 'h', secret: HIDDEN_TEXT, revealCondition: 'manual', revealed: false, createdAt: 1 };
    const shown: NpcSecret = { id: 'r', secret: REVEALED_TEXT, revealCondition: 'manual', revealed: true, createdAt: 1, revealedAt: 2 };
    const client = toClientCampaignState(makeState({ Padre: [hidden, shown] }));
    const json = JSON.stringify(client);
    expect(json).toContain(REVEALED_TEXT);   // revelado pode aparecer
    expect(json).not.toContain(HIDDEN_TEXT); // oculto NUNCA aparece
    expect(client.npcSecrets?.Padre).toHaveLength(1);
    expect(client.npcSecrets?.Padre?.[0]?.id).toBe('r');
  });

  it('devolve o MESMO objeto quando não há npcSecrets (zero alocação)', () => {
    const s = makeState(undefined);
    expect(toClientCampaignState(s)).toBe(s);
  });

  it('NÃO muta o state do servidor (segredos continuam lá pro DM)', () => {
    const secret: NpcSecret = { id: 's', secret: HIDDEN_TEXT, revealCondition: 'manual', revealed: false, createdAt: 1 };
    const original = makeState({ Olga: [secret] });
    toClientCampaignState(original);
    expect(original.npcSecrets?.Olga).toHaveLength(1);
    expect(original.npcSecrets?.Olga?.[0]?.secret).toBe(HIDDEN_TEXT);
  });
});
