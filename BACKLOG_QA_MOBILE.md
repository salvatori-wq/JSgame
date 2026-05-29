# BACKLOG QA Mobile — Fase B (triagem ranqueada)

> Consolidação da **Fase A**: 4 auditores em paralelo (A1 fluxo, A2 regras D&D,
> A3 clareza UX, A4 layout) + **reprodução empírica minha** no preview a
> **390×844** (`is-portrait-narrow` + `force-motion` ativos). Zero LLM gasto.
> **Fase C executada** — ver status abaixo. Itens em aberto seguem pra próxima sessão.

## ✅ STATUS — Fase C executada (2026-05-29)

Entregue em 4 commits (pushados → deploy Render). Suite **2006 verde**, typecheck limpo.
Cada fix verificado no preview 390×844 (exceto onde marcado "precisa celular real").

| Commit | Itens |
|---|---|
| `a6203e3` | **M1** XP em vitória narrada · **C1** chat counter · **D1** dado órfão |
| `3807dc4` | **U1** HP/CA na ribbon de combate · **U2** loop de ataque |
| `327726a` | **D5** face d20 · **D6** dado clicável · **U4** hierarquia de turno · **U5** end-turn sticky |
| `599f9b1` | **D2** físico legível + prewarm · **D3** overlay no body · **D4** overflow · **U3** hint target-first |
| `b68806a` | **U6** dock de exploração 5 cards (Atacar→Mais) · **U7** resultado +tempo (4–5s) + eco verde/vermelho |

**Correção importante**: BUG-1, BUG-2 e o empty-state do BUG-3 **não reproduziam**
a 390×844 (ver §0). As causas REAIS (dado órfão D1, counter C1, físico borrado D2)
é que foram corrigidas.

**Aberto pra próxima sessão**:
- **D2** — confirmar o timing do dado físico no **celular real do João** (a parte de código foi feita).
- P2/P3: U8, U9, U10, L1, L2, U11, U12, U13, L3, L4, C3 (ver §1).
- **Rotacionar token Turso** (segurança, §5).

> Todos os P0/P1 do backlog foram entregues (M1, U1, U2, C1, D1–D6, U3, U4, U5, U6, U7).

## 0. Honestidade de verificação (leia primeiro — 3 surpresas)

Os 3 "bugs-semente" P0 da sessão anterior **não reproduzem como escritos** a
390×844. Provei no navegador, não inferi:

| Seed | Veredito empírico | Evidência medida |
|---|---|---|
| **BUG-1** dado cortado no topo (`top:-46px`) | ❌ **NÃO reproduz** a 390×844 | Skill-check d20: repouso topo **381→base 521**, animação fica **364→552**, `stageOverflowsTop:false`, `rowPadTop:28px`. Overlay de combate: dado **308→589**. Tudo dentro de 844. Os paddings de 200/220px são o buffer EXATO do drop -180px (A4 chegou na mesma conta). |
| **BUG-2** dado físico atrás do dim | ❌ **NÃO reproduz** no caso normal | Canvas físico `#dice-box-mount` z-9600 fica **ACIMA** do dim z-9500. `#app` não cria stacking context. `backdrop-filter` borra só o que está atrás (z<9500), não o canvas acima. |
| **BUG-3** chat empty-state sobrepõe msg/input | ❌ **REFUTADO** | Empty-state (60dvh) **não** sobrepõe input nem footer (`emptyOverlapsInput:false`, `emptyOverlapsFooter:false`) — `flex-shrink:0` em header/typing/footer protege. |

**Por que importam mesmo assim:** o João reportou "dado mal aparece" e "chat com
mensagem sobreposta" — então **há sintoma real**, mas a causa é OUTRA. Reproduzi
as causas reais (abaixo). Duas verificações dependem de **aparelho real**
(o preview headless deste ambiente tem rAF/screenshot travados — não consegui
fotografar; ver §4).

**Legenda de grau de evidência:** `MEDIDO` (reproduzi no preview) ·
`CÓDIGO` (análise estática sólida, não reproduzido) · `HIPÓTESE` (precisa
aparelho real).

---

## 1. Backlog ranqueado

### 🔴 P0 — funcionalidade quebrada / "não entendo o que ocorre"

