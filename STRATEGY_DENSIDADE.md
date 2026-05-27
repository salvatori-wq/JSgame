# JSgame · Estratégia "Densidade"

> **Filosofia**: poucas features, BOAS features. Cada uma com 80%+ de polish em vez de 20 features 30% prontas. O que sobrar de tempo vira polish da existente, não nova entrada na lista.

> **Regra central**: se uma feature pode ser cortada sem o jogo perder magia, ela é corte. Se uma feature precisa de mais 30% de trabalho pra brilhar, esse é o trabalho.

---

## 1. Diagnóstico — onde a magia mora num RPG online

O **loop central** de um RPG de mesa é:

```
Player descreve ação
  → Mestre responde com cena + tensão
    → Dado rola quando há incerteza
      → Resultado importa (consequência narrativa REAL)
        → Player decide próximo passo
          ↑ (loop)
```

**Onde a magia mora**:
1. **Suspense quando rola dado** — pré-rolagem é a magia, não o número final
2. **Narração imersiva da DM** — texto que faz player querer ler, não pular
3. **Decisões com peso** — minha escolha muda algo, não só "next"
4. **Combate com gravity** — não é só HP bar diminuindo
5. **Personagem MEU** — Borin não é template, é meu Borin

**Onde está o atrito HOJE** (pós Sprint γ):

| Atrito | Sintoma | Impacto |
|---|---|---|
| **Primeiro minuto morno** | Wizard 5 passos → "Você está numa taverna". Genérico, sem tensão. | New player abandona |
| **Combate sem peso** | γ.1 trouxe dado bonito, mas dano é número floating + HP bar sem drama. Kill = "X cai." | Combate vira tarefa |
| **NPCs voláteis** | DM cita NPC por nome ~30% das vezes. Quem você ajudou hoje some semana que vem. | Mundo parece descartável |
| **PJ é genérico** | Wizard pergunta traits/flaws mas DM nunca usa. Decoração. | PJ vira pawn |
| **Death sem-graça** | "INCONSCIENTE". DM continua narração padrão. | Morte vira detalhe |
| **Loot esquecível** | Item entra inventário, fim. Magic item raro tem mesma vibe que poção comum. | Reward vira chore |

**O que tem em ABUNDÂNCIA**:
- Estado D&D 5e bem modelado (classes, races, spells, conditions, multiclass)
- Dado bonito (γ.1) + 3 camadas de som + haptic
- Telemetria UX baseline (γ.6 mede tudo)
- 5 LLM providers em cascade + fallback degraded
- 939 tests
- α+β+γ primitivas plantadas (chips, rarity, inspirações, NPC roster, achievements, vendor, action economy, overflow menu)

**O que NÃO precisa fazer**:
- ~~Daily challenges~~ (engagement loop barato, força repetição)
- ~~Meta-progressão Almas~~ (complexo, ROI duvidoso pra single playthrough)
- ~~Hall of Fame compartilhável~~ (vaidade, raro usar — sem comunidade ainda)
- ~~Weekly leaderboard~~ (zero comunidade)
- ~~Mais botões no header~~ (γ.5 já enxugou)
- ~~Mais achievements~~ (já tem 30+, mais é diluição)

---

## 2. Princípios

1. **Densidade > extensão**. 4 features profundas vencem 20 superficiais.
2. **Cada feature precisa terminar**. Pulir até som da última tecla.
3. **Reusar primitivas α+β+γ.** Não recriar paralelo.
4. **Server-side templates > LLM call sempre que possível**. Previsível, rápido, free.
5. **Mobile-first 360px**. Hit targets ≥38px.
6. **Zero budget**. Free tiers only.
7. **Tests verde sempre**. SingleFork SQLITE.

---

## 3. As 4 Features

> **Ordem de execução: 1 → 2 → 3 → 4** (cada uma desbloqueia mais valor que a próxima).

---

### Feature 1: "Primeiro Minuto Magia" (~3-4h)

**Hipótese**: 70% dos novos players abandonam antes da primeira narração interessante. Wizard 5 passos é o vilão.

