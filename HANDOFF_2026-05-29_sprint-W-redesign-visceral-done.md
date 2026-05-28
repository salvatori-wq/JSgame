# Handoff — Sprint W "Redesign Visceral" entregue (consultores aprovaram)

## 1. Estado atual

**Data**: 2026-05-29 · **Tree limpo** após 2 commits (feat+test) · **1842 tests verde** (era 1802, +40 net) · **Typecheck OK** · **Push NÃO feito ainda** (consultores aprovaram, mas João decide quando)

Sprint W (4 sub-sprints W1+W2+W3+W4) **executado integralmente** seguindo o plano `SPRINT_W_PLANO.md` + ajustes que os 2 consultores fizeram na revisão prévia. Re-avaliação pós-execução confirmou objetivos atingidos.

## 2. Veredito dos 2 consultores (pós Sprint W)

### Consultor D&D sênior (ex-Wizards): **8.5/10**
> *"O jogo agora PARECE D&D na primeira impressão e SUSTENTA a ilusão em combate — falta só a alma fora do roll (sons, ambiente, mistério persistente)."*

- ✅ Todas as 5 recomendações originais CUMPRIDAS (dado protagonista; read-aloud box; fog of war stats+HP; suggest_actions opcional; combate narrativo)
- ✅ Todas as 3 faltas blocking CUMPRIDAS (iniciativa next-up; damage taken visceral; concentração visível)

### Consultor UX Mobile RPG: **8.0/10** (era 5.5 — objetivo ≥7.5 atingido)
> *"Sprint W transformou JSgame de 'engenharia premium com hierarquia escondida' em 'D&D mobile que SE SENTE como D&D' — dado virou protagonista, combate ficou target-first contextual estilo VTT, e a IA do Mestre ganhou drama Disco Elysium."*

- ✅ 4 das 5 recomendações originais CUMPRIDAS
- ⚠ 1 PARCIAL: "3 sistemas de ação → 1" — ainda restam 2 sistemas em combat (`cb-actions-grid` + `class-features-bar`). Target-sheet absorveu o target+ação primária mas features ainda paralelo.
- ✅ Todas as 3 faltas blocking CUMPRIDAS (targeting glow; vinheta combat-enter; loading skeleton DM)

## 3. O que foi feito (resumo dos 2 commits)

### Commit 1: `feat(W): Sprint W redesign visceral — dado + mestre + combate target-first` (4a314ec)

**W1 — Dado Protagonista (6 mudanças)**:
- W1.1: `.atk-die` CSS órfão removido (combat já usava `showDiceRollOverlay` desde γ.1)
- W1.2: skill-check dado **80→140px** mobile portrait. `.sc-stage` flex column. `.sc-row` grid 2-areas ("die die"/"chip-attr chip-dc"). Desktop 80→100px.
- W1.3: drama timing **1500→2500ms** default / **4000ms** crit/fumble. `.is-rolling` class faz `pointer-events: none` no overlay até auto-close (drama silence). Removido `showAfterMs` manual nos 3 sites de campaign-screen.
- W1.4: watchdog skill-check 5→**10s**. Mensagem humana: "🎲 O Mestre está pensando…"
- W1.5: screen flash visceral. Gradient gold 0.18→0.35, fumble vermelho 0.35. Dado scale 1.2× via `.die-crit-landed`/`.die-fumble-landed` + keyframes.
- W1-Mobile: screen dim 0.55→**0.72** + backdrop-filter blur 3→**6px** em ambos overlays. Marvel Snap-style.
- W1.6 sound layered: PULADO (iOS Safari risk).

