# JSgame · Handoff — Strategy "Liso & Gostoso" pronta pra execução

> **ATUALIZAÇÃO 2026-05-26 23:13** — Sprint γ COMPLETA. Veja `HANDOFF_2026-05-27_sprint-gamma-done.md` pra estado atual. Esse arquivo permanece como histórico do estado pré-γ.

## 1. Estado atual

**2026-05-27.** Working tree limpo. **877 tests verde** (1 skipped). β.4 V2 (action economy mecânico) mergeado em main. Plano detalhado de 4 sprints temáticos (γδεζ) commitado em `STRATEGY_LISO_VICIANTE.md`. Próxima sessão entra com contexto vazio — só precisa ler o doc e escolher por onde começar.

## 2. O que foi feito nesta sessão

1. **β.4 V2 implementado** (`d8171c9`) — action economy mecânico: bloqueia 2ª action no mesmo turno. `consumeActionEconomy` retorna `{ ok, reason }` com mensagem citando PHB pág 189-193. Hook em `Campaign.playerCombatAction` antes do switch. Cast spell em combat consome action. Rage/Second Wind/Ki Flurry/Bardic Inspiration consomem bonus action. Action Surge restaura action via `grantActionEconomy`. UI desabilita botões já gastos (classe `is-blocked` + disabled + grayscale).
2. **Strategy v1** (`5a985b2`) — primeiro draft "Liso & Viciante" 4 sprints (γδεζ) com 50h estimadas.
3. **Strategy v2** (`d97ef7d`) — refinado pra POLISH (não features novas) + dado como feature chamativa (não protagonista).
4. **Strategy v3 final** (`6bfaaf2`) — aprofundado: cada feature com antes/depois, arquivos a tocar (com LOC), sound design specs (frequências/durations/envelopes), animation curves (cubic-bezier exatos), haptic patterns, edge cases, tests TDD, métrica de validação. 587 linhas, 240+ inserts.
5. **Tests** 863 → 877 verde (+14). 2 arquivos novos: `action-economy-v2.test.ts`, ajuste em `action-economy.test.ts` (movement V2 strict).

## 3. Contexto técnico relevante

**Decisão arquitetural β.4 V2**: hook centralizado no `playerCombatAction` em vez de pulverizar nos handlers `resolvePlayerXxx`. Funções resolve continuam puras sem efeito colateral em economy. Tests unitários delas seguem intactos. Tests de integração V2 usam `consumeActionEconomy` direto porque `playerCombatAction` chama `advanceTurn` no fim (reseta economy do entrante).

**Filosofia da strategy nova**: POLISH > features novas. Cada elemento existente (chips, rarity, inspirações, NPC roster, achievements, vendor, action economy) merece ser terminado — som, animação, feedback tátil, mobile-OK. **A IA é o coração**, mas é o polish geral que segura o player. Dado é UMA das features chamativas (visual+som+tátil em 3 camadas), não protagonista.

**Princípio "3 sentidos" pra cada interação memorável**: visual + som + tátil (`navigator.vibrate` com gracioso degrade). Aplicado especialmente em γ.1 (dado), γ.5 (mobile audit), ε.2 (loot screen TCG), ε.6 (achievement burst).

**Sound design já-existente reusável**: `src/client/audio.ts` tem `playD20`, `playCrit`, `playHit`, `playMiss`, `playLevelUp`, etc — tudo Web Audio API procedural (~5KB total, zero samples). Sprint γ.1 estende com `playDiceRolling`, `playDiceLand`, `playDiceCritTing` seguindo mesmo padrão.

**Estado de prod**: commit `858081b` (β.4 V1) deployado. β.4 V2 (`d8171c9`) e strategy docs (`6bfaaf2`) ainda **não deployados** — não há features de runtime nos commits de docs, e β.4 V2 só ativa quando código novo chama action economy V2 (que já está hooked). Próxima sessão pode deployar via Chrome MCP no Render quando quiser.

**Memória relevante**: `feedback_zero_budget.md` em `C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/` — João reagiu duro a sugestão de Anthropic fallback. Default a free tier sempre (Cerebras+Gemini+Groq+Cloudflare+Mistral em γ.4). Não habilitar pago sem confirmação.

## 4. Padrão central — consumeActionEconomy

Snippet reusável em qualquer novo action handler:

