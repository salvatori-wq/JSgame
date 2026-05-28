# Handoff — Ciclo N "Hierarquia + Visual Rich + Polish Vivo" entregue

> **Data**: 2026-05-29 · **1 commit feature + 1 commit docs** · **1635→1657 tests verde (+22)** · **typecheck OK** · **working tree limpo**

## 1. Contexto

Audit visual real pós-Sprint "Polish Mobile Profundo" (M1/M2/M3). Cold-open Gemini real
~14s + DOM inspect detalhado. 9 achados pela equipe das 4 personas (Mariana DM 10+a /
Tiago mobile / Beatriz UX / Henrique família).

## 2. Commits

```
6007565 feat(N): hierarquia + visual rich + polish vivo — 9 melhorias 3 rounds
<este>  docs: HANDOFF ciclo N + CLAUDE.md
```

## 3. N1 — Hierarquia + clareza

### N1.1 — Verdict idle educacional + chip DC tooltip

**Antes:**
- Verdict "Clique pra rolar o d20" — frio, genérico, não educa
- Chip "DC 12" sem contexto — newbie pergunta "12 é difícil?"

**Depois:**
- Verdict: `d20 + 1 vs DC 12 — toque pra rolar` (educacional, mostra fórmula)
- `dcDifficultyLabel()` exportada com 6 faixas PHB DMG p.238:
  ```
  DC ≤5  → Muito fácil (qualquer um passa)
  DC ≤10 → Fácil (treinado quase sempre passa)
  DC ≤14 → Média (50/50 pra mediano)
  DC ≤15 → Difícil (precisa rolar bem ou bônus alto)
  DC ≤24 → Muito difícil (heroico)
  DC ≥25 → Quase impossível (lendário)
  ```
- Chip-attr ganha title: "Bônus de [Skill] — atributo X +Y"
- Chip-dc ganha title: dcDifficultyLabel(dc)

### N1.2 — Hierarquia primeira narração

**Antes:**
- Speaker "MESTRE" 10px minúsculo — não competia com drop-cap mas era invisível

**Depois:**
- `.is-first-narration .cnn-speaker`: 10→13px + letter-spacing 0.18em + margin-bottom 6
- Marca claramente "início da história" com peso visual proporcional ao drop-cap

### N1.3 — Skip btn clareza + gap

**Antes:**
- "Pular este teste" ambíguo (Henrique família: "vai pular pra outro? cancela?")
- Gap roll↔skip 14px — polegar gordo tap acidental
- min-height 32px desktop / 36 mobile (mobile faltava 8px pra WCAG AAA)

**Depois:**
- Texto: "Pular — segue sem rolar"
- Title attr: "Não rola o dado. O Mestre continua a cena assumindo que você não percebeu/conseguiu."
- margin-top 4→14 + min-height 32→38 desktop / 36→44 mobile + font 12→13

## 4. N2 — Visual rich

### N2.1 — Texture pergaminho mobile

**Antes:**
- opacity 0.05 em todas viewports — em mobile com brightness alta ficava invisível

**Depois:**
- Mobile (≤480px): opacity 0.07 + baseFrequency 0.9→0.85 (textura ligeiramente maior) + matrix cor 0.82,0.7,0.42→0.88,0.74,0.45 (gold-warm mais quente)
- Desktop mantém 0.05 (sutil mantido)

### N2.2 — Echo separator visual

**Antes:**
- Echo "🎲 Borin: percepcao DC 12 → SUCESSO" + narração subsequente do Mestre fluíam visualmente conectados — player confundia mecânica com cena

**Depois:**
- `.is-roll-echo + .camp-narr-entry:not(.is-roll-echo)::before`:
  - 1px linear-gradient gold-28 (transparent → 30% → 70% → transparent)
  - top: -8px, left/right: 16px
  - margin-top 14 da entry subsequente
- Sinal sutil mas claro: "mecânica acabou, agora cena retoma"

### N2.3 — DC chip tooltip educacional

Implementado junto com N1.1 (chip-attr + chip-dc title attrs).

## 5. N3 — Polish vivo

### N3.1 — Status ribbon 🎲 prefix com pendingCheck

**Antes:**
- Quando overlay skill-check abria, ribbon mantinha glyph location (🛤 / 🌲 / etc)
- Se overlay fosse fechado por algum motivo (race, bug), player não sabia que ainda tinha teste pendente