**Estado atual**:
- Home → Click "NOVO PERSONAGEM" → Wizard com 5 steps (race/class/abilities/background/finalize) → submit → entra na sessão → DM gera "Você está numa taverna" genérico
- Time-to-first-roll p50 estimado: 5-15 minutos

**Visão**:
- Home tem **3 cards de PJ pré-fab** lado a lado (3 arquétipos icônicos D&D)
- Click → entra direto numa cena com TENSÃO REAL em <10 segundos
- Primeiro turno já tem skill check setado (player rola na cara dele)

**Implementação detalhada**:

#### 1.1 PJs pré-fab

**Arquivo NOVO**: `src/dnd/prefab-characters.ts` (~200 LOC)

3 arquétipos icônicos:

```ts
export const PREFAB_CHARACTERS = {
  borin: {
    id: 'prefab-borin',
    label: 'Borin Forjarocha',
    archetype: 'Tank — Bate e segura porrada',
    icon: '🪨',
    classId: 'guerreiro',
    raceId: 'anao-da-montanha',
    backgroundId: 'soldado',
    alignment: 'ln',
    abilityScoresBase: { for: 16, des: 12, con: 15, int: 8, sab: 13, car: 10 },
    proficientSkills: ['atletismo', 'intimidacao'],
    personalityTraits: ['Carrega marcas de cada inimigo que matou.'],
    ideals: ['Lealdade. Honro quem honra.'],
    bonds: ['Meu pelotão foi morto. Vingo cada um.'],
    flaws: ['Tenho medo de magia que não entendo.'],
    backstory: 'Veterano do front. Sobreviveu a campanha que matou todos os companheiros.',
    inventory: [
      { id: 'machado-2-gumes', name: 'Machado Dois-gumes', type: 'arma', quantity: 1 },
      { id: 'escudo', name: 'Escudo', type: 'escudo', quantity: 1 },
      { id: 'cota-malha', name: 'Cota de Malha', type: 'armadura', quantity: 1 },
    ],
    teaser: 'Bate forte, segura porrada. Veterano com sangue nas mãos.',
  },
  lyra: {
    id: 'prefab-lyra',
    label: 'Lyra Estrelaluz',
    archetype: 'Caster — Sabe magias e segredos',
    icon: '🌟',
    classId: 'mago',
    raceId: 'alto-elfo',
    backgroundId: 'sabio',
    alignment: 'cb',
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 16, sab: 14, car: 10 },
    proficientSkills: ['arcanismo', 'historia'],
    spellsKnown: ['maos-magicas', 'mensagem', 'raio-de-gelo', 'misseis-magicos', 'escudo-arcano'],
    spellsPrepared: ['misseis-magicos', 'escudo-arcano'],
    personalityTraits: ['Estudo o que outros temem entender.'],
    ideals: ['Saber liberta. Esconder conhecimento é tirania.'],
    bonds: ['Uma relíquia foi roubada do meu mestre. Vou encontrá-la.'],
    flaws: ['Subestimo brutos. Acho que palavras sempre vencem.'],
    backstory: 'Arquivista da Torre de Cristal até o roubo. Saiu pra recuperar o que foi tomado.',
    inventory: [
      { id: 'cajado', name: 'Cajado Arcano', type: 'arma', quantity: 1 },
      { id: 'livro-magia', name: 'Livro de Magias', type: 'misc', quantity: 1 },
      { id: 'pocao-cura', name: 'Poção de Cura Menor', type: 'consumivel', quantity: 2 },
    ],
    teaser: 'Conhece magia e história. Frágil mas mortal.',
  },
  sina: {
    id: 'prefab-sina',
    label: 'Sina Tribuna',
    archetype: 'Skirmisher — Rápida, sneaky, precisa',
    icon: '🗡',
    classId: 'ladino',
    raceId: 'halfling-pes-leves',
    backgroundId: 'charlatao',
    alignment: 'cn',
    abilityScoresBase: { for: 8, des: 16, con: 13, int: 14, sab: 12, car: 14 },
    proficientSkills: ['furtividade', 'enganacao', 'prestidigitacao', 'persuasao'],
    personalityTraits: ['Sorrio quando minto. Especialmente quando vejo que acreditaram.'],
    ideals: ['Independência. Não devo nada a ninguém.'],
    bonds: ['Minha irmã está num convento. Mando dinheiro toda lua nova.'],
    flaws: ['Nunca resisto a um cofre cheio.'],
    backstory: 'Trapaceira de tavernas. Foi expulsa de 3 cidades. Sempre precisa de ouro.',
    inventory: [
      { id: 'adaga', name: 'Adaga (dupla)', type: 'arma', quantity: 2 },
      { id: 'ferramentas-ladrao', name: 'Ferramentas de Ladrão', type: 'ferramenta', quantity: 1 },
      { id: 'couro', name: 'Armadura de Couro', type: 'armadura', quantity: 1 },
    ],
    teaser: 'Foge rápido, ataca sneaky. Vive de palavras e dedos leves.',
  },
};
```

