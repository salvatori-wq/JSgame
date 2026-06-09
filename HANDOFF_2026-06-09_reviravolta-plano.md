# Handoff — Reviravolta JSgame (executar o PLANO_REVIRAVOLTA.md em autônomo)

## 1. Estado atual

2026-06-09. Tudo limpo, sem pendência de código. `origin/main` = `0d5c55d`, suíte
2231 verde, tsc limpo. O `PLANO_REVIRAVOLTA.md` está commitado e pronto pra próxima
sessão executar em ciclos autônomos. Há uma sessão de áudio paralela ativa no mesmo
`main` (rebase, nunca reset/force).

## 2. O que foi feito nesta sessão

1. **Estabilização Fase 1** (`1f8fe2f` + `0e1ea0d`): deletou 3 sistemas de UI MORTA
   (bottom-tab-bar, action-dock-topics, header-overflow-menu) e fundiu os 2 menus
   "Mais" num só (Personagem/Crônica/Ajustes), com os toggles de áudio movidos pra
   Ajustes. Verificado no preview real.
2. **Estabilização Fase 3** (`907df71`): failover do cascade LLM — Gemini e Groq agora
   jogam erro em resposta vazia (antes RETORNAVAM vazio → cascade parava ali e caía no
   FallbackDM). +9 tests. Failover confirmado ao vivo nos logs.
3. **Estabilização Fase 2** (`d5a285e`): infra de música por LOOPS CC0 aditiva, OFF por
   padrão (a generativa de ~2600 LOC soava intrusiva). Toggle em Ajustes + `public/audio/
   README.md` com shortlist CC0. Não deletei o motor generativo (sessão de áudio
   paralela).
4. **Limpeza** (`6ad2153` Tier A morto + `1be122a` toasts 3→1 + `05447ac` log de combate
   duplicado): ~715 linhas removidas. Verificado no preview.
5. **Análise profunda + plano** (`0d5c55d`): workflow de 7 deep-dives paralelos
   (arquitetura/feel-mobile/game-design/Mestre-IA/testes/dados-coop-segurança/onboarding)
   → síntese → **crítica adversarial que verificou as afirmações no código**. Virou o
   `PLANO_REVIRAVOLTA.md` (versão já revisada com a crítica incorporada).

## 3. Contexto técnico relevante

- **O diagnóstico raiz do "premium mas ruim"** (detalhado no plano) é uma história só em
  4 camadas: (1) percepção de velocidade — ZERO streaming nos 6 providers + typewriter
  FALSO que reproduz texto já recebido a 80 char/s, dobrando a latência percebida; (2)
  render destrutivo — `campaign-screen.ts` (2034 linhas) faz teardown+rebuild síncrono a
  cada broadcast, 5-7 renders por ataque em cima das animações (o "patina" que nenhum
  teste headless vê); (3) núcleo vazio — depois do cold-open é chat-com-dados sem destino;
  (4) fundação sem fechadura — `npcSecrets` (server-only) vaza cru no broadcast, IDOR nos
  REST, `joinCampaign` sem checar dono, ZERO CI.
- **A crítica adversarial é load-bearing** (verificou no código): o bug de ordem em
  `campaign-screen.ts:398` (reatribui `currentState` antes de ler como anterior → quebra
  detecção de transição de combate HOJE) é REAL; o vazamento de `npcSecrets` é real (não
  existe função de strip no código inteiro); zero streaming nos 9 providers; só
  `keep-alive.yml` em CI. Os 6 ajustes da crítica já estão no plano.
- **Decisão pendente do João** (tomar no início da execução): **coop é P0 ou distração?**
  A north-star é solo-first; isso parte a Fase 0c.
