# Fase 6 — Caça-bugs da responsividade (find → fix → re-verify)

> Parte do plano `peaceful-seeking-parrot.md`. Roda DEPOIS de F1-F5 (tokens
> fluidos · breakpoint device-aware + landscape · overlays robustos · harness).
> Objetivo: ciclos de conferência até a tela ficar limpa na matriz toda.
>
> **Matriz:** retrato 320×568 · 360×640 · 390×844 · 430×932 — landscape 844×390 · 740×360.
> **Método:** medição empírica no preview (`preview_eval` + `getBoundingClientRect`
> / `getComputedStyle`; `preview_screenshot` trava neste ambiente) + esquadrão de
> 4 auditores read-only (estático). **Toda suspeita herdada foi REPRODUZIDA antes
> de virar fix** (aprendizado dos ciclos QA: "3/3 seeds mal diagnosticados").

## Resultado em 1 linha

F1-F5 deixaram a base sólida: **home, wizard, exploração, combate, skill-check,
dice overlay e tutorial não estouram em NENHUM tamanho da matriz**; font-scale
0.9/1.0/1.15/1.3 compõe EXATO (sem escala dupla). O sweep achou **3 itens reais**
(2 corrigidos, 1 polish adiado) e **desmascarou a maioria dos achados do
esquadrão como falso-positivo ou código morto** — a verificação empírica valeu.

> **Ciclos de teste extra (a pedido do João, pós-F6):** varri os modais/telas
> que não tinha tocado (glossário, ajustes, inventário, sheet). +2 fixes reais
> (`.cs-close` e iOS auto-zoom) — ver seção própria abaixo. Suite 2123→2125.

---

## Ciclo A — Sweep empírico multi-tamanho (medição DOM)

| Tela | Tamanho | Medição | Veredito |
|---|---|---|---|
| Home | 320×568 | `scrollWidth=320`, 0 culprits de overflow | ✅ limpo |
| Wizard | 320×568 | sem page-overflow (progress strip rola); `.wc-compare-btn` 22px | ⚠ achado #3 |
| Exploração | 320/360/390/430 | dado/narração/dock fluidos (F2) | ✅ (F2) |
| Combate | 320/390/430/844×390 | dock cresce, Atacar fixo no rodapé e alcançável | ✅ (F2/F3) |
| Skill-check overlay | 320×568 | comum CABE (Rolar b413/Pular b483); tutorial 1ª vez rola no overlay | ✅ (F4) |
| Skill-check overlay | 844×390 | rola, Rolar/Pular alcançáveis; sem h-scroll | ✅ (F4) |
| Dice overlay | 844×390 | padding-top 220→93.6 (gate altura), CABE, sem h-scroll | ✅ (F4) |
| Tutorial Duolingo | 844×390 | `max-height:80dvh` + scroll | ✅ (F4) |
| Dado skill/overlay | 844×390 | 132.6 / 101.4px — vmin preso ao lado curto (não incha) | ✅ (F2) |

## Ciclo C — Composição com UX prefs

- **font-scale 0.9 / 1.0 / 1.15 / 1.3** → body 12.99 / 14.43 / 16.59 / 18.76px =
  ratio EXATO **0.9 / 1.0 / 1.15 / 1.3** (NÃO 1.69). Anti-escala-dupla (F1.4) segura.
- **Combate cond-pill** (agora `var(--fs-xs)`): a 1.3 = ~14.7px num pill
  `min-height:22px` → cabe. Containers de altura fixa usam label não-escalável
  (estável) OU têm `min-height` (crescem sem cortar).
- **reduced-motion / density**: animações têm fallback (F2-F4 não mexeu na lógica
  de animação); padding fluido é vw (independe de font-scale). Suite verde cobre.
- **Desktop 1280×800 non-coarse**: NÃO recebe `is-portrait-narrow` → layout
  desktop intacto (sem regressão).

---

## Achados reais (Ciclo B triado empiricamente)

