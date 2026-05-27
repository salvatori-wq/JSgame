# JSgame · Estratégia "Mobile Polish — Cada Pixel Enquadrado"

> **Filosofia**: JSgame é mobile-first no discurso, mas tem 14 lugares onde info quebra, transborda, ou fica apertada em 360px (iPhone SE / Android base). Não é falta de feature — é falta de enquadramento. Esta sessão revisita TELA POR TELA e termina de enquadrar.

> **Princípio guia**: nada deve transbordar. Nada deve precisar de zoom-pinch. Cada elemento tem espaço pra respirar, hit target ≥38px, e quando há mais info que tela, scroll é OBVIO (não acidental).

---

## 1. Diagnóstico mobile — atrito real por tela

Análise baseada em audit estático de CSS (`@media (max-width)`, `body.is-portrait-narrow`, grid layouts) + comportamento conhecido em 360×740px (target spec).

### 1.1 Resumo: media queries existentes vs necessárias

**Hoje (5 files com max-width breaks)**:
- `campaign-party.css` — apenas achievement toast position (1 caso)
- `dice.css` — die size + padding overlay (γ.1)
- `prefab-cards.css` — stack vertical em 720px (F1)
- `campaign-core.css` — chip hint padding (1 caso)
- `overflow-menu.css` — popover width + hit target (γ.5)

**`body.is-portrait-narrow` ativo em 9 files** (avalia width<600 via JS). Cobre:
- combat tabs (esconde desktop, mostra mobile)
- inv-equipped-grid colapsa 1col
- cb-enemies 2col em vez de 3col
- cb-actions-grid 3col em vez de 4col
- cp-list 1col

**Falta cobertura mobile específica em**:
- ❌ Wizard 5-step progress bar (sempre horizontal, em 360px aperta)
- ❌ Sheet screen (header 3col + vitals grid 110px minmax + skills longo)
- ❌ Modals em geral (`width: min(90vw, 720px)` — em 360px = 324px usable interna)
- ❌ Shop modal (grid 220px minmax → 1col forçado mas items cramped)
- ❌ Inventory modal (grid 250px → 1col mas com nested grids dentro)
- ❌ Achievements modal (5 abas scroll-x mas conteúdo overflow)
- ❌ Camp header com 5 botões + ⋯ — testado em γ.5 mas SEM verificar texto truncation
- ❌ Lobby (players + chat + ready state)
- ❌ Profile screen (counters)
- ❌ Cast spell modal (slot picker + spell grid)
- ❌ Skill check overlay (chips + dado + DC em 1 row → quebra em 360px?)

### 1.2 Atritos confirmados por inspeção

| # | Tela | Problema | Impacto |
|---|---|---|---|
| 1 | **Wizard step bar** | 5 steps com `flex: 1` em horizontal — labels uppercase "ATRIBUTOS" wrap ou truncam em 360px | Wizard parece bagunçado |
| 2 | **Wizard race/class grid** | `minmax(280px/320px, 1fr)` — em 360px (com padding 16+16) sobra ~328px — cards apertados | Cards 1-col funcionam mas conteúdo apertado |
| 3 | **Camp narration** | `max-height: 55vh` — em mobile portrait, 55vh ≈ 400px — pode cortar narração longa | Texto cortado |
| 4 | **Camp header** | `grid-template-columns: auto 1fr auto` — em 360px com 4-5 botões a direita encolhem o título | Título truncado |
| 5 | **Combat initiative tracker** | Scroll horizontal mas SEM scroll hint visual — player não sabe que pode scrollar | Combatentes escondidos |
| 6 | **Combat enemy cards** | 2-col em mobile mas com nested HP bar + condições + descrição → vertical longo, scroll exhausting | Player perde noção dos inimigos |
| 7 | **Combat action grid** | 3-col com 9-10 actions (attack/dodge/dash/disengage/hide/help/grapple/shove/2-weapon/magia) → 3-4 linhas em 360px | Action bar ocupa 1/3 da tela |
| 8 | **Action economy badge** | 4 slots em row com `flex-wrap` — pode quebrar em 2 linhas em 360px | Layout instável |
| 9 | **Sheet vitals grid** | `minmax(110px, 1fr)` — em 360px (-padding) sobra ~328px = 2-3 col mas 7 vitals (HP/AC/XP/Init/Speed/Prof/Insp) → grid bagunçado |
| 10 | **Sheet skills list** | 18 skills sem grid, scroll vertical longo | Sheet vira scroll fest |
| 11 | **Shop modal grid** | `minmax(220px, 1fr)` em 90vw=324px = 1col mas card item interno tem 3-col (icon+name+price) que apertam | Preço/qtd truncam |
| 12 | **Inventory modal grid** | `minmax(250px, 1fr)` similar — item card body tem 2 actions stacked, leitura quebrada | Botões equip/use perto demais |
| 13 | **Achievements modal** | 5 abas com `scroll-x mandatory` mas tab labels grandes ("CONQUISTAS DE COMBATE") → scroll exhausting | Player não acha categoria |
| 14 | **NPC roster modal** | Cards com `minmax(250px, 1fr)` — em 360px 1col, mas info densa (nome+arquétipo+atitude+notas) sem hierarquia visual | Difícil scanear |
| 15 | **Skill check overlay** | Row "chip-bonus | dado | chip-DC" — em 360px com chip-attr "INT +3" + die 58px + chip-DC "DC 13" = ~200px + gaps. OK mas quase apertado |
| 16 | **Cast spell modal** | Header + slots horizontal + lista spells — slots wrap em 360px (3-5 slots), spell cards cramped |
| 17 | **Lobby screen** | Player rows + chat + dificuldade — chat em mobile compete por altura |
| 18 | **Login screen** | Email input + magic link button — OK simples |
| 19 | **Profile screen** | Counters em `minmax(180px, 1fr)` → 1col mobile, OK; mas tabs categoria podem virar wrap |
| 20 | **Combat tutorial cards** | Stack vertical, OK em mobile (já testado em playtest) |

