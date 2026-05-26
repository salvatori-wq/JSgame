// JSgame · DM prompts D&D 5e específicos.
// Persona Sombrio + Sarcástico + Trickster (validada no Cave Run).
// Sistema embarca regras D&D 5e essenciais pra DM aplicar coerentemente.

import type { DMToolDef } from './providers/base.js';
import type { CharacterSheet, CampaignState, MemoryFact } from '../../shared/types.js';
import { ABILITY_LABELS, abilityModifier, formatModifier, proficiencyBonus } from '../../dnd/attributes.js';
import { getClass } from '../../dnd/classes.js';
import { getRace } from '../../dnd/races.js';
import { getBackground } from '../../dnd/backgrounds.js';

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — quem o Mestre é + regras D&D 5e embarcadas
// ════════════════════════════════════════════════════════════════════════════

export const SYSTEM_PROMPT = `Você é o MESTRE — DM de D&D 5e em tempo real, mundo de fantasia sombria. Você narra, controla NPCs e monstros, aplica regras, mas NÃO joga pelos players. A escolha é sempre deles. As consequências também.

## A IDENTIDADE — 3 CAMADAS

1. **SOMBRIO LOVECRAFTIANO** (base): horror cósmico curto, viscerais, presságios. "A parede respira." "Algo conta os passos." Nunca poético/Tolkien longo.
2. **SARCÁSTICO CÉTICO** (filtro): você já viu mil parties caírem. Humor seco, deboche, cinismo de quem cansou da própria presença.
3. **TRICKSTER BAGUNCEIRO** (explosão): 1 em 4 narrações vira a expectativa. "Boss caiu. Ele agradeceu. Não devia." Surpresa cruel ou doce.

## REGRAS DE TOM

- 2-4 frases curtas BR coloquial. Nunca floreado.
- Sempre 1 vício linguístico ("tá", "né", "caralho", "amor", "fudeu", "porra", "putos").
- Tom de quem JÁ PASSOU 1000x — mas ainda surpreso quando o mundo quebra novo.
- NUNCA escreva poema. NUNCA "vossas mercês adentram". NUNCA "o silêncio é pesado".

Teste rápido:
- "Algo se ergue das sombras" → ❌ POÉTICO
- "Vem o grandão. Cheirou ${"`nome`"} antes de ver. Fudeu, amor." → ✓
- "A pedra tá molhada. Não é água. Anda." → ✓ SOMBRIO DIRETO
- "Acharam o baú. Tava aberto. Quem abriu não levou nada — ou não chegou a levar." → ✓ TRICKSTER

## REGRAS D&D 5e EMBARCADAS (use sempre)

**Atributos** (mod = (score-10)/2): FOR / DES / CON / INT / SAB / CAR.
**Proficiência** nível 1-4: +2. Nv 5-8: +3. Nv 9-12: +4.

**Teste de Perícia** (skill check): d20 + modifier do atributo + (proficiente? +PB : 0) vs DC.
DCs padrão: Trivial 5, Fácil 10, Médio 15, Difícil 20, Muito Difícil 25, Quase Impossível 30.

**Quando pedir skill check**: SEMPRE que a ação tem incerteza e consequência. Não peça pra coisa trivial ("abrir porta destrancada"). Peça pra coisas com risco ("escalar muro escorregadio", "convencer guarda corrupto", "lembrar lenda obscura").

**Crítico**: nat 20 = sucesso espetacular extra (revela info bônus, dano dobrado, ou ganho narrativo). Nat 1 = falha catastrófica (não só falha, COMPLICA: arma escorrega, alerta inimigos, custa algo).

**Vantagem/Desvantagem**: rola 2d20, pega maior/menor. Use quando contexto justifica (atacar inimigo cego = vantagem; atacar com luz fraca = desvantagem).

**3 pilares**: Exploração / Interação Social / Combate. Pivote entre eles. Quando player diz "ataco" → start_combat. Quando diz "falo" → npc_speaks. Quando diz "procuro" → request_skill_check (Investigação / Percepção).

## SUA TAREFA — RESPONDA EM JSON

\`\`\`json
{
  "narration": "texto narrativo curto (2-4 frases, tom acima)",
  "speaker": "Mestre"  // ou "NPC X" se for fala de NPC
}
\`\`\`

Use TOOLS quando ação narrativa exigir mecânica:
- request_skill_check: pra resolver ações incertas com d20
- start_combat: quando combate começa (rola initiative)
- apply_damage: dano fora de combate (queda, armadilha, poção venenosa)
- npc_speaks: quando NPC fala — \`speaker\` no JSON vira o nome do NPC
- give_item: dar item ao player (loot, presente, troca)
- advance_time: passar tempo (horas, dia/noite)
- describe_scene: setar/mudar local atual

Ferramentas validadas server-side (rejeita inputs inválidos). Você sugere — server decide.

## EXEMPLOS

Player "explorar caverna":
\`\`\`json
{
  "narration": "Vocês entram. Água pingando no fundo. Cheiro de podre — antigo, não fresco. ${"`nome`"}, o chão range a cada passo. Anda mais.",
  "speaker": "Mestre"
}
\`\`\`

Player "procurar pistas":
+ tool request_skill_check (skill: investigacao, dc: 15, reason: "achar pegadas")

Player "ataco o goblin":
+ tool start_combat (enemies: [{name: "Goblin Sarnento", hp: 7, ac: 15}])

Player "tento convencer o guarda":
+ tool request_skill_check (skill: persuasao, dc: 13)
\`\`\`json
{
  "narration": "O guarda te encara. Cara de quem já ouviu mil mentiras hoje. Tenta.",
  "speaker": "Mestre"
}
\`\`\`

Lembre: SEMPRE 2-4 frases. SEMPRE tom debochado/sombrio/cínico BR. NUNCA poético.`;

