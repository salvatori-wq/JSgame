# Handoff — Ciclo O "Combat + Coop + Economy" entregue

> **Data**: 2026-05-29 · **1 commit feature + 1 commit docs** · **1657→1676 tests verde (+19)** · **typecheck OK** · **working tree limpo**

## 1. Contexto

Audit visual amplo pós-Ciclo N. Foco em ÁREAS MENOS COBERTAS nos ciclos M e N:
- Combat screen mobile (tabs, economy, enemies)
- Action dock topics (UX dos cards quando sub-actions = 1)
- Party panel mobile coop (3 PJs squeeze)
- Death save banner (momento mais dramático do D&D)

7 achados pela equipe das 4 personas — Mariana DM 10+a / Tiago mobile / Beatriz UX /
Henrique família 12a. Sem chamadas LLM reais — só DOM injection pra economizar créditos.

## 2. Commits

```
1b7c94f feat(O): combat + party coop + economy — 7 melhorias 3 rounds
<este>  docs: HANDOFF ciclo O + CLAUDE.md atualizado
```

## 3. O1 — Crítico

### O1.1 — Topics dock direct-action quando 1 sub

**Antes:**
- Click "Combate" (fora-de-combate) → drill com 1 botão "⚔ Atacar"
- Click "Social" → drill com 1 botão "🗣 Falar"
- Player precisa 2 taps pra fazer ação simples (UX overhead inútil)

**Depois:**
- `directActionFor(topic, ctx)` exportada — devolve handler se topic tem
  exatamente 1 sub-ação disponível
- Card ganha class `.is-direct` quando direct-action está armado
- Click no card dispara diretamente sem abrir drill
- Exclui topics que já têm fast-path próprio: `more` / `custom` / `dice` / `magic`

**Tests:** 10 cobrindo combat/social direct, explore null (4 subs), more/custom/dice/magic null,
combat social mid-turn direct, social disabled null

### O1.2 — Combat tabs hit 44px

**Antes:**
- `.cb-tab-btn` em portrait-narrow tinha min-height implícito ~33px (padding 8/6)
- Tab é navegação principal em combat — não pode ser fácil errar
- Hit < 44px viola WCAG AAA pra polegar mobile

**Depois:**
- `min-height: 44px` explícito
- Padding 8/6 → 10/8 (mais respiro)
- Font-size 11 → 12px (leitura melhor)

### O1.3 — Death save btn prominência

**Antes:**
- `.cdb-roll-btn` hit 39px (< 44 WCAG AAA) + font 12px
- Death save é MOMENTO MAIS DRAMÁTICO do D&D — vida do PJ pende de um d20
- Botão visualmente parecia botão normal

**Depois:**
- Hit 39 → 48px + font 12 → 14 + padding 14/28
- Gradient `#d04848 → #802020` mais saturado (vida pulsa)
- Border `#ff7060` (era `#e06060`)
- Box-shadow `0 4px 14px rgba(200,60,50,0.3)` + inset white sutil
- Text-shadow + font-weight 700
- Animação `cdb-roll-urgency` 2.4s ease-in-out infinite — shadow pulse 0.3→0.55
- `prefers-reduced-motion: reduce` → animation: none

## 4. O2 — Médio

### O2.1 — Economy "9m / 30ft" PT-BR

**Antes:**
- Combat economy slot mostrava "👟 30ft" — inconsistente com glossary D&D pt-BR
  que já diz "9m / 30ft"
- Status ribbon idem ("30ft" no economy compacto)

**Depois:**
- Combat: `👟 ${ec.movement * 0.3}m` (metros primeiro PT-BR)
- Title attr completo: `Movimento restante — Xm / Yft (1 quadrado = 1.5m = 5ft)`
  pra player que pensa em ft
- Status ribbon idem

### O2.2 — Party coop compact mobile

**Antes:**
- Em coop 3 PJs, `.cp-list` (grid auto-fit minmax 180px) → 1 col mobile
- 3 PJs × ~105px = 315px de conteúdo squeezed em 179px (max-height 22vh)
- Só ~1.5 PJs visíveis sem scroll vertical interno

**Depois:**
- `.cp-list.is-coop` (aplicado quando party.length > 1):
  - `display: flex; flex-direction: row; flex-wrap: nowrap`
  - `overflow-x: auto; scroll-snap-type: x mandatory`
  - Sem scrollbar visível
- `.cp-list.is-coop .cp-pj` → width 200px + scroll-snap-align: start
- `.cp-list.is-coop .cp-pj.is-me` → width 220px + `order: -1` (sempre primeiro)
- Compactação cp-pj-name 12px + cp-pj-meta 9px em coop
- Solo (.is-solo) mantém vertical full inalterado