```ts
// src/server/combat.ts:117 (exported)
import { consumeActionEconomy, grantActionEconomy } from './combat.js';

// Em qualquer handler que represente uma "ação" PHB:
const econ = consumeActionEconomy(combat, playerId, 'action'); // ou 'bonus' | 'reaction' | 'movement'
if (!econ.ok) {
  return { ok: false, reason: econ.reason, /* shape do handler */ };
}
// ... aplica efeito normalmente

// Pra restaurar (Action Surge style):
grantActionEconomy(combat, playerId, 'action');
```

Helper `actionEconomyKindFor(actionName)` mapeia `CombatActionKind` → `'action' | 'bonus' | 'reaction' | 'free'` automaticamente — usado no switch principal em `Campaign.playerCombatAction`.

## 5. Follow-ups sugeridos

Plano completo em `STRATEGY_LISO_VICIANTE.md`. Ordem recomendada (γ primeiro pra ter telemetria que mede ganhos dos próximos):

- [ ] **Sprint γ "POLISH FUNDAÇÃO"** (~14h, recomendado) — bloqueante pra medir ganhos de δ/ε/ζ. Inclui dado chamativo (3D-ish CSS + 3 camadas de som + haptic + dado em combate), DM força mais rolls (anti-cheese 12 keywords), Cloudflare fallback Mistral, mobile audit + header reorganização, telemetria UX baseline.
- [ ] **Sprint δ "CORAÇÃO RÁPIDO"** (~10h) — IA mais rápida: SSE streaming real, cascade paralelo Tier 1 (Cerebras+Groq race), predictive chips fallback, optimistic echo, smoke test E2E prod diário.
- [ ] **Sprint ε "PRIMEIRO CONTATO"** (~12h) — onboarding: quick-start 3 PJs pré-fab (Borin/Lyra/Sina), loot screen TCG pós-combate, tutorial inline first-time (7 tooltips), audio mood adaptativo por location, achievement burst polish, contraste WCAG, save indicator.
- [ ] **Sprint ζ "VOLTA AMANHÃ"** (~10h) — retention: daily challenges (5 rotativos), meta-progressão Almas (currency entre sessões), Hall of Fame compartilhável, weekly leaderboard, surprise mechanics (1% lendário in any combat).

Opcionais não-bloqueantes:
- [ ] Deploy β.4 V2 em prod via Chrome MCP (commit `d8171c9` ainda não deployado).
- [ ] Investigar Cloudflare empty response em prod (via `/api/dm/errors?days=7` filter category=empty_response). γ.4 já planeja fix com Mistral.

## 6. Arquivos-chave tocados

- `C:\Users\JOÃO\JSgame\STRATEGY_LISO_VICIANTE.md` — plano detalhado 4 sprints (~600 linhas, specs por feature)
- `C:\Users\JOÃO\JSgame\src\server\combat.ts` — `consumeActionEconomy` retorna `{ok, reason}`, `grantActionEconomy`, `actionEconomyKindFor`
- `C:\Users\JOÃO\JSgame\src\server\campaign.ts` — hook V2 em `playerCombatAction` + cast spell consome action
- `C:\Users\JOÃO\JSgame\src\server\class-features-engine.ts` — rage/second-wind/ki/bardic consomem bonus; action-surge grant action
- `C:\Users\JOÃO\JSgame\src\client\combat\combat-screen.ts` — `isBlocked()` helper desabilita botões cujo slot foi gasto
- `C:\Users\JOÃO\JSgame\src\client\styles\combat.css` — `.cb-action-btn.is-blocked` (opacity + grayscale + ⛔ corner)
- `C:\Users\JOÃO\JSgame\src\server\__tests__\action-economy-v2.test.ts` (novo) — 14 tests V2
- `C:\Users\JOÃO\JSgame\src\server\__tests__\action-economy.test.ts` — 1 test atualizado (movement V2 strict)
- `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-27_polish-strategy.md` (este) — handoff atual

## 7. Deploy / ambiente

