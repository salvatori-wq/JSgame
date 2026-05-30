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

## Ciclo D — Smoke no celular real (PENDENTE — ação do João)

O preview é headless e **não-coarse** (sem toque) e `env(safe-area-inset-*)`
resolve 0 — então o que escapa do headless precisa do aparelho real. Após
`git push` + Manual Deploy no Render (ver `FASE5_DEPLOY.md`), confirmar no celular:

- [ ] **Girar pra landscape** em cada tela: exploração/combate usam o shell
      compacto (ribbon fina + barra inferior, Atacar alcançável), NÃO o desktop.
- [ ] **login** com a barra do browser visível: botão de login não some (fix #1).
- [ ] **notch lateral** no deitado: narração não fica sob o notch (safe-area F3).
- [ ] **dado** gira no toque (físico/CSS) — o preho trava em rAF/física headless.
- [ ] **skill-check** a 320 real: Rolar/Pular sem cortar; **combate cabe**.
- [ ] **sem zoom-no-input iOS**: inputs com `font-size ≥16px` (checar login/chat).
- [ ] font-scale 1.3 + densidade no aparelho: legível, sem corte.

---

## Disciplina mantida

Tudo atrás de `is-portrait-narrow` / `is-landscape-phone` / `@media(max-height)`
(desktop não regride — provado por DOM a 1280×800). Cada fix re-medido no preview
(o #3 foi REVERTIDO em parte porque a re-medição pegou overlap de 4px com a linha
de bônus). Suite 2121 verde. Sem push até OK do João.