Factory function `buildPrefab(id: PrefabId) → CharacterSheet`:
- Aplica `applyRaceBonus` no abilityScoresBase
- Calcula HP via `getClass(classId).hitDie`
- Seta AC via armadura equipada
- Seta `spellSlots` via class progression
- Retorna sheet completo pronto pra salvar

#### 1.2 Home com cards

**Arquivo MODIFICADO**: `src/client/home/home-screen.ts`
- Sempre mostra os 3 cards (logo abaixo do header). Não importa se PJs antigos existem.
- "Quer customizar? → Wizard customizado" como link secundário
- CSS: 3 cards lado a lado em desktop, stack em mobile. Hit target ≥44px em mobile.
- Click → POST /api/characters com sheet pré-fab → emit joinCampaign → cria campaign nova

**Arquivo MODIFICADO**: `src/client/styles/home-core.css`
- `.home-prefab-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }`
- Mobile: `@media (max-width: 720px) { grid-template-columns: 1fr; }`
- Cards: portrait gradient + icon + label + archetype + teaser + botão CTA

#### 1.3 Cold opens com tensão real

**Arquivo NOVO**: `src/server/cold-opens.ts` (~150 LOC)

12 cold opens server-side, 1 por backgroundId. SEM LLM (instantâneo, sempre consistente).

Template:
```ts
export interface ColdOpen {
  narration: string;
  pendingCheck: {
    skill: SkillId;
    dc: number;
    reason: string;
  };
}

export function getColdOpen(
  backgroundId: BackgroundId,
  characterName: string,
): ColdOpen;
```

Cold opens (encurtados aqui — versão completa em `src/server/cold-opens.ts`):

| Background | Cold Open | Check inicial |
|---|---|---|
| Soldado | "Chuva fina. Você marcha por um caminho que conhece de outra vida. À frente, três figuras encapuzadas barram a estrada. Mãos próximas das armas." | Percepção DC 12 — Notar embuscada |
| Charlatão | "O brutamonte com cicatriz no olho avança. 'Você roubou meu pai'. Está atrás de você há semanas." | Enganação DC 14 — Convencer ele do engano |
| Sábio | "Cela. Mofo. A porta range, e o carcereiro carrega um pergaminho escrito em fenício." | Arcanismo DC 13 — Decifrar |
| Acólito | "O abade do seu templo está morto. Você foi o último a vê-lo vivo. Os irmãos te olham com suspeita." | Persuasão DC 13 — Defender-se |
| Artesão | "Sua oficina foi queimada esta noite. O caco com brasão lordal indica quem mandou. Vingança ou justiça?" | Investigação DC 12 — Pistas |
| Artista | "A multidão grita. Você atuou e o nobre presente NÃO gostou. Os guardas se aproximam." | Atuação DC 14 — Reverter público |
| Criminoso | "A patrulha te alcançou. Você tem 30 segundos antes da prisão. Beco a esquerda, telhado acima." | Furtividade DC 13 — Sumir |
| Eremita | "Você desce da montanha após 10 anos. A vila ao pé está vazia. Cadáveres recentes. Algo grande passou." | Sobrevivência DC 13 — Rastrear |
| Forasteiro | "A floresta abre numa clareira queimada. No centro, um símbolo gigante esculpido no chão. Não é natural." | Natureza DC 13 — Identificar |
| Heróis do Povo | "A vila te chamou. O moinho está sangrando — literalmente. Aldeões esperam você fazer algo." | Investigação DC 12 — O que é |
| Marinheiro | "A vela rasgou. A tempestade vem. Capitão grita ordens. Você precisa decidir: ancorar ou correr." | Atletismo DC 12 — Manobrar |
| Nobre | "O baile virou banho de sangue. Você está coberto do sangue do anfitrião. A guarda vem aí." | Persuasão DC 14 — Inocência |
| Órfão | "Você acabou de roubar o homem errado. Ele te seguiu até o beco. O cabo da adaga dele brilha." | Furtividade DC 13 — Escape |