// ════════════════════════════════════════════════════════════════════════════
// Tools — declaradas como DMToolDef[]
// ════════════════════════════════════════════════════════════════════════════

export const DM_TOOLS: DMToolDef[] = [
  {
    name: 'request_skill_check',
    description: 'Pede teste de perícia pro player. Server rola d20 + bônus do PJ vs DC, narra resultado.',
    schema: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'ID da perícia D&D (acrobacia, atletismo, furtividade, percepcao, persuasao, etc — 18 totais)',
        },
        dc: { type: 'number', description: 'Classe de Dificuldade (5/10/15/20/25/30). Default 15 (médio).' },
        reason: { type: 'string', description: 'Por que do check (1 frase). Aparece pro player no overlay.' },
        playerId: { type: 'string', description: 'ID do player alvo. "active" pro que tomou a ação atual.' },
      },
      required: ['skill', 'reason'],
    },
  },
  {
    name: 'start_combat',
    description: 'Inicia combate. Server rola initiative de todos, abre combat overlay. PREFIRA monsterId (bestiary pré-cadastrado, balanceado). Caso contrário declare stats.',
    schema: {
      type: 'object',
      properties: {
        enemies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              monsterId: {
                type: 'string',
                description: 'ID do bestiary (preferido). IDs disponíveis: rato, cobra-venenosa, bandido, esqueleto, goblin, kobold, lobo, zumbi, cultista, hobgoblin, orc, bugbear, aranha-gigante, lobo-atroz, ogro, cavaleiro-esqueleto, mago-cinza, gargula, gnoll, ettin, banshee, troll, gigante-da-colina, mago, mind-flayer, gigante-de-pedra, gigante-de-fogo, aboleth, dragão-jovem-vermelho, archmage, vampiro, dragão-adulto-vermelho, lich, pit-fiend. Se passar isto, ignora outros campos.',
              },
              name: { type: 'string', description: 'Nome custom (se não usar monsterId)' },
              hp: { type: 'number', description: 'HP custom (se não usar monsterId)' },
              ac: { type: 'number', description: 'CA custom (se não usar monsterId)' },
              attackBonus: { type: 'number', description: 'd20+X dos ataques. Default +3.' },
              damageDice: { type: 'string', description: 'Notação dano "1d6"/"2d8". Default "1d6".' },
              damageBonus: { type: 'number', description: 'Soma fixa ao damage. Default 0.' },
              description: { type: 'string', description: 'Descrição visual breve' },
            },
          },
        },
        surprise: { type: 'boolean', description: 'Party surpresa? (sem ação 1º turno se true)' },
      },
      required: ['enemies'],
    },
  },
  {
    name: 'apply_condition',
    description: 'Aplica uma condição D&D 5e a um alvo (player ou enemy). Use em combate ou após efeito narrativo.',
    schema: {
      type: 'object',
      properties: {
        targetId: { type: 'string', description: 'ID do PJ ou enemy alvo' },
        condition: {
          type: 'string',
          description: 'Condição: agarrado, amedrontado, atordoado, caido, cego, enfeiticado, envenenado, incapacitado, inconsciente, invisivel, paralisado, petrificado, restrito, surdo',
        },
        reason: { type: 'string', description: 'Por que (1 frase narrativa)' },
      },
      required: ['targetId', 'condition'],
    },
  },
  {
    name: 'end_combat_with_outcome',
    description: 'Encerra combate explicitamente (vitória, derrota narrativa, fuga). Server normalmente detecta por HP=0; use isto quando combate termina por outra razão (rendição, fuga, intervenção).',
    schema: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: ['victory', 'defeat', 'fled'], description: 'Resultado do combate' },
        reason: { type: 'string', description: 'Como acabou (1 frase)' },
      },
      required: ['outcome'],
    },
  },
  {
    name: 'apply_exhaustion',
    description: 'Aplica/remove níveis de exaustão (PHB pág 291, 6 níveis cumulativos). 1=desvantagem testes, 2=mov/2, 3=desvant ataques+saves, 4=HP/2, 5=mov 0, 6=morte. Long rest -1 nível.',
    schema: {
      type: 'object',
      properties: {
        targetId: { type: 'string', description: 'ID do PJ alvo' },
        levels: { type: 'number', description: 'Quantos níveis aplicar (+) ou remover (-). Ex: +1, -2.' },
        reason: { type: 'string', description: 'Causa narrativa (jornada exaustiva, falta de sono, magia, etc)' },
      },
      required: ['targetId', 'levels'],
    },
  },
  {
    name: 'apply_damage',
    description: 'Dano fora de combate (queda, armadilha, veneno). Server clamp 1-100.',
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'string', description: 'ID do player ou "all" pra party' },
        damage: { type: 'number', description: 'Quantidade de dano (1-100)' },
        type: { type: 'string', description: 'Tipo: contundente/perfurante/cortante/fogo/frio/ácido/elétrico/veneno/psíquico/necrótico/radiante' },
        reason: { type: 'string', description: 'Por que tomou dano' },
      },
      required: ['playerId', 'damage', 'reason'],
    },
  },
  {
    name: 'npc_speaks',
    description: 'NPC fala. Use speaker no JSON principal e este tool pra registrar o NPC na memória.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do NPC' },
        archetype: { type: 'string', description: 'Tipo: Mercador, Guarda, Sacerdote, Bardo Bêbado, etc' },
        attitude: { type: 'string', enum: ['amigavel', 'neutro', 'hostil', 'misterioso'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'give_item',
    description: 'Dá item ao player. Tipo: arma/armadura/escudo/consumivel/tesouro/ferramenta/misc.',
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'string' },
        itemName: { type: 'string' },
        type: { type: 'string', enum: ['arma', 'armadura', 'escudo', 'consumivel', 'tesouro', 'ferramenta', 'misc'] },
        quantity: { type: 'number', description: 'Default 1' },
        description: { type: 'string' },
      },
      required: ['playerId', 'itemName', 'type'],
    },
  },
  {
    name: 'advance_time',
    description: 'Avança o tempo do mundo. Útil pra montar pacing de descanso/viagem/clima.',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Ex: "30min", "2h", "1 dia", "noite"' },
        reason: { type: 'string', description: 'Por que (descanso curto, viagem, espera)' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'describe_scene',
    description: 'Define/muda o local atual. Atualiza CampaignState.currentLocation.',
    schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Nome do local (ex: "Taverna do Cervo Vermelho")' },
        description: { type: 'string', description: 'Descrição atmosférica curta (2-3 frases)' },
      },
      required: ['location'],
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Builder do user prompt — contexto da campanha + ação do player
// ════════════════════════════════════════════════════════════════════════════

export interface NarrationContext {
  campaign: CampaignState;
  party: CharacterSheet[];
  playerAction?: { playerId: string; action: string; details?: string };
  recentNarrations?: string[];
  // Facts da memória persistente (RAG via FTS5) — top-K relevantes ao contexto atual.
  // Mestre usa pra manter consistência cross-session (NPCs, locais, promessas).
  memoryFacts?: MemoryFact[];
  // Skill check resolvido (informar resultado ao DM pra narrar consequência)
  skillCheckResolution?: {
    playerName: string;
    skill: string;
    roll: number;
    modifier: number;
    total: number;
    dc: number;
    success: boolean;
    nat20: boolean;
    nat1: boolean;
  };
}

export function buildNarrationPrompt(ctx: NarrationContext): string {
  const partySummary = ctx.party.map((p) => {
    const race = getRace(p.raceId);
    const klass = getClass(p.classId);
    const bg = getBackground(p.backgroundId);
    const pb = proficiencyBonus(p.level);
    const skills = p.proficientSkills.slice(0, 6).join(', ');
    const attrs = Object.entries(p.abilityScores)
      .map(([k, v]) => `${k.toUpperCase()} ${v} (${formatModifier(abilityModifier(v))})`)
      .join(' · ');
    return `- **${p.characterName}** (${race.name} ${klass.name} Nv${p.level} · HP ${p.currentHp}/${p.maxHp} · CA ${p.armorClass} · PB ${formatModifier(pb)})
  Atributos: ${attrs}
  Antecedente: ${bg.name} · Perícias proficientes: ${skills}
  ${p.conditions.length > 0 ? `Condições ativas: ${p.conditions.join(', ')}` : ''}`;
  }).join('\n');

  const recentBlock = ctx.recentNarrations && ctx.recentNarrations.length > 0
    ? `\n## NARRAÇÕES RECENTES (mais nova primeiro)\n${ctx.recentNarrations.slice(-5).reverse().map((n, i) => `${i + 1}. ${n}`).join('\n')}`
    : '';

  // Memória persistente — fatos relevantes recuperados via FTS5/BM25 do banco.
  // Mestre DEVE usar pra continuidade (não inventar NPC novo se já existe, lembrar
  // promessas feitas, manter tom de NPCs). Limita a 6 facts pra não inflar tokens.
  const memoryBlock = ctx.memoryFacts && ctx.memoryFacts.length > 0
    ? `\n## MEMÓRIA DE CAMPANHA (use pra consistência — NÃO contradiga)\n${ctx.memoryFacts.slice(0, 6).map((f) => `- [${f.kind}${f.sessionN > 1 ? ` · S${f.sessionN}` : ''}] ${f.text}`).join('\n')}`
    : '';

  const actionBlock = ctx.playerAction
    ? `\n## AÇÃO DO PLAYER\n${getPlayerName(ctx.party, ctx.playerAction.playerId)} quer: **${ctx.playerAction.action}**${ctx.playerAction.details ? `\nDetalhes: ${ctx.playerAction.details}` : ''}`
    : '';

  const checkBlock = ctx.skillCheckResolution
    ? `\n## RESULTADO DO SKILL CHECK\n${ctx.skillCheckResolution.playerName} rolou **${ctx.skillCheckResolution.roll} + ${ctx.skillCheckResolution.modifier} = ${ctx.skillCheckResolution.total}** vs DC ${ctx.skillCheckResolution.dc}\n${ctx.skillCheckResolution.nat20 ? '✨ NAT 20 (crítico espetacular)' : ctx.skillCheckResolution.nat1 ? '💀 NAT 1 (falha catastrófica)' : ctx.skillCheckResolution.success ? '✓ Sucesso' : '✗ Falhou'}\n→ NARRE a consequência. Se nat 20, vai além (info bônus). Se nat 1, complica (não só falha — algo pior).`
    : '';

  const npcsBlock = ctx.campaign.npcsMet.length > 0
    ? `\n## NPCs JÁ APARECIDOS (use-os, NÃO invente novos)\n${ctx.campaign.npcsMet.map((n) => `- ${n.name} (${n.archetype}, ${n.attitude}) — última vez: ${n.lastSeen}`).join('\n')}`
    : '';

  return `## CONTEXTO DA CAMPANHA
**Campanha**: ${ctx.campaign.name}
**Sessão**: ${ctx.campaign.sessionNumber}
**Local atual**: ${ctx.campaign.currentLocation}
**Modo**: ${ctx.campaign.mode}

## A PARTY
${partySummary}
${npcsBlock}

## FLAGS DO MUNDO
${Object.entries(ctx.campaign.worldFlags).length === 0 ? '(nenhuma ainda)' : Object.entries(ctx.campaign.worldFlags).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
${memoryBlock}
${recentBlock}
${actionBlock}
${checkBlock}

## SUA TAREFA
${ctx.skillCheckResolution
  ? 'Narre a consequência do skill check. 2-4 frases. Tom Sombrio+Sarcástico+Trickster.'
  : ctx.playerAction
    ? 'Narre o que acontece quando o player toma a ação. Se ação tem incerteza, chame request_skill_check. Se inicia combate, chame start_combat. 2-4 frases.'
    : 'Narre a cena de abertura da sessão. Estabeleça local, mood, primeira pista. 2-4 frases.'}

Responda APENAS em JSON válido:
\`\`\`json
{"narration": "texto", "speaker": "Mestre" }
\`\`\``;
}

function getPlayerName(party: CharacterSheet[], playerId: string): string {
  const p = party.find((c) => c.id === playerId);
  return p?.characterName ?? 'Player';
}
