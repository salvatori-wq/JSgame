# Handoff — Sprint "Polish Mobile Profundo" M1/M2/M3 entregue

> **Data**: 2026-05-29 · **3 commits feature + 1 commit docs** · **1591→1635 tests verde (+44)** · **typecheck OK** · **working tree limpo**

## 1. Contexto

Continuação do plano "Plano de Melhoria" deixado pelo Sprint "Dado Visível" anterior
(commit `e985925` docs). 10 achados pós-sprint observados em preview real, organizados
em 3 rounds:
- **M1 (crítico)**: Layout campanha mobile — dock fora viewport, dispensar dado, header truncado
- **M2 (médio)**: Polish visual — chips com ícones, dice 2-col, echo styling
- **M3 (polish)**: Refino estético — tutorial padding, drop-cap, background pergaminho

Equipe das 4 personas (Mariana DM / Tiago mobile / Beatriz UX / Henrique família) guiou
decisões. Sem chamadas LLM reais — DOM injection via preview_eval pra economizar créditos.

## 2. Commits

```
2e4c5d8 feat(M1): layout campanha mobile — dock proeminente + skip teste + location fluido
9837fc8 feat(M2): polish visual — chip icons + dice 2-col + roll echo styling
5dc991c feat(M3): refino estético — tutorial padding + drop-cap + textura pergaminho
<este>  docs(M4): handoff Sprint Polish Mobile + CLAUDE.md atualizado
```

## 3. M1 — Layout campanha mobile (`2e4c5d8`)

### M1.1 — Dock + party compacto + atenção visual

**Antes:**
- Party slot tomava 22vh (179px em 812 viewport) com 1 PJ — bloat
- Dock border 0.35 alpha + shadow -8/24 — depth fraca
- Player relata "scroll necessário pra ver dock"

**Depois:**
- `.ch-slot-party.is-solo` quando `party.length === 1`: max-height 22vh → 16vh
  (libera 49px pra narration host respirar)
- Dock border 0.35 → 0.45 + shadow -10/28 + linha gold-18 acima (depth visual maior)
- Animação `dock-attention-once` 1.8s ao montar dock pela 1ª vez na sessão
  (chamada de atenção pro "interage aqui"). Respeita prefers-reduced-motion.
- Flag `dockAttentionFired` private booleano — só dispara uma vez por instância

**Validação preview (mobile 375×812):**
- party: 179 → 130px (-49)
- narration host: 367 → 416px (+49)
- dock: top 588, bottom 756, fits viewport ✓

### M1.2 — Botão "Pular este teste" no skill-check overlay

**Antes:**
- Cold-open força roll d20 — não tem opção "rolar depois" ou "pular"
- Player Mariana que quer ignorar a emboscada e seguir, não conseguia

**Depois:**
- 3º callback opcional `onSkip` em `showPendingSkillCheck()`
- Botão `.sc-skip-btn` sutil link-like:
  - italic + ink-mute color + underline dotted gold-40%
  - min-height 32px (não compete com .sc-roll-btn 44px)
  - "Pular este teste" texto direto
- Socket `skipPendingCheck` novo no `ClientToServerEvents`
- `Campaign.clearPendingCheck(playerId)` valida ownerId — retorna `null` se
  não é owner OU pending vazio. Retorna `{ reason, skill }` se limpou.
- Server emite `dmNarration` "🚶 [PJ]: pula o teste e segue em frente — [reason]"
- Não chama DM (rápido) — só limpa state + broadcastState

**Tests:** 5 UI (render/click/idempotent) + 3 server (limpa/wrongPlayer/vazio)

### M1.3 — Header location truncate fluido

**Antes:**
- `shorten(loc, 18)` em JS cortava "Estrada sob chuva fina" pra 17 chars +
  ellipsis MESMO em viewports largos
- "Estrada sob chuv…" — Mariana não conseguia ver nome completo

**Depois:**
- `shorten()` removido. `.sr-loc` ganha:
  - `flex: 1 1 auto; min-width: 0; max-width: 100%`
  - Stats (HP/slots/XP) mantêm `flex-shrink: 0`
- CSS ellipsis kicka SÓ quando location > clientWidth real
- `title` attr expõe nome completo (tooltip desktop + a11y)

**Validação preview:**
- "Estrada sob chuva fina" (22 chars) → cabe inteiro, ZERO ellipsis
- "Estrada sob chuva fina no caminho das torres caídas de Andumal" (62 chars)
  → scrollWidth 434 > clientWidth 197, ellipsis kicka

## 4. M2 — Polish visual (`9837fc8`)

### M2.1 — Chips com ícones de ação

