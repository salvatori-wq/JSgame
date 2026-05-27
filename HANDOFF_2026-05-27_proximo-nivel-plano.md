# Handoff — Sessão "Plano Próximo Nível" (POLISH completo + dock mobile + estratégia nova)

## 1. Estado atual

Data: 2026-05-27. Working tree limpo, 1179 tests verdes, plano POLISH original 6/6 cumprido, plano novo "Próximo Nível" documentado em `STRATEGY_PROXIMO_NIVEL.md`. Nenhuma pendência bloqueante — próxima sessão começa o Sprint η do plano novo.

## 2. O que foi feito nesta sessão

1. **POLISH-0 Telemetria Honesta** — commits `204d27d` + `fea7d85`. Fix do bug que inflava `time_to_first_narration` p50=52s; novos eventos `time_to_first_player_action` e `time_to_first_dm_response`; endpoint `/api/dm/session-debug` com stage classifier (7 stages); telemetria pré-sessão `home_loaded` + `prefab_clicked`.
2. **POLISH ζ "Cada Pixel Conta"** — commit `da57b28`. `_polish.css` NOVO com microinteractions globais (hover -1px, active scale 0.97), scrollbar custom, cta-glow, focus-visible, skeleton shimmer, route-fade-in entre rotas, tokens visuais extras.
3. **POLISH ε "Acessibilidade & Resiliência"** — commit `6f53f4c`. `a11y.ts` NOVO: MutationObserver aplica ARIA auto, ESC fecha 6+ modais, error boundary global; contrast `--ink-faint` #5a4e3e→#867758 (passa WCAG AA); 7 empty states com tom temático.
4. **POLISH β "Combate sem Atrito"** — commit `8205cbb`. `condition-icons.ts` NOVO (15 PHB conditions com emoji + tooltip mecânico); `combat-polish.css`: HP transitions narrativas (death cross overlay, stagger pulse, damage tick), combat log colorido por tipo, end-turn chip pulsante, initiative refino, damage numbers polish.
5. **POLISH α "Primeira Impressão"** — commits `28c86ab` + `adeb270`. Login fallback anônimo dominante + cta-glow, home prefab CTA com glow, wizard "🎲 Randomizar tudo" (`randomize.ts` NOVO), thinking indicator rico com 12 dicas + 4 fases de tempo (`thinking-tips.ts`), tutorial inline 1ª vez no skill check overlay.
6. **POLISH γ "Vida da Cena"** — commit `e621f27`. Error recovery rico END-TO-END (server classifica 6 kinds, propaga errorMeta via socket, client `appendDegradedNarration` com toggle "ver detalhes técnicos" + retry inteligente); scene transition pulse quando location muda.
7. **POLISH δ "Coop Sem Drama"** — commit `570914c`. `connection-status.ts` NOVO: banner sticky top com 3 estados (hidden/reconnecting/failed) + "Tentar agora" após 15s; turn indicator visual rico em coop (enemy/aliado/aguardando).
8. **FIX URGENTE Mobile Dock Uber + Morte Visível** — commit `c779ae5`. Após playtest do João: `m-camp-dock.css` NOVO força flex 100dvh em portrait-narrow com narration scrollável interno + actions/chat sticky bottom sempre acessíveis; `body.is-player-down` vinheta vermelha pulsante quando HP=0; `body.is-player-dead` tombstone overlay tela cheia em 3 falhas death save.
9. **Plano "Próximo Nível" documentado** — `STRATEGY_PROXIMO_NIVEL.md` (não comitado ainda): 8 sprints temáticos (η/θ/ι/κ/λ/μ/ν/ξ, ~53h total) cobrindo 4 eixos: fidelidade D&D 5e, engajamento, intuitividade, eficiência. Veja seção 8 deste handoff.

Total: 11 commits feature + 4 commits docs nesta sessão. 1111 → 1179 tests verde (+68), zero regressões.

## 3. Contexto técnico relevante

