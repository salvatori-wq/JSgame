# JSgame · Handoff — Sprint γ "POLISH FUNDAÇÃO" concluído

## 1. Estado atual

**2026-05-26 23:13.** Working tree limpo. **939 tests verde** (1 skipped). Sprint γ inteira mergeada em main (6 commits γ.1→γ.6) + deploy disparado no Render (commit `c4f43a5`, build em progresso). Próxima sessão entra em Sprint δ "CORAÇÃO RÁPIDO" ou continua observando métricas pra calibrar próximos.

## 2. O que foi feito nesta sessão (Sprint γ completo)

**6 commits atômicos pushados pra origin/main**, todos com tests verde:

| # | Commit | Feature | Tests | Suíte |
|---|---|---|---|---|
| γ.1 | `14c19a8` | Dado 3D + som 3-camadas + haptic + combate | +16 | 892 |
| γ.2 | `c504a6e` | DM força mais rolls (12 keywords) | +21 | 913 |
| γ.3 | `8d6bba8` | Echo player race fix | +3 | 916 |
| γ.4 | `950207d` | Mistral provider (5º cascade) | +11 | 927 |
| γ.5 | `845af26` | Mobile audit + header overflow (10→5) | +5 | 932 |
| γ.6 | `c4f43a5` | Telemetria UX baseline + /api/dm/ux-funnel | +7 | 939 |

**Total: +63 tests novos. 877 → 939 verde.**

### γ.1 — Dado chamativo
- Novo `src/client/dice/dice-3d.ts` — componente reusável (d4..d100) com rotação 3D (rotateX+Y+Z em cubic-bezier overshoot), sombra projetada, classes crit/fumble/success/fail
- Novo `dice-roll-overlay.ts` — wrapper modal genérico pra rolls de combate
- Audio: `playDiceRolling`/`playDiceLand`/`playDiceCritTing`/`playDiceFumble` em camadas
- Novo `haptic.ts` — wrapper navigator.vibrate com graceful degrade
- `dice.css` — keyframes dieRolling (1100ms), dieCritFlash, dieFumbleShake, screen flash
- CombatEvent.type ganha `'attack-roll'` — emit em resolvePlayerAttack/resolveEnemyTurn ANTES de damage/miss
- Skill-check overlay migrado pra usar `renderDie` reusável
- prefers-reduced-motion: anim 200ms, sem flash pulse, sem screen flash
- ARIA live region anuncia resultado
- Dep adicionado: `happy-dom` (devDep) pra DOM em testes do client

### γ.2 — DM força mais rolls
- Novo `src/server/skill-check-detector.ts` — pure function com 12 keyword patterns
- Hook em `Campaign.takeAction` ANTES da DM call: se action implica check e pendingCheck null, server injeta sintético com narração dummy
- Skills cobertos: investigacao, persuasao, intimidacao, enganacao, percepcao, furtividade, atletismo, acrobacia, historia, medicina, sobrevivencia, prestidigitacao
- Edge cases: negação explícita, action attack/cast-spell/rest-* skip, combat ativo skip, pendingCheck já ativo respeita DM

### γ.3 — Echo race fix
- combatAction emite echo `⚔ Player → action` SÍNCRONO antes do await playerCombatAction
- takeAction já fazia certo (commit refactor 4f731bd) — agora consistente entre todos sockets
- Test de regressão valida ordem dos emits via fake io mock

### γ.4 — Mistral provider
- Novo `src/server/dm/providers/mistral.ts` — OpenAI-compatible, free tier
- Factory injeta no cascade após Cloudflare (5º provider)
- Empty response/safety block/429 → throw pra failover natural
- Setup prod: `MISTRAL_API_KEY` env no Render (ainda manual TODO)