#### 1.4 Campaign.startSession usa cold open

**Arquivo MODIFICADO**: `src/server/campaign.ts`
- `startSession` hoje chama `dm.narrate({ ... })` com `playerAction: undefined`. LLM responde.
- DEPOIS: se for sessão 1 + party tem 1 PJ + sem `recentEvents`, chama `getColdOpen(backgroundId, characterName)` em vez de LLM
- Seta `state.pendingCheck` com o check do cold open
- Pushuns `recentEvents` com texto curto
- Retorna DMResponse síntética

#### 1.5 Tests

**Arquivo NOVO**: `src/dnd/__tests__/prefab-characters.test.ts` (~12 tests)
- `buildPrefab('borin')` retorna sheet válido com HP correto
- abilityScores recebe bônus racial
- spellsKnown só populado se classe tem casting
- All 3 prefabs têm tests

**Arquivo NOVO**: `src/server/__tests__/cold-opens.test.ts` (~14 tests)
- `getColdOpen('soldado', 'Borin')` retorna ColdOpen com narration não-vazia
- Cada um dos 12 backgrounds retorna cold open
- pendingCheck sempre tem skill+dc+reason válidos
- Narration inclui character name (substituição {name})

**Métricas-alvo**:
- `time_to_first_roll_ms` p50: 5-15min → **<60s**
- First-session completion rate: ~30% → **>70%**

---

### Feature 2: "Crit que faz suar" (~4h)

**Hipótese**: combate é 40% do tempo de jogo. Hoje vira tarefa numérica. Polish aqui multiplica satisfação ao quadrado.

**Estado atual**:
- γ.1 dado anim antes do hit/miss text
- floating-number existe pra dmg/heal/miss
- HP bar atualiza
- Kill = "X cai." no log

**Visão**:
- Crit sente esmagador (visual + som + tátil + tela)
- HP <33% pulsa devagar — player vê "tô morrendo"
- Enemy morre com cinema (fade-to-black + descend 800ms)
- Player KO ganha narração dramática síntética (sem LLM)
- Combat log narrado com variação de verbos

**Implementação detalhada**:

#### 2.1 Floating numbers com peso

**Arquivo MODIFICADO**: `src/client/combat/floating-number.ts` + CSS

- Crit damage: 2x size (`font-size: 48px` vs 24px), glow dourado, fade 1500ms vs 600ms
- Easing bouncy: `cubic-bezier(0.68, -0.55, 0.265, 1.55)`
- Crit color: `gold` text + `text-shadow: 0 0 12px rgba(255,215,0,0.8)`

#### 2.2 HP bar shake + critical pulse

**Arquivo MODIFICADO**: `src/client/styles/combat.css`

```css
@keyframes hitShake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-4px); }
  75%      { transform: translateX(4px); }
}
.cb-enemy-card.is-hit { animation: hitShake 300ms ease-out; }

@keyframes critPulseRed {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; box-shadow: 0 0 8px rgba(255, 80, 80, 0.5); }
}
.cb-enemy-hp-fill.is-low,
.cp-pj-hp-fill.is-low {
  animation: critPulseRed 1.5s ease-in-out infinite;
}
```

