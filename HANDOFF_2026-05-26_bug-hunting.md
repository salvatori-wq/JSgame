# JSgame · Handoff — Bug hunting inteligente

## 1. Estado atual

**2026-05-26.** Working tree limpo. Tests 628/628 verde. Prod LIVE em https://jsgame-drpe.onrender.com com cascade Cerebras→Gemini→Groq ativo. Plano de bug hunting documentado em `BUG_HUNTING_PLAN.md`. Próxima sessão executa Sprints A-E.

## 2. O que foi feito nesta sessão

1. **BUG-001 fixed** — Narração vazia em prod (Gemini com toolConfig=auto retornava text=""). Commit `67705ef`. Retry sem tools quando vazio + toolCalls.
2. **Cascade multi-provider** — `CascadeProvider` faz failover Gemini→Groq→Anthropic em uma chamada. Commit `3ec24e8` + correção 70b-versatile `a19e68b`.
3. **Cerebras + Cloudflare providers** — 2 providers novos (Cerebras com gpt-oss-120b funciona, Cloudflare token sem scope Workers AI). Commit `4ebce2e`. Capacidade combinada ~47K calls/dia gratuitas.
4. **Sprint 1 Quick wins** — Tutorial trigger fix (BUG-002), markdown rendering XSS-safe, home filter por user, auto-recap paralelo (50% mais rápido), DM thinking visual prominente. Commit `892749c`. +27 tests.
5. **Sprint 2 Spell slots PHB completo** — Tabela nv 1-20 pra full/half/pact casters (BUG-004). Commit `ea421a5`. +24 tests.
6. **Sprint 3 Telemetria expandida** — Hooks combat_started/won/lost, character_created/died, lobby_created/joined, friend_invited. Endpoint `/api/dm/health` com provider rankings. Commit `a72571f`. +5 tests.
7. **Sprint 4 Pact magic short rest** — Bruxo regenera slots em short rest conforme PHB (BUG-005). Combat log capacity 20→50. Commit `9d389bb`. +2 tests.
8. **Sprint 5 Hide action** — Stealth check vs passive Perception derivada, advantage no próximo ataque, flag consumida ao atacar. Commit `e151f47`. +6 tests.
9. **Análise + plano bug hunting** — `BUG_HUNTING_PLAN.md` com 5 camadas de detecção (estática, property-based, e2e, observacional, adversarial) + 5 sprints A-E.
10. **Tests baseline 552 → 628** (+76 tests, +13.7%). Zero regressões. Todos sprints com TDD reverso (test escrito antes do fix).

## 3. Contexto técnico relevante

**Princípios estabelecidos** (NÃO violar na próxima sessão):
- TDD reverso obrigatório: test que falha antes do fix existir, depois fix, depois passa.
- Suite verde a cada commit (628/628 baseline). Tests pulados ou amarelos são bug.
- Commits atômicos: 1 sprint = 1 commit batch. Revert fácil se quebrar.
- Deploy + valida em prod entre sprints. Render manual deploy (não auto em push).
- Escopo cirúrgico: não introduz feature ao fixar bug.

**Padrões aplicáveis a bug hunting**:
- Hooks fire-and-forget: `void (async () => { try { ... } catch { /* ignore */ }})()` pra telemetria que nunca quebra fluxo.
- Lazy import pra evitar ciclos: `const { x } = await import('./mod.js')`.
- Pure functions extraíveis pra testar sem JSDOM (ex: `shouldTriggerExplorationTutorial`).

**Stack**:
- TS strict, vitest (single fork pra evitar SQLITE_BUSY), socket.io, sqlite/libsql, Express.
- Sem ANTHROPIC_API_KEY em prod (free-tier only).
- Provider ativo: `cascade(cerebras→gemini→groq)` confirmado em `/api/dm/health`.

**Tooling NÃO instalado ainda** (próxima sessão vai precisar):
- `fast-check` (property-based)
- `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` (mutation testing)
- `ts-prune`, `madge`, `knip` (dead code + cycles)

## 4. Padrão para property-based testing

Template aplicável a qualquer função pura — coloca em `__tests__/property-*.test.ts`:

```ts
// src/dnd/__tests__/property-dice.test.ts
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { rollDice } from '../dice';

describe('rollDice — property-based', () => {
  it('total sempre em [N + M, N*K + M]', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 4, max: 12 }),
      fc.integer({ min: -5, max: 10 }),
      (count, kind, mod) => {
        const r = rollDice(count, kind, mod);
        expect(r.total).toBeGreaterThanOrEqual(count + mod);
        expect(r.total).toBeLessThanOrEqual(count * kind + mod);
      }
    ), { numRuns: 5000 });
  });
});
```

Padrão pra fuzzing de API endpoint (próxima sessão pode replicar):

