# Handoff — Ciclo D (smoke mobile emulado) ENTREGUE

## 1. Estado atual

2026-05-31. Ciclo D do `FASE6_CACA_BUGS.md` executado. A responsividade fluida
F1-F6 já estava no ar (bundle `CUZEQW_w`); este ciclo foi a **validação que
faltava** — o smoke "no aparelho", feito por emulação profunda no preview
headless + 4 fixes do que escapou. Commit `ef6bc42` em `main`, **NÃO pushado**
(deploy é decisão do João). Suite 2125→2130 verde, typecheck limpo. Nada
bloqueante.

## 2. O que foi feito

Como o preview é headless/non-coarse (sem toque) e `env(safe-area)`=0, empurrei a
emulação ao limite em vez de só delegar pro aparelho: forcei as classes
`is-landscape-phone` que o caminho non-coarse pula, simulei a barra do browser
encolhendo a altura, simulei o caminho do dado no toque, e auditei os **contratos**
de safe-area/dvh/≥16px direto no CSS. Dirigi uma sessão com PJ prefab real (Borin)
→ exploração → skill-check (dado) → combate, na matriz 320/390/844×390. Hook DEV
`window.__nav` (gated `import.meta.env.DEV`) pra navegar determinístico.

### Pilares F1-F6 confirmados por medição (não inferência)
- **0 overflow-x** em toda a matriz (home/login/wizard/exploração/combate/skill-check).
- **Deitado usa o shell compacto, NÃO o desktop**: `desktopTabsLeaking:false` em
  combate 844×390 (o modo-falha que o F3 matou).
- **⚔ Atacar alcançável no deitado** (49px, in-view, bottom 384 ≤ 390).
- **Dado gira no toque em 1.3ms** (`is-rolling`+`animationName:dieRolling`), assenta
  e auto-fecha — NÃO LLM-gated.
- **Skill-check a 320**: dado 109px (vmin), overlay cabe 568 com `overflow-y:auto`,
  Rolar(y346)/Pular(y418) in-view.
- **Input 16px** (anti auto-zoom iOS).
- **font-scale 1.3** → body 16.9px (clamp floor 13×1.3, sem escala dupla), **0
  overflow novo**.
- **Safe-area** presente em campanha (L/R), skill-check (4 lados), dice (4 lados),
  bottom-tab (`--m-safe-bottom`), action-bar (bottom).

### 4 fixes (commit `ef6bc42`) — todos gated, desktop intacto
1. **D1 — `.sr-economy` clipada a 320 em combate** (`status-ribbon.css`). O
   "⚡✦↩️ 9m" `nowrap` estourava ~19px o `.sr-text` (overflow:hidden) → "9m"
   cortado. É redundante (o slot de economia STICKY, W3.3, tem o mesmo). →
   `body.is-portrait-narrow .sr-economy { display:none }`. Re-medido: 0 culprits.
2. **D2 — combat-tutorial "Pular" 11px** (`combat.css`). Link intocável no polegar
   → `body.is-portrait-narrow .ct-skip { min-height:44px; padding:12px 16px }`.
3. **D3 — login sem safe-area + header pesado no deitado** (`modals.css`).
   `padding:32px 16px` fixo → notch lateral escorregava o card. →
   `padding: max(px, env(safe-area-inset-*))` (desktop env=0 → inalterado) +
   `@media (max-height:500px)` compacta header (585→483px, CTA acima do fold).
4. **D4 — dock de combate espremido no deitado** (`m-camp-dock.css`). A 390h o
   recap pegava 101px e o dock ficava com 71px. Cap landscape 26vh→18vh
   (`clamp(56px,18vh,110px)`) → dock 71→84px. É a intenção do redesign ①.

`mobile-polish-css.test.ts` ganhou o bloco "Responsivo Ciclo D" (+5 guards).

## 3. Contexto técnico

- **Como reproduzir o sweep**: dev rodando (preview_start `jsgame-frontend`/
  `jsgame-backend`, portas 5173/3001). No preview: `window.__nav({kind:'login'})`
  etc. pra navegar; pra deitado forçar `body.classList.add('is-portrait-narrow',
  'is-landscape-phone')` (o headless non-coarse não auto-aplica). `preview_resize`
  NÃO dispara `resize` → `window.dispatchEvent(new Event('resize'))`.
  `preview_screenshot` trava — medir com `getBoundingClientRect`/`getComputedStyle`.
- **PJ prefab via API**: `POST /api/characters/prefab {prefabId:'borin',
  ownerName:'Aventureiro'}` → `__nav({kind:'campaign', characterId})`.
- **Backend hiberna**: no 1º acesso após idle os `/api/*` deram 500 por ~segundos
  (tsx watch reiniciando) e voltaram a 200. Se o prefab falhar, repetir.

## 4. Follow-ups (nenhum bloqueante)

- [ ] **Residual SÓ-aparelho do João** (2 min): notch real (login+narração no
      deitado), barra do browser (login 100dvh), física do dado em rAF real,
      auto-zoom iOS, auto-detecção do deitado (coarse). Checklist em
      `FASE6_CACA_BUGS.md` §Ciclo D → "Residual".
- [ ] **P2 — header de campanha 110px no deitado** (gargalo do dock de combate;
      pede redesign do `camp-header` — linha única densa OU toolbar no bottom em
      `is-landscape-phone`). Medir dock antes/depois.
- [ ] **P2 — fontes 9-10px hardcoded** que não escalam (`.sv-sub`/`.sa-name`/
      `.wlp-ab-key`/`.cp-pj-xp-txt`/`.btb-tab-label`) + `.wc-compare-btn` (toque
      22px). Acessibilidade, não bug de layout.
- [ ] **Push + deploy** (decisão do João): `git push origin main` + Manual Deploy
      no Render (auto-deploy free OFF). Ou configurar Deploy Hook pro Claude
      disparar sozinho.
- [ ] Pendências antigas (não-responsivo): keep-alive workflow, rotacionar token
      Turso, gaps do Sprint Z (NPC interrompe/voicing).

## 5. Arquivos tocados

- `src/client/main.ts` — hook DEV-only `window.__nav` (gated `import.meta.env.DEV`).
- `src/client/styles/status-ribbon.css` — D1 (`.sr-economy` hide).
- `src/client/styles/combat.css` — D2 (`.ct-skip` 44px).
- `src/client/styles/modals.css` — D3 (login safe-area + compaction).
- `src/client/styles/m-camp-dock.css` — D4 (landscape combat narração 18vh).
- `src/client/__tests__/mobile-polish-css.test.ts` — +5 guards Ciclo D.
- `FASE6_CACA_BUGS.md` — §Ciclo D reescrita (resultados + residual + P2).
- `CLAUDE.md` — Estado Atual (Ciclo D no topo; corrigido "deploy pendente").

## 6. Deploy / ambiente

- **Prod = F1-F6** (bundle `CUZEQW_w`). O Ciclo D (`ef6bc42`) está em `main` local,
  NÃO pushado/deployado. Render free com auto-deploy OFF → deploy é Manual no
  painel (`srv-d8abeurbc2fs73ft0fpg`) ou via Deploy Hook (não configurado).
- `npm run dev` (5173+3001) · `npm run typecheck` · `npx vitest run` (2130 verde —
  confiar no EXIT). Commit em PowerShell sem aspas `'`/`"` (usar Bash/here-doc).