#### 2.3 Enemy dying animation

**Arquivo MODIFICADO**: `src/client/combat/combat-screen.ts`
- Em `renderEnemyCard`: novo estado `is-dying` quando `currentHp === 0 && recentlyKilledAt > now - 1000`
- `is-dying` aplica: opacity 1→0.3, translateY 0→20px, filter grayscale, 800ms
- Depois disso vira `is-dead` permanente (já existe)
- combat-screen mantém set `recentKills: Set<string>` por enemy id

**Arquivo MODIFICADO**: `src/client/styles/combat.css`

```css
@keyframes enemyDying {
  0%   { opacity: 1; transform: translateY(0); filter: grayscale(0); }
  100% { opacity: 0.3; transform: translateY(20px); filter: grayscale(1); }
}
.cb-enemy-card.is-dying { animation: enemyDying 800ms ease-in forwards; }
```

#### 2.4 Player KO narração síntética

**Arquivo MODIFICADO**: `src/server/combat.ts resolveEnemyTurn`
- Quando `playerDowned === true`, adiciona event `dmNarration` síntético antes do return
- 4 templates randômicos:
  - "{name} desaba no chão, sangue escorrendo. Os olhos rolam pra trás."
  - "{name} tomba inconsciente, o último sopro escapando devagar."
  - "{name} cai. Tudo escurece. Death save vem aí."
  - "{name} é arremessado pra trás. O corpo bate na pedra. Não move."

**Hook**: `src/server/sockets/connection.ts combatAction` quando processing events:
- Se event.type === 'condition-applied' && event.conditionId === 'inconsciente'
- emit dmNarration síntético com mood='sombrio'

#### 2.5 Combat log enriched verbs

**Arquivo NOVO**: `src/server/combat-narrator.ts` (~80 LOC)

```ts
export function enrichAttackLog(opts: {
  attackerName: string;
  targetName: string;
  attackRoll: number;
  hit: boolean;
  crit: boolean;
  nat1: boolean;
  damage: number;
  killed: boolean;
}): string;
```

Verbs random pick:
- Hit normal: "cravou em", "rasgou", "atingiu", "acertou em cheio"
- Crit: "esmagou", "dilacerou", "demoliu", "decepou parte de"
- Nat1: "tropeçou no próprio golpe contra", "errou feio em"
- Miss: "errou", "passou raspando em", "atacou — sem efeito em"
- Kill suffix: "{target} cai morto.", "{target} tomba sem vida.", "{target} desaba no chão."

**Arquivo MODIFICADO**: `src/server/combat.ts resolvePlayerAttack` + `resolveEnemyTurn`
- Substitui `log = ...` hardcoded por `log = enrichAttackLog(...)`

#### 2.6 Audio polish

**Arquivo MODIFICADO**: `src/client/audio.ts`
- Novo `playEnemyKill()`: tone sawtooth descending 220→60Hz + chime descendente. Diferente de `playDamage`.

#### 2.7 Hook no campaign-screen

**Arquivo MODIFICADO**: `src/client/campaign/campaign-screen.ts onCombatEvent`
- Em 'damage' event: adiciona class `is-hit` no enemy card por 300ms
- Em 'death' event: marca `recentKills[enemyId] = Date.now()`, dispara `playEnemyKill()`
- HP bar `.is-low` class aplicada quando `currentHp / maxHp < 0.33`

#### 2.8 Tests

**Arquivo NOVO**: `src/server/__tests__/combat-narrator.test.ts` (~10 tests)
- enrichAttackLog retorna string com `attackerName`
- Crit usa verbo mais forte (lista fechada)
- Killed adiciona suffix
- Random pick é determinístico via seed opcional
- nat1 e miss têm verbos diferentes

**Métricas-alvo**:
- Time spent reading combat log: +30% (não medível direto)
- Subjetivo: combat sente "uau!" mode (validação playtest)

---

### Feature 3: "Mestre que Lembra" (~5h)