### ✅ #1 — login-screen usava `100vh` (P1, CORRIGIDO)
`modals.css:677` `.login-screen { min-height: 100vh }`. Com a barra do browser
mobile visível, 100vh resolve MAIOR que a área visível e empurra o botão de
login pra fora (pior no landscape, h~390). O `body` (_tokens.css) já usava
`var(--m-vh)`=100dvh com fallback — a tela de login não. **Fix:** `100vh` +
`100dvh` override (progressive-enhancement, igual ao body). *Efeito só aparece
em device real com chrome → confirmar no Ciclo D.*

### ✅ #2 — combate cond-pill em 9px fixo (P1 legibilidade, CORRIGIDO)
`combat.css:226` `.cb-cond-pill { font-size: 9px }`. Texto de CONDIÇÃO de combate
(info crítica — envenenado, atordoado…) travado em 9px: ilegível a 320 e não
crescia com a pref de acessibilidade. **Fix:** `var(--fs-xs)` (clamp 10→12 ×
font-scale). O `min-height:22px` (combat-polish.css) absorve o texto maior.

### ⚠ #3 — wizard `.wc-compare-btn` 22px + faint no toque (P2, ADIADO)
`wizard.css:1207` botão "⚖ comparar" (canto sup-dir de cada card de raça/classe):
absolute, `font-size:10px`, ~22px de alto, `opacity:0.7` e revelado por `:hover`
(que não existe no toque). **Parcial:** `opacity:1` em portrait (visível no
toque). **Adiado:** crescer o alvo pra ≥40px faz a borda inferior do botão cobrir
a linha de bônus em raças de string longa (ex. Humano — medido a 320). O alvo
maior pede reposicionar/reestruturar o card — fora do escopo de um sweep de CSS.

---

## Ciclos de teste extra (pós-F6) — modais/telas reachable + montadas

Varredura empírica de telas não cobertas antes (preview a 320×568), medindo
overflow / hit-targets / font-size de input. Telas: glossário, ajustes (UX
settings), inventário (montado com PJ mock), login (rota de fundo).

### ✅ QA#1 — `.cs-close` (× dos sheets) era 12×19px (P1, CORRIGIDO)
O "×" de fechar é compartilhado por glossário/ajustes/chat, mas só o chat tinha
tamanho (`.chat-sheet .cs-close`=32px). Glossário e ajustes caíam no default do
`<button>` → **12×19px** (intocável). **Fix:** base `.cs-close` (36px) +
`body.is-portrait-narrow .cs-close` 44px (`modals.css`). Re-medido: **44×44**.

### ✅ QA#2 — inputs <16px disparavam auto-zoom do iOS (P2, CORRIGIDO)
gl-search 15, home-coop 12, owner 15, chat 14 — todos < 16px → iOS Safari dá
zoom ao focar (e o usuário pinça de volta). Nota: o Ciclo S2.5 tinha posto
gl-search a 15px "pra evitar o zoom", mas o limiar é **16**. **Fix:** uma regra
em `m-layout.css` — `body.is-portrait-narrow input/textarea/select { font-size:
max(16px, var(--fs-base)) }` (≥16 sempre + cresce com font-scale). Re-medido:
`zoomInputCount 4 → 0`.

### Sweep limpo / P2 adiados (extra)
- **Inventário** @320: zero overflow, close 44×44, zoom 0. `.inv-mini-btn` (✕
  remover item) é w20 mas h44 — estreito-mas-alto, ação destrutiva secundária
  (P2, talvez intencional pra evitar toque acidental).
- **Ajustes** `.uxs-seg-btn` 36px (densidade/font-scale/anim) — 4px abaixo do
  piso 40; crescer deixaria o modal mais alto (P2, secundário).
- **Sheet** fontes 9px (`.sv-sub`/`.sa-name`) — montagem standalone do
  `renderSheet` é frágil (mock parcial); como é área densa de referência e o
  swap pra `--fs-*` tem risco de shift NÃO verificável agora, fica P2 (igual F6).
- **login-anon-btn** h39 (1px sob o piso 40) — tolerância de arredondamento.

## Falsos-positivos do esquadrão (verificados, NÃO são bug)

