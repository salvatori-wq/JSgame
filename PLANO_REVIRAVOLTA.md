# JSgame · Plano de Reviravolta — "Mestre vivo no bolso"

> Fruto de uma análise profunda (7 deep-dives paralelos: arquitetura · feel mobile ·
> game design · Mestre IA · testes · dados/coop/segurança · onboarding) + síntese +
> **crítica adversarial que verificou as afirmações no código**. Este doc já é o
> plano REVISADO (a crítica foi incorporada). É o que a próxima conversa executa.
>
> Régua inegociável do projeto: **o João joga e aprova no celular real** — nada de
> "verde headless". E **todo deploy só conta com hash do bundle confirmado no ar**
> (Render free pula auto-deploy silenciosamente — é o risco #1 histórico).

## North-star

**JSgame é um Mestre de D&D 5e vivo no seu bolso:** você toca, o Mestre começa a
escrever na hora, cada rolagem dá um soco de feedback imediato, e cada sessão de
30 min fecha com um cliffhanger que te puxa de volta amanhã.

> ⚠️ A north-star é **solo-first**. Há uma **decisão pendente do João** (tomar no
> início da execução): **coop é P0 ou distração?** O próprio diagnóstico diz que o
> coop "não tem razão de SER coop" (sem papéis interdependentes). Isso decide se os
> fixes coop-only (gate de `joinCampaign` por dono, IDOR de campaigns) entram agora
> ou ficam pra depois. Os fixes de segurança que valem **mesmo solo** (strip de
> segredos, IDOR de characters, gate do diag) entram de qualquer jeito.

## Diagnóstico raiz (a história por trás do "premium mas ruim")

Uma história só, em 4 camadas que se reforçam:

1. **Percepção de velocidade** — o jogo te faz esperar DUAS vezes: a geração INTEIRA
   do LLM (3–25s, **zero streaming** nos 6 providers — nenhum usa `stream:true`) e
   DEPOIS um **typewriter FALSO** que reproduz a 80 char/s o texto que já chegou.
   Entre o toque e o spinner ainda há um round-trip (o `isDmThinking` só acende
   quando o servidor ecoa `dmThinking`). O primeiro dado gira instantâneo — ótimo —
   mas a narração do resultado é LLM-gated com ZERO feedback no meio: **o ciclo de
   dopamina morre no silêncio do beat 2**.
2. **Render destrutivo** — `campaign-screen.ts` (2034 linhas) faz teardown+rebuild
   SÍNCRONO de toda a árvore (inclusive `renderCombatScreen` do zero) a cada
   broadcast. Um ataque dispara **5–7 `render()` completos** por cima das animações
   de dano recém-spawnadas, que morrem no meio. É o "stutter/patina" técnico que
   **nenhum dos 2231 testes headless vê** (happy-dom não faz layout;
   `getBoundingClientRect=0`).
3. **Núcleo vazio** — depois do cold-open (que é EXCELENTE: 13 cenas in-media-res,
   instantâneas, sem LLM), o jogo vira chat-com-dados infinito sem mundo autorado,
   sem missão-mãe, sem "amanhã". XP só vem de combate. O system prompt IMPLORA pro
   LLM forçar rolagens ("você QUEBROU a experiência") justamente porque **o loop
   não gera tensão sozinho** — é sintoma de design, não de prompt.
4. **Fundação sem fechadura** — `npcSecrets` (documentado SERVER-ONLY) vaza CRU nos
   7 `emit('campaignState')` (nenhuma função de strip existe no código);
   `joinCampaign` aceita qualquer `characterId` sem checar dono; `DELETE
   /api/characters/:id` não verifica ownership (IDOR). E **não há CI**: os 2231
   testes só rodam quando alguém digita `npm test`, e os testes da dor central
   (overlap mobile) são regex de string-CSS que nunca provam geometria.

**Resumo:** a engenharia é premium em ilhas (providers, NarrationLog, validação de
tool calls), mas o **caminho quente** — toque → resposta → render → próximo toque —
patina, e o motor narrativo é improviso sem destino com a porta destrancada.
**Não falta feature; falta o núcleo do loop funcionar e PARECER sólido.**

## Os números (medidos)

- `campaign-screen.ts` = **2034 linhas** (god-object, ~12 responsabilidades, 37
  métodos privados, 8 `this.render()` em handlers de socket).
- Bundle de caminho crítico: **~830 KB JS (258 KB gzip) + 288 KB CSS (54 KB gzip)** —
  tudo eager, inclusive o engine de música de **2589 LOC** que vem DESLIGADO.
- **16.980 linhas de CSS em 44 arquivos**; **367** ocorrências de `.is-portrait-narrow`
  em 18 arquivos, 78 `!important`.
- SYSTEM_PROMPT ~**11k tokens fixos** por chamada (5.2k regras + 5.6k de 25 tool defs)
  — enviado SEMPRE, mesmo em exploração simples.
- **174 arquivos de teste / 2231 testes** — mas **0 rodam em CI**, e 4 arquivos
  pulam TODOS os testes de DOM em silêncio (faltou `@vitest-environment happy-dom`).

---

## Execução — fases sequenciadas (a ordem importa)

> **NÃO** tentar em paralelo. Boundary + base primeiro (baixo risco, destravam o
> resto); depois as 3 reviravoltas em ordem; conteúdo e funil por último. Cada
> reviravolta termina com **GATE DE DEPLOY** (hash do bundle + `/api/health` uptime
> + telemetria) **e** João jogando.

### Fase 0 — Quick wins críticos (baixo risco, destravam tudo)

Tudo aqui é S/M, isolado, sem risco pro que funciona. Fazer LITERALMENTE primeiro.

- **0a · Fix do bug de ordem no `onState`** (3 linhas) — `campaign-screen.ts:398`
  reatribui `this.currentState=state` ANTES das linhas ~430-432 lerem como "estado
  anterior" → `wasInCombat`/`wasFightingBoss`/`transitionToCombat` computam do estado
  NOVO. **A detecção de transição de combate (vinheta, fanfarra de vitória, ring
  "passou pra você") está QUEBRADA hoje, em silêncio.** Capturar `prev =
  this.currentState` antes do reassign. *(Crítica confirmou no código.)*
- **0b · `toClientCampaignState(state, viewerId)`** — strip de `npcSecrets` (envia só
  `{revealed:true}`) em TODOS os 7 `emit('campaignState')` (`helpers.ts:27` +
  `connection.ts:201,806,841,861,882,944`) + 1 teste guard que FALHA se `npcSecrets`
  aparece no payload. Fecha o vazamento da feature inteira do Sprint Y.
- **0c · IDOR solo-relevante** — `requireOwnership` no `DELETE`/`GET`/`POST` de
  `characters` com `:id` (`api.ts:470,481,538`) reusando a lógica de
  `partyCharacterIds`. Gate `/api/dm/diag` atrás de `req.user`/`ADMIN_TOKEN` (queima
  quota LLM por hit anônimo, `api.ts:74`).
- **0d · Debounce do `saveCampaign` por `campaignId`** — flush a cada ~2-3s em vez de
  por evento (hoje grava o JSON INTEIRO no Turso a cada ação/roll, 21 call-sites).
  **Crítico fazer ANTES do streaming** (streaming multiplica eventos/turno → write
  amplification no free tier). *(Crítica: estava nos quick wins da análise mas sumiu
  das iniciativas — recolocado aqui.)*
- **0e · rAF-coalesce dos 8 `this.render()`** — coalescer a rajada de broadcasts num
  único `requestAnimationFrame` (1 paint por rajada em vez de 5-7). Mudança localizada
  em `campaign-screen`. **MEDIR no celular se o "piscar" sumiu** — isso informa a
  decisão da Fase 3 (talvez só o coalesce já resolva 80% sem tocar na identidade do
  DOM).

**Ação do João nesta fase:** rotacionar o token Turso de produção no painel Render
(pendência repetida em vários handoffs — risco de segurança latente; só ele tem
acesso).

### Fase 1 — Rede de segurança real (CI + smoke + telemetria + testes-fantasma)

Sem isso, as reviravoltas seguintes correm às cegas. Vira a métrica de sucesso de
"verde headless" pra "o jogo abriu, narrou, rolou, lutou".

- **CI** — `.github/workflows/ci.yml`: `npm ci && npm run typecheck && npm test` em
  push/PR. **(Ação do João: habilitar escopo `workflow` no token OAuth do GitHub uma
  vez — o agente não consegue commitar `.github/workflows/*` sem isso.)**
- **Destravar os 4 testes-fantasma** — `// @vitest-environment happy-dom` no topo de
  `scene-pin`, `status-ribbon-sprint-w`, `combat-target-sheet` (13 testes!),
  `reward-juice` + remover o guard `if(typeof document==='undefined')`. Setar
  `environment: happy-dom` global pro `src/client` no `vitest.config` pra impedir
  recaída.
- **`src/test/setup.ts`** — `afterEach` limpa `body.className/innerHTML` +
  `restoreAllMocks`, via `setupFiles`. Mata o vazamento de `body.*` por construção
  (hoje é `afterEach` copiado em N arquivos). + **`src/test/factories.ts`**
  (`makeCharacterSheet`/`makeCampaignState`/`makeEnemy`).
- **`npm run smoke`** — sobe o server com um `DMProvider` **FAKE determinístico**
  (respostas canned), dirige 1 sessão E2E (prefab → cold-open → skill check →
  `start_combat` → attack → kill → XP) e faz assert no `CampaignState`. **Roda LOCAL,
  independente do `ci.yml` estar commitado** (desacopla do gate humano do João).
  6-10 testes "golden" de integração `prompt→tool→state` — pega a classe de bug que
  mais machucou o JOGO (V.2 "narra lindo mas combate nunca inicia", M1 "vitória dá 0
  XP") e que nenhum unit test viu.
- **Telemetria de campo** *(o "bigger bet" da crítica)* — instrumentar
  `time_to_first_token` e `beat2_silence_ms` no `ux-funnel` que já existe. É como se
  PROVA a reviravolta em produção sem depender só da impressão do João — ataca o
  gargalo de velocidade real do projeto (todo handoff diz "confirmar no celular").
- **Decidir o destino do `scripts/e2e`** morto (ressuscitar 3 cenários como smoke
  real OU deletar — o meio-termo atual finge cobertura E2E).

### Fase 2 — REVIRAVOLTA #1: Streaming ponta-a-ponta + feedback otimista

A única mudança que SOZINHA transforma a percepção de velocidade do jogo inteiro e
ataca a dor exata do João. Texto começa a aparecer em ~1s em vez de 5-15s de spinner
morto.

- `generateStream()` no `DMProvider` (`base.ts`); implementar em Groq/Cerebras (SSE
  OpenAI-style) e Gemini.
- Novo socket event `dmNarrationChunk` emitindo deltas conforme chegam.
- `narration-log` renderiza os deltas REAIS; **DELETAR o typewriter fake**
  (`startTypewriter`, 80 char/s) que adiciona segundos sobre texto já recebido.
- `takeAction` acende `isDmThinking=true` + shimmer **LOCALMENTE no MESMO frame do
  tap** (otimismo), sem esperar o eco `dmThinking` do servidor.
- **BEAT INSTANTÂNEO no skill-check** — no `diceRollResult`, ANTES da narração do
  Mestre, mostrar veredito local visceral ("SUCESSO — você notou a emboscada" /
  "FALHA") derivado de `success/nat20/nat1` que JÁ vem no payload, com SFX+cor; o
  servidor manda 1 frase-template de resultado JUNTO do dado. Mata o silêncio do beat
  2 sem esperar LLM.
- Enxugar **tool-set por modo** (exploração ~6 tools, combate o set de combate) +
  cortar redundância do prompt de regras — menos tokens, menos latência, mais quota.

> 🚧 **CONTINGÊNCIA OBRIGATÓRIA antes de codar (a crítica martelou nisso):** streaming
> + tool calls é onde o bug **V.2** ("DM narra lindo mas combate NUNCA inicia" por
> perder `toolCalls`) vai renascer. O fix atual (snapshot de `originalToolCalls` antes
> do retry-sem-tools, BUG-001 recovery) assume uma resposta única **buffered** de onde
> se extrai narração E tools. Streaming quebra essa premissa. **Decidir e documentar
> ANTES:** streamar SÓ a narração textual; resolver tool calls no fim do stream;
> definir o que acontece quando o stream termina com `tool_calls` + narração VAZIA
> (caso comum em Groq/Gemini) e como o retry-sem-tools opera num mundo streamado.
> Cobrir com os testes golden da Fase 1 ANTES de ligar em prod.
>
> ⚠️ **Fog-of-war linter** (`dm.ts:195-230`): não "sempre sanitize" (degrada a north-
> star "Mestre vivo" em 10-15% dos turnos). **Gated por gravidade**: só HP-fração-
> exposta faz o retry; o resto sanitiza inline (instantâneo).

**GATE DE DEPLOY (obrigatório):** Manual Deploy → confirmar hash do bundle novo no ar
+ `/api/health` uptime resetou + `time_to_first_token` caiu na telemetria → SÓ ENTÃO
o João joga e aprova "o texto começa em ~1s".

### Fase 3 — REVIRAVOLTA #2: Render que não pisca (decisão GATED por evidência)

> A crítica foi enfática: a reescrita de `combat-screen` pra `update()` granular é **a
> maior armadilha de regressão do plano** (reintroduz stale-state, a classe de bug que
> o CLAUDE.md marca "não rediscutir") e happy-dom não pega nenhum desses bugs. Por isso
> esta fase é **gated por evidência**, não uma promessa upfront.

- Já fizemos o **rAF-coalesce + fix do onState** na Fase 0. **MEDIR no celular real**
  se o "piscar" sumiu.
- **SE o coalesce já resolveu ~80%** → parar aqui (não tocar na identidade do DOM).
- **SE ainda pisca** → `combat-screen` (e party) viram componentes com `update(state)`
  que MUTAM o DOM in-place (textContent/classList, **key estável por id** de
  inimigo/PJ, igual o `NarrationLog` já prova funcionar); só recriar a `<section>`
  quando a estrutura muda (inimigo entra/sai). Extrair selector puro `isMyTurn(state,
  id)` (reusar nos 3 pontos que recomputam à mão) → os 15 toggles de `body.classList`
  viram efeito de 1 subscriber. **Validar no celular real, com key estável + selectors
  testados.**

> Nota da crítica: streaming (Fase 2) e este render se encontram no `narration-log`.
> O `NarrationLog` já é o componente-exemplar com `update()` que esta fase cita como
> modelo — checar se o append incremental do streaming já não resolve parte do que
> esta fase quer (evitar retrabalho).

**GATE DE DEPLOY + João ataca no celular e vê o número de dano flutuar e assentar
sem a tela piscar/resetar scroll, em combate real.**

### Fase 4 — REVIRAVOLTA #3: Esqueleto autorado + cliffhanger (dar destino ao núcleo)

> A crítica apontou: variedade de cold-open e adventure-seeds são a **MESMA dimensão**
> de conteúdo autorado. **Planejar juntos**, reusar infra.

- **5-8 "Adventure Seeds"** como DADOS estruturados no servidor (objetivo central
  nomeado + vilão com nome/motivo + 3-5 beats + recompensa + 1 reviravolta). O servidor
  injeta o esqueleto no prompt como TRILHOS (LLM improvisa a TEXTURA, servidor garante
  começo→meio→fim+clímax) e rastreia progresso em `CampaignState`.
- **Director server-side** — avançar `activeClocks` (infra JÁ existe) DETERMINISTICAMENTE
  por turnos decorridos e injetar o próximo beat no prompt ("o clock X chegou em N —
  narre a consequência ESTE turno"), em vez de implorar pro modelo lembrar.
- **Cliffhanger persistido** ao fim de cada sessão + promessa concreta ("o sino do
  culto bate em 3 dias") que vira a abertura forçada da próxima. Exibir no
  `continue-card` como isca ("Restam 2 badaladas").
- **XP/recompensa por marco NÃO-combate** (skill check crítico, objetivo de quest, NPC
  salvo) reusando `update_objective`/`complete_quest`.
- **Variedade de cold-open (junto):** sortear 2-3 cold-opens por background/prefab
  (desacoplar do background fixo — hoje quem reroda o mesmo prefab vê a MESMA cena, e
  só 3 de 13 cold-opens são alcançáveis pelo caminho rápido).

> ⚠️ Risco (mitigar): trilhos rígidos demais matam a improvisação que hoje é o charme.
> Seeds dão objetivo+beats+clímax; a TEXTURA é 100% improvisada. Testar com o João se
> ainda "sente livre".

**GATE DE DEPLOY + João termina uma sessão, vê o cliffhanger no continue-card, volta no
dia seguinte e a abertura cobra a promessa.**

### Fase 5 — Onboarding limpo + home de conversão (quick wins de funil)

Baratos e de alto ROI, mas só DEPOIS do núcleo sólido.

- **Deletar `exploration-tutorial.ts`** (6 cards, tutorial morto funcional substituído
  pelo Duolingo) + remover o branch em `campaign-screen.ts:834+`.
- **Cortar o Duolingo de 7 → 2-3 passos** just-in-time (narração, ação, chip-skill;
  party/tab-bar são descobríveis).
- **Card "Surpreenda-me"** no "Jogar Já" (`randomizeWizardState` já existe → cria →
  entra direto), abrindo os 10 cold-opens restantes sem as 8 telas do wizard.
- **Adiar o install-banner** até DEPOIS do 1º roll/sessão (gate por flag "já jogou").
- **Home de conversão pro novato** (sem `lastSession`/sem PJs): 1ª tela = hero + 3
  prefabs gigantes, zero scroll até a ação; esconder coop+crônicas+cemitério.

### Fase 6 — Boot/bundle (por último; cuidado com o vespeiro do CSS)

- **Code-split por rota** — lazy `import()` de `CampaignScreen`/`Wizard`/`Lobby`/`Sheet`/
  `Profile` no router de `main.ts` (cada um vira chunk). Meta: home pinta com <120 KB
  gzip.
- **Lazy-load todo o engine de música** (2589 LOC) atrás do toggle de Ajustes — vem OFF,
  ninguém ouve, todo mundo baixa. `setAmbient`/`playStinger` viram no-op até carregar.
  SFX procedural core fica eager.
- **SW cache-first** com revalidação pros `/assets/*` hashados (imutáveis por hash) —
  para de re-baixar 312 KB na 2ª visita online.
- **modulepreload** do bundle + **self-host das fontes** Cinzel/Cardo (woff2).
- Remover os `import()` dinâmicos de toast/ui-modal/humanize-error que o Vite avisa que
  não movem de chunk (ruído).

> ⚠️ **NÃO quebrar `styles.css` por rota agora** — a crítica pegou a contradição: o
> sistema responsivo é "patchwork de 367 overrides + 78 !important", e dividir o CSS
> num sistema desses, no exato ponto da dor mobile (overlap), é altíssimo risco de FOUC.
> Fazer SÓ o JS code-split + lazy audio + SW. O split de CSS fica pra depois do
> responsivo ser estabilizado (que NÃO é deste ciclo).

---

## O que NÃO fazer (anti-escopo — reforçado pela crítica)

- **NÃO tocar no motor de regras D&D 5e** (`src/dnd/*`, combat/spells/saving-throw/
  concentration/death-saves) — está correto, 105+ testes verdes; é a parte que FUNCIONA.
- **NÃO mexer no áudio/trilha generativa além de LAZY-LOAD** — há uma **sessão de áudio
  paralela** afinando timbre por mood (handoff trilha-sonora-bardo). Só mover o engine
  pra chunk lazy; não reescrever composer/instruments/theory. **Verificar commits por
  conteúdo, rebase, nunca reset/force.**
- **NÃO adicionar feature NOVA antes de consertar o núcleo.** O diagnóstico é "100
  features rasas em cima de 1 loop que não é divertido". Resistir a mais
  tools/clocks/conquistas até streaming+render+conteúdo estarem sólidos.
- **NÃO confiar em "verde headless" como prova.** happy-dom não faz layout. Toda
  iniciativa de feel/render só está FEITA quando o João reproduz no celular real.
- **NÃO fazer o refactor XL do god-object de uma vez.** A separação deve EMERGIR da
  Fase 3 (componentes com `update()`); extrair incremental, 1 módulo por PR, com a
  suíte como rede. Big-bang rewrite quebra o que funciona.
- **NÃO reescrever o sistema responsivo** (367 overrides) neste ciclo — médio impacto,
  altíssimo risco de regressão visual. Por isso, também **não quebrar styles.css por
  rota** na Fase 6.
- **NÃO trocar a ordem do cascade** (Cerebras→Groq→Gemini) sem MEDIR via a telemetria
  `narration_success.effectiveProvider` que já existe (depois do streaming).
- **NÃO promover o `update()` granular do DOM (Fase 3) como certeza** — é decisão gated
  por evidência (medir se o rAF-coalesce já resolveu).

## Riscos (com mitigação)

| Risco | Mitigação |
|---|---|
| **Deploy fantasma** (Render free pula auto-deploy — risco #1 histórico) | **GATE obrigatório por reviravolta**: hash do bundle + `/api/health` uptime + telemetria, ANTES de declarar feito. João faz Manual Deploy. |
| **Streaming + tool calls** reintroduz o bug V.2 | Contingência documentada ANTES de codar; streamar só narração; tools no fim; testes golden cobrem o retry-sem-tools num mundo streamado. |
| **`update()` granular** reintroduz stale-state (proibido pelo CLAUDE.md) | Gated por evidência (medir o coalesce primeiro); key estável por id; selectors puros testados; validação no celular. |
| **Adventure Seeds** engessam a improvisação | Seeds dão objetivo+beats+clímax; textura 100% improvisada; testar com o João se "sente livre". |
| **CI bloqueado** por escopo `workflow` do token | `npm run smoke` roda LOCAL independente do `ci.yml`; CI espera a ação do João sem bloquear a Fase 2. |
| **Code-split** causa FOUC no boot mobile | modulepreload + font-display:swap + validar boot real no celular; **NÃO** dividir CSS por rota. |
| **Token Turso** sem rotação (latente) | Anexado à Fase 0 — ação do João no painel. |

## Ações que dependem do João (não-autônomas)

1. **Coop é P0?** — decisão que parte a Fase 0c (entram ou não os fixes coop-only).
2. **Habilitar escopo `workflow`** no token OAuth do GitHub (pra commitar `ci.yml`).
3. **Rotacionar o token Turso** de produção no painel Render.
4. **Manual Deploy** + confirmar bundle no ar a cada reviravolta (auto-deploy OFF).
5. **Jogar e aprovar** cada fase no celular real (a régua final).

## Estado ao escrever este plano

`origin/main` = `05447ac`. Já entregue (não re-propor): estabilização Fases 1-3
(menu fundido, música por loops OFF, failover do cascade) + limpeza (UI morta, toasts
3→1, log de combate duplicado). Suíte 2231 verde, tsc limpo. Sessão de áudio paralela
ativa no mesmo `main` (rebase, nunca reset/force).
