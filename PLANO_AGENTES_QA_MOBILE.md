# PLANO — Agentes Especialistas: QA Mobile + Correções

> Missão (palavras do João): **"as funcionalidades atuais funcionarem, o jogo ser
> gostoso, o jogo ter uma tela boa para entender o que está ocorrendo."**
> Foco mobile-first. Zero-budget (sem LLM pago; ver `feedback_zero_budget.md`).

## 0. Bugs JÁ confirmados nesta sessão (sementes pros agentes)

Reproduzidos via preview real a **390×844 (portrait-narrow ativo)**, sem gastar LLM:

1. **DADO cortado no topo (caminho CSS)** — P0.
   - No `dice-roll-overlay`, a 390px o `.die-3d` renderiza em `top: -46px`
     (`dieVisibleInViewport: false`). Causa: `.dro-stage` recebe
     `padding-top: 220px` (regra `body.force-motion ... .dro-stage`) e
     `padding: 200px 22px 24px` (`@media max-width:480`), empilhados com
     `align-items:center` do overlay + drop de `-180px` do keyframe → o dado
     entra acima da viewport. Arquivo: `src/client/styles/dice.css`
     (overlay L255, dro-stage padding L~440-473).
   - **É o "dado bugado, uma hora quase vi ele rodando" do João.**