| ID | Grau | Tela | Sintoma | Arquivo:linha | Fix proposto | Custo | Risco |
|---|---|---|---|---|---|---|---|
| **U1** | CÓDIGO | Combate | **Meu HP/CA somem da ribbon em combate.** `renderCombatBody` mostra turno + economia (⚡✦↩️), mas **nenhum HP**. No momento de maior risco, pra ver vida o jogador abre a party panel. | `status-ribbon.ts:91-111` | Incluir `❤{hp}/{max}` (+ CA) na ribbon de combate, cor crítica <25%. | 1h | Baixo |
| **U2** | CÓDIGO ⚠️ | Combate | **Loop de ataque quebrado (suspeito).** "Atacar" pede "clique no inimigo nos cards acima", mas os enemy cards estão na aba "Inimigos", **escondida** quando a aba ativa é "Ações" (default). | `combat-screen.ts:212,250-253` · `combat.css:766-769` | Ao marcar pending attack, trocar pra aba "Inimigos" automaticamente (ou manter cards sempre visíveis). | 1-2h | Médio |
| **M1** | CÓDIGO | Combate (regra) | **Vitória narrada pelo DM dá ZERO XP.** `end_combat_with_outcome` (rendição/fuga/intervenção — previsto no prompt) zera o combate mas nunca chama `awardXpToParty`. XP só pelo kill mecânico. | `dm-tool-applier.ts:124-150` | No outcome `victory`, somar `xpAward` dos inimigos + `awardXpToParty` + popular `lastCombatXpAwards` (espelhar `endCombatNarrate`). | 1-2h | Baixo |

> **U2 precisa reproduzir na Fase C antes de corrigir** (combate real custa LLM,
> ou montar `CombatState` mockado). É a alegação mais forte do A3 — confirmar.

### 🟠 P1 — dado/chat (o que o João citou) + confunde o jogador

| ID | Grau | Tela | Sintoma | Arquivo:linha | Fix proposto | Custo | Risco |
|---|---|---|---|---|---|---|---|
| **D1** | MEDIDO | Dado | **`#dice-box-mount` órfão.** Após o 1º roll, o canvas full-screen fica no DOM PRA SEMPRE: z-9600, `display:block`, `visible`, `opacity:1`, acima de TODOS os overlays (skill-check 9000, death 9300, chat 9300, target-sheet 9400). `clearPhysicalDice()` só faz `box.clear()/hide()` — não remove nem esconde o mount. | `dice-box-engine.ts:154-156` · `:64-70` | Em `clearPhysicalDice()`: `mount.style.display='none'` (ou remover do DOM) + parar render loop se possível. | 1h | Baixo |
| **D2** | CÓDIGO+HIPÓTESE | Dado | **"Dado mal aparece" (a queixa do João).** Físico (default ON) carrega ~600KB lazy no 1º roll → dado aparece TARDE sobre um dim preto 0.72 + blur(6px); em aparelho lento pode ser cortado pelo auto-close. `is-physical` mantém o `backdrop-filter` e o fundo escuro do overlay. | `dice-roll-overlay.ts:129-148` · `dice.css:493-498,261-263` | Pré-aquecer dice-box ao entrar na campanha; no `is-physical` aliviar dim/blur; hint de "preparando dado". **Confirmar timing em aparelho real.** | 2-3h | Médio |
| **C1** | MEDIDO | Chat | **Contador de chars sobrepõe o input.** `.cs-char-counter` é `position:absolute` ancorado à sheet (fixed), não ao footer → flutua sobre a textarea quando aparece (>196 chars). `counterOverlapsInput:true` medido. | `chat.css:374-385` | `.cs-footer { position:relative }` + ancorar o counter a ele (ou virar chip inline acima do input). | 30min | Baixo |
| **U3** | CÓDIGO | Combate | Dois sistemas de ação concorrentes: grade de 9-11 botões (`cb-actions-grid`) + bottom-sheet por alvo (`combat-target-sheet`). Em portrait o jogador não sabe qual é o caminho certo. | `combat-screen.ts:211-285` · `combat-target-sheet.ts:83-195` | Em portrait, esconder a grade; deixar [Esquivar/Disparar/Desengajar no-target] + "toque no inimigo p/ atacar". | 2h | Médio |
| **U4** | CÓDIGO | Combate | Hierarquia de turno invertida: "Round N" grande/vermelho, "Vez de X" em 12px itálico apagado. 4 sinais de turno competindo, o literal é o menos legível. | `combat-screen.ts:131-134` · `combat.css:39-43` | Inverter: "VEZ DE X / Sua vez" grande; "Round N" secundário (ou remover cb-header em mobile). | 1h | Baixo |
| **U5** | CÓDIGO | Combate | Dock de combate (35vh) estoura: economia + initiative + inimigos + 9-11 botões + "Encerrar turno" não cabem; "Encerrar turno" fica abaixo do fold sem affordance de scroll. | `combat-screen.ts:141-160,313-324` · `m-camp-dock.css:145-154` | Elevar `max-height` do dock em combate (~50vh) OU fixar "Encerrar turno" sticky no fim. | 1-2h | Médio |
| **U6** | CÓDIGO | Exploração | Dock mostra até 7 cards de tópico (3 fileiras) competindo com a narração, todos com peso visual igual — paralisia de escolha, sem ação principal. | `action-dock-topics.ts:150-162` · `action-dock-topics.css:18-20` | Reduzir a ~4 tópicos primários; agrupar Combate/Tentar/Livre em "Mais" ou destacar 1 card por cena. | 1-2h | Médio |
| **U7** | CÓDIGO | Exploração | Resultado do teste de perícia vive só 2,5s no overlay e vira eco cinza 13px no log — quem pisca perde o desfecho. | `skill-check-overlay.ts:234-238` · `campaign-core.css:636-660` | Auto-close ~4s (ou exigir tap) + realce verde/vermelho no eco de sucesso/falha. | 1h | Baixo |

