// Fase 1 — factories compartilhadas pros testes. Centralizam a construção de
// CharacterSheet / EnemySnapshot / Campaign + um DM scriptado determinístico,
// pra novos testes não copiarem 40 linhas de boilerplate (e divergirem do shape
// real do servidor). Use buildPrefabCharacter pra ficha "de verdade", já válida.

import { buildPrefabCharacter, type PrefabId } from '../dnd/prefab-characters.js';
import { Campaign } from '../server/campaign.js';
import type { DMInterface, DMResponse } from '../server/dm/dm.js';
import type { NarrationContext } from '../server/dm/prompts.js';
import type { CharacterSheet, EnemySnapshot } from '../shared/types.js';

/** Ficha de PJ válida e jogável (prefab real do servidor). */
export function makeCharacterSheet(prefab: PrefabId = 'borin', ownerName = 'Tester'): CharacterSheet {
  return buildPrefabCharacter(prefab, ownerName);
}

let enemyCounter = 0;
/** EnemySnapshot mínimo válido (override o que precisar). */
export function makeEnemy(over: Partial<EnemySnapshot> = {}): EnemySnapshot {
  enemyCounter += 1;
  return {
    id: `enemy-${enemyCounter}`,
    name: 'Goblin',
    maxHp: 7,
    currentHp: 7,
    armorClass: 12,
    attackBonus: 3,
    damageDice: '1d6',
    damageBonus: 0,
    initiative: 0,
    conditions: [],
    description: '',
    isBoss: false,
    xpAward: 50,
    ...over,
  };
}

/**
 * DM determinístico: cada narrate() consome a próxima resposta da fila scriptada;
 * fila vazia → narração neutra sem tools. Registra os contextos recebidos.
 */
export class ScriptedDM {
  private queue: DMResponse[] = [];
  readonly calls: NarrationContext[] = [];
  script(...responses: Array<Partial<DMResponse>>): this {
    for (const r of responses) {
      this.queue.push({ narration: 'narração de teste.', speaker: 'Mestre', toolCalls: [], raw: '', ...r });
    }
    return this;
  }
  async narrate(ctx: NarrationContext): Promise<DMResponse> {
    this.calls.push(ctx);
    return this.queue.shift() ?? { narration: '(fila vazia)', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
  async summarize(): Promise<string | null> { return null; }
  async generateRecap(): Promise<string | null> { return null; }
}

/** Campaign in-memory pronta pra dirigir (DM scriptado por padrão). */
export function makeCampaign(dm: DMInterface = new ScriptedDM() as unknown as DMInterface, id = 'test-camp'): Campaign {
  return new Campaign(dm, { id, name: `test-${id}` });
}