2. **DADO físico provavelmente atrás do dim (caminho dice-box)** — P0.
   - `#dice-box-mount` (canvas, z-index 9600) é filho do `<body>`; o
     `.dice-roll-overlay` (z-index 9500 + `backdrop-filter: blur`) é filho do
     `#app`. `backdrop-filter` cria *stacking context* — o canvas pode ficar
     visualmente ATRÁS do dim do overlay, ou o overlay tapa o canvas.
     Hipótese forte, **confirmar no navegador real** (rolar dado com
     `physicalDice` ON e ver se aparece). Arquivos:
     `src/client/dice/dice-box-engine.ts` (mount no body),
     `src/client/styles/dice.css` (#dice-box-mount L~477-498).

3. **CHAT com mensagem sobreposta** — P1 (reportado pelo João, não reproduzido
   ainda — API do `openChatSheet` mudou). Suspeita: empty-state
   ("A taverna está em silêncio…") com `min-height: 60dvh` (sprint ψ.2)
   sobrepondo a 1ª mensagem ou o input. Arquivos:
   `src/client/campaign/chat-sheet.ts`, `src/client/styles/chat.css`.
   **Primeira tarefa do agente QA: reproduzir e fotografar.**

## 1. Estrutura do esquadrão (4 fases)

### FASE A — Diagnóstico (4 auditores em PARALELO, read-only)

Cada agente roda o fluxo mobile (390×844) via preview MCP + leitura de código.
**Não corrigem nada** — só produzem lista estruturada de achados
(`{id, severidade P0-P3, tela, sintoma, arquivo:linha suspeita, evidência}`).

- **A1 · QA Mobile (fluxo de usuário)** — percorre: home → clicar prefab →
  campanha (cold-open) → rolar dado (skill check) → combate (atacar) →
  abrir chat → descanso. Anota tudo que quebra, trava, corta, sobrepõe ou
  confunde. Hit-targets <44px, scroll preso, overlay órfão, texto cortado.
  *Reproduzir os 3 bugs-semente acima primeiro.*
- **A2 · D&D Regras (funcionalidade)** — as mecânicas REALMENTE funcionam?
  Combate resolve e dá XP; magia gasta slot e aplica efeito; buff de CA
  (Fase 2) muda a CA na tela; dado físico cai no número do servidor; morte/
  death save; rest restaura. Verifica via testes + leitura, não só visual.
- **A3 · UX Clareza ("entendo o que tá rolando?")** — em cada estado, um
  novato entende: de quem é o turno, o que aconteceu no último roll, o que
  fazer agora, onde está o HP/CA? Hierarquia visual, affordance dos botões,
  feedback de ação.
- **A4 · Layout/Visual (sobreposição & corte)** — caça z-index, overlap,
  elemento cortado, stacking context, scroll-bleed. **Dono dos bugs 1, 2, 3.**

> Orquestração sugerida: como são independentes e read-only, rodar como
> **Workflow** (fan-out paralelo) OU 4 chamadas `Agent` (subagent_type:
> `Explore` ou `general-purpose`) num único batch. O João precisa optar por
> Workflow explicitamente (palavra "workflow") OU autorizar os agentes.

### FASE B — Triagem (1 síntese)

Consolidar os 4 relatórios num **backlog único ranqueado**:
- Dedup (mesmo bug visto por 2 agentes = 1 item).
- Severidade: P0 funcionalidade quebrada / dado-chat (o que o João citou) →
  P1 confunde o jogador → P2 fricção → P3 polish.
- Cada item com: arquivo:linha, fix proposto, custo estimado, risco de
  regressão. Output: `BACKLOG_QA_MOBILE.md`.

### FASE C — Correção (engenheiros, 1 por cluster)

Agrupar por arquivo/domínio pra evitar conflito de merge:
- **Cluster Dado** (dice.css + dice-box-engine + overlay): resolver corte no
  topo (rever padding/centering do `.dro-stage` mobile) + stacking do canvas
  físico (mover `#dice-box-mount` pra dentro do overlay OU subir overlay
  acima do dim com fundo transparente no modo físico).
- **Cluster Chat** (chat-sheet + chat.css): matar a sobreposição.
- **Cluster Layout** (responsive/m-camp-dock/campaign-core): demais overlaps.
- **Cluster D&D** (server/dnd): qualquer mecânica quebrada.
- Cada fix: Edit + **teste** (vitest) + `npm run typecheck` + reproduzir no
  preview que o sintoma sumiu. Regra da casa: **rodar comandos de verdade
  SOLO** (não batchar PowerShell frágil com Edits — `feedback_powershell_batch_trap.md`).

### FASE D — Verificação & deploy

- Re-rodar o fluxo mobile inteiro (A1) — confirmar que P0/P1 sumiram.
- `npm run typecheck` + `npx vitest run` (confiar no EXIT code, não no resumo).
- `npm run build` exit 0.
- Screenshot mobile real do dado caindo + chat limpo (prova visual pro João).
- Commit por cluster, push só com OK do João → auto-deploy Render
  (confirmar live via `/dice-assets/` ou bundle hash).

## 2. Princípios não-negociáveis (todos os agentes herdam)

- **Mobile-first** é o foco; desktop não pode regredir (já tem fix da coluna
  central em `responsive.css`).
- **Zero-budget**: nada de API/serviço pago. Preview MCP + injeção DOM pra
  testar sem queimar LLM. Combate/cold-open real custa LLM — usar com parcimônia.
- **Servidor é fonte da verdade** (dado, regra, dano) — validar, nunca confiar
  no client/LLM.
- **Honestidade de verificação**: "build passou" ≠ "feature funciona". Provar
  no navegador o que é visual. Confirmar `git log` antes de afirmar commit.
- **Não silenciar**: se um fix tem trade-off, dizer.

## 3. Pendência de segurança herdada

- [ ] **Rotacionar token Turso** (vazou no chat) — João gera novo em
  `jsgame-prod`, troca `TURSO_AUTH_TOKEN` no Render, revoga o antigo.

## 4. Estado do código (base pra começar)

- HEAD `bf6b19d`, tudo pushado e live em prod (`jsgame-drpe.onrender.com`).
- 8 commits da sessão anterior no ar: Fases 1A/1B/2/3 + fix desktop + dado 3D.
- Suite verde, typecheck limpo no último check.
- Dado físico: `@3d-dice/dice-box` instalado, assets em `public/dice-assets/`
  (servindo 200 em prod), toggle UX "Dado 3D com física" (default ON).