**Antes:**
- "Falar com Borin" sem 🗣
- "Seguir em frente" sem 🚶
- "Atacar o vulto" sem ⚔
- Player precisava ler texto inteiro pra entender ação

**Depois:**
- `chip-icon-detector.ts` NOVO — função pura sem dep DOM
- 16 patterns PT-BR regex case-insensitive de início:
  ```
  falar/conversar/dialogar/sussurrar/chamar/gritar/perguntar     → 🗣
  atacar/golpear/desferir/esfaquear/cortar/estoquear/lutar       → ⚔
  conjurar/lançar magia/invocar/recitar/canalizar                 → 🔮
  curar/ajudar/salvar/proteger/benzer/abençoar                    → 💚
  fugir/recuar/escapar/correr                                     → 🏃
  esconder/furtar/emboscar/infiltrar                              → 🥷
  pegar/agarrar/recolher/coletar/apanhar/tomar                    → ✋
  abrir/destrancar/arrombar/forçar a porta/romper                 → 🔓
  ler/estudar/decifrar/interpretar                                → 📖
  esperar/aguardar/vigiar/observar passivamente                   → ⏳
  seguir/continuar/avançar/prosseguir/caminhar/andar/ir até       → 🚶
  subir/escalar/trepar/ascender                                   → 🧗
  beber/comer/consumir/degustar/provar                            → 🍺
  dormir/descansar/repousar/acampar                               → 🌙
  equipar/vestir/empunhar/sacar/desembainhar                      → 🛡
  comprar/vender/negociar/comerciar/barganhar                     → 💰
  ```
- `narration-log.setSuggestedChips` adiciona `.cn-chip-action-icon` prefix
  span SÓ em chips não-skill. Skill chips mantêm 🎲 dourado intacto.
- CSS: icon 13px (vs 16 do dado), opacity 0.88 → 1 em hover, drop-shadow leve

**Tests:** 17 cobrindo cada padrão + edge cases (case-insensitive, boundary, vazia, trim)

### M2.2 — Dice overlay 2-col em portrait-narrow

**Antes:**
- Layout vertical denso: label / sub / tutorial / chips+dado / verdict / btns
- Em 812 viewport com tutorial inline, sub italic "Notar a emboscada antes do
  primeiro golpe" ficava esmagado

**Depois:**
- `body.is-portrait-narrow .sc-stage` vira `display: grid` 2-col:
  ```
  grid-template-columns: 1fr auto;
  ```
- Col 1 row 1: `.sc-label` text-align left
- Col 1 row 2: `.sc-sub` text-align left + margin 0
- Col 2 rows 1/-span 2: `.sc-row` flex-direction: column + align-self: center
  (chip-attr → dado → chip-dc empilhados à direita)
- Full-width abaixo (col 1/-1): `.sc-tutorial`, `.sc-verdict`, `.sc-roll-btn`,
  `.sc-skip-btn`
- Override `padding-top: 50px` (dice.css) → 20px em portrait-narrow (era buffer
  pra drop-in landscape; em column o dado cai naturalmente do grid pai)

**Validação preview:**
- stage_height: 398px (cabe folgado em 812 viewport)
- gridTemplateColumns: "233px 88px" — 2 cols efetivas
- Label/sub à esquerda (left=20, right=253), row à direita (left=267, right=355)

### M2.3 — Echo do roll com styling diferenciado

**Antes:**
- "🎲 Borin Forjarocha: percepcao (DC 12): rolou 15 → SUCESSO" renderizado
  IGUAL às narrações do Mestre — visual misto, mecânica + cena confusas

**Depois:**
- `buildEntryEl()` detecta `entry.speaker.startsWith('🎲 ')`, `'🛡 '` ou `'🚶 '`
  → aplica `.is-roll-echo` class
- CSS `.camp-narr-entry.is-roll-echo`:
  - opacity 0.78 (hover: 1)
  - background rgba(20, 12, 8, 0.32) (vs 0.6 normal)
  - border-left 2px rgba(160, 130, 70, 0.35) (vs 3px solid rune)
  - padding 4px 12px 4px 10px (compacto)
- `.is-roll-echo .cnn-speaker` font-size 9px gold-55 letter-spacing 0.12em
- `.is-roll-echo .cnn-text` font-size 12px italic Cardo + tabular-nums + ink-mute

**Validação preview:**
- Echo entry: fontSize=12px, fontStyle=italic, color=rgb(140,124,102), opacity=0.78 ✓
- Narração normal do Mestre: NÃO ganha class ✓

## 5. M3 — Refino estético (`5dc991c`)

### M3.1 — Tutorial Duolingo padding mobile

