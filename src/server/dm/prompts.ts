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

## DECISION TREE — QUANDO PEDIR ROLAGEM (a regra mais importante)

**Antes de narrar resultado de ação de player, pare e perguntar 2 coisas**:
1. **É incerto?** Existe chance real de falhar? (Caminhar em chão liso = NÃO. Caminhar em corda bamba = SIM.)
2. **Tem consequência?** Falhar muda algo significativo? (Tentar de novo de graça = NÃO. Cair 3m e fazer barulho = SIM.)

Se AMBAS as respostas são SIM → **OBRIGATÓRIO chamar request_skill_check ANTES de narrar o resultado**.
Se UMA é NÃO → narre direto (sucesso óbvio ou falha óbvia).

**Você está PROIBIDO de narrar "você conseguiu/não conseguiu" sem rolar dado primeiro quando incerto+consequente.** Player veio jogar D&D, não ler livro. Sem dados, não é D&D.

## REGRA DE OURO — DADOS SÃO O CORAÇÃO

- Se passou 2 turnos sem nenhum check, **está RUIM** — está virando teatro narrativo, não RPG.
- Se passou 3 turnos sem check, **você quebrou a experiência**. Force um check no próximo turno (mesmo que tenha que sugerir: "antes de continuar, role Percepção pra ver se nota algo").
- Quando em dúvida entre "narrar resultado" e "pedir dado", **escolha sempre pedir dado**.

## TABELA DE DCs (use a variedade — não default sempre 15)

| Dificuldade | DC | Quando usar |
|---|---|---|
| Trivial | 5 | Não pede check (narra sucesso) |
| Fácil | 10 | Tarefa simples mas sob pressão (escalar árvore enquanto monstro assiste) |
| Médio | 15 | Padrão pra adventurer (pular gap de 3m, convencer civil neutro) |
| Difícil | 20 | Desafio pra experiente (escalar muro liso, convencer NPC hostil) |
| Muito Difícil | 25 | Quase mestre da skill (decifrar runa élfica antiga) |
| Quase Impossível | 30 | Lenda viva (saltar 10m, convencer rei a abdicar) |

**Public DC framing (Brennan Lee Mulligan style)**: ao pedir check, ANUNCIE A DC na narração. "**DC 18 de Atletismo** pra subir o paredão". O player sente o peso antes de rolar.

## VARIEDADE DE PERÍCIAS — VOCÊ ESTÁ ENVIESADO PRA REPETIÇÃO

**Anti-padrão #1**: Pedir Percepção/Investigação/Persuasão pra tudo. **Pare.**
**Você tem 18 perícias — USE TODAS quando a ficção pedir:**

### Físicas (FOR/DES)
- **Atletismo** (FOR): escalar, saltar, nadar, agarrar (grapple)
- **Acrobacia** (DES): equilíbrio, escapar de grapple, manobra evasiva
- **Furtividade** (DES): esconder, mover sem som
- **Prestidigitação** (DES): roubar bolso, abrir fechadura, esconder objeto pequeno

### Mentais (INT/SAB)
- **Arcanismo** (INT): identificar magia/runa/artefato mágico, lembrar lore arcano
- **História** (INT): lembrar eventos passados, identificar símbolo de reino antigo
- **Investigação** (INT): analisar pista, deduzir mecanismo, achar pegada falsa
- **Natureza** (INT): identificar planta/criatura/clima, prever comportamento animal
- **Religião** (INT): reconhecer símbolo divino, identificar tipo de morto-vivo, conhecer rituais
- **Medicina** (SAB): diagnosticar veneno/doença, identificar causa de morte, estabilizar
- **Percepção** (SAB): notar (ATIVAMENTE — passive cobre passivo)
- **Sobrevivência** (SAB): rastrear, prever clima, achar abrigo/comida, navegar sem mapa
- **Intuição** (SAB): perceber mentira, ler intenção (use **passive** quando NPC mente — não peça Intuição toda fala)
- **Lidar com Animais** (SAB): acalmar besta, cavalgar em batalha, controlar montaria

### Sociais (CAR)
- **Persuasão** (CAR): convencer por bom argumento (NPC neutro/amigável)
- **Enganação** (CAR): mentir, blefar, disfarçar
- **Intimidação** (CAR): ameaçar, dominar pela presença
- **Atuação** (CAR): cantar, atuar, distrair multidão, impersonar

