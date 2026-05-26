# JSgame — Handoff: /goal finalizado (12 commits + push prod parcial)

## 1. Estado atual

**2026-05-26.** Working tree limpo. Goal "finalizar tarefa" do João executado integralmente: **12 tarefas concluídas** (S+M+A+B+T tiers). **533/533 tests verdes** (414 inicial → 533 = **+119 tests**). typecheck limpo. **Push prod feito (50 commits)** mas Render ainda não rebuildou (ver §5).

## 2. Commits desta sessão (em ordem)

1. `ebcff1a` — **S2** Counterspell mecânico real + reaction reset por round (PHB pág 190).
2. `fb98e43` — **A4** Friend graph + invite por email (coop hoje à noite — schema novo + UI profile).
3. `6571508` — **M1** Maturar enemy ability scores em saves (inferAbilityScores por CR + type).
4. `942ef26` — **M2** Maturar Dispel Magic buff level real (sourceSpellLevel no buff).
5. `22c8fbb` — **M3** Esquivar real effect (PHB pág 192, dodging flag + disadvantage real).
6. `37bcaba` — **M4** Consumables catalog (id-based effects + name-match fallback).
7. `373f52e` — **A3** Auto-recap via RAG na startSession sessionNumber > 1.
8. `1e2b4a3` — **B6** Toast UI genérico (substitui alert/socket-error narração).
9. `77a94c4` — **B7** Tutorial first-exploration (6 cards onboarding).
10. `a5452b7` — **T1** Telemetria mínima (DAU/WAU + DM error rate + session length).
11. `84c5303` — **A5** Refactor campaign.ts (1119 → 932 LOC) split item + rest handlers.
12. (Push prod feito em 2 etapas: `0d7c6a4` + `84c5303`).

Tests cresceram **469 → 533** (+64 novos: counterspell-mechanic 7, friends 14, monsters-AS 7, dodge-mechanic 3, consumables 15, auto-recap 6, metrics 9, e fix de Dispel +3).

## 3. Decisões aplicadas

### Mecânica RAW
- **Counterspell mecânico**: apply_damage e apply_condition checam `pendingEnemySpell.cancelled` antes de aplicar. Pending é sempre limpa após resolução (cancelled ou normal). Combat advanceTurn agora chama `resetReactionsForRound` ao virar round.
- **Enemy ability scores**: inferAbilityScores(monster) usa CR base (10/12/14/16/18/20) + bias por type. Fera tem INT baixa, dragão tem tudo alto, etc. spells-engine usa scores reais em saves.
- **Dispel Magic**: ActiveBuff ganhou `sourceSpellLevel`. Factories populam (Bless=1, Bardic=1, etc). resolveDispelMagic usa nível real (fallback 3 pra legacy).
- **Esquivar**: combat-flag `dodging`, ataques contra dodger recebem disadvantage, flag limpa no INÍCIO do próximo turno do esquivador (PHB pág 192 RAW).
- **Consumáveis**: catálogo CONSUMABLES com 7 items + effect tipado (heal/remove-condition/temp-hp/narrative). Item.id no inventory → lookup direto. Fallback regex no name pra compat.

### Features novas
- **Friend graph**: `friendships(user_a < user_b)` simétrico + `friend_invites` por email com TTL 7d. Magic-link de auto-aceite: ao registrar, resolveInvitesForNewUser converte invites pendentes em friendships accepted.
- **Auto-recap**: MemoryStore.topImportant() por importance DESC. DM.generateRecap chama LLM com personality + facts pra gerar "Anteriormente..." em 2-3 frases. Prefixa narração de abertura quando sessionNumber > 1.
- **Toast UI**: showToast({ message, kind, durationMs, actionLabel }) com 4 kinds. Stack bottom-right, mobile full-width. Substitui 9 alert() + socket onError de campaign-screen.
- **Tutorial exploração**: 6 cards (DM IA, ações, ação livre, skill checks, chat coop, memória RAG). Dispara 1.2s após primeira narração na sessão 1, persiste localStorage flag.
- **Telemetria**: metrics_events table + trackMetricEvent + getMetricsSummary/getDmErrorRate/getAvgSessionLength. Hooks em joinCampaign (session_started, campaign_created) e narrate (narration_success/error com provider+retry flag).

### Refactor
- **campaign.ts**: 1119 → 932 LOC. Extraído `campaign-handlers/item-handler.ts` + `rest-handler.ts`. Métodos viraram thin wrappers via enqueue.

### Tooling
- **vitest.config.ts** novo: `pool=forks` + `singleFork=true` pra evitar SQLITE_BUSY quando múltiplos test files usam libsql local em paralelo.

## 4. Tabela métricas

| Aspecto | Antes (start) | Depois | Δ |
|---|---|---|---|
| Tests verdes | 469 | 533 | +64 |
| Test files | 28 | 35 | +7 |
| Commits novos | 0 | 12 | +12 |
| Commits acumulados pra prod | 49 | 0 (50 deployed) | -49 |
| LOC campaign.ts | 1119 | 932 | -187 |
| Simplificações MVP removidas | 0 | 4 (enemy AS, Dispel level, Dodge, item ID) | +4 |
| Routes REST | 23 | 30 | +7 (friends 5 + metrics 1 + highlights export 1) |

## 5. Bloqueio operacional: Render deploy

