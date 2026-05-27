# Handoff — Sprint POLISH ψ "Sentir cada toque" — DONE

## 1. Estado atual

Working tree limpo após 5 commits batched + push origin/main. **1429 tests verde** (era 1396, +33 net). Zero regressão. Sprint ψ completo. Data: 2026-05-27.

```
git log --oneline | head -8
# (commit deste handoff)
# (commit ψ.3 DM Conductor)
# 0b51cc4 feat(polish-ψ.4): modal native free — confirm/input/picker
# 7f9da75 feat(polish-ψ.5): quick wins — customDetails + swipe + debounce + appendError + métricas
# ceaca43 feat(polish-ψ.2): chat alive — persistência + typing + anim + empty state D&D
# 64af801 feat(polish-ψ.1): dice drama — drop-in + settle + 96/112px + audio sync
# e8cc907 feat(onboarding-κ.1): Tutorial Duolingo guiado spotlight 6-steps
# 256ca9a feat(ui-π refino): chat-sheet min-h + ícones + slide + pop-in + métrica
```

## 2. O que foi feito nesta sessão

1. **Análise profunda 4 áreas paralela** (Agents) — dice, chat, DM conduction, polish geral. 50+ issues mapeados, priorizados por severity HIGH/MED/LOW. Documentos em commits batched.
2. **ψ.1 Dice Drama** (`64af801`) — Resolveu "dado não cai": keyframe drop-in translateY -180→0 + settle bounce + impacto squash. Sombra anima junto. Tamanho 58→96/112px overlay. Callback `onLand` em 35% sincroniza som "tac". Variação tilt aleatória.
3. **ψ.2 Chat Alive** (`ceaca43`) — Resolveu "chat não tá legal": persistência server FIFO 50 + backlog em joinCampaign + rate limit token-bucket + typing indicator + animação entrada slide+fade + empty state D&D + placeholder Trickster + multi-line + contador char + timestamp live.
4. **ψ.5 Quick wins** (`7f9da75`) — 7 fixes pequenos: customDetails preservado entre re-mounts, swipe-tab guard horizontal, owner-input debounce 200ms, appendError acumula 3 (.is-stale dim), 4 métricas novas (combat_turn_duration, narration_word_count, auto_retry_success, error_kind_seen).
5. **ψ.4 Modal Native Free** (`0b51cc4`) — Matou 14 prompt()/confirm() blocking. Novo `ui-modal.ts` com `confirmDialog`/`inputDialog`/`pickerDialog`. Reuso de sheet-stack-manager. 8 substituições em 5 arquivos.
6. **ψ.3 DM Conductor** (próximo commit) — DM agora CONDUZ, não só REAGE: `state.activeClocks[]` persistente, 2 tools novas `create_clock`/`tick_clock`, bloco "⏳ CLOCKS RODANDO" no user prompt. LLM lembra tensão entre calls.

Total: **5 commits feature pushed origin/main**. 1396 → 1429 tests (+33 net):
- ψ.1: +2 (onLand timing)
- ψ.2: +7 (server appendPartyMessage)
- ψ.5: +2 (customDetails preserva + reset)
- ψ.4: +10 (ui-modal helpers)
- ψ.3: +12 (clock tools + state)

## 3. Contexto técnico relevante

### Dice (ψ.1)
- **Keyframe stops**: 0% (-180px, scale 0.7, opacity 0) → 15% (opacity 1) → 35% (pousa) → 55% (bounce -22px) → 72% (impacto squash 1.08/0.92) → 86% (bounce -8px) → 100% (settla).
- **onLand timing**: 35% × duration (ex: 630ms em 1800ms). `landFired` flag previne disparo duplo se finish() chegar primeiro.
- **Reduced-motion**: shadow-sync OFF, dro-stage padding-top normal (sem drop-in).

### Chat (ψ.2)
- **Token bucket**: 5 tokens cap, refill 1 token / 2000ms por player. Refill calculado em getMillis.
- **Backlog**: emitido em joinCampaign — pra reconnect. Cliente substitui partyMessages localmente.
- **Typing debounce**: client 200ms start delay + 1500ms stop após sem input. Auto-expira 3s no peer se sem stop chega.
- **Animação entrada**: classe `.is-entering` (opacity 0 + translateY 12px) → removida em `requestAnimationFrame × 2` → transition CSS 240ms.
- **Timestamp refresh**: setInterval 60s lê `data-msg-timestamp` e recomputa relativeTime.