### 1.3 Atritos transversais

- **Hit targets**: nem todos botões têm ≥38px (chips inline, dropdown options, modal close `28×28` = abaixo do mínimo)
- **Padding inconsistente**: `var(--gap-loose)=16px` mistura com hardcoded `12px`, `14px`, `10px` — quebra ritmo visual
- **Type scale**: `--fs-xs:11px` é legível mas `--fs-xs` aparece em pills/badges que com letter-spacing 0.04em ficam comprimidos em 360px
- **Modal swipe-down**: γ.5 mencionou padronização mas só dice-overlay+overflow-menu implementaram. Inventory/Shop/Achievements/NPC roster/Cast-spell/Memory NÃO têm swipe-down
- **Sticky elements**: nenhum dos modais tem header sticky — scroll perde o título
- **Long-list rendering**: spell list, skill list, inventory podem render 30+ items sem virtualização (OK pra D&D 5e mas afeta scroll smoothness)

---

## 2. Princípios não-negociáveis

1. **Spec primário: 360×740px** (iPhone SE 2/3, Android base). Tudo enquadrado nesse retângulo.
2. **Spec secundário: 414×896px** (iPhone Plus, Pixel). Mesmo layout, respira mais.
3. **Hit target ≥38px** em qualquer botão que receba toque. Excepção: chips inline em texto (mas com padding generoso).
4. **Sem zoom-pinch necessário**: tudo legível em font-size base ≥12px em mobile.
5. **Modal pattern unificado**: header sticky + body scroll + footer fixo + swipe-down close.
6. **Type hierarchy**: title→subtitle→body→meta→pill com fs declinante. Nunca dois `fs-xs` adjacentes.
7. **Padding consistente**: 12px em mobile, 16px tablet+. Gap entre items = 8px ou 12px.
8. **Reduce-motion respeitado em TODAS animações novas.**
9. **Reusa primitivas existentes** (overflow-menu, modal-overlay) — não recria padrão paralelo.
10. **Tests sempre verde** (1007 hoje).
11. **Zero budget**.

---

## 3. Plano por sessão — 4 sessões temáticas

> Ordem de execução: **1 → 2 → 3 → 4**. Cada uma é commit atômico independente. Total ~14h.

---

### Sessão 1: "Fundação Mobile" (~3h)

**Objetivo**: Tokens + padrões base + helpers reutilizáveis. Tudo que sessões 2-4 vão usar.

#### 1.1 Tokens de spacing mobile

`src/client/styles/_tokens.css`:

