# Sprint W — "Redesign Visceral" · Plano de Execução

> **Data**: 2026-05-29 · **Contexto**: 2 consultores (D&D sênior + UX Mobile RPG) auditaram o jogo e concordaram em 3 pontos críticos + 5 mudanças de alto ROI. Este plano detalha cada mudança em granularidade executável.

---

## 0. Contexto rápido (pra próxima sessão)

**Estado atual do jogo (1802 tests verde, deploy em prod OK)**:
- Backend D&D 5e está sólido: PHB regras, cascade 4 providers, F4 entregue
- Frontend foi otimizado em 9 ciclos de polish (M+N+O+P+Q+R+S+T+U+V) com +211 tests
- **Mas** os 2 consultores diagnosticaram: investimento mal alocado em didática (tutoriais, tooltips, faixas DC) quando o problema é **drama, mistério e respiração**

**Veredito do Consultor D&D**: *"o jogo SABE D&D mas NÃO PARECE D&D"*
**Veredito do Consultor Mobile**: *"engenharia premium, escolhas de hierarquia visual sabotam a percepção. Score 5.5/10 vs Marvel Snap 9.5"*

**Pausar polish marginal. Sprint W é redesign visceral focado.**

---

## 1. Sub-sprints (ordem de execução)

```
W1 → W2 → W3 → W4 → Check consultores
```

| Sub | Foco | Esforço | Bloqueia | Tests previstos |
|---|---|---|---|---|
| **W1** | Dado Protagonista | ~3-4h | nada | +15-20 |
| **W2** | Mestre Narrativo (read-aloud + chat absorvido + log narrado) | ~3-4h | nada | +15-20 |
| **W3** | Combate Target-First (3 sistemas → 1 + fog of war + turn indicator + economy sticky) | ~4-6h | nada | +20-30 |
| **W4** | Polish + Re-check consultores | ~2h | W1+W2+W3 | +0 (audit) |

Total estimado: **12-16h** de execução · **+50-70 tests** · **3-4 commits feature + 1 docs**

---

## 2. Sub-sprint W1 — DADO PROTAGONISTA

> **Dor do João**: *"o dado não existe, não aparece o dado rolando"*
> **Diagnóstico unificado**: 2 sistemas paralelos de dado (`die-3d` skill-check vs `atk-die` combat) com animações diferentes. Em combat o atk-die é literalmente um spinner CSS. Em skill-check o dado é 80×88px dividindo protagonismo com chips ladeando.

### W1.1 — Matar `atk-die` legacy (combat usa `showDiceRollOverlay`)

**Onde**: `src/client/styles/combat.css` busca `.atk-die` + qualquer keyframe `atk-spin` · `src/client/combat/combat-screen.ts` (renderização de attack-roll inline)

**Diagnóstico**: Combat attack-roll renderiza um dado inline `.atk-die` que é só um CSS `transform: rotate()` linear = spinner. NÃO é dado D&D.

**Fix**:
1. Grep + remover `.atk-die` rules e keyframe `atk-spin` do `combat.css`
2. Em `combat-screen.ts`, quando attack-roll dispara, em vez de criar `.atk-die` inline, chamar `showDiceRollOverlay({ kind: 'd20', label: 'ATAQUE', preview, final, special, verdictText, showAfterMs: 2000 })` (o helper já existe em `dice-roll-overlay.ts`)
3. Confirmar que `showAfterMs: 2000` (era 1500) — consultor D&D pediu 5-10s drama; vou de 2s default + 4s em crit como meio-termo

**Tests**: `combat-attack-roll-overlay.test.ts` NOVO — testa que combat attack dispara `showDiceRollOverlay` e não cria `.atk-die`. ~5 tests.

### W1.2 — Skill-check dado 80→140px + chips ABAIXO (não lado)

**Onde**: `src/client/styles/skill-check.css` ou `campaign-core.css` (rules `.sc-row`, `.sc-die-slot`, `.sc-chip`)

**Diagnóstico**: dado tem 80×88px no centro do row + chip bonus à esquerda + chip DC à direita. Olho não sabe pra onde olhar. Consultor Mobile: "no Marvel Snap o cube toma 40% da tela durante o roll".

