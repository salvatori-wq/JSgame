# Handoff — Reviravolta JSgame: Fases 0, 1 e 2 entregues (próxima: Fase 3)

## 1. Estado atual

2026-06-09. Código limpo, sem pendência de código. `origin/main` = `9ecb9dd`, suíte
**2295 verde** (1 skip), tsc limpo. Foram executadas as Fases 0, 1 e 2 do
`PLANO_REVIRAVOLTA.md` (em ordem). **Pendência humana ativa e BLOQUEANTE**: o deploy
da Fase 2 (streaming) foi clicado pelo João, mas na última conferência o bundle de
prod ainda era o ANTIGO (`index-DgHM1uaL.js`, uptime não resetou) — confirmar se
subiu antes de assumir streaming no ar. Sessão de áudio paralela ativa no mesmo
`main` (rebase, nunca reset/force).

## 2. O que foi feito nesta sessão

1. **Fase 0a** `d96672f` — `campaign-screen.ts onState`: captura `prev` antes do
   reassign. As detecções de transição (vinheta de combate, fanfarra vitória/derrota,
   troca de cena, descanso, revive) estavam mortas em silêncio. Revive movida pra `onParty`.
2. **Fase 0b** `0b64df8` — `toClientCampaignState()` strip de `npcSecrets` (server-only)
   nos 7 emits de `campaignState`. Guard test.
3. **Fase 0c** `e6c801c` — IDOR fechado (characters GET/POST/DELETE + campaigns GET/DELETE
   por dono), `/api/dm/diag` gated, `joinCampaign` checa dono do PJ (Coop=P0 por decisão do João).
4. **Fase 0d** `73d96d8` — debounce do `saveCampaign` (~2.5s coalesce) + flush no
   disconnect/shutdown. Crítico antes do streaming (write amplification no Turso).
5. **Fase 0e** `e09dca3` — `scheduleRender()` coalesce os 6 render() de broadcast num rAF
   (o "piscar"). Gate da Fase 3 depende de medir isso no celular.
6. **Fase 1a** `21a3a80` — destravou 4 testes-fantasma (~26 asserts de DOM que pulavam em
   silêncio) + `environmentMatchGlobs` happy-dom no `src/client`.
7. **Fase 1c** `8091145` — `npm run smoke`: 6 goldens E2E na Campaign real (cobrem V.2 e M1).
8. **Fase 1d** `f22e025` — telemetria `time_to_first_token` (client + ux-funnel) + `src/test/
   factories.ts` + `setup.ts`. (ci.yml escrito mas NÃO commitado — token sem escopo `workflow`.)
9. **Fase 2 server** `b0fc1ed` — streaming (generateStream em Cerebras/Groq/Gemini + extrator
   incremental + cascade), design "prévia best-effort + final autoritativo". Golden prova V.2 preservado.
10. **Fase 2 client** `9ecb9dd` — typewriter FALSO deletado + prévia de streaming + shimmer
    otimista no tap + `time_to_first_token` medido no 1º chunk.

## 3. Contexto técnico relevante

- **A decisão arquitetural da Fase 2 está em `FASE2_STREAMING_CONTINGENCIA.md`**: streaming
  cru NÃO encaixa (narração vem em JSON `{"narration","speaker"}` + `extractJson`/strip/
  fog-lint/retry-sem-tools rodam no texto COMPLETO → chunks crus vazariam JSON/HP e
  renasceria o V.2). Design adotado: o provider acumula tudo e devolve o MESMO
  `DMRawResponse`; um extrator (`src/server/dm/narration-stream.ts`) puxa só a narração
  limpa pra a PRÉVIA; o `dmNarration` final (sanitizado) SUBSTITUI a prévia no client. Todo
  o pós-processamento (e o fix do V.2) fica intacto no buffer final. Golden:
  `src/server/dm/__tests__/dm-streaming.test.ts`.
- **Streaming só na 1ª chamada de `narrate`** (happy path). Retries (sem-tools, fog) NÃO
  streamam — o final substitui a prévia. `onNarrationDelta` é threaded:
  `connection.ts takeAction/skill-check → campaign.takeAction/resolveSkillCheck → dm.narrate`.
  Evento novo `dmNarrationChunk {delta, seq}`; client ignora `seq` antigo.
- **Smoke local NÃO valida o happy-path do streaming**: o ambiente local está degradado
  (GROQ_API_KEY stale = auth fail; GEMINI 429/503; CEREBRAS/MISTRAL missing). **Prod TEM as
  keys** (`/api/health`: hasGemini/hasGroq/hasCerebras/hasCloudflare = true) → streaming vai
  funcionar AÍ. O JSON que apareceu no smoke estava no card de erro DEGRADADO (resposta
  truncada → fallback pré-existente do `extractJson`), NÃO num chunk (0 mutações na prévia).