```css
:root {
  /* Mobile-specific spacing (override de --gap-* em mobile) */
  --m-padding-screen: 12px;        /* padding lateral telas */
  --m-padding-card: 12px;
  --m-padding-modal: 14px;
  --m-gap-tight: 6px;
  --m-gap-base: 10px;
  --m-gap-loose: 14px;
  --m-hit-min: 40px;               /* hit target mínimo */
  --m-hit-comfortable: 44px;       /* hit confortável (CTAs primários) */
  --m-modal-max-h: 90dvh;          /* dvh = dynamic viewport, conta com URL bar */
  --m-modal-radius: 12px;          /* radius modais mobile */
  --m-text-min: 12px;              /* nunca menor que isto em mobile */
}

/* Aplica overrides quando portrait-narrow */
body.is-portrait-narrow {
  --gap-loose: var(--m-padding-screen);
}
```

#### 1.2 Helper CSS: classe `.m-stack` e `.m-row`

`src/client/styles/m-layout.css` (NOVO, ~80 LOC):

```css
/* Vertical stack com gap padronizado */
.m-stack { display: flex; flex-direction: column; gap: var(--m-gap-base); }
.m-stack-tight { gap: var(--m-gap-tight); }
.m-stack-loose { gap: var(--m-gap-loose); }

/* Row com gap padronizado */
.m-row { display: flex; flex-direction: row; gap: var(--m-gap-base); align-items: center; }
.m-row-between { justify-content: space-between; }
.m-row-wrap { flex-wrap: wrap; }

/* Hit target enforced */
.m-hit { min-width: var(--m-hit-min); min-height: var(--m-hit-min); }
.m-hit-cta { min-width: var(--m-hit-comfortable); min-height: var(--m-hit-comfortable); }

/* Container que NUNCA transborda */
.m-contain { max-width: 100%; overflow-wrap: anywhere; }

/* Visually hidden p/ a11y (movido pra cá de overflow-menu.css) */
.visually-hidden { ... }
```

#### 1.3 Helper TS: `useSwipeDown`

`src/client/m-swipe-down.ts` (NOVO, ~50 LOC):

Wrapper genérico — qualquer modal pode adicionar via `attachSwipeDown(element, onClose)`. Detecta touch start em handlebar visual + verifica delta Y > 80px + velocidade > 0.5px/ms = fecha. Já existe `onSwipeDown` em `util.ts` mas hoje só usa em poucos. Padroniza signature + adiciona handlebar visual `<div class="m-handlebar"></div>` automaticamente.

#### 1.4 Padrão visual `m-modal`

`src/client/styles/m-layout.css`:

```css
/* Padrão unificado pra modais mobile portrait */
body.is-portrait-narrow .m-modal {
  width: 100vw !important;
  height: var(--m-modal-max-h) !important;
  max-width: 100vw !important;
  max-height: 100dvh !important;
  border-radius: var(--m-modal-radius) var(--m-modal-radius) 0 0 !important;
  margin-top: auto;
  /* Bottom sheet style — sobe de baixo */
  animation: m-sheet-up 200ms ease-out;
}

@keyframes m-sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

body.is-portrait-narrow .m-modal-handlebar {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
  margin: 8px auto 0;
}

body.is-portrait-narrow .m-modal-header {
  position: sticky;
  top: 0;
  background: inherit;
  padding: var(--m-padding-modal);
  border-bottom: 1px solid rgba(160, 120, 60, 0.2);
  z-index: 2;
}

body.is-portrait-narrow .m-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--m-padding-modal);
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

body.is-portrait-narrow .m-modal-footer {
  position: sticky;
  bottom: 0;
  padding: var(--m-padding-modal);
  background: inherit;
  border-top: 1px solid rgba(160, 120, 60, 0.2);
  /* Safe area inset bottom (iOS notch) */
  padding-bottom: calc(var(--m-padding-modal) + env(safe-area-inset-bottom));
}
```

#### 1.5 Tests + commit

- Tests: snapshot do `m-layout.css` (existence de classes), unit do `attachSwipeDown` (delta + velocity), 6 tests
- Commit: `feat(MP1): tokens mobile + helpers .m-stack/.m-row/.m-modal + swipe-down`

**Métrica-validação**: viewport 360px renderiza qualquer container `.m-modal` ocupando full-width sem overflow.

---

### Sessão 2: "Combat & Campaign Header" (~4h)

**Objetivo**: 2 telas mais visitadas (campaign exploration + combat) ficam impecáveis em 360px.

#### 2.1 Camp header sem overflow