**Hipótese**: players só sentem mundo persistente a partir da sessão 2. RAG existe mas DM cita NPCs ~30% das vezes. Quando DM lembra, é mágico. Quando esquece, é genérico.

**Estado atual**:
- `src/server/memory.ts` tem FTS5/BM25
- `Campaign.buildMemoryFocus` constrói query
- `retrieveMemory(text, playerId)` pega top-N por relevância
- Prompt injeta top facts
- Resultado: DM ocasionalmente cita NPC, raramente faz callback

**Visão**:
- DM cita NPCs por nome em >70% das narrações relevantes
- Promessas não cumpridas geram tension natural
- Locations re-visitados ganham descrição com callback ("a torre onde você...")
- DC contra NPCs hostis ganha +2 (relationship dynamic)

**Implementação detalhada**:

#### 3.1 retrieveContextualMemory

**Arquivo MODIFICADO**: `src/server/memory.ts`

```ts
export interface ContextualMemoryOpts {
  campaignId: string;
  focusText: string;
  topNGeneral: number;        // RAG normal
  forceNpcSlot: boolean;       // adiciona 1 NPC com relationship != 0
  forcePromiseSlot: boolean;   // adiciona 1 quest active
  forceLocationSlot: boolean;  // adiciona 1 location recente
}

export async function retrieveContextualMemory(
  store: MemoryStore,
  opts: ContextualMemoryOpts,
): Promise<MemoryFact[]>;
```

Algoritmo:
1. Pega top-N pela query normal (RAG)
2. Se forceNpcSlot: query separada `kind=npc AND tags LIKE '%relationship%'` ordenada por ABS(relationship_value) DESC. Pega 1 que NÃO está no top-N.
3. Se forcePromiseSlot: query `kind=promise AND status=active`. Pega 1.
4. Se forceLocationSlot: query `kind=location` ordenada por sessionN DESC. Pega 1.
5. Retorna union (dedup por id).

#### 3.2 Campaign usa enriched memory

**Arquivo MODIFICADO**: `src/server/campaign.ts retrieveMemory`
- Substitui call atual por `retrieveContextualMemory(this.memoryStore, { ...flags forçados sempre TRUE em narrate principal })`

#### 3.3 Prompt explícito sobre callbacks

**Arquivo MODIFICADO**: `src/server/dm/prompts.ts SYSTEM_PROMPT`

Adicionar bloco condicional após bloco de memória:

```
## REGRA DE CALLBACK (CRÍTICA)

Quando há NPC, promessa ou local na MEMÓRIA acima:
1. CITE o nome do NPC pelo menos uma vez na narração se relevante
2. Se há promessa ativa, faça referência ("você prometeu...")
3. Se PJ revisita local conhecido, descreva o que MUDOU desde a última visita
4. NPC com relationship < -3 trata você com hostilidade
5. NPC com relationship > 3 te dá benefício (descontos, informação grátis)

NUNCA narre como se fosse o primeiro encontro com NPCs já conhecidos.
```

#### 3.4 DC dinâmico contra hostis