## 5. O3 — Polish

### O3.1 — Economy slots visual gasto/disponível

**Antes:**
- `.cb-eco-slot.is-avail`: background gold + border gold + color gold
- `.cb-eco-slot.is-used`: opacity 0.4 + line-through
- Distinção OK mas faltava "punch" — disponível não brilhava, gasto não parecia tão morto

**Depois:**
- `.is-avail` ganha:
  - `box-shadow: inset 0 0 0 1px rgba(244, 208, 127, 0.18), 0 0 6px rgba(244, 208, 127, 0.12)`
  - Pulse sutil gold "tá vivo, pode usar"
- `.is-used` ganha:
  - `filter: grayscale(0.5)` (dessaturação visual)
  - `background: rgba(40, 28, 18, 0.4)` (escurece bg)
  - `border-color: rgba(120, 100, 70, 0.2)` (border faded)
  - "Tá gasto, esquece"

### O3.2 — Tab counts badge dourado

**Antes:**
- `cb-tab-btn` text: `⚔ Inimigos (2)` — count inline com label
- Visualmente apertado, parens não destacam

**Depois:**
- Estrutura DOM:
  ```html
  <button class="cb-tab-btn">
    <span class="cb-tab-label">⚔ Inimigos</span>
    <span class="cb-tab-badge">2</span>
  </button>
  ```
- `.cb-tab-badge` pill dourada: min-width 18px + height 18 + padding 0/5
  + background linear-gradient gold + color #1a0e04 + font 10px monospace +
  border-radius 9px + box-shadow glow
- Tab `.is-active`: badge ganha glow stronger 8px
- Substitui paren count inline com pill destacada — mais escaneável

## 6. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes O | 1657 | OK |
| Depois O | 1676 (+19) | OK |

### Tests novos:

**`action-dock-direct.test.ts` NOVO** — 10 tests
- combat exploration → handler (só "Atacar")
- social → handler (só "Falar")
- explore null (4 subs)
- more / custom / dice / magic null (já têm fast-path)
- combat social mid-turn direct
- combat social disabled (not my turn) null
- combat combat (8 ações) null

**`action-dock-topics.test.ts` 1 test ajustado** — "Social" agora direct-action,
trocou pra "Explorar" (4 subs) pra testar drill toggle

**`mobile-polish-css.test.ts` +10 CSS snapshot guards**:
- O1.2 cb-tab-btn min-height 44px
- O1.3 cdb-roll-btn 48px + keyframe urgency + reduced-motion
- O2.2 cp-list.is-coop flex/scroll-snap + cp-pj width/order
- O3.1 eco-slot avail box-shadow gold + used grayscale
- O3.2 cb-tab-badge pill 18px + 10px gold

## 7. Validação preview real

DOM injection mobile 375×812:

```
Direct-action cards: ["⚔️Combate", "🗣Social"] ← both .is-direct ✓
Death btn: hit=50, fontSize=14 ✓ (animation:none só em preview reduced-motion)
Coop list: flex/row/scroll-snap x mandatory ✓
Me card: width=220, order=-1 (primeiro) ✓
Tabs: hit=44 + badges separadas ("1" Inimigos, "2" Log) ✓
Economy: "👟 9m" (era 30ft) ✓
Eco-slot avail: box-shadow gold-18 ✓
Eco-slot used: grayscale(0.5) ✓
```

## 8. Como retomar

Working tree limpo. Próxima sessão pode:
- Testar em mobile REAL (Render auto-deploy push)
- Validar visualmente em coop com 3 amigos (party scroll-x funciona?)
- Considerar reabrir Sprint μ "Mestre Não Falha" (SSE streaming) se latência
  cold-open ainda incomoda em prod
- Audit visual focado em modais (spell-modal, inventory, shop) que não foram
  cobertos nesse ciclo

## 9. Estado final

```bash
$ git log --oneline | head -8
<este>  docs: HANDOFF ciclo O + CLAUDE.md atualizado
1b7c94f feat(O): combat + party coop + economy — 7 melhorias 3 rounds
62b3b4c docs: HANDOFF ciclo N hierarquia/visual/polish + CLAUDE.md
6007565 feat(N): hierarquia + visual rich + polish vivo — 9 melhorias 3 rounds
0b935dd docs(M4): handoff Sprint Polish Mobile M1/M2/M3 + CLAUDE.md atualizado
5dc991c feat(M3): refino estético — tutorial padding + drop-cap + textura pergaminho
9837fc8 feat(M2): polish visual — chip icons + dice 2-col + roll echo styling
2e4c5d8 feat(M1): layout campanha mobile — dock proeminente + skip teste + location fluido
```

Tests: **1676 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
