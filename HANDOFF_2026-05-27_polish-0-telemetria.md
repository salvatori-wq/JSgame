# Handoff — POLISH-0 Telemetria Honesta

## 1. Estado atual

Data: 2026-05-27. Working tree limpo, 1125 tests verdes, 2 commits aguardando deploy do Render:

- `204d27d` — fix telemetria honesta
- `fea7d85` — race coop fix + endpoint session-debug + telemetria pré-sessão

URL prod: https://jsgame-drpe.onrender.com

## 2. O que foi feito nesta sessão

1. **Diagnóstico das métricas em prod** — fetch `/api/dm/ux-funnel?days=7` revelou `timeToFirstNarrationMs p50=52s` com `withFirstNarration=3/21 sessions (14%)`. Achado central: a métrica de 52s NÃO media o que o nome dizia.

2. **Investigação do bug em telemetria** — em [src/server/sockets/connection.ts:215](src/server/sockets/connection.ts:215), `trackFirstNarrationIfNeeded()` era chamado APENAS dentro do `takeAction` handler, NUNCA dentro do `joinCampaign` após emit do cold open. Resultado: a métrica somava (cold open ~ms) + (leitura/decisão humana 5-30s) + (LLM da primeira ação 5-20s) = composto enganoso de 30-60s.

3. **Fix #1 — commit `204d27d`** — telemetria honesta:
   - `trackFirstNarrationIfNeeded()` agora chamado dentro do `joinCampaign` após emit do cold open (e no rejoin de sessão existente)
   - Novo evento `time_to_first_player_action` — primeira narração → primeira ação (engajamento humano)
   - Novo evento `time_to_first_dm_response` — primeira ação → resposta DM (latência LLM real)
   - `UxFunnelSummary` expandido com `withFirstPlayerAction`, `withFirstDmResponse`, `timeToFirstPlayerActionMs`, `timeToFirstDmResponseMs`
   - +3 tests, 1111 → 1114 verde

4. **Investigação do gap "withFirstNarration 14%"** — análise do código revelou 3 causas candidatas:
   - **Causa #1** (bug telemetria): coberto pelo fix `204d27d`
   - **Causa #2** (race coop): em campanhas coop, 2 players entram simultâneos, `enqueue` serializa `startSession`, vencedor emite cold open via `io.to(room)`, perdedor recebe via broadcast mas `response=null`. Antes do fix, só o vencedor trackava.
   - **Causa #3** (hipótese): sessões fantasma onde `session_started` emite sem usuário interagir — bot? F5 mid-load? coop join passivo? Precisa de dados pra confirmar.

5. **Fix #2 — commit `fea7d85`** — 3 mudanças:
   - **Race coop fix** em [connection.ts joinCampaign](src/server/sockets/connection.ts): `trackFirstNarrationIfNeeded()` movido pra fora do `if (response)`, agora cobre o caso `response=null`
   - **Endpoint `/api/dm/session-debug?days=2&limit=30`** — retorna per-session: `sessionId`, `userId`, `firstEventAt`, `lastEventAt`, `eventCount`, `kinds[]`, e `stage` classification (`started_only`/`narration_only`/`action_no_response`/`engaged_no_roll`/`rolled`/`combat`/`unknown`). Permite query manual pra confirmar Causa #3.
   - **Telemetria funil pré-sessão** — evento `home_loaded` (no `renderHome()`) e `prefab_clicked` (no click do prefab card), via `POST /api/metrics/track` com whitelist `CLIENT_ALLOWED_KINDS`. Mede quantos abrem homepage vs convertem.
   - +11 tests, 1114 → 1125 verde

Total: 2 commits, +14 tests, 0 regressões.

## 3. Contexto técnico relevante

- **Métrica `time_to_first_narration` agora mede latência REAL do cold open** (~ms na maioria dos casos). Para sessões coop sem cold open (sessão 2+), pode medir latência do LLM (5-20s).
- **`time_to_first_player_action`** vai mostrar engajamento humano. Esperado: 5-30s p50 (jogador lendo + decidindo).
- **`time_to_first_dm_response`** vai isolar latência LLM pura da primeira ação. Esperado: 3-15s p50 dependendo do provider ativo.
- **`home_loaded` e `prefab_clicked`** são os ÚNICOS eventos que o cliente pode emitir (whitelist server-side em [routes/api.ts CLIENT_ALLOWED_KINDS](src/server/routes/api.ts)). Outros tipos retornam 400.
- **Endpoint `/api/metrics/track`** é fire-and-forget no client (`keepalive: true`), nunca bloqueia UX.
- **Stage classifier** é heurístico mas determinístico — ver ordem em [session-debug.ts classifyStage()](src/server/session-debug.ts) (combat > rolled > engaged_no_roll > action_no_response > narration_only > started_only > unknown).

## 4. Fix/padrão central

Pattern reaproveitável de telemetria sem inflação de métrica composta:

```ts
// ANTES (errado — só trackava no ponto final do composto):
socket.on('takeAction', async () => {
  const response = await dm.narrate(...);
  io.to(room).emit('dmNarration', response);
  trackFirstNarrationIfNeeded(); // ← media TUDO desde joinCampaign
});

// DEPOIS (correto — trackagens separadas por etapa):
socket.on('joinCampaign', async () => {
  io.to(room).emit('dmNarration', coldOpen); // cold open instantâneo
  trackFirstNarrationIfNeeded(); // ms desde joinCampaign
});
socket.on('takeAction', async () => {
  trackFirstPlayerActionIfNeeded(); // ms desde first_narration
  const startTs = Date.now();
  const response = await dm.narrate(...);
  io.to(room).emit('dmNarration', response);
  trackFirstDmResponseIfNeeded(startTs); // ms desde takeAction (LLM puro)
});
```