| Achado do auditor | Por que NÃO é bug |
|---|---|
| `.lvlup-card width:380px` estoura 320 | tem `max-width:92vw` → capa em 294px. max-width vence width. |
| `.ach-card max-width:340` estoura 320 | linha errada; o `.ach-card` real não tem width fixa solta — é card de lista/grid dentro de modal. |
| `.sc-row/.sc-stage min-width:320` estoura | o override de portrait (F4) põe `min-width:0`; medido a 320: zero h-scroll. |
| `.adt-back-btn 28px` / `.adt-custom-send 36px` hit pequeno | o `renderActionDockTopics` (método) NUNCA é chamado; `.adt-*` não renderiza no fluxo atual (exploração usa a barra de ações, combate usa combat-screen). Código morto. |
| `.ir-turn-name` sem ellipsis | o seletor real `.irb-name` JÁ tem `text-overflow:ellipsis`. |
| `.cc-narr-name` sem ellipsis | seletor não existe; o speaker é `.cnn-speaker` (rótulo curto maiúsculo, não precisa). |
| modais `max-height:85-90vh` cortam em landscape | são bottom-sheets com `overflow-y:auto` → rolam, não cortam. Usável a 390h. |

## Adiados (P2 — gap real, risco/escopo não justifica no sweep)

- **Fontes hardcoded pequenas que não escalam com font-scale** (gap de
  acessibilidade, NÃO bug de layout — não estouram porque não crescem):
  `sheet.css .sv-sub/.sa-name` (9px), `wizard.css .wlp-ab-key` (9px),
  `campaign-party.css .cp-pj-xp-txt` (9px), `bottom-tab-bar.css .btb-tab-label`
  (10px). Trocar por `--fs-*` é desejável (intenção do F1: "a UI inteira escala")
  mas mexe em muitos containers densos — fazer com medição dedicada por tela.