**Hoje**: `grid-template-columns: auto 1fr auto` — em 360px com botão Sair + Quest + Achievements + NPCs + Share + ⋯ (6 items), título "Campanha de Borin" pode truncar.

**Fix**:
- Em mobile portrait, header vira `grid-template-rows: auto auto` (2 linhas):
  - Linha 1: Sair (left) · Título centralizado · ⋯ (right)
  - Linha 2: chips horizontais scroll-x das ações (Quest, Achievements, NPCs, Share)
- Título com `text-overflow: ellipsis` + tooltip
- Chips scroll-x com snap pra ux limpa

#### 2.2 Camp narration: full-height adaptativo

**Hoje**: `max-height: 55vh` — em mobile portrait, narração ocupa ~50% da tela e action area outros 30%.

**Fix mobile-portrait**:
- Narration `flex: 1` (cresce com viewport)
- Action area sticky bottom (sempre acessível)
- Chips de ação ABOVE action buttons (scroll horizontal se +4 chips)
- Thinking indicator inline na narração (já tá), com proeminência maior

#### 2.3 Combat header — round + economia + initiative

**Hoje**: round + turn em row OK. Initiative scroll-x sem indicação visual.

**Fix**:
- Initiative tracker ganha fade gradient nos lados (indica scroll-x disponível)
- Adiciona indicator "← →" sutil quando há overflow
- Action Economy badge vira 2-row em mobile (não 1-row com wrap inconsistente):
  - Linha 1: 🎯 Ação · ✨ Bônus
  - Linha 2: 👟 Movimento · 🛡 Reação
- Hit target dos eco-slots cresce pra 40px tap area

#### 2.4 Combat enemy cards verticalizadas

**Hoje**: 2-col em mobile mas cards alto (nome+meta+HP+conds+desc) → muito scroll.

**Fix**:
- Em mobile portrait: 1-col mas mais COMPACTO
  - Linha única: avatar emoji · nome+HP bar · meta `(CA · attack · dmg)` · ⚔ tap
- Description só aparece em expand (tap longo ou ícone "?")
- Conditions virariam pills no topo direito do nome
- Crit kill animation continua (γ.1+F2)

#### 2.5 Combat actions: grid 2x2 + scroll

**Hoje**: 3-col, 9-10 actions → 3-4 linhas alto.

**Fix mobile portrait**:
- Actions divididos em 2 sub-grupos:
  - **Principais visíveis**: Atacar, Esquivar, Disparada, Magia (2x2 visível)
  - **Secundárias em overflow ⋯**: Hide, Help, Grapple, Shove, 2-arma, Disengage
- Botão ⋯ no fim do grid 2x2 abre menu compacto com 6 secundárias
- Action labels ficam só icon+1 palavra em 360px ("⚔ Atacar" em vez de "⚔ Atacar")

#### 2.6 Skill-check overlay mobile-OK

**Hoje**: row com `chip-attr · die · chip-DC` em flex — testou OK mas margens cortam.

**Fix**:
- Adiciona `m-stack` no skill-overlay-stage em portrait
- chips ficam em row, dado centralizado abaixo, DC ao lado do chip-attr (alinha visualmente)
- Botão "Rolar d20" + "Inspiração" empilhados, hit ≥44px (CTA)

#### 2.7 Tests + commit

- Tests: snapshot dos selectors aplicados em viewport 360px
- Commit: `feat(MP2): combat + campaign header mobile-polish`

**Métrica-validação**: viewport 360px combate ativo → 8 inimigos + 4 actions + initiative + economy todos visíveis sem scroll-spam.

---

### Sessão 3: "Modais Bottom-Sheet" (~4h)

**Objetivo**: 7 modais críticos viram bottom-sheets nativos mobile.

Aplicar pattern `m-modal` da Sessão 1 em:

#### 3.1 Inventory modal
- Header sticky com gold count
- Body com grid 1-col mais respirável (cards padding-modal)
- Equip/use buttons hit-comfortable
- Swipe-down close

#### 3.2 Shop modal
- Header sticky com PJ gold + lojista nome
- Body: itens em lista vertical, cada item linha única:
  - icon · nome · raridade pill · preço · botão "Comprar 12po"
- Sell tab (se acceptsSell) — switcher inline
- Footer sticky com "Fechar Loja"

#### 3.3 Cast spell modal
- Header sticky com nome do PJ + slots disponíveis (compactado: "L1:2 L2:1 L3:0")
- Body: lista de spells filtrada — 1 linha por spell (level pill · nome · school · descrição truncada)
- Tap spell → details expandido inline
- Footer sticky com slot picker + botão "Lançar"