- **Plano POLISH original 6/6 cumprido** (α, β, γ, δ, ε, ζ + POLISH-0 telemetria). Pendências menores documentadas no Sprint ξ do plano novo: ε.6 IndexedDB, α.5 pre-warm LLM, ζ.6 audit screenshots, β.1 action layer unification, e 3 bugs antigos (BUG-002/004/005).
- **Padrão "pegada Uber" validado pelo João**: em mobile portrait, `.camp-screen` vira flex column 100dvh, header sticky top, narration cresce com `flex:1` e scroll interno, main-content (combat ou actions) + chat-bar viram sticky bottom. Validado por DOM inject: viewport 812h cabe TUDO sem overflow externo. CSS-only em `src/client/styles/m-camp-dock.css`.
- **Pattern crítico — drama visual em eventos do PJ**: `body.is-player-down` aplicado via `updateMainContent` quando `character.currentHp <= 0`. CSS `::before` vinheta vermelha 80px+160px inset box-shadow pulsando 1.8s. Quando `deathSaveFailures >= 3`, `body.is-player-dead` ativa `::after` overlay tombstone tela cheia com backdrop-blur. Player nunca mais "morre sem perceber".
- **Telemetria nova já em prod e validada retrospectivamente**: 17 de 21 sessões em `started_only` confirmaram que o bug original do `trackFirstNarrationIfNeeded` (chamado só no `takeAction` antes) era real. Próxima janela 24-48h vai mostrar funil pós-fix.
- **Error recovery rico expõe metadata estruturada**: server `classifyError(msg)` retorna 6 kinds; `makeGracefulFallback` popula `errorMeta { providersAttempted, lastProvider, errorKind, errorMsg, canRetry }`; client renderiza card com toggle expansível. `canRetry=false` apenas pra auth — outros sempre permitem retry.
- **Memórias persistentes do João**: `feedback_zero_budget.md` (free tier only, perguntar antes de qualquer custo), `feedback_interface_alma.md` NOVA nesta sessão (UX > engenharia, eventos críticos drama visual, pegada Uber validada).
- **Deploy travado intermitente no Render**: 3x nesta sessão precisou deploy manual no painel. Auto-deploy parece falhar em sequências longas de push. Não é problema do código (typecheck + build local sempre OK).
- **Preview tool screenshot bugado** nesta sessão: timeouts consistentes mesmo com animações pausadas. Snapshot/inspect funcionam — usar esses pra validação visual quando possível.

## 4. Fix/padrão central

Pattern "drama visual obrigatório em eventos críticos do PJ" — aplicado em `updateMainContent`:

```ts
// src/client/campaign/campaign-screen.ts ~linha 757
private updateMainContent(): void {
  if (!this.slots) return;
  const isCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
  this.shellEl?.classList.toggle('is-in-combat', !!isCombat);
  // Toda mudança crítica do PJ vira class no body → CSS aplica drama visual.
  // Pattern reaproveitável: nunca deixar evento importante invisível.
  document.body.classList.toggle('is-player-down', !!this.character && this.character.currentHp <= 0);
  document.body.classList.toggle(
    'is-player-dead',
    !!this.character && this.character.currentHp <= 0 && (this.character.deathSaveFailures ?? 0) >= 3,
  );
  // ...
}
```

CSS correspondente em `_polish.css`:
```css
body.is-player-down::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9000;
  box-shadow: inset 0 0 80px rgba(200, 30, 30, 0.65), inset 0 0 160px rgba(120, 20, 20, 0.45);
  animation: player-down-pulse 1.8s ease-in-out infinite;
}

body.is-player-dead::after {
  content: '🪦  Você morreu  🪦';
  position: fixed;
  inset: 0;
  z-index: 9900;
  /* tela cheia, backdrop blur, narração épica */
}
```

Replicar pra: level up (drama dourado), crit do PJ (flash branco rápido), boss kill (vinheta dourada), quest concluída (chip flutuante).

## 5. Follow-ups sugeridos

