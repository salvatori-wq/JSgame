# JSgame · Contexto pro Claude

> **Auto-carregado quando Claude inicia em `C:\Users\JOÃO\JSgame\`.**

## O que é

D&D 5e online coop com Mestre IA. Stack: Vite + TypeScript strict + Socket.io + Express + sql.js + groq-sdk.
DOM puro (sem Phaser/React). Mobile-first. Sessões 30 min.

Cave Run (jogo antigo, em `C:\Users\JOÃO\D&D online\`) está em prod com deploy Render — **NUNCA tocar**.
JSgame nasceu separado, do zero, aproveitando aprendizados do Cave Run.

## Status atual

- ✅ **F1** Foundation (config, server, client, D&D core: dice/attributes/races/classes/skills/conditions/backgrounds)
- ✅ **F2** Wizard de criação de PJ (5 steps point buy 27)
- ✅ **F3** Mestre IA Groq + Modo Exploração (cena narrada + ações + skill check d20)
- ⏳ **F4** Combate D&D real (initiative + ataques + AI inimigos + condições) — **PRÓXIMA**
- ⏳ **F5** Polish + Coop multi-player + Magias + Rest + PWA

**Pra retomar**: leia `HANDOFF_2026-05-25_F3-done-F4-next.md` na raiz.

## Comandos essenciais

```bash
npm run dev          # backend (3001) + frontend (5173) em paralelo
npm run typecheck    # tsc --noEmit
npm test             # vitest (58 tests passando)
```

URLs: http://localhost:5173 (desktop) · http://192.168.15.3:5173 (mobile)

## Decisões NÃO rediscutir

| Decisão | Por quê |
|---|---|
| DOM puro (sem framework) | D&D é texto/UI, não canvas |
| sql.js (não better-sqlite3) | Sem Visual Studio Build Tools no Windows |
| `Object.assign` no state update | Spread cria new ref → step recebe stale closure (bug F2.fix3) |
| Validação server-side TODA tool call | LLM mente — clampe sempre |
| Persona DM Sombrio+Sarcástico+Trickster BR | Validada no Cave Run, 2-4 frases curtas |
| Timeout 12s + retry sem tools em 400 | Llama 4 Scout falha em ~26% calls complexas |

## Arquivos-chave (mapa rápido)

```
src/client/main.ts                          # router (home/wizard/sheet/campaign)
src/client/character-creation/wizard.ts     # state machine (com Object.assign fix)
src/client/campaign/campaign-screen.ts      # exploration UI
src/server/index.ts                         # Express + Socket.io + REST + 4 socket handlers
src/server/campaign.ts                      # Campaign engine (startSession/takeAction/resolveSkillCheck)
src/server/dm/dm.ts                         # DungeonMaster + FallbackDM
src/server/dm/prompts.ts                    # SYSTEM_PROMPT D&D + 7 tools
src/server/dm/tools.ts                      # validação server-side TODA tool call
src/shared/types.ts                         # CharacterSheet, CampaignState, socket events
src/dnd/*.ts                                # Regras D&D 5e (PHB embarcado)
```

## Aprendizados aplicados (Cave Run → JSgame)

- Path Windows sem `&` evita problemas com npm/git
- sql.js em vez de better-sqlite3 evita compile native
- DOM puro em vez de Phaser fica mais rápido em mobile
- Vitest desde dia 1 (58 tests rodando) evita regressão
- Footer dentro do dynamic re-render (state stale é o inimigo)
- Mobile portrait body classes desde o boot (vars `--m-vh`, `--m-safe-*`)

## Git

Local em `C:\Users\JOÃO\JSgame\`. **Sem GitHub remote ainda** — só commits locais.
Commits: F1 → F2 → F2.fix1/2/3 → F3.

```bash
git log --oneline | head -10
```

## Feedback persistente do João

- Execução rápida + decisões executivas (não perguntar muito)
- Sempre que abrir nova conversa nesse projeto, comece lendo `HANDOFF_*.md` mais recente
- Cave Run e JSgame em pastas isoladas — nunca cruzar config/código

## Estado Atual

> Última atualização: 2026-05-27 (Sprint Ω entregue — 3 commits, 1431→1455 tests +24)

### Sprint Ω "Polimento Definitivo" — entregue (3 commits, +24 tests)

João reportou após 2 hotfixes: **dado AINDA não rola** + **home menu confuso**. Plano profundo entregue.

#### Ω.1 Dado DEFINITIVO (`37876d0`) — força anim mesmo com OS reduce ativo
- **UX pref `forceMotion: boolean`** default ON com body.force-motion class
- **dice.css overrides com `!important`** ignoram @media (prefers-reduced-motion: reduce)
- `prefersReducedMotion()` em dice-3d.ts checa body.force-motion antes do matchMedia
- Toggle "🎲 Animações cinematográficas" em UX Settings Modal
- **rollAndReveal robustez**: re-query face defensive, force reflow antes is-rolling,
  void offsetWidth pra repaint, telemetry hook opcional (started/completed/slow)
- **Fallback dramático em reduced**: dieReducedReveal scale 0.6→1.15→1 em **600ms**
  (era fade 200ms invisível) + ticks de números durante o spin
- **Watchdog 5s** skill-check-overlay: server timeout → toast "Mestre demorou" +
  botão "Tentar novamente" + telemetry dice_roll_timeout
- **Watchdog 8s** dice-roll-overlay (combat) — overlay nunca fica órfão
- 2 metric kinds novos: `dice_roll_timeout`, `dice_roll_visual_slow`
- +7 tests (forceMotion default/toggle/persist + telemetry + face re-query + body override)

#### Ω.2 Home Tavern (`1c9bb5b` + `0e8c08d`) — renderHome 250L → 9 sections
Pegada Wash Me/Spotify/Duolingo/D&D Beyond. Hierarquia nova:
- **Hero compacto 56px** (logo + tagline + 2 chips status)
- **Identity bar sticky 40px** (avatar + owner-input + streak + login/sair)
- **Continue Card destaque #1** quando há lastSession (preview ι.2 + risco + CTA pulse)
- **Play Now** (3 prefabs grid + link discreto wizard)
- **Coop** (2 botões grandes 50/50 + advanced toggle joinar crônica)
- **Collapsibles** persistidos localStorage: Meus PJs (open default) / Crônicas / Cemitério
- **Footer minimal** (Tela / Glossário / Perfil)

Decisões D1-D3 confirmadas no código:
- D1 forceMotion default ON ✅
- D2 Continue Card #1 quando há lastSession (sem → Play Now é #1) ✅
- D3 Wizard como link discreto abaixo dos prefabs (não card grande) ✅

main.ts: `renderHome` virou 1 chamada `mountHomeScreen(...)`. -513 linhas inline.
Playtest local confirmou estrutura completa montando + body.force-motion ativo.

### Arquivos novos Sprint Ω
**Ω.1:**
- (editado) `src/client/ux-prefs.ts` — campo forceMotion + apply body.force-motion
- (editado) `src/client/ux-settings-modal.ts` — toggle "🎲 Animações cinematográficas"
- (editado) `src/client/dice/dice-3d.ts` — robustez + telemetry hook + force-motion check
- (editado) `src/client/styles/dice.css` — !important overrides + dieReducedReveal 600ms
- (editado) `src/client/campaign/skill-check-overlay.ts` — watchdog 5s
- (editado) `src/client/dice/dice-roll-overlay.ts` — watchdog 8s combat
- (editado) `src/server/metrics.ts` + `src/server/routes/api.ts` — 2 metric kinds novos

**Ω.2:**
- `src/client/home/home-screen.ts` NOVO — orquestrador mountHomeScreen
- `src/client/home/sections/*.ts` NOVOS — hero / identity-bar / continue-card /
  play-now / coop / collapsible / my-characters / my-chronicles / graveyard / footer
- `src/client/styles/home-tavern.css` NOVO
- `src/client/home/__tests__/{collapsible,identity-bar,continue-card}.test.ts` NOVOS (+17)
- (editado) `src/client/main.ts` — renderHome legacy removido (-513 linhas)
- (editado) `src/client/styles.css` — import home-tavern.css

### Sprint POLISH ψ "Sentir cada toque" — 5 sub-sprints, 1396→1429 tests (+33 net)

### Sprint POLISH ψ "Sentir cada toque" — 5 sub-sprints, 1396→1429 tests (+33 net)
João pediu: "polish profundo — não precisa de mais funcionalidades, só que as que temos funcionem perfeitamente. Dado não cai, chat não tá legal, Mestre deve conduzir melhor". 4 auditorias paralelas identificaram 50+ issues. Plano organizado em 5 sub-sprints:

#### ψ.1 Dice Drama (`64af801`) — dado físico de verdade
- dieRolling keyframe REESCRITO 6 stops: drop-in translateY -180px→0 + spin + bounce settle (impacto squash). 1100→1800ms. cubic-bezier(0.16,1,0.3,1) físico.
- dieShadowSync paralelo: sombra cresce 35%→70% width junto com aproximação. Profundidade real.
- Dado overlay 58→**96px** desktop, 64→**112px** mobile. Protagonista visual.
- Callback `onLand` em 35% do duration. playDiceLand() agora sincroniza com impacto físico (era no onDone fim).
- Variação `--dieTilt` random ±15° por roll. Cada um único.
- Reduced-motion: shadow-sync OFF + padding-top normal.
- +2 tests novos (onLand antes onDone, idempotente).

#### ψ.2 Chat Alive (`ceaca43`) — chat com alma
- SERVER: `Campaign.partyMessages[]` cap 50 FIFO + `appendPartyMessage` com rate limit token-bucket (5 tokens, refill 1/2s por player). `joinCampaign` emite `partyMessageBacklog` (reconnect não perde histórico).
- SERVER: `chatTyping` socket handler broadcast `partyTyping` pros aliados.
- CLIENT: chat-sheet redesenhado — title "🤝 Party · N aliado(s)", empty state cinematográfico D&D ("A taverna está em silêncio…"), placeholder Sombrio-Trickster ("Sussurre algo aos aliados…"), `<textarea>` multi-line auto-resize 1-3, contador char visível >70% limit, typing indicator 3-dots bouncing, animação entrada msg slide+fade 240ms, timestamp live refresh 60s.
- +7 tests novos campaign-chat (append, vazio, trunca, rate limit, refill, FIFO).

#### ψ.5 Quick wins (`7f9da75`) — 7 fixes pequenos com ROI alto
- `customDetails` action-dock preservado entre re-mounts (state externo `dockState` module-level + `resetActionDockState()`).
- Combat swipe-tab guard: `Math.abs(dx) > 2*Math.abs(dy)` (mata false-positive de scroll vertical).
- Owner-input debounce 200ms (era refreshCharsList a cada keystroke).
- `appendError` acumula últimos 3 (era substituir): `.is-stale` dim os antigos.
- 4 métricas novas: `combat_turn_duration`, `narration_word_count`, `auto_retry_success`, `error_kind_seen`.
- +2 tests novos.

#### ψ.4 Modal Native Free (`0b51cc4`) — 14 prompt/confirm matados
- `ui-modal.ts` NOVO com 3 helpers: `confirmDialog`, `inputDialog`, `pickerDialog`. Promise-based, tema dourado/sangue, mobile-safe.
- 8 substituições críticas: difficulty (picker), exit-em-combate (confirm danger), shortRest hit dice (input validator), longRest (confirm), custom action (input multiline), wizard randomize (confirm), banir personagem (confirm danger), excluir crônica (confirm danger), Help target (picker), Inspire target (picker), remover amigo (confirm).
- +10 tests novos (confirm/input/picker render, click, validator, multiline, initialValue).

#### ψ.3 DM Conductor (próximo commit) — DM conduz, não reage
- `CampaignState.activeClocks[]`: clocks de pressão narrativa Blades-in-the-Dark style. DM cria via `create_clock` (ritual/suspeita/reforço) e tickka via `tick_clock`. Server persiste — LLM não esquece mais tensão entre calls.
- 2 tools novas: `create_clock` (max 2-12) + `tick_clock` (amount 1-6 clamp). Validadas server-side.
- Bloco `⏳ CLOCKS RODANDO` injetado no user prompt cada turn — DM lê e USA: narrativa avança ("o sino toca 4ª vez — 2 restantes"). Trigger fires quando completa.
- Prompt expandido: tools entradas + nota explicit sobre persistência.
- +12 tests novos (validação tool, clamp max, application state, no-op em id inexistente, fired flag).

### Arquivos novos Sprint ψ
- `src/client/dice/dice-3d.ts` (estendido com onLand callback)
- `src/client/styles/dice.css` (keyframes reescritos)
- `src/client/campaign/chat-sheet.ts` (typing, multi-line, anim, empty)
- `src/server/campaign.ts` (partyMessages + appendPartyMessage)
- `src/server/__tests__/campaign-chat.test.ts` NOVO (7 tests)
- `src/client/ui-modal.ts` NOVO (confirm/input/picker helpers)
- `src/client/styles/ui-modal.css` NOVO
- `src/client/__tests__/ui-modal.test.ts` NOVO (10 tests)
- `src/server/__tests__/dm-clocks.test.ts` NOVO (12 tests)
- `src/shared/types.ts` (activeClocks + 3 socket events: backlog, typing client+server)
- `src/server/dm/tools.ts` (create_clock + tick_clock validators)
- `src/server/dm/prompts.ts` (CLOCKS RODANDO block + 2 tool defs)
- `src/server/dm-tool-applier.ts` (handlers create_clock/tick_clock)

### Sprint κ.1 "Tutorial Duolingo guiado" — entregue (próximo commit, +15 tests)
Pegada Duolingo: spotlight visual em cada componente da tela (narration / action dock / party / tab bar) com tooltip flutuante dourado apontando + 6 steps narrativos. Dispara na PRIMEIRA SESSÃO (sessionNumber=1) após primeira narração chegar. Dismissable a qualquer momento (botão "Pular ✕" + tecla Escape). Não conflita com exploration-tutorial — duolingo prevalece em coexistência.
- duolingo-tutorial.ts NOVO — overlay manager, 6 steps (welcome → narration → actions → party → tab bar → fim), spotlight box-shadow hole effect, tooltip auto-position (top/bottom/center), keyboard nav (ArrowRight/Left/Esc), localStorage `jsgame.tutorial.duolingo.v1`
- duolingo-tutorial.css NOVO — visual spec dourado/sangue, glyph 36px com drop-shadow gold, progress chip rounded, skip discreto, botões: Voltar/Próximo/Bora jogar (verde no final)
- Telemetria por step via `duolingo_tutorial_step` (whitelist server + tipo MetricsEventKind): {step, total, viewed?, completed?, skipped?}
- 15 tests: render, navigation forward/back, last step, skip, done, keyboard nav, idempotent, close-without-mark, spotlight fallback. Mock window.localStorage via vi.stubGlobal pra isolar de outros tests no singleFork
- Wire em campaign-screen `maybeFireExplorationTutorial` — duolingo prioridade na 1ª sessão

### Sprint π refino — chat fix + ícones + slide + pop-in + métrica (`256ca9a`)
João reportou em mobile: "tela principal não está descendo o chat, ícones razoavelmente bons, dá pra melhor". Sequência de fixes:
- **BUG chat**: empty state colapsava chat-sheet em 34.7% viewport (257px de 740). Min-height 60dvh força presença dominante.
- **Ícones lapidados**: 📜→🗺 (mapa), 🏆→🏆 (label "Glórias"), 🔗→🤝 (Convite), ⚙→⋯ (consistente overflow). Glyph 22px (era 20). "⋯" boost 28px pra casar com emojis. Labels UPPERCASE + letter-spacing.
- **Slide active indicator**: .btb-active-indicator único movido via JS (translateX + width) em vez de pseudo-element. Cubic-bezier smooth 220ms entre tabs.
- **Badge pop-in**: keyframe scale 0.6→1.35→1 em 280ms quando count incrementa. Decrement NÃO dispara (sem pop fake).
- **Métrica bottom_tab_tap**: trackClientMetric em onBottomTabClick + whitelist server + tipo. +4 tests novos (indicator visible/hide, pop em increment, sem pop em decrement).

### Sprint π "Bottom Tab Bar Uber Native" — 3 commits, 1362→1377 tests (+15)
Pegada Uber/Wash Me nativa: 4 ícones secundários do header (📜🏆👥🔗) viram tab bar persistente bottom 5-slots. Chat pill ο.2 deprecated em portrait-narrow (badge mora no slot Chat). Solo: slot 4 = Share (clipboard campId). Coop: slot 4 = Chat. Slot 5 "Mais" abre overflow menu existente. Decisões D10/D11/D12 confirmadas.
- π.1+π.2 (`c3f22e3`): bottom-tab-bar.ts NOVO + bottom-tab-bar.css NOVO + styles.css import. Renderer + handle (setUnreadCount/setActiveTab/setQuestBadge/setAchievementsBadge/setCoop/destroy). CSS dourado/sangue, active indicator superior 2px com glow, badge pulse 1.6s, scale(0.95) tap, density profile (compact 48/standard 56/comfortable 64) via body class, prefers-reduced-motion respeitado, haptic vibrate 10ms.
- π.3+π.4 (`96d20f9`): campaign-screen.ts integração (slot .ch-slot-bottom-tabs no shell + bottomTabBar handle + currentOpenTab tracker + onBottomTabClick rotear pra modais), chat-sheet.ts onClose opcional, m-camp-dock.css .ch-slot-main-content 55vh→48vh + novo slot. Toggle tap: ativar mesma tab fecha o modal.
- π.5+π.6 (próximo commit): bottom-tab-bar.test.ts (15 tests) + CLAUDE.md + HANDOFF.

### Arquivos novos Sprint π
- `src/client/campaign/bottom-tab-bar.ts` — renderer + state handle (BottomTabBarHandle interface)
- `src/client/styles/bottom-tab-bar.css` — visual spec dourado/sangue + density profile + reduced-motion
- `src/client/campaign/__tests__/bottom-tab-bar.test.ts` — 15 tests

### Arquivos editados Sprint π
- `src/client/campaign/campaign-screen.ts` — wire-up tab bar + chat absorbed
- `src/client/campaign/chat-sheet.ts` — onClose opcional pra notificar caller
- `src/client/styles/m-camp-dock.css` — max-height 48vh + slot bottom-tabs
- `src/client/styles.css` — import bottom-tab-bar.css

### MEGA SESSION 2026-05-27 — 8 Sprints novos entregues
Total: **19 commits feature**, **1179 → 1362 tests (+183 net)**, zero regressão. Sprints completos ou enxutos:

### MEGA SESSION 2026-05-27 — 8 Sprints novos entregues
Total: **19 commits feature**, **1179 → 1362 tests (+183 net)**, zero regressão. Sprints completos ou enxutos:

#### Sprint ο "Pegada Uber — Tela Viva" (4 commits, +79 tests)
- ο.1: Status Ribbon mode-aware (loading/exploration/combat/rest/social) `fd1d007`
- ο.6: Toast System Unificado (5 kinds + queue max 3 + actions inline + achievement shimmer) `fd1d007`
- ο.3: Action Dock Topicizado (4 cards drill-down + End Turn sticky) `1af8b11`
- ο.4: Initiative Ribbon Uber-Style (timeline + connector animado + tap expand) `1af8b11`
- ο.5: Sheet Stack Manager (max 2 layers + ESC + swipe velocity) `f5c1142`
- ο.2: Chat Perfeito (pill flutuante + sheet 60% + avatar emoji + timestamp relativo) `f5c1142`
- ο.7: Mode Transitions (6 vinhetas: combat-enter/victory/defeat/scene-change/long-rest/revive) `2b1850f`
- ο.8: UX Settings (density / font scale / contrast / anim speed / typewriter) `2b1850f`

#### Sprint η "Mestre Joga D&D Real" (6 commits, +86 tests)
- η.1: Feat-effects engine (Alert/Tough/Lucky/Resilient/Observant/War Caster/etc com mecânica real) `7767702`
- η.2: Personality estruturado PHB (13 bg × 26 strings = 338, DM lê via ActiveCharacterProfile) `2a46ec2`
- η.3: ASI/Feat 6/8/10/12/14/16/19 + Fighter/Rogue extras (plannedAsiChoices + pendingAsiChoiceLevels) `c710f24`
- η.4: Advantage/Disadvantage genérico (apply_advantage tool + auto-conditions + isAutoFailSave) `b80768f`
- η.5: Prepared spells enforce + auto-fill (isPreparedCaster + getPreparedLimit PHB) `4d5e453`
- η.6: Saving throw fórmula didática (d20 + mod + prof = vs DC com tooltips educativos) `616e438`

#### Sprint ξ "Pendências" (verificado, 0 commits novos)
- BUG-004 spell slots nv 6-9: já fix prévio
- BUG-005 Pact magic short rest: já fix prévio
- BUG-002 tutorial rejoin: já fix (idempotência tripla)
- α.5 pre-warm LLM: skipped (ROI baixo)

#### Sprint κ "Onboarding" (1 commit, +11 tests)
- κ.2: Glossário D&D pt-BR (35 entries + search + categorias + acessível via "📖 Glossário" no overflow) `03f997c`

#### Sprint λ "Combate Cinematográfico" (1 commit, +7 tests)
- λ.5: Crit narrado épico (KILL_CRIT_SUFFIXES 6 templates "PARTIDO em dois", "explode em fragmentos") `bde42ce`
- λ.2: Spell VFX por escola (CSS keyframes fire/heal/cold/arcane/divine + detector) `bde42ce`

#### Sprint θ "Inventário Vivo" (0 commits novos)
- Rarity tiers JÁ existiam em modals.css (inv-item-card.rarity-*)
- Magic items via give_item tool com rarity

#### Sprint ι "Sessão Convida Voltar" (1 commit, 0 tests novos)
- ι.2: Preview rico no home (currentLocation + última narração 140 chars) `393715d`
- ι.5: Badge vidas em risco (⚠ pulse vermelho quando HP baixo) `393715d`

#### Sprint ν "Coop Refino" (1 commit, 0 tests novos)
- ν.3: Lobby personality picker com previewExample (frase exemplar no estilo) `a47ed2c`
- ν.2 chat polish: já entregue em ο.2
- ν.4 coop sync: server já manda state completo em joinCampaign

### Arquivos novos da MEGA SESSION
**Sprint ο:**
- `src/client/campaign/status-ribbon.ts` + CSS
- `src/client/toast.ts` (estendido) + `src/client/styles/toasts.css`
- `src/client/campaign/action-dock-topics.ts` + CSS
- `src/client/combat/initiative-ribbon.ts` + CSS
- `src/client/sheet-stack-manager.ts`
- `src/client/campaign/chat-pill.ts` + `chat-sheet.ts` + CSS
- `src/client/mode-transitions.ts` + CSS
- `src/client/ux-prefs.ts` + `ux-settings-modal.ts` + CSS

**Sprint η:**
- `src/dnd/feat-effects-engine.ts` (movido de server/ pra dnd/)
- `src/dnd/personality-tables.ts` (338 strings PHB)
- `src/client/character-creation/step-personality.ts` + CSS
- `src/dnd/condition-advantage-rules.ts`
- `src/dnd/prepared-casters.ts`
- `src/client/campaign/saving-throw-overlay.ts` + CSS

**Sprint κ/λ/ι/ν:**
- `src/dnd/glossary.ts` (35 entries D&D pt-BR) + `glossary-modal.ts` + CSS
- `src/client/campaign/spell-vfx-detector.ts` + CSS
- `src/client/styles/home-camp-card-enriched.css`
- `src/client/styles/lobby-personality-preview.css`

### Sprint μ "Mestre Não Falha" — DEFERIDO
- μ.1 streaming SSE: refactor pesado DMProvider abstraction. Bloqueado até playtest provar necessidade real.
- μ.2 cache prompts: requer setup Anthropic prefix caching (zero-budget memória já fala).
- μ.3 auto-swap provider health: cascade já tem fallback decente.
Pode reabrir em sessão futura quando time-to-first-char for atrito provado.

### Sprint γ "POLISH FUNDAÇÃO" — 6 commits, 877→939 tests
- γ.1 Dado 3D + som 3-camadas + haptic + combate (`14c19a8`)
- γ.2 DM força mais rolls via 12 keywords (`c504a6e`)
- γ.3 Echo player race fix (`8d6bba8`)
- γ.4 Mistral provider 5º cascade (`950207d`)
- γ.5 Mobile audit + header overflow 10→5 (`845af26`)
- γ.6 Telemetria UX baseline + /api/dm/ux-funnel (`c4f43a5`)

### Estratégia "Densidade" — 4 features profundas, 939→1007 tests
- F1 Primeiro Minuto Magia — 3 PJs pré-fab + 13 cold opens (`e892937`)
- F2 Crit que faz suar — combat drama visual+som+narração (`fe8d39b`)
- F3 Mestre que Lembra — RAG contextual + callback detector (`78eb823`)
- F4 PJ que Faz Sentido — backstory drives DM (`b9a6a8e`)
- Deploy disparado (dep-d8b5lobeo5us73akf350)
- Veja `HANDOFF_2026-05-27_densidade-done.md` pra detalhes

### Mobile Polish — 4 sessões temáticas, 1007→1059 tests (+52)
- MP1 Fundação Mobile — tokens --m-* + helpers .m-stack/.m-row/.m-modal + swipe-down (`8df4cb6`)
- MP2 Combat & Header — header 2-row mobile, narration flex:1, initiative fade, enemy 1-col, action 2-col (`baa24d7`)
- MP3 7 Modais Bottom-Sheet — inv/shop/cs/mem/ach/npc/qlm com header sticky + body scroll + swipe-down (`c857880`)
- MP4 Sheet+Wizard+Profile+Lobby+Finais — vitals 3-col, attrs 3-col, sheet skills 1-col, profile sticky tabs, toques transversais (`d3304f5`)
- Veja `HANDOFF_2026-05-28_mobile-polish-done.md` pra detalhes

### POLISH ζ "Cada Pixel Conta" — 1 commit, 1125 tests (mantidos)
- da57b28: src/client/styles/_polish.css NOVO + microinteractions/visual/transitions/copy
- ζ.1 microinteractions (hover -1px só pointer:fine, active scale 0.97, prefers-reduced-motion)
- ζ.2 copy review pass (4 strings home com tom sombrio-trickster)
- ζ.3 skeleton shimmer dourado refinado
- ζ.4 route-fade-in 200ms entre views (main.ts adiciona class no render)
- ζ.5 tokens extras (--shadow-xs, --r-tight/soft/loose, --shadow-glow-blood/life/rune) + scrollbar custom + cta-glow utility + focus-visible
- ζ.6 audit 5 viewports PENDENTE (preview tool screenshot travado)

### POLISH ε "Acessibilidade & Resiliência" — 1 commit, 1125→1136 tests (+11)
- 6f53f4c: src/client/a11y.ts NOVO + 7 empty states + contrast fix
- ε.1 ESC handler global fecha 6+ modais sem refactor por componente
- ε.2 ARIA via MutationObserver (aria-label auto baseado em title, role=dialog/status/alert)
- ε.3 --ink-faint #5a4e3e → #867758 (passa WCAG AA contrast)
- ε.4 7 empty states com tom temático (inventory/shop/profile/lobby/spell)
- ε.5 Error boundary global window.onerror + unhandledrejection → toast
- ε.6 IndexedDB resilience PENDENTE (escopo grande, baixa urgência)

### POLISH β "Combate sem Atrito" — 1 commit, 1136→1143 tests (+7)
- 8205cbb: combat-polish.css + condition-icons.ts NOVOS
- β.2 damage numbers polish (drop-shadow, crit glow pulsante)
- β.3 HP transitions narrativas (death cross ✕ overlay, stagger pulse <25%, damage tick)
- β.4 15 PHB condition icons + tooltip mecânico (💀 inconsciente, 🧪 envenenado, etc)
- β.5 initiative refino (current scale + drop-shadow, border colorida por kind)
- β.6 combat log colorido por tipo (player dourado, enemy vermelho, crit amarelo, etc)
- β.7 end-turn chip pulsa quando todos slots gastos
- β.1 action layer unification PENDENTE (refactor maior, audit visual)

### POLISH γ "Vida da Cena" — 1 commit, 1165→1179 tests (+14)
- e621f27: dm.ts classifyError + makeGracefulFallback errorMeta + cascade.providerNames + dmNarration mood='error' + appendDegradedNarration cliente
- γ.3 scene transition: .camp-loc.is-scene-changed pulsa (scale + glow) 1200ms quando currentLocation muda
- γ.4 error recovery rico END-TO-END: server classifica erro (6 kinds), propaga lista providers tentados, client renderiza card com chip + toggle "ver detalhes técnicos" + retry button (canRetry=false pra auth)
- γ.6 thinking tempo real JÁ feito em α.6 (4 fases + 12 dicas)
- γ.1 SSE streaming + γ.2 pre-fetch PENDENTES (refactor server grande)
- γ.5 auto-retry silent JÁ existia em callWithBackoff (2 tentativas 2s gap pra erros transientes)

### POLISH δ "Coop Sem Drama" — 1 commit, 1179 tests (mantidos)
- 570914c: connection-status.ts NOVO + cb-waiting visual rico
- δ.2 reconnect banner sticky top com 3 estados (hidden/reconnecting/failed) + botão "Tentar agora" após 15s
- δ.4 turn indicator visual: enemy "🩸" / aliado "🤝 + torcer 🤞" / aguardando "⏳"
- δ.1 presence + δ.3 chat polish + δ.5 lobby personality preview PENDENTES (server events novos)

### POLISH α "Primeira Impressão" — 2 commits, 1143→1165 tests (+22)
- 28c86ab: login fallback + cta-glow prefab + randomize wizard + thinking rico
- adeb270: tutorial inline 1ª vez no skill check overlay
- α.1 "🎮 Jogar sem cadastro" agora dominante no login (cta-glow pulsa, email vira secundário)
- α.2 home prefab CTA "▶ JOGAR" com glow dourado estático sutil
- α.3 wizard "🎲 Randomizar tudo" — randomizeWizardState NOVO (24 names, 12 surnames, point buy random)
- α.4 tutorial inline overlay 1ª vez (localStorage flag, hint d20+DC+nat20)
- α.6 thinking indicator rico — 12 dicas rotativas + 4 fases por tempo (escrever/demorando/trocando/lenta)
- α.5 pre-warm LLM PENDENTE (decisão: ROI marginal vs Sprint γ que vai mexer no DM mesmo)

### POLISH-0 "Telemetria Honesta" — 2 commits, 1111→1125 tests (+14)
- 204d27d: fix telemetria honesta (trackFirstNarrationIfNeeded no joinCampaign + 2 novos eventos)
- fea7d85: race coop fix + endpoint /api/dm/session-debug + telemetria pré-sessão
- **Achado central**: time_to_first_narration p50=52s em prod ERA composto (cold open + leitura + LLM), não real. Cold open inicial JÁ é instantâneo (~ms).
- **Causa #1** (gap 14%): bug original onde trackFirstNarrationIfNeeded só era chamado no takeAction. Fixado.
- **Causa #2**: race coop — 2º player recebia broadcast mas não trackava (response=null). Fixado.
- **Causa #3** (hipótese): sessões fantasma onde session_started emitido sem usuário interagir. Endpoint /api/dm/session-debug agora permite investigar manualmente.
- **Endpoints novos**: GET /api/dm/session-debug?days=2&limit=30 + POST /api/metrics/track (whitelist client: home_loaded, prefab_clicked).
- Veja `HANDOFF_2026-05-27_polish-0-telemetria.md`

### Pendente / Próximos passos
- [x] ~~Manual Deploy no Render~~ — auto-deployed: `dep-d8b6g0tckfvc73cnmcrg` (commit `d3304f5`)
- [x] ~~Aguardar Render destravar~~ — João fez deploy manual, 3 commits anteriores agora em prod
- [ ] **Aguardar deploy dos commits 204d27d + fea7d85** (auto-deploy do Render, ~5-10 min após push 2026-05-27)
- [ ] **Validar funil novo em prod** — `curl /api/dm/ux-funnel?days=2` deve mostrar withFirstPlayerAction, timeToFirstDmResponseMs etc
- [ ] **Query /api/dm/session-debug** assim que deploy subir — classifica 21 sessões por stage, confirma causa #3
- [ ] **Aguardar 24-48h** após deploy pra baseline real do funil novo
- [ ] **Decidir sprint POLISH α/β/γ** com base nos números reais
- [ ] Validar Mobile Polish em https://jsgame-drpe.onrender.com em mobile real
- [ ] Configurar `MISTRAL_API_KEY` no Render (γ.4 ativar)
- [ ] **Sprint δ "CORAÇÃO RÁPIDO" (~10h)** — SSE streaming (só se latência for atrito real)
- [ ] Onboarding inline tutorial primeira vez (se time_to_first_roll ainda alto)

### Decisões importantes Mobile Polish
- `--m-*` tokens (11) ficam em _tokens.css, override de --gap-loose via body.is-portrait-narrow
- `.m-modal` pattern aplicado VIA CSS selectors compostos em 7 modais (zero refactor DOM)
- `attachSwipeDown` é novo (com velocity check), `onSwipeDown` legacy mantido — usar attach* em código novo
- Pattern visual bottom-sheet: animation 220ms cubic-bezier slide-up + handlebar opcional
- prefers-reduced-motion respeitado em TODAS animações novas (modal slide, etc)
- Hit target ≥40px (m-hit) ou ≥44px (m-hit-cta) enforced em todos botões mobile
- CSS-only para 95% das mudanças — apenas 2 mudanças DOM: wrapper .camp-header-chips +
  onSwipeDown adicionado no quest-log-modal

### Arquivos-chave Mobile Polish
- `src/client/styles/_tokens.css` — 11 tokens --m-* + override gap-loose mobile
- `src/client/styles/m-layout.css` — helpers .m-stack/.m-row/.m-hit*, pattern .m-modal,
  bottom-sheet aplicado a 7 modais, toques finais transversais (tap-highlight, scroll-padding)
- `src/client/m-swipe-down.ts` — attachSwipeDown helper (velocity + handlebar)
- `src/client/__tests__/m-swipe-down.test.ts` — 7 tests (threshold, velocity, etc)
- `src/client/__tests__/mobile-polish-css.test.ts` — 45 CSS snapshot tests
- `HANDOFF_2026-05-28_mobile-polish-done.md` — handoff atual

### Arquivos-chave Sprint γ
- `src/client/dice/dice-3d.ts` — Dado reusável 3D-ish CSS
- `src/client/dice/dice-roll-overlay.ts` — modal genérico de roll
- `src/client/haptic.ts` — navigator.vibrate wrapper
- `src/server/skill-check-detector.ts` — 12 keyword patterns
- `src/server/dm/providers/mistral.ts` — provider Mistral free tier
- `src/server/ux-funnel.ts` — computeUxFunnel agregado
- `src/client/campaign/header-overflow-menu.ts` — popover ⋯

### Arquivos-chave POLISH ζ + ε
- `src/client/styles/_polish.css` — NOVO — microinteractions globais + tokens extras + scrollbar custom + cta-glow + route-fade-in + skeleton shimmer
- `src/client/a11y.ts` — NOVO — initA11yEnhancements (MutationObserver), initEscapeKeyHandler (ESC fecha modais), initGlobalErrorBoundary (window.onerror toast)
- `src/client/main.ts` — wire-up de a11y init + route-fade-in class
- `src/client/styles/_tokens.css` — --ink-faint contrast fix
- `src/client/__tests__/a11y.test.ts` — 11 tests cobrindo enhance + handlers
- 7 arquivos de modal/screen com empty states reescritos (inventory, shop, profile, lobby, sheet, spells)

### Arquivos-chave POLISH-0
- `src/server/sockets/connection.ts` — trackFirstNarrationIfNeeded no joinCampaign (cobre race coop) + 3 helpers de telemetria (firstNarration, firstPlayerAction, firstDmResponse)
- `src/server/ux-funnel.ts` — UxFunnelSummary expandido com withFirstPlayerAction, withFirstDmResponse, timeToFirstPlayerActionMs, timeToFirstDmResponseMs
- `src/server/session-debug.ts` — NOVO — per-session debug com classifyStage (started_only/narration_only/action_no_response/engaged_no_roll/rolled/combat/unknown)
- `src/server/routes/api.ts` — endpoints /api/dm/session-debug + POST /api/metrics/track (whitelist CLIENT_ALLOWED_KINDS)
- `src/server/metrics.ts` — 4 novos kinds: time_to_first_player_action, time_to_first_dm_response, home_loaded, prefab_clicked
- `src/client/api.ts` — trackClientMetric helper (fire-and-forget POST /api/metrics/track)
- `src/client/main.ts` — emit home_loaded em renderHome() + prefab_clicked no click do prefab card