#### 3.4 Achievements modal
- Header sticky com progress total "12/30" + bar
- 5 categorias viram tabs sticky (chips scroll-x abaixo do header)
- Body: lista de achievements (icon · nome · descrição · tier pill)
- Achievement locked mostra "??" mais discreto

#### 3.5 NPC roster modal
- Header sticky com count "8 NPCs conhecidos"
- Body: cards 1-col com:
  - avatar emoji + nome (heading)
  - arquétipo + atitude pill + relationship indicator (-5 a +5 com cor)
  - última vez visto: location + N interações
  - notas (collapsed se >2 linhas)
- Sort: relationship DESC (aliados primeiro)

#### 3.6 Quest log modal
- Header sticky com counts "3 ativas · 2 completas"
- Body: cards 1-col com:
  - title + giver (pequeno)
  - objectives lista com ✓/○
  - reward XP pill
- Active quests primeiro, completed embaixo collapsed

#### 3.7 Memory modal (RAG facts)
- Header sticky
- Body: lista facts agrupados por kind (npc/location/event/promise/lore)
- Cada fact com chip kind + texto + importância visual (border-left thickness)

#### 3.8 Tests + commit

- Tests: cada modal abre com swipe-down attached, header sticky on scroll
- Commit: `feat(MP3): 7 modais viram bottom-sheets em mobile`

**Métrica-validação**: cada modal em viewport 360px tem header e footer sempre visíveis ao scroll body.

---

### Sessão 4: "Sheet + Wizard + Profile + Lobby + Touches Finais" (~3h)

**Objetivo**: telas secundárias enquadradas + audit final.

#### 4.1 Wizard step bar adaptativa

**Hoje**: 5 steps flex:1 horizontal — "ATRIBUTOS" trunca em 360px.

**Fix**:
- Em mobile: barra colapsa pra "Passo 2/5 · Atributos" texto + barra de progresso linear abaixo
- Botões prev/next sticky bottom
- Click no passo concluído continua navegável (via tap no texto)

#### 4.2 Wizard race/class cards 1-col enxutos

**Hoje**: minmax 280-320px → cards apertados se forçados 1-col.

**Fix**:
- Em 360px: cards 1-col com 100% width
- Estrutura: linha única superior `icon + nome + bonus pills`, descrição abaixo, "Escolher" full-width botão
- Sub-races virariam dropdown dentro do card pai (não cards paralelos)

#### 4.3 Sheet screen — vitals + skills

**Hoje**: vitals grid 110px minmax → 2-3 col bagunçado. Skills longo.

**Fix**:
- Vitals em 2 rows fixos:
  - Linha 1: HP / AC / XP (3-col fixed)
  - Linha 2: Init / Speed / Prof / Insp (4-col fixed, pills mais compactos)
- Atributos em row de 6 (FOR/DES/CON/INT/SAB/CAR) scroll-x snap se overflow
- Skills divididas em accordion por atributo (FOR collapsable, DES collapsable, etc) — reduz scroll inicial
- Spells e features expandable da mesma forma

#### 4.4 Profile screen counters

**Hoje**: minmax 180px → 1-col em mobile, OK.

**Fix**:
- Categorias viram tabs sticky (igual achievements modal)
- Resumo (% completo) acima das tabs, fixed
- Tabs scroll-x se overflow

#### 4.5 Lobby polish

**Hoje**: Players list + chat + ready button.

**Fix**:
- Players list ocupa 40% top
- Chat ocupa 50% middle (scroll independente)
- Ready button sticky bottom 10%
- Em landscape: 2-col (players | chat) com ready abaixo

#### 4.6 Touches finais transversais

- Toast container em mobile fica acima do bottom-safe-area
- Achievement toast vira top-banner (não right-slide) em mobile
- Floating numbers no combate respeitam safe-area-top
- Tap highlight removido em todos `.cb-*`, `.m-*`, `.home-*` (-webkit-tap-highlight-color: transparent)
- Body scroll-padding-bottom pra sticky footers não comerem conteúdo

#### 4.7 Verificação final via preview

Roda preview em 5 viewports:
- 360×740 (mínimo iPhone SE)
- 414×896 (iPhone Plus)
- 390×844 (iPhone 13)
- 768×1024 (iPad portrait)
- 1280×800 (Desktop baseline)