- **`.wc-compare-btn` alvo de toque** (#3 acima) — precisa de redesign do card.
- **`.toast-close-btn` 36px** — por design (tem dismiss por toque no corpo do toast).

---

## Ciclo D — Smoke "no aparelho" (EXECUTADO — emulado no preview, 2026-05-31)

O preview é headless/**não-coarse** e `env(safe-area-inset-*)`=0. Em vez de só
delegar pro João, **empurrei a emulação ao limite**: forcei as classes
`is-landscape-phone` que o caminho non-coarse pula, simulei a barra do browser
encolhendo a altura, simulei o caminho do dado no toque, e auditei os
**contratos** de safe-area/dvh/≥16px direto no CSS. Sessão dirigida com um PJ
prefab real (Borin) → exploração → skill-check (dado) → combate, na matriz
320/390/844×390. Hook DEV `window.__nav` (gated `import.meta.env.DEV`) pra
navegar determinístico.

### Pilares F1-F6 CONFIRMADOS (medição empírica)

| Verificação | Resultado |
|---|---|
| Overflow-x (home/login/wizard/exploração/combate/skill-check) | **0 culprits** em toda a matriz |
| Deitado usa o shell compacto, NÃO o desktop | `desktopTabsLeaking:false` em combate 844×390 (o modo-falha que o F3 matou) |
| Atacar alcançável no deitado | ⚔ Atacar 49px, `inView:true` (bottom 384 ≤ 390) |
| Dado gira no toque (não LLM-gated) | tap → `is-rolling` em **1.3ms**, `animationName:dieRolling`; assenta e auto-fecha |
| Skill-check a 320 | dado 109px (vmin), overlay cabe 568 com `overflow-y:auto`, Rolar(y346)/Pular(y418) in-view |
| Input ≥16px (anti zoom iOS) | login input = **16px** computado |
| font-scale **1.3** | body 16.9px (clamp floor 13×1.3 — sem escala dupla), **0 overflow novo** |
| Safe-area (contrato) | campanha L/R, skill-check 4 lados, dice 4 lados, bottom-tab `--m-safe-bottom`, action-bar bottom ✅ |

### Achados reais (escaparam do headless) — 4 fixes (commit `ef6bc42`)

- **D1 — economia da ribbon CLIPADA a 320 em combate** (P2 corrigido).
  `.sr-economy` (⚡✦↩️ 9m) `nowrap` estourava ~19px o `.sr-text` (overflow:hidden)
  → o "9m" cortava no meio do glifo. É **redundante** (o slot de economia STICKY,
  W3.3, mostra o mesmo). Fix: `display:none` em portrait. Re-medido: 0 culprits.
- **D2 — combat-tutorial "Pular" 11px** (P2 corrigido). Link de 11px de alto =
  intocável no polegar. Fix: 44px + padding em portrait. Re-medido: 44px.
- **D3 — login sem safe-area + cabeçalho pesado no deitado** (P1/P2 corrigido).
  `padding:32px 16px` fixo → no deitado com notch lateral o card escorrega sob o
  entalhe. Fix: `padding: max(px, env(safe-area-inset-*))` (desktop inalterado,
  env=0). + compacta o header em `@media (max-height:500px)` (logo 38→26, respiro
  32→12): conteúdo **585→483px**, CTA primária ("Jogar sem cadastro") acima do
  fold; o link mágico (secundário) fica a um scroll curto (o body rola).
- **D4 — dock de combate espremido no deitado** (P2 corrigido). A 390h o recap de
  combate pegava 101px (cap 26vh) e o dock ficava com **71px** (não cabia 1 card
  de inimigo; Atacar funcionava via target-first + scroll). Fix: cap 26vh→18vh
  (390h: 101→70px) → dock **71→84px**. É a intenção JÁ documentada do redesign ①
  ("recap ainda menor no deitado → o dock cresce"). O header de 110px segue o
  maior gargalo do deitado — ver P2 abaixo.

Desktop re-conferido (login 1280×800): padding `32px 16px` + title 38px
**inalterados** (a `@media max-height:500` não casa a 800h; `max(32px,env=0)`=32).
+5 guards CSS (`mobile-polish-css.test.ts` → "Responsivo Ciclo D"). Suite
2125→2130 verde, typecheck limpo.

### Residual — SÓ o aparelho real do João prova (2 min, não bloqueante)

A emulação cobre geometria/contrato; estes 5 dependem do hardware/SO real:

- [ ] **Notch real** (iPhone/Android com entalhe), deitado: login + narração de
      campanha não ficam sob o notch (o CSS tem `env(safe-area-inset-*)`, mas o
      headless resolve 0 — só o device prova o valor real).
- [ ] **Barra do browser** (Chrome/Safari mobile): rolar a página mostra/esconde a
      URL bar; o login (100dvh) acompanha o chrome sem empurrar o CTA pra fora.
- [ ] **Física do dado** (`@3d-dice/dice-box` em rAF real): o dado 3D rola e
      assenta de fato no toque (o caminho CSS `is-rolling` já foi provado a 1.3ms).
- [ ] **iOS Safari**: focar um input NÃO dá auto-zoom (os inputs computam ≥16px;
      o comportamento em si é específico do iOS).
- [ ] **Auto-detecção do deitado**: girar um celular real liga `is-landscape-phone`
      sozinho (no headless non-coarse eu forcei a classe; o predicado `coarse &&
      h<600` só dispara com toque real).

### P2 remanescente (gap real, fora do escopo de um sweep de CSS)

- **Header de campanha 110px no deitado** (28% de 390h). É o maior gargalo do
  combate deitado (empurra o dock pra 84px). Comprimir pede reestruturar o
  `camp-header` (grid: back+título+localização+toolbar 📜🏆👥🔗⋯) — redesign de
  chrome, não um tweak. Recomendação: linha única densa OU toolbar no bottom em
  `is-landscape-phone`. Medir o dock antes/depois.
- Os 9-10px hardcoded que não escalam com font-scale (`.sv-sub`/`.sa-name`/
  `.wlp-ab-key`/`.cp-pj-xp-txt`/`.btb-tab-label`) e `.wc-compare-btn` seguem
  abertos (ver §Adiados acima) — acessibilidade, não bug de layout.

---

## Disciplina mantida

Tudo atrás de `is-portrait-narrow` / `is-landscape-phone` / `@media(max-height)`
(desktop não regride — provado por DOM a 1280×800). Cada fix re-medido no preview
(o #3 foi REVERTIDO em parte porque a re-medição pegou overlap de 4px com a linha
de bônus). Suite 2121 verde. Sem push até OK do João.