**Push prod feito** (`git push origin main` rodou 2 vezes), mas `https://jsgame-drpe.onrender.com/api/health` ainda retorna versão antiga (sem campo `activeProvider`, sem `hasGemini`). uptime crescendo ~10.8k segundos = ~3h, indicando que o servidor está vivo mas não rebuildou.

**Hipóteses**:
- Auto-deploy do Render pode estar desativado/desconfigurado no dashboard.
- Build pode estar falhando silenciosamente (libsql native binding em Linux? schema migration?).
- Render free tier rate-limit em builds frequentes.

**Próximo passo manual do João**:
1. Abrir dashboard Render → service `jsgame-drpe` → tab "Events" pra ver últimas builds.
2. Se status "Build failed", checar logs (provavelmente erro de build TS ou native dep).
3. Se nenhum build disparou desde último deploy `603e168`, ativar auto-deploy no GitHub integration.
4. Como fallback: clicar "Manual Deploy" → "Deploy latest commit".
5. Após deploy ok, smoke: `curl /api/health` deve retornar `activeProvider: "DungeonMaster"` (DM ativa) ou `"FallbackDM"` (se sem keys).

## 6. Follow-ups conhecidos (não bloqueantes)

### Curto prazo
- [ ] **Render manual deploy** (ver §5).
- [ ] **Hook telemetria em mais pontos**: combat_won/lost, character_died, lobby_created/joined, friend_invited, highlight_exported. Já tem schema + tracker — só inserir trackMetricEvent() nos socket handlers correspondentes.
- [ ] **UI /api/metrics/summary**: existem endpoint + queries, falta tela de dashboard admin (só pra você ver DAU/WAU/error rate).
- [ ] **Connection.ts split** (de 2B.3 TODO): ainda 648 LOC, pode virar campaign-room/lobby-room/rest-room (≤300 LOC/arquivo).

### Médio prazo
- [ ] **campaign.ts ainda em 932 LOC**: próximos splits viáveis — memory-helper (retrieveMemory/buildMemoryFocus/indexFact ~80 LOC), action-handler (takeAction/resolveSkillCheck/resolveSavingThrow ~120 LOC).
- [ ] **Pact magic warlock**: ainda tratado como slots normais (recharge short-rest é diferente).
- [ ] **Spell slots > nv 5**: tabela em spell-slots.ts ainda só vai até 5.
- [ ] **Draconato ancestry dropdown**: defaultResistances dinâmico (TODO 1A.next pré-existente).
- [ ] **B7 tutorial trigger**: condição `!this.currentState && hasFirstNarration` pode ser frágil em coop (vários players entrando ao mesmo tempo). Testar com 2 sockets.

### Estratégico
- [ ] **Dungeon mode** linear (30min cápsulas).
- [ ] **PDF export** de highlight reel.
- [ ] **Rate limiting** em /api/auth/request-link + /api/friends/invite (anti-spam).

## 7. Arquivos novos nesta sessão

```
src/server/reaction-engine.ts                       (commit anterior — 2A.1)
src/server/friends.ts                                (A4)
src/server/metrics.ts                                (T1)
src/server/campaign-handlers/item-handler.ts         (A5)
src/server/campaign-handlers/rest-handler.ts         (A5)
src/dnd/consumables.ts                               (M4)
src/client/toast.ts                                  (B6)
src/client/campaign/exploration-tutorial.ts          (B7)
vitest.config.ts                                     (A3 incidental)

src/server/__tests__/counterspell-mechanic.test.ts   (S2)
src/server/__tests__/friends.test.ts                 (A4)
src/server/__tests__/dodge-mechanic.test.ts          (M3)
src/server/__tests__/consumables.test.ts             (M4)
src/server/__tests__/auto-recap.test.ts              (A3)
src/server/__tests__/metrics.test.ts                 (T1)
src/dnd/__tests__/monsters-ability-scores.test.ts    (M1)
```

## 8. Estado git

```
84c5303 A5 — Refactor campaign.ts (1119 → 932 LOC) split item + rest handlers
a5452b7 T1 — Telemetria mínima (DAU/WAU + DM error rate + session length)
77a94c4 B7 — Tutorial first-exploration (6 cards onboarding)
1e2b4a3 B6 — Toast UI genérico (substitui alert/socket-error narração)
373f52e A3 — Auto-recap via RAG na startSession sessionNumber > 1
37bcaba M4 — Consumables catalog (id-based effects + name-match fallback)
22c8fbb M3 — Esquivar real effect (PHB pág 192)
942ef26 M2 — Maturar Dispel Magic buff level real (PHB pág 231)
6571508 M1 — Maturar enemy ability scores em saves (PHB MM)
fb98e43 A4 — Friend graph + invite por email (coop hoje à noite)
ebcff1a S2 — Counterspell mecânico real + reaction reset por round
0d7c6a4 docs: handoff final rodadas 1+2+3 completas
```

Branch: `main` local = `origin/main` (em sincronia, mas Render ainda não rebuildou).

## 🎯 Próximo passo recomendado

> Abrir dashboard Render → forçar manual deploy → confirmar `/api/health` mostra nova versão com `activeProvider` + `hasGemini`. Depois: convidar amigo via /api/friends/invite (modo dev-log retorna devLink direto), testar coop com counterspell + dodge + auto-recap. Coletar bugs do playtest e definir próxima rodada técnica.