**Fix CSS**:
```css
body.is-portrait-narrow .sc-row {
  flex-direction: column;     /* dado em cima, chips em row abaixo */
  align-items: center;
  gap: 14px;
}
body.is-portrait-narrow .sc-die-slot {
  width: 140px;
  height: 140px;
}
body.is-portrait-narrow .sc-die-slot .die-face {
  font-size: 64px;             /* era ~28-32px */
}
body.is-portrait-narrow .sc-chips-row {     /* NOVO container */
  display: flex;
  gap: 12px;
}
```

**Em `skill-check-overlay.ts`**: envolver os 2 chips (bonus + DC) num `<div class="sc-chips-row">` abaixo do dado.

**Tests**: `mobile-polish-css.test.ts` +5 guards (column direction, 140px die, chips-row container).

### W1.3 — Drama silence: auto-close 1500 → 2500ms padrão + 4000ms em crit

**Onde**: `src/client/dice/dice-roll-overlay.ts:138`

**Diagnóstico**: 1500ms auto-close é "tempo de Tinder, não de D&D" (consultor D&D). Em mesa, silêncio pós-dado dura 5-10s.

**Fix**: default `showAfterMs: 2500`. Quando `special === 'crit' || special === 'fumble'`, dobra pra 4000ms (mais drama no momento épico).

**Tests**: `dice-roll-overlay.test.ts` NOVO — verifica defaults + crit override.

### W1.4 — Watchdog 5s → 10s no skill-check (latência LLM real)

**Onde**: `src/client/campaign/skill-check-overlay.ts` (`watchdog` Ω.1)

**Diagnóstico**: Consultor Mobile: *"latência LLM real é 3-12s, player vê 'Rolando…' e desiste antes da animação completar"*. Watchdog 5s mata o flow.

**Fix**: aumentar watchdog pra 10s + mudar mensagem "Mestre demorou. Tente novamente." → "🎲 O Mestre está pensando…" (não-disruptiva durante latência normal).

**Tests**: `skill-check-overlay.test.ts` +2 guards (watchdog 10s, mensagem PT-BR).

### W1.5 — Crit/Fumble screen flash mais visceral

**Onde**: `src/client/styles/dice.css` keyframe `.dice-screen-flash`

**Diagnóstico**: já tem flash em `dice-roll-overlay.ts:163` mas é sutil demais.

**Fix CSS**: keyframe `dice-screen-flash-crit` mais intenso (radial gradient gold full-screen 700ms + scale do dado 1.2× no momento do landing). Para fumble: tint vermelho similar.

**Tests**: CSS snapshot guards (`@keyframes dice-screen-flash-crit` + scale 1.2 in dice 3D land).

### W1.6 — Sound layered (impact THUD + ting agudo)

**Onde**: `src/client/audio.ts` (`playDiceLand`)

**Diagnóstico**: Consultor Mobile: *"Marvel Snap usa 3 camadas inseparáveis — tactile haptic crisp 30ms + audio THUD grave + ting agudo + visual cube cai centro"*.

**Fix**: `playDiceLand` toca 2 sons em paralelo: low frequency thud (60Hz square wave 80ms) + ting agudo (1200Hz sine 40ms). Já existe Web Audio synth em `audio.ts` — adicionar camadas.

**Tests**: `audio.test.ts` se existir, ou pular (audio testing é frágil).

**Commit W1**: `feat(W1): dado protagonista — atk-die morto + 140px + drama timing + flash épico`

---

## 3. Sub-sprint W2 — MESTRE NARRATIVO (Read-Aloud Box + Chat Absorvido + Log Narrado)

> **Dor do João**: *"chat é ruim"* + (subtexto via consultor Mobile) *"não vejo o que aconteceu antes"*
> **Diagnóstico D&D**: Mestre fala igual a um aliado no Discord, sem distinção visual. **Consultor pediu read-aloud box estilo PHB.**
> **Diagnóstico Mobile**: chat-sheet modal disruptivo, avatar emoji desconectado do PJ real, em solo nem existe.

### W2.1 — Read-Aloud Box pra Mestre (estilo PHB caixa cinza/cream)

**Onde**: `src/client/campaign/narration-log.ts` (renderização de entries) + `src/client/styles/campaign-core.css` rules `.camp-narr-entry.is-narration`