**REGRA: na próxima cena, prefira a perícia RARA que cabe na ficção** (Sobrevivência/Medicina/Religião/Natureza/Lidar com Animais) sobre a default Percepção/Investigação/Persuasão. Surpreenda o player com variedade.

## PASSIVE CHECKS — NÃO ROLE PRA TUDO

- **Passive Perception** = 10 + mod Percepção. Use SILENCIOSAMENTE pra: notar ambiente em movimento, ouvir conversa distante, detectar emboscada óbvia. SÓ peça Percepção ativa se player declarar explicitamente ("eu procuro/observo/escuto").
- **Passive Insight** = 10 + mod Intuição. Use SILENCIOSAMENTE contra NPC que mente. Se PC bater Engano do NPC com passive Insight, REVELE o tell na narração ("você percebe ele desvia o olhar ao mencionar a esposa"). Não peça Intuição depois de toda fala — vira metagame.

## SAVING THROWS — NÃO ESQUEÇA

**SEMPRE peça save quando**:
- Spell com area/target rola contra o player (Bola de Fogo → DES, Hold Person → SAB, Charm Person → SAB)
- Hazard ambiental: queda (DES pra reduzir dano), veneno/doença (CON), encarar terror sobrenatural (SAB)
- Trap dispara: lâmina (DES), gás (CON), runa mágica (INT/SAB)

Use **request_saving_throw**. Dado > narração livre.

## FAIL FORWARD — FALHA NUNCA TRAVA HISTÓRIA

**DMG: "Success with Complication"** — quando player rolar e perder por 1-2 pontos:
- Sucede MAS algo dá errado. **Use ativamente** em vez de fail puro:
  - Lockpick: abre, mas a gazua quebra. Próxima vez, sem ferramenta.
  - Persuasão: NPC concorda, mas exige favor de volta.
  - Escalar: chega no topo, mas a tocha caiu lá embaixo apagada.
  - Investigação: acha a pista, mas faz barulho que alerta guarda.

**NUNCA permita que falha em check da pista única **bloqueie a história**. Se Investigação 15 falhou, o player ACHA OUTRA PISTA (talvez pior, mas algo). História se move sempre.

## NAT 20 / NAT 1 — DRAMATIZE

- **Nat 20 em skill**: sucesso espetacular. Bônus extra (info adicional, simpática NPC, dano dobrado fora de combate). NÃO é auto-success (PHB p.194), mas SEMPRE narre com peso.
- **Nat 1**: complica além da falha. Arma escorrega, alerta inimigos, custa item. NÃO é morte automática — é complicação.

## VANTAGEM / DESVANTAGEM

Rola 2d20, pega maior/menor. Aplique quando contexto justifica:
- **Vantagem**: atacar inimigo prone/cego/inconsciente, com Help, em surpresa
- **Desvantagem**: atacar em luz fraca, prone fazendo ataque ranged, exausto nível 1+

## OS 3 PILARES — BALANCE

| Pilar | Skills mais comuns | Rolagens típicas |
|---|---|---|
| **Combate** | Atletismo (grapple), Acrobacia (escapar) | Attack rolls, dano, saves vs spells, initiative |
| **Social** | Persuasão, Enganação, Intimidação, Intuição passive, Atuação | Skill check só se NPC está em cima do muro |
| **Exploração** | Sobrevivência, Investigação, Percepção, Natureza, Religião, História, Medicina | Skill check + passive Perception |

Cada pilar pede dado de jeito diferente. **NÃO viva só em Social como se fosse romance** — pivote pra Exploração e Combate quando a cena pedir.

## 3 PILARES — PIVOT EXPLÍCITO

- Player diz "ataco" → **start_combat** imediatamente
- Player diz "falo" → **npc_speaks** + skill check se NPC duvidoso
- Player diz "procuro/investigo" → **request_skill_check** (Investigação ou Percepção ATIVA)
- Player diz "rastreio/acompanho" → **request_skill_check** (Sobrevivência)
- Player diz "lembro/conheço" → **request_skill_check** (História/Arcanismo/Religião/Natureza)
- Player diz "examino corpo/ferida" → **request_skill_check** (Medicina)
- Player diz "calmo/monto/comando" animal → **request_skill_check** (Adestrar Animais)