Nenhum bloqueante. Todas as opções abaixo são do plano novo `STRATEGY_PROXIMO_NIVEL.md`:

### Sprints novos do plano (ordem recomendada)
- [ ] **Sprint η — "Mestre joga D&D de verdade" (~10h)** — feats database, traits/ideals/bonds, ASI em nv 8/12/16/19, advantage/disadvantage genérico, prepared spells UI, saving throws explícitos. Maior ROI conceitual.
- [ ] **Sprint ξ — "Pendências acumuladas" (~4h)** — limpa terreno antes de feature grande. IndexedDB, pre-warm, audit, BUG-002/004/005.
- [ ] **Sprint κ — "Onboarding de Mestre" (~6h)** — tutorial Duolingo-style, glossário com botão "?", hints contextuais, modo treino.
- [ ] **Sprint λ — "Combate Cinematográfico" (~7h)** — action layer unification, spell visual effects, enemy AI variada, boss multi-fase, crit narrado dramaticamente.
- [ ] **Sprint θ — "Inventário Vivo" (~8h)** — weapons/armors database, magic items tier 1, rarity tiers no shop, equip slots claros.
- [ ] **Sprint ι — "Sessão Convida Voltar" (~7h)** — highlights compartilháveis, preview no home, cemitério com cause of death, milestones visuais.
- [ ] **Sprint μ — "Mestre Não Falha" (~6h)** — streaming SSE, cache de prompts, provider health monitoring auto-swap.
- [ ] **Sprint ν — "Coop de Verdade" (~5h)** — presence indicators, chat polish, lobby personality preview.

### Decisões grandes pra confirmar antes (D1-D6)
- [ ] **D1**: Sprint η.1 feats — full PHB (~40) ou top 20? Recomendação: top 20 inicial.
- [ ] **D2**: Sprint θ.6 encumbrance — default on ou off? Recomendação: toggle, default OFF.
- [ ] **D3**: Sprint μ.1 streaming — refactor DMProvider interface? Recomendação: método opcional, providers sem suporte continuam não-stream.
- [ ] **D4**: Sprint κ.1 tutorial — bloqueante ou dismissable? Recomendação: dismissable.
- [ ] **D5**: Sprint ι.1 highlight share — OG image dinâmica? Recomendação: começar SEM, adicionar só se viralizar.
- [ ] **D6**: Sprint λ.2 spell vfx — CSS-only ou Canvas? Recomendação: CSS-only.

### Operacionais
- [ ] Commitar `STRATEGY_PROXIMO_NIVEL.md` + este handoff + atualizar CLAUDE.md
- [ ] Você fazer deploy manual no Render com último commit `c779ae5` quando puder
- [ ] Validar mobile dock em device real (mobile portrait) jogando 5-10 min
- [ ] Aguardar 24-48h baseline real do funil novo POST-deploy

## 6. Arquivos-chave tocados

### Plano novo (criado nesta sessão, não commitado)
- `C:/Users/JOÃO/JSgame/STRATEGY_PROXIMO_NIVEL.md` — plano dos 8 sprints novos com hipóteses, métricas e cronograma
- `C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/feedback_interface_alma.md` — memória nova sobre UX prioritária

