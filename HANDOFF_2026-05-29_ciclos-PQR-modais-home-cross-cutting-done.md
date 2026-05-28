# Handoff — Ciclos P + Q + R entregues (modais, home, cross-cutting)

> **Data**: 2026-05-29 · **3 commits feature + 1 docs** · **1676→1702 tests verde (+26)** · **typecheck OK** · **working tree limpo**

## 1. Contexto

3 ciclos seguidos pós-Ciclo O. Cobertura ampliada pra áreas até então não auditadas:
- **P** Modais centrais do gameplay (spell + inventory)
- **Q** Home polish (compactação + UX clarity)
- **R** Cross-cutting (toast system + transitions)

Total: 12 mudanças (5 + 4 + 3) com tests + commits separados por ciclo.

## 2. Commits

```
5e44cc3 feat(R): cross-cutting — toast hits 44 + attention pulse + mobile clearance
1958757 feat(Q): home polish — prefab compact + coop toggle + Salvar + footer
d69bbcf feat(P): modais — acessorio sintonia + spell CTA + slots/empty CTA + inventory
<este>  docs: HANDOFF ciclos P+Q+R + CLAUDE.md
```

## 3. Ciclo P — Modais (5 mudanças, +13 tests)

### P1 — Inventory acessorio com requiresAttunement
- Antes: tipo 'acessorio' sem branch — Anel da Sombra raro ficava inerte
- Depois: badge .inv-attuned (✨ Sintonizado, gold gradient solid border)
  ou .inv-needs-attunement (◇ Pede pra sintonizar, border dashed violet)
- Tooltip didático: "Item mágico — peça ao Mestre pra sintonizar (ação livre
  durante descanso curto)"
- Server toggle continua via DM tool call (sem socket novo)

### P2 — SpellCard CTA "🪄 Castar"
- Antes: card inteiro clicável mas affordance fraca
- Depois: .sc-cta-btn pill no footer compact:
  - is-castable: gold gradient + uppercase + glow + hover scale 1.04
  - is-no-slot: dim italic "— Sem slot —" pra educar (precisa restore)
- SÓ compact variant (cs-modal); full mantém info-only
- Tests: 5 cobrindo render compact castable/no-slot, SEM onClick, full, click

### P3 — Spell slots visual gasto/disponível
- Disponível: border-radius pill + gold violet glow box-shadow + weight 600
- Gasto (is-empty): line-through + italic + color #8a7898 + shadow none

### P4 — cs-modal-empty CTA descanso
- Antes: 1-liner "📜 Magias gastas. Descanso longo restaura..."
- Depois: estrutura icon 44px + title 16 + sub italic + CTA "🏕 Descansar 8h"
  (emit longRest direto + fecha modal). Fecha loop sem fechar modal → menu
  Mais → Descanso Longo.

### P5 — inv-empty estruturado
- Antes: 1-liner
- Depois: icon 44px + title "Bolsa vazia" + sub didática (origem dos itens)

## 4. Ciclo Q — Home polish (4 mudanças, +7 tests)

### Q1 — Prefab cards mobile compact
- .home-prefab-teaser hidden em portrait-narrow (era 1 linha de 22px)
- 3 cards: 136 → ~100px cada (section play-now 506 → ~380px)
- Label 14px + archetype 10px letter-spacing 0.04em

### Q2 — Coop input ID hidden por default
- .home-coop-input.is-hidden (max-height 0, padding 0, border 0)
- Click no btn "🔗 Entrar na Sala" expande input + foca (1° click)
- 2° click com valor submete; Enter no input também submete
- Coop section visualmente mais limpa

### Q3 — Identity "Login" → "💾 Salvar"
- "Login" confundia (cadastro obrigatório?) — Henrique família feedback
- "💾 Salvar" deixa explícito: opcional, salvar progresso
- Title: "Salvar progresso entre dispositivos (opcional — sem cadastro)"
- Test ajustado pra labels.some(l => l.includes('Salvar'))

### Q4 — Footer compact 48px
- min-height 50/56 → 48px (alinha com bottom-tab-bar do campaign)
- Padding 10 → 8, gap 4 → 3
- Icon 24 → 22px, label 11 → 10px
- Footer total 73 → ~62px

## 5. Ciclo R — Cross-cutting (3 mudanças, +6 tests)

### R1 — Toast hits WCAG AAA
- .toast-action-btn: min-height 32 → 44px (decisões críticas tipo "💉 Curar
  PJ caído" / "🎲 Death Save")
- Padding 4/10 → 8/14, font 12 → 13, border 0.35 → 0.4
- .toast-close-btn: 22×22 → 36×36 + border-radius 50% + bg hover sutil

### R2 — Toast attention pulse one-shot
- toast-error: animation toast-attention-error 0.9s (shadow 0.25 → 0.65 alpha
  + ring 3px no peak)
- toast-warn: animation toast-attention-warn 0.9s mais sutil (alpha 0.45 +
  ring 2px)
- Cubic-bezier(0.22, 0.61, 0.36, 1) — entrada rápida + ease
- prefers-reduced-motion: animation: none (já existia)

### R3 — Toast clearance bottom-tab-bar mobile
- Antes: bottom 80px fixo — tampava bottom-tab-bar (56px) + dock em situações
- Depois: --m-toast-bottom-offset var (default 120px = 56 tab + 64 buffer
  dock) + safe-bottom. Toast nunca cobre nav crítica.

## 6. Tests + Typecheck

| Ciclo | Tests | Typecheck |
|---|---|---|
| Antes P | 1676 | OK |
| Depois P | 1689 (+13) | OK |
| Depois Q | 1696 (+7) | OK |
| Depois R | 1702 (+6) | OK |

### Tests novos:

**Ciclo P:**
- `spell-card-cta.test.ts` NOVO 5 tests
- `mobile-polish-css.test.ts` +8 CSS snapshot guards

**Ciclo Q:**
- `identity-bar.test.ts` 1 test ajustado (Salvar)
- `mobile-polish-css.test.ts` +7 CSS snapshot guards

**Ciclo R:**
- `mobile-polish-css.test.ts` +6 CSS snapshot guards

## 7. Estado final

```bash
$ git log --oneline | head -10
<este>  docs: HANDOFF ciclos P+Q+R + CLAUDE.md
5e44cc3 feat(R): cross-cutting — toast hits 44 + attention pulse + mobile clearance
1958757 feat(Q): home polish — prefab compact + coop toggle + Salvar + footer
d69bbcf feat(P): modais — acessorio sintonia + spell CTA + slots/empty CTA + inventory
42103d2 docs: HANDOFF ciclo O combat/coop/economy + CLAUDE.md
1b7c94f feat(O): combat + party coop + economy — 7 melhorias 3 rounds
62b3b4c docs: HANDOFF ciclo N hierarquia/visual/polish + CLAUDE.md
6007565 feat(N): hierarquia + visual rich + polish vivo — 9 melhorias 3 rounds
0b935dd docs(M4): handoff Sprint Polish Mobile M1/M2/M3 + CLAUDE.md atualizado
5dc991c feat(M3): refino estético — tutorial padding + drop-cap + textura pergaminho
```

Tests: **1702 verde** · Typecheck: **OK** · Working tree: **limpo após este commit**

Total da sessão (ciclos M+N+O+P+Q+R): **9 commits feature + 6 docs**, 1591 → 1702 tests (+111).