**Diagnóstico**: hoje narração do Mestre vai num `<div>` flat. PHB usa "read aloud box" = caixa com border decorado + bg cream + texto serif maior.

**Fix CSS** — aplicar a `.camp-narr-entry.is-narration` (NÃO em echo do player nem em roll-echo):
```css
.camp-narr-entry.is-narration {
  background: linear-gradient(180deg, rgba(74, 56, 26, 0.32) 0%, rgba(56, 40, 18, 0.28) 100%);
  border: 1px solid rgba(244, 208, 127, 0.25);
  border-left: 3px solid var(--ink-gold);
  border-radius: 4px;
  padding: 14px 16px;
  margin: 12px 0;
  font-family: var(--font-body, 'Cardo'), serif;
  font-size: 16px;
  line-height: 1.6;
}
.camp-narr-entry.is-narration .cnn-text::first-letter {
  /* drop-cap SEMPRE (não só na primeira) */
  font-family: var(--font-heading, 'Cinzel'), serif;
  font-size: 38px;
  float: left;
  line-height: 0.9;
  padding: 6px 10px 0 0;
  color: var(--ink-gold);
  text-shadow: 0 0 8px rgba(244, 208, 127, 0.4);
}
```

**Tests**: `mobile-polish-css.test.ts` +4 guards (border-left gold, font-family Cardo, drop-cap sempre).

### W2.2 — Player echo + Roll-echo TIPOGRAFIA distinta (chat-like)

**Onde**: `src/client/styles/campaign-core.css` `.camp-narr-entry.is-roll-echo` + `.camp-narr-entry:not(.is-narration):not(.is-roll-echo)` (player echo)

**Diagnóstico**: player echo "▶ Borin: ⚔ Atacar" e roll-echo "🎲 d20+3 = 14 → sucesso" hoje ficam igual à narração visualmente. Precisam ser CLARAMENTE MENORES e MAIS DISCRETOS.

**Fix CSS**: echo entries ficam menores (13px), italic, opacity 0.78, sem read-aloud box. Já existe parcialmente (M2.3 fez algo) — confirmar e reforçar.

**Tests**: já cobertos em testes existentes (narration-log tests).

### W2.3 — Chat absorvido em `narration-log` (sem chat-sheet modal)

**Onde**: `src/client/campaign/chat-sheet.ts` (deprecar) + `src/client/campaign/chat-pill.ts` (manter como badge unread) + `src/client/campaign/campaign-screen.ts` (wire) + `src/server/campaign.ts` (já tem `partyMessages` ψ.2)

**Diagnóstico Mobile**: *"chat-sheet vira modal disruptivo. Marvel Snap não tem chat real-time; Genshin usa pill anchored. Absorver chat em narration-log resolve sem refactor pesado."*

**Fix**:
1. Quando server emite `partyMessageBacklog` ou nova mensagem (`partyMessage`), inserir entry em narration-log com class `.is-party-message` + speaker `"🤝 [Nome]"`.
2. CSS pra `.is-party-message`: avatar 24px circle (gerado por hash do nome — `palette` style) + bg blue-tinted sutil + bubble border-radius arredondado.
3. **Manter** chat-pill como badge unread count. Click no pill scrolla narration-log até a última mensagem.
4. **Remover** chat-sheet modal completo (`chat-sheet.ts` → deprecate, exports vazios pra não quebrar imports).
5. **Solo player também vê narration-log persistente** (não precisa chat ativo).

**Tests**: `narration-log.test.ts` +5 (party-message entry rendering, avatar, scrolling on pill click).

### W2.4 — Combat log narrativo (não syslog)

**Onde**: `src/client/combat/combat-screen.ts:301-311` (combat log render) + `src/server/combat-narrator.ts` (já existe!)

**Diagnóstico D&D**: *"combat log atual é syslog: '▶ atacou orc com sucesso'. Em mesa real DM narra 'o orc avança gritando, balança o machado pra cima — acerta seu ombro, 7 de dano cortante'"*.