**W2 — Mestre Narrativo (5 mudanças)**:
- W2.1: read-aloud box PHB-style em `.is-narration:not(.is-roll-echo)`. Cardo 16px line-height 1.6. Drop-cap INTELIGENTE (primeiras 3 da cena + 1ª pós location change) via `lastSceneLocation` tracker em NarrationLog.
- W2.2: player echo (`▶ Nome`) → `.is-player-echo` tint azul-aço discreto. Distingue de Mestre (gold) e roll-echo (mute).
- W2.3: chat absorvido. `partyMessage` cria entry `.is-party-message` com avatar 28px + `classIcon(class)` real (⚔ fighter, 🧙 wizard, 🥷 rogue, etc — 12 classes mapeadas). chat-sheet mantido só pra envio de msg.
- W2.4: combat log narrativo. `.cb-log-line`: monospace 11px → Cardo serif italic 14px. Cores por kind reforçadas.
- W2.5: SYSTEM_PROMPT `suggest_actions` OPCIONAL. Critério explícito (a/b/c). "RPG é mesa, não menu".
- W2-Mobile: thinking indicator skeleton shimmer (Disco Elysium-style) + read-aloud box-like border.

**W3 — Combate Target-First (6 + 3 + 2 mudanças)**:
- W3.1: enemy card sem CA/+atq/dano + sem HP numérico. Adjetivo Cardo italic ("intacto"/"arranhado"/"ferido"/"muito ferido"/"à beira"/"caído") cor por severidade. Stats completos só via ℹ stat-block modal.
- W3.2: **combat-target-sheet.ts NOVO**. Bottom-sheet contextual com primary action DOMINANTE (glow pulsante 2.2s, min-height 64px). `combatActionLabel()` mapeia kinds. Slide-up 260ms cubic-bezier.
- W3.3: action economy STICKY top + backdrop-filter. Renderizado SEMPRE (`is-readonly` opacity 0.72 entre turnos).
- W3.4: "AGORA É VOCÊ" body.is-my-turn + box-shadow inset 3px gold + keyframe `turnEnterPulse` overshoot + haptic + toast "▶ Seu turno". Tracker `lastMyTurnState`.
- W3.5: cb-actions-grid MANTIDO opt-in (conforme consultor D&D).
- W3.6: validator clamp 4→**3** + prompt instrui "máx 3 chips".
- W3-DnD iniciativa next-up SEMPRE: `findNextAliveAfter()`. Glyph 🩸/🤝/▶.
- W3-DnD damage TAKEN visceral: body class 700ms + screen-shake + flash vermelho inset. Crit variant.
- W3-DnD concentração visível: `renderConcentrationChip` no status-ribbon com tooltip educacional.
- W3-Mobile targeting glow: `.is-targeted` pulse 200ms + scale 1.05 + haptic 15ms ANTES sheet.
- W3-Mobile vinheta combat-enter reforçada: opacity 0.75 + zoom 1.10→1 + flash brightness/sat + haptic burst.

**Arquivos novos (3)**: `combat-screen-helpers.ts`, `combat-target-sheet.ts`, `combat-target-sheet.css`.

### Commit 2: `test(W): cobertura Sprint W +43 tests / atualização de 5 legacy` (ef9d888)

**Novos (4 arquivos, 28 tests)**:
- `combat-screen-helpers.test.ts` — 7 tests `enemyHpAdjective`
- `combat-target-sheet.test.ts` — 13 tests (7 puros + 6 DOM smoke)
- `class-icon.test.ts` — 5 tests `classIcon` helper
- `status-ribbon-sprint-w.test.ts` — 5 tests `renderConcentrationChip`

**Atualizados (5 legacy + 18 guards novos)**:
- `mobile-polish-css.test.ts`: M2.2 → W1.2 (grid 2-areas), M3.2 → W2.1 (drop-cap inteligente), + 18 CSS snapshots Sprint W
- `narration-log.test.ts`: drop-cap location reset + 4ª na cena sem drop-cap
- `initiative-ribbon.test.ts`: next-up SEMPRE com `.irb-next-enemy`/`.irb-next-player`
- `suggest-actions.test.ts`: clamp 4→3

## 4. Gaps remanescentes apontados pelos consultores