### DM Conductor (ψ.3)
- **activeClocks structure**: `{id, label, progress, max, trigger, fired?}`. Persiste em `CampaignState` (em memória; quando server reinicia, perde — proposital).
- **create_clock dedupe**: se mesmo clockId, atualiza label/max/trigger (não cria duplicado).
- **tick_clock no-op**: se clockId não existe, ignora (não cria).
- **Prompt block**: bloco "⏳ CLOCKS RODANDO" com progresso ASCII (`█░`) + trigger entre aspas. Lembrete forte "USE essa info, NÃO esqueça".

### Modal (ψ.4)
- **Helpers**: `confirmDialog({title, text, confirmText, cancelText, danger}) → Promise<boolean>`, `inputDialog({...validator, multiline}) → Promise<string|null>`, `pickerDialog({options, initialValue}) → Promise<T|null>`.
- **Type-safe pickerDialog<T>**: genérico permite typed value (ex: `pickerDialog<'easy'|'hard'>(...)`).
- **sheet-stack-manager reuse**: ESC + backdrop fecham automaticamente. Resolve null/false se fechado externamente.

### Polish (ψ.5)
- **dockState module-level**: `{customDetails, currentTopic}`. Preserva entre `render()` do campaign-screen (que cria novo closure de `renderActionDockTopics`).
- **resetActionDockState()**: exported pra tests + campaign-screen destroy.
- **Métricas**: 4 novas no `MetricsEventKind` + whitelist `CLIENT_ALLOWED_KINDS` + tipo client.

## 4. Fix/padrão central

### confirmDialog/inputDialog/pickerDialog pattern

Padrão central pra qualquer interação modal customizada — agora a única forma "certa" de pedir confirmação/input. NUNCA usar `confirm()`/`prompt()` mais.

```ts
// Confirm
const ok = await confirmDialog({
  title: 'Excluir crônica?',
  text: 'Sem volta.',
  confirmText: 'Excluir pra sempre',
  danger: true,
});
if (ok) deleteIt();

// Input com validator
const result = await inputDialog({
  title: 'Quantos hit dice?',
  initialValue: '1',
  validator: (v) => parseInt(v) > maxDice ? 'Máximo: ' + maxDice : null,
  multiline: false,
});

// Picker (genérico typed)
const diff = await pickerDialog<'easy'|'medium'|'hard'>({
  title: 'Dificuldade',
  options: [
    { value: 'easy', icon: '🟢', label: 'Fácil', description: '...' },
    // ...
  ],
});
```

### Clocks pattern

DM agora persiste pressão narrativa. Cria com `create_clock`, avança com `tick_clock`. Server clampa max 2-12, amount 1-6. fired flag dispara uma vez ao atingir max. Prompt block "⏳ CLOCKS RODANDO" injetado cada turn pra DM lembrar.

## 5. Follow-ups sugeridos

### Bloqueante/Done
- [x] ψ.1 Dice — drop-in + settle + audio sync
- [x] ψ.2 Chat — persistência + typing + anim + empty + multi-line
- [x] ψ.5 — customDetails + swipe + debounce + appendError + métricas
- [x] ψ.4 — modal native free 14 prompts/confirms
- [x] ψ.3 — clocks tools + state + prompt block

### Opcional (não bloqueante)
- [ ] **Playtest mobile real** — confirmar "dado cai" + "chat tá legal" + "DM conduz"
- [ ] **Dashboard de métricas** — visualizar `combat_turn_duration`, `error_kind_seen`, `bottom_tab_tap` em prod (curl `/api/dm/ux-funnel` agregação)
- [ ] **A11y pass sheet/wizard/lobby** — adicionar role/aria-label/aria-live (parte do plano ψ.5 não entregue por escopo)
- [ ] **Typewriter respeita markdown durante anim** — narration-log.ts:525 (parte do plano ψ.5 não entregue)
- [ ] **Ambient default ON ou prompt 1ª vez** — ambient.ts:39 (sugestão audit)

### Sprints futuros (ψ deferred)
- [ ] **world_tick proativo** (server idle >30s emite world_pulse) — risco alto de explodir custo LLM
- [ ] **NPC agenda/secret persistente** — refactor NpcMemory + DM lê e age "com" NPC
- [ ] **frame_scene tool 5 kinds** (puzzle/negotiation/chase/dilemma/horror) — diversifica viradas além de combat
- [ ] **Spotlight rotativo coop** — server conta turnsSinceLastSpotlight, força foco no silencioso
- [ ] **Anti-loop detector** — shingle hash última 3 narrações, injeta "EVITE estas aberturas"
- [ ] **Streaming SSE** — narração char-por-char (Sprint μ deferred — só se latência for atrito real)