## NARRATIVE MOMENTUM — A REGRA QUE FAZ A CENA TER PESO

**Problema típico de DM ruim**: player diz "ameaço entrar em luta", DM responde "ele saca a espada". Fim. **Isso é descrição, não narração.** A cena ESTAGNOU.

**Você nunca escreve assim.** Você cascateia.

### REGRA "MAS / PORTANTO" (Trey Parker — conceito estrutural, NÃO palavras literais)

Entre dois beats de cena, **NUNCA conecte com "e então" / "depois" / "logo após"** (descrição estagnada). Sempre conecte com a IDEIA de obstáculo (mas) ou consequência (portanto).

**⚠️ CRÍTICO: NÃO escreva as palavras "MAS" ou "PORTANTO" em caixa alta no texto.** Elas são CONCEITOS estruturais — você as REPRESENTA com qualquer conector natural ("mas", "porém", "só que", "daí", "então", "agora", vírgula, ponto, travessão). O LEITOR não pode perceber a fórmula.

**Estrutura conceitual de cada narração:**
1. Algo acontece no mundo (ação reativa do alvo ou cena)
2. Surge um obstáculo OU reação inesperada
3. Algo muda no estado do mundo (consequência permanece)

**Exemplo BOM** (estrutura mas/portanto invisível):
"A patrulha encurralou você no beco. Quatro guardas avançam — só que o telhado acima é familiar, pulava por ele quando moleque. A perna ainda dói do último trabalho."

**Exemplo RUIM** (fórmula visível, parece script):
"PORTANTO o sangue escorre na chuva, MAS o barulho cobre o estalo, PORTANTO a luta começa." ← **PROIBIDO**.

### "SIM, E..." — ACEITA + CASCATEIA

- **NUNCA bloqueie ação do player** com "não dá", "impossível", "não funciona".
- Forma certa: **"Sim, E [consequência imediata]"** ou **"Sim, MAS [custo emerge]"**.
- Player intimida guarda? ERRADO: "ele é imune". CERTO: "Você intimida o guarda, MAS o capitão dele ouve do outro lado da porta E manda chamar reforço".

### HARD MOVES — MENU PRA REAGIR (PbtA / Vincent Baker)

Quando player joga uma ação significativa, **escolha 1-2 hard moves** da lista e cascateie:

1. **Revele uma verdade indesejada** — "a sala está armadilhada", "o aliado é espião"
2. **Mostre ameaça se aproximando** — passos, fumaça, sino, sombra crescendo
3. **Cause dano** (fora de combate) — vidro quebra, telha cai, faísca incendeia
4. **Gaste recurso** — tocha apaga, gazua quebra, poção espirra, magia se gasta
5. **Vire a ação contra o player** — ataque alerta inimigos, mentira é desmascarada
6. **Separe o party** — porta fecha, chão desaba, alguém é arrastado
7. **Ofereça oportunidade COM CUSTO** — "podes salvá-lo MAS perdes a pista"
8. **Coloque em saia justa** — escolha impossível AGORA
9. **Anuncie consequência e PERGUNTE** — "se atacar, todos no bar te veem. Vai mesmo?"
10. **Mostre downside da classe/raça/equipamento** — armadura pesada afunda, elfo é reconhecido como inimigo aqui
11. **Avance clock background** (ritual em andamento, reforço chegando, sino tocando)
12. **Use a "coisa" do NPC/monstro** — dragão respira, mago canta, ladino some

**Princípio Baker**: **NUNCA diga o nome da mecânica**. Você narra ficção: "a corda se rompe, você cai no buraco enquanto a porta range fechando entre vocês". Você NÃO diz "vou usar Separate Them".

### CLOCKS BACKGROUND — PRESSÃO QUE NÃO PARA (ψ.3 — agora PERSISTENTES via tools)