### Consultor D&D — 3 críticos pra próximo sprint
1. **Camada sonora diegética** (não Web Audio layered, mas ambient tavern/dungeon loop low-volume + dice impact + page-turn no read-aloud). Sem som, mesmo tela bonita fica "tela". iOS resolvível com user-gesture unlock.
2. **Fog of war NARRATIVO** — DM ainda revela HP/CA/DC do oponente no texto via tool. Regra no prompt: "DM nunca cita números do oponente, só adjetivos e sinais corporais ('respira pesado', 'claudica')".
3. **Persistência da cena entre turnos** — `.last-scene-pin` sticky com última narração dobrável. Player decide ação OLHANDO o que o DM acabou de descrever, não rolando o log.

### Consultor Mobile — 3 críticos pra próximo sprint
1. **Colapsar `class-features-bar` dentro de `cb-actions-grid` OU virar chip secundário no target-sheet.** Ainda são 2 superfícies de decisão. Marvel Snap teria UMA.
2. **Initiative ribbon "passou pra você"** animado sincronizado com vinheta combat-enter. Já tem next-up preview (W3-DnD) mas falta a transição visceral entre turnos.
3. **Som diegético do dado: `<audio>` impact.mp3 ≤50KB unlock-on-first-tap** (não Web Audio layered). Slay the Spire mobile faz isso. ROI altíssimo, esforço baixo. Fecha a 3ª camada tátil do dado.