- **Régua + aprendizado de deploy:** Render free pula auto-deploy silenciosamente (risco
  #1, memória `feedback_evidencia_deploy.md`). Toda reviravolta tem GATE de deploy
  obrigatório (hash do bundle + `/api/health` uptime) ANTES de declarar feito. E "verde
  headless" não é prova — só o João jogando no celular.
- **Memórias do João** (`C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/`):
  `feedback_evidencia_deploy` (gate de deploy), `feedback_interface_alma` (UX é a alma),
  `feedback_zero_budget` (só free tier), `feedback_powershell_batch_trap` (commit via
  here-doc, confiar no EXIT do vitest). Ler antes de agir.

## 4. Fix/padrão central (primeiro quick win, Fase 0a)

Bug de ordem REAL que quebra a detecção de transição de combate hoje, em silêncio —
`src/client/campaign/campaign-screen.ts` (~linha 398 vs 430-432):

```ts
// ERRADO (hoje): reatribui antes de ler como "anterior"
private onState(state: CampaignState): void {
  this.currentState = state;          // linha ~398
  // ...
  const wasInCombat = this.currentState.mode === 'combat'; // ~430 — lê o NOVO!
}
// CERTO: capturar o anterior ANTES do reassign
private onState(state: CampaignState): void {
  const prev = this.currentState;     // snapshot do anterior
  this.currentState = state;
  // ...
  const wasInCombat = prev?.mode === 'combat'; // compara prev vs novo
}
```

Padrão de boundary seguro (Fase 0b) — uma função `toClientCampaignState(state)` que faz
strip de `npcSecrets` antes de TODO `emit('campaignState')` (`src/server/sockets/
helpers.ts:27` + `connection.ts`), com 1 teste guard que falha se o segredo aparecer no
payload.

## 5. Follow-ups sugeridos

As fases do `PLANO_REVIRAVOLTA.md` são o trabalho, em ordem. Cada uma termina com o João
jogando no celular + gate de deploy.

- [ ] **(BLOQUEANTE — João decide primeiro) Coop é P0?** — parte a Fase 0c.
- [ ] **Fase 0 — quick wins críticos** (não-bloqueante, baixo risco): onState fix, strip
      npcSecrets, IDOR characters, debounce saveCampaign, rAF-coalesce dos render.
- [ ] **Fase 1 — rede de segurança**: CI (precisa João habilitar escopo `workflow` no
      token), smoke determinístico (roda local independente do CI), telemetria de campo
      (time_to_first_token), destravar os 4 testes-fantasma.
- [ ] **Fase 2 — REVIRAVOLTA streaming** (transformador): generateStream + dmNarrationChunk
      + matar typewriter fake + beat instantâneo. **Contingência de tool-calls-no-stream
      documentada ANTES de codar** (onde nasce o bug V.2).
- [ ] **Fase 3 — REVIRAVOLTA render** (gated por evidência): medir se o rAF-coalesce já
      matou o "piscar"; só então decidir o `update()` granular (risco stale-state).
- [ ] **Fase 4 — REVIRAVOLTA conteúdo**: adventure seeds + director server-side +
      cliffhanger persistente + variedade de cold-open (planejar JUNTO).
- [ ] **Fase 5 — onboarding/funil**: deletar exploration-tutorial, Duolingo 7→2-3, card
      "Surpreenda-me", adiar install-banner, home de conversão.
- [ ] **Fase 6 — boot/bundle**: code-split por rota + lazy-load áudio + SW cache-first.
      **NÃO** quebrar styles.css por rota (risco FOUC no responsivo).
- [ ] **(João, paralelo)** rotacionar token Turso de produção; habilitar escopo `workflow`
      no GitHub; Manual Deploy + confirmar bundle a cada reviravolta.

## 6. Arquivos-chave tocados (esta sessão)

- `C:\Users\JOÃO\JSgame\PLANO_REVIRAVOLTA.md` — NOVO, o plano mestre (a próxima sessão
  executa a partir dele).
- `C:\Users\JOÃO\JSgame\public\audio\README.md` — NOVO, shortlist CC0 pros loops (Fase 2).
- `C:\Users\JOÃO\JSgame\src\client\campaign\campaign-screen.ts` — menu fundido + limpeza
  (renderChatBar removido, toasts/combatLog) + é o god-object central do plano.
- `C:\Users\JOÃO\JSgame\src\client\audio\loops.ts` + `ambient.ts` + `audio.ts` — infra de
  loops (Fase 2 da estabilização).
- `C:\Users\JOÃO\JSgame\src\server\dm\providers\{gemini,groq}.ts` — empty-throw failover.
- **Não tocar (núcleo bom):** `src/dnd/*` (regras D&D), o motor de áudio generativo (sessão
  paralela).

## 7. Deploy / ambiente

- `origin/main` = `0d5c55d`. **Render auto-deploy OFF** → João faz Manual Deploy →
  "Deploy latest commit". Cold-start hiberna. **Confirmar hash do bundle no ar antes de
  declarar qualquer reviravolta feita** (risco #1).
- Sessão de áudio paralela commita no mesmo `main` (rebase, verificar por conteúdo, nunca
  reset/force).
- `npm run dev` (5173+3001) · `npx tsc --noEmit` · `npx vitest run` (confiar no EXIT).
  Commit via Bash here-doc (PowerShell quebra aspas). Preview MCP cai com HMR — reiniciar.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (executar o plano em autônomo, na ordem):**
> Lê o `PLANO_REVIRAVOLTA.md` e o `CLAUDE.md` do JSgame (em `C:\Users\JOÃO\JSgame`) e o
> handoff `HANDOFF_2026-06-09_reviravolta-plano.md`. Executa o plano de reviravolta de
> forma AUTÔNOMA, na ordem das fases (Fase 0 quick wins → Fase 1 CI/smoke/telemetria →
> Fase 2 streaming → Fase 3 render → Fase 4 conteúdo → Fase 5 onboarding → Fase 6 boot).
> Antes de começar, me faça a UMA pergunta que o plano deixou pendente (coop é P0?).
> Reproduz no jogo real antes de declarar pronto, commit por fix com caminhos explícitos,
> suíte verde + tsc limpo, gate de deploy obrigatório por reviravolta (confirma o bundle
> no ar), e me dá o hash no fim de cada fase pra eu jogar. Decisões executivas — não me
> pergunta a cada passo. Cuidado: sessão de áudio paralela no mesmo main (rebase, nunca
> reset/force).

**Opções específicas (se quiser mirar uma fase):**

1. **Fase 0 + 1 — base segura (recomendado começar aqui):**
   > Roda as Fases 0 e 1 do `PLANO_REVIRAVOLTA.md` no JSgame: quick wins críticos (fix do
   > bug onState em campaign-screen.ts:398, toClientCampaignState pra strip de npcSecrets,
   > IDOR de characters, debounce do saveCampaign, rAF-coalesce dos render) + rede de
   > segurança (destravar os 4 testes-fantasma com @vitest-environment happy-dom, src/test/
   > setup.ts + factories.ts, npm run smoke com DMProvider fake determinístico, telemetria
   > time_to_first_token). Me diz o que precisa de mim (coop P0? escopo workflow no token?).
   > Commit por fix, suíte verde, me dá os hashes.

2. **Fase 2 — REVIRAVOLTA streaming (o maior impacto de feel):**
   > Roda a Fase 2 do `PLANO_REVIRAVOLTA.md`: streaming ponta-a-ponta (generateStream no
   > DMProvider pra Groq/Cerebras/Gemini, socket dmNarrationChunk, matar o typewriter fake,
   > beat instantâneo no skill-check, shimmer otimista no tap, tool-set por modo). ANTES de
   > codar, escreve a contingência de tool-calls-no-stream (onde nasceu o bug V.2) e cobre
   > com testes golden. Gate de deploy + me dá o hash pra eu sentir o "texto em ~1s" no
   > celular.

3. **Fase 4 — REVIRAVOLTA conteúdo (o que faz voltar amanhã):**
   > Roda a Fase 4 do `PLANO_REVIRAVOLTA.md`: 5-8 adventure seeds estruturadas (objetivo +
   > vilão + beats + clímax) injetadas no prompt como trilhos, director server-side que
   > avança clocks deterministicamente, cliffhanger persistente no continue-card, XP por
   > marco não-combate, e variedade de cold-open por prefab. Reproduz no jogo, me dá o hash.

Começa com a Opção curta se não tiver certeza — eu leio o plano, te faço a pergunta do
coop, e toco as fases na ordem parando pra você jogar cada reviravolta. Se já souber qual
fase quer, vai direto numa das 3.
