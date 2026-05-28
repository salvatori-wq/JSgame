# Handoff — Ciclo T entregue (onboarding + sheet + rest UI + dice preview + lobby)

> **Data**: 2026-05-29 · **3 commits feature + 1 docs** · **1731→1770 tests verde (+39)** · **typecheck OK** · **working tree limpo após docs**

## 1. Contexto

Audit visual cobrindo gaps anotados no HANDOFF Ciclo S. Áreas até agora NÃO
cobertas profundamente: onboarding tour (microcopy + landscape fix), sheet
detail (hierarquia interna saves/inventory), achievements (banner anon +
distinção hidden vs locked), lobby (status indistinguível + preview overflow),
rest UI (short rest visual picker + long rest ritual), dice roll overlay
(preview chips), login email (loading state).

13 mudanças em 3 commits + 23 tests novos + 16 CSS snapshot guards.

## 2. Commits

```
93b5b6e feat(T3): polish — ach hidden distinct + dice preview chips + long rest ritual visual
950e19b feat(T2): médio — sheet saves card + inv separator + ach anon banner + lobby preview + short rest visual
13216fb feat(T1): crítico — onboarding PT-BR + tour fold + email loading + ach empty + lobby status
<este>  docs: HANDOFF ciclo T + CLAUDE.md
```

## 3. Ciclo T1 — Crítico (5 mudanças, +9 tests)

### T1.1 — Onboarding step 2 "Player's Handbook" → "Livro do Jogador (D&D 5e)"
Primeira impressão da família era em inglês. PT-BR conserva precisão D&D 5e.

### T1.2 — Onboarding tour mobile landscape fix
Em landscape estreita (380×600) actions caíam abaixo do fold sem scroll.
ot-card vira `flex column + max-height 85vh`; ot-body `overflow-y auto`;
ot-actions `margin-top auto` (pin bottom).

### T1.3 — Login email "Enviar link mágico" loading state
Antes: disabled silencioso após click — mobile lento usuário clicava 2x.
Agora: `.is-loading` + disabled + texto "⏳ Enviando…" + requestAnimationFrame
defer (mesmo padrão de S3.4 login anon). CSS opacity 0.65 + cursor wait.

### T1.4 — Achievements modal empty estruturado
Antes: "Nenhuma conquista nessa categoria ainda." 1-liner italic.
Agora: 🏆 icon 36 + título Cinzel "Nada por aqui ainda" + sub explicativa
com nome da categoria. Casa S3.2 (gl-empty) e S3.3 (qlm-empty).

### T1.5 — Lobby player status 'selecting' visualmente distinto
Status 'selecting' (escolhendo PJ existente) era indistinguível de 'joined'.
Agora ganha tint azul-aço (rgba 40/70/110 bg + 120/160/220 border) — distingue
de 'wizard' (roxo, criando do zero) e 'ready' (verde).

## 4. Ciclo T2 — Médio (5 mudanças, +12 tests)

### T2.1 — Sheet "Saving Throws" → "🛡 Resistências" + card visual
Antes: subheader cinza colava no grid de atributos sem separação.
Agora: card próprio com bg/border distintos + ícone 🛡 + título PT-BR
(consistente com saving-throw-overlay e glossary).

### T2.2 — Sheet inventory groups com separator visual
Antes: tipos (Armas/Armaduras/Itens) sem divisão — parede de texto.
Agora: border-bottom dotted gold + padding-bottom + margin-bottom entre
grupos. sig-type ganha border-bottom próprio. `:last-of-type` sem border.

### T2.3 — Achievements modal banner anônimo
Antes: usuário sem login via "tudo locked" sem entender o porquê.
Agora: banner top "🔒 Sem login — conquistas não salvam entre dispositivos.
Click em 💾 Salvar (home) pra sincronizar." Gradient gold sutil.

### T2.4 — Lobby personality preview mobile-safe
Antes: blockquote `.lpp-preview` podia estourar largura em portrait estreito.
Agora: `max-width:100% + word-break:break-word + overflow-wrap:anywhere`.
Em mobile reduz padding 10/14→8/10 e font 13→12 pra respirar.

### T2.5 — Short Rest visual picker (NOVO módulo)
Antes: `inputDialog` numérico "Quantos hit dice?" sem visual D&D.
Agora: `openShortRestPicker` — modal bottom-sheet com:
- Header "🛌 Descanso Curto"
- Info atual (HP atual/max · hit dice · d_N+ConMod)
- Chips clicáveis (1, 2, …, max) com is-selected gold (hit 44×44 AAA)
- Preview "❤ Estimado: ~X HP" (cap pelo HP missing)
- Hint sobre long rest restaurando dice
- Footer Cancelar / 🛌 Descansar (N dice)
- Fórmula PHB pura: `estimateShortRestHp(dieFaces, conMod, dice)`

## 5. Ciclo T3 — Polish (3 mudanças, +18 tests)

### T3.1 — Achievement `.ach-card.is-hidden` visual DISTINTO de `.is-locked`
Antes: hidden e locked usavam mesma grayscale + opacity 0.45 — usuário não
diferenciava "mistério" de "visto mas bloqueado".
Agora: `.is-hidden` ganha `blur(0.6px)` + tint roxo místico (bg gradient
roxo + border 160/110/200) — sinaliza "tem algo aqui que você não pode
ver". `.is-locked` mantém o cinza apagado.