### 🟡 P2 — fricção

| ID | Grau | Tela | Sintoma | Arquivo:linha | Fix | Custo |
|---|---|---|---|---|---|---|
| **D3** | CÓDIGO | Dado | `route-fade-in` (transform 200ms em `#app`) cria stacking context temporário → overlay (9500) salta acima do canvas (9600), tapando o físico se o roll disparar na transição. | `_polish.css:511-513` · `dice-roll-overlay.ts:83` | Montar overlay no `body`, ou impedir roll durante `route-fade-in`. | 1h |
| **D4** | MEDIDO | Dado | CSS die corta no topo SÓ em viewport curto (<~510px: landscape/teclado) — `align-items:center` + sem `overflow-y` + stage ~450px. (Defensivo; não ocorre a 844.) | `dice.css:255-264,466-473` | `align-items:flex-start` + `overflow-y:auto` (ou `clamp` no padding-top). | 1h |
| **C3** | CÓDIGO | Chat | Com teclado aberto, `max-height:88dvh` pode espremer typing+footer (typing não tem prioridade de shrink). | `chat.css:21-35` | `min-height:0` explícito / reduzir max-height com teclado. | 1h |
| **U8** | CÓDIGO | Combate | Economia de ação (abstrata p/ novato, "PHB pág 189") domina o topo onde HP deveria estar. | `combat-screen.ts:141-156` · `combat.css:854-919` | Rebaixar economia abaixo do HP; colapsar em ícones fora do meu turno. | 1h |
| **U9** | CÓDIGO | Combate | Dano que tomei não tem número persistente (só flash + floating que some). "Quanto perdi / sobrou?" | `campaign-screen.ts:609-650` · `combat.css:405-447` | Pulsar o HP do PJ com "-X" por ~2s (depende de U1). | 1h |
| **U10** | CÓDIGO | Save vs Skill | Duas UIs pra mesma mecânica (d20 vs DC): skill-check = overlay com dado 140px; saving throw = banner no rodapé. Inconsistência. | `campaign-screen.ts:1071-1099` · `skill-check-overlay.ts:35-160` | Unificar: save usa o mesmo overlay de dado (ou mesmo destaque). | 2h |
| **L1** | CÓDIGO | Campanha | scene-pin (📜) sticky `top:0` z:5 dentro do narration-host pode encostar no header + duplicar a última narração em sessão curta. | `campaign-core.css:388-401` · `narration-log.ts:287-299` | Só mostrar pin quando a última narração saiu do viewport; suprimir com <4 narrações. | 1h |
| **L2** | CÓDIGO | Combate | Vinheta de death-save (z-9300) fica ATRÁS do dim do dice-overlay (9500) — drama apagado durante o roll de death save. | `campaign-core.css:460-468` · `dice.css:261-263` | Elevar vinheta p/ z-9550, ou `mix-blend-mode:screen`. | 30min |