Cada etapa do funil = um evento dedicado com latência isolada. Soma dá o composto, mas cada parte fica diagnosticável.

## 5. Follow-ups sugeridos

Nenhum bloqueante. Sugestões pra próxima sessão (em ordem de prioridade):

- [ ] **Validar deploy** — `curl https://jsgame-drpe.onrender.com/api/dm/ux-funnel?days=2`. Confirmar que JSON inclui `withFirstPlayerAction`, `timeToFirstPlayerActionMs`, `timeToFirstDmResponseMs`. Se não, deploy ainda pendente.
- [ ] **Query session-debug** — `curl https://jsgame-drpe.onrender.com/api/dm/session-debug?days=7&limit=50`. Analisar `byStage` pra ver onde o funil sangra. Causa #3 confirmada se há muitos `started_only`.
- [ ] **Aguardar 24-48h** pra baseline real do funil novo com dados pós-fix.
- [ ] **Decidir Sprint POLISH α/β/γ** com base no funil real:
  - `timeToFirstNarrationMs p50` >2s → bug no cold open (improvável)
  - `timeToFirstPlayerActionMs p50` >30s → cold open confuso / chips fracos → Sprint α
  - `timeToFirstDmResponseMs p50` >10s → LLM lento → Sprint γ (streaming, pre-warm)
  - `withFirstPlayerAction / withFirstNarration` <50% → muita gente vê cena mas não interage → Sprint α (chamada à ação)
  - Tudo bom → Sprint β (combate) ou ζ (pixels)
- [ ] **Sprint ζ "Cada Pixel Conta"** (~4h, independente de baseline) — polish UX puramente visual, ROI rápido
- [ ] **Configurar `MISTRAL_API_KEY` no Render** (pendente desde γ.4, não-bloqueante)

## 6. Arquivos-chave tocados

- `src/server/sockets/connection.ts` — 3 helpers de telemetria + race coop fix
- `src/server/ux-funnel.ts` — UxFunnelSummary expandido com 4 novos campos
- `src/server/session-debug.ts` — NOVO — per-session debug com stage classifier
- `src/server/routes/api.ts` — endpoints GET /api/dm/session-debug + POST /api/metrics/track
- `src/server/metrics.ts` — 4 novos kinds (time_to_first_player_action, time_to_first_dm_response, home_loaded, prefab_clicked)
- `src/client/api.ts` — trackClientMetric helper (fire-and-forget)
- `src/client/main.ts` — emit home_loaded em renderHome + prefab_clicked no click
- `src/server/__tests__/ux-funnel.test.ts` — +3 tests
- `src/server/__tests__/session-debug.test.ts` — NOVO — 11 tests cobrindo todos stages

## 7. Deploy / ambiente

- Commits a deployar: `204d27d` (POLISH-0 fix telemetria) + `fea7d85` (POLISH-0 race+debug+pré-sessão)
- João fez deploy manual destravando 3 commits anteriores (1bf8fdc, b6f6ce0, cc0c8fa) que estavam acumulados — agora em prod
- Auto-deploy do Render ATIVO no main
- URL prod: https://jsgame-drpe.onrender.com
- Render dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Free tier: Cerebras/Gemini/Groq/Cloudflare cascade — Mistral pendente (`MISTRAL_API_KEY` no painel)
- Anthropic NÃO habilitado (memória `feedback_zero_budget`)

## 8. 🎯 O que falar na próxima conversa

**Opção curta (validar deploy + decidir sprint):**

> Lê `HANDOFF_2026-05-27_polish-0-telemetria.md`. Faz curl em `/api/dm/ux-funnel?days=2` e `/api/dm/session-debug?days=7&limit=50` em prod. Reporta os números — `withFirstNarration`, `withFirstPlayerAction`, `withFirstDmResponse`, `timeToFirst*Ms`, `byStage`. Compara com hipóteses de causa #3 do handoff e propõe qual Sprint POLISH atacar com base nos dados reais.

**Opções específicas:**

1. **Executar Sprint POLISH α "Primeira Impressão" (~8h):**
   > Lê `STRATEGY_POLISH_GERAL.md` seção Sprint α. Execute autônomo os 6 fixes: login fallback anônimo, home hierarquia, randomize wizard, tutorial overlay, pre-warm LLM, thinking indicator rico. Tests sempre verde. Commit `feat(polish-α)`. Push.

2. **Executar Sprint POLISH β "Combate sem Atrito" (~10h):**
   > Lê `STRATEGY_POLISH_GERAL.md` seção Sprint β. Execute autônomo os 7 fixes. Tests verde. Commit `feat(polish-β)`. Push.

3. **Executar Sprint POLISH ζ "Cada Pixel Conta" (~4h):**
   > Lê `STRATEGY_POLISH_GERAL.md` seção Sprint ζ. Execute os 6 fixes: microinteractions universais, copy review pass, loading states consistentes, transitions entre rotas, polish visual final, audit em 5 viewports. Tests verde. Commit `feat(polish-ζ)`. Push.

4. **Atacar follow-up específico de POLISH-0:**
   > Analisa os dados de session-debug em prod. Se Causa #3 confirmada (muitos `started_only`), proponha fix cirúrgico (ex: filtro de bots, dedup auto-rejoin, etc).

Começa com a Opção curta se não tiver certeza — eu valido o deploy + funil + proponho caminho informado.
