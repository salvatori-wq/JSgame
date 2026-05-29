# Handoff — QA Mobile Fase A→C entregue (dado, chat, combate)

> Continuação de `HANDOFF_2026-05-29_qa-mobile-dado-chat-next.md` +
> `PLANO_AGENTES_QA_MOBILE.md`. Backlog completo em `BACKLOG_QA_MOBILE.md`.

## O que rolou nesta sessão

**Fase A** (diagnóstico): 4 auditores em paralelo (A1 fluxo, A2 regras, A3 clareza,
A4 layout) + reprodução empírica minha no preview 390×844 (sem gastar LLM).
**Fase B**: backlog ranqueado → `BACKLOG_QA_MOBILE.md`.
**Fase C**: 13 fixes em 4 commits, todos verificados no preview + suite 2006 verde.

## ⚠️ Correção que muda o entendimento

Os 3 "bugs-semente" P0 da sessão anterior **NÃO reproduzem como descritos** a 390×844
(provado no navegador, não inferido):
- **BUG-1** (dado cortado `top:-46px`): dado fica **dentro** da tela (skill-check 381→552,
  combate 308→589). Os paddings 200/220px são o buffer exato do drop −180px.
- **BUG-2** (físico atrás do dim): canvas (z-9600) fica **acima** do dim (9500); `#app`
  não cria stacking context. A causa real do "mal aparece" era outra (ver D1/D2).
- **BUG-3** (empty-state sobrepõe): empty-state **não** sobrepõe input/footer (flex-shrink
  protege). A causa real era o char-counter absoluto (C1).

## Commits (pushados → deploy Render)

| Commit | Itens |
|---|---|
| `a6203e3` | M1 XP vitória narrada · C1 chat counter · D1 dado órfão (#dice-box-mount) |
| `3807dc4` | U1 HP/CA na ribbon de combate · U2 loop de ataque (revela aba inimigos) |
| `327726a` | D5 face d20 · D6 dado clicável · U4 hierarquia de turno · U5 end-turn sticky |
| `599f9b1` | D2 físico legível (sem blur, dim 0.5) + prewarm · D3 overlay no body · D4 overflow · U3 hint target-first |

## Aberto pra próxima sessão

1. **D2 — confirmar no celular real do João** se o dado físico ainda "mal aparece".
   A parte de código (tirar blur, aliviar dim, pré-aquecer ~600KB em idle) está feita,
   mas o timing fino (quão rápido o canvas pinta o d20 no 1º roll) só dá pra medir
   no aparelho. O `preview_screenshot` deste ambiente trava (headless) — não dá prova visual aqui.
2. **U6** (7 tópicos competindo no dock de exploração) e **U7** (resultado do teste some
   em 2,5s) — P1 que não entraram nesta rodada.
3. P2/P3 do backlog: U8, U9, U10, L1, L2, U11, U12, U13, L3, L4, C3.
4. **[SEGURANÇA, bloqueante]** Rotacionar token Turso (vazou em chat anterior):
   João gera novo em `jsgame-prod` → troca `TURSO_AUTH_TOKEN` no Render → revoga o antigo.

## Aprendizados (economizam tempo)

- **Reprodução empírica > diagnóstico herdado**. 3 dos 3 bugs-semente P0 estavam mal
  diagnosticados; medir no navegador (getBoundingClientRect, computed styles) revelou
  as causas reais. "Build passou ≠ funciona", e "handoff disse ≠ reproduz".
- **`preview_screenshot` trava neste ambiente** (timeout até em página limpa — rAF/compositor
  headless, já anotado no audit ζ.6). Usar `preview_eval` + medições DOM, não screenshot.
- **Commit message em PowerShell: zero aspas `'`/`"` no here-string** — elas quebram o
  parse e o git recebe pathspecs picados. Mensagens sem aspas passam limpo.
- **singleFork vaza estado global entre arquivos** — `body.force-motion` adicionado num
  teste vazou pro long-rest-ritual. Sempre `afterEach` limpando o que o teste muta no body.
- **U2 (loop de ataque) era P0 real**: "Atacar" mandava clicar em enemy cards numa aba
  escondida (`display:none` em mobile). Fix = `setActiveTab('enemies')` no clique.
- **U3/U5 esbarram em decisões deliberadas** (W3.5 grade opt-in, Ω.9 dock 35vh). Fiz versões
  conservadoras que respeitam essas decisões (hint em vez de remover; sticky em vez de aumentar).
