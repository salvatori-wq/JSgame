# Handoff — QA Mobile + correções (dado, chat, clareza de tela)

> **Para a próxima conversa.** Leia este arquivo + `PLANO_AGENTES_QA_MOBILE.md`
> (esquadrão de agentes) + as memórias `feedback_zero_budget.md`,
> `feedback_interface_alma.md`, `feedback_powershell_batch_trap.md`.

## 1. O que o João pediu (missão desta rodada)

Após jogar a versão em prod, ele reportou:
1. **Dado ainda bugado** — "uma hora quase vi ele rodando" (mal aparece).
2. **Chat com uma mensagem sobreposta.**
3. **Rodar testes como usuário no MOBILE** e achar o que corrigir.

Foco (palavras dele): *"as funcionalidades atuais funcionarem, o jogo ser
gostoso, o jogo ter uma tela boa para entender o que está ocorrendo."*

O plano de execução (4 fases, agentes especialistas) está em
**`PLANO_AGENTES_QA_MOBILE.md`** — comece por ele.

## 2. Bugs JÁ confirmados nesta sessão (não precisa re-descobrir)

Reproduzidos via preview MCP a **390×844** (portrait-narrow ativo), sem LLM:

### BUG-1 (P0) — Dado cortado no topo, caminho CSS
- `.die-3d` no `dice-roll-overlay` renderiza em **`top: -46px`** (acima da
  viewport) a 390px. `dieVisibleInViewport: false`.
- Causa: `.dro-stage` leva `padding-top: 220px` (`body.force-motion …
  .dro-stage`) + `padding: 200px 22px 24px` (`@media max-width:480`),
  empilhados com `align-items:center` do overlay e drop `-180px` do keyframe
  `dieRolling` (`--die-drop-y: -180px` em `.dice-roll-overlay .die-3d`).
- Arquivos: `src/client/styles/dice.css` — overlay ~L255, `--die-drop-y` L104,
  paddings force-motion/mobile no fim do arquivo (~L455-473).
- Fix provável: rever o padding gigante do `.dro-stage` no mobile (era buffer
  pro drop em landscape; em portrait sobra) e/ou trocar `align-items:center`
  por layout que garanta o dado dentro da tela após o drop.

### BUG-2 (P0) — Dado físico (dice-box) provavelmente atrás do dim
- `#dice-box-mount` (canvas, **z-index 9600**) é filho do `<body>`; o
  `.dice-roll-overlay` (**z-index 9500** + `backdrop-filter: blur(6px)`) é
  filho do `#app`. `backdrop-filter` cria stacking context — o canvas físico
  pode ficar visualmente atrás do dim, OU o overlay tapa o canvas.
- **Confirmar no navegador real**: ⚙ Tela → "Dado 3D com física" ON, rolar
  um dado, ver se o dado 3D aparece sobre a tela.
- Arquivos: `src/client/dice/dice-box-engine.ts` (`ensureMount()` faz
  `document.body.appendChild`), `src/client/styles/dice.css` (#dice-box-mount
  ~L477-498, `.dice-roll-overlay.is-physical .dro-stage`).
- Fix provável: montar o `#dice-box-mount` DENTRO do `.dice-roll-overlay`
  (mesmo stacking) OU, no modo físico, deixar o overlay com fundo transparente
  e o canvas acima. Garantir que `is-physical` realmente esconde a caixa CSS.

### BUG-3 (P1) — Chat com mensagem sobreposta
- Reportado pelo João, **ainda não reproduzido** (a assinatura de
  `openChatSheet` mudou; meu eval de teste falhou).
- Suspeita: empty-state ("A taverna está em silêncio…", sprint ψ.2) com
  `min-height: 60dvh` sobrepondo a 1ª msg real ou o input; ou o typing
  indicator (3-dots) sobrepondo. Arquivos: `src/client/campaign/chat-sheet.ts`,
  `src/client/styles/chat.css`.