**Antes:**
- Card "Bem-vindo a JSgame" com texto longo (4 linhas) com padding 12/10 apertado
- Skip "Pula" 24px (não chega aos 44px WCAG AAA)

**Depois:**
- `@media (max-width: 480px)`:
  - tooltip padding 12/14/10 → 18/18/16
  - glyph 32 → 36px
  - title 16 → 17px margin-bottom 8 → 10
  - text 13 → 14px line-height 1.55, margin-bottom 14 → 18
  - `.dt-skip` min-height 32 → 44 + padding 8/12 → 10/14
  - `.dt-nav-btn` min-height 36 → 44

**Validação preview:**
- Skip: height=44, padding 10/14 ✓
- Nav (Voltar/Próximo): height=44, minHeight 44px ✓
- Tooltip padding 18px 18px 16px ✓

### M3.2 — Drop-cap na primeira narração

**Antes:**
- Cold-open texto "Chuva fina cai sobre a estrada..." em font Cardo 15px
  + speaker "MESTRE" 10px → hierarquia fraca, sem ritual

**Depois:**
- `.is-first-narration .cnn-text::first-letter`:
  - font Cinzel 38px (mobile 32px) line-height 0.9
  - color gold (244, 208, 127)
  - float: left + margin 4/8/0/0
  - text-shadow gold-glow 12px + black depth 2px 4px
- Aproveita class `.is-first-narration` JÁ existente (sub-sprint C anterior)
- Cria momento "Era uma vez..." dramático em livro D&D antigo

### M3.3 — Background texture pergaminho

**Antes:**
- Tela 100% cor `#0a0608` (bg-deep) preta chata
- Sem "feel" de mesa medieval

**Depois:**
- `.camp-screen::before` pseudo-element com SVG fractalNoise inline:
  ```svg
  <svg width=240 height=240>
    <filter id=n>
      <feTurbulence type=fractalNoise baseFrequency=0.9 numOctaves=2 stitchTiles=stitch/>
      <feColorMatrix values=0 0 0 0 0.82  0 0 0 0 0.7  0 0 0 0 0.42  0 0 0 1 0/>
    </filter>
    <rect filter=url(#n)/>
  </svg>
  ```
- opacity 0.05 + mix-blend-mode: overlay → sutil, mais sentido que visto
- z-index -1 + `isolation: isolate` (não vaza pra app)
- Cor noise tinge gold-ish (0.82, 0.7, 0.42 RGB matrix) — pergaminho cor
- `pointer-events: none` (não bloqueia interações)
- ~700b base64 inline — sem fetch externo, cacheado pelo browser

## 6. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes M | 1591 | OK |
| Depois M1 | 1599 (+8) | OK |
| Depois M2 | 1621 (+22) | OK |
| Depois M3 | 1635 (+14) | OK |

**+44 tests total. Zero regressão.**

### Tests novos por sub-sprint:

**M1:**
- `campaign-player-initiated-roll.test.ts` +3 tests (clearPendingCheck: match/wrongPlayer/empty)
- `skill-check-skip.test.ts` NOVO 5 tests (render/click/close/idempotent)

**M2:**
- `chip-icon-detector.test.ts` NOVO 17 tests (16 patterns + edge cases)
- `narration-log.test.ts` +5 tests (is-roll-echo: skill/save/skip/Mestre/NPC)

**M3:**
- `mobile-polish-css.test.ts` +14 tests (CSS snapshot guards M1/M2/M3 todos)

## 7. Como retomar

Working tree limpo. Próxima sessão:
- Validar visual end-to-end com gameplay real (criar PJ → cold-open → ver dock pulse,
  drop-cap, chips com ícones, echo style, textura pergaminho)
- Provavelmente João vai querer testar em mobile real (deploy auto-push pro Render)
- Pode reabrir sprint μ "Mestre Não Falha" (SSE streaming) se latência ainda incomoda

## 8. Estado final

```bash
$ git log --oneline | head -8
<este>  docs(M4): handoff Sprint Polish Mobile + CLAUDE.md atualizado
5dc991c feat(M3): refino estético — tutorial padding + drop-cap + textura pergaminho
9837fc8 feat(M2): polish visual — chip icons + dice 2-col + roll echo styling
2e4c5d8 feat(M1): layout campanha mobile — dock proeminente + skip teste + location fluido
e985925 docs(D4): handoff sprint "Dado Visível" + plano de melhoria 10 achados
96f860e feat(D3): onboarding tutorial + detector expandido — dado fica óbvio
3cb9d63 feat(D2): "🎲 Tentar" picker persistente — player toma iniciativa de rolar
b0f40eb feat(D1): chip-skill visível — ícone 🎲 + border dourado + badge destacado + hit 44
```

Tests: **1635 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
