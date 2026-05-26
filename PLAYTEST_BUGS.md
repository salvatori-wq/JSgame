# JSgame · Playtest Bug Log — 2026-05-26

> Bugs encontrados durante playtest end-to-end (12 cenários F1-F12).
> Formato em PLAYTEST_PLAN.md §3.

## Bugs ativos

### BUG-002 — Tutorial exploração (B7) não dispara em rejoin

**Severidade**: P2 (cosmético — afeta primeira impressão de novo player)
**Área**: UI / client / tutorial
**Repro**:
1. `localStorage.clear()` em jsgame-drpe.onrender.com
2. Criar PJ → Nova Crônica
3. Esperar narração inicial
4. Esperado: 6 cards onboarding (`.exploration-tutorial`) aparecem 1200ms após primeira narração
5. Observado: tutorial nunca dispara. `localStorage['jsgame.tutorial.exploration.v1']` permanece `null`.

**Hipótese**: Race condition em [campaign-screen.ts:152](src/client/campaign/campaign-screen.ts:152) — trigger é `isFirstSession && hasFirstNarration && !this.currentState && shouldShowExplorationTutorial()`. Em rejoin, state arrives ANTES das narrações via socket → quando narration chega, `this.currentState` já está populado → `!this.currentState` é false → tutorial nunca dispara.

**Fix planejado**: Também checar dispatch quando narração nova chega (não só em state update). Algo como: em `onNarration`, se for primeira narração + isFirstSession + flag false → dispara.

**Tests cobertos?**: NÃO — adicionar test de unit do trigger.

### BUG-001 — Narração sempre vazia em prod (Gemini) ✅ FIXED em commit 67705ef

**Severidade**: P0 (app inutilizável — Mestre IA não narra nada)
**Área**: DM / providers
**Repro**:
1. Criar PJ qualquer
2. Iniciar Nova Crônica (solo)
3. Esperar 25s pela primeira narração
4. Esperado: parágrafo descritivo do Mestre (taverna, missão, etc)
5. Observado: entrada `<div class="cnn-text"></div>` com texto vazio. Speaker "Mestre" presente mas conteúdo zero.
6. Mesmo bug se repete em todas as ações subsequentes (explorar/investigar/etc) — narração sempre vazia.

**Console errors**: nenhum no client (página não loga erro nenhum).
**Network**: `/api/characters/:id` 200 OK. Socket events presumidamente chegando (entry rendered) mas com `text: ''`.

**Hipótese inicial confirmada**:
- Gemini 2.5 Flash retorna response com APENAS `functionCall` (sem `text` parts), porque o `toolConfig.mode: 'auto'` em `gemini.ts:89` permite ao modelo escolher entre narrar OU chamar tool.
- `gemini.ts:127` loop `for (const part of candidate.content.parts)` resulta em `text = ''` quando só tem functionCall.
- `dm.ts:103` `extractJson("")` retorna `{}`. Linha 105 `parsed.narration ?? response.text.trim()` → `undefined ?? ''` → `''`.
- Existing retry-without-tools só dispara em erros 400 (`dm.ts:82`) — não em texto vazio com 200 OK.

**Fix planejado**:
1. Em `dm.ts narrate()`: detectar `narration vazia + toolCalls.length > 0` após primeira tentativa → retry sem tools (mesmo padrão do retry de 400).
2. Em `dm.ts narrate()`: fallback graceful se ainda vazio após retry.
3. Trocar `parsed.narration ?? response.text.trim()` por `parsed.narration?.trim() || response.text.trim()` pra cobrir string vazia.
4. Mover `trackSuccess` pra DEPOIS da validação de narração (não trackear sucesso quando saiu vazio).

**Tests cobertos?**: NÃO — adicionar `dm-narration-recovery.test.ts` cobrindo:
- Mock provider que retorna `{ text: '', toolCalls: [...] }` na primeira call.
- Mock retry retorna `{ text: 'narração válida', toolCalls: [] }`.
- Verificar que dm.narrate retorna narration válida e retriedWithoutTools=true.

## Bugs fixed

### BUG-001 — Narração sempre vazia em prod (Gemini)
- **Commit**: 67705ef
- **Causa raiz**: Gemini 2.5 Flash com `toolConfig.mode='auto'` retornava 200 OK contendo APENAS `functionCall` (sem text part). `extractJson('')` retornava `{}` e `parsed.narration ?? response.text.trim()` resultava em `''`.
- **Fix**: Em `dm.ts narrate()`: (1) trocar `??` para preservar `''` literal; (2) retry sem tools quando narração vazia + toolCalls > 0; (3) graceful fallback se ainda vazio; (4) `trackSuccess` movido pra depois da validação.
- **Tests**: `dm-narration-recovery.test.ts` — 5 testes cobrindo retry, no-retry, graceful fallback, JSON com narration vazia literal, e sem-toolCalls sem retry.
- **Validação prod**: confirmed via Chrome MCP — primeira narração agora vem com texto completo no tom sombrio configurado.

## Hipóteses não validadas em e2e (code-review only — sem playtest)

Pra economizar tokens da API LLM (sessão constrained), os cenários abaixo não rodaram e2e completo. Coverage via unit tests existentes:

| Cenário | Status | Coverage |
|---|---|---|
| F2 personality | Code ✓ (1C tag visível no DOM) | `dm-personality.test.ts` 13 tests |
| F3 counterspell | Mecânica server testada | `counterspell-mechanic.test.ts` 7 tests; risco: same-batch race (DM emite enemy_casts_spell + apply_damage juntos — apply_damage não bloqueado porque cancelled ainda false) — não testado |
| F4 dodge | Mecânica testada | `dodge-mechanic.test.ts` 3 tests cobrem flag + disadvantage |
| F5 auto-recap | Mecânica testada | `auto-recap.test.ts` cobre sessionNumber>1 |
| F6 friend invite | Mecânica testada | `friends.test.ts` 14 tests; `resolveInvitesForNewUser` coberto |
| F7 highlights HTML | Mecânica testada | `highlights-export.test.ts` 8 tests cobre XSS-safe |
| F8 difficulty | Visível na UI ✓ | `combat-difficulty.test.ts` 5 tests |
| F9 UI badges | Visível na UI ✓ | classes cp-pj-conc/buffs/rage em campaign-screen.ts |
| F10 telemetria | Endpoint requer auth — defer | `metrics.test.ts` 9 tests |
| F11 item use | — | `consumables` no catálogo |
| F12 enemy AS | Testado | `monsters-ability-scores.test.ts` 7 tests |

### Risco residual identificado por code review

- **F3 race condition**: `dm-tool-applier.ts:50` apply_damage só bloqueia se `pendingEnemySpell.cancelled === true`. Se DM emite `enemy_casts_spell` + `apply_damage` no MESMO batch de tools (mesma response), pendingEnemySpell existe mas cancelled=false ainda, então apply_damage executa antes mesmo do client ver o modal. Counterspell window não tem chance. Mitigação: DM prompt instrui a esperar reaction antes de damage (não verificado). Recomendação: adicionar guard em dm-tool-applier — se pendingEnemySpell foi criada nesta MESMA execução de tool batch, abortar apply_damage e deixar pra próxima rodada do DM.

## Triage table

| Bug ID | Severidade | Área | Status | Batch |
|---|---|---|---|---|
| BUG-001 | P0 | DM/providers | ✅ fixed em prod (commit 67705ef) | 1 |
| BUG-002 | P2 | UI/tutorial | open — backlog | — |
| HYPOTHESIS-003 | P2 | combat/counterspell | open — code-review only, race teórica não-reproduzida | — |

