# JSgame · Contexto pro Claude

> **Auto-carregado quando Claude inicia em `C:\Users\JOÃO\JSgame\`.**

## O que é

D&D 5e online coop com Mestre IA. Stack: Vite + TypeScript strict + Socket.io + Express + sql.js + groq-sdk.
DOM puro (sem Phaser/React). Mobile-first. Sessões 30 min.

Cave Run (jogo antigo, em `C:\Users\JOÃO\D&D online\`) está em prod com deploy Render — **NUNCA tocar**.
JSgame nasceu separado, do zero, aproveitando aprendizados do Cave Run.

## Status atual

- ✅ **F1** Foundation (config, server, client, D&D core: dice/attributes/races/classes/skills/conditions/backgrounds)
- ✅ **F2** Wizard de criação de PJ (8 steps point buy 27 — race/class/subclass/abilities/background/personality/feat-ASI/review)
- ✅ **F3** Mestre IA cascade (Groq→Gemini) + Modo Exploração (cena narrada + ações + skill check d20)
- ✅ **F4** Combate D&D real — initiative (d20+DEX), action economy (Action/Bonus/Move/Reaction), attack rolls + crit + AC, 14 conditions PHB com glyph + efeitos, advantage/disadvantage automation via condition rules, enemy AI determinístico, end-combat detection. Inclui: F25 concentration, F26 damage profile (resistência/imunidade/vulnerabilidade), F27 saving throws (request_saving_throw tool + η.6 fórmula didática), α.3 inspiration (PHB), β.7 end-turn chip, reactions (counterspell, OA, shield via reaction-engine.ts), spell engine completo (resolvePlayerCastSpell — damage/heal/condition/buff/utility, slot consumption, upcasting, prepared check), death saves end-to-end (3 sucessos vs 3 falhas, nat20→1HP, nat1→2 falhas, tombstone). **TOTAL: 105 tests verde em combat/spells/saving-throw/rest-death/reactions/concentration/counterspell.**
- ✅ **F5 (parcial)** Polish + Coop multi-player + Magias + Rest. Coop lobby completo, magic items, short rest visual picker (T2.5), long rest ritual (T3.3), achievements + tombstones + streaks. **Falta**: PWA install banner refino.

**Pra retomar**: leia o handoff mais recente (`HANDOFF_*.md` na raiz, ordenado por data).

## Comandos essenciais

```bash
npm run dev          # backend (3001) + frontend (5173) em paralelo
npm run typecheck    # tsc --noEmit
npm test             # vitest (1794 tests passando)
```

URLs: http://localhost:5173 (desktop) · http://192.168.15.3:5173 (mobile)

## Decisões NÃO rediscutir

| Decisão | Por quê |
|---|---|
| DOM puro (sem framework) | D&D é texto/UI, não canvas |
| sql.js (não better-sqlite3) | Sem Visual Studio Build Tools no Windows |
| `Object.assign` no state update | Spread cria new ref → step recebe stale closure (bug F2.fix3) |
| Validação server-side TODA tool call | LLM mente — clampe sempre |
| Persona DM Sombrio+Sarcástico+Trickster BR | Validada no Cave Run, 2-4 frases curtas |
| Timeout 12s + retry sem tools em 400 | Llama 4 Scout falha em ~26% calls complexas |

## Arquivos-chave (mapa rápido)

```
src/client/main.ts                          # router (home/wizard/sheet/campaign)
src/client/character-creation/wizard.ts     # state machine (com Object.assign fix)
src/client/campaign/campaign-screen.ts      # exploration UI
src/server/index.ts                         # Express + Socket.io + REST + 4 socket handlers
src/server/campaign.ts                      # Campaign engine (startSession/takeAction/resolveSkillCheck)
src/server/dm/dm.ts                         # DungeonMaster + FallbackDM
src/server/dm/prompts.ts                    # SYSTEM_PROMPT D&D + 7 tools
src/server/dm/tools.ts                      # validação server-side TODA tool call
src/shared/types.ts                         # CharacterSheet, CampaignState, socket events
src/dnd/*.ts                                # Regras D&D 5e (PHB embarcado)
```

## Aprendizados aplicados (Cave Run → JSgame)

- Path Windows sem `&` evita problemas com npm/git
- sql.js em vez de better-sqlite3 evita compile native
- DOM puro em vez de Phaser fica mais rápido em mobile
- Vitest desde dia 1 (58 tests rodando) evita regressão
- Footer dentro do dynamic re-render (state stale é o inimigo)
- Mobile portrait body classes desde o boot (vars `--m-vh`, `--m-safe-*`)

## Git

Local em `C:\Users\JOÃO\JSgame\`. **Remote**: `https://github.com/salvatori-wq/JSgame.git` (auto-deploy Render via push origin/main).

```bash
git log --oneline | head -10
git push origin main      # dispara auto-deploy Render
```

## Feedback persistente do João

- Execução rápida + decisões executivas (não perguntar muito)
- Sempre que abrir nova conversa nesse projeto, comece lendo `HANDOFF_*.md` mais recente
- Cave Run e JSgame em pastas isoladas — nunca cruzar config/código

## Estado Atual

> Última atualização: 2026-05-31 (**Ciclo D — smoke mobile emulado + follow-up E1/E2**: empurrei a emulação ao limite (forcei `is-landscape-phone`, simulei browser-bar/notch, dirigi PJ prefab real → exploração → skill-check → combate). Pilares F1-F6 CONFIRMADOS + **4 fixes** do headless + **E1** (header deitado 110→61px → dock combate ~133px) + **E2** (micro-labels 9-10px escalam com font-scale). Suite 2125→**2132** verde. **PUSHADO** (origin/main=`ec78f20`) — deploy = Manual do João no Render. F1-F6 já no ar, bundle `CUZEQW_w`.)

### Ciclo D "Smoke mobile emulado" — entregue (1 commit `ef6bc42`, +5 tests)

Executado o Ciclo D do `FASE6_CACA_BUGS.md` (a pedido do João). O preview é
headless/non-coarse e `env(safe-area)`=0, então em vez de só delegar pro aparelho,
fiz a emulação mais profunda possível + travei os contratos device-only em testes.

**Pilares F1-F6 confirmados por medição** (não inferência): 0 overflow-x na matriz
toda; deitado usa o shell compacto (`desktopTabsLeaking:false` — o modo-falha que o
F3 matou); ⚔ Atacar alcançável no deitado (49px in-view); dado gira no toque em
**1.3ms** (`is-rolling`+`dieRolling`, assenta e auto-fecha); skill-check cabe a 320
(dado 109px vmin, Rolar/Pular in-view); input 16px (anti zoom iOS); font-scale 1.3
→ body 16.9px (sem escala dupla) e 0 overflow novo; safe-area presente em
campanha/overlays/tabs.

**4 fixes do que escapou** (todos atrás de `is-portrait-narrow`/`is-landscape-phone`,
desktop re-conferido a 1280×800):
- **D1** `.sr-economy` clipada ~19px a 320 em combate (movimento "9m" cortado) →
  `display:none` em portrait (é redundante — o slot de economia STICKY W3.3 tem).
- **D2** combat-tutorial "Pular" era link de 11px → alvo de 44px no mobile.
- **D3** login sem safe-area (notch lateral escorregava o card) → `max(px, env(...))`
  + compacta header em `@media (max-height:500px)` (conteúdo 585→483px, CTA acima
  do fold).
- **D4** dock de combate no deitado espremido (71px) → recap 26vh→18vh a 390h
  (101→70px) faz o dock crescer pra 84px (intenção do redesign ①).

**Residual SÓ-aparelho (2 min do João, não bloqueante)**: notch real, browser-bar
dinâmica, física do dado em rAF real, auto-zoom iOS, auto-detecção do deitado
(coarse). **P2 FECHADOS** (commit `ec78f20`): E1 — header deitado vira 1 linha
(chips na row 1) → 110→61px → dock combate ~133px (1 card de inimigo cabe), narração
+48px em exploração; E2 — `.btb-tab-label`/`.cp-pj-xp-txt`/`.sv-sub`/`.sa-name`/
`.wlp-ab-key` agora `calc(px * var(--ux-font-scale))` (idêntico no default, escala
no knob). Só resta `.wc-compare-btn` (redesign de card). Detalhes + matriz medida:
`FASE6_CACA_BUGS.md` §Ciclo D. Infra: `main.ts` ganhou hook DEV-only `window.__nav`
(gated `import.meta.env.DEV`) pro sweep determinístico.

> Última atualização anterior: 2026-05-30 (Plano "Responsividade fluida" F1-F6 + ciclos QA — 9 commits, suite 2103→2125 verde, **PUSHADO (origin/main=`5b160e2`) + deployado: bundle `CUZEQW_w` no ar via Manual Deploy do João**)

### Plano "Responsividade perfeita em qualquer celular" (F1-F6) — entregue

Executado o plano `peaceful-seeking-parrot.md` INTEIRO (6 fases). Objetivo: UI
fluida 320→430 retrato + celular DEITADO usável (era injogável — caía no layout
desktop). 6 commits sobre `b3ca42d` (=origin/main): `6040993` `6facd35` `25d76c6`
`7128f39` `b7296e6` `238b5af`. **NÃO pushado.** Tudo atrás de
`is-portrait-narrow`/`is-landscape-phone`/`@media(max-height)` — desktop não
regride (provado por DOM a 1280×800). Cada fase medida no preview na matriz
(320×568/360×640/390×844/430×932/844×390) via `preview_eval`+`getBoundingClientRect`.

- **F1 — Tokens fluidos** (`6040993`, sessão anterior): `--fs-*` viraram
  `calc(clamp(vw)*var(--ux-font-scale))`; `--m-padding/gap-*` clamp(vw); novos
  `--m-die-*`/`--m-avatar-strip` em **vmin** (quadrados não incham no landscape);
  `ux-settings.css` body usa `var(--fs-base)` (mata escala dupla).
- **F2 — Dado fluido + vh-budget** (`6facd35`): dado skill-check `140px!important`
  → `var(--m-die-skillcheck)`; overlay → `var(--m-die-overlay)` (apagado o bump
  112px); caps vh → `clamp(px,vh,px)` (party, narração-combate, dock); cards coop
  → clamp(vw). Caps engatam a 430×932; vmin segura o dado a 132px no landscape.
- **F3 — Breakpoint device-aware + landscape** (`25d76c6`): `environment.ts` NOVO
  (`applyEnvironmentClasses` exportado). `compact = w<600 || (coarse && h<600 &&
  w<950)`; `landscapePhone = compact && w>=600 && w>h`. Gate `coarse` protege o
  desktop. Deltas landscape em `m-camp-dock.css`. Provado: 844×390 coarse → Atacar
  alcançável; desktop 1280×800 intacto.
- **F4 — Overlays robustos + safe-area** (`7128f39`): skill-check overflow-y:auto
  + safe-area + flex-start@max-height:660; stage `100vw→100%` (mata h-scroll).
  Dice overlay safe-area + 100dvh + drop-in `220px→clamp` gated por altura
  (espelhado force-motion `!important`). Tutorial 80dvh@max-height:600.
- **F5 — Harness** (`b7296e6`): `responsive-sweep.test.ts` NOVO (predicado testado
  com pointer:coarse mockado — prova o caminho do celular que o preview non-coarse
  não testa) + 9 guards CSS F1-F4. +18 tests.
- **F6 — Caça-bugs** (`238b5af`): 4 auditores + sweep empírico. 2 fixes reais
  (login `100vh→100dvh`; cond-pill combate `9px→var(--fs-xs)`); 1 P2 adiado
  (wizard compare-btn). Maioria dos achados = falso-positivo/código morto
  (verificado empiricamente). `FASE6_CACA_BUGS.md`.
- **F6.QA — ciclos de teste extra** (`2945806`, a pedido do João): varri os
  modais/telas não cobertos (glossário, ajustes, inventário, login). +2 fixes:
  `.cs-close` (× dos sheets) era 12×19px no glossário/ajustes → base 36px + 44px
  mobile; inputs <16px (gl-search/coop/owner/chat) davam auto-zoom no iOS →
  `max(16px, var(--fs-base))` no mobile. Inventário limpo. Suite 2123→2125.

**Status push/deploy**: ✅ `git push origin main` FEITO (origin/main=`5b160e2`).
❌ **Deploy NÃO subiu** — auto-deploy do Render free está OFF (confirmado: poll de
8min no bundle + `/api/health` uptime sem reset). **João precisa**: Render dashboard
→ serviço `jsgame` → **Manual Deploy → "Deploy latest commit"** (`5b160e2`). (Não
há deploy-hook nem RENDER_API_KEY no repo/.env, então eu NÃO consigo disparar — é
clique no painel.) Depois: **Ciclo D smoke no celular real** (girar landscape em
cada tela, login com chrome, notch, dado, sem zoom-input iOS) — `FASE6_CACA_BUGS.md` §Ciclo D.

> Última atualização anterior: 2026-05-30 (Plano profundo WhatsApp+dado+batalha — 6 fases, 6 commits, suite 2073→2103 verde, **NÃO pushado ainda — aguarda OK do João pro deploy**)

### Plano profundo "Mobile WhatsApp + Dado que sempre rola + Batalha que cabe" — entregue (6 fases, +30 tests)

Executado o plano `radiant-hopping-swing.md` INTEIRO. 6 commits sobre `b86c697`
(HEAD anterior = origin/main). **Ainda NÃO pushado** — deploy (Fase 5) aguarda OK
do João. Tudo atrás de `is-portrait-narrow` (desktop não regride — provado por
DOM no preview: exploração mantém grid no main-content, combate mantém abas+grid
direto, sem barra inferior). Cada fase medida a 390×844 E 360×800 via
`preview_eval`+`getBoundingClientRect` (screenshot trava).

- **Fase 1 — Dado gira no toque** (`7b66d96`): partiu `rollAndReveal` em
  `startSpinning` (gira agora, sem valor) + `settle` (assenta quando o servidor
  responde). `skill-check-overlay` gira no `rollAndDisable` (tap→is-rolling
  **3.2ms** medido, não LLM-gated) e assenta no `showSkillCheckResult`. Watchdog
  inline conserta o "Tentar de novo" (era preso pelo guard `rolled`). +12 tests.
- **Fase 2 — Menu WhatsApp** (`51e5f5d`): barra inferior `🧭 Explorar · 💬 Falar ·
  ⚔ Batalha · 🎲 Dado · ⋯ Mais` (Batalha=`takeAction('attack')`, Livre foi pro
  Mais). Faixa de party solo (45px) vira `role=button` + chevron → tap abre a
  ficha num bottom-sheet (`renderPartyCard` extraído). Narração domina (689px),
  zero sobreposições (elementFromPoint). +3 tests.
- **Fase 3 — Batalha cabe** (`6ecb7e3`): `min-height:0` no dock de combate (o
  overflow engata, não estoura mais o fold em 921px). Barra de combate `[⚔ Atacar
  dominante 2×, 🎲 Dado, ⋯ Mais]` (era só Mais); Atacar=target-first (auto 1
  inimigo ou picker → combat-target-sheet). Grid de 10 botões colapsa num
  `<details>` "+ ações" → dock cai **852→544px**. Inimigo+economia sem rolar.
- **Fase 4 — Faxina** (`675e31a`): sweep DOM de cada tela. 2 achados: botão coop
  ~36px→44px; body do member-sheet `flex:1` (rola se ficha alta). Resto limpo
  (zero overflow-x/sobreposição). Checklist em `FASE4_FAXINA_LAYOUT.md`.
- **Fase 5 — Deploy+keep-alive**: `FASE5_DEPLOY.md` (passo a passo Manual Deploy
  + smoke). O keep-alive (cron 10min → `/api/health`, mata cold-start) está como
  YAML no guia — o token OAuth do CLI não tem escopo `workflow` pra commitar
  `.github/workflows/*`; João adiciona via web UI ou credencial própria.
  **Push + deploy + keep-alive = ação do João.**
- **Fase 6 — Regras** (`8eafbba`): Rank 8 (inimigo free-form ganha abilityScores
  por proxy de CR — saves não são +0), Rank 11 (`'active'` mira o ator da vez via
  `Campaign.lastActingPlayerId`, não party[0]), Rank 12 (golpe de misericórdia:
  apply_damage em PJ caído conta falha de morte). +11 tests.

**Pendente (BLOQUEANTE pro João VER)**: `git push origin main` + Manual Deploy no
Render (prod ainda no bundle velho `vi39x_TX`). Ver `FASE5_DEPLOY.md`. Depois:
confirmar no celular real (dado gira, menu, batalha cabe, tap na ficha).

> Última atualização anterior: 2026-05-29 (Redesign layout mobile mode-aware — 4 movimentos + docs, 5 commits, suite 2042 verde, combate domina a tela)

### Redesign de layout mobile (mode-aware) — entregue (4 movimentos, +33 tests)

Executado o redesign validado no mockup `public/proto-layout.html` (consumido e
**deletado**). Tudo atrás de `body.is-portrait-narrow` — desktop não regride
(verificado: sem `is-portrait-narrow`, toggle `is-in-combat` não muda nada).

- **① Proporção mode-aware** (`m-camp-dock.css`, commit `f17119b`): em combate
  (`.camp-screen.is-in-combat` — gancho já existia em `campaign-screen.ts:1115`)
  a narração vira recap fino (`flex:0 0 auto; max-height:18vh`) e o dock
  (`.ch-slot-main-content`) cresce. Exploração intocada (35vh / narração `flex:1`).
- **② Combate sem abas** (`combat-screen.ts` + `combat.css`, `a3871c0`): em
  portrait o combat-screen NÃO renderiza `.cb-tabs` nem seta `data-active-tab`
  → inimigos + economia + ações JUNTOS. Resolve o loop de ataque (U2: enemy cards
  escondidos pela aba "Ações"). Log inline oculto (vive nos echoes Sprint Y).
  Desktop mantém abas. Swipe + setActiveTab gated p/ não-portrait.
- **③ Party faixa fina solo** (`campaign-screen.ts` `renderPartyStrip` + CSS,
  `41ceef8`): solo+portrait → faixa de 1 linha (portrait 28px + nome + HP + CA),
  SEM XP/slots; badges críticos (conditions/conc/fúria/exaustão/inspiração) em 2ª
  mini-linha só quando há. Slot ganha `is-thin-host`. Removeu o cap 58vh do dock
  de combate (`max-height:none`) → dock absorve o espaço liberado. Coop/desktop
  mantêm card cheio (`.cp-pj`, XP/slots, scroll-x coop).
- **④ Scene-pin sem sobreposição + narração centrada** (`narration-log.ts` +
  `campaign-screen.ts setCombatMode` + CSS, `8bb5614`): pin scroll-aware — nasce
  oculto (`display:none`), revela (`.is-revealed`) SÓ quando a última narração de
  Mestre saiu de vista (acima OU abaixo) → mata a duplicação (bug L1); some em
  combate; bg opaco. Narração curta centralizada (`.ch-narration-host.is-narr-sparse`)
  mata a banda morta do cold-open (só sem overflow → sem cutoff flex+scroll).

**Medido 390×844** (DOM real / `getBoundingClientRect` — `preview_screenshot`
trava neste ambiente): combate = dock **295→572px** (≈68vh, +277px) com inimigos
+ ações juntos e o alvo acima do fold; exploração = narração **565px** respirando,
party **135→45px** (libera 90px), pin sem duplicar; gap 0, tab bar fixa.

**Suite 2042 verde** (era 2014). Tudo pushado → deploy Render.

**Pendente (celular real)**: confirmar no aparelho do João o timing do reveal do
pin ④ + o dado físico D2 — o preview headless trava em rAF / import pesado, então
o reveal fim-a-fim com layout real não foi exercitado (CSS + unit tests cobrem as
peças). Demais P2/P3 do `BACKLOG_QA_MOBILE.md` + rotacionar token Turso seguem abertos.

> Última atualização anterior: 2026-05-29 (QA Mobile Fase A→C — 5 commits, suite 2014 verde, dado+chat+combate)

### QA Mobile Fase A→C "dado/chat/combate" — entregue (5 commits, +~27 tests)

Esquadrão de 4 auditores read-only em paralelo (A1 fluxo · A2 regras · A3 clareza
· A4 layout) + reprodução empírica minha no preview 390×844 (Fase A/B) → 13 fixes
verificados (Fase C). Detalhes: `HANDOFF_2026-05-29_qa-mobile-fase-C-done.md` +
`BACKLOG_QA_MOBILE.md`.

**Achado central**: os 3 bugs-semente P0 herdados (dado cortado no topo, dado físico
atrás do dim, empty-state do chat sobrepondo) **NÃO reproduziam** a 390×844 — medição
no navegador (getBoundingClientRect / computed styles) revelou as causas REAIS:
`#dice-box-mount` órfão (canvas z-9600 ficava por cima de todos os overlays após o
1º roll — D1), char-counter `position:absolute` flutuando sobre o input (C1), e o
dado físico tapado pelo `backdrop-filter:blur` + dim 0.72 do overlay (D2).

**Fixes** (commits `a6203e3` `3807dc4` `327726a` `599f9b1` `b68806a`, todos pushados):
- **Regra**: M1 — `end_combat_with_outcome` (vitória narrada) agora concede XP +
  level-ups (era 0 XP; só o kill mecânico dava). `Campaign.awardCombatVictoryXp()`.
- **Combate/clareza**: U1 (HP/CA na ribbon de combate — sumia no auge do risco),
  U2 (loop de ataque quebrado: "Atacar" mandava clicar em enemy cards escondidos
  por `display:none` na aba não-ativa → agora `setActiveTab('enemies')`), U4
  (hierarquia "Sua vez" > "Round"), U5 (end-turn sticky no dock 35vh), U3 (hint
  target-first, sem remover a grade — respeita W3.5).
- **Dado**: D1 (mount escondido no clear), D2 (modo físico sem blur + dim 0.5 +
  prewarm em idle), D3 (overlay no `<body>` evita race do route-fade), D4
  (`overflow-y:auto` p/ viewport curto), D5 (face d20 crua no físico), D6 (dado clicável).
- **Chat**: C1 (`.cs-footer position:relative` ancora o counter — não sobre o input).

**Pendente**: D2 confirmar timing no **celular real do João**; P2/P3 do backlog;
**rotacionar token Turso** (segurança). U6 (dock de exploração 5 cards, Atacar→Mais)
e U7 (resultado +tempo + eco verde/vermelho) entregues — todos os P0/P1 fechados.

**Aprendizados**: reprodução empírica > diagnóstico herdado (3/3 seeds mal
diagnosticados); `preview_screenshot` trava neste ambiente (usar `preview_eval`);
commit msg em PowerShell sem aspas `'`/`"` (quebram here-string); singleFork vaza
`body.*` entre arquivos (sempre `afterEach` limpando).

> Última atualização anterior: 2026-05-29 (Sprint Y — 2 commits feature+test, 1871→1908 tests +37, **consultores: D&D 9.6/10 Mobile 9.4/10 — Mearls superado, empata BG3 mobile**)

### Sprint Y "Fog Linter + Death Drama + NPC Secrets + Reward Juice + Combat Echo" — entregue (2 commits, +37 tests)

Atende todos os **6 gaps remanescentes** dos 2 consultores pós Sprint X
(3 D&D + 3 Mobile). UX/regra/drama atingiu **teto da categoria**. Próximas
dimensões = vida social teatral + produto (conteúdo/persistência longa).

**Vereditos pós-Sprint Y**:
- **D&D 9.6/10** (era 9.2): *"Mesa de D&D 5e PHB-faithful conduzida por
  DM competente; gap restante é polish narrativo, não regra ou drama."*
  Expectativa Mearls (9.5) SUPERADA.
- **Mobile 9.4/10** (era 8.8): *"Como RPG narrativo mobile, está no teto
  da categoria. Não há comparável publicado nesse score."*

**Comparativo Mobile pós-Y**:
```
Marvel Snap (9.5) > JSgame Y (9.4) ≈ BG3 mobile (9.4) > Disco Elysium (9.0)
                                                       > Genshin (8.5)
                                                       > Slay the Spire (8.5)
```

#### Commit 1: `feat(Y)` — `6808282`

**Y.A — Atendendo consultor D&D** (3 gaps):
- Y.A1 `narration-linter.ts` NOVO + pipeline em dm.ts. 9 patterns regex
  (HP, CA, AC, DC, +ataque, XdY+Z, pés/ft, bônus, fração HP). Pipeline:
  LLM → lint → se viola, retry 1× com `correctionPromptForNarration` →
  se ainda viola, sanitize manual com adjetivos PHB → telemetria
  `fog_violation`. Aceito (não viola): contagem turnos/rounds, nome
  arma/spell, dano TAKEN pelo player.
- Y.A2 `playDeathSaveHeartbeat()` 2 pulses 80→40Hz sine sub-bass gap
  0.42s (sístole/diástole). Tracker `wasInDeathSave` previne re-trigger.
  CSS `body.is-death-save-pending::after` vinheta vermelha 1.6s ciclo
  4-stop (sístole 20% / diástole 45% / batimento2 60% / repouso 0-100%).
  Reduced-motion fallback.
- Y.A3 **NpcSecret** interface + `CampaignState.npcSecrets` SERVER-ONLY.
  Tools `mark_npc_secret(npcName, secret, revealCondition, secretId?)` +
  `reveal_npc_secret(npcName, secretId)`. Prompt injection bloco "🤫
  SEGREDOS QUE NPCs RECENTES GUARDAM (SÓ você vê)" lista últimos 5 NPCs
  com segredos pending. Tool defs PT-BR ricas com exemplos ("é irmã do
  bandido procurado", "está possuído por demônio"). Recent event SEM
  expor texto até reveal.

**Y.B — Atendendo consultor Mobile** (3 gaps):
- Y.B1 `body.is-combat-just-started` flag 1200ms em onState. CSS
  `animation-delay: 400ms` no `.is-just-arrived` quando body flag.
  Sequência: vinheta T+0~700ms → ring T+400~1100ms cross-fade limpo.
- Y.B2 `reward-juice.ts` NOVO. `playConfetti({count, durationMs, origin})`
  60 partículas top-fall (8 reduced) paleta HSL gold 3 tons + keyframes
  `rj-fall-spin`/`rj-burst-radial` + custom CSS vars. `showItemReveal`
  bottom-sheet backdrop blur + card scale-in cubic-bezier overshoot +
  auto-dismiss 4.5s configurável + tap/ESC/backdrop. Wire: onLevelUp me
  → confetti, onParty diff inventory → showItemReveal(featured = mais
  raro ou primeiro).
- Y.B3 `NarrationLog.appendCombatEcho({text, kind})` cria entry inline
  `.is-combat-echo is-combat-echo-{kind}` 8 kinds (crit/miss/kill/death/
  skill/player/enemy/neutral). `classifyCombatEventKind(ev)` em campaign-
  screen. CSS Cardo italic 13px tabular-nums + cor por kind (crit gold
  uppercase, death/kill red bold, miss mute, skill verde). `.cb-log-line`
  legacy MANTIDO como fallback opcional tab Log.

#### Commit 2: `test(Y)` — `65efd4c`

Novos arquivos (4, 45 tests):
- `narration-linter.test.ts` (14 tests: patterns + texto limpo + correction)
- `npc-secrets.test.ts` (10 tests: mark/reveal validators)
- `reward-juice.test.ts` (9 tests + 1 skipped sem DOM: confetti + reveal)
- `sprint-y-css.test.ts` (12 tests: Y.A2 + Y.B1 + Y.B2 + Y.B3 CSS guards)

### Aprendizados Sprint Y

- **Linter > regra no prompt**. Consultor D&D: "regra é instrução, não
  enforcement. LLM vaza 10-15%". Retry com correction + sanitize backup
  fecha pra <2%.
- **Heartbeat sub-bass 0.55 gain = "presença, não barulho"**. Player
  sente urgência sem distração. Stage 4-stop imita ECG real.
- **SERVER-ONLY + lookup case-insensitive** evita leak de secrets pro
  client em qualquer code path acidental.
- **Foca últimos 5 NPCs** no prompt secrets evita token bloat.
- **animation-delay CSS** sincroniza vinheta+ring sem JavaScript timing
  fragile.
- **HSL paleta variada** > cores hex hardcoded pra confetti — variação
  natural com 1 linha.
- **Idempotência em modals** (closeXxx() antes de openXxx()) salva de
  race conditions em coop.
- **Combat-echo SUBORDINADO visualmente** (opacity 0.86, font 13px vs
  16px da narração principal) cria hierarquia clara mesmo absorvido.

### Gaps remanescentes (próximo Sprint Z)

**D&D consultor** — vida TEATRAL (não mais regra/drama):
1. **NPC interrompe player** (P1, 3h). DM responde DEPOIS do player hoje.
   NPC arrogante deveria cortar via tool `npc_interrupt`.
2. **Voicing por NPC** (P1, 4h). `NPC.voicePattern` (registro, tique,
   gíria, sotaque). Prompt injection "Garra fala em frases curtas, usa
   'pirralho' como diminutivo". Player reconhece NPC pela voz.
3. **Tracker de promessas e dívidas** (P2, 2h). `state.playerCommitments[]`.
   Tool `track_commitment`. Mestre cobra 3 sessões depois.

**Mobile consultor** — PRODUTO (não mais UX):
1. **Conteúdo**: mais cold-opens (hoje 13), prefabs (hoje 3), loot tables.
   Combustível, não interface.
2. **Multiplayer feel**: presence indicators (cursor companion, "Borin
   está lendo a ficha"), modo espectador. Só se telemetria provar coop.
3. **Persistência campanha longa**: timeline conquistas + mural de glórias
   entre sessões. Sistema, não pixel.

### Riscos Sprint Y (ZERO regressão funcional)

| Risco | Severidade | Mitigação sugerida |
|---|---|---|
| Linter regex agressivo perde "+5 ataque" útil | Média | Telemetria `fog_violation.matches` 1 semana → calibrar |
| Heartbeat irrita player ansioso | Baixa-Média | Toggle UX `--death-save-intensity` + fade após roll 2 |
| NPC secrets bloat ~400 tokens/turn | Baixa | Monitorar adoção, simplificar se baixa |
| Confetti 70 partículas performance | Baixa | Telemetria `dropped_frames` >50ms |
| Item reveal 4.5s irrita veterano | Baixa-Média | Rarity-aware (comum 2.2s / lendário 8s) |
| Combat echo congestion >10 rounds | Baixa | Adjacent collapse Discord-style |

Nenhum bloqueia merge. Fine-tuning pós-playtest.

> Última atualização anterior: 2026-05-29 (Sprint X — 2 commits feature+test, 1842→1871 tests +29, **consultores: D&D 9.2/10 Mobile 8.8/10 — acima de BG3 mobile e Genshin**)

### Sprint X "Camada Sonora + Combat Hierarchy Final" — entregue (2 commits, +29 tests)

Atende os 6 gaps remanescentes apontados pelos consultores no fim do Sprint
W (3 D&D + 3 Mobile). Vereditos pós-X:
- **D&D 9.2/10** (era 8.5): *"SOA, PARECE e SUSTENTA D&D em todas as três
  camadas sensoriais (visual + texto + áudio) — falta só o linter de fog
  of war pra fechar a ilusão sem vazamento."*
- **Mobile 8.8/10** (era 8.0): *"SOA, RESPIRA e CONDUZ como D&D real —
  acima de BG3 mobile, alcançando Slay the Spire mobile (8.5)"*

#### Commit 1: `feat(X)` — `7870c52`

**X.A Camada Sonora** (4 mudanças):
- X.A1 `playDiceLand()` reforçado pra "Slay-the-Spire mobile-feel". 3 camadas:
  sub-bass 60Hz sine (pressão grave) + mid 180→60Hz sawtooth ("tac" base
  γ.1) + high 4kHz noise burst (madeira/osso) + tail 400Hz bandpass.
  ~250ms. setupAudioGesture já existia (main.ts:53 unlock iOS).
- X.A2 ambient default **ON** (era OFF "intrusivo"). Trilha medieval
  procedural já tem 8 moods (exploration-calm/tension, combat-skirmish/boss,
  rest, shop, danger-low-hp, mystery, victory). Player muta em UX Settings
  → "🎵 Ambient" se não quiser.
- X.A3 `playPageTurn()` SFX no read-aloud. Brushed noise 3 layers (4200/
  2400/1200 Hz bandpass) ~240ms gain 0.18 baixo. Disparado em
  NarrationLog.appendNarration SÓ quando speaker é Mestre. Reduced-motion
  off.
- X.A4 **fog of war narrativo** no SYSTEM_PROMPT. Nova regra PROIBIDO:
  "DM NUNCA cita HP/CA/DC/dano/+ataque do oponente em texto. Use APENAS
  adjetivos e sinais corporais. Stats só via tool calls. Único número
  aceito: contagem de turnos/rounds pra clock."

**X.B Combat Hierarchy Final** (3 mudanças):
- X.B1 features colapsadas em chips no `combat-target-sheet`. `cts-features-
  row` entre primary action e footer. `TARGET_SHEET_FEATURES` whitelist
  (rage, action-surge, second-wind, channel-divinity, ki, wild-shape).
  EXCLUI bardic-inspiration (precisa picker → fallback bar). buildTarget
  SheetFeatureChips puro + testado. Min-height 40px (WCAG AA), badge X/Y
  tabular gold.
- X.B2 initiative "passou pra você". Tracker module-level
  lastRibbonTurnIndex + lastRibbonCombatRound detecta transição
  currentTurnIndex PRA mim. `.is-just-arrived` 700ms animação cubic-bezier
  overshoot: avatar scale 1.15→1.45→1.15 + brightness 1.3 + pseudo-element
  ::before ring gold expansivo 0→24px shadow. Sincroniza com toast "▶ Seu
  turno" do W3.4. Reduced-motion fallback.
- X.B3 **scene pin sticky**. `.cn-scene-pin` ANTES de entriesEl no rootEl,
  position:sticky top:0 z-index:5 + backdrop-filter blur(4px) + border-left
  3px gold. Cabeça "📜 Última cena ▾" expande/colapsa preview Cardo italic
  13px (~120 chars truncate palavra completa via `previewText`) ↔ full Cardo
  14px lh 1.6. Atualizado SÓ por narração de Mestre (echo/party/player
  não tocam). getLastSceneText/getLastSceneSpeaker pra tests.

#### Commit 2: `test(X)` — `e02190f`

Novos arquivos (4, 29 tests):
- `audio-sprint-x.test.ts` (6 tests)
- `combat-target-sheet-features.test.ts` (8 tests)
- `scene-pin.test.ts` (10 tests, 1 skipped sem DOM)
- `sprint-x-css.test.ts` (12 tests B1+B2+B3 CSS guards)

### Aprendizados Sprint X

- **Web Audio synth procedural > MP3 binary asset**. Zero bundle bloat,
  zero risk iOS Safari (gesture unlock já solved). Consultor Mobile
  aceitou justificativa explícita.
- **Default ON > Default OFF** quando feature pediu pelos especialistas.
  Trade-off: muta em 30s vs nunca descobre.
- **Track separado de currentTurnIndex + currentRound** pra detectar
  transição: evita false-positive quando outro player renderiza no mesmo
  turno cross-round.
- **Scene pin lazy**: só cria DOM quando 1ª narração de Mestre chega;
  updates subsequentes só trocam textContent.
- **Whitelist de features TARGET-FREE** pro target-sheet: bardic-
  inspiration precisa picker — manter fallback bar é correto.

### Gaps remanescentes (próximo Sprint Y)

**Consultor D&D — 3 críticos**:
1. **Fog of war LINTER server-side** (2h, P0). Regex narration rejeita
   `\d+\s*(HP|CA|DC|XP|pés|ft)` + retry 1× com correção. Sem isso, X.A4
   fica em 90%.
2. **Death save drama visual + sonoro** (4h). Heartbeat 60Hz loop + vinheta
   bordas + narração entre rolls. Momento mais dramático D&D, pasteurizado.
3. **NPC com segredos persistentes** (6h). `npc.secrets[]` server-only +
   tool `mark_npc_secret`. Prompt injeta segredos no próximo encontro.
   "DM que TECE conspiração" vs "Mestre IA legal".

**Consultor Mobile — 3 críticos**:
1. **Vinheta combat-enter + 1ª "passou pra você" sincronizadas**. Hoje
   sequência separada — fundir num momento dramático contínuo.
2. **Reward juice em level-up + loot drop**. `playLevelUp` arpeggio existe;
   falta confetti dourado + card reveal. Único gap claro vs Marvel Snap 9.5.
3. **Combat log absorvido no read-aloud feed**. `.cb-log-line` ainda
   separado = 2 feeds verticais em mobile portrait. Fundir como
   `.is-combat-echo` no narration-log.

### Riscos Sprint X (consultores apontaram, ZERO regressão funcional)
- Ambient default ON: monitorar telemetria `ambient_muted_within_60s`. Se
  >15-25%, reconsiderar.
- Fog of war prompt sem linter: LLM vaza ~10-15%. Q3 #1 D&D fecha.
- Scene-pin sticky em viewport ≤620: auto-collapse quando `entries.length
  < 3` (fix de 15min).
- Web Audio Firefox Android: telemetria `audio_unlock_failed`. Se >5%, MP3
  fallback ≤30KB single.
- Status-ribbon + scene-pin ambos `top:0 sticky`: confirmar z-index cascade
  visual (status-ribbon vs cn-scene-pin z:5).

**Comparativo Mobile pós-X**:
```
Marvel Snap (9.5) > JSgame X (8.8) > Slay the Spire mobile (8.5) ≈ Genshin (8.5) > BG3 mobile
```

> Última atualização anterior: 2026-05-29 (Sprint W — 2 commits feature+test, 1802→1842 tests +40, **consultores aprovaram D&D 8.5/10 Mobile 8.0/10**)

### Sprint W "Redesign Visceral" — entregue (2 commits, +40 tests, score 5.5→8.0)

Plano `SPRINT_W_PLANO.md` executado integralmente + ajustes que os 2
consultores (D&D sênior + UX Mobile RPG) fizeram na revisão prévia.
Re-avaliação pós-execução confirmou objetivos atingidos. Sprint mais
impactante até agora — em 12-16h subiu Mobile UX de 5.5 pra 8.0/10
(objetivo era ≥7.5) e D&D Authenticity de implícito 5-6 pra 8.5/10.

**Vereditos pós-Sprint W**:
- **D&D**: *"O jogo agora PARECE D&D na primeira impressão e SUSTENTA a
  ilusão em combate — falta só a alma fora do roll (sons, ambiente,
  mistério persistente)."* (8.5/10)
- **Mobile**: *"Sprint W transformou JSgame de 'engenharia premium com
  hierarquia escondida' em 'D&D mobile que SE SENTE como D&D'."* (8.0/10)

#### Commit 1: `feat(W)` — `4a314ec`
**W1 Dado Protagonista** (6 mudanças):
- W1.1 `.atk-die` CSS órfão removido (combat já usava showDiceRollOverlay
  desde γ.1 via campaign-screen.ts:505)
- W1.2 skill-check dado 80→**140px** mobile. `.sc-stage` flex column +
  `.sc-row` grid 2-areas ("die die"/"chip-attr chip-dc"). Desktop 80→100px
- W1.3 drama timing 1500→**2500ms** default / **4000ms** crit/fumble.
  `.is-rolling` faz pointer-events:none até auto-close = drama silence
- W1.4 watchdog skill-check 5→**10s** + msg humana "🎲 O Mestre está
  pensando…"
- W1.5 crit/fumble flash visceral (gradient gold/red 0.35) + dado scale
  1.2× via `.die-crit-landed`/`.die-fumble-landed` keyframes
- W1-Mobile screen dim 0.55→**0.72** + backdrop blur 3→**6px** em ambos
  overlays (Marvel Snap-style)
- W1.6 sound layered PULADO conforme consultores (iOS Safari risk)

**W2 Mestre Narrativo** (5+1 mudanças):
- W2.1 read-aloud box PHB-style em `.is-narration:not(.is-roll-echo)` —
  gradient gold-warm + border-left 3px gold + Cardo serif 16px lh 1.6.
  Drop-cap INTELIGENTE (primeiras 3 da cena + 1ª pós location change) via
  `lastSceneLocation` + `narrationsInCurrentScene` tracker
- W2.2 player echo (`▶ Nome`) detecta + `.is-player-echo` tint azul-aço
  discreto. Distingue de Mestre (gold) e roll-echo (mute)
- W2.3 chat absorvido. `partyMessage` cria entry `.is-party-message` com
  avatar 28px + `classIcon(class)` REAL (12 classes mapeadas: ⚔ fighter
  🧙 wizard 🥷 rogue 🪓 barbarian 🏹 ranger 🎵 bard 🌿 druid 👊 monk
  🛡 paladin/cleric ✨ sorcerer 🔮 warlock). chat-sheet só pra envio
- W2.4 combat log narrativo. Monospace 11px → Cardo serif italic 14px lh
  1.5. Cores por kind reforçadas (crit gold uppercase, kill bold red+shadow)
- W2.5 SYSTEM_PROMPT `suggest_actions` OPCIONAL. Critério (a) dilema
  mecânico real, (b) player travado, (c) escolha tática. "RPG é mesa, não
  menu japonês"
- W2-Mobile thinking skeleton shimmer Disco Elysium-style. `.is-thinking`
  ganha gradient horizontal animado via background-position

**W3 Combate Target-First** (6+3+2 mudanças):
- W3.1 enemy card SEM stats (CA/+atq/dano) E SEM HP numérico. Adjetivo
  Cardo italic ("intacto"→"caído") cor por severidade. Stats completos só
  via ℹ stat-block modal. `enemyHpAdjective()` em combat-screen-helpers
- W3.2 `combat-target-sheet.ts` NOVO. Bottom-sheet com primary action
  DOMINANTE 70% glow + min-height 64px + slide-up 260ms cubic-bezier.
  `combatActionLabel()` mapeia 10 CombatActionKind → {icon, label, sub}
- W3.3 action economy STICKY top + backdrop-filter blur. Renderizado
  SEMPRE (entre turnos `.is-readonly` opacity 0.72)
- W3.4 "AGORA É VOCÊ" `body.is-my-turn` + box-shadow inset 3px gold +
  `turnEnterPulse` 600ms overshoot + haptic + toast "▶ Seu turno".
  Tracker `lastMyTurnState` detecta transição
- W3.5 cb-actions-grid MANTIDO opt-in (consultor D&D pediu)
- W3.6 validator `suggest_actions` clamp 4→**3** + prompt "máx 3 chips"
- W3-DnD iniciativa next-up SEMPRE: `findNextAliveAfter()` pula downed.
  Glyph 🩸 enemy / 🤝 aliado / ▶ você. Cardo italic 12px
- W3-DnD damage TAKEN visceral: `body.is-took-damage` (ou -crit) por 700ms
  ativa screen-shake + flash vermelho inset. Crit variant mais intenso
- W3-DnD concentração visível: `renderConcentrationChip` no status-ribbon
  com "🧠 [Spell]" + tooltip CON save DC max(10, dano/2)
- W3-Mobile targeting glow: `.cb-enemy-card.is-targeted` pulse 200ms +
  scale 1.05 + haptic 15ms ANTES do sheet abrir
- W3-Mobile vinheta combat-enter reforçada: opacity 0.55→**0.75** + zoom
  1.10→1 + flash brightness/saturate breve + haptic burst `[30,40,30]`

#### Commit 2: `test(W)` — `ef9d888`
**Novos arquivos (4, 28 tests)**: `combat-target-sheet.test.ts` (13),
`combat-screen-helpers.test.ts` (7), `class-icon.test.ts` (5),
`status-ribbon-sprint-w.test.ts` (5).

**Atualizados (5 legacy + 18 guards novos)**: mobile-polish-css M2.2→W1.2
M3.2→W2.1 + 18 Sprint W guards. narration-log drop-cap location reset.
initiative-ribbon next-up SEMPRE. suggest-actions clamp 4→3.

### Aprendizados Sprint W

- **Consultar consultores ANTES de executar = horas economizadas**.
  Ajustes prévios (HP numérico escondido, drop-cap inteligente, avatar PJ
  real, screen dim+blur, W1.6 pular, grid manter opt-in, critério binário
  fallback W3.2) viraram pontos onde NÃO precisamos voltar atrás.
- **Drop-cap SEMPRE era armadilha**. Consultor Mobile pegou no review.
  Tracker location + counter por cena resolve.
- **Layout grid 2-areas > flex column pra dado+chips mobile**. Permite
  "die span 2 / chips lado a lado" sem mudar DOM.
- **`is-rolling` class no overlay > bloquear chip-by-chip**. Drama silence
  virou 1 CSS rule `pointer-events: none`.
- **`originalToolCalls` snapshot do Ciclo V foi essencial pra W**. Sem ele,
  narração mais rica (W2.5 opcional) sumiria toolCalls em retries.

### Gaps remanescentes (próximo sprint X)

**Convergência dos 2 consultores: som diegético** é gap #1.

- **D&D #1**: Ambient loop tavern/dungeon + dice impact + page-turn no
  read-aloud. iOS unlock-on-gesture.
- **D&D #2**: Fog of war NARRATIVO — regra prompt "DM nunca cita HP/CA/DC
  do oponente em texto, só adjetivos e sinais corporais".
- **D&D #3**: `.last-scene-pin` sticky com última narração dobrável.
  Player decide ação OLHANDO o que DM acabou de descrever.
- **Mobile #1**: Colapsar `class-features-bar` em chips secundários no
  target-sheet (ainda restam 2 sistemas de ação em combat).
- **Mobile #2**: Init ribbon "passou pra você" animado entre turnos.
- **Mobile #3**: `<audio>` impact.mp3 ≤50KB unlock-on-first-tap (Slay the
  Spire-style). Fecha 3ª camada tátil do dado.

> Última atualização anterior: 2026-05-29 (Ciclo V — 1 commit infra+fixes, 1794→1802 tests +8)

### Ciclo V "Infra deploy + tool retry + 4 micro-bugs" — descoberto via diagnóstico (1 commit, +8 tests)

João reportou: "rodamos atualizações e não replicam no jogo". Investigação
revelou **41 commits no GitHub não deployados em prod** (Render auto-deploy
parou em 28/05 00:22 BRT). Joao fez redeploy manual; eu fiz fixes pra
evitar problema voltar + bugs achados no playtest da sessão anterior.

#### V.1 — Infra (`72adbd0`) — CRÍTICO prod
- V.1.a: `render.yaml` removida `DM_PROVIDER=groq`. Force-Groq sem fallback
  em prod era causa de travas (Groq 429 = sem narração). Agora prod usa
  auto-detect cascade igual dev. Adicionadas GEMINI/CEREBRAS/MISTRAL keys
  como `sync: false` placeholders pra João setar no painel.
- V.1.b: Express `setHeaders` granular em `static`:
  - `/assets/*` (hashed): `max-age=31536000, immutable` (1 ano)
  - `sw.js + index.html + manifest`: `no-cache, must-revalidate` (fresh)
  - resto (icons): 1h
  Fecha janela "deploy demora 1h pra aparecer".

#### V.2 — DM tool calls preservadas no retry (CRÍTICO) +3 tests
Bug descoberto via playtest 2026-05-29 (Lyra mago em cela, click "Atacar"):
- 1ª chamada LLM: narração="" + toolCalls=[start_combat, suggest_actions]
- Retry-sem-tools dispara (BUG-001 recovery)
- 2ª chamada: narração="machado no ar" + toolCalls=[]
- `response = nova resposta` SUBSTITUI tudo — toolCalls VÁLIDAS perdidas
- Resultado: DM narra lindo, mas combate NUNCA INICIA. F4 inacessível em
  ~30% das sessões sob Gemini overload.

Fix `dm.ts:146-180`: snapshot `originalToolCalls` antes do retry; ao
retornar, se retriedWithoutTools && originalToolCalls.length > 0 → usa
originais.

#### V.3 — 4 micro-bugs do playtest +5 tests
- V.3.a: Short rest fórmula "d10++3" → "d10+3" (double plus bug). +4 tests guard.
- V.3.b: Lobby "Wizard 5 steps" → "Passo a passo (~3 min)". Wizard tem 8 passos pós-F2 + jargão dev.
- V.3.c: Long rest ritual ignorava `body.force-motion` (toggle Ω.1). Agora `reduced = OS && !forceMotion`. +1 test.
- V.3.d: Login email submit sem timeout → eterno "⏳ Enviando…". Promise.race timeout 10s + mensagens humanizadas (⏱/📡).

### Aprendizados Ciclo V
- **Render free pode pausar auto-deploy** silenciosamente. Verificar painel
  periodicamente OU fazer manual deploy quando algo crítico.
- **`DM_PROVIDER=groq` em prod** era armadilha — funcionava em dev (cascade
  auto) mas trava em prod. Sempre testar com mesma config que prod usa.
- **Cache-Control matters**: 1h em sw.js + index.html = 1h pra deploy aparecer.
  Granular por path é essencial.
- **Tool calls + retry**: substituir response inteiro num retry perde dado
  valioso. Snapshot do que importa antes.

> Última atualização anterior: 2026-05-29 (Ciclo U — 1 commit fix descoberto via playtest, 1770→1794 tests +24)

### Ciclo U "Tool leak + Echo PT-BR" — fix descoberto via playtest headless (1 commit, +24 tests)

Após Ciclo T, fechamos os ciclos de polish e fomos pra **playtest real headless** via preview eval: cold-open prefab Lyra (mago) → click "Atacar" (action-dock direct).
Descobriu 2 gaps **REAIS** (não inferidos por audit estática):

#### U.1 — Tool call leak no narration (CRÍTICO, `a71e3b6`) +12 tests
- **Bug observado**: DM cuspiu literal no body do narration:
  `"Sem conversa?"+ tool start_combat (enemies: [{name: \"Carcereiro Bruto\"...}])+ tool suggest_actions (actions: [...])`
- **Causa raiz**: system prompt (prompts.ts:275-281) usa exemplos PT-BR
  literais "+ tool NAME (args)". Quando cascade força retry-sem-tools
  (Gemini mode=auto retornou narração vazia + toolCalls), LLM IMITA esses
  exemplos como string em vez de chamar tools.
- **Fix defensivo**: `stripInlineToolMentions(text)` em dm.ts. Pattern
  `\s*\+?\s*tool\s+(KNOWN_NAMES)\s*\(` (case-insensitive), trunca a partir
  do match. KNOWN_TOOL_NAMES cobre todas 24 tools + variações compactas
  (Gemini às vezes vira "startcombat" sem underscore).
- Aplicado em ambos caminhos extractJson (linha 146 + 157).
- 12 tests: real playtest format + multi-tool inline + case insensitive +
  non-regressão "toolkit"/"tool antiga" como palavras legítimas.

#### U.2 — Player echo "attack" → "⚔ Atacar" (`a71e3b6`) +12 tests
- **Bug observado**: takeAction handler echoava `String(action)` raw —
  player via "attack" literal no log. Jargão dev exposto.
- **Fix**: `explorationActionLabel(action)` em connection.ts mapeia os 10
  ExplorationAction (types.ts:622) pra label PT-BR com ícone consistente
  com action-dock-topics.ts: attack→"⚔ Atacar", sneak→"🥷 Furtar-se", etc.
- Fallback raw se action desconhecida (defensivo).
- 12 tests: 1 por action + fallback + cobertura total.

### Decisões/aprendizados Ciclo U
- **F4 NÃO é "PRÓXIMA"** — já entregue em ciclos passados (F25/F26/F27/η.5/etc).
  CLAUDE.md desatualizado. **Corrigido neste ciclo.**
- **Playtest headless > audit estática** — agent audit inferiu 3 buracos
  críticos que JÁ ESTAVAM FECHADOS. Playtest real (15min, custou 6 LLM calls)
  revelou 2 bugs reais que NENHUM audit pegou.
- **Próximo ciclo deve começar por playtest**, não por audit.

> Última atualização anterior: 2026-05-29 (Ciclo T — 3 commits, 1731→1770 tests +39)

### Ciclo T "Onboarding + Sheet + Rest UI + Dice Preview + Lobby" — entregue (3 commits, +39 tests)

Audit visual cobrindo gaps anotados no handoff S. Áreas até então NÃO
cobertas profundamente: onboarding tour, sheet detail (hierarquia interna),
achievements (banner anon + hidden vs locked), lobby status, rest UI
(picker visual + ritual narrativo), dice roll preview chips, login email.
13 mudanças em 3 commits + 2 módulos novos + 4 tests files novos.

#### Ciclo T1 — Crítico (`13216fb`) +9 tests
- T1.1: Onboarding step 2 "Player's Handbook" → "Livro do Jogador (D&D 5e)"
  (Henrique família — inglês na primeira impressão).
- T1.2: Onboarding tour mobile landscape fix — ot-card vira flex column +
  max-height 85vh; ot-body overflow-y auto; ot-actions margin-top auto
  (pin no bottom). Antes actions caíam abaixo do fold em 380×600.
- T1.3: Login email "Enviar link mágico" loading state (.is-loading +
  texto "⏳ Enviando…" + requestAnimationFrame defer). Mesmo padrão S3.4.
- T1.4: Achievements modal empty estruturado — 🏆 icon + título Cinzel +
  sub explicativa com nome da categoria. Casa S3.2 e S3.3.
- T1.5: Lobby player status 'selecting' visualmente distinto (tint azul-aço
  rgba 40/70/110 + 120/160/220) — distingue de 'wizard' (roxo, criando do
  zero) e 'ready' (verde).

#### Ciclo T2 — Médio (`950e19b`) +12 tests
- T2.1: Sheet "Saving Throws" → "🛡 Resistências" + sheet-saves-card visual
  (bg/border distintos dos atributos). PT-BR consistente com
  saving-throw-overlay e glossary.
- T2.2: Sheet inventory groups com separator (border-bottom dotted gold +
  padding-bottom + margin-bottom). sig-type ganha border-bottom próprio.
  `:last-of-type` sem border.
- T2.3: Achievements modal banner anônimo — "🔒 Sem login — conquistas
  não salvam entre dispositivos. Click em 💾 Salvar (home) pra sincronizar."
  Gradient gold sutil pra não competir com tabs.
- T2.4: Lobby personality preview mobile-safe (max-width:100% +
  word-break:break-word). Em mobile padding 10/14→8/10 + font 13→12.
- T2.5: Short Rest visual picker NOVO (`short-rest-overlay.ts`). Chips
  clicáveis 1..max + preview HP estimado (estimateShortRestHp fórmula PHB
  pura testável: max(1, (faces+1)/2 + conMod) * dice).

#### Ciclo T3 — Polish (`93b5b6e`) +18 tests
- T3.1: `.ach-card.is-hidden` visual DISTINTO de `.is-locked` — hidden ganha
  blur(0.6px) + tint roxo místico (border 160/110/200), locked mantém o
  cinza apagado. Usuário diferencia "mistério" de "visto, bloqueado".
- T3.2: Dice roll overlay preview com chips — parsePreviewParts quebra
  "Ataque: d20+5 vs CA 13" em 4 spans coloridos (prefix italic + d20 gold
  pill + bonus verde-vida + vs mute). Função pura exportada pra tests.
  Fallback pra texto puro se padrão não bater.
- T3.3: Long rest ritual visual NOVO (`long-rest-ritual.ts`). Overlay 1.8s
  com 3 steps: 🌙 "A noite cai…" → ⭐ "O grupo descansa…" → ☀ "Amanhece".
  Radial gradient noturno + icon-breath keyframe. reduced-motion: pula
  callback direto sem overlay.

### Arquivos novos/editados Ciclo T
**Novos módulos:**
- `src/client/campaign/short-rest-overlay.ts` — modal + estimateShortRestHp
- `src/client/styles/short-rest.css` — bottom-sheet srm-* spec
- `src/client/campaign/long-rest-ritual.ts` — overlay 3 steps
- `src/client/styles/long-rest-ritual.css` — radial gradient + keyframes

**Novos tests:**
- `src/client/__tests__/onboarding-tour-content.test.ts` — 4 tests PT-BR
- `src/client/campaign/__tests__/short-rest-overlay.test.ts` — 5 tests fórmula
- `src/client/campaign/__tests__/long-rest-ritual.test.ts` — 6 tests sequence
- `src/client/dice/__tests__/dice-roll-overlay-parse.test.ts` — 8 tests parse
- `HANDOFF_2026-05-29_ciclo-T-onboarding-sheet-rest-done.md`

**Editados (T1):**
- `src/client/onboarding-tour.ts` — PT-BR "Livro do Jogador"
- `src/client/styles/campaign-party.css` — ot-card flex column + max-height
- `src/client/auth/login-screen.ts` — loading state submit
- `src/client/styles/modals.css` — login-submit-btn is-loading
- `src/client/campaign/achievements-modal.ts` — empty estruturado + isAnon
- `src/client/styles/lobby.css` — is-status-selecting tint azul-aço

**Editados (T2):**
- `src/client/sheet/sheet-screen.ts` — "Resistências" + sheet-saves-card
- `src/client/styles/sheet.css` — sheet-saves-card + sheet-inv-group separator
- `src/client/styles/modals.css` — ach-anon-banner spec
- `src/client/styles/lobby-personality-preview.css` — mobile-safe overflow
- `src/client/campaign/campaign-screen.ts` — switch pra openShortRestPicker
- `src/client/styles.css` — import short-rest.css

**Editados (T3):**
- `src/client/styles/modals.css` — ach-card.is-hidden roxo místico
- `src/client/dice/dice-roll-overlay.ts` — parsePreviewParts + renderPreviewChips
- `src/client/styles/dice.css` — dro-prev-* chip spec
- `src/client/campaign/campaign-screen.ts` — playLongRestRitual antes do emit
- `src/client/styles.css` — import long-rest-ritual.css

**Cross:**
- `src/client/__tests__/mobile-polish-css.test.ts` — +16 CSS snapshot guards
  (T1×5, T2×7, T3×4)

> Última atualização anterior: 2026-05-29 (Ciclo S — 3 commits, 1702→1731 tests +29)

### Ciclo S "Wizard + Tutoriais + Sticky + Empty States" — entregue (3 commits, +29 tests)

Audit visual amplo via leitura de código + preview runtime (375×812). Áreas
até agora NÃO cobertas profundamente pelos ciclos M+N+O+P+Q+R: wizard
header/slider/live-preview, profile sticky, sheet vitals review, saving throw
PT-BR, exploration tutorial PT-BR família, glossary/quest empty states, login
loading. 14 mudanças em 3 commits.

#### Ciclo S1 — Crítico (`80b2992`) +17 tests
- S1.1: Home footer "🔑 Login" → "💾 Salvar" (casa identity bar Q3 — mesma
  ação tinha 2 nomes na MESMA tela). Logado mantém "👤 Perfil".
- S1.2: Wizard CTA "(Wizard avançado)" → "Criar PJ no detalhe" + title
  "Escolhe raça/classe/atributos/perícias passo a passo (~3 min)". "Wizard"
  era jargão dev (Henrique família).
- S1.3: Wizard 8 progress steps overflow-x scroll em portrait-narrow.
  Antes: flex:1 espremido (cada step ~36px), polegar tocava 2.
  Agora: flex:0 0 auto + min-width:44 + scroll-snap mandatory + scrollbar
  hidden. Step atual ganha scroll-snap-align:center. wizard.ts faz
  scrollIntoView({inline:'center'}) quando step muda em mobile.
- S1.4: Saving throw "Save SAB" → "Save de SAB" (alinha tutorial body PT-BR
  e glossary). Tutorial não-proficiente: "ability" → "atributo".
- S1.5: Exploration tutorial 6 cards reescritos PT-BR família — "skill check"
  → "teste de perícia", "overlay" → "tela do d20", "pivota pra combate" →
  "vira combate", "memória RAG" → "memória do Mestre", "party" → "amigos".
  Nat 20/1 mantidos (precisão Mariana). CARDS exportado como
  EXPLORATION_TUTORIAL_CARDS pra tests.

#### Ciclo S2 — Médio mobile polish (`2a79f97`) +8 tests
- S2.1: cs-stats-grid (wizard review) em portrait-narrow vira repeat(2, 1fr)
  explícito (era auto-fit minmax 120 inconsistente) + csb-value 24→18 +
  cs-stat-block padding 12→8.
- S2.2: ab-row (step-abilities) slider respira mobile — row-gap 4→8 +
  ab-slider min-height 28px (touch ergonômico Android/iOS).
- S2.3: Profile screen header sticky em mobile. Cascade sticky agora:
  .profile-screen > .wiz-header top:0 (z:5) → .profile-summary top:52 (z:4)
  → .profile-section-h top:142 (z:3). bg gradient gold fade + backdrop blur.
- S2.4: Live-preview wizard padding mobile — wlp-body 10/8 + gap 8 +
  portrait 72→60px (sidebar expandida em 375px sobrava 0 respiração).
- S2.5: Glossary search input min-height 40 → 44px (WCAG AAA) + padding
  8/12 → 10/14 + font 14 → 15 (evita iOS Safari auto-zoom).

#### Ciclo S3 — Polish (`2b4f336`) +4 tests
- S3.1: Home prefab archetype mobile uniforme 24px. Card 1 "Lutador Anão"
  cabia em 1 linha (12px), cards 2/3 em 2 linhas (24px) — cards de altura
  diferente. min-height:24 + flex center: card 1 cresce visualmente pro
  nível dos outros 2. **Validado runtime — 3 cards = 24px exatos.**
- S3.2: Glossary modal empty estruturado — 🔍 icon 36 + título Cinzel +
  sub "Tente outra busca ou veja todos os N termos." + CTA "← Ver todos
  (N termos)" (limpa search + refoca input). Hit 44px.
- S3.3: Quest log empty com hints — 📜 icon + título "Nenhuma missão ainda"
  + duas vias claras (💬 Falar com NPCs / 🗺 Explorar lugares novos).
- S3.4: Login anon button loading state — click → adiciona .is-loading +
  disabled + troca pra "⏳ Carregando…" + requestAnimationFrame defer pra
  DOM pintar antes do callback. CSS dim 0.6 + cursor:wait + pointer-events:none.

### Arquivos novos/editados Ciclo S
**Novos:**
- `src/client/home/__tests__/footer.test.ts` — 4 tests slot 1 anônimo/logado
- `HANDOFF_2026-05-29_ciclo-S-wizard-tutorials-sticky-empty-done.md`

**Editados (S1):**
- `src/client/home/sections/footer.ts` — slot 1 anônimo "Salvar"
- `src/client/home/sections/play-now.ts` — wizard link microcopy
- `src/client/styles/wizard.css` — wiz-progress overflow-x scroll mobile
- `src/client/character-creation/wizard.ts` — scrollIntoView no current step
- `src/client/campaign/saving-throw-overlay.ts` — "Save de" header + "atributo"
- `src/client/campaign/exploration-tutorial.ts` — 6 cards PT-BR família +
  export EXPLORATION_TUTORIAL_CARDS

**Editados (S2):**
- `src/client/styles/wizard.css` — cs-stats-grid 2x2 mobile + ab-row slider
  + wlp-body padding
- `src/client/styles/campaign-party.css` — profile cascade sticky
- `src/client/styles/glossary.css` — gl-search hit 44 + font 15

**Editados (S3):**
- `src/client/styles/home-tavern.css` — prefab archetype uniforme 24px
- `src/client/glossary-modal.ts` — empty estruturado + CTA "Ver todos"
- `src/client/styles/glossary.css` — gl-empty-* sub-classes
- `src/client/campaign/quest-log-modal.ts` — empty com hints estruturado
- `src/client/styles/campaign-party.css` — qlm-empty-* sub-classes
- `src/client/auth/login-screen.ts` — anon button loading state
- `src/client/styles/modals.css` — login-anon-btn.is-loading

**Cross:**
- `src/client/__tests__/mobile-polish-css.test.ts` — +17 CSS snapshot guards
  (S1.3×5, S2.1-5×8, S3.1-4×4) + ajuste 2 tests MP4 antigos pra nova
  cascade sticky profile

> Última atualização anterior: 2026-05-29 (Ciclos P + Q + R — 3 commits, 1676→1702 tests +26)

### Ciclos P, Q, R "Modais + Home + Cross-cutting" — entregues (3 commits, +26 tests)

3 ciclos seguidos pós-Ciclo O. Cobertura ampliada: P modais centrais (spell/inv),
Q home (prefab compact + coop toggle + Salvar label + footer), R cross-cutting
(toast hits + attention pulse + clearance bottom-tab).

#### Ciclo P — Modais (`d69bbcf`) — +13 tests
- P1: Inventory acessorio com requiresAttunement ganha badge ✨ Sintonizado /
  ◇ Pede pra sintonizar (com tooltip didático). Anel raro não fica mais inerte.
- P2: SpellCard compact ganha `.sc-cta-btn` visível "🪄 Castar" (gold gradient)
  ou "— Sem slot —" (italic dim). Affordance clara.
- P3: cs-modal-slot is-empty ganha line-through + italic + cor fade; disponível
  ganha box-shadow violet glow. Distinção visual gasto/disponível.
- P4: cs-modal-empty estruturado: icon 44px + title + sub italic + CTA "🏕
  Descansar 8h" (emit longRest direto). Fecha loop sem fechar modal.
- P5: inv-empty estruturado: icon 44 + title "Bolsa vazia" + sub didática.

#### Ciclo Q — Home polish (`1958757`) — +7 tests
- Q1: home-prefab-teaser hidden em portrait-narrow (3 cards 136 → ~100px,
  section play-now 506 → ~380px). Label + archetype mantém.
- Q2: home-coop-input.is-hidden por default (max-height 0). Click no btn
  "🔗 Entrar na Sala" expande input + foca; 2° click submete; Enter submete.
- Q3: Identity "Login" → "💾 Salvar" (Henrique família — Login confundia
  com cadastro obrigatório). Title atualizado.
- Q4: home-footer hit 50→48px + icon 24→22 + label 11→10 (compact alinhado
  com bottom-tab-bar). Footer total 73 → ~62px.

#### Ciclo R — Cross-cutting (`5e44cc3`) — +6 tests
- R1: toast-action-btn min-height 32 → 44px (WCAG AAA); toast-close-btn
  22×22 → 36×36 + border-radius 50% + bg hover (target circular claro).
- R2: toast-error / toast-warn ganham keyframe one-shot pulse 0.9s ao
  aparecer (shadow expand + ring). Captura olho sem intrusão.
- R3: --m-toast-bottom-offset var (120px = 56 tab + 64 buffer dock) +
  safe-bottom. Toast nunca tampa bottom-tab-bar.

### Arquivos novos/editados Ciclos P+Q+R
**Novos:**
- `src/client/components/__tests__/spell-card-cta.test.ts` — 5 tests CTA
- `HANDOFF_2026-05-29_ciclos-PQR-modais-home-cross-cutting-done.md`

**Editados (P):**
- `src/client/components/spell-card.ts` — CTA visível compact variant
- `src/client/spells/cast-spell-modal.ts` — empty state CTA descanso
- `src/client/inventory/inventory-modal.ts` — acessorio attunement badge + empty estruturado
- `src/client/styles/spell-card.css` — sc-cta-btn castable/no-slot
- `src/client/styles/modals.css` — slot visual + empty estrutura + inv-attuned/needs

**Editados (Q):**
- `src/client/home/sections/coop.ts` — input is-hidden toggle
- `src/client/home/sections/identity-bar.ts` — "💾 Salvar" label
- `src/client/styles/home-tavern.css` — prefab teaser hidden + coop input transition + footer compact
- `src/client/home/__tests__/identity-bar.test.ts` — assert "Salvar"

**Editados (R):**
- `src/client/styles/toasts.css` — action-btn 44 + close-btn 36 + attention keyframes + clearance var

**Cross:**
- `src/client/__tests__/mobile-polish-css.test.ts` — +21 CSS snapshot guards (8 P + 7 Q + 6 R)

### Ciclo O "Combat + Coop + Economy" — entregue (1 commit, 1657→1676 tests +19)

### Ciclo O "Combat + Coop + Economy" — entregue (1 commit, +19 tests)

Audit visual amplo via DOM injection (combat-screen, action-dock-topics, party panel
mobile, death banner). 7 achados pela equipe das 4 personas — áreas menos cobertas
nos ciclos M e N.

#### O1 — Crítico (parte do commit `1b7c94f`)
- O1.1: Topics dock com 1 sub-ação só (Combate exploration = "Atacar", Social = "Falar")
  agora direct-action SEM abrir drill. `directActionFor()` exportada. Card ganha
  `.is-direct` quando aplicável. Exclui `more`/`custom`/`dice`/`magic` (já têm
  fast-path próprio).
- O1.2: `cb-tab-btn` min-height 33→44px em portrait-narrow (WCAG AAA). Tab é
  navegação principal em combat. Padding 8/6 → 10/8 + font-size 11→12.
- O1.3: `.cdb-roll-btn` (Death Save) hit 39→48px + font 12→14 + padding 14/28 +
  gradient mais saturado + keyframe `cdb-roll-urgency` 2.4s pra sentir urgência.
  Momento mais dramático do D&D precisa prominência. Reduced-motion off.

#### O2 — Médio
- O2.1: Combat economy "👟 30ft" → "👟 9m" (PT-BR primeiro). Status ribbon idem.
  Title attr completo "9m / 30ft (1 quadrado = 1.5m = 5ft)" pra player que pensa
  em ft. Consistente com glossary D&D PT-BR.
- O2.2: Em coop (party.length>1) mobile, `.cp-list` vira flex horizontal scroll-snap.
  PJs cards 200px (220 pra `.is-me` + `order:-1` sempre primeiro). Resolve "3 PJs
  squeeze em 179px = só 1.5 visíveis". Solo mantém vertical full.

#### O3 — Polish
- O3.1: `cb-eco-slot.is-avail` ganha box-shadow gold sutil inset 1px + glow 6px.
  `.is-used` ganha grayscale(0.5) + bg escurecido. Distinção visual gasto/disponível.
- O3.2: Tab counts (Inimigos/Log) extraídos pra `.cb-tab-badge` pill dourada
  destacada (linear-gradient ink-gold). min-width 18 + 10px monospace + glow.
  Substitui "(N)" inline com pill escaneável.

### Arquivos novos/editados Ciclo O
**Novos:**
- `src/client/campaign/__tests__/action-dock-direct.test.ts` — 10 tests directActionFor
- `HANDOFF_2026-05-29_ciclo-O-combat-coop-economy-done.md`

**Editados:**
- `src/client/campaign/action-dock-topics.ts` — directActionFor() + .is-direct class
- `src/client/campaign/campaign-screen.ts` — wire is-coop em cp-list
- `src/client/campaign/status-ribbon.ts` — movement metros em vez de ft
- `src/client/combat/combat-screen.ts` — economy 9m + tab badges separadas
- `src/client/styles/combat.css` — cb-tab-btn 44px + tab-badge + eco-slot shadow/grayscale
- `src/client/styles/campaign-party.css` — cdb-roll-btn 48 + urgency keyframe
- `src/client/styles/m-camp-dock.css` — cp-list.is-coop flex scroll-snap
- `src/client/campaign/__tests__/action-dock-topics.test.ts` — ajustado pra "Explorar"
- `src/client/__tests__/mobile-polish-css.test.ts` — +10 CSS snapshot guards

### Ciclo N "Hierarquia + Visual Rich + Polish Vivo" — entregue (1 commit, +22 tests)

Audit visual fresh pós-M1/M2/M3 — cold-open Gemini real ~14s + DOM inspect. 9 achados
pela equipe das 4 personas, organizados em 3 rounds:

#### N1 — Hierarquia + clareza (parte do commit `6007565`)
- N1.1: Verdict idle educacional "d20 + 1 vs DC 12 — toque pra rolar" (era "Clique
  pra rolar o d20"). `dcDifficultyLabel()` exportada com 6 faixas referência PHB
  DMG p.238 (≤5 muito fácil, ≤10 fácil, ≤14 média, ≤19 difícil, ≤24 muito difícil,
  25+ lendário). Chip-attr e chip-dc ganham title attrs educacionais
- N1.2: `.is-first-narration .cnn-speaker` 10→13px com letter-spacing 0.18em —
  marca "início da história" sem competir com drop-cap
- N1.3: "Pular este teste" → "Pular — segue sem rolar" + title explicativo. Gap
  roll↔skip 14→24px, min-height 38 desktop / 44 mobile, font 12→13

#### N2 — Visual rich
- N2.1: Texture pergaminho mobile compensa brightness — opacity 5→7%, matrix cor
  gold-warm mais quente (0.88, 0.74, 0.45)
- N2.2: Separator `linear-gradient` 1px gold-28 entre echo entry + próxima narração
  não-echo. Sinal claro "isso é mecânica, agora volta cena narrada"
- N2.3: Tooltips educacionais nos chips do skill-check (bônus de [skill] —
  atributo X +Y / DC X — [faixa])

#### N3 — Polish vivo
- N3.1: `status-ribbon` glyph troca pra 🎲 + class `.is-pending-roll` quando
  state.pendingCheck.playerId === character.id (ou pendingSave). Keyframe
  `sr-roll-pulse` 1.4s scale+rotate. Reduced-motion off
- N3.2: dock-attention pulse agora RECORRENTE — primeira render + dmDone.
  Throttle 3s pra não virar flicker. `fireDockAttention()` helper idempotente
- N3.3: Drop-cap responsivo via `data-drop-cap` attr. Narrações <100 chars usam
  sm (32px desktop / 28px mobile); padrão md (38/32). Texto curto não fica
  dominado visualmente

### Arquivos novos/editados Ciclo N
**Novos:**
- `src/client/campaign/__tests__/dc-difficulty-label.test.ts` — 7 tests faixas DC
- `HANDOFF_2026-05-29_ciclo-N-hierarquia-visual-polish-done.md`

**Editados:**
- `src/client/campaign/skill-check-overlay.ts` — verdict educacional + dcDifficultyLabel + skip clearer text + title attrs nos chips
- `src/client/campaign/status-ribbon.ts` — hasPendingForMe + glyph 🎲 trade
- `src/client/campaign/narration-log.ts` — data-drop-cap='sm'|'md' attr na first narration
- `src/client/campaign/campaign-screen.ts` — fireDockAttention() recorrente + dmDone hook
- `src/client/styles/campaign-core.css` — speaker 13px / skip 14/38 / texture mobile 7% / separator echo / drop-cap sm
- `src/client/styles/status-ribbon.css` — is-pending-roll keyframe + reduced-motion
- `src/client/campaign/__tests__/status-ribbon.test.ts` — +3 tests pending roll
- `src/client/campaign/__tests__/narration-log.test.ts` — +3 tests drop-cap responsivo
- `src/client/__tests__/mobile-polish-css.test.ts` — +9 CSS snapshot guards

### Sprint "Polish Mobile Profundo" M1/M2/M3 — entregue (3 commits, +44 tests)

Continuação do plano de melhoria do Sprint "Dado Visível". Equipe das 4 personas
guiou os 10 achados pós-sprint: M1 (crítico) M2 (médio) M3 (polish).

#### M1 — Layout campanha mobile (`2e4c5d8`) — +8 tests
- M1.1: party slot 22vh → 16vh com `.is-solo` (solo libera 49px pra
  narration host respirar); dock border 0.35→0.45 + shadow -8/24→-10/28 +
  linha gold-18 (visual depth maior); animação `dock-attention-once`
  1.8s one-shot ao montar (chamada de atenção pro "interage aqui")
- M1.2: botão "Pular este teste" sutil link-like (italic + underline
  dotted + ink-mute) no skill-check overlay. Socket `skipPendingCheck`
  novo + `Campaign.clearPendingCheck()` valida ownerId + emite "🚶 [PJ]
  pula o teste e segue em frente" narração breve
- M1.3: location header truncate fluido (shorten(18) removido) com
  `.sr-loc` flex:1 1 auto + min-width:0 + title attr — ellipsis kicka
  só quando excede largura disponível

#### M2 — Polish visual (`9837fc8`) — +22 tests
- M2.1: `chip-icon-detector.ts` NOVO detecta verbo PT-BR + 16 patterns
  (🗣 falar, 🚶 seguir, ⚔ atacar, 🔮 conjurar, 🏃 fugir, 🥷 esconder,
  ✋ pegar, 🔓 abrir, 📖 ler, 🧗 escalar, 💰 comprar, 💚 curar, 🍺 beber,
  🌙 dormir, 🛡 equipar, ⏳ esperar). `.cn-chip-action-icon` prefix
  aplicado SÓ em chips não-skill (skill mantém 🎲 dourado)
- M2.2: dice overlay vira grid 2-col em portrait-narrow:
  ```
  ┌─────────────────────┐
  │ Label       ┌─────┐ │
  │ Sub italic  │ d20 │ │
  │             │ DC  │ │
  ├─────────────┴─────┤
  │ [tutorial inline] │
  │ verdict           │
  │ 🎲 Rolar          │
  │ Pular este teste  │
  └─────────────────────┘
  ```
  sc-row col 2 row 1/-span 2 com flex-direction:column. Override
  padding-top 50→20 (era buffer landscape, em column cai naturalmente).
  Stage 398px cabe em 812 viewport.
- M2.3: echo de roll (🎲/🛡/🚶 speaker prefix) ganha `.is-roll-echo`
  com opacity 0.78 + italic 12px + tabular-nums + ink-mute. Diferencia
  visualmente "mecânica do dado" de "narração da cena"

#### M3 — Refino estético (`5dc991c`) — +14 tests
- M3.1: tutorial Duolingo padding 12/10 → 18/16 em mobile, glyph 32→36,
  title 16→17, text 13→14 line-height 1.55. Skip hit 24→44px + nav-btn
  36→44px (WCAG AAA polegar)
- M3.2: drop-cap na primeira narração — `.is-first-narration
  .cnn-text::first-letter` Cinzel 38px dourado float:left com text-shadow
  gold-glow + black depth. Mobile reduz pra 32px. Cria momento "Era uma
  vez..." dramático na cold-open
- M3.3: textura pergaminho via SVG fractalNoise inline (~700b base64
  sem fetch externo) no `.camp-screen::before` com opacity 0.05 +
  mix-blend-mode:overlay. z-index -1 + isolation:isolate (sem vazar).
  Cor noise tinge gold-ish — feel medieval real

### Arquivos editados Sprint M1/M2/M3
**Novos:**
- `src/client/campaign/chip-icon-detector.ts` — 16 patterns + listChipIconPatterns
- `src/client/campaign/__tests__/chip-icon-detector.test.ts` — 17 tests
- `src/client/campaign/__tests__/skill-check-skip.test.ts` — 5 tests UI
- `HANDOFF_2026-05-29_polish-mobile-m1-m2-m3-done.md`

**Editados:**
- `src/client/styles/m-camp-dock.css` — party.is-solo + dock-attention keyframe
- `src/client/styles/status-ribbon.css` — .sr-loc flex/min-width
- `src/client/styles/campaign-core.css` — skip-btn + cn-chip-action-icon + sc-stage
  grid 2-col + is-roll-echo + drop-cap + texture pergaminho
- `src/client/styles/duolingo-tutorial.css` — mobile padding + hit areas
- `src/client/campaign/campaign-screen.ts` — wire is-solo + is-dock-attention +
  onSkip handler emit skipPendingCheck
- `src/client/campaign/skill-check-overlay.ts` — onSkip opcional 3º arg
- `src/client/campaign/status-ribbon.ts` — .sr-loc sem shorten() + title attr
- `src/client/campaign/narration-log.ts` — detectChipIcon import + is-roll-echo class
- `src/shared/types.ts` — skipPendingCheck socket event
- `src/server/campaign.ts` — clearPendingCheck(playerId) método
- `src/server/sockets/connection.ts` — skipPendingCheck socket handler
- `src/server/__tests__/campaign-player-initiated-roll.test.ts` — +3 tests clearPending
- `src/client/campaign/__tests__/narration-log.test.ts` — +5 tests is-roll-echo
- `src/client/__tests__/mobile-polish-css.test.ts` — +14 CSS snapshot tests

### Sprint "Dado Visível" — entregue (3 commits, +15 tests)

João reportou: *"toda vez que começa uma partida a gente joga um dado. depois
não o vejo mais, meio sem nexo"*. Audit profundo com 2 chamadas LLM Gemini
confirmou 3 causas: chip-skill indistinguível, sem botão dado persistente,
onboarding sem step sobre dado.

#### D1 — Chip-skill visível (`b0f40eb`)
- `.cn-chip.is-skill` (auto quando há hint): border dourado #f4d07f, glow,
  hover translateY
- Ícone 🎲 prefix com pulse 2.6s sutil (reduced-motion off)
- Badge perícia agora pill dourada PT-BR maiúscula ("INVESTIGAÇÃO")
- Hit 38→44px (WCAG AAA) + tooltip "🎲 Rola Investigação (d20 + bônus)"

#### D2 — "🎲 Tentar" picker persistente (`3cb9d63`) — +9 tests
- Topic 'dice' novo no action-dock-topics (entre Magia e Mais)
- src/client/campaign/skill-picker.ts: 18 perícias em ordem ergonômica
  (Percepção/Investigação/Persuasão/Atletismo/Furtividade primeiro)
- Descrição com prefix atributo: "SAB · Notar presença, ouvir conversa baixa..."
- Server: Campaign.setPlayerInitiatedSkillCheck() (NÃO sobrescreve pending
  existente — Mestre prevalece)
- Socket 'requestSkillCheck' estendido pra aceitar payload com skill (server
  cria pending novo com DC 12 default + broadcastState)

#### D3 — Onboarding + detector expandido (`96f860e`) — +6 tests
- Duolingo step novo "🎲 Como rolar o dado?" entre "Aqui você age" e "Sua
  ficha viva" (total 6→7 steps)
- Aponta .cn-chip.is-skill com fallback ch-slot-main-content
- skill-check-detector.ts patterns expandidos:
  - Percepção: "cheirar o ar", "sentir [uma] presença", "me aproximo
    devagar/com cuidado"
  - Atletismo: "empurro porta", "levanto baú pesado" ([úu] acento), "abro
    com força" (abr\w+ conjugado)

### Arquivos editados Sprint Dado Visível
**Novos:**
- `src/client/campaign/skill-picker.ts` — 18 perícias picker
- `src/client/campaign/__tests__/skill-picker.test.ts` — 6 tests
- `src/server/__tests__/campaign-player-initiated-roll.test.ts` — 3 tests
- `HANDOFF_2026-05-29_dado-visivel.md` — handoff + plano de melhoria

**Editados:**
- `src/client/campaign/narration-log.ts` — chip is-skill class + 🎲 prefix
- `src/client/styles/campaign-core.css` — is-skill border + glow + dice pulse
- `src/client/campaign/action-dock-topics.ts` — topic 'dice' + onRollDice
- `src/client/campaign/campaign-screen.ts` — openSkillPickerAndRoll wire
- `src/server/campaign.ts` — setPlayerInitiatedSkillCheck novo método
- `src/server/sockets/connection.ts` — requestSkillCheck aceita skill payload
- `src/client/campaign/duolingo-tutorial.ts` — step novo sobre rolar dado
- `src/client/campaign/__tests__/duolingo-tutorial.test.ts` — total 6→7 steps
- `src/server/skill-check-detector.ts` — patterns expandidos Percepção/Atletismo
- `src/server/__tests__/skill-check-detector.test.ts` — +6 tests

### Validação preview real (D4)
Teste real com 2 chamadas Gemini LLM:
1. Cold-open carregou + dado overlay abriu ✓
2. Rolagem do dado funcionou, DM respondeu ✓
3. Após DM: 4 chips, 2 com `.is-skill` (border #f4d07f rgb 244/208/127, h=44,
   ícone 🎲 presente, tooltip OK) ✓
4. Action dock mostrou "🎲 Tentar" + outros 5 topics ✓
5. Click "🎲 Tentar" abriu modal com 18 perícias em ordem ergonômica ✓

### Plano de melhoria (próxima sessão)
10 achados novos via preview real — 3 críticos, 4 médios, 3 polish.
Ver `HANDOFF_2026-05-29_dado-visivel.md` seção "Plano de Melhoria":
- M1: Layout campanha mobile (dock sticky, dispensar dado, header)
- M2: Polish visual (chips com ícones, dice overlay 2-col, echo styling)
- M3: Refino estético (tutorial padding, drop-cap, background texture)

> Última atualização anterior: 2026-05-28 (Sub-sprints A/B/C próximos passos — 3 commits, 1559→1576 tests +17)

### Próximos passos da equipe (A/B/C) — entregue (3 commits, +17 tests)

Continuação dos 3 rounds polish do audit das 4 personas. Foco nos 4 próximos
passos sugeridos: wizard, combat-screen mobile, coop errors, cold-open.
Agrupados em A/B/C com 4 personas reutilizadas.

#### A — Wizard polish (`30bcaa0`)
- Hit targets: cancel btn 16→44, randomizar 36→44, wp-step mobile 32→40
- Label step 7 "Nv 4" → "Talento" (Henrique entende, Mariana sabe a regra ASI/Feat)
- Step Atributos intro denso → lead + 3 bullets visuais (◆) explicativos
- 8 progress steps com tooltip + aria-label completos (Beatriz/a11y)
- Race cards: "⊳ 30 ft" → "⊳ 9m" PT-BR + tooltip "(1 quadrado = 1.5m)"

#### B — Combat mobile (`66dd5dd`)
- cb-action-btn min-height: 50px garantido
- "Atacar" .is-primary com border dourado + glow sutil sangue (90%+ turnos)
- "Disparada" → "Disparar" em 4 arquivos (PHB PT-BR consistente)
- Glossary Movimento: "30ft" → "9m / 30ft" (métrica primeiro)
- Hints didáticos reescritos pra dar contexto mecânico claro

#### C — Coop errors + cold-open dramático (`203e583`) — +17 tests
- `src/client/humanize-error.ts` NOVO — traduz erros técnicos do servidor
  em mensagens family-friendly (9 padrões cobertos: timeout/provider-fail/
  network/500/503/not-your-turn/SQLITE_BUSY/lobby-closed/lobby-full)
- Wire em campaign-screen onError: toastError(humanizeServerError(msg))
- Heurística fallback esconde stacktrace + prefixa "🌙 " pra tom narrativo
- NarrationLog: primeira narração ganha `.is-first-narration` + keyframe
  `narr-first-reveal` 1.4s dramático com glow dourado (cold-open = moment of truth)
- prefers-reduced-motion: cai pra narr-fade-in 400ms normal
- +14 tests humanize-error + 3 tests first-narration class

### Arquivos editados Sub-sprints A/B/C
**Novos:**
- `src/client/humanize-error.ts` — 9 patterns + heurística fallback
- `src/client/__tests__/humanize-error.test.ts` — 14 tests
- `HANDOFF_2026-05-28_proximos-passos-equipe.md`

**Editados:**
- `src/client/character-creation/wizard.ts` — labels + stepHints + aria-label
- `src/client/character-creation/step-abilities.ts` — intro reorganizado
- `src/client/character-creation/step-race.ts` — ft→m + tooltips
- `src/client/styles/wizard.css` — hit targets + intro-rules CSS
- `src/client/combat/combat-screen.ts` — is-primary + hints + Disparar
- `src/client/combat/combat-tutorial.ts` — Disparar (era Disparada)
- `src/client/campaign/action-dock-topics.ts` — Disparar (era Disparada)
- `src/dnd/glossary.ts` — "9m / 30ft" + Disparar
- `src/client/styles/combat.css` — is-primary visual + min-height
- `src/client/campaign/narration-log.ts` — is-first-narration class
- `src/client/styles/campaign-core.css` — narr-first-reveal keyframe
- `src/client/campaign/campaign-screen.ts` — humanizeServerError wire
- `src/client/campaign/__tests__/narration-log.test.ts` — 3 tests + happy-dom env

> Última atualização anterior: 2026-05-28 (3 rounds polish audit equipe — 3 commits, 1559 tests mantido)

### Polish "Audit 4 Personas" — entregue (3 commits, 0 net tests, zero regressão)

João pediu rodar testes no jogo com **equipe de 4 personas** + **3 rounds de correções
com profundidade**. Audit via preview_eval (sem gastar créditos LLM). Personas:
- **Mariana** DM 10+a (PHB/regras), **Tiago** mobile casual (hit targets),
  **Beatriz** UX (hierarquia), **Henrique** pai+filho 12a (family-friendly).

#### R1 — Críticos UX (`11c1efb`)
- Hit targets 32→44px: `.home-id-owner-input`, `.home-id-btn`, `.home-coop-advanced-toggle` (32→40)
- Microcopy D&D PHB nos prefabs: "TANK · BATE FORTE" → "Lutador Anão · Linha de frente"
  (Borin/Lyra/Sina archetypes refeitos com classe+raça oficial)
- Family-friendly: "Cemitério 💀" → "Heróis Caídos 🪦"; "Lobby" → "Sala"
- Resilience erro 500: "Erro listando crônicas: 500 Internal Server Error" exposto
  → "🌙 Não consegui falar com o servidor. Tente abrir de novo em alguns segundos."
- "Entrar" header → "Login" + placeholder input "Digite seu nome e jogue agora"
  (deixa claro: sem cadastro)

#### R2 — Hierarquia + jogabilidade (`8c07304`)
- Hero título 26→22px, chips 10→9px + opacity 0.85 (discreto)
- Tagline concreta: "D&D 5e · IA narra a história · sessões de 30min · até 3 amigos"
- Identity bar avatar 30→36px (alinha com input 44), gap coeso
- Footer: glyph 20→24, label 9→11 UPPERCASE, hit 50→58, "Tela"→"Ajustes"
- Prefab cards: padding/gap reduzidos, icon grid-row 1/-1, **card 155→136px (-12%)**
- Coop wording: "↓ Joinar crônica em andamento (com ID)" → "↓ Tenho o ID de uma crônica antiga"

#### R3 — Refino final (`<este>`)
- Boot splash: "Carregando o multiverso…" → "Convocando o Mestre…" (D&D, não Marvel)
- Onboarding tour reescrito: "Bem-vindo a JSgame" → "Bem-vindo à mesa", "PJ" → "herói",
  textos narrativos (não listagem técnica)
- Joinar remanescentes: "🤝 Joinar" → "🤝 Entrar" no card crônica
- Toast share campaign ID atualizado pra novo wording R2

### Arquivos editados Polish 3 rounds
- `src/client/home/sections/play-now.ts` — prefab archetypes PHB
- `src/client/home/sections/identity-bar.ts` — Login + placeholder
- `src/client/home/sections/coop.ts` — Sala/Entrar/ID crônica
- `src/client/home/sections/graveyard.ts` — Heróis Caídos
- `src/client/home/sections/my-chronicles.ts` — empty state amigável
- `src/client/home/sections/my-characters.ts` — "seus heróis aparecem aqui"
- `src/client/home/sections/footer.ts` — Login/Ajustes labels
- `src/client/home/sections/hero.ts` — tagline IA narra
- `src/client/onboarding-tour.ts` — 4 steps reescritos
- `src/client/campaign/campaign-screen.ts` — toast share ID
- `src/client/styles/home-tavern.css` — hit targets + hero + footer + prefab CSS
- `index.html` — boot tagline
- `src/client/home/__tests__/identity-bar.test.ts` — atualizado Entrar→Login

> Última atualização anterior: 2026-05-28 (Sprint Φ entregue — 6 commits, 1462→1559 tests +97)

### Sprint Φ "Visual Authentic D&D" — entregue (6 commits, +97 tests)

Plano executado a partir de `HANDOFF_2026-05-28_sprint-phi-plano.md`. Análise de 3 repos
externos guiou decisões — extraído paleta + layout de `rpgtex/DND-5e-LaTeX-Template` (MIT),
filosofia descartada do `Miserlou/dnd-tldr` (sem dataset estruturado), UX patterns ainda
não absorvidos do `Anuken/Mindustry`.

#### Φ.1 Design tokens D&D oficial (`213c8b2`) — +12 tests
- Paleta oficial extraída de `lib/dndcolors.sty`:
  - --dnd-title-red #58180D (sangue D&D)
  - --dnd-title-gold #C9AD6A (régua de título)
  - --dnd-rule-red #9C2B1B (régua triangular)
  - --dnd-stat-ribbon #E69A28 (fita gold)
  - --dnd-stat-bg #FDF1DC (fundo tan livro)
  - --dnd-read-aloud / --dnd-page-gold / --dnd-contour-gray
- 6 rarities oficiais DMG p.135 (--dnd-rarity-common→artifact)
- 8 spell schools com cores temáticas (--dnd-school-*)
- Namespace --dnd-* não regrediu tokens existentes (--ink-*, --accent-blood)

#### Φ.2 StatBlock component (`88aaf2f`) — +29 tests
- `src/client/components/stat-block.ts` NOVO + `stat-block.css` NOVO
- StatBlockData interface completa (name/size/type/alignment/AC/HP/Speed/abilities/
  saves/skills/dmg res/imm/vuln/senses/languages/CR+XP/traits/actions/reactions/legendary)
- Layout autêntico livro: fundo tan, fitas gold top/bottom, título Cinzel
  sangue D&D, régua triangular, abilities grid 6-col
- helpers puros: abilityModifier, formatModifier, crToXp (mapa PHB 30 CRs), sizeLabel PT-BR
- enemyToStatBlock(EnemySnapshot) — combat enemy detail (info button ℹ no card)
- npcToStatBlock(NpcMemory) — NPC roster Met (footer "📋 Ficha")
- `stat-block-modal.ts` NOVO — bottom-sheet mobile / centered desktop, ESC/backdrop/swipe-down

#### Φ.3 SpellCard component (`32cdd4c`) — +22 tests
- `src/client/components/spell-card.ts` + `spell-card.css` NOVOS
- Fita superior colorida por escola (8 escolas) via --school-color CSS var
- School badge com icon emoji + level chip (TRUQUE / Nv X)
- Stats grid (Alcance / Componentes / Duração)
- Tags Concentração (roxo) / Ritual (verde)
- Upcast hint pra spells level ≥1 com upcastDice
- 2 variants: compact (cast-spell-modal lista) / full (default, pra tooltips/details)
- helpers: schoolLabel/schoolIcon/schoolToken/parseComponents (V/S/M + material)
- Integração cast-spell-modal.ts via wrapper local (preserva flow)

#### Φ.4 ItemCard com rarity glow (`f6c4b12`) — +18 tests
- `src/client/components/item-card.ts` + `item-card.css` NOVOS
- Glow proporcional à raridade: comum zero / incomum outline / raro 8px / muito-raro 12px
- Lendário 18px + animação pulse 3.2s (reduced-motion respeitado)
- Atunement badge: ◇ Sintonia (inactive) / ◈ Sintonizado (gold glow active)
- Tipos InventoryItem novos: requiresAttunement?, isAttuned?
- helpers: rarityLabel/rarityToken/typeLabel/iconFor sem default branch
- Integração inventory-modal.ts: renderItemCard original delega ao componente,
  mantém classes legacy (inv-item-card/rarity-*)
- Loot-burst (α.2) preservado e movido pro item-card.css

#### Φ.5 Typography + Microcopy (`de05968`) — +16 tests
- `index.html`: Google Fonts Cinzel + Cardo via preconnect + display=swap (evita FOIT)
- `_tokens.css`: --font-body inicia com 'Cardo' (era Cormorant Garamond)
- stat-block.css usa var(--font-body) (alinhado com convenção do projeto)
- Validado via preview_eval: Cardo + Cinzel `document.fonts.check()` true,
  body computed Cardo first, bgColor #FDF1DC exato, nameColor #58180D exato
- Tests cobrem: Google Fonts presente em index.html, --font-heading começa Cinzel,
  --font-body começa Cardo, componentes usam vars (não hardcoded)

#### Φ.6 Tests + handoff (`<este commit>`) — sem tests novos
- Validação visual end-to-end via preview_eval
- CLAUDE.md atualizado (Sprint Φ Estado Atual)
- HANDOFF_2026-05-28_sprint-phi-done.md criado

### Arquivos novos Sprint Φ
**Components:**
- `src/client/components/stat-block.ts` — renderStatBlock + StatBlockData + enemyToStatBlock + npcToStatBlock
- `src/client/components/stat-block-modal.ts` — openStatBlockModal (bottom-sheet)
- `src/client/components/spell-card.ts` — renderSpellCard + schoolLabel/Icon/Token + parseComponents
- `src/client/components/item-card.ts` — renderItemCard + rarityLabel/Token/typeLabel/iconFor

**Styles:**
- `src/client/styles/stat-block.css` — fundo tan, fitas gold, regras triangular, modal wrapper
- `src/client/styles/spell-card.css` — cores 8 escolas via --school-color, compact/full variants
- `src/client/styles/item-card.css` — rarity glows, atunement badge, loot-burst animation

**Tests:**
- `src/client/__tests__/dnd-tokens.test.ts` — paleta oficial (12 tests)
- `src/client/components/__tests__/stat-block.test.ts` — 29 tests
- `src/client/components/__tests__/spell-card.test.ts` — 22 tests
- `src/client/components/__tests__/item-card.test.ts` — 18 tests
- `src/client/__tests__/typography.test.ts` — 16 tests (Google Fonts + tokens + comp delegation)

**Editados:**
- `src/client/styles/_tokens.css` — adicionado namespace --dnd-* + Cardo no --font-body
- `index.html` — Google Fonts preconnect + Cinzel+Cardo stylesheet
- `src/client/campaign/npc-roster-modal.ts` — footer "📋 Ficha" abre StatBlock modal
- `src/client/combat/combat-screen.ts` — botão ℹ no enemy card abre StatBlock modal
- `src/client/spells/cast-spell-modal.ts` — delega rendering ao SpellCard component
- `src/client/inventory/inventory-modal.ts` — delega rendering ao ItemCard component
- `src/shared/types.ts` — InventoryItem: requiresAttunement?/isAttuned? (Φ.4)
- `src/client/styles.css` — imports stat-block.css + spell-card.css + item-card.css

### Decisões Sprint Φ confirmadas
- D1 NÃO absorver `dnd-tldr` (sem dataset estruturado)
- D2 NÃO modding system Mindustry-style neste sprint (escopo grande)
- D3 SIM Google Fonts (Cinzel + Cardo) — gratuito, display=swap, fallback robusto
- D4 Onde usar StatBlock: NPC roster modal + combat enemy detail (info ℹ button)
- D5 Onde usar SpellCard: cast-spell-modal existente
- D6 Onde usar ItemCard: inventory-modal existente
- D7 Rarity glow: SIM, sutil (comum zero, lendário pulse)

> Última atualização anterior: 2026-05-27 (Sprint Ω entregue — 3 commits, 1431→1455 tests +24)

### Sprint Ω "Polimento Definitivo" — entregue (3 commits, +24 tests)

João reportou após 2 hotfixes: **dado AINDA não rola** + **home menu confuso**. Plano profundo entregue.

#### Ω.1 Dado DEFINITIVO (`37876d0`) — força anim mesmo com OS reduce ativo
- **UX pref `forceMotion: boolean`** default ON com body.force-motion class
- **dice.css overrides com `!important`** ignoram @media (prefers-reduced-motion: reduce)
- `prefersReducedMotion()` em dice-3d.ts checa body.force-motion antes do matchMedia
- Toggle "🎲 Animações cinematográficas" em UX Settings Modal
- **rollAndReveal robustez**: re-query face defensive, force reflow antes is-rolling,
  void offsetWidth pra repaint, telemetry hook opcional (started/completed/slow)
- **Fallback dramático em reduced**: dieReducedReveal scale 0.6→1.15→1 em **600ms**
  (era fade 200ms invisível) + ticks de números durante o spin
- **Watchdog 5s** skill-check-overlay: server timeout → toast "Mestre demorou" +
  botão "Tentar novamente" + telemetry dice_roll_timeout
- **Watchdog 8s** dice-roll-overlay (combat) — overlay nunca fica órfão
- 2 metric kinds novos: `dice_roll_timeout`, `dice_roll_visual_slow`
- +7 tests (forceMotion default/toggle/persist + telemetry + face re-query + body override)

#### Ω.2 Home Tavern (`1c9bb5b` + `0e8c08d`) — renderHome 250L → 9 sections
Pegada Wash Me/Spotify/Duolingo/D&D Beyond. Hierarquia nova:
- **Hero compacto 56px** (logo + tagline + 2 chips status)
- **Identity bar sticky 40px** (avatar + owner-input + streak + login/sair)
- **Continue Card destaque #1** quando há lastSession (preview ι.2 + risco + CTA pulse)
- **Play Now** (3 prefabs grid + link discreto wizard)
- **Coop** (2 botões grandes 50/50 + advanced toggle joinar crônica)
- **Collapsibles** persistidos localStorage: Meus PJs (open default) / Crônicas / Cemitério
- **Footer minimal** (Tela / Glossário / Perfil)

Decisões D1-D3 confirmadas no código:
- D1 forceMotion default ON ✅
- D2 Continue Card #1 quando há lastSession (sem → Play Now é #1) ✅
- D3 Wizard como link discreto abaixo dos prefabs (não card grande) ✅

main.ts: `renderHome` virou 1 chamada `mountHomeScreen(...)`. -513 linhas inline.
Playtest local confirmou estrutura completa montando + body.force-motion ativo.

### Arquivos novos Sprint Ω
**Ω.1:**
- (editado) `src/client/ux-prefs.ts` — campo forceMotion + apply body.force-motion
- (editado) `src/client/ux-settings-modal.ts` — toggle "🎲 Animações cinematográficas"
- (editado) `src/client/dice/dice-3d.ts` — robustez + telemetry hook + force-motion check
- (editado) `src/client/styles/dice.css` — !important overrides + dieReducedReveal 600ms
- (editado) `src/client/campaign/skill-check-overlay.ts` — watchdog 5s
- (editado) `src/client/dice/dice-roll-overlay.ts` — watchdog 8s combat
- (editado) `src/server/metrics.ts` + `src/server/routes/api.ts` — 2 metric kinds novos

**Ω.2:**
- `src/client/home/home-screen.ts` NOVO — orquestrador mountHomeScreen
- `src/client/home/sections/*.ts` NOVOS — hero / identity-bar / continue-card /
  play-now / coop / collapsible / my-characters / my-chronicles / graveyard / footer
- `src/client/styles/home-tavern.css` NOVO
- `src/client/home/__tests__/{collapsible,identity-bar,continue-card}.test.ts` NOVOS (+17)
- (editado) `src/client/main.ts` — renderHome legacy removido (-513 linhas)
- (editado) `src/client/styles.css` — import home-tavern.css

### Sprint POLISH ψ "Sentir cada toque" — 5 sub-sprints, 1396→1429 tests (+33 net)

### Sprint POLISH ψ "Sentir cada toque" — 5 sub-sprints, 1396→1429 tests (+33 net)
João pediu: "polish profundo — não precisa de mais funcionalidades, só que as que temos funcionem perfeitamente. Dado não cai, chat não tá legal, Mestre deve conduzir melhor". 4 auditorias paralelas identificaram 50+ issues. Plano organizado em 5 sub-sprints:

#### ψ.1 Dice Drama (`64af801`) — dado físico de verdade
- dieRolling keyframe REESCRITO 6 stops: drop-in translateY -180px→0 + spin + bounce settle (impacto squash). 1100→1800ms. cubic-bezier(0.16,1,0.3,1) físico.
- dieShadowSync paralelo: sombra cresce 35%→70% width junto com aproximação. Profundidade real.
- Dado overlay 58→**96px** desktop, 64→**112px** mobile. Protagonista visual.
- Callback `onLand` em 35% do duration. playDiceLand() agora sincroniza com impacto físico (era no onDone fim).
- Variação `--dieTilt` random ±15° por roll. Cada um único.
- Reduced-motion: shadow-sync OFF + padding-top normal.
- +2 tests novos (onLand antes onDone, idempotente).

#### ψ.2 Chat Alive (`ceaca43`) — chat com alma
- SERVER: `Campaign.partyMessages[]` cap 50 FIFO + `appendPartyMessage` com rate limit token-bucket (5 tokens, refill 1/2s por player). `joinCampaign` emite `partyMessageBacklog` (reconnect não perde histórico).
- SERVER: `chatTyping` socket handler broadcast `partyTyping` pros aliados.
- CLIENT: chat-sheet redesenhado — title "🤝 Party · N aliado(s)", empty state cinematográfico D&D ("A taverna está em silêncio…"), placeholder Sombrio-Trickster ("Sussurre algo aos aliados…"), `<textarea>` multi-line auto-resize 1-3, contador char visível >70% limit, typing indicator 3-dots bouncing, animação entrada msg slide+fade 240ms, timestamp live refresh 60s.
- +7 tests novos campaign-chat (append, vazio, trunca, rate limit, refill, FIFO).

#### ψ.5 Quick wins (`7f9da75`) — 7 fixes pequenos com ROI alto
- `customDetails` action-dock preservado entre re-mounts (state externo `dockState` module-level + `resetActionDockState()`).
- Combat swipe-tab guard: `Math.abs(dx) > 2*Math.abs(dy)` (mata false-positive de scroll vertical).
- Owner-input debounce 200ms (era refreshCharsList a cada keystroke).
- `appendError` acumula últimos 3 (era substituir): `.is-stale` dim os antigos.
- 4 métricas novas: `combat_turn_duration`, `narration_word_count`, `auto_retry_success`, `error_kind_seen`.
- +2 tests novos.

#### ψ.4 Modal Native Free (`0b51cc4`) — 14 prompt/confirm matados
- `ui-modal.ts` NOVO com 3 helpers: `confirmDialog`, `inputDialog`, `pickerDialog`. Promise-based, tema dourado/sangue, mobile-safe.
- 8 substituições críticas: difficulty (picker), exit-em-combate (confirm danger), shortRest hit dice (input validator), longRest (confirm), custom action (input multiline), wizard randomize (confirm), banir personagem (confirm danger), excluir crônica (confirm danger), Help target (picker), Inspire target (picker), remover amigo (confirm).
- +10 tests novos (confirm/input/picker render, click, validator, multiline, initialValue).

#### ψ.3 DM Conductor (próximo commit) — DM conduz, não reage
- `CampaignState.activeClocks[]`: clocks de pressão narrativa Blades-in-the-Dark style. DM cria via `create_clock` (ritual/suspeita/reforço) e tickka via `tick_clock`. Server persiste — LLM não esquece mais tensão entre calls.
- 2 tools novas: `create_clock` (max 2-12) + `tick_clock` (amount 1-6 clamp). Validadas server-side.
- Bloco `⏳ CLOCKS RODANDO` injetado no user prompt cada turn — DM lê e USA: narrativa avança ("o sino toca 4ª vez — 2 restantes"). Trigger fires quando completa.
- Prompt expandido: tools entradas + nota explicit sobre persistência.
- +12 tests novos (validação tool, clamp max, application state, no-op em id inexistente, fired flag).

### Arquivos novos Sprint ψ
- `src/client/dice/dice-3d.ts` (estendido com onLand callback)
- `src/client/styles/dice.css` (keyframes reescritos)
- `src/client/campaign/chat-sheet.ts` (typing, multi-line, anim, empty)
- `src/server/campaign.ts` (partyMessages + appendPartyMessage)
- `src/server/__tests__/campaign-chat.test.ts` NOVO (7 tests)
- `src/client/ui-modal.ts` NOVO (confirm/input/picker helpers)
- `src/client/styles/ui-modal.css` NOVO
- `src/client/__tests__/ui-modal.test.ts` NOVO (10 tests)
- `src/server/__tests__/dm-clocks.test.ts` NOVO (12 tests)
- `src/shared/types.ts` (activeClocks + 3 socket events: backlog, typing client+server)
- `src/server/dm/tools.ts` (create_clock + tick_clock validators)
- `src/server/dm/prompts.ts` (CLOCKS RODANDO block + 2 tool defs)
- `src/server/dm-tool-applier.ts` (handlers create_clock/tick_clock)

### Sprint κ.1 "Tutorial Duolingo guiado" — entregue (próximo commit, +15 tests)
Pegada Duolingo: spotlight visual em cada componente da tela (narration / action dock / party / tab bar) com tooltip flutuante dourado apontando + 6 steps narrativos. Dispara na PRIMEIRA SESSÃO (sessionNumber=1) após primeira narração chegar. Dismissable a qualquer momento (botão "Pular ✕" + tecla Escape). Não conflita com exploration-tutorial — duolingo prevalece em coexistência.
- duolingo-tutorial.ts NOVO — overlay manager, 6 steps (welcome → narration → actions → party → tab bar → fim), spotlight box-shadow hole effect, tooltip auto-position (top/bottom/center), keyboard nav (ArrowRight/Left/Esc), localStorage `jsgame.tutorial.duolingo.v1`
- duolingo-tutorial.css NOVO — visual spec dourado/sangue, glyph 36px com drop-shadow gold, progress chip rounded, skip discreto, botões: Voltar/Próximo/Bora jogar (verde no final)
- Telemetria por step via `duolingo_tutorial_step` (whitelist server + tipo MetricsEventKind): {step, total, viewed?, completed?, skipped?}
- 15 tests: render, navigation forward/back, last step, skip, done, keyboard nav, idempotent, close-without-mark, spotlight fallback. Mock window.localStorage via vi.stubGlobal pra isolar de outros tests no singleFork
- Wire em campaign-screen `maybeFireExplorationTutorial` — duolingo prioridade na 1ª sessão

### Sprint π refino — chat fix + ícones + slide + pop-in + métrica (`256ca9a`)
João reportou em mobile: "tela principal não está descendo o chat, ícones razoavelmente bons, dá pra melhor". Sequência de fixes:
- **BUG chat**: empty state colapsava chat-sheet em 34.7% viewport (257px de 740). Min-height 60dvh força presença dominante.
- **Ícones lapidados**: 📜→🗺 (mapa), 🏆→🏆 (label "Glórias"), 🔗→🤝 (Convite), ⚙→⋯ (consistente overflow). Glyph 22px (era 20). "⋯" boost 28px pra casar com emojis. Labels UPPERCASE + letter-spacing.
- **Slide active indicator**: .btb-active-indicator único movido via JS (translateX + width) em vez de pseudo-element. Cubic-bezier smooth 220ms entre tabs.
- **Badge pop-in**: keyframe scale 0.6→1.35→1 em 280ms quando count incrementa. Decrement NÃO dispara (sem pop fake).
- **Métrica bottom_tab_tap**: trackClientMetric em onBottomTabClick + whitelist server + tipo. +4 tests novos (indicator visible/hide, pop em increment, sem pop em decrement).

### Sprint π "Bottom Tab Bar Uber Native" — 3 commits, 1362→1377 tests (+15)
Pegada Uber/Wash Me nativa: 4 ícones secundários do header (📜🏆👥🔗) viram tab bar persistente bottom 5-slots. Chat pill ο.2 deprecated em portrait-narrow (badge mora no slot Chat). Solo: slot 4 = Share (clipboard campId). Coop: slot 4 = Chat. Slot 5 "Mais" abre overflow menu existente. Decisões D10/D11/D12 confirmadas.
- π.1+π.2 (`c3f22e3`): bottom-tab-bar.ts NOVO + bottom-tab-bar.css NOVO + styles.css import. Renderer + handle (setUnreadCount/setActiveTab/setQuestBadge/setAchievementsBadge/setCoop/destroy). CSS dourado/sangue, active indicator superior 2px com glow, badge pulse 1.6s, scale(0.95) tap, density profile (compact 48/standard 56/comfortable 64) via body class, prefers-reduced-motion respeitado, haptic vibrate 10ms.
- π.3+π.4 (`96d20f9`): campaign-screen.ts integração (slot .ch-slot-bottom-tabs no shell + bottomTabBar handle + currentOpenTab tracker + onBottomTabClick rotear pra modais), chat-sheet.ts onClose opcional, m-camp-dock.css .ch-slot-main-content 55vh→48vh + novo slot. Toggle tap: ativar mesma tab fecha o modal.
- π.5+π.6 (próximo commit): bottom-tab-bar.test.ts (15 tests) + CLAUDE.md + HANDOFF.

### Arquivos novos Sprint π
- `src/client/campaign/bottom-tab-bar.ts` — renderer + state handle (BottomTabBarHandle interface)
- `src/client/styles/bottom-tab-bar.css` — visual spec dourado/sangue + density profile + reduced-motion
- `src/client/campaign/__tests__/bottom-tab-bar.test.ts` — 15 tests

### Arquivos editados Sprint π
- `src/client/campaign/campaign-screen.ts` — wire-up tab bar + chat absorbed
- `src/client/campaign/chat-sheet.ts` — onClose opcional pra notificar caller
- `src/client/styles/m-camp-dock.css` — max-height 48vh + slot bottom-tabs
- `src/client/styles.css` — import bottom-tab-bar.css

### MEGA SESSION 2026-05-27 — 8 Sprints novos entregues
Total: **19 commits feature**, **1179 → 1362 tests (+183 net)**, zero regressão. Sprints completos ou enxutos:

### MEGA SESSION 2026-05-27 — 8 Sprints novos entregues
Total: **19 commits feature**, **1179 → 1362 tests (+183 net)**, zero regressão. Sprints completos ou enxutos:

#### Sprint ο "Pegada Uber — Tela Viva" (4 commits, +79 tests)
- ο.1: Status Ribbon mode-aware (loading/exploration/combat/rest/social) `fd1d007`
- ο.6: Toast System Unificado (5 kinds + queue max 3 + actions inline + achievement shimmer) `fd1d007`
- ο.3: Action Dock Topicizado (4 cards drill-down + End Turn sticky) `1af8b11`
- ο.4: Initiative Ribbon Uber-Style (timeline + connector animado + tap expand) `1af8b11`
- ο.5: Sheet Stack Manager (max 2 layers + ESC + swipe velocity) `f5c1142`
- ο.2: Chat Perfeito (pill flutuante + sheet 60% + avatar emoji + timestamp relativo) `f5c1142`
- ο.7: Mode Transitions (6 vinhetas: combat-enter/victory/defeat/scene-change/long-rest/revive) `2b1850f`
- ο.8: UX Settings (density / font scale / contrast / anim speed / typewriter) `2b1850f`

#### Sprint η "Mestre Joga D&D Real" (6 commits, +86 tests)
- η.1: Feat-effects engine (Alert/Tough/Lucky/Resilient/Observant/War Caster/etc com mecânica real) `7767702`
- η.2: Personality estruturado PHB (13 bg × 26 strings = 338, DM lê via ActiveCharacterProfile) `2a46ec2`
- η.3: ASI/Feat 6/8/10/12/14/16/19 + Fighter/Rogue extras (plannedAsiChoices + pendingAsiChoiceLevels) `c710f24`
- η.4: Advantage/Disadvantage genérico (apply_advantage tool + auto-conditions + isAutoFailSave) `b80768f`
- η.5: Prepared spells enforce + auto-fill (isPreparedCaster + getPreparedLimit PHB) `4d5e453`
- η.6: Saving throw fórmula didática (d20 + mod + prof = vs DC com tooltips educativos) `616e438`

#### Sprint ξ "Pendências" (verificado, 0 commits novos)
- BUG-004 spell slots nv 6-9: já fix prévio
- BUG-005 Pact magic short rest: já fix prévio
- BUG-002 tutorial rejoin: já fix (idempotência tripla)
- α.5 pre-warm LLM: skipped (ROI baixo)

#### Sprint κ "Onboarding" (1 commit, +11 tests)
- κ.2: Glossário D&D pt-BR (35 entries + search + categorias + acessível via "📖 Glossário" no overflow) `03f997c`

#### Sprint λ "Combate Cinematográfico" (1 commit, +7 tests)
- λ.5: Crit narrado épico (KILL_CRIT_SUFFIXES 6 templates "PARTIDO em dois", "explode em fragmentos") `bde42ce`
- λ.2: Spell VFX por escola (CSS keyframes fire/heal/cold/arcane/divine + detector) `bde42ce`

#### Sprint θ "Inventário Vivo" (0 commits novos)
- Rarity tiers JÁ existiam em modals.css (inv-item-card.rarity-*)
- Magic items via give_item tool com rarity

#### Sprint ι "Sessão Convida Voltar" (1 commit, 0 tests novos)
- ι.2: Preview rico no home (currentLocation + última narração 140 chars) `393715d`
- ι.5: Badge vidas em risco (⚠ pulse vermelho quando HP baixo) `393715d`

#### Sprint ν "Coop Refino" (1 commit, 0 tests novos)
- ν.3: Lobby personality picker com previewExample (frase exemplar no estilo) `a47ed2c`
- ν.2 chat polish: já entregue em ο.2
- ν.4 coop sync: server já manda state completo em joinCampaign

### Arquivos novos da MEGA SESSION
**Sprint ο:**
- `src/client/campaign/status-ribbon.ts` + CSS
- `src/client/toast.ts` (estendido) + `src/client/styles/toasts.css`
- `src/client/campaign/action-dock-topics.ts` + CSS
- `src/client/combat/initiative-ribbon.ts` + CSS
- `src/client/sheet-stack-manager.ts`
- `src/client/campaign/chat-pill.ts` + `chat-sheet.ts` + CSS
- `src/client/mode-transitions.ts` + CSS
- `src/client/ux-prefs.ts` + `ux-settings-modal.ts` + CSS

**Sprint η:**
- `src/dnd/feat-effects-engine.ts` (movido de server/ pra dnd/)
- `src/dnd/personality-tables.ts` (338 strings PHB)
- `src/client/character-creation/step-personality.ts` + CSS
- `src/dnd/condition-advantage-rules.ts`
- `src/dnd/prepared-casters.ts`
- `src/client/campaign/saving-throw-overlay.ts` + CSS

**Sprint κ/λ/ι/ν:**
- `src/dnd/glossary.ts` (35 entries D&D pt-BR) + `glossary-modal.ts` + CSS
- `src/client/campaign/spell-vfx-detector.ts` + CSS
- `src/client/styles/home-camp-card-enriched.css`
- `src/client/styles/lobby-personality-preview.css`

### Sprint μ "Mestre Não Falha" — DEFERIDO
- μ.1 streaming SSE: refactor pesado DMProvider abstraction. Bloqueado até playtest provar necessidade real.
- μ.2 cache prompts: requer setup Anthropic prefix caching (zero-budget memória já fala).
- μ.3 auto-swap provider health: cascade já tem fallback decente.
Pode reabrir em sessão futura quando time-to-first-char for atrito provado.

### Sprint γ "POLISH FUNDAÇÃO" — 6 commits, 877→939 tests
- γ.1 Dado 3D + som 3-camadas + haptic + combate (`14c19a8`)
- γ.2 DM força mais rolls via 12 keywords (`c504a6e`)
- γ.3 Echo player race fix (`8d6bba8`)
- γ.4 Mistral provider 5º cascade (`950207d`)
- γ.5 Mobile audit + header overflow 10→5 (`845af26`)
- γ.6 Telemetria UX baseline + /api/dm/ux-funnel (`c4f43a5`)

### Estratégia "Densidade" — 4 features profundas, 939→1007 tests
- F1 Primeiro Minuto Magia — 3 PJs pré-fab + 13 cold opens (`e892937`)
- F2 Crit que faz suar — combat drama visual+som+narração (`fe8d39b`)
- F3 Mestre que Lembra — RAG contextual + callback detector (`78eb823`)
- F4 PJ que Faz Sentido — backstory drives DM (`b9a6a8e`)
- Deploy disparado (dep-d8b5lobeo5us73akf350)
- Veja `HANDOFF_2026-05-27_densidade-done.md` pra detalhes

### Mobile Polish — 4 sessões temáticas, 1007→1059 tests (+52)
- MP1 Fundação Mobile — tokens --m-* + helpers .m-stack/.m-row/.m-modal + swipe-down (`8df4cb6`)
- MP2 Combat & Header — header 2-row mobile, narration flex:1, initiative fade, enemy 1-col, action 2-col (`baa24d7`)
- MP3 7 Modais Bottom-Sheet — inv/shop/cs/mem/ach/npc/qlm com header sticky + body scroll + swipe-down (`c857880`)
- MP4 Sheet+Wizard+Profile+Lobby+Finais — vitals 3-col, attrs 3-col, sheet skills 1-col, profile sticky tabs, toques transversais (`d3304f5`)
- Veja `HANDOFF_2026-05-28_mobile-polish-done.md` pra detalhes

### POLISH ζ "Cada Pixel Conta" — 1 commit, 1125 tests (mantidos)
- da57b28: src/client/styles/_polish.css NOVO + microinteractions/visual/transitions/copy
- ζ.1 microinteractions (hover -1px só pointer:fine, active scale 0.97, prefers-reduced-motion)
- ζ.2 copy review pass (4 strings home com tom sombrio-trickster)
- ζ.3 skeleton shimmer dourado refinado
- ζ.4 route-fade-in 200ms entre views (main.ts adiciona class no render)
- ζ.5 tokens extras (--shadow-xs, --r-tight/soft/loose, --shadow-glow-blood/life/rune) + scrollbar custom + cta-glow utility + focus-visible
- ζ.6 audit 5 viewports PENDENTE (preview tool screenshot travado)

### POLISH ε "Acessibilidade & Resiliência" — 1 commit, 1125→1136 tests (+11)
- 6f53f4c: src/client/a11y.ts NOVO + 7 empty states + contrast fix
- ε.1 ESC handler global fecha 6+ modais sem refactor por componente
- ε.2 ARIA via MutationObserver (aria-label auto baseado em title, role=dialog/status/alert)
- ε.3 --ink-faint #5a4e3e → #867758 (passa WCAG AA contrast)
- ε.4 7 empty states com tom temático (inventory/shop/profile/lobby/spell)
- ε.5 Error boundary global window.onerror + unhandledrejection → toast
- ε.6 IndexedDB resilience PENDENTE (escopo grande, baixa urgência)

### POLISH β "Combate sem Atrito" — 1 commit, 1136→1143 tests (+7)
- 8205cbb: combat-polish.css + condition-icons.ts NOVOS
- β.2 damage numbers polish (drop-shadow, crit glow pulsante)
- β.3 HP transitions narrativas (death cross ✕ overlay, stagger pulse <25%, damage tick)
- β.4 15 PHB condition icons + tooltip mecânico (💀 inconsciente, 🧪 envenenado, etc)
- β.5 initiative refino (current scale + drop-shadow, border colorida por kind)
- β.6 combat log colorido por tipo (player dourado, enemy vermelho, crit amarelo, etc)
- β.7 end-turn chip pulsa quando todos slots gastos
- β.1 action layer unification PENDENTE (refactor maior, audit visual)

### POLISH γ "Vida da Cena" — 1 commit, 1165→1179 tests (+14)
- e621f27: dm.ts classifyError + makeGracefulFallback errorMeta + cascade.providerNames + dmNarration mood='error' + appendDegradedNarration cliente
- γ.3 scene transition: .camp-loc.is-scene-changed pulsa (scale + glow) 1200ms quando currentLocation muda
- γ.4 error recovery rico END-TO-END: server classifica erro (6 kinds), propaga lista providers tentados, client renderiza card com chip + toggle "ver detalhes técnicos" + retry button (canRetry=false pra auth)
- γ.6 thinking tempo real JÁ feito em α.6 (4 fases + 12 dicas)
- γ.1 SSE streaming + γ.2 pre-fetch PENDENTES (refactor server grande)
- γ.5 auto-retry silent JÁ existia em callWithBackoff (2 tentativas 2s gap pra erros transientes)

### POLISH δ "Coop Sem Drama" — 1 commit, 1179 tests (mantidos)
- 570914c: connection-status.ts NOVO + cb-waiting visual rico
- δ.2 reconnect banner sticky top com 3 estados (hidden/reconnecting/failed) + botão "Tentar agora" após 15s
- δ.4 turn indicator visual: enemy "🩸" / aliado "🤝 + torcer 🤞" / aguardando "⏳"
- δ.1 presence + δ.3 chat polish + δ.5 lobby personality preview PENDENTES (server events novos)

### POLISH α "Primeira Impressão" — 2 commits, 1143→1165 tests (+22)
- 28c86ab: login fallback + cta-glow prefab + randomize wizard + thinking rico
- adeb270: tutorial inline 1ª vez no skill check overlay
- α.1 "🎮 Jogar sem cadastro" agora dominante no login (cta-glow pulsa, email vira secundário)
- α.2 home prefab CTA "▶ JOGAR" com glow dourado estático sutil
- α.3 wizard "🎲 Randomizar tudo" — randomizeWizardState NOVO (24 names, 12 surnames, point buy random)
- α.4 tutorial inline overlay 1ª vez (localStorage flag, hint d20+DC+nat20)
- α.6 thinking indicator rico — 12 dicas rotativas + 4 fases por tempo (escrever/demorando/trocando/lenta)
- α.5 pre-warm LLM PENDENTE (decisão: ROI marginal vs Sprint γ que vai mexer no DM mesmo)

### POLISH-0 "Telemetria Honesta" — 2 commits, 1111→1125 tests (+14)
- 204d27d: fix telemetria honesta (trackFirstNarrationIfNeeded no joinCampaign + 2 novos eventos)
- fea7d85: race coop fix + endpoint /api/dm/session-debug + telemetria pré-sessão
- **Achado central**: time_to_first_narration p50=52s em prod ERA composto (cold open + leitura + LLM), não real. Cold open inicial JÁ é instantâneo (~ms).
- **Causa #1** (gap 14%): bug original onde trackFirstNarrationIfNeeded só era chamado no takeAction. Fixado.
- **Causa #2**: race coop — 2º player recebia broadcast mas não trackava (response=null). Fixado.
- **Causa #3** (hipótese): sessões fantasma onde session_started emitido sem usuário interagir. Endpoint /api/dm/session-debug agora permite investigar manualmente.
- **Endpoints novos**: GET /api/dm/session-debug?days=2&limit=30 + POST /api/metrics/track (whitelist client: home_loaded, prefab_clicked).
- Veja `HANDOFF_2026-05-27_polish-0-telemetria.md`

### Pendente / Próximos passos
- [x] ~~Manual Deploy no Render~~ — auto-deployed: `dep-d8b6g0tckfvc73cnmcrg` (commit `d3304f5`)
- [x] ~~Aguardar Render destravar~~ — João fez deploy manual, 3 commits anteriores agora em prod
- [ ] **Aguardar deploy dos commits 204d27d + fea7d85** (auto-deploy do Render, ~5-10 min após push 2026-05-27)
- [ ] **Validar funil novo em prod** — `curl /api/dm/ux-funnel?days=2` deve mostrar withFirstPlayerAction, timeToFirstDmResponseMs etc
- [ ] **Query /api/dm/session-debug** assim que deploy subir — classifica 21 sessões por stage, confirma causa #3
- [ ] **Aguardar 24-48h** após deploy pra baseline real do funil novo
- [ ] **Decidir sprint POLISH α/β/γ** com base nos números reais
- [ ] Validar Mobile Polish em https://jsgame-drpe.onrender.com em mobile real
- [ ] Configurar `MISTRAL_API_KEY` no Render (γ.4 ativar)
- [ ] **Sprint δ "CORAÇÃO RÁPIDO" (~10h)** — SSE streaming (só se latência for atrito real)
- [ ] Onboarding inline tutorial primeira vez (se time_to_first_roll ainda alto)

### Decisões importantes Mobile Polish
- `--m-*` tokens (11) ficam em _tokens.css, override de --gap-loose via body.is-portrait-narrow
- `.m-modal` pattern aplicado VIA CSS selectors compostos em 7 modais (zero refactor DOM)
- `attachSwipeDown` é novo (com velocity check), `onSwipeDown` legacy mantido — usar attach* em código novo
- Pattern visual bottom-sheet: animation 220ms cubic-bezier slide-up + handlebar opcional
- prefers-reduced-motion respeitado em TODAS animações novas (modal slide, etc)
- Hit target ≥40px (m-hit) ou ≥44px (m-hit-cta) enforced em todos botões mobile
- CSS-only para 95% das mudanças — apenas 2 mudanças DOM: wrapper .camp-header-chips +
  onSwipeDown adicionado no quest-log-modal

### Arquivos-chave Mobile Polish
- `src/client/styles/_tokens.css` — 11 tokens --m-* + override gap-loose mobile
- `src/client/styles/m-layout.css` — helpers .m-stack/.m-row/.m-hit*, pattern .m-modal,
  bottom-sheet aplicado a 7 modais, toques finais transversais (tap-highlight, scroll-padding)
- `src/client/m-swipe-down.ts` — attachSwipeDown helper (velocity + handlebar)
- `src/client/__tests__/m-swipe-down.test.ts` — 7 tests (threshold, velocity, etc)
- `src/client/__tests__/mobile-polish-css.test.ts` — 45 CSS snapshot tests
- `HANDOFF_2026-05-28_mobile-polish-done.md` — handoff atual

### Arquivos-chave Sprint γ
- `src/client/dice/dice-3d.ts` — Dado reusável 3D-ish CSS
- `src/client/dice/dice-roll-overlay.ts` — modal genérico de roll
- `src/client/haptic.ts` — navigator.vibrate wrapper
- `src/server/skill-check-detector.ts` — 12 keyword patterns
- `src/server/dm/providers/mistral.ts` — provider Mistral free tier
- `src/server/ux-funnel.ts` — computeUxFunnel agregado
- `src/client/campaign/header-overflow-menu.ts` — popover ⋯

### Arquivos-chave POLISH ζ + ε
- `src/client/styles/_polish.css` — NOVO — microinteractions globais + tokens extras + scrollbar custom + cta-glow + route-fade-in + skeleton shimmer
- `src/client/a11y.ts` — NOVO — initA11yEnhancements (MutationObserver), initEscapeKeyHandler (ESC fecha modais), initGlobalErrorBoundary (window.onerror toast)
- `src/client/main.ts` — wire-up de a11y init + route-fade-in class
- `src/client/styles/_tokens.css` — --ink-faint contrast fix
- `src/client/__tests__/a11y.test.ts` — 11 tests cobrindo enhance + handlers
- 7 arquivos de modal/screen com empty states reescritos (inventory, shop, profile, lobby, sheet, spells)

### Arquivos-chave POLISH-0
- `src/server/sockets/connection.ts` — trackFirstNarrationIfNeeded no joinCampaign (cobre race coop) + 3 helpers de telemetria (firstNarration, firstPlayerAction, firstDmResponse)
- `src/server/ux-funnel.ts` — UxFunnelSummary expandido com withFirstPlayerAction, withFirstDmResponse, timeToFirstPlayerActionMs, timeToFirstDmResponseMs
- `src/server/session-debug.ts` — NOVO — per-session debug com classifyStage (started_only/narration_only/action_no_response/engaged_no_roll/rolled/combat/unknown)
- `src/server/routes/api.ts` — endpoints /api/dm/session-debug + POST /api/metrics/track (whitelist CLIENT_ALLOWED_KINDS)
- `src/server/metrics.ts` — 4 novos kinds: time_to_first_player_action, time_to_first_dm_response, home_loaded, prefab_clicked
- `src/client/api.ts` — trackClientMetric helper (fire-and-forget POST /api/metrics/track)
- `src/client/main.ts` — emit home_loaded em renderHome() + prefab_clicked no click do prefab card
