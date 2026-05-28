# Handoff — Ciclo S entregue (wizard + tutoriais + sticky + empty states)

> **Data**: 2026-05-29 · **3 commits feature + 1 docs** · **1702→1731 tests verde (+29)** · **typecheck OK** · **working tree limpo após docs**

## 1. Contexto

Audit visual amplo via leitura de código + preview runtime (375×812 portrait-narrow).
Áreas até agora NÃO cobertas profundamente pelos ciclos M+N+O+P+Q+R:
- Wizard de criação de PJ (header overflow, slider mobile, live-preview)
- Profile screen (header sticky)
- Sheet vitals review (cs-stats-grid mobile)
- Saving throw overlay (microcopy PT-BR)
- Exploration tutorial (6 cards com jargão dev)
- Glossary modal (empty state + hit a11y)
- Quest log modal (empty state sem orientação)
- Login screen (loading state visual)
- Home final (footer Login vs identity Salvar inconsistência)

14 mudanças em 3 commits + 14 tests novos + 15 CSS snapshot guards.

## 2. Commits

```
2b4f336 feat(S3): polish — prefab uniforme + glossary empty CTA + quest empty hints + login loading
2a79f97 feat(S2): médio mobile polish — sheet vitals/wizard slider/profile sticky/live-preview/glossary hit
80b2992 feat(S1): crítico — footer Salvar + wizard microcopy + progress scroll + saves PT-BR + tutorial família
<este>  docs: HANDOFF ciclo S + CLAUDE.md
```

## 3. Ciclo S1 — Crítico (5 mudanças, +17 tests)

### S1.1 — Home footer "🔑 Login" → "💾 Salvar"
Inconsistência: Q3 mudou identity bar pra "Salvar", footer continuou "Login".
Mesma ação com 2 nomes na MESMA tela. Logado mantém "👤 Perfil" intacto.

### S1.2 — Wizard CTA "(Wizard avançado)" → "Criar PJ no detalhe"
"Wizard" era jargão dev (família pensava "preciso ser bruxo?"). Title novo
explica passos + tempo estimado (~3 min).

### S1.3 — Wizard 8 progress steps overflow scroll mobile
Antes: `flex:1` espremido em 375px (cada step ~36px), polegar tocava 2.
Agora: `flex:0 0 auto + min-width:44 + scroll-snap mandatory` + scrollbar
hidden. Step atual ganha `scroll-snap-align:center`. wizard.ts faz
`scrollIntoView({inline:'center'})` quando step muda em mobile.

### S1.4 — Saving throw header "Save SAB" → "Save de SAB"
Alinha com tutorial body (line 73 já dizia "Save de") e glossary PT-BR.
Tutorial não-proficiente: "ability" → "atributo".

### S1.5 — Exploration tutorial 6 cards reescritos PT-BR família
- "skill check" → "teste de perícia"
- "overlay" → "tela do d20"
- "pivota pra combate" → "vira combate"
- "memória RAG" → "memória do Mestre"
- "party" → "amigos"
- Nat 20/1 mantidos (precisão Mariana)

CARDS exportado como `EXPLORATION_TUTORIAL_CARDS` pra tests.

## 4. Ciclo S2 — Médio (5 mudanças, +8 tests)

### S2.1 — cs-stats-grid wizard review 2x2 explícito
Default `auto-fit minmax(120px, 1fr)` em 375px wrap inconsistente.
Agora `repeat(2, 1fr)` + csb-value 24→18 + cs-stat-block padding 12→8.

### S2.2 — ab-row (step-abilities) slider respira mobile
row-gap 4→8 garante slider não cola nos botões dec/inc.
ab-slider min-height 28px (touch ergonômico polegar Android/iOS).

### S2.3 — Profile screen sticky header em mobile
Header "← Voltar / 🏆 Conquistas" reusa `.wiz-header` — não era sticky.
Em mobile rolava junto com body, usuário perdia referência scrollando
achievements + highlights + friends.
Cascade sticky agora: header `top:0` (z:5) → summary `top:52` (z:4)
→ section-h `top:142` (z:3). bg gradient gold fade + backdrop blur.

### S2.4 — Live-preview wizard padding mobile
Sidebar expandida em 375px com padding 14 default sobrava 0 respiração.
Mobile: wlp-body padding 10/8 + gap 8 + portrait 72→60px.

### S2.5 — Glossary search input WCAG AAA
`.gl-search` min-height 40 → 44px + padding 8/12 → 10/14 + font 14 → 15px
(15 evita iOS Safari auto-zoom em fonte <16 com accent visual ok).

## 5. Ciclo S3 — Polish (4 mudanças, +4 tests)

