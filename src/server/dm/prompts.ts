// JSgame · DM prompts D&D 5e específicos.
// Persona Sombrio + Sarcástico + Trickster (validada no Cave Run).
// Sistema embarca regras D&D 5e essenciais pra DM aplicar coerentemente.

import type { DMToolDef } from './providers/base.js';
import type { CharacterSheet, CampaignState, MemoryFact } from '../../shared/types.js';
import { ABILITY_LABELS, abilityModifier, formatModifier, proficiencyBonus } from '../../dnd/attributes.js';
import { getClass } from '../../dnd/classes.js';
import { getRace } from '../../dnd/races.js';
import { getBackground } from '../../dnd/backgrounds.js';
import { getPersonality, type DmPersonality } from '../../dnd/dm-personality.js';

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — quem o Mestre é + regras D&D 5e embarcadas.
// 1C — Identity block é trocável (5 personalidades). Restante (regras + tools) fixo.
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_HEAD = `Você é o MESTRE — DM de D&D 5e em tempo real, mundo de fantasia sombria. Você narra, controla NPCs e monstros, aplica regras, mas NÃO joga pelos players. A escolha é sempre deles. As consequências também.`;

const SYSTEM_PROMPT_RULES = `## REGRAS D&D 5e EMBARCADAS (use sempre)

**Atributos** (mod = (score-10)/2): FOR / DES / CON / INT / SAB / CAR.
**Proficiência** nível 1-4: +2. Nv 5-8: +3. Nv 9-12: +4.

**Teste de Perícia** (skill check): d20 + modifier do atributo + (proficiente? +PB : 0) vs DC.
DCs padrão: Trivial 5, Fácil 10, Médio 15, Difícil 20, Muito Difícil 25, Quase Impossível 30.

**Quando pedir skill check**: SEMPRE que a ação tem incerteza e consequência. Não peça pra coisa trivial ("abrir porta destrancada"). Peça pra coisas com risco ("escalar muro escorregadio", "convencer guarda corrupto", "lembrar lenda obscura"). **REGRA DE OURO: D&D é o jogo dos DADOS. Se passou 2-3 turnos sem nenhum check, está RUIM — o player veio jogar D&D, não ler livro. Force checks: "Investigação pra achar a porta secreta", "Percepção pra notar a emboscada", "Persuasão pra convencer o NPC". Variedade > repetição. Use as 18 perícias (acrobacia, atletismo, furtividade, percepcao, investigacao, persuasao, intimidacao, enganacao, atuacao, intuicao, arcanismo, historia, natureza, religiao, medicina, sobrevivencia, prestidigitacao, lidar-com-animais). DC: trivial 5, fácil 10, médio 15, difícil 20.**

**Quando pedir saving throw**: spells com save (Bola de Fogo → DES save, Hold Person → SAB save), traps, hazards naturais (queda, veneno → CON). Mesma lógica: dado > narração livre. Se cena tem perigo, use request_saving_throw.

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
- **give_item: SEMPRE que narrar item conseguido — loot pós-kill, presente de NPC, achado em baú/cadáver, recompensa de quest, ouro encontrado. Se a narração menciona "vocês pegam X" / "encontram Y" / "ele te dá Z", VOCÊ DEVE chamar give_item NO MESMO turno. Senão o item NÃO aparece no inventário do player e a UX quebra.**
- **suggest_actions: SEMPRE chame junto da narração de cena nova, após resolver skill check, ou após entrar em local novo. 2-4 ações concretas e contextuais. Player precisa ver opções. Sem isso, ele fica perdido e clica "Explorar" genérico → narração desconexa.**
- advance_time: passar tempo (horas, dia/noite)
- describe_scene: setar/mudar local atual
- set_quest: quando NPC dá missão OU party descobre algo perseguível ("salve a vila", "ache o cristal"). Use questId único curto.
- update_objective: quando party cumpre um passo de quest ativa
- complete_quest: quando todos objetivos cumpridos (success) OU quest virou impossível (failure). Success distribui rewardXp.
- mark_highlight: PARCIMÔNIA — só pra momento que merece reel (kill épica de boss, escolha moral pesada, fala icônica). Máx 1-2 por sessão.

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

Player "abro o baú" (passou check):
+ tool give_item (playerId: "active", itemName: "Espada Curta Élfica", type: "arma", quantity: 1, rarity: "raro", description: "Lâmina fria com runas pulsantes")
+ tool give_item (playerId: "active", itemName: "Peças de Ouro", type: "tesouro", quantity: 47, rarity: "comum")
\`\`\`json
{
  "narration": "Baú range. Dentro: uma espada curta de runas vivas e 47 peças de ouro. Não é riqueza — é convite.",
  "speaker": "Mestre"
}
\`\`\`

Player "saqueio o orc morto":
+ tool give_item (playerId: "active", itemName: "Machado Dentado", type: "arma", quantity: 1, rarity: "comum")
+ tool give_item (playerId: "active", itemName: "Poção de Cura", type: "consumivel", quantity: 1, rarity: "incomum", description: "Vermelha, cheira a ferro")
\`\`\`json
{
  "narration": "O orc largou um machado dentado e uma poção vermelha enrolada no cinto. Pegou tudo.",
  "speaker": "Mestre"
}
\`\`\`

Player "entro na taverna" (cena nova):
+ tool suggest_actions (actions: [
    { label: "Pedir cerveja", action: "talk", details: "pedir uma cerveja ao taverneiro" },
    { label: "Procurar rumores", action: "investigate", hint: "Investigação", details: "ouvir conversas, achar pista de quest" },
    { label: "Observar o salão", action: "explore", hint: "Percepção", details: "varrer com os olhos quem está aqui" },
    { label: "Sentar no canto escuro", action: "sneak", details: "passar despercebido até a mesa do fundo" }
  ])
\`\`\`json
{
  "narration": "A porta range. Cheiro de cerveja azeda e fumo barato. Cinco caras te olham por uma fração de segundo — depois voltam pros copos. Tem mesa vazia no canto. Tem.",
  "speaker": "Mestre"
}
\`\`\`

Player passa Investigação 18 vs DC 15:
+ tool suggest_actions (actions: [
    { label: "Seguir a pegada", action: "explore", details: "seguir o rastro até onde leva" },
    { label: "Voltar pra avisar party", action: "talk", details: "contar pros aliados o que achei" },
    { label: "Marcar local e explorar mais", action: "investigate", hint: "Investigação", details: "procurar mais pistas ao redor" }
  ])
\`\`\`json
{
  "narration": "Pegadas. Botas pesadas, talvez três homens. Frescas — não passou de uma hora. Vão pro norte, em direção ao morro queimado.",
  "speaker": "Mestre"
}
\`\`\`

Lembre: SEMPRE 2-4 frases. Aplique o TOM da identidade configurada (acima). NUNCA poético quando o estilo não pedir. **SE NARRAR ITEM ENCONTRADO/RECEBIDO → CHAME give_item NO MESMO TURNO, SEMPRE.** **SE A CENA É NOVA OU RESOLVEU UM CHECK → CHAME suggest_actions COM 2-4 OPÇÕES, SEMPRE.**`;