**Depois:**
- `renderExplorationBody` checa `state.pendingCheck.playerId === character.id` OU `pendingSave.playerId === character.id`
- Se sim: glyph vira 🎲 + class `is-pending-roll`
- CSS keyframe `sr-roll-pulse` 1.4s scale(1→1.18→1) rotate(0→-6→0)
- `prefers-reduced-motion` override: animation:none

### N3.2 — Dock attention pulse RECORRENTE

**Antes:**
- `dockAttentionFired` flag boolean one-shot por sessão. Depois disso dock ficava estático.

**Depois:**
- Estado `lastDockAttentionAt` timestamp + throttle 3000ms
- `fireDockAttention()` helper idempotente: dispara se mobile + tem conteúdo + last > 3s atrás. Reflow forçado pra reiniciar anim.
- Chamado em: primeira render (`updateMainContent`) + `dmDone` socket event
- Pulse a cada momento chave da sessão sem virar flicker

### N3.3 — Drop-cap responsivo

**Antes:**
- Drop-cap fixo 38px desktop / 32px mobile — em narrações curtas (cold-open de combat com "Ataque!") dominava visualmente

**Depois:**
- `appendNarration` mede `payload.text.length`:
  - <100 chars → `data-drop-cap='sm'` (32px desktop / 28px mobile)
  - ≥100 chars → `data-drop-cap='md'` (38/32 padrão)
- CSS selector `[data-drop-cap='sm'] .cnn-text::first-letter` reduz proporcionalmente

## 6. Tests + Typecheck

| Estado | Tests | Typecheck |
|---|---|---|
| Antes N | 1635 | OK |
| Depois N | 1657 (+22) | OK |

### Tests novos:

**`dc-difficulty-label.test.ts` NOVO** — 7 tests
- Cada faixa (1-5, 6-10, 11-14, 15-19, 20-24, 25+) com fronteiras testadas
- Não vaza entre faixas (DC 10 não diz "Muito fácil")

**`status-ribbon.test.ts` +3 tests**
- pendingCheck pro player → glyph 🎲 + is-pending-roll
- pendingSave pro player → idem (saving throw)
- pendingCheck de OUTRO player → mantém glyph location

**`narration-log.test.ts` +3 tests**
- Narração <100 chars → data-drop-cap='sm'
- Narração >100 chars → data-drop-cap='md'
- Subsequentes (não first) → sem data-drop-cap

**`mobile-polish-css.test.ts` +9 CSS snapshot guards**
- N1.2 speaker 13px + letter-spacing 0.18em
- N1.3 skip margin-top 14 + min-height 38 desktop + 44 mobile
- N2.1 texture mobile 0.07
- N2.2 separator gradient gold-28
- N3.1 sr-roll-pulse keyframe + reduced-motion override
- N3.3 drop-cap sm 32 desktop + 28 mobile

## 7. Validação preview real

Cold-open Gemini real → mobile 375×812:

```
glyph: 🎲 (pendingCheck ativo) + class is-pending-roll ✓
verdict: "d20 + 1 vs DC 12 — toque pra rolar" ✓
chip-dc title: "DC 12 — Média (50/50 pra mediano)" ✓
skip btn: text "Pular — segue sem rolar", h=44, gap 24px ✓
speaker first-narr: 13px, letter-spacing 2.34px (~0.18em) ✓
first-narr data-drop-cap: "md" (texto longo cold-open) ✓
texture mobile: opacity 0.07 overlay ✓
separator::before: linear-gradient gold-28 1px abaixo ✓
```

## 8. Como retomar

Working tree limpo. Próxima sessão pode:
- Validar visualmente em mobile real (Render auto-deploy push)
- Considerar abrir Sprint μ "Mestre Não Falha" (SSE streaming) se latência cold-open
  ainda incomoda
- Reabrir N2.x se descobrir mais polish visual

## 9. Estado final

```bash
$ git log --oneline | head -8
<este>  docs: HANDOFF ciclo N + CLAUDE.md
6007565 feat(N): hierarquia + visual rich + polish vivo — 9 melhorias 3 rounds
0b935dd docs(M4): handoff Sprint Polish Mobile M1/M2/M3 + CLAUDE.md atualizado
5dc991c feat(M3): refino estético — tutorial padding + drop-cap + textura pergaminho
9837fc8 feat(M2): polish visual — chip icons + dice 2-col + roll echo styling
2e4c5d8 feat(M1): layout campanha mobile — dock proeminente + skip teste + location fluido
e985925 docs(D4): handoff sprint "Dado Visível" + plano de melhoria 10 achados
96f860e feat(D3): onboarding tutorial + detector expandido — dado fica óbvio
```

Tests: **1657 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**