- **Último em prod**: commit `858081b` (β.4 V1) deployado via Chrome MCP no Render. Sprint α+β LIVE em `https://jsgame-drpe.onrender.com`.
- **Não deployado ainda**: `d8171c9` (β.4 V2) + 3 commits de docs. β.4 V2 não tem migração de DB nem breaking change — deploy seguro a qualquer momento. Docs não afetam runtime.
- **Render**: NÃO auto-deploya em push. Manual Deploy via Chrome MCP em `https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg`.
- **Providers prod ativos**: cascade(cerebras→gemini→groq→cloudflare). γ.4 planeja adicionar Mistral como 5º.
- **Tests CI**: `vitest.config.ts` força `singleFork:true` (SQLITE_BUSY). Não mudar.
- **Quirks conhecidos**: Cloudflare Llama 3.3 70B ocasionalmente retorna empty response — sem fallback hoje (γ.4 fix planejado). Echo player race condition (γ.3 fix planejado). Wizard 5 passos = friction (ε.1 quick-start planejado).

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar trabalho — recomendado se quer execução autônoma):**
> Lê `STRATEGY_LISO_VICIANTE.md` na raiz do projeto. Estado atual: Sprint α+β COMPLETO + β.4 V2 mecânico mergeado, 877 tests verde, prod em commit `858081b`. Executa Sprint γ "POLISH FUNDAÇÃO" autônomo (14h, 6 commits): dado chamativo (visual 3D + som 3 camadas + haptic + dado em combate) + DM força mais rolls (anti-cheese 12 keywords) + echo race fix + Cloudflare fallback Mistral + mobile audit/header reorganização + telemetria UX baseline. Deploy via Chrome MCP no Render dashboard no fim. Zero budget (free tier only). Sem interação minha. Tests verde sempre. Atualiza handoff no fim.

**Opções específicas:**

1. **Só Sprint γ (polish fundação ~14h):**
   > Lê `STRATEGY_LISO_VICIANTE.md` seção 3 "Sprint γ POLISH FUNDAÇÃO". Executa γ.1 (dado chamativo) + γ.2 (DM força rolls) + γ.3 (echo race) + γ.4 (Cloudflare fallback Mistral) + γ.5 (mobile audit) + γ.6 (telemetria UX) autônomo. Commit atômico por feature, push origin/main, deploy via Chrome MCP no Render. Zero budget. Mantém 877+ tests verde.

2. **Só γ.1 dado chamativo (single feature, ~4h, maior wow ROI):**
   > Lê seção γ.1 do `STRATEGY_LISO_VICIANTE.md`. Implementa só essa feature: novo módulo `src/client/dice/dice-3d.ts` (componente Dado reusável 3D-ish CSS), `src/client/dice/dice-roll-overlay.ts` (wrapper modal genérico), 3 funções novas em `audio.ts` (`playDiceRolling`/`playDiceLand`/`playDiceCritTing`), `src/client/haptic.ts` (vibrate wrapper), `src/client/styles/dice.css`. Dado aparece em COMBATE também (não só skill check) — emit novo `combatEvent { type: 'attack-roll' }` ANTES de damage. Crit dispara screen flash. Tests +6. Commit + push + deploy.

3. **Sprint δ direto (assume γ feito — IA mais rápida ~10h):**
   > Lê `STRATEGY_LISO_VICIANTE.md` seção 3 "Sprint δ CORAÇÃO RÁPIDO". Pré-req: Sprint γ deve estar commitado/deployado. Executa δ.1 (SSE streaming real) + δ.2 (cascade paralelo Tier 1) + δ.3 (predictive chips fallback) + δ.4 (optimistic echo) + δ.5 (smoke test E2E prod). Métrica-alvo: `time_to_first_token_ms` cai de ~8000 pra <800.

4. **Sprint ε direto (onboarding + dopamina ~12h):**
   > Lê seção "Sprint ε PRIMEIRO CONTATO". Executa ε.1 (quick-start 3 PJs Borin/Lyra/Sina) + ε.2 (loot screen TCG) + ε.3 (tutorial inline 7 tooltips) + ε.4 (audio mood) + ε.5 (header mobile fix) + ε.6 (achievement burst) + ε.7 (WCAG contraste) + ε.8 (save badge). Métrica: first-session completion >70%.

5. **Sprint ζ direto (retention ~10h):**
   > Lê seção "Sprint ζ VOLTA AMANHÃ". Executa ζ.1 (daily challenges 5 rotativos) + ζ.2 (meta-progressão Almas) + ζ.3 (Hall of Fame compartilhável) + ζ.4 (weekly leaderboard) + ζ.5 (surprise mechanics 1% lendário). Métrica: D1 retention >40%.

6. **Apenas deploy do β.4 V2 (rápido, ~5min):**
   > Commit `d8171c9` (β.4 V2 mecânico) ainda não está em prod. Faz deploy via Chrome MCP no Render dashboard (`https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg`). Após deploy, valida `/api/health` retornando ok e testa 1 combate em prod pra confirmar action economy bloqueando 2ª action.

Começa com a **Opção curta** se quiser execução autônoma full Sprint γ. Se já souber o que prefere, vai direto numa das 6 (1-5 são execução, 6 é só deploy).
