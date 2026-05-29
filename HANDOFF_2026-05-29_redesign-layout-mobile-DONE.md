# Handoff — Redesign de layout mobile (CONCLUÍDO)

## 1. Resumo

Os **4 movimentos** do redesign de layout mobile (plano em
`HANDOFF_2026-05-29_redesign-layout-mobile.md`, validado no mockup
`public/proto-layout.html`) foram **executados, testados, verificados a 390×844
e pushados** → deploy Render. Mockup deletado. Suite **2014 → 2042 verde**.

Tudo atrás de `body.is-portrait-narrow` — **desktop não regride** (verificado
empiricamente: sem a classe, o toggle `is-in-combat` não altera nada).

## 2. Os 5 commits (todos pushados em origin/main)

| Commit | Movimento | Essência |
|---|---|---|
| `f17119b` | **① Proporção mode-aware** | `m-camp-dock.css`: combate (`.camp-screen.is-in-combat`) → narração `flex:0 0 auto; 18vh`, dock `flex:1 1 auto`. Exploração intocada (35vh). |
| `a3871c0` | **② Combate sem abas** | `combat-screen.ts` não rende `.cb-tabs` nem `data-active-tab` em portrait → inimigos+economia+ações juntos. Log inline oculto. Desktop mantém abas. |
| `41ceef8` | **③ Party faixa fina solo** | `renderPartyStrip` (portrait+nome+HP+CA, sem XP/slots; badges 2ª linha). Slot `is-thin-host`. Dock de combate sem cap (`max-height:none`). |
| `8bb5614` | **④ Scene-pin + narração centrada** | Pin scroll-aware (revela só quando a cena viva saiu de vista; some em combate via `setCombatMode`; bg opaco). `is-narr-sparse` centraliza narração curta. |
| `<docs>` | **Docs + limpeza** | CLAUDE.md atualizado, este handoff, `proto-layout.html` deletado. |

## 3. Resultado medido (390×844, DOM real)

- **Combate**: dock **295→572px** (≈68vh) — inimigos + economia + ações JUNTOS,
  alvo acima do fold; narração recap 18vh; gap 0; tab bar fixa.
- **Exploração**: narração **565px** respirando (era ~451); party **135→45px**
  (libera 90px); pin não duplica a cena viva.
- **Desktop**: `is-in-combat` sem `is-portrait-narrow` → 0 mudança (narração
  400/400, dock 620/620).

## 4. Arquivos tocados

- `src/client/styles/m-camp-dock.css` — ① proporção combate, ③ faixa fina + `is-narr-sparse` host, dock cap none.
- `src/client/combat/combat-screen.ts` + `src/client/styles/combat.css` — ② sem abas (gate `isNarrow`) + log oculto.
- `src/client/campaign/campaign-screen.ts` — ③ `renderPartyStrip` + `is-thin-host`; ④ `setCombatMode`.
- `src/client/campaign/narration-log.ts` + `src/client/styles/campaign-core.css` — ④ pin scroll-aware/oculto/opaco.
- Tests novos: `combat-screen-no-tabs.test.ts`, `party-thin-strip.test.ts`, `scene-pin-redesign.test.ts`; guards em `mobile-polish-css.test.ts`; 1 guard atualizado em `sprint-x-css.test.ts`.

## 5. Pendências (próxima sessão)

- **Celular real do João** (BLOQUEADO no headless): confirmar o **reveal do
  scene-pin ④** com layout real (rolar e ver o pin aparecer/sumir) e o **dado
  físico D2** (timing). `preview_screenshot` e import pesado de módulo + rAF
  **travam** neste ambiente — o reveal fim-a-fim não foi exercitado (CSS medido +
  unit tests cobrem as peças, mas não a integração com scroll real).
- **Rotacionar token Turso** (segurança, herdado — bloqueante): gerar em
  `jsgame-prod`, trocar `TURSO_AUTH_TOKEN` no Render, revogar antigo.
- P2/P3 de `BACKLOG_QA_MOBILE.md` (U8–U13, L2–L4, C3) seguem abertos.

## 6. Aprendizados

- O gancho `is-in-combat` do ① **já existia** no código — o handoff sugeria criar
  `is-combat`, mas bastou usar o existente.
- **Margin collapsing** mordeu o ③: `.camp-party` tem `margin:12px 0`; como flex
  item NÃO há collapsing → somava 24px à faixa (69px em vez de 45). `margin:0` no
  variant resolveu. E `.cp-pj` na faixa arrastava padding/borda do card cheio.
- Verificação **mede o DOM** (`getBoundingClientRect`/`getComputedStyle`) — o
  `preview_screenshot` e imports async pesados travam (anotado nas memórias).
- Para combate (que custaria LLM via `start_combat`), montar o `.camp-screen`
  fiel + injetar conteúdo sintético + medir é fiel o suficiente p/ proporções.