**Convergência**: ambos consultores apontam **som** como gap mais urgente (D&D #1, Mobile #3). Próximo Sprint X poderia ser "Camada Sonora" + 1-2 itens de cada consultor.

## 5. Decisões / aprendizados

1. **Consultar consultores ANTES de executar economiza horas**. Os ajustes que aplicaram no plano (HP numérico escondido, drop-cap inteligente, avatar PJ real, screen dim+blur, W1.6 pular, grid manter opt-in, critério binário fallback W3.2) viraram pontos onde NÃO precisamos voltar atrás. Score final pós-execução refletiu isso (D&D 5→8.5, Mobile 5.5→8.0 em 1 sprint).

2. **Drop-cap "sempre" era armadilha**. Consultor Mobile pegou: "20 drop-caps Cinzel 38px em log longo vira ruído visual". Solução: tracker location + counter por cena. 4 tests guard.

3. **Layout grid 2-areas > flex column pra dado+chips mobile**. Grid permite "die span 2 / chip-attr+chip-dc lado a lado" sem mudar DOM. CSS puro.

4. **`is-rolling` class no overlay inteiro > tentar bloquear chip-by-chip**. Drama silence virou 1 CSS rule `pointer-events: none`.

5. **`originalToolCalls` snapshot do Ciclo V foi essencial pra W**. Sem ele, narração tornada mais rica (W2.5 suggest_actions opcional) sumiria toolCalls em retries — comportamento que V.2 já tinha fixado.

6. **Target-first sheet vs remoção total de grid**: ambos consultores convergiram pra "manter grid como fallback opt-in" — refactor menor, a11y preservada, decisão correta.

## 6. Arquivos novos / chave

**Novos clientes**:
- `src/client/combat/combat-target-sheet.ts` — Sheet contextual W3.2 + `combatActionLabel`
- `src/client/combat/combat-screen-helpers.ts` — `enemyHpAdjective` compartilhado
- `src/client/styles/combat-target-sheet.css` — Bottom-sheet visual + targeting glow

**Novos testes**:
- `src/client/combat/__tests__/combat-target-sheet.test.ts` (13)
- `src/client/combat/__tests__/combat-screen-helpers.test.ts` (7)
- `src/client/campaign/__tests__/class-icon.test.ts` (5)
- `src/client/campaign/__tests__/status-ribbon-sprint-w.test.ts` (5)

**Editados (Mestre/Combate principal)**:
- `src/client/dice/dice-roll-overlay.ts` — drama timing + is-rolling guard
- `src/client/campaign/skill-check-overlay.ts` — watchdog 10s + msg humana
- `src/client/campaign/narration-log.ts` — drop-cap inteligente + party-message + classIcon
- `src/client/campaign/campaign-screen.ts` — wire W1.3 / W2.1 currentLocation / W2.3 chat / W3-DnD damage
- `src/client/campaign/status-ribbon.ts` — `renderConcentrationChip`
- `src/client/combat/combat-screen.ts` — W3.1 fog of war + W3.2 wire target-sheet + W3.3 sticky + W3.4 my-turn
- `src/client/combat/initiative-ribbon.ts` — `findNextAliveAfter` + next-up SEMPRE
- `src/client/mode-transitions.ts` — vinheta combat-enter reforçada
- `src/server/dm/prompts.ts` — suggest_actions opcional
- `src/server/dm/tools.ts` — validator clamp 3

**CSS chave editado**:
- `src/client/styles/dice.css` — overlay dim/blur + crit/fumble flash + landing scale
- `src/client/styles/campaign-core.css` — read-aloud box + player echo + party-message + thinking shimmer
- `src/client/styles/combat.css` — fog of war meta + combat log Cardo + sticky economy + my-turn + damage taken
- `src/client/styles/status-ribbon.css` — `.sr-conc`
- `src/client/styles/initiative-ribbon.css` — `.irb-next-hint` por kind
- `src/client/styles/mode-transitions.css` — vinheta combat-enter

## 7. Deploy / próximos passos

**Status**: 2 commits feitos localmente, **NÃO pushed**. João decide quando push → Render auto-deploy.

```bash
git push origin main      # dispara deploy
```

Cache-Control granular do Ciclo V já está em prod (commit 72adbd0 push anterior), então deploy do Sprint W vai aparecer rápido em browsers que já não estão cacheando index.html velho.

## 8. Sugestões pra próxima sessão

### Opção A (recomendada): Sprint X "Camada Sonora + Polish Final"
Atender o gap convergente dos 2 consultores. Esforço estimado ~4-6h:
1. Single `<audio>` impact.mp3 ≤50KB + unlock-on-first-tap (consultor Mobile #3)
2. Ambient loop tavern/dungeon low-volume (consultor D&D #1)
3. Page-turn SFX no read-aloud (consultor D&D #1)
4. Regra prompt "DM nunca cita números do oponente" (consultor D&D #2)

### Opção B: Sprint X "Combat Hierarchy Final"
Resolver o PARCIAL do consultor Mobile (3→1 sistema):
1. Colapsar `class-features-bar` em chips secundários no combat-target-sheet
2. Inicial ribbon "passou pra você" animado entre turnos
3. `.last-scene-pin` sticky com última narração (consultor D&D #3)

### Opção C: Playtest humano real ANTES de Sprint X
João + 1 amigo no celular, 30 min cold-open. Métricas reais > inferidas. Decide se Sprint X foca em som ou em hierarquia combat com base no que player real sentiu.

## 9. 🎯 O que falar na próxima conversa

**Opção curta**:
> Leia `HANDOFF_2026-05-29_sprint-W-redesign-visceral-done.md`. Sprint W entregue com aprovação dos 2 consultores (D&D 8.5/10, Mobile 8.0/10). Vamos pra próximo sprint? Opções A (camada sonora), B (combat hierarchy), ou C (playtest humano primeiro).

**Opções específicas**:
1. Push o Sprint W pra prod primeiro e ver no jogo real → "Push origin main e me confirma deploy via curl /api/dm/diag"
2. Direto pro Sprint X opção A (som) → "Lê handoff Sprint W e executa Sprint X — Camada Sonora + Polish Final em 4-6h conforme consultores convergiram"
3. Investigar playtest humano → "Marca playtest pra essa noite — preview rodando em http://192.168.15.3:5173, eu mando feedback"

---

**Resultado de 1 sprint**: 5.5/10 → 8.0/10 Mobile, 5-6 → 8.5/10 D&D, +40 tests net, 0 regressão. Objetivo atingido.