### γ.5 — Mobile audit + header overflow
- Novo `header-overflow-menu.ts` — popover com fade-in, close em ESC/click-fora
- Header reduzido de 10→5 botões: Sair + Quest + Achievements + NPCs + Share + "⋯"
- Items movidos pro menu: SFX, Música, Notif, Voz, Memória, Dificuldade
- Hit targets ≥40px desktop, ≥44px mobile
- `.visually-hidden` helper pra ARIA live regions
- prefers-reduced-motion respeitado

### γ.6 — Telemetria UX
- 5 novos MetricsEventKind: time_to_first_narration, time_to_first_roll, roll_in_session, dm_silence, combat_action_blocked
- Novo `src/server/ux-funnel.ts` — `computeUxFunnel(daysBack)` calcula p50/p90/p99 latency, avg/median/max rolls, silence avg, blocked count
- Novo endpoint `GET /api/dm/ux-funnel?days=7`
- Hooks em connection.ts: joinCampaign baseline ts, takeAction track first narration + silence, requestSkillCheck track roll, combatAction blocked track economy

## 3. Verificação local (preview server)

Antes do deploy, validei via `preview_start` + injection JS:
- `/api/dm/ux-funnel?days=7` retorna shape correto (200 OK)
- `renderDie` cria element com border-radius 12px, min-width 38px, transform-style preserve-3d
- `overflow-menu` CSS: min-height 40px desktop, 44px mobile (matchMedia 480px funcionou)
- `openOverflowMenu` cria popover com role=menu e items corretos
- Server gemini provider ativo
- Zero console errors em load inicial

## 4. Deploy

**Disparado** via Chrome MCP em `https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg`:
- Manual Deploy → Deploy latest commit
- Deploy ID: `dep-d8b56dmgvqtc73a942og`
- Started: 2026-05-26 23:13
- Status: building (no momento desta entrega)
- Inclui também β.4 V2 (`d8171c9`) que estava pendente

**Verificar após sessão**: `/api/health` em https://jsgame-drpe.onrender.com deve mostrar versão nova.

## 5. Pendente / Próximos passos

- [ ] Configurar `MISTRAL_API_KEY` no Render dashboard pra γ.4 ativar (cascade hoje funciona sem ele, mas Mistral é a rede final pré-degraded)
- [ ] Após deploy completar, observar `/api/dm/ux-funnel?days=1` por 24-48h pra ter baseline real (hoje só 1 session de teste local)
- [ ] **Sprint δ "CORAÇÃO RÁPIDO" (~10h)** — SSE streaming real, cascade paralelo Tier 1, predictive chips, optimistic echo, smoke test E2E. Meta: time_to_first_token_ms 8000 → <800
- [ ] **Sprint ε "PRIMEIRO CONTATO" (~12h)** — onboarding, loot screen TCG, tutorial inline, audio mood adaptativo
- [ ] **Sprint ζ "VOLTA AMANHÃ" (~10h)** — retention: daily challenges, almas meta-progressão, hall of fame

## 6. Decisões importantes desta sessão

- **happy-dom adicionado** como devDep pra DOM em testes do client (não jsdom — happy-dom é mais leve). Activado via `// @vitest-environment happy-dom` no header dos test files que precisam de DOM.
- **Difficulty dropdown removido do header** e movido pro overflow menu via `prompt()` numerado. Decisão: o <select> ocupava muito espaço em mobile; substituir por prompt simplifica e libera real estate.
- **Dummy DM response em γ.2**: quando server detecta skill check implícito, retorna narração sintética curta ("Pra X: Y DC Z. Rola o d20.") sem chamar LLM. Mais rápido + previsível + tests mais simples. DM real entra quando player resolve o roll.
- **Mistral ordem cascade**: após Cloudflare (não antes), porque Cerebras+Gemini+Groq são mais rápidos. Mistral entra só se 4 anteriores falham — função é cobrir CF empty response.
- **prefers-reduced-motion universal**: aplicado em dice.css e overflow-menu.css. Padrão pra futuras anims.

## 7. Princípios mantidos