### 🟢 P3 — polish

| ID | Grau | Sintoma | Arquivo:linha |
|---|---|---|---|
| **D5** | CÓDIGO | Face do dado físico clampa em 20 p/ ataques com total >20 (passa `total` em vez da face d20 crua). Cosmético — server é fonte da verdade. Fix: emitir `nat` e usar `final: ev.nat`. | `campaign-screen.ts:588` · `combat.ts:404` |
| **D6** | CÓDIGO | Dado do skill-check não é clicável apesar do "toque pra rolar". Fix: handler de click no dado. | `skill-check-overlay.ts:79-99,121` |
| **U11** | CÓDIGO | Ribbon de exploração: `❤22/30 ✦3/4 1500xp 🧠Bless` colado a 13px sem rótulo; XP é baixa urgência ocupando espaço. Fix: tirar XP da ribbon, priorizar HP. | `status-ribbon.ts:170-213` |
| **U12** | CÓDIGO | Header chips com scroll-x sem fade/gradiente — jogador não sabe que há mais à direita. | `campaign-core.css:1430-1447` |
| **U13** | CÓDIGO | Transição p/ combate não chama atenção pro dock (toast 1.8s some; `dock-attention` é one-shot). Fix: re-disparar pulse do dock ao virar meu turno. | `combat-screen.ts:64-69` · `m-camp-dock.css:271-275` |
| **L3** | CÓDIGO | `inventory-modal.ts:38` mostra `armorClass` cru em vez de `effectiveArmorClass` (header secundário). | `inventory-modal.ts:38` |
| **L4** | CÓDIGO | Aritmética de z do backdrop do sheet-stack pode ficar acima do sheet de layer 0 (9305 > 9300). Confirmar em runtime. | `sheet-stack-manager.ts:54` |

---

## 2. Clusters pra Fase C (evita conflito de merge)

- **Cluster DADO** — `dice-box-engine.ts` + `dice-roll-overlay.ts` + `dice.css`:
  D1, D2, D3, D4, D5, D6. (Líder: D1 órfão MEDIDO + D2 "mal aparece".)
- **Cluster CHAT** — `chat-sheet.ts` + `chat.css`: C1 (MEDIDO), C3.
- **Cluster COMBATE/RIBBON** — `status-ribbon.ts` + `combat-screen.ts` +
  `combat.css` + `action-dock-topics.ts`: U1, U2, U3, U4, U5, U6, U8, U9, U13.
- **Cluster EXPLORAÇÃO/UX** — `skill-check-overlay.ts` + `campaign-screen.ts` +
  `campaign-core.css`: U7, U10, U11, U12, L1, L2.
- **Cluster D&D** — `dm-tool-applier.ts`: M1 (+ teste novo).

## 3. Ordem sugerida de execução (reconciliando severidade + o que o João citou)

1. **M1** (XP em vitória narrada) — bug de regra puro, fix isolado, teste fácil.
2. **C1** (counter sobre input) — 30min, MEDIDO, fecha "chat sobreposto".
3. **D1** (mount órfão) — MEDIDO, fix isolado, fecha risco real do dado.
4. **U1** (HP na ribbon de combate) — clareza #1 que o João pediu.
5. **U2** (loop de ataque) — **reproduzir primeiro**; se confirmado, P0.
6. **D2** (dado "mal aparece") — precisa aparelho real p/ medir timing; pré-aquecer + aliviar dim.
7. Demais P1 (U3-U7), depois P2/P3.

## 4. Pendente de aparelho real (preview headless não permitiu)

- **Screenshot do dado caindo** — `preview_screenshot` deu timeout até em página
  limpa (rAF/compositor travado neste ambiente; já anotado no audit ζ.6).
- **Timing do dado físico** (D2) — confirmar em quanto tempo o canvas pinta o d20
  no 1º roll num celular, e se o dim escuro faz "mal aparecer".
- **U2 loop de ataque** — reproduzir em combate real (custa LLM) ou mock.

## 5. Pendência herdada (segurança, bloqueante)
- [ ] **Rotacionar token Turso** (vazou em chat anterior): gerar novo em
  `jsgame-prod` → trocar `TURSO_AUTH_TOKEN` no Render → revogar antigo.