**Arquivo MODIFICADO**: `src/server/dm-tool-applier.ts request_skill_check tool**

Quando DM seta `request_skill_check`:
- Se `target_npc_name` no input → busca npc no roster
- Se NPC com `relationship < -3` E skill é `enganacao`/`persuasao` → DC += 2
- Anota no `reason`: "(+2 — ele te conhece)"

Alternativa mais simples (sem tocar tool): hook em `Campaign.setPendingCheck`:
- Detecta keyword no `reason` ("convencer X", "enganar Y") + busca NPC
- Ajusta DC

#### 3.5 Telemetria de callback

**Arquivo NOVO**: `src/server/callback-detector.ts` (~60 LOC)

```ts
export function detectCallbacks(
  narrationText: string,
  npcRoster: NpcMemory[],
  quests: Quest[],
  recentLocations: string[],
): { npcCallbacks: string[]; questCallbacks: string[]; locationCallbacks: string[] };
```

Hook em `connection.ts takeAction` após dmNarration emit:
- Chama `detectCallbacks`
- Se algum array não-vazio, emit metric `dm_callback_used` com counts

**Métricas-alvo**:
- `dm_callback_used` por sessão: 0 → **2-3**
- Sessões com pelo menos 1 callback: ? → **>80%**

#### 3.6 Tests

**Arquivo NOVO**: `src/server/__tests__/contextual-memory.test.ts` (~10 tests)
- retrieveContextualMemory inclui NPC slot quando forçado
- Dedup correto (NPC já no top-N não é duplicado)
- Promise slot ignora completed
- Location slot pega mais recente

**Arquivo NOVO**: `src/server/__tests__/callback-detector.test.ts` (~12 tests)
- detecta NPC name na narration
- ignora "the npc" sem nome
- detecta promessa via quest title
- detecta location revisit

---

### Feature 4: "PJ que Faz Sentido" (~4h)

**Hipótese**: traits/ideals/bonds/flaws do wizard são preenchidos com cuidado mas nunca usados. DM nunca tem a oportunidade de chamar "Borin, você jurou vingança aos trolls — e agora há um troll na sua frente." Quando isso acontece, é eletrizante.

**Estado atual**:
- CharacterSheet tem `personalityTraits`, `ideals`, `bonds`, `flaws`, `backstory`
- Wizard preenche (e prefab de Feature 1 também)
- DM prompt NUNCA recebe isso

**Visão**:
- DM tem acesso ao backstory do PJ ativo
- Narração ocasionalmente usa trait/flaw como hook
- Combate testa flaw ("você tem medo de magia" → enemy lança feitiço)

**Implementação detalhada**:

#### 4.1 Inject PJ profile no system prompt

**Arquivo MODIFICADO**: `src/server/dm/prompts.ts`

Adicionar parameter `activeCharacterProfile` na função `buildSystemPrompt`:

```ts
export function buildSystemPrompt(opts: {
  // ... existente
  activeCharacterProfile?: {
    name: string;
    race: string;
    class: string;
    background: string;
    trait: string;
    ideal: string;
    bond: string;
    flaw: string;
  };
}): string;
```

Bloco gerado (se profile existe):

```
## SOBRE O PJ ATIVO

Nome: Borin Forjarocha
Raça/Classe: Anão da Montanha / Guerreiro
Background: Soldado

Trait: "Carrega marcas de cada inimigo que matou."
Ideal: "Lealdade. Honro quem honra."
Bond: "Meu pelotão foi morto. Vingo cada um."
Flaw: "Tenho medo de magia que não entendo."

USE essas informações:
- Cite Trait quando contextualmente justificado (não force)
- Bond pode dirigir quests (encaixe vingança contra X quando puder)
- Flaw é vetor narrativo (situações que TESTAM)
- Ideal é bússola moral (DM apresenta dilemas que tocam ele)
```

#### 4.2 Campaign passa profile pro DM

**Arquivo MODIFICADO**: `src/server/campaign.ts narrate calls**
- Constrói `activeCharacterProfile` do PJ ativo (do takeAction playerId)
- Passa pro `dm.narrate({ ... activeCharacterProfile })`

**Arquivo MODIFICADO**: `src/server/dm/dm.ts narrate signature**
- Aceita `activeCharacterProfile?: ...`
- Passa pra `buildSystemPrompt`

#### 4.3 Telemetria de uso de backstory

**Arquivo NOVO**: `src/server/backstory-detector.ts` (~50 LOC)

```ts
export function detectBackstoryUsage(
  narrationText: string,
  profile: ActiveCharacterProfile,
): { traitMentioned: boolean; idealMentioned: boolean; bondMentioned: boolean; flawMentioned: boolean };
```

Algoritmo: extract keywords do trait/ideal/bond/flaw, regex match no narration text.

Hook em `connection.ts takeAction` após narration: emit `dm_used_backstory` metric com payload.

#### 4.4 Tests

**Arquivo NOVO**: `src/server/__tests__/backstory-detector.test.ts` (~8 tests)
- detecta trait keyword no narration
- ignora narration que não cita
- 4 flags independentes

**Arquivo MODIFICADO**: `src/server/__tests__/dm-personality.test.ts`
- Novo case: prompt com profile injetado contém bloco "## SOBRE O PJ ATIVO"

**Métricas-alvo**:
- `dm_used_backstory` event count por sessão: 0 → **2+**
- Pelo menos 1 trait/flaw citado em >30% das narrações longas (>3 frases)

---

## 4. Cronograma de execução

```
Feature 1 (Quick-start)  →  ~4h   →  commit + push + tests verde
Feature 2 (Combat drama) →  ~4h   →  commit + push + tests verde
Feature 3 (DM lembra)    →  ~5h   →  commit + push + tests verde
Feature 4 (PJ sentido)   →  ~4h   →  commit + push + tests verde
Deploy + handoff         →  ~0.5h →  Chrome MCP no Render dashboard

