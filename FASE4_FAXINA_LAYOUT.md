# Fase 4 — Faxina de layout (sweep 360×800 e 390×844)

Sweep por medição de DOM no preview (`preview_eval` + `getBoundingClientRect`,
nunca `preview_screenshot` — trava). Critérios por tela: sem overflow horizontal
(`scrollWidth ≤ innerWidth`), nada vital abaixo do fold, sem sobreposição
(`elementFromPoint` nos alvos), hit targets ≥44px, safe-area respeitada. Tudo
atrás de `is-portrait-narrow` (desktop não regride — coberto por testes).

## Telas medidas (✅ = limpo após faxina)

| Tela | 360×800 | 390×844 | Notas |
|---|---|---|---|
| Home | ✅ | ✅ | overflow-x 0; 1 hit target corrigido (ver F4.1) |
| Campanha exploração | ✅ | ✅ | header 42 · party 45 · narração 689 · barra 68; ZERO sobreposições; Batalha clicável (elementFromPoint) |
| Campanha combate | ✅ | ✅ | dock 64vh; ⚔ Atacar inView+clicável; barra no fold; grid colapsa 852→544px |
| Skill-check (dado) | ✅ | ✅ | stage 51–749 cabe; dado 140px; Rolar 46px; tap→is-rolling 3.2ms; sem overflow-x mesmo com tutorial+inspiração |
| Ficha expandida (member sheet, NOVO Fase 2) | ✅ | ✅ | bottom-sheet fixed, max-height 88dvh, body rola (ver F4.2) |
| Modal Ajustes (ui-modal) | ✅ | ✅ | overflow-x 0 |

Desktop (sem `is-portrait-narrow`): sem barra inferior, combate com abas + grid
direto (sem `<details>`). Coberto por `bottom-action-bar.test` e
`combat-screen-no-tabs.test`.

## Achados corrigidos

- **F4.1** `.home-coop-btn-advanced` ("Entrar na Crônica") media ~36px de altura
  → `min-height:44px` + inline-flex centrado (WCAG). `home-tavern.css`.
- **F4.2** `.cp-member-sheet-body` ganhou `flex:1; min-height:0` pra ROLAR quando
  a ficha é alta (muitos badges) em vez de estourar o cap de 88dvh do sheet.
  `m-camp-dock.css`. (Defensivo — a ficha real fica ~280px, bem abaixo do cap.)

## Sem achados (já estavam limpos)

- Nenhum overflow horizontal em nenhuma das telas medidas.
- Nenhuma sobreposição (elementFromPoint nos botões-alvo retorna o próprio botão).
- Demais hit targets ≥44px (barra de ações 54px, combate 54px, dado 140px).

## Pendente (celular real do João — preview headless não cobre)

- Timing do reveal do dado físico 3D (opcional, OFF por default) no aparelho.
- Confirmar o feel do menu inferior + ficha expandida no toque real.
- Itens P2/P3 do `BACKLOG_QA_MOBILE.md` seguem abertos (fora do escopo desta faxina).