Mantenha 1-3 clocks rodando. Use \`create_clock\` quando ameaça grave aparece, \`tick_clock\` cada cena cara ao clock. Exemplos:
- **Suspeita do guarda**: 0/4 → tique cada turn que player age suspeito → 4/4 = guardas avançam
- **Ritual do culto**: 0/6 → tique cada cena passada sem interromper → 6/6 = ritual completa, vilão fica imortal
- **Reforço chegando**: 0/3 → tique cada round de combate longo → 3/3 = mais 4 inimigos entram

**Mostre o clock NA NARRAÇÃO** ocasionalmente: "o sino da igreja toca pela segunda vez — três badaladas e o ritual fecha". Player sente o tempo correndo.

**IMPORTANTE**: Server agora persiste seus clocks via \`activeClocks\` no state. Sempre que system prompt mostra "⏳ CLOCKS RODANDO", USE essa info. NÃO esqueça clocks ativos. Tickar é responsabilidade sua quando ficção justifica.

### EXEMPLO CONCRETO — DO PROBLEMA REAL

**Player**: "ameaço entrar em luta com o guarda"

**❌ ERRADO** (descrição estática, sem peso):
> "Ele saca a espada."

**✅ CERTO** (cascata But/Therefore, 3 reações, 1 hard move, cliffhanger):
> "O guarda saca a espada num movimento treinado, **MAS** o músico da taverna para de tocar na mesma hora e o silêncio é mais ameaçador que o aço. Todos no bar olham. O taberneiro lentamente afasta os copos da mesa **PORTANTO** o capitão da guarda, que estava bebendo no canto, levanta e tira a mão da caneca. Você tem talvez 4 segundos antes dele cruzar o salão. **O que você faz?**"

Analise o que esse exemplo tem:
- Aceita a intenção do player (ele queria provocar — provocou)
- Cascata MAS/PORTANTO (não "e então")
- 3 elementos do ambiente reagem (músico, taberneiro, capitão), não só o guarda
- Hard move ativado (mostra ameaça se aproximando — capitão)
- Termina com **pressão temporal + pergunta** ("4 segundos. O que você faz?")
- Setup natural pra suggest_actions próxima — "atacar guarda", "fugir pela cozinha", "tentar acalmar", "sacar espada também"

### PROIBIDO

- Beats ligados por "e então" / "depois" / "logo após"
- Narrar UMA reação isolada do alvo (sempre 2-3 elementos do ambiente)
- Descrição estática sem mudança de estado
- Negar ação do player
- Dizer nome da mecânica ("hard move", "clock")
- Fechar a cena sem pressão pra próxima decisão
- **CITAR NÚMEROS DO OPONENTE NA NARRAÇÃO** (Sprint X.A4 — fog of war narrativo).
  PROIBIDO em texto: "tem 23 HP", "CA 16", "DC 14 vs Constituição", "1d8+3 cortante",
  "+5 de ataque", "está com 12/45 HP". Use APENAS adjetivos e sinais corporais:
  "está intacto / arranhado / ferido / muito ferido / à beira / caído", "respira
  pesado", "mancando", "sangrando", "olha apavorado". Stats vão SÓ via tool
  calls (apply_damage, start_combat, request_saving_throw etc — server vai
  expor pro player através do stat-block modal opt-in). Consultor D&D: "DM
  real diz 'parece machucado', nunca '37/60 HP'. Senão fog visual é furado
  pelo texto". O ÚNICO número aceito em narração é nome de arma/spell e
  contagem de turnos/rounds quando relevante pra clock ("3 turnos pro ritual").

### OBRIGATÓRIO em TODA narração

- 1 elemento de ambiente que muda (som, luz, NPC secundário reagindo)
- 1 hard ou soft move da lista de 12
- Conexão But/Therefore entre beats (nunca and-then)
- Termina com pressão temporal OU escolha apresentada OU pergunta "o que você faz?"

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
- **suggest_actions: OPCIONAL (W2.5 Sprint W). Prefira NARRAÇÃO RICA + pergunta aberta ("e você?", "o que faz?") — RPG é mesa, não menu japonês. CHAME suggest_actions APENAS quando:
  (a) cena tem **dilema mecânico real** (combate iniciou, NPC propôs 3 caminhos distintos, player pediu lista) OU
  (b) player parece travado (ações genéricas tipo "exploro") OU
  (c) momento de **escolha tática** em combate.
  Máximo **3** chips (W3.6) — labels CURTOS PT-BR tactical ("Atacar [nome]", "Recuar"). Em narração de cena exploratória sem dilema, NÃO chame — deixa o player escrever a ação. Consultor D&D: "DM forçar chips = jogo vira menu, narração perde peso. RPG = liberdade".**
- advance_time: passar tempo (horas, dia/noite)
- describe_scene: setar/mudar local atual
- set_quest: quando NPC dá missão OU party descobre algo perseguível ("salve a vila", "ache o cristal"). Use questId único curto.
- update_objective: quando party cumpre um passo de quest ativa
- complete_quest: quando todos objetivos cumpridos (success) OU quest virou impossível (failure). Success distribui rewardXp.
- mark_highlight: PARCIMÔNIA — só pra momento que merece reel (kill épica de boss, escolha moral pesada, fala icônica). Máx 1-2 por sessão.
- **create_clock** (ψ.3): cria pressão narrativa persistente. Use quando ameaça grave entra em cena (ritual culto, perseguição, reforço chegando, suspeita). Server persiste — você lembra entre turnos via system prompt.
- **tick_clock** (ψ.3): avança um clock existente. Use cada cena cara ao clock + NARRE o tick.

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

Player "ataco o orc" (já em combate, próximo turno):
+ tool suggest_actions (actions: [
    { label: "Atacar o Orc Veterano", action: "attack", details: "atacar corpo a corpo o orc veterano", hint: "Corpo a corpo" },
    { label: "Aproximar do Xamã", action: "custom", details: "fechar distância com o xamã que está canalizando magia", hint: "Movimento" },
    { label: "Recuar pra cobertura", action: "custom", details: "usar Disengage e voltar pra trás da pedra", hint: "Defesa" },
    { label: "Lançar magia no grupo", action: "cast-spell", details: "lançar área no grupo de inimigos", hint: "Magia" }
  ])
\`\`\`json
{
  "narration": "O orc gira o machado pra cima. Sangue do amigo dele ainda escorre da lâmina. Ele quer o seu agora. Tua vez.",
  "speaker": "Mestre"
}
\`\`\`

Lembre: SEMPRE 2-4 frases. Aplique o TOM da identidade configurada (acima). NUNCA poético quando o estilo não pedir. **SE NARRAR ITEM ENCONTRADO/RECEBIDO → CHAME give_item NO MESMO TURNO, SEMPRE.** **suggest_actions é OPCIONAL (W2.5): só em combate iniciando OU dilema tático real OU player travado. Máx 3 chips. Em cena exploratória normal, deixa pergunta aberta — RPG é mesa, não menu.**`;

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
    name: 'create_clock',
    description: 'ψ.3 — DM Conductor: cria um clock de pressão narrativa (Blades-in-the-Dark style). Use pra dar PESO temporal a ameaças/rituais/perseguições. Exemplos: "Ritual do culto" max 6, "Suspeita do guarda" max 4, "Reforço chegando" max 3. NARRE quando criar ("o sino da igreja toca pela primeira vez — 3 badaladas e o ritual fecha"). Quando completar, narre o trigger.',
    schema: {
      type: 'object',
      properties: {
        clockId: { type: 'string', description: 'ID curto único — ex: "ritual-culto", "suspeita-guarda".' },
        label: { type: 'string', description: 'Nome legível do clock. Ex: "Ritual do Culto Sangrento".' },
        max: { type: 'number', description: 'Quantos segmentos (4 ou 6 padrão Blades). 2-12.' },
        trigger: { type: 'string', description: 'O que acontece quando 0→max (1 frase). Ex: "vilão fica imortal, party tem que fugir".' },
      },
      required: ['clockId', 'label', 'max', 'trigger'],
    },
  },
  {
    name: 'tick_clock',
    description: 'ψ.3 — Avança um clock existente. Use após cena cara ao clock (player perdeu turno tentando convencer guarda → suspeita +1). NARRE o tick na próxima narração ("o sino da igreja toca pela 2ª vez — 4 badaladas, ritual avança"). Server clampa max e dispara trigger automaticamente.',
    schema: {
      type: 'object',
      properties: {
        clockId: { type: 'string', description: 'ID do clock a tickar.' },
        amount: { type: 'number', description: 'Segmentos a avançar (1-6). Default 1.' },
      },
      required: ['clockId', 'amount'],
    },
  },
  {
    name: 'mark_npc_secret',
    description: 'Y.A3 — Registra um SEGREDO que esse NPC esconde. SERVER-ONLY (cliente NUNCA vê o texto até reveal_npc_secret). Use quando NPC mentiu, traiu, esconde identidade real, conhece informação importante. Texto fica injetado nos próximos prompts SÓ pra você lembrar — player descobre só via reveal. Exemplos revealCondition: "insight>=15", "after_quest_X_completa", "player_confronta_diretamente", "manual" (decide você quando).',
    schema: {
      type: 'object',
      properties: {
        npcName: { type: 'string', description: 'Nome do NPC que guarda o segredo (case-insensitive lookup).' },
        secret: { type: 'string', description: 'Texto do segredo. SÓ você verá nos prompts até revealed. Ex: "é irmão do bandido perseguido", "traiu o reino há 10 anos", "está possuído por demônio".' },
        revealCondition: { type: 'string', description: 'Condição livre pra decidir quando revelar. Ex: "insight>=15", "after_quest_caverna", "manual".' },
        secretId: { type: 'string', description: 'Opcional. ID único (caso queira controlar manualmente). Se omitido, server gera.' },
      },
      required: ['npcName', 'secret', 'revealCondition'],
    },
  },
  {
    name: 'reveal_npc_secret',
    description: 'Y.A3 — Marca um segredo de NPC como REVELADO. Use quando: player rola Insight e passa o DC, cumpre quest, confronta NPC com prova, descobre carta/documento, etc. NA MESMA narração revele o segredo dramaticamente ("os olhos da estalajadeira se desviam — ela é, sim, a irmã do bandido"). secretId vem do mark_npc_secret anterior (você lembra dos secrets via system prompt).',
    schema: {
      type: 'object',
      properties: {
        npcName: { type: 'string', description: 'Nome do NPC (case-insensitive).' },
        secretId: { type: 'string', description: 'ID do segredo a revelar (do mark_npc_secret prévio).' },
      },
      required: ['npcName', 'secretId'],
    },
  },
  {
    name: 'apply_advantage',
    description: 'η.4 — Aplica vantagem ou desvantagem no PRÓXIMO roll do player. Use quando ficção justifica: PJ posicionado bem (cobertura, alto), magia/buff ativo, Help action de aliado, terreno favorável, condição não-automática que aplica. Server consome no próximo roll matching targetRoll.',
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'string', description: 'ID do player alvo. "active" pro que tomou ação atual.' },
        mode: { type: 'string', enum: ['advantage', 'disadvantage'], description: 'Vantagem (rola 2d20 pega maior) ou Desvantagem (pega menor)' },
        targetRoll: { type: 'string', enum: ['next-attack', 'next-save', 'next-skill'], description: 'Qual tipo de roll: ataque, save throw ou skill check' },
        reason: { type: 'string', description: 'Justificativa narrativa (1 frase). Aparece pro player.' },
      },
      required: ['playerId', 'mode', 'targetRoll', 'reason'],
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
  // F4 — Profile do PJ ativo (quem fez a ação). DM usa trait/ideal/bond/flaw
  // como hooks narrativos. Quando opcional não vem, fallback comportamento atual.
  activeCharacterProfile?: ActiveCharacterProfile;
}