- **Memória relevante**: `feedback_evidencia_deploy.md` (Render free pula auto-deploy
  silenciosamente — risco #1; confirmar bundle no ar SEMPRE). É exatamente o que está
  pendente agora (bundle ainda era o antigo). Ver também `feedback_zero_budget.md`,
  `feedback_interface_alma.md`, `feedback_powershell_batch_trap.md`.
- **Decisão do João nesta sessão**: Coop é P0 (entrou na Fase 0c). E "streaming de token
  agora (tudo)" — por isso a Fase 2 foi o streaming completo, não só as alavancas seguras.

## 4. Fix/padrão central

Padrão de streaming com prévia best-effort + final autoritativo (preserva o V.2). O
provider acumula e devolve o mesmo `DMRawResponse`; a extração da narração limpa é uma
camada acima (`src/server/dm/dm.ts narrate`):

```ts
// dm.ts — só a 1ª chamada streama; o pós-processamento (extractJson/strip/fog/retry)
// fica IDÊNTICO, operando no buffer final. onNarrationDelta repassa deltas LIMPOS.
let streamOnText: ((raw: string) => void) | undefined;
if (onNarrationDelta) {
  const extractor = new NarrationStreamExtractor();
  streamOnText = (raw) => { try { extractor.push(raw, onNarrationDelta); } catch {} };
}
response = await this.callWithBackoff(systemPrompt, userPrompt, true, streamOnText);
// ... extractJson + stripInlineToolMentions + fog-lint + retry-sem-tools (V.2) inalterados ...
```

No client (`campaign-screen.ts`), o `dmNarration` final faz `clearStreamingPreview()` antes
do `appendNarration` normal — a prévia (DOM puro, fora de `this.entries`) é descartada e o
texto autoritativo renderiza com todos os side-effects.

## 5. Follow-ups sugeridos

- [ ] **(BLOQUEANTE — re-conferir) Bundle do `9ecb9dd` está no ar?** Última conferência:
      ainda `index-DgHM1uaL.js`, uptime sem reset. Rodar `curl -s https://jsgame-drpe.onrender.com/`
      e checar se o `assets/index-*.js` mudou + `/api/health` uptime baixo. Se não mudou, o
      Manual Deploy não trocou o bundle (risco "deploy fantasma").
- [ ] **(João, no celular) Validar o streaming**: sentir "texto começa em ~1s" + shimmer no
      tap. E **MEDIR o "piscar"** em combate (decide a Fase 3).
- [ ] **(João, opcional) Telemetria**: em 24-48h, `curl /api/dm/ux-funnel?days=2` →
      `timeToFirstTokenMs.p50` deve cair bem abaixo do `timeToFirstDmResponseMs`.
- [ ] **Fase 2e (pendente, baixo risco)** — enxugar tool-set por modo (exploração ~6 tools,
      combate o set de combate) + cortar redundância do prompt. Menos tokens = geração mais
      rápida + mais quota. Deferida pra isolar do deploy do streaming.
- [ ] **Fase 3 (GATED por evidência)** — render que não pisca. SE o rAF-coalesce (Fase 0e) já
      matou o "piscar" no celular → PARAR (não tocar na identidade do DOM, evita stale-state).
      SÓ se ainda pisca → `combat-screen`/party viram `update(state)` granular (risco alto).
- [ ] **Fase 4** — adventure seeds + director server-side + cliffhanger + variedade de cold-open.
- [ ] **Fase 5** — onboarding (deletar exploration-tutorial, Duolingo 7→2-3, "Surpreenda-me", home conversão).
- [ ] **Fase 6** — boot/bundle (code-split por rota + lazy-load áudio + SW). NÃO quebrar styles.css por rota.
- [ ] **(João) CI**: habilitar escopo `workflow` no token GitHub OU adicionar
      `.github/workflows/ci.yml` (já no working tree) pela web UI.
- [ ] **(João) Keys de prod**: confirmar GROQ/CEREBRAS no Render (local estava stale/missing).
- [ ] **(João) Rotacionar token Turso** (pendência de segurança, vários handoffs).

## 6. Arquivos-chave tocados

- `C:\Users\JOÃO\JSgame\src\server\dm\narration-stream.ts` — NOVO, extrator incremental da narração.
- `C:\Users\JOÃO\JSgame\src\server\dm\providers\openai-stream.ts` — NOVO, parser SSE OpenAI-style.
- `C:\Users\JOÃO\JSgame\src\server\dm\providers\{base,cerebras,groq,gemini,cascade}.ts` — generateStream.
- `C:\Users\JOÃO\JSgame\src\server\dm\dm.ts` — narrate(onNarrationDelta) + callWithBackoff(onText).
- `C:\Users\JOÃO\JSgame\src\server\campaign.ts` — onState/onParty fix (0a) + takeAction/resolveSkillCheck(onNarrationDelta).
- `C:\Users\JOÃO\JSgame\src\server\sockets\connection.ts` — strip(0b) + IDOR(0c) + debounce(0d) + dmNarrationChunk.
- `C:\Users\JOÃO\JSgame\src\server\sockets\helpers.ts` — toClientCampaignState (0b).
- `C:\Users\JOÃO\JSgame\src\server\ownership.ts` — NOVO, predicados de IDOR (0c).
- `C:\Users\JOÃO\JSgame\src\server\campaign-saver.ts` — NOVO, debounce (0d).
- `C:\Users\JOÃO\JSgame\src\server\routes\api.ts` — IDOR gates + diag gate + metric whitelist.
- `C:\Users\JOÃO\JSgame\src\client\campaign\narration-log.ts` — typewriter removido + prévia de streaming.
- `C:\Users\JOÃO\JSgame\src\client\campaign\campaign-screen.ts` — onState(0a) + scheduleRender(0e) + dmNarrationChunk + otimista + time_to_first_token.
- `C:\Users\JOÃO\JSgame\src\shared\types.ts` — dmNarrationChunk event.
- `C:\Users\JOÃO\JSgame\src\test\{factories,setup}.ts` — NOVOS (Fase 1d).
- `C:\Users\JOÃO\JSgame\src\server\__tests__\smoke-e2e.test.ts` — NOVO (`npm run smoke`).
- `C:\Users\JOÃO\JSgame\FASE2_STREAMING_CONTINGENCIA.md` — NOVO, a decisão de design do streaming.
- `C:\Users\JOÃO\JSgame\.github\workflows\ci.yml` — escrito mas NÃO commitado (escopo workflow).

## 7. Deploy / ambiente

- `origin/main` = `9ecb9dd`. **Render auto-deploy OFF** → João faz Manual Deploy.
  **PROD ANTES do deploy**: bundle `index-DgHM1uaL.js`, uptime ~760s, prod TEM as keys
  (Cerebras/Groq/Gemini/Cloudflare). Confirmar bundle novo no ar antes de declarar streaming ativo.
- O painel do Render é um SPA com websocket vivo → os tools de automação do Chrome dão timeout
  (document_idle nunca chega). O agente NÃO consegue clicar o Manual Deploy; é ação do João.
- `npm run dev` (5173+3001) · `npx tsc --noEmit` · `npx vitest run` (confiar no EXIT) ·
  `npm run smoke`. Commit via Bash here-doc (PowerShell quebra aspas). Preview MCP cai com
  HMR — reiniciar.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar sem decidir):**