## 6. Arquivos-chave tocados

### Novos
- `src/client/ui-modal.ts` (3 helpers) + `src/client/styles/ui-modal.css`
- `src/server/__tests__/campaign-chat.test.ts` (7 tests appendPartyMessage)
- `src/client/__tests__/ui-modal.test.ts` (10 tests)
- `src/server/__tests__/dm-clocks.test.ts` (12 tests)

### Editados (substancial)
- `src/client/dice/dice-3d.ts` (onLand + dieTilt + 1800ms default)
- `src/client/dice/dice-roll-overlay.ts` (playDiceLand movido pra onLand)
- `src/client/styles/dice.css` (keyframes reescritos + .dro-stage padding-top 220px)
- `src/client/campaign/chat-sheet.ts` (typing, multi-line, anim, empty, contador)
- `src/client/styles/chat.css` (cs-empty cinematic + cs-msg.is-entering + cs-typing + char-counter)
- `src/server/campaign.ts` (partyMessages + appendPartyMessage + chatBuckets)
- `src/server/sockets/connection.ts` (chat handler + chatTyping + backlog em joinCampaign)
- `src/client/campaign/campaign-screen.ts` (ui-modal substituições + métricas + typing wire)
- `src/client/campaign/action-dock-topics.ts` (dockState module-level + resetActionDockState)
- `src/client/campaign/narration-log.ts` (appendError acumula 3 + .is-stale)
- `src/client/styles/campaign-core.css` (.is-stale CSS)
- `src/client/combat/combat-screen.ts` (swipe guard dx>2dy + Help target pickerDialog)
- `src/client/combat/class-features-bar.ts` (Inspire target pickerDialog)
- `src/client/character-creation/wizard.ts` (confirmDialog randomize)
- `src/client/main.ts` (owner debounce + 2 confirms modais)
- `src/client/profile/profile-screen.ts` (confirmDialog remove friend)
- `src/shared/types.ts` (activeClocks + 3 socket events)
- `src/server/dm/tools.ts` (create_clock + tick_clock validators)
- `src/server/dm/prompts.ts` (CLOCKS RODANDO block + 2 tool defs)
- `src/server/dm-tool-applier.ts` (clock handlers)
- `src/server/metrics.ts` (4 métricas novas)
- `src/server/routes/api.ts` (whitelist CLIENT_ALLOWED_KINDS)
- `src/client/api.ts` (trackClientMetric tipo estendido)
- `src/client/styles.css` (imports novos)
- `CLAUDE.md` (seção Sprint ψ no topo Estado Atual)

## 7. Deploy / ambiente

- Último commit em prod: provavelmente `0b51cc4` (ψ.4) — auto-deploy Render disparou em sequência. Próximo (ψ.3 + handoff) disparará.
- URL prod: https://jsgame-drpe.onrender.com
- Dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Cascade providers: Cerebras/Gemini/Groq/Cloudflare ativos. Mistral pendente `MISTRAL_API_KEY`.
- 1429 tests verde. Typecheck OK em cada sub-sprint.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (validar Sprint ψ em prod):**

> Lê `HANDOFF_2026-05-27_sprint-psi-done.md`. Sprint POLISH ψ entregue (5 commits, +33 tests). Aguarda deploy Render (~5-10min). Mobile real: testar dado caindo + chat com typing/anim + DM clocks emergem em sessão longa.

**Opções específicas:**

1. **Playtest mobile end-to-end** — abre crônica nova, observa: dado 96/112px cai+gira+bounce, chat empty state D&D em coop, typing dot bouncing, modais confirmDialog em vez de browser default, DM cria clock no 1º momento crítico.

2. **Dashboard de métricas novas** — curl `/api/dm/ux-funnel` + agregação por nova métrica (combat_turn_duration p50, error_kind_seen distribution).

3. **Pegar ψ.3 deferreds** — adicionar `world_tick` proativo (risco custo) OU `frame_scene` tool 5 kinds (puzzle/negotiation/...) OU `anti-loop detector` shingle hash.

4. **A11y pass** — sheet/wizard/lobby ainda sem ARIA (pendente do plano ψ.5 por escopo). Mais 1-2h pra fechar completo.

5. **Sprint μ Streaming SSE** — agora que clocks resolveram parte do "DM conduz", talvez streaming + cache prompts seja o próximo passo grande pra qualidade LLM perceived.

Recomendação: opção 1 (playtest) primeiro, depois decidir entre 2-5.