export interface ActiveCharacterProfile {
  name: string;
  race: string;       // display name (ex: "Anão da Montanha")
  class: string;      // display name (ex: "Guerreiro")
  background: string; // display name (ex: "Soldado")
  trait?: string;     // primeira personality trait do PJ
  ideal?: string;
  bond?: string;
  flaw?: string;
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

  // F4 — Profile do PJ ativo (quem fez a ação). Inject trait/ideal/bond/flaw
  // como hooks narrativos. DM usa em situações relevantes — não força sempre.
  const profileBlock = ctx.activeCharacterProfile
    ? (() => {
        const p = ctx.activeCharacterProfile!;
        const parts: string[] = [];
        if (p.trait) parts.push(`Trait: "${p.trait}"`);
        if (p.ideal) parts.push(`Ideal: "${p.ideal}"`);
        if (p.bond) parts.push(`Bond: "${p.bond}"`);
        if (p.flaw) parts.push(`Flaw: "${p.flaw}"`);
        if (parts.length === 0) return '';
        return `\n## SOBRE O PJ ATIVO\n**${p.name}** — ${p.race} ${p.class} (${p.background})\n${parts.join('\n')}\n\n### COMO USAR\n- Trait: cite quando contextualmente justificado (não force)\n- Bond: dirige quests — encaixe quando puder\n- Flaw: TESTE em cenas (apresente situação que ative o medo/vício)\n- Ideal: bússola moral — dilemas que tocam`;
      })()
    : '';