> Lê o `HANDOFF_2026-06-09_reviravolta-fases-0-1-2.md`, o `PLANO_REVIRAVOLTA.md` e o
> `CLAUDE.md` do JSgame. Primeiro confirma se o bundle do `9ecb9dd` subiu em prod (curl no
> `assets/index-*.js` + `/api/health` uptime — antes era `index-DgHM1uaL.js`). Depois me
> diz o estado e qual a próxima fase, na ordem do plano. Lembra: Fase 3 é GATED na minha
> medição do "piscar" no celular, e Fase 2e (tool-set trim) está pendente.

**Opções específicas:**

1. **Confirmar deploy + validar streaming:**
   > No JSgame, confirma se o deploy do `9ecb9dd` está no ar (bundle `assets/index-*.js`
   > mudou de `index-DgHM1uaL.js` + uptime resetou em `/api/health`). Se não subiu, me ajuda
   > a destravar (risco "deploy fantasma" — ver `feedback_evidencia_deploy.md`). Se subiu,
   > me guia pra eu sentir o streaming ("texto em ~1s") no celular.

2. **Fase 2e — enxugar tool-set por modo (fecha a Fase 2):**
   > Roda a Fase 2e do `PLANO_REVIRAVOLTA.md` no JSgame: enxuga o tool-set por modo
   > (exploração ~6 tools, combate o set de combate) + corta redundância do SYSTEM_PROMPT de
   > regras. Menos tokens = geração mais rápida + mais quota. Cuidado pra não tirar tool que o
   > modo precisa (ex: start_combat na exploração). Testa + commit + hash. tsc limpo, suíte verde.

3. **Fase 3 — render que não pisca (depois que eu medir):**
   > Eu medi o "piscar" no celular: [SUMIU / AINDA PISCA]. Roda a Fase 3 do
   > `PLANO_REVIRAVOLTA.md` conforme: se SUMIU, para (não toca no DOM). Se AINDA PISCA,
   > faz `combat-screen`/party com `update(state)` granular (key estável por id, selectors
   > puros testados) — cuidado com stale-state (proibido no CLAUDE.md). Valida no celular.

4. **Fase 4 — conteúdo (independe do flicker):**
   > Roda a Fase 4 do `PLANO_REVIRAVOLTA.md`: 5-8 adventure seeds estruturadas (objetivo +
   > vilão + beats + clímax) injetadas como trilhos, director server-side que avança clocks
   > deterministicamente, cliffhanger persistente no continue-card, XP por marco não-combate,
   > variedade de cold-open por prefab. Testa + commit + hash.

Começa com a Opção curta se não tiver certeza — eu confirmo o deploy e te proponho o caminho
na ordem do plano. Se já souber o que quer, vai direto numa das 4. (A Fase 3 precisa da sua
medição do "piscar" no celular antes.)