### S3.1 — Home prefab archetype mobile uniforme 24px
Antes: card 1 "Lutador Anão · Linha de frente" cabia em 1 linha (12px),
cards 2/3 quebravam em 2 linhas (24px) — cards de altura diferente.
Agora `min-height:24 + flex center`: card 1 cresce visualmente pro nível
dos outros 2. **Validado runtime — 3 cards = 24px exatos.**

### S3.2 — Glossary modal empty estruturado
Antes: "Nenhum termo encontrado. Tente outra busca." plano sem afford.
Agora: 🔍 icon 36 + título Cinzel + sub "Tente outra busca ou veja
todos os N termos." + CTA "← Ver todos (N termos)" (limpa search +
refoca input). Hit 44px WCAG AAA.

### S3.3 — Quest log empty com hints
Antes: "Nenhuma quest ainda. Explore e converse com NPCs." 1-liner
vago — novo player não sabia se loop estava quebrado.
Agora: 📜 icon + título "Nenhuma missão ainda" + duas vias claras:
- 💬 Use "Falar" com NPCs (taverneiro, guarda, viajante)
- 🗺 "Explorar" lugares novos (ruínas, masmorras, estradas)

### S3.4 — Login anon button loading state
Antes: 🎮 Jogar sem cadastro callback síncrono — em mobile lento
usuário clicava 2x (sem feedback visual).
Agora: click → adiciona `.is-loading` + `disabled` + troca pra
"⏳ Carregando…" + `requestAnimationFrame` defer pra DOM pintar antes
do callback. CSS dim 0.6 + cursor:wait + pointer-events:none.

## 6. Tests + Typecheck

| Ciclo | Tests | Typecheck |
|---|---|---|
| Antes S1 | 1702 | OK |
| Depois S1 | 1719 (+17) | OK |
| Depois S2 | 1727 (+8) | OK |
| Depois S3 | 1731 (+4) | OK |

### Tests novos:

**Ciclo S1:**
- `home/__tests__/footer.test.ts` NOVO 4 tests (slot 1 anônimo/logado + title + 3 slots)
- `campaign/__tests__/exploration-tutorial.test.ts` +6 tests (cards PT-BR família)
- `campaign/__tests__/saving-throw-overlay.test.ts` +2 tests (header + atributo)
- `__tests__/mobile-polish-css.test.ts` +5 CSS snapshot guards (S1.3 wizard scroll)

**Ciclo S2:**
- `__tests__/mobile-polish-css.test.ts` +8 CSS snapshot guards (S2.1×2, S2.2×2,
  S2.3×2, S2.4×1, S2.5×1) + ajuste 2 tests MP4 antigos pra nova cascade sticky.

**Ciclo S3:**
- `__tests__/mobile-polish-css.test.ts` +4 CSS snapshot guards (S3.1/S3.2/S3.3/S3.4)

## 7. Estado final

```bash
$ git log --oneline | head -10
<este>  docs: HANDOFF ciclo S + CLAUDE.md
2b4f336 feat(S3): polish — prefab uniforme + glossary empty CTA + quest empty hints + login loading
2a79f97 feat(S2): médio mobile polish — sheet vitals/wizard slider/profile sticky/live-preview/glossary hit
80b2992 feat(S1): crítico — footer Salvar + wizard microcopy + progress scroll + saves PT-BR + tutorial família
2071991 chore(dm): reordena cascade — Groq primary (1-2s + 14.4K req/dia)
b592f55 docs: HANDOFF ciclos P+Q+R + CLAUDE.md atualizado
5e44cc3 feat(R): cross-cutting — toast hits 44 + attention pulse + mobile clearance
1958757 feat(Q): home polish — prefab compact + coop toggle + Salvar + footer
d69bbcf feat(P): modais — acessorio sintonia + spell CTA + slots/empty CTA + inventory
42103d2 docs: HANDOFF ciclo O combat/coop/economy + CLAUDE.md
```

Tests: **1731 verde** · Typecheck: **OK** · Working tree: **limpo após docs**

Total da sessão (ciclos M+N+O+P+Q+R+S): **12 commits feature + 7 docs**, 1591 → 1731 tests (+140).

## 8. Áreas adjacentes não tocadas neste ciclo (próxima sessão)

- Rest UI (long rest 8h overlay + short rest hit dice picker visual)
- Lobby coop personality picker visual (ν.3 mexeu mas pode mais)
- Achievements modal layout (cards/grid mobile)
- Memory NPC roster modal (já tem stat-block-modal Φ.2 mas list view talvez)
- Sheet equip slots visual (drag-and-drop affordance?)
- Login form email validação inline (S3.4 só cobriu anon)
- Combat dice roll overlay (já bom Ω.1 mas pode receber polish hit)
- Lobby join flow microcopy (S1.5 só tocou exploration tutorial)