Em cada viewport, navega: Home → Click prefab → Cold open → Skill check overlay → Resolve → Take action → Combat start → Initiative → Attack → Kill → Loot → Sheet → Modais (inventory/shop/spells)

Reporta screenshots + lista de coisas que ainda transbordam.

#### 4.8 Tests + commit

- Tests: snapshot dos selectors em viewport 360px (CSS classes corretas aplicadas)
- Commit: `feat(MP4): sheet + wizard + profile + lobby + finishes`

**Métrica-validação**: zero overflow em 360px em qualquer fluxo do jogo.

---

## 4. Cronograma de execução

```
Sessão 1 (Fundação)              ~3h   →  commit + push + tests verde
Sessão 2 (Combat + Header)       ~4h   →  commit + push + tests verde
Sessão 3 (7 Modais bottom-sheet) ~4h   →  commit + push + tests verde
Sessão 4 (Sheet+Wizard+Final)    ~3h   →  commit + push + tests verde
Deploy + handoff                 ~0.5h →  Chrome MCP no Render

Total: ~14.5h, 4 commits feature + 1 docs
```

Cada commit:
- Tests novos passando (target +30 total)
- Typecheck OK
- Push origin/main
- Suíte permanece verde (1007+)

Deploy único no fim.

---

## 5. O que NÃO está nesse plano

Cortado explicitamente:

- ~~PWA installable~~ — independente de polish atual
- ~~Offline mode~~ — fora de escopo
- ~~Native mobile app~~ — DOM puro mantido
- ~~Dark/light theme toggle~~ — tema gótico é decisão de arte
- ~~Customização cores~~ — paleta já bem trabalhada
- ~~Drag-and-drop inventory~~ — over-engineering pra mobile
- ~~Gesture-only navigation~~ — botões continuam como primário
- ~~Loading skeleton screens~~ — já tem thinking indicator
- ~~Push notifications mobile-native~~ — Web Notifications já existe

Se sobrar tempo, prioridade é AUDIT final via 5 viewports em vez de adicionar.

---

## 6. Métricas-validação por sessão

Métricas técnicas (mensuráveis):

| Métrica | Hoje | Pós S1 | Pós S2 | Pós S3 | Pós S4 |
|---|---|---|---|---|---|
| `body.is-portrait-narrow` rules count | 9 | 15 | 25 | 40 | 50+ |
| Hit targets ≥38px em mobile | ~70% | 80% | 90% | 95% | **100%** |
| Modais com swipe-down close | 2 | 2 | 2 | **9** | 9 |
| Modais com header sticky | 0 | 0 | 0 | **9** | 9 |
| `--m-*` tokens usados | 0 | **20+** | 30+ | 50+ | 80+ |
| Telas testadas em 360×740 | 5 | 5 | 9 | 16 | **20+** |
| CSS classes `.m-*` (helpers) | 0 | **8** | 8 | 10 | 12 |

Métricas qualitativas (validar via playtest):
- "Texto não corta" pós S2
- "Modal abre como bottom-sheet" pós S3
- "Sheet cabe sem zoom" pós S4
- Zero "preciso girar a tela" em fluxos principais

---

## 7. Como cada sessão constrói a próxima

| S1 entrega | S2 usa | S3 usa | S4 usa |
|---|---|---|---|
| `--m-*` tokens | Padding consistente em camp+combat | Padding em modais | Padding em sheet/wizard |
| `.m-stack` `.m-row` | Skill-check overlay layout | Modal body layout | Sheet sections layout |
| `.m-modal` pattern | (não usa direto) | TODOS 7 modais | Profile tabs |
| `attachSwipeDown` | (não usa direto) | TODOS 7 modais | (não usa) |
| `.m-hit` `.m-hit-cta` | Action buttons | Modal buttons | Wizard buttons |

**Sem desperdício, sem retrabalho. Cada peça serve a múltiplas seções.**

---

## 8. Princípio guia

> "Mobile não é desktop encolhido. Cada tela em 360×740 tem que ser FEITA pra ali — header sticky, body que respira, footer que não some atrás do teclado, modal que sobe de baixo. JSgame hoje é mobile-OK; depois dessa estratégia vira **mobile-NATIVO**."

A IA continua sendo o coração, o corpo agora está lindo, e o esqueleto (mobile structure) está enquadrado.