**Fix**:
1. Servidor JÁ TEM `enrichAttackLog` em combat-narrator.ts (achado pelo consultor) — confirmar que está sendo usado E que mensagens são ricas
2. Cliente: renderizar combat log entries com tipografia narrativa (font-body Cardo serif 14px line-height 1.5 italic), não monospace.
3. Cor por tipo de evento (já existe parcialmente β.6, reforçar): crit gold uppercase, miss mute, kill bold+vermelho.

**Tests**: `combat-narrator.test.ts` se existir, +5 (enrichAttackLog tem variações por evento).

### W2.5 — `suggest_actions` SEM forçar (deixar texto livre respirar)

**Onde**: `src/server/dm/prompts.ts:252` (SYSTEM_PROMPT que força suggest_actions)

**Diagnóstico D&D**: *"prompt força suggest_actions SEMPRE. DM vira menu, player vira clicador de chips. RPG japonês, não D&D"*.

**Fix**: ajustar SYSTEM_PROMPT — suggest_actions é OPCIONAL, usar SÓ quando player pediu lista ou quando narração foi indecisa. Default deve ser **narração rica + 1 prompt aberto** ("e você?", "o que faz?").

**Tests**: `prompts.test.ts` se existir, +2 (suggest_actions opcional na diretiva).

**Commit W2**: `feat(W2): mestre narrativo — read-aloud box + chat absorvido + log narrativo + suggest_actions opcional`

---

## 4. Sub-sprint W3 — COMBATE TARGET-FIRST + FOG OF WAR

> **Dor do João**: *"campo de batalha não é intuitivo"*
> **Diagnóstico D&D**: combat-screen mostra stats completos do inimigo (CA, +ataque, dado de dano) violando fog of war. Player joga contra planilha.
> **Diagnóstico Mobile**: 3 sistemas de ação coexistem (cb-actions-grid + action-dock-topics + cb-features-bar) = 22+ pontos de decisão por turno. Player não sabe onde clicar.

### W3.1 — Enemy fog of war: esconder CA / +ataque / dado de dano

**Onde**: `src/client/combat/combat-screen.ts:357` (renderização enemy card)

**Diagnóstico D&D**: `CA ${en.armorClass} · +${en.attackBonus} · ${en.damageDice}+${en.damageBonus}` exposto no card viola mistério do PHB.

**Fix**:
1. Remover string de stats do card principal
2. Card mostra apenas: nome + descrição curta (`en.flavor` se existir) + barra HP relativa + conditions visíveis ("sangrando", "claudicando")
3. Stats COMPLETOS continuam acessíveis via botão ℹ (que já existe, abre stat-block-modal Φ.2)

**Tests**: `combat-screen-enemy-card.test.ts` NOVO +5 (sem stats no main, só info button mostra)

### W3.2 — Enemy card = ALVO clicável (não info-card)

**Onde**: `src/client/combat/combat-screen.ts` (enemy card click handler) + `src/client/styles/combat.css` (`.cb-enemy-card::after` hover-only fail mobile)

**Diagnóstico Mobile**: *"`::after content '⚔'` opacity hover falha em mobile (sem hover). Player toca enemy esperando atacar, cai em stat-block."*

**Fix**:
1. Click no enemy card → abre **bottom-sheet de ação contextual** (NOVO componente)
2. Bottom-sheet mostra:
   - Header: nome enemy + HP barra
   - Ação primária **DOMINANTE** (70% glow): "⚔ Atacar com [arma equipada]" (mostra ataque + dano formula)
   - Ações secundárias chip row: "🔮 Magia" (se caster), "🎯 Manobra" (se warrior tem maneuvers), "🥷 Sneak Attack" (rogue)
   - Footer "ℹ Stat Block completo" + "✕ Cancelar"
3. **Botão ℹ separado no card permanece** pra quem só quer ver stats sem comprometer ação

**Tests**: `combat-target-sheet.test.ts` NOVO +8 (sheet abre, primary action prominent, cancel funciona, ℹ separado)

### W3.3 — Action economy STICKY top (Action/Bonus/Move/Reaction sempre visível)

**Onde**: `src/client/combat/combat-screen.ts` (`.cb-economy` ribbon) + `src/client/styles/combat.css`

**Diagnóstico Mobile**: *"action economy chips ficam dentro do tab 'Ações' — invisíveis quando tab 'Inimigos' ativo. Player gasta Bonus Action sem perceber."*