```ts
// scripts/fuzz-api.ts
import fc from 'fast-check';
fc.assert(fc.asyncProperty(fc.anything(), async (payload) => {
  const r = await fetch('http://localhost:3001/api/characters', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
  expect(r.status).toBeLessThan(500); // 4xx ok, 5xx é crash
}), { numRuns: 200 });
```

## 5. Follow-ups sugeridos

Bloqueante: nenhum. Tudo limpo, base sólida pra Sprint A.

Sugeridos (do `BUG_HUNTING_PLAN.md` §8):

- [ ] **Sprint A — Property-based testing** (3h) — fast-check em dice, spell-slots, combat damage, markdown XSS, encounter builder. Maior ROI. Catch edge cases que humanos não pensam.
- [ ] **Sprint B — Suite e2e formal** (4h) — 10 cenários smoke scripts standalone via Chrome MCP, orquestrados por `scripts/e2e/run-all.sh`.
- [ ] **Sprint C — Telemetria observacional** (2h) — endpoint `/api/dm/anomalies` + funnel analysis + slow query alert.
- [ ] **Sprint D — Adversarial probes** (3h) — 10 prompts EVIL (prompt injection, tool abuse, JSON poisoning, slot scam) com validação de state integrity pós-probe.
- [ ] **Sprint E — Static analysis + dead code** (2h) — ESLint rules adicionais, ts-prune, madge cycle detection, TS strict flags expandidas.

Opcionais (não relacionados a bug hunting):
- [ ] (opcional) Resolver Cloudflare Workers AI token — escopo "Workers AI - Read" pra ativar 4º provider no cascade.
- [ ] (opcional) Resistências em saving throws — schema `CharacterSheet.conditionImmunities` + DM tools (descartado em Sprint 4 por escopo grande).
- [ ] (opcional) Adicionar Anthropic Haiku API key — latência <3s consistente, $1/mês cap.

## 6. Arquivos-chave tocados

Novos:
- `BUG_HUNTING_PLAN.md` — plano com 5 camadas, 5 sprints A-E, tooling, métricas
- `GAMEPLAY_ROADMAP.md` — roadmap Sprint 1-5 (todos completos)
- `DM_IA_BLINDAGEM.md` — strategy multi-provider cascade
- `PLAYTEST_BUGS.md` — bug log (BUG-001 fixed)
- `src/server/dm/providers/cerebras.ts` — CerebrasProvider (gpt-oss-120b default)
- `src/server/dm/providers/cloudflare.ts` — CloudflareProvider
- `src/server/dm/providers/cascade.ts` — CascadeProvider failover
- `src/server/__tests__/cascade-provider.test.ts` — 10 tests
- `src/server/__tests__/cerebras-provider.test.ts` — 6 tests
- `src/server/__tests__/cloudflare-provider.test.ts` — 6 tests
- `src/server/__tests__/campaigns-by-user.test.ts` — QW-3 filter
- `src/server/__tests__/telemetry-hooks.test.ts` — Sprint 3 hooks
- `src/server/__tests__/hide-action.test.ts` — Sprint 5 hide
- `src/server/__tests__/delete-campaign.test.ts` — deleteCampaign cascade
- `src/server/__tests__/dm-narration-recovery.test.ts` — BUG-001 retry
- `src/client/campaign/__tests__/exploration-tutorial.test.ts` — QW-1 trigger
- `src/client/__tests__/util.test.ts` — QW-2 markdown XSS
- `src/dnd/__tests__/spell-slots.test.ts` — BUG-004 nv 1-20

Modificados (críticos):
- `src/server/dm/dm.ts` — retry sem tools, timeout 35s, 2 tentativas
- `src/server/dm/providers/factory.ts` — auto-cascade quando 2+ keys
- `src/server/dm-tool-applier.ts` — telemetria hooks combat
- `src/server/campaign.ts` — startSession Promise.all (QW-4), hide case
- `src/server/combat.ts` — resolvePlayerHide, advantage de hidden
- `src/server/campaign-handlers/rest-handler.ts` — pact magic short rest
- `src/server/persistence.ts` — listRecentCampaignsByUserId + deleteCampaign
- `src/server/routes/api.ts` — /api/dm/health, filter campaigns por user
- `src/server/sockets/connection.ts` — telemetria lobby_created/joined
- `src/server/friends.ts` — telemetria friend_invited
- `src/server/tombstones.ts` — telemetria character_died
- `src/dnd/spell-slots.ts` — tabela PHB nv 1-20 + isPactMagicClass
- `src/client/campaign/campaign-screen.ts` — tutorial trigger refactor, markdown, DM thinking visual
- `src/client/campaign/exploration-tutorial.ts` — shouldTriggerExplorationTutorial pura
- `src/client/util.ts` — renderNarrationText XSS-safe
- `src/client/api.ts` — deleteCampaign client
- `src/client/main.ts` — botão 🗑 com confirm
- `src/client/styles/campaign-party.css` — is-prominent thinking
- `src/client/styles/home-coop.css` — hcamp-del-btn

