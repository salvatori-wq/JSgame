# JSgame — Handoff: abertura playtest end-to-end

## 1. Estado atual

**2026-05-26.** Working tree limpo. **Prod LIVE** (`https://jsgame-drpe.onrender.com`) com Gemini 2.5 Flash ativo + 50+ commits deployed. **533/533 tests verdes**. 

12 features novas adicionadas na sessão anterior precisam validação manual end-to-end:
- S2 Counterspell mecânico real
- A3 Auto-recap entre sessões via RAG
- A4 Friend graph + invite por email
- A5 Refactor campaign.ts split
- M1 Enemy ability scores em saves
- M2 Dispel Magic buff level real
- M3 Esquivar real effect (disadvantage)
- M4 Consumables catalog id-based
- B6 Toast UI consistente
- B7 Tutorial exploração first-time
- T1 Telemetria DAU/error rate
- 1A-1C, 3A-3B já em prod (rodada anterior)

## 2. O que esta sessão deve fazer

**Executar `PLAYTEST_PLAN.md` na raiz do repo.**

Plano cobre 6 etapas:
1. **Setup** (15min): ambiente, ferramentas, baseline tests
2. **Test matrix** (12 cenários executáveis F1-F12, ~2-3h): cada feature tem objetivo + passos + critério + o que validar no log
3. **Bug capture**: formato estruturado em `PLAYTEST_BUGS.md` com severidade P0-P3
4. **Fix workflow**: batches por área/arquivo, branch por batch, TDD reverso (test que falha antes do fix)
5. **Validation loop**: cherry-pick re-test após fix + smoke automatizado
6. **Exit criteria**: 0 P0/P1, ≤5 P2, tests verdes, DM error rate ≤10%

## 3. Setup imediato (primeiros 5 min)

```bash
cd C:\Users\JOÃO\JSgame
git status                       # confirmar clean
npm test -- --run                # baseline 533/533
curl -s https://jsgame-drpe.onrender.com/api/health | python -m json.tool
# Esperado: hasGemini=true, activeProvider=DungeonMaster, dmProvider=auto
```

Em paralelo:
- **Chrome MCP**: `list_connected_browsers` → `select_browser` → `tabs_create_mcp` → navigate pra prod
- **Bug log**: criar `PLAYTEST_BUGS.md` limpo (template em PLAYTEST_PLAN.md §3)
- **Limpeza Chrome**: `localStorage.clear()` pra forçar tutorial dispara

## 4. Como o usuário quer trabalhar

- **Eu dirijo o Chrome MCP** executando os 12 cenários
- **Capturo bugs** em `PLAYTEST_BUGS.md` enquanto vou
- **Bato batches a cada 5-7 bugs** com fix + test que protege regressão
- **Re-deploy automático** após cada batch (push origin main → Render auto)
- **Telemetria T1** valida saúde via `/api/metrics/summary`
- **Toast UI B6** já está em prod — bugs novos aparecem como toast pro usuário (Stop = ele consegue ver oque tá quebrando)

João prefere:
- Execução rápida + decisões executivas (sem perguntar muito antes de agir)
- Batch fixes (não 1 commit por bug — agrupar por área)
- Tests verdes a cada commit (não comentar test pra fazer passar)

## 5. Hipóteses de onde bugs vão aparecer

Baseado no review da PLAYTEST_PLAN §8:

| Área | Bug provável | Onde checar primeiro |
|---|---|---|
| 2A Counterspell | DM aplica damage antes do server processar reaction (timing race) | `dm-tool-applier.ts apply_damage` + ordem de tools no DM response |
| A3 Auto-recap | Latência 8-12s antes da narração inicial (LLM 2x) | `campaign.ts startSession` — pode parecer "travado" pro user |
| A4 Friend invite | `resolveInvitesForNewUser` falha se user já existia (anon legacy) | `friends.ts` + `auth.ts consumeMagicLink` |
| B7 Tutorial | Trigger dispara 2x em coop (ambos joinam simultâneo) | `campaign-screen.ts` condition `!this.currentState && hasFirstNarration` |
| M1 Enemy AS | Scores inferidos absurdos pra monstros legacy (ex: gargula INT 12) | `monsters.ts inferAbilityScores` bias por type |
| B6 Toast | Stack acumula em coop com muitos erros simultâneos | `toast.ts` — limit max 3 toasts visíveis? |
| T1 Telemetria | Hooks incompletos — só session/narration tracking | `connection.ts` — falta combat_won/lost, lobby_created, etc |

## 6. Recursos disponíveis

- `PLAYTEST_PLAN.md` — plano completo (você está aqui no resumo)
- `src/server/__tests__/` — 35 arquivos de tests existentes pra usar como template
- `/api/metrics/summary?days=1` — auth required, retorna byKind + DAU + WAU + DM error rate + avg session length
- `/api/campaigns/:id/memory` — RAG facts da campanha (debug)
- Chrome MCP browser tools (já testados nesta sessão — `Browser 1` Windows)
- Render dashboard via Chrome MCP (já navegado, sessão logada)

## 7. Bloqueio conhecido

`BREVO_API_KEY` não configurada → friend invites vão em **dev-log mode**: toast mostra `Modo dev — link: <URL>` em vez de mandar email. Pra testar coop real:
- User A copia o devLink que aparece no toast
- Manda pro User B via WhatsApp/etc
- User B abre em incognito → magic link login → resolveInvitesForNewUser auto-converte

OU configurar Brevo: link https://app.brevo.com/settings/keys/api → criar key → adicionar via Chrome MCP no Render (mesmo fluxo de GEMINI_API_KEY desta sessão).

## 8. Critério de stop

Próxima sessão deve PARAR quando:
- Exit criteria do `PLAYTEST_PLAN.md` §6 atendido (preferencial)
- OU 80% janela de contexto (handoff parcial com bugs abertos + próximos passos)
- OU bug P0 não-trivial que vai > 30 min pra debugar

## 🎯 Prompt de continuação

📋 **Cole isto como primeira mensagem da próxima sessão:**

---
Lê `PLAYTEST_PLAN.md` e `HANDOFF_2026-05-26_playtest-pronto.md` na raiz. Executa o playtest em sequência: setup → 12 cenários F1-F12 → bug capture em `PLAYTEST_BUGS.md` → batch fixes por área. Chrome MCP via `list_connected_browsers` + `select_browser`. Prod em `https://jsgame-drpe.onrender.com`. Tests baseline 533/533 verde. Atua com decisão executiva, batcheia fixes a cada 5-7 bugs, valida com cherry-pick re-test, pushes pra deploy auto. Para em exit criteria do plano ou 80% contexto.
---
