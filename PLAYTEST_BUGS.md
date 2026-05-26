# JSgame · Playtest Bug Log — 2026-05-26

> Bugs encontrados durante playtest end-to-end (12 cenários F1-F12).
> Formato em PLAYTEST_PLAN.md §3.

## Bugs ativos

### BUG-001 — Narração sempre vazia em prod (Gemini)

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

_aguardando primeiro batch._

## Triage table

| Bug ID | Severidade | Área | Status | Batch |
|---|---|---|---|---|
| BUG-001 | P0 | DM/providers | open — fixing | 1 |