### T3.2 — Dice roll overlay preview com chips visuais
Antes: "Ataque: d20+5 vs CA 13" texto plano sem hierarquia.
Agora: `parsePreviewParts` quebra em 4 chips coloridos:
- `[Ataque:]` italic mute
- `[d20]` gold pill background gold sutil
- `[+5]` verde-vida (ou vermelho se negativo)
- `[vs CA 13]` mute letter-spaced

Fallback pra texto puro se padrão não bater. Função pura exportada pra tests.

### T3.3 — Long rest ritual visual cinematográfico (NOVO módulo)
Antes: `confirmDialog` → emit longRest imediato sem fade narrativo.
Agora: confirm → `playLongRestRitual(...)` → emit. Overlay 1.8s com 3 steps:
- 🌙 "A noite cai…" (700ms)
- ⭐ "O grupo descansa…" (600ms)
- ☀ "Amanhece" (700ms)

Radial gradient noturno + icon-breath keyframe 2s scale + drop-shadow gold.
`prefers-reduced-motion`: pula direto pro callback (sem overlay).

## 6. Tests + Typecheck

| Ciclo | Tests | Typecheck |
|---|---|---|
| Antes T1 | 1731 | OK |
| Depois T1 | 1740 (+9) | OK |
| Depois T2 | 1752 (+12) | OK |
| Depois T3 | 1770 (+18) | OK |

### Tests novos:

**Ciclo T1:**
- `__tests__/onboarding-tour-content.test.ts` NOVO 4 tests (PT-BR + estrutura)
- `__tests__/mobile-polish-css.test.ts` +5 CSS snapshot guards (T1.2×2/T1.3/T1.4/T1.5)

**Ciclo T2:**
- `campaign/__tests__/short-rest-overlay.test.ts` NOVO 5 tests (fórmula PHB + edge cases)
- `__tests__/mobile-polish-css.test.ts` +7 CSS snapshot guards (T2.1/T2.2/T2.3/T2.4×2/T2.5×2)

**Ciclo T3:**
- `dice/__tests__/dice-roll-overlay-parse.test.ts` NOVO 8 tests (parsing 5 formatos + fallback)
- `campaign/__tests__/long-rest-ritual.test.ts` NOVO 6 tests (sequence + reduced-motion + timer)
- `__tests__/mobile-polish-css.test.ts` +4 CSS snapshot guards (T3.1/T3.2/T3.3×2)

## 7. Arquivos novos

- `src/client/campaign/short-rest-overlay.ts` — modal visual + estimateShortRestHp
- `src/client/styles/short-rest.css` — bottom-sheet srm-* spec
- `src/client/campaign/long-rest-ritual.ts` — overlay 3 steps + sequence config
- `src/client/styles/long-rest-ritual.css` — radial gradient + keyframes
- `src/client/__tests__/onboarding-tour-content.test.ts`
- `src/client/campaign/__tests__/short-rest-overlay.test.ts`
- `src/client/campaign/__tests__/long-rest-ritual.test.ts`
- `src/client/dice/__tests__/dice-roll-overlay-parse.test.ts`
- `HANDOFF_2026-05-29_ciclo-T-onboarding-sheet-rest-done.md` (este)

## 8. Estado final

```bash
$ git log --oneline | head -10
<este>  docs: HANDOFF ciclo T + CLAUDE.md
93b5b6e feat(T3): polish — ach hidden distinct + dice preview chips + long rest ritual visual
950e19b feat(T2): médio — sheet saves card + inv separator + ach anon banner + lobby preview + short rest visual
13216fb feat(T1): crítico — onboarding PT-BR + tour fold + email loading + ach empty + lobby status
8ab1647 docs: HANDOFF ciclo S + CLAUDE.md atualizado
2b4f336 feat(S3): polish — prefab uniforme + glossary empty CTA + quest empty hints + login loading
2a79f97 feat(S2): médio mobile polish — sheet vitals/wizard slider/profile sticky/live-preview/glossary hit
80b2992 feat(S1): crítico — footer Salvar + wizard microcopy + progress scroll + saves PT-BR + tutorial família
2071991 chore(dm): reordena cascade — Groq primary (1-2s + 14.4K req/dia)
b592f55 docs: HANDOFF ciclos P+Q+R + CLAUDE.md atualizado
```

Tests: **1770 verde** · Typecheck: **OK** · Working tree: **limpo após docs**

Total da sessão (ciclos M+N+O+P+Q+R+S+T): **15 commits feature + 8 docs**,
1591 → 1770 tests (+179).

## 9. Áreas adjacentes não tocadas neste ciclo (próxima sessão)

- Memory NPC roster list view (stat-block-modal já cobre detail, list pode receber polish)
- Sheet equip slots drag-drop affordance (refactor maior — comportamento + visual)
- Skill check overlay polish (visual já bom Ω.1, mas mods individuais como T3.2)
- Combat tutorial 1ª vez (existe combat-tutorial.ts mas não auditado)
- Spell preparation modal (cast-spell-modal já bom, prepare list talvez)
- Shop modal (modais.css tem .shop-* mas não auditado profundo)
- Death save UX (existe death-banner mas pode ganhar ritual visual como T3.3)
- Magic items attunement flow (P1 cobriu badge, mas ritual de sintonização?)