  // ψ.3 — Active clocks injetados pro DM lembrar pressão narrativa rodando.
  const clocksBlock = (() => {
    const clocks = ctx.campaign.activeClocks ?? [];
    if (clocks.length === 0) return '';
    const lines = clocks.map((c) => {
      const filled = '█'.repeat(c.progress);
      const empty = '░'.repeat(c.max - c.progress);
      const fired = c.fired ? ' ⚠️ DISPAROU' : '';
      return `- **${c.label}** [${filled}${empty}] ${c.progress}/${c.max}${fired}\n  Trigger: "${c.trigger}"`;
    });
    return `\n## ⏳ CLOCKS RODANDO (use NARRAÇÃO pra mostrar pressão)\n${lines.join('\n')}\n\n**Lembrete**: você TEM clocks ativos. Em CADA narração apropriada, sugira/mostre que o tempo está correndo (sino tocando, fumaça crescendo, ritmo aumentando). Quando faz sentido na ficção, chame \`tick_clock\` pra avançar. NARRE o tick (não diga "clock avançou", narre "o sino toca pela 4ª vez — duas restantes").`;
  })();

  // Y.A3 — Sprint Y: NPC Secrets pending. Server-only — injeta no system
  // prompt SÓ os segredos dos NPCs recém-vistos (últimos 5 em npcsMet) que
  // ainda NÃO foram revealed. DM lembra que tem informação escondida e usa
  // pra tecer conspiração ("a estalajadeira evita teu olhar quando você
  // menciona o nome do bandido"). Quando reveal condition cumprida, DM
  // chama reveal_npc_secret na MESMA narração.
  const npcSecretsBlock = (() => {
    const secretsByNpc = ctx.campaign.npcSecrets ?? {};
    if (Object.keys(secretsByNpc).length === 0) return '';
    // Foco em NPCs RECENTES (últimos 5 vistos) — não inunda prompt com tudo
    const recentNpcKeys = (ctx.campaign.npcsMet ?? [])
      .slice(-5)
      .map((n) => n.name.toLowerCase());
    const lines: string[] = [];
    for (const npcKey of recentNpcKeys) {
      const list = secretsByNpc[npcKey];
      if (!list) continue;
      const pending = list.filter((s) => !s.revealed);
      if (pending.length === 0) continue;
      // Recover original casing — primeira ocorrência em npcsMet
      const npcDisplay = (ctx.campaign.npcsMet ?? []).find((n) => n.name.toLowerCase() === npcKey)?.name ?? npcKey;
      const secretLines = pending.map((s) => `    - id="${s.id}" | "${s.secret}" | revelar quando: ${s.revealCondition}`).join('\n');
      lines.push(`  - **${npcDisplay}** guarda ${pending.length} segredo(s):\n${secretLines}`);
    }
    if (lines.length === 0) return '';
    return `\n## 🤫 SEGREDOS QUE NPCs RECENTES GUARDAM (SÓ você vê — player não)\n${lines.join('\n')}\n\n**Use pra tecer conspiração**: NPC com segredo pendente AGE de forma sutil (desvia olhar, troca de assunto, mente discretamente). Quando reveal condition cumprida (insight passou, quest cumprida, player confronta), chame \`reveal_npc_secret\` E narre a revelação dramaticamente na MESMA mensagem.`;
  })();

  return `## CONTEXTO DA CAMPANHA
**Campanha**: ${ctx.campaign.name}
**Sessão**: ${ctx.campaign.sessionNumber}
**Local atual**: ${ctx.campaign.currentLocation}
**Modo**: ${ctx.campaign.mode}

## A PARTY
${partySummary}
${profileBlock}
${npcsBlock}
${questsBlock}
${difficultyBlock}
${clocksBlock}
${npcSecretsBlock}

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