**Fix CSS**:
```css
.cb-economy {
  position: sticky;
  top: 0;                       /* abaixo do status-ribbon, em cima das tabs */
  z-index: 8;
  background: linear-gradient(180deg, rgba(28, 18, 10, 0.97), rgba(20, 12, 8, 0.92));
  border-bottom: 1px solid rgba(184, 128, 48, 0.3);
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  justify-content: center;
}
```

E mover `.cb-economy` no DOM pra FORA do `cb-tab-content` → ficar acima das tabs como ribbon persistente.

**Tests**: CSS snapshot guard (`.cb-economy { position: sticky; top: 0 }`).

### W3.4 — Initiative "AGORA É VOCÊ" explícito

**Onde**: `src/client/styles/initiative-ribbon.css` + `src/client/combat/initiative-ribbon.ts` + `src/client/styles/combat.css` (border na tela toda)

**Diagnóstico Mobile**: *"cb-turn-pulse 1.4s glow é sutil demais. Player perde a vez."*

**Fix**:
1. Quando `combatState.currentParticipantId === myCharId`:
   - Body class `.is-my-turn` aplicada
   - CSS: `body.is-my-turn .combat-screen { box-shadow: inset 0 0 0 3px var(--ink-gold); }` 
   - Animação 1× sutil entrada (border fade in 400ms ao virar turno)
   - Haptic 40ms ao virar turno
   - Toast efêmero "▶ Seu turno" pulse 600ms

2. Initiative ribbon entry do current player ganha scale(1.15) + glow gold + mantém o pulse atual.

**Tests**: `initiative-ribbon.test.ts` +4 (body class is-my-turn aplicada, toast aparece, haptic disparado).

### W3.5 — Unificar 3 sistemas de ação combat → 1 hierarquia clara

**Onde**: `src/client/combat/combat-screen.ts` (renderização `.cb-actions-grid` + integração com `action-dock-topics`)

**Diagnóstico Mobile**: *"22+ pontos de decisão por turno"*

**Fix**:
1. **Remover** `.cb-actions-grid` do tab "Ações" — em combat, ação é via **target-first** (click enemy → sheet contextual W3.2)
2. **Manter** `cb-features-bar` (class features) como ribbon LATERAL (canto direito mobile, ou bottom em portrait) — only when actually usable this turn (rage active? action surge available?)
3. **action-dock-topics** continua bottom dock pra ações **NÃO-attack** (Magia, Tentar, Falar, Mais, Livre)
4. Hierarquia clara:
   - **Ação PRIMÁRIA**: tap enemy (W3.2 sheet)
   - **Ação SECUNDÁRIA**: dock topics bottom (W3.5 mantido)
   - **Features**: ribbon side/bottom só quando applicable
5. Sticky end-turn chip permanece bottom-right (já existe β.7)

**Tests**: `combat-flow.test.ts` NOVO +10 (cb-actions-grid removido, target-first wires, features só quando applicable).

### W3.6 — Suggest_actions chips na narração: máx 3 (não 4-5)

**Onde**: `src/server/dm/prompts.ts` + `src/server/dm/tools.ts` (`suggest_actions` validator)

**Diagnóstico D&D**: chips em quantidade vira menu RPG japonês. PHB DM Style Guide pede "3 ou menos opções" pra manter peso narrativo.

**Fix**: validator clampa `actions.length` em 3. Prompt instrui "máximo 3 chips, prefira ação livre".

**Tests**: `tools.test.ts` se existir, +2 (clamp 3, validate count).

**Commit W3**: `feat(W3): combate target-first + fog of war + AGORA-É-VOCÊ + economy sticky + chips reduzidos`

---

## 5. Sub-sprint W4 — POLISH + CHECK CONSULTORES

### W4.1 — Polish curto (1h)
- Garantir todas as anims novas respeitam `prefers-reduced-motion`
- Garantir todos novos hits ≥ 44px WCAG AAA
- Garantir CSS snapshot tests cobrindo W1/W2/W3

### W4.2 — Re-spawn dos 2 consultores