### POLISH (commits desta sessão)
- `C:/Users/JOÃO/JSgame/src/server/sockets/connection.ts` — 3 helpers telemetria + race coop fix + propaga errorMeta em emits
- `C:/Users/JOÃO/JSgame/src/server/dm/dm.ts` — classifyError + makeGracefulFallback com errorMeta + getProviderListSafe
- `C:/Users/JOÃO/JSgame/src/server/dm/providers/cascade.ts` — getter público providerNames
- `C:/Users/JOÃO/JSgame/src/server/ux-funnel.ts` — 4 campos novos (withFirstPlayerAction etc)
- `C:/Users/JOÃO/JSgame/src/server/session-debug.ts` — NOVO — per-session stage classifier
- `C:/Users/JOÃO/JSgame/src/server/routes/api.ts` — endpoints /api/dm/session-debug + POST /api/metrics/track
- `C:/Users/JOÃO/JSgame/src/server/metrics.ts` — 6 kinds novos (player_action + dm_response + home_loaded + prefab_clicked + 2)
- `C:/Users/JOÃO/JSgame/src/shared/types.ts` — dmNarration aceita mood='error' + errorMeta
- `C:/Users/JOÃO/JSgame/src/client/styles/_polish.css` — microinteractions globais + tokens extras + scrollbar custom + cta-glow + scene transition + error recovery card + drama morte
- `C:/Users/JOÃO/JSgame/src/client/styles/combat-polish.css` — NOVO — HP transitions narrativas + condition pills + initiative refino + log colorido + end-turn chip
- `C:/Users/JOÃO/JSgame/src/client/styles/m-camp-dock.css` — NOVO — pegada Uber mobile portrait
- `C:/Users/JOÃO/JSgame/src/client/a11y.ts` — NOVO — MutationObserver ARIA + ESC global + error boundary
- `C:/Users/JOÃO/JSgame/src/client/connection-status.ts` — NOVO — reconnect banner 3 estados
- `C:/Users/JOÃO/JSgame/src/client/combat/condition-icons.ts` — NOVO — 15 PHB conditions + tooltip mecânico
- `C:/Users/JOÃO/JSgame/src/client/combat/combat-screen.ts` — condition icons wire + log classifier + end-turn chip + turn indicator coop rico
- `C:/Users/JOÃO/JSgame/src/client/campaign/narration-log.ts` — appendDegradedNarration + thinking tip + getThinkingPhase
- `C:/Users/JOÃO/JSgame/src/client/campaign/campaign-screen.ts` — body.is-player-down/dead toggle + is-in-combat + scene transition + errorMeta wire-up
- `C:/Users/JOÃO/JSgame/src/client/campaign/thinking-tips.ts` — NOVO — 12 dicas + 4 fases
- `C:/Users/JOÃO/JSgame/src/client/campaign/skill-check-overlay.ts` — tutorial inline 1ª vez + localStorage flag
- `C:/Users/JOÃO/JSgame/src/client/character-creation/randomize.ts` — NOVO — randomizeWizardState (24 names, 12 surnames)
- `C:/Users/JOÃO/JSgame/src/client/character-creation/wizard.ts` — botão "🎲 Randomizar tudo" no header
- `C:/Users/JOÃO/JSgame/src/client/auth/login-screen.ts` — anon fallback dominante com cta-glow
- `C:/Users/JOÃO/JSgame/src/client/api.ts` — trackClientMetric helper
- `C:/Users/JOÃO/JSgame/src/client/main.ts` — emit home_loaded + prefab_clicked + route-fade-in + install banner + install a11y
- `C:/Users/JOÃO/JSgame/src/client/styles/_tokens.css` — --ink-faint contrast fix (WCAG AA)

### Tests novos
- `src/server/__tests__/dm-error-recovery.test.ts` (14 tests) — classifyError + makeGracefulFallback
- `src/server/__tests__/session-debug.test.ts` (11 tests) — stage classifier
- `src/client/__tests__/a11y.test.ts` (11 tests) — ARIA + escape + error boundary
- `src/client/character-creation/__tests__/randomize.test.ts` (9 tests) — wizard randomize
- `src/client/campaign/__tests__/thinking-tips.test.ts` (8 tests) — 4 fases + 12 dicas
- `src/client/campaign/__tests__/skill-check-tutorial.test.ts` (5 tests) — localStorage flag
- `src/client/combat/__tests__/condition-icons.test.ts` (7 tests) — 15 PHB conditions

## 7. Deploy / ambiente