## 7. Deploy / ambiente

- **Último commit em prod**: `e151f47` (Sprint 5 — hide action). Deploy validado: narração 4s, tom sombrio, não-degradado.
- **Render NÃO auto-deploya** em push. Manual deploy via dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg → "Manual Deploy" → "Deploy latest commit".
- **Env vars em prod**: `CEREBRAS_API_KEY` ✓, `GEMINI_API_KEY` ✓, `GROQ_API_KEY` ✓, `GROQ_MODEL` (auto-corrigido pra 70b-versatile via factory), `BREVO_API_KEY` ❌ (friend invites em dev-log), `ANTHROPIC_API_KEY` ❌.
- **Provider ativo**: `cascade(cerebras→gemini→groq)` — verificável em `GET /api/dm/health`.
- **Tests**: 628/628 verde. Typecheck limpo.
- **Endpoints novos** acessíveis sem auth: `/api/dm/health`. Com auth: `/api/metrics/summary?days=N`.
- **Quirks**: `vitest.config.ts` força `singleFork: true` pra evitar SQLITE_BUSY em test files paralelos. Não mudar.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar sem decidir nada):**
> Lê `BUG_HUNTING_PLAN.md` e `HANDOFF_2026-05-26_bug-hunting.md` na raiz. Estado atual: 628 tests verde, Sprint 1-5 completos, prod estável com cascade Cerebras→Gemini→Groq. Quero começar bug hunting proativo. Me proponha qual sprint (A-E) atacar primeiro baseado em ROI e estado do repo.

**Opções específicas:**

1. **Sprint A — Property-based testing (maior ROI, 3h):**
   > Lê `BUG_HUNTING_PLAN.md` seção 3.1. Instala `fast-check`. Adiciona property-based tests em (1) `src/dnd/dice.ts` cobrindo invariantes de roll, (2) `src/dnd/spell-slots.ts` cobrindo invariantes por classe/nível, (3) `src/client/util.ts renderNarrationText` cobrindo XSS impossível, (4) `src/server/combat.ts` cobrindo HP nunca negativo. Cada test com 5000+ runs. TDD reverso: test que provoca falha primeiro se houver bug. Baseline 628/628. Reporta qualquer bug encontrado em `PLAYTEST_BUGS.md`.

2. **Sprint B — Suite e2e formal via Chrome MCP (4h):**
   > Lê `BUG_HUNTING_PLAN.md` seção 4. Cria `scripts/e2e/` com 10 smoke scenarios: onboarding, rejoin, coop 2 players, combat full cycle, death→tombstone, rest cycle, auto-recap, counterspell, delete crônica, markdown render. Cada um standalone Bash/JS. Orquestrador `run-all.sh` outputa JSON `{scenario, pass, ms, error}`. Chrome MCP via list_connected_browsers + select_browser. Prod em https://jsgame-drpe.onrender.com.

3. **Sprint C — Telemetria observacional + anomaly detection (2h):**
   > Lê `BUG_HUNTING_PLAN.md` seção 5. Cria endpoint `/api/dm/anomalies` que retorna alertas estruturados {severity, kind, value, baseline}. Implementa funnel analysis (character_created → session_started → combat_started → won/lost). Adiciona slow query detection com EXPLAIN QUERY PLAN nas queries críticas + alert P95 > 100ms. Telemetria base já em `src/server/metrics.ts`.

4. **Sprint D — Adversarial LLM probes (3h):**
   > Lê `BUG_HUNTING_PLAN.md` seção 6. Cria `scripts/adversarial-probe.ts` com 10 prompts EVIL: prompt injection, tool abuse, JSON poisoning, slot scam, infinite combat, class swap. Cada probe (a) dispara via campaign API, (b) verifica DM não obedece, (c) state não corrompeu, (d) sem side-effects maliciosos. Roda pre-deploy.

5. **Sprint E — Static analysis expandida (2h):**
   > Lê `BUG_HUNTING_PLAN.md` seção 2. Instala `ts-prune`, `madge`, `knip`. Adiciona ESLint rules: no-floating-promises, no-unused-vars strict, no-explicit-any. Expande tsconfig com noUncheckedIndexedAccess + exactOptionalPropertyTypes. Reporta dead code + ciclos de import. Não fixa nada — só inventario pra atacar depois.

Começa com a **Opção curta** se não tiver certeza — leio o plano e proponho ordem ideal. Se quiser ROI máximo direto, vai na **Opção 1 (Sprint A)** — property-based é onde se encontra mais bug por hora investida.