**Como fazer**: usar Agent tool com 2 prompts atualizados:
1. Consultor D&D (mesmo prompt, mas adicionar "JSgame teve Sprint W aplicado — reavalie e diga se as 5 mudanças que você pediu foram cumpridas")
2. Consultor Mobile (mesmo prompt + "Sprint W foi aplicado — reavalie score 1-10")

**Critério de sucesso**: 
- D&D consultor diz "drama D&D restaurado, fog of war OK, narração separa do chat OK" 
- Mobile consultor diz score ≥ 7.5/10 (era 5.5)

### W4.3 — Playtest empírico
- Subir preview local mobile 375×812
- Reproduzir 6 cenários (cold-open, skill check, chat, combat target-first, action economy, narração)
- Comparar visualmente com screenshots antes/depois

### W4.4 — Docs + push
- HANDOFF_2026-XX-XX_sprint-W-redesign-visceral-done.md
- CLAUDE.md atualizado
- Commit + push origin/main → Render auto-deploy
- Verificar prod: curl `/api/dm/diag` + bundle JS pra confirmar fixes

**Commit W4**: `docs(W): HANDOFF Sprint W + CLAUDE.md (redesign visceral entregue + check consultores)`

---

## 6. Métricas de sucesso (objetivo)

1. **Dado**: ao rolar, o jogador vê um dado de **140px** ocupando linha inteira (não 80px ladeado por chips). Auto-close 2.5s normal / 4s crit. Sound layered. Em combat o ataque usa o MESMO overlay (não spinner CSS).

2. **Chat + Narração**: Mestre fala em read-aloud box (gold/cream + Cardo serif + drop-cap sempre). Chat absorvido como entries 🤝 inline com avatar gerado. Solo player vê mesmo log. Pill flutuante só com badge unread.

3. **Combate**: click no inimigo abre sheet contextual com "⚔ Atacar com [arma]" dominante. Stats do inimigo escondidos (só nome + HP + conditions visíveis). Action economy chips sticky top sempre visíveis. Quando é meu turno, border dourado em volta da tela + haptic 40ms.

4. **Consultor D&D reavaliação**: ≥ 8/10 e veredito "drama D&D restaurado".

5. **Consultor Mobile reavaliação**: ≥ 7.5/10 (era 5.5).

---

## 7. Risco / armadilhas

- **W3.2 target-first sheet** é a mudança MAIS ARRISCADA (refactor de fluxo). Se travar, **só fazer W3.1 + W3.3 + W3.4 + W3.6** (fog of war + economy sticky + turn indicator + chips clamp) e deixar grid 11-ações temporariamente.
- **W2.5 suggest_actions opcional** muda DM behavior. Pode degradar respostas em primeiras chamadas — A/B mental sniff test.
- **W1.6 sound layered** depende de Web Audio API funcionar consistentemente em iOS Safari. Fallback graceful pra um single tone se falhar.

---

## 8. Ordem de execução recomendada na próxima sessão

```
1. Ler este SPRINT_W_PLANO.md
2. Confirmar estado git limpo + tests verde
3. W1 (dado) — começa pelo menos arriscado
4. typecheck + tests + preview check
5. W2 (mestre narrativo)
6. typecheck + tests + preview check
7. W3 (combate) — mais arriscado, time-box
8. typecheck + tests + preview check
9. W4.2 — re-spawn consultores SÓ DEPOIS de W1+W2+W3 prontos
10. Polish do que consultores ainda pedirem
11. Docs + push
```

Cada sub-sprint = 1 commit feature. Total esperado: 3-4 commits feature + 1 docs.

---

## 9. Para a próxima sessão IA

Lê este arquivo inteiro. Execute em ordem (W1 → W2 → W3 → W4). Cada Wn termina com:
- typecheck OK
- `npm test` verde (sem regressão)
- preview local validado nos cenários relevantes
- commit feature com mensagem detalhada
- NÃO faça push até W4 estar completo (push uma vez no fim)

Após W4.2 (re-spawn consultores), se reavaliação for boa, commitar W4 docs + push. Se algum consultor ainda apontar gap crítico, fazer W5 com os fixes específicos antes do push.

**Não invente novas mudanças** — o plano cobre as 5+ recomendações de cada consultor. Se descobrir bug fora do plano, anota no handoff mas não fixa (escopo creep mata sprints).