- **1ª tarefa do agente QA: abrir o chat no mobile com 1-2 msgs + reproduzir
  + fotografar.** A API real está em `chat-sheet.ts` (export `openChatSheet`,
  `appendChatMessage`, `setRemoteTyping`, `closeChatSheet`).

## 3. Como testar SEM gastar LLM (importante — zero-budget)

- `preview_start` (jsgame-frontend) → `preview_resize` 390×844 →
  `preview_eval` injetando os componentes reais via `import('/src/client/...')`.
- `window.dispatchEvent(new Event('resize'))` depois do resize (o
  `preview_resize` não dispara o evento sozinho; sem isso `is-portrait-narrow`
  fica stale).
- Cold-open/combate REAL custa LLM (cascade cerebras→groq→gemini→cloudflare).
  Usar só quando precisar validar o fluxo ponta-a-ponta; pra layout/overlap,
  injeção DOM basta.
- A home e os componentes (dice overlay, chat sheet, combat screen) montam
  sem backend.

## 4. Estado do código

- **HEAD `bf6b19d`**, tudo pushado e LIVE em prod (`jsgame-drpe.onrender.com`).
- 8 commits da sessão: Fases 1A/1B/2/3 + fix desktop (coluna central) + dado 3D.
- Suite verde + typecheck limpo no último check. `npm run build` exit 0.
- Dado físico: `@3d-dice/dice-box ^1.1.4`, assets em `public/dice-assets/`
  (servindo 200 em prod), notação predeterminada `1dN@valor` (server manda o
  número), fallback total pro dado CSS, toggle UX default ON.
- Tree limpo exceto docs untracked (este handoff + PLANO + o handoff do plano
  10/10 anterior).

## 5. Arquivos-chave desta missão

```
src/client/styles/dice.css                  # BUG-1 (padding/overlay) + BUG-2 (#dice-box-mount z-index)
src/client/dice/dice-box-engine.ts          # BUG-2 (mount no body) — mover pro overlay
src/client/dice/dice-roll-overlay.ts        # orquestra físico↔CSS (is-physical, fallback)
src/client/campaign/chat-sheet.ts           # BUG-3 (sobreposição)
src/client/styles/chat.css                  # BUG-3 (min-height 60dvh empty-state)
src/client/styles/responsive.css            # desktop coluna central (já corrigido — não regredir)
src/client/styles/m-camp-dock.css           # dock mobile (campanha portrait)
PLANO_AGENTES_QA_MOBILE.md                  # o esquadrão de agentes (LER PRIMEIRO)
```

## 6. Regras da casa (aprendizados que economizam tempo)

- **PowerShell frágil cancela os irmãos do batch.** Rodar typecheck/vitest/
  commit SOLO. Confiar no EXIT code do vitest, não na regex de resumo (ANSI
  quebra). Ver `feedback_powershell_batch_trap.md`.
- **Ambiente teve lag de ~1 turno** em saídas de comando nesta sessão e na
  anterior — confirmar estado real (git log, ler arquivo) antes de repetir.
- **"Build passou" ≠ "funciona".** Selector que não casa é CSS válido — provar
  no navegador o que é visual. (Já errei isso esta sessão mirando classe
  inexistente `.camp-dock-shell`.)
- **Re-ler o trecho exato antes de Edit** — vários Edits falharam por eu
  lembrar conteúdo diferente do real.

## 7. Pendência de segurança (bloqueante, do João)

- [ ] **Rotacionar token Turso** (exposto no chat anterior). João gera novo no
  banco `jsgame-prod`, Claude troca `TURSO_AUTH_TOKEN` no Render, revoga antigo.

## 8. Primeira mensagem sugerida pra nova conversa

> Lê `HANDOFF_2026-05-29_qa-mobile-dado-chat-next.md` e
> `PLANO_AGENTES_QA_MOBILE.md`. Executa a Fase A do plano: roda os testes
> mobile (390×844) com os agentes auditores, reproduz os bugs do dado e do
> chat, e me traz o backlog ranqueado antes de corrigir.