- Polish > features novas. Cada elemento existente termina de ser feito.
- 3 sentidos pra interações memoráveis: visual + som + tátil.
- Reusa primitivas α+β, não recria paralelo.
- Mobile-first 360px, hit targets ≥38px.
- Zero budget. Free tier providers only.
- Tests verde sempre. Sequential singleFork pra evitar SQLITE_BUSY.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (Sprint δ direto — IA mais rápida ~10h):**
> Lê `STRATEGY_LISO_VICIANTE.md` seção 3 "Sprint δ CORAÇÃO RÁPIDO". Estado: Sprint γ completo + deploy ao vivo (commit `c4f43a5`), 939 tests verde. Executa δ.1 (SSE streaming real) + δ.2 (cascade paralelo Tier 1) + δ.3 (predictive chips fallback) + δ.4 (optimistic echo) + δ.5 (smoke test E2E prod). Meta: time_to_first_token_ms 8000 → <800.

**Opção: Continuar Sprint ε (onboarding ~12h):**
> Lê `STRATEGY_LISO_VICIANTE.md` seção "Sprint ε PRIMEIRO CONTATO". Quick-start 3 PJs pré-fab + loot screen TCG + tutorial inline + audio mood + achievement burst polish.

**Opção: Auditar métricas reais pós-deploy:**
> Hit https://jsgame-drpe.onrender.com/api/dm/ux-funnel?days=7. Analisa rolls_per_session, time_to_first_narration_p50, dm_silence_avg, combat_actions_blocked. Baseado nas métricas reais, prioriza próximo sprint.

## 9. Arquivos-chave criados nesta sessão

```
src/client/dice/dice-3d.ts                        # γ.1 componente Dado reusável
src/client/dice/dice-roll-overlay.ts              # γ.1 modal genérico de roll
src/client/dice/__tests__/dice-3d.test.ts         # γ.1 12 tests
src/client/haptic.ts                              # γ.1 vibrate wrapper
src/client/styles/dice.css                        # γ.1 visual + keyframes
src/server/__tests__/attack-roll-event.test.ts    # γ.1 ordering test
src/server/skill-check-detector.ts                # γ.2 keyword detector
src/server/__tests__/skill-check-detector.test.ts # γ.2 21 tests
src/server/__tests__/echo-race-order.test.ts      # γ.3 race fix tests
src/server/dm/providers/mistral.ts                # γ.4 5º provider
src/server/__tests__/mistral-provider.test.ts     # γ.4 11 tests
src/client/campaign/header-overflow-menu.ts       # γ.5 popover
src/client/campaign/__tests__/header-overflow-menu.test.ts # γ.5 5 tests
src/client/styles/overflow-menu.css               # γ.5 visual
src/server/ux-funnel.ts                           # γ.6 computeUxFunnel
src/server/__tests__/ux-funnel.test.ts            # γ.6 7 tests
HANDOFF_2026-05-27_sprint-gamma-done.md           # este handoff
```

## 10. Arquivos-chave modificados

```
src/client/audio.ts                # +4 funções de som (dice 3-camadas)
src/client/campaign/campaign-screen.ts  # γ.1 dice overlay no combat, γ.5 overflow menu
src/client/campaign/skill-check-overlay.ts  # γ.1 usa renderDie
src/client/styles.css              # @imports dice.css + overflow-menu.css
src/server/campaign.ts             # γ.2 hook detectImpliedSkillCheck
src/server/combat.ts               # γ.1 emit attack-roll event
src/server/dm/providers/factory.ts # γ.4 Mistral integration
src/server/metrics.ts              # γ.6 5 novos kinds
src/server/routes/api.ts           # γ.6 /api/dm/ux-funnel endpoint
src/server/sockets/connection.ts   # γ.3 combatAction echo + γ.6 hooks telemetria
src/shared/types.ts                # γ.1 'attack-roll' no CombatEvent.type union
package.json + package-lock        # +happy-dom devDep
```