// 1C — Builder dinâmico: head + identityBlock (personality) + rules + tools.
// Default personality = 'sombrio' (validada no Cave Run, mantém retrocompat).
export function getSystemPrompt(personality?: DmPersonality): string {
  const p = getPersonality(personality);
  return `${SYSTEM_PROMPT_HEAD}\n\n${p.identityBlock}\n\n${SYSTEM_PROMPT_RULES}`;
}

// Mantido pra retrocompat em qualquer call site que ainda importe a const.
// Resolve pra 'sombrio'.
export const SYSTEM_PROMPT = getSystemPrompt('sombrio');

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
    description: 'Dá item ao player. Tipo: arma/armadura/escudo/consumivel/tesouro/ferramenta/misc. SEMPRE inclua rarity quando o item for diferenciado — drives feedback visual (glow azul/roxo/laranja) que recompensa o player.',
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'string' },
        itemName: { type: 'string' },
        type: { type: 'string', enum: ['arma', 'armadura', 'escudo', 'consumivel', 'tesouro', 'ferramenta', 'misc'] },
        quantity: { type: 'number', description: 'Default 1' },
        description: { type: 'string' },
        rarity: {
          type: 'string',
          enum: ['comum', 'incomum', 'raro', 'muito-raro', 'lendario'],
          description: 'Raridade DnD oficial. Defaults pra "comum" se omitir. Use INCOMUM pra magic items menores (poção cura, +1 weapon), RARO pra +2/spell-tier, MUITO-RARO pra artefatos significativos, LENDARIO pra game-changer (DMG pág 135).',
        },
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
  {
    name: 'set_quest',
    description: 'Registra uma quest/missão dada por NPC ou descoberta. Aparece no quest log do player. Use questId único curto (ex: "salvar-vila", "achar-cristal"). Objetivos são passos atomicos pra rastrear.',
    schema: {
      type: 'object',
      properties: {
        questId: { type: 'string', description: 'ID curto e único (snake-case). Ex: "salvar-vila-mortis"' },
        title: { type: 'string', description: 'Título da quest (≤60 chars)' },
        description: { type: 'string', description: 'Descrição narrativa (2-3 frases). O "o quê" e "por quê".' },
        objectives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID curto do objetivo (ex: "achar-mapa")' },
              description: { type: 'string', description: 'O que precisa ser feito (1 frase)' },
            },
          },
          description: '1-8 objetivos. Cada um é um passo concreto pra completar a quest.',
        },
        rewardXp: { type: 'number', description: 'XP que será distribuído à party ao completar (default 100). Escale com dificuldade: trivial=50, médio=200, épico=1000.' },
        giver: { type: 'string', description: 'Nome do NPC que deu a quest (opcional, pra display)' },
      },
      required: ['questId', 'title', 'description', 'objectives'],
    },
  },
  {
    name: 'update_objective',
    description: 'Marca um objetivo de uma quest como feito (ou desfaz). Use quando party completa um passo de uma quest ativa.',
    schema: {
      type: 'object',
      properties: {
        questId: { type: 'string', description: 'ID da quest existente' },
        objectiveId: { type: 'string', description: 'ID do objetivo dentro da quest' },
        done: { type: 'boolean', description: 'true = marcar como feito (default). false = desfazer.' },
        note: { type: 'string', description: 'Nota narrativa opcional sobre como foi resolvido' },
      },
      required: ['questId', 'objectiveId'],
    },
  },
  {
    name: 'mark_highlight',
    description: 'Marca um MOMENTO MEMORÁVEL pra entrar no highlight reel do jogador. Use com PARCIMÔNIA — só pra cenas que realmente merecem ser lembradas anos depois (kill épica em boss, fala icônica de NPC, escolha moral pesada, reviravolta de plot). Máx 1-2 por sessão.',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Resumo do momento em 1-2 frases (vira card no reel)' },
        highlightKind: {
          type: 'string',
          enum: ['moment', 'kill', 'speech', 'choice', 'twist'],
          description: 'kill=baixou boss; speech=fala marcante; choice=escolha moral importante; twist=reviravolta; moment=catchall',
        },
        characterId: { type: 'string', description: 'PJ protagonista (opcional). Sem isso, vira highlight da campanha inteira.' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'complete_quest',
    description: 'Encerra uma quest. outcome=success → distribui rewardXp à party (level-ups aplicados auto). outcome=failure → quest fica como falha (sem reward). Use quando todos os objetivos foram cumpridos OU quando a quest se torna impossível.',
    schema: {
      type: 'object',
      properties: {
        questId: { type: 'string', description: 'ID da quest a encerrar' },
        outcome: { type: 'string', enum: ['success', 'failure'], description: 'Resultado final' },
        summary: { type: 'string', description: 'Como a quest terminou (1-2 frases). Vira fact narrativo permanente.' },
      },
      required: ['questId', 'outcome', 'summary'],
    },
  },
  {
    name: 'open_shop',
    description: 'Abre uma loja/vendor pra party. Use quando NPC mercador é introduzido e quer vender — sempre PASSE itens concretos com preços PHB (espada longa 15po, armadura de couro 10po, poção cura 50po, escudo 10po, etc). Cliente abre modal de compra/venda — ou seja, NÃO substitui give_item normal. Use SÓ pra mercadores explícitos ("a feiticeira tem uma vitrine"). Server gera IDs estáveis pros items.',
    schema: {
      type: 'object',
      properties: {
        npcName: { type: 'string', description: 'Nome do mercador NPC (ex: "Brogundo")' },
        shopType: {
          type: 'string',
          enum: ['arms', 'alchemy', 'general', 'magic'],
          description: 'Tipo: arms=armas/armaduras, alchemy=poções, general=tudo um pouco, magic=itens mágicos raros',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do item' },
              type: { type: 'string', enum: ['arma', 'armadura', 'escudo', 'consumivel', 'tesouro', 'ferramenta', 'misc'] },
              rarity: { type: 'string', enum: ['comum', 'incomum', 'raro', 'muito-raro', 'lendario'] },
              priceGold: { type: 'number', description: 'Preço em peças de ouro. Use PHB: poções 50po, espadas 10-50po, armaduras 10-1500po conforme tier' },
              description: { type: 'string', description: 'Descrição curta' },
              stock: { type: 'number', description: 'Estoque (omita pra ilimitado)' },
            },
            required: ['name', 'type', 'priceGold'],
          },
          description: '2-12 items. Variedade > quantidade.',
        },
        acceptsSell: { type: 'boolean', description: 'Aceita comprar items do party? Default true.' },
      },
      required: ['npcName', 'shopType', 'items'],
    },
  },
  {
    name: 'grant_inspiration',
    description: 'Concede 1 INSPIRAÇÃO ao player por bom roleplay (PHB pág 125). Use PARCIMÔNIA — MÁX 1 por sessão por player. Razões válidas: solução criativa, ato corajoso, fala marcante, abraçou trait/bond/flaw do PJ. NÃO dê de graça. Player gasta antes de rolar pra ganhar advantage. Max 3 acumuladas.',
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'string', description: 'ID do player ("active" pro que tomou ação)' },
        reason: { type: 'string', description: 'Por que recebeu (1 frase). Aparece no toast. Ex: "interpretou perfeitamente o medo do PJ"' },
      },
      required: ['playerId', 'reason'],
    },
  },
  {
    name: 'suggest_actions',
    description: 'Sugere 2-4 ações contextuais à cena atual como chips clicáveis pro player. SEMPRE chame após narrar cena nova OU resolver skill check OU mudar de local. Player precisa ver opções concretas — sem isso, ele clica "Explorar" genérico e o jogo fica desconexo.',
    schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Texto curto e direto pro botão (max 40 chars). Ex: "Examinar o corpo"' },
              action: {
                type: 'string',
                enum: ['explore', 'investigate', 'talk', 'sneak', 'attack', 'cast-spell', 'use-item', 'rest-short', 'rest-long', 'travel', 'custom'],
                description: 'Tipo de ação. "custom" se for algo livre que não cabe em nenhuma das outras.',
              },
              hint: { type: 'string', description: 'Pista de skill opcional, em parênteses. Ex: "Investigação", "Persuasão DC 15"' },
              details: { type: 'string', description: 'Texto enviado como `details` pro DM quando player clica. Ex: "examinar marcas no pescoço do morto". Seja específico — isso é o que o Mestre vai ler.' },
            },
            required: ['label', 'action', 'details'],
          },
          description: '2 a 4 ações sugeridas. Server clamp em 4 itens. Variedade > quantidade.',
        },
      },
      required: ['actions'],
    },
  },
  {
    name: 'start_combat_balanced',
    description: 'Inicia combate BALANCEADO automaticamente pra dificuldade. Use ao invés de start_combat quando você só quer dizer "easy/medium/hard/deadly" e deixar o server escolher inimigos do bestiary baseado no nível da party. Sem precisar pensar em monsterId/CR.',
    schema: {
      type: 'object',
      properties: {
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard', 'deadly'],
          description: 'Dificuldade do encontro. PHB DMG XP thresholds.',
        },
        flavor: { type: 'string', description: 'Descrição narrativa breve do encontro (1 frase)' },
      },
      required: ['difficulty'],
    },
  },
  {
    name: 'enemy_casts_spell',
    description: 'Declara que um inimigo está conjurando uma magia. Abre janela de Counterspell pros casters do party (5s). USE ANTES de aplicar dano/efeito da magia — dá agência pros casters reagirem. Após declarar, faça o efeito normalmente via apply_damage/apply_condition.',
    schema: {
      type: 'object',
      properties: {
        sourceName: { type: 'string', description: 'Nome do inimigo conjurando (ex: "Mago Cinza", "Mind Flayer")' },
        spellName: { type: 'string', description: 'Nome da magia sendo conjurada (ex: "Bola de Fogo", "Hold Person")' },
        spellLevel: { type: 'number', description: 'Nível da magia (1-9). Cantrips → 0 mas não dispara reactions; só ≥1 disparam.' },
        targetIds: { type: 'array', items: { type: 'string' }, description: 'IDs dos alvos (PJs ou enemies). Opcional pra spells AoE sem alvo único.' },
        visible: { type: 'boolean', description: 'Magia é visível (componente verbal/somático)? Default true. Counterspell só pode reagir a spells visíveis.' },
      },
      required: ['sourceName', 'spellName', 'spellLevel'],
    },
  },
  {
    name: 'request_saving_throw',
    description: 'Pede teste de resistência (saving throw) pra player. Use pra spells com save (Dragon Breath, Fireball), traps, hazards. Server rola d20 + ability mod + prof (se tem) vs DC.',
    schema: {
      type: 'object',
      properties: {
        ability: {
          type: 'string',
          enum: ['for', 'des', 'con', 'int', 'sab', 'car'],
          description: 'Atributo do save (for=Força, des=Destreza, con=Constituição, int=Inteligência, sab=Sabedoria, car=Carisma)',
        },
        dc: { type: 'number', description: 'Classe de Dificuldade (10/13/15/18/20). Default 15.' },
        reason: { type: 'string', description: 'Por que do save (1 frase). Aparece pro player.' },
        playerId: { type: 'string', description: 'ID do player alvo. "active" pro que tomou ação atual.' },
      },
      required: ['ability', 'reason'],
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
  // β.1 — Top-N NPCs do roster persistente. Injetados pra DM lembrar tom/relacionamento.
  npcRoster?: import('../../shared/types.js').NpcMemory[];
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

  // Memória persistente — fatos relevantes recuperados via FTS5/BM25 + slots
  // forçados (NPC com relationship, promessa ativa, location recente).
  // F3 — REGRA DE CALLBACK obrigatória: DM cita nome de NPC quando contexto
  // permite, lembra de promessa não cumprida, descreve mudança no local.
  const memoryBlock = ctx.memoryFacts && ctx.memoryFacts.length > 0
    ? `\n## MEMÓRIA DE CAMPANHA (use pra consistência — NÃO contradiga)\n${ctx.memoryFacts.slice(0, 8).map((f) => `- [${f.kind}${f.sessionN > 1 ? ` · S${f.sessionN}` : ''}] ${f.text}`).join('\n')}\n\n### REGRA DE CALLBACK (CRÍTICA)\nQuando há NPC, promessa ou local na MEMÓRIA acima:\n1. CITE o nome do NPC pelo menos uma vez se contextualmente relevante\n2. Se há promessa ativa, faça referência ("você prometeu...")\n3. Se PJ revisita local conhecido, descreva o que MUDOU desde a última visita\n4. NUNCA narre como primeiro encontro com NPC já conhecido`
    : '';

  const actionBlock = ctx.playerAction
    ? `\n## AÇÃO DO PLAYER\n${getPlayerName(ctx.party, ctx.playerAction.playerId)} quer: **${ctx.playerAction.action}**${ctx.playerAction.details ? `\nDetalhes: ${ctx.playerAction.details}` : ''}`
    : '';

  const checkBlock = ctx.skillCheckResolution
    ? `\n## RESULTADO DO SKILL CHECK\n${ctx.skillCheckResolution.playerName} rolou **${ctx.skillCheckResolution.roll} + ${ctx.skillCheckResolution.modifier} = ${ctx.skillCheckResolution.total}** vs DC ${ctx.skillCheckResolution.dc}\n${ctx.skillCheckResolution.nat20 ? '✨ NAT 20 (crítico espetacular)' : ctx.skillCheckResolution.nat1 ? '💀 NAT 1 (falha catastrófica)' : ctx.skillCheckResolution.success ? '✓ Sucesso' : '✗ Falhou'}\n→ NARRE a consequência. Se nat 20, vai além (info bônus). Se nat 1, complica (não só falha — algo pior).`
    : '';

  // β.1 — Prioriza NPCs do roster persistente (com contadores, relacionamento, notas).
  // Fallback pra npcsMet (in-memory) se roster vazio. Limita a top-5 pra economizar tokens.
  const npcsBlock = (() => {
    const roster = ctx.npcRoster ?? [];
    if (roster.length > 0) {
      const rel = (n: number): string => n > 0 ? `+${n}` : String(n);
      const lines = roster.slice(0, 5).map((n) => {
        const notes = n.notes ? ` · ${n.notes}` : '';
        return `- ${n.name} (${n.archetype}, ${n.attitude}, rel ${rel(n.relationship)}, ${n.interactionCount}× em "${n.lastLocation}")${notes}`;
      }).join('\n');
      return `\n## NPCs CONHECIDOS (use nomes, tiques, relacionamento — NÃO invente novos se já existe)\n${lines}`;
    }
    if (ctx.campaign.npcsMet.length > 0) {
      return `\n## NPCs JÁ APARECIDOS (use-os, NÃO invente novos)\n${ctx.campaign.npcsMet.map((n) => `- ${n.name} (${n.archetype}, ${n.attitude}) — última vez: ${n.lastSeen}`).join('\n')}`;
    }
    return '';
  })();

  // 3B — Player choice de dificuldade. DM respeita ao chamar start_combat_balanced.
  const difficulty = ctx.campaign.combatDifficulty ?? 'auto';
  const difficultyBlock = difficulty !== 'auto'
    ? `\n## DIFICULDADE DE COMBATE (preferência da party)\nQuando iniciar combate via start_combat_balanced, USE difficulty="${difficulty}". A party escolheu esse nível — respeite.`
    : '';

  // F18 — Quests ativas. Mestre DEVE avançar/encerrar via tools quando contextualmente
  // apropriado. Não inventar quests novas se já existem (use IDs existentes).
  const activeQuests = (ctx.campaign.quests ?? []).filter((q) => q.status === 'active');
  const questsBlock = activeQuests.length > 0
    ? `\n## QUESTS ATIVAS (use update_objective/complete_quest quando avançar)\n${activeQuests.map((q) => {
        const objs = q.objectives.map((o) => `${o.done ? '✓' : '○'} [${o.id}] ${o.description}`).join('\n    ');
        return `- **${q.title}** (id: ${q.id}${q.giver ? `, de ${q.giver}` : ''}) — reward ${q.rewardXp} XP\n    Objetivos:\n    ${objs}`;
      }).join('\n')}`
    : '';

  return `## CONTEXTO DA CAMPANHA
**Campanha**: ${ctx.campaign.name}
**Sessão**: ${ctx.campaign.sessionNumber}
**Local atual**: ${ctx.campaign.currentLocation}
**Modo**: ${ctx.campaign.mode}

## A PARTY
${partySummary}
${npcsBlock}
${questsBlock}
${difficultyBlock}

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