- Último commit local: `c779ae5` (fix mobile dock + morte visível)
- Último commit em prod: ainda **a confirmar** — auto-deploy do Render travou múltiplas vezes nesta sessão. Você precisa fazer deploy manual no painel pra subir os 15+ commits acumulados.
- URL prod: https://jsgame-drpe.onrender.com
- Render dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Free tier: Cerebras / Gemini / Groq / Cloudflare cascade ativo · Mistral pendente (`MISTRAL_API_KEY` no painel)
- Anthropic NÃO habilitado (memória `feedback_zero_budget`)
- Backend porta 3001, frontend 5173. `npm run dev` sobe os dois (já estava rodando nesta sessão).
- Quirk: free tier do Render dorme após ~15 min inativo. Primeiro request acorda — uptime baixo NÃO significa deploy novo.

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar com plano novo lido):**

> Lê `STRATEGY_PROXIMO_NIVEL.md` e `HANDOFF_2026-05-27_proximo-nivel-plano.md` na raiz do JSgame. Sessão anterior completou o plano POLISH original 6/6 (15+ commits) e escreveu plano novo de 8 sprints (η/θ/ι/κ/λ/μ/ν/ξ, ~53h). Me confirma as decisões D1-D6 da seção 8 do strategy e propõe começar por onde — recomendação atual é Sprint η ou Sprint ξ. Considere também a memória `feedback_interface_alma.md` (UX é prioritária, dock Uber validado, drama visual em eventos críticos do PJ).

**Opções específicas:**

1. **Executar Sprint η "Mestre joga D&D de verdade" (~10h, recomendado):**
   > Lê `STRATEGY_PROXIMO_NIVEL.md` seção Sprint η. Começa pelo η.1 (database de feats top 20 PHB em src/dnd/feats.ts). Execute autônomo: feats com prerequisite + effect text + mecânica server-side onde aplicável; wire no wizard step "ASI ou Feat?"; tests cobrindo cada feat. Tests sempre verde (1179+). Commit `feat(dnd-η.1): feats top 20 PHB`. Push. Pode ir.

2. **Executar Sprint ξ "Pendências acumuladas" (~4h, limpa antes de escalar):**
   > Lê `STRATEGY_PROXIMO_NIVEL.md` seção Sprint ξ. Execute autônomo os 6 fixes pendentes: ε.6 IndexedDB session resilience, α.5 pre-warm LLM, ζ.6 audit 5 viewports, BUG-002 tutorial rejoin (`GAMEPLAY_ROADMAP.md` §1.1), BUG-004 spell slots nv 6-9 (`GAMEPLAY_ROADMAP.md` §1.3), BUG-005 pact magic short rest. Tests verde. Commits separados ou batched. Push.

3. **Validar funil pós-deploy primeiro:**
   > Curl `https://jsgame-drpe.onrender.com/api/dm/ux-funnel?days=2` e `/api/dm/session-debug?days=7&limit=50`. Reporta os números reais — withFirstNarration vs withFirstPlayerAction vs withFirstDmResponse, byStage breakdown, narration_error rate. Compara com hipóteses do `HANDOFF_2026-05-27_proximo-nivel-plano.md` seção 7 (deploy talvez não tenha subido ainda). Se baseline saudável, partir pra Sprint η; se ainda problemas, propor fix antes.

4. **Playtest qualitativo da mobile dock + morte dramática:**
   > Inicia preview, viewport 360×740, simula sessão de combate. Valida visualmente: (a) dock Uber em mobile portrait — chat e actions sempre acessíveis sem scroll externo, (b) `body.is-player-down` vinheta vermelha quando HP=0, (c) tombstone overlay quando 3 falhas death save. Reporta o que funciona e o que ainda parece fraco. Commit `c779ae5` é a referência.

5. **Discutir decisões D1-D6 antes de codar:**
   > Lê `STRATEGY_PROXIMO_NIVEL.md` seção 8 (Decisões grandes). São 6 decisões que vão moldar o plano. Me apresenta cada uma em 1 linha + recomendação, eu confirmo/altero. Depois disso decidimos por onde começar.

Começa com a Opção curta se não tiver certeza — eu leio o plano + handoff + memória e te proponho caminho informado. Se já souber o que quer atacar, vai direto numa das 5.