Total: ~17.5h, 4 commits feature + 1 docs
```

**Cada commit**:
- Tests novos passando
- Typecheck OK
- Push origin/main
- Tests existentes verde

**Deploy único no fim** (não a cada commit — Render leva ~3min cada build).

---

## 5. O que NÃO está nesse plano

Explicitamente cortado:

- ~~Daily challenges~~ — engagement loop barato
- ~~Almas meta-progressão~~ — complexo, ROI duvidoso single playthrough
- ~~Hall of Fame compartilhável~~ — vaidade, sem comunidade
- ~~Weekly leaderboard~~ — zero comunidade ainda
- ~~SSE streaming~~ — δ.1 tem valor mas requer refator grande, fica pra outro sprint
- ~~Cascade paralelo Tier 1~~ — δ.2 dobra request count, free tier risk
- ~~Predictive chips fallback~~ — δ.3 cosmético quando γ.2 já força DM rolar
- ~~Loot screen TCG~~ — ε.2 polish nice-to-have, não core
- ~~Tutorial inline~~ — ε.3 já temos exploration-tutorial; mais é diluição
- ~~Audio mood adaptativo~~ — ε.4 já temos exploration/combat ambient
- ~~Achievement burst polish~~ — ε.6 cosmético
- ~~Color tokens WCAG~~ — ε.7 importante mas não brilha
- ~~Save indicator visual~~ — ε.8 cosmético

Se sobrar tempo após Feature 4, prioridade é polir o que JÁ está nesse plano, não adicionar entradas.

---

## 6. Métricas que validam que funcionou

Antes de cada deploy, hit `/api/dm/ux-funnel?days=1`:

| Métrica | Pre Feature 1 | Pós Feature 1 | Pre Feature 2 | Pós F2 | Pós F3 | Pós F4 |
|---|---|---|---|---|---|---|
| `time_to_first_roll_ms` p50 | ~? | **<60s** | <60s | <60s | <60s | <60s |
| `rolls_per_session` avg | 2-3 (γ.6 ainda baseline) | 4+ | 4+ | 4+ | 5+ | 6+ |
| `dm_callback_used` por sessão | 0 | 0 | 0 | 0 | **2+** | 2+ |
| `dm_used_backstory` por sessão | 0 | 0 | 0 | 0 | 0 | **2+** |
| `first_session_completion_rate` | ~30% | **>70%** | >70% | >70% | >70% | >70% |

Métricas qualitativas (validar via playtest):
- "Combate sente intenso" (pós F2)
- "DM lembrou do NPC que ajudei semana passada" (pós F3)
- "Senti que o Borin era MEU" (pós F4)

---

## 7. Princípio guia

> "Cada feature aqui termina. Não estou listando 20 ideias e implementando 5%. Estou listando 4 ideias e implementando 80% cada. Quando o player joga JSgame depois desse sprint, vê 4 coisas muito polidas — não 20 coisas mornas. **Densidade > extensão**."

A IA continua sendo o coração, e o resto do corpo precisa estar lindo. Mas agora também precisa de ALMA: PJ que faz sentido + mundo que lembra + combate que pesa + primeiro minuto magia.
