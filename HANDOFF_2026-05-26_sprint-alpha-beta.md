# JSgame · Handoff — Sprint α+β (Indução + Mundo Vivo)

## 1. Estado atual

**2026-05-26 (noite, fim do dia).** Working tree limpo. **762 tests verde** (1 skipped). Prod LIVE em `https://jsgame-drpe.onrender.com` rodando commit `e8f726e` com cascade 4-providers (Cerebras → Gemini → Groq → Cloudflare). Próxima sessão deve executar **Sprint α + β** detalhado neste documento — 8 features novas em ~18h de trabalho autônomo.

## 2. O que foi feito nesta sessão

1. **Sprints A-E bug hunting** (commits `2032080..d5a0283`) — 5 commits: static analysis, property-based tests fast-check (+61 tests), telemetria observacional, adversarial probes framework, E2E smoke suite framework. 628→725 tests.
2. **Chat refactor magnífico** (`72a26c3`) — render incremental, auto-scroll inteligente, NarrationLog persistente, streaming typewriter, error card actionable, thinking indicator inline, auto-retry silencioso, "↓ N novas" badge flutuante. Coração do jogo.
3. **Fix echo duplicado do retry silent** (`8f20cca`) — suppressNextPlayerEcho counter no client.
4. **Endpoint /api/dm/errors + /api/dm/timeline + /api/dm/anomalies** (`b32e2a2`, `43f7bc6`, parte de Sprint C) — diagnostic completo por provider/categoria/hora.
5. **Cascade 4-providers Cerebras + Cloudflare** — Cerebras throw em response vazia + default model llama-3.3-70b (`dc9a57e`), telemetria effectiveProvider/lastFailedProvider (`af87362`, `a7b16f1`), Cloudflare habilitado em prod com env vars (token do user no Render, recomendo regenerar — foi colado no chat).
6. **Fix Cloudflare tool calls vazando como texto** (`796edbb`) + parser inline (`415b8b4`) — Llama 3.3 70B retorna tool_calls como JSON no text response, parser extrai pra toolCalls array. Resolve combate não disparar dados.
7. **Botões de ação pedem contexto** (`8f19b82`) — Explorar/Investigar/etc abrem `prompt()` pedindo detalhes antes de enviar pro DM. Reduz "DM não entendeu o que falo".
8. **Nova persona DM 'zueiro' 🎉** (parte de `415b8b4`) — 6ª persona: humor BR boca suja + NPCs absurdos + aventuras Indiana Jones, sem pessimismo Lovecraft.
9. **Reforço give_item no DM prompt** (`ef47136`) — 2 exemplos novos + regra explícita "SE NARRAR ITEM → CHAME give_item NO MESMO TURNO". Items agora vão pro inventário.
10. **Timeouts aumentados pra Cloudflare** (`e8f726e`) — CF provider 25s→45s, dm.ts 35s→55s, categorizer reconhece "operation was aborted" como timeout.

Total: **28 commits hoje**, 8 deploys manuais via Chrome MCP no Render, 134→762 tests.

## 3. Contexto técnico relevante

**Princípios estabelecidos** (manter na próxima sessão):
- TDD reverso quando aplicável: test que falha → fix → test passa.
- Commits atômicos por feature (1 feature = 1 commit). Push após cada feature OK.
- Deploy manual via Chrome MCP no Render dashboard (`https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg`) — clicar "Manual Deploy" → "Deploy latest commit". Render NÃO auto-deploya em push.
- Zero budget mantido: cascade Cerebras+Gemini+Groq+Cloudflare é 100% free tier. Não habilitar Anthropic/OpenAI sem confirmação. Vide memória `feedback_zero_budget.md`.
- Cloudflare Workers AI ativo em prod: token + account_id já estão nas env vars do Render (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Confirmar `/api/health` retorna `"hasCloudflare":true`.

**Padrões aplicáveis**:
- Tool nova no DM: declarar em `src/server/dm/prompts.ts` (DM_TOOLS array), implementar handler em `src/server/dm-tool-applier.ts` (switch case), validar input server-side, atualizar prompt com EXEMPLO concreto (sem exemplo o LLM esquece de usar).
- Provider novo: implementar interface `DMProvider`, throw em response vazia (mesma proteção Cerebras/Cloudflare), adicionar no `factory.ts`, telemetria via `effectiveProvider`/`lastFailedProvider` no CascadeProvider já cobre.
- Client refactor: NarrationLog é PERSISTENTE — nunca destruir entre renders. Outros painéis usam slot-based update incremental (vide `buildShell()` em `campaign-screen.ts`). Não voltar pra `innerHTML = ''` destrutivo.

**Tooling instalado**:
- `fast-check` (property-based), `ts-prune`, `madge`, `knip` (static), `vitest`.
- Stack: TS strict + `noUncheckedIndexedAccess`, `vitest.config.ts` força `singleFork:true` pra evitar SQLITE_BUSY.

**Provider config atual** (prod):
- `CEREBRAS_MODEL` env não setada → default `llama-3.3-70b` (mudou de `gpt-oss-120b` no commit `dc9a57e`).
- `GROQ_MODEL=llama-3.1-8b-instant` ou similar → factory.ts auto-corrige pra `llama-3.3-70b-versatile` (modelos pequenos não cabem prompt D&D).
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` configuradas em prod.
- `ANTHROPIC_API_KEY` NÃO configurada (zero budget).

**Endpoints diagnostic em prod**:
- `GET /api/health` — uptime + hasX flags + activeCampaigns
- `GET /api/dm/health` — last 100 narrations + success rate + providerCounts (auth-free)
- `GET /api/dm/errors?days=N` — breakdown por categoria + provider individual + top messages
- `GET /api/dm/anomalies?days=N` — alerts {severity, kind, value, baseline, message}
- `GET /api/dm/funnel?days=N` — conversão character_created → session_started → combat → won
- `GET /api/dm/timeline?days=N` — narrações por hora UTC (visualiza picos/uso real)

**Conhecimento adquirido**:
- Llama 3.3 70B no Cloudflare leva 20-45s pra responder prompt D&D completo (system 2-3K + 7 tools + memory). É lento mas confiável.
- DM esquece tools sem exemplos no prompt — sempre dar exemplo concreto.
- `prompt()` nativo do browser é UX aceitável pra pedir contexto rápido (mobile friendly).
- Auto-retry silencioso reduz aparição de erro mas gera echo duplicado — suprimir com counter no client.

## 4. Plano completo Sprint α+β

### Visão geral
8 features, ~18h trabalho, 2 dias estimados. Transforma JSgame de "tech demo" em D&D viciante. Ordem otimizada por dependências.

### SPRINT α — Indução + Loop Curto (~7.5h)

#### A.1 — Suggested Actions Chips · 3h · IMPACTO MÁXIMO
**Problema**: player vê narração e fica perdido, clica "Explorar" genérico → DM improvisa → narração desconexa.

**Solução**: DM sugere 2-4 ações contextuais à cena como chips clicáveis abaixo da narração. Player pode clicar OU digitar livre.

**Schema da tool**:
```ts
suggest_actions(actions: Array<{
  label: string;          // "Examinar o corpo"
  action: 'explore'|'investigate'|'talk'|'sneak'|'attack'|'cast'|'custom';
  hint?: string;          // "(Investigação)"
  details: string;        // sent as `details` quando clicado
}>) // 2-4 itens, server clamp
```

**Arquivos a tocar**:
- `src/server/dm/prompts.ts` — add tool no DM_TOOLS, add exemplo + regra "SEMPRE chame suggest_actions junto da narração de cena nova/após resolução"
- `src/server/dm-tool-applier.ts` — handler salva em `state.suggestedActions`
- `src/shared/types.ts` — `CampaignState.suggestedActions?: SuggestedAction[]`
- `src/server/campaign.ts` — limpa `suggestedActions` quando próxima narração chega
- `src/client/campaign/narration-log.ts` — renderiza chips abaixo da última narração
- `src/client/campaign/campaign-screen.ts` — click no chip → `takeAction(action, details)`
- `src/client/styles/campaign-core.css` — `.cn-suggested-chips`, hover/active states

**Edge cases**: multi-player vê todos chips, qualquer um clica; sumir em next state; LLM gera 6 → clamp 4; DM esquece → button "💡 Inspiração?" dispara `surprise_me`.

**Tests** (TDD reverso):
- Handler salva array no state
- Schema valida 2-4 itens
- Client renderiza N chips e dispatches click correto
- Sugestões limpam em próximo state update

#### A.4 — Voice Input · 1h · MOBILE KILLER
**Solução**: botão 🎙 ao lado do input livre. Web Speech API nativa, PT-BR, push-to-talk.

**Arquivos**:
- `src/client/voice-stt.ts` — NOVO wrapper sobre `SpeechRecognition` (`lang:'pt-BR'`, `continuous:false`, `interimResults:true`)
- `src/client/campaign/campaign-screen.ts` — botão mic, 3 estados (idle 🎙 / recording 🔴 / processing ⏳)
- Fallback gracioso: `typeof SpeechRecognition === 'undefined'` → esconde botão

**Edge cases**: TTS já rodando → bloqueia; reconhecimento falha → "🔇 não entendi"; user pode editar antes mandar.

#### A.2 — Item Rarity Visual · 2h · LOOT DOPAMINA
**Schema**:
```ts
InventoryItem.rarity?: 'comum'|'incomum'|'raro'|'muito-raro'|'lendario'
```

**CSS por tier** (cores D&D oficiais):
- comum: cinza claro (#a8a8a8), sem glow
- incomum: verde (#1eff00), glow leve
- raro: azul (#0070dd), glow médio
- muito-raro: roxo (#a335ee), glow forte
- lendário: laranja (#ff8000), pulsing

**Arquivos**:
- `src/shared/types.ts` — campo `rarity` opcional
- `src/server/dm/prompts.ts` — `give_item` schema aceita rarity + atualizar exemplos
- `src/server/dm-tool-applier.ts` — default `comum` se undefined
- `src/client/inventory/inventory-modal.ts` — classe CSS por rarity
- `src/client/styles/inventory.css` — `.inv-item.rarity-*` com border + box-shadow
- `src/dnd/item-icons.ts` (NOVO) — mapping `type → emoji` (`'arma' → ⚔`, `'consumivel' → 🧪`, etc)

**Animação**: novo item incomum+ ganha `@keyframes loot-burst` 0.6s ao append (rotate + scale).

#### A.3 — Inspirações D&D · 1.5h · ROLEPLAY VIRA MECÂNICA
**Mecânica PHB pág 125**: DM dá 1 inspiração por boa interpretação, player gasta antes de rolar pra advantage.

**Arquivos**:
- `src/shared/types.ts` — `CharacterSheet.inspirations: number` (default 0, max 3)
- `src/server/dm/prompts.ts` — nova tool `grant_inspiration(playerId, reason)` + exemplo + regra "MÁX 1 por sessão por player, NÃO dê de graça"
- `src/server/dm-tool-applier.ts` — handler incrementa, clamp max 3
- `src/server/combat.ts` (ou skill-check) — antes de roll d20, se `useInspiration` flag → força advantage + decrementa
- `src/client/campaign/skill-check-overlay.ts` — botão "🌟 Usar Inspiração (advantage)" se ≥1
- `src/client/campaign/campaign-screen.ts` — header PJ: 🌟×N ao lado do nome

**Edge cases**: max 3 (ignore extras), spent sem ter (server rejeita), cada player counter próprio.

### SPRINT β — Mundo Vivo (~10h)

#### B.2 — Achievements UI Completa · 2h · MOTIVAÇÃO VISÍVEL
**Problema**: 30+ achievements + counters tracking no backend, client NÃO mostra.

**Arquivos**:
- `src/client/campaign/achievements-modal.ts` — NOVO modal com tabs por categoria + progress bars
- `src/client/campaign/campaign-screen.ts` — botão 🏆 no header
- `src/dnd/achievements.ts` — adiciona campo `category?` por achievement
- Endpoint `/api/achievements/progress` já existe — confirmar formato
- Modal hidden achievements até unlock (mostra "🔒 ???")
- Animação unlock: `showAchievementToast` já existe, add som + confetti CSS

#### B.1 — NPC Roster Persistente · 3h · MUNDO LEMBRA
**Schema novo**:
```ts
interface NpcMemory {
  id: string;             // slug do nome
  name: string;
  archetype: string;
  attitude: 'amigavel'|'neutro'|'hostil'|'misterioso';
  firstMet: number;
  lastSeen: number;
  lastLocation: string;
  interactionCount: number;
  notes: string;
  relationship: number;   // -10 a +10
}
```

**Arquivos**:
- `src/server/persistence.ts` — nova tabela `npc_roster (campaign_id, id, ..., notes)`
- `src/server/dm-tool-applier.ts` — `npc_speaks` UPSERT roster + incrementa count + atualiza lastLocation
- `src/server/campaign.ts` — `buildNarrationPrompt` injeta top 5 NPCs recentes no context
- `src/server/routes/api.ts` — `GET /api/campaigns/:id/npcs`
- `src/client/campaign/npc-roster-modal.ts` — NOVO modal, lista + detalhes
- `src/client/campaign/campaign-screen.ts` — botão 👥 no header
- DM Prompt: "NPCs CONHECIDOS: {...}. Use nomes e tiques deles ao reaparecer."

**Edge cases**: mesmo nome em locais diferentes → ID = `{nome}-{primeiro local}`; roster > 50 → injeta só top 5; player mata NPC → notes `"MORTO"`, DM não traz de volta.

#### B.3 — Vendor/Shop · 3h · ECONOMIA REAL
**Schema da tool**:
```ts
open_shop(opts: {
  npcName: string;       // "Senhor Brogundo"
  shopType: 'arms'|'alchemy'|'general'|'magic';
  items: Array<{ name; type; rarity; priceGold; description }>;
  acceptsSell: boolean;
})
```

**Arquivos**:
- `src/server/dm/prompts.ts` — tool `open_shop` + exemplo
- `src/server/dm-tool-applier.ts` — handler salva em `state.openShop`
- `src/server/sockets/connection.ts` — handlers `buyItem(itemId)` + `sellItem(itemId)` — valida gold, atualiza inventory, atualiza gold
- `src/client/shop/shop-modal.ts` — NOVO modal compra/venda
- `src/client/campaign/campaign-screen.ts` — `state.openShop !== null` → abre modal
- `src/dnd/items.ts` (NOVO opcional) — catálogo base + preços padrão

**Edge cases**: gold insuficiente → disabled + tooltip; user fecha sem comprar → `state.openShop = null`; DM abre sem npcName → server rejeita; vender items equipados (de-equipa primeiro).

#### B.4 — Bonus Action Separate · 3h · D&D AUTÊNTICO (refactor maior)
**Schema novo**:
```ts
interface ActionEconomy {
  action: boolean;
  bonusAction: boolean;
  movement: number;     // pés restantes (default 30)
  reaction: boolean;    // 1 por rodada (não turno!)
}
```

**Arquivos**:
- `src/shared/types.ts` — `CombatState.actionEconomy: ActionEconomy` por participante
- `src/server/combat.ts` — `consumeAction(type)`, reset no start of turn (reaction reset por rodada)
- `src/server/dm/prompts.ts` — tools declaram `actionType: 'action'|'bonus'|'free'|'reaction'`
- `src/client/combat/combat-screen.ts` — UI mostra 4 economy items + grayifica consumidos
- `src/dnd/class-features.ts` — marca features `actionType`

**Risco**: refactor maior. Combate tem 50+ tests (`combat.test.ts`, `combat-actions.test.ts`, `concentration.test.ts`, etc) que precisam continuar verde. **Se apertar, ADIE pra Sprint γ futuro — não bloqueie deploy do α+β.**

**Edge cases**: caster nv1+ Action → bonus action limitado a cantrip; Action Surge dobra disponíveis; Quickened Spell converte; Disengage/Dash/Dodge consomem Action.

### Ordem de execução (otimizada)

```
Hora 0-3   A.1 Suggested actions       commit + push
Hora 3-4   A.4 Voice input              commit + push
Hora 4-6   A.2 Item rarity              commit + push
Hora 6-7.5 A.3 Inspirações              commit + push
Hora 7.5-8 DEPLOY α via Chrome MCP + validar /api/health
                          
Hora 8-10  B.2 Achievements UI          commit + push
Hora 10-13 B.1 NPC roster               commit + push
Hora 13-16 B.3 Vendor/Shop              commit + push
Hora 16-19 B.4 Bonus action (se der)    commit + push
Hora 19-20 DEPLOY β via Chrome MCP + smoke test prod
Hora 20    HANDOFF final + atualizar PLAYTEST_BUGS.md se achar bug
```

### Métricas de sucesso

| Métrica | Hoje | Meta pós-α+β |
|---|---|---|
| Player perdido sem opções | comum | nunca (A.1 chips) |
| Items recebidos esquecidos | provável | impossível (A.2 glow) |
| Roleplay bom recompensado | não | sim (A.3 inspirações) |
| Mobile typing friction | alta | baixa (A.4 voice) |
| NPCs reaparecem | nunca | sim (B.1) |
| Player vê progresso | só XP | 30+ achievements (B.2) |
| Gold tem uso | nada | comprar/vender (B.3) |
| Combat D&D autêntico | parcial | completo (B.4 se der tempo) |

## 5. Follow-ups sugeridos

**Bloqueante pra Sprint α+β rodar autônoma**: nenhum. Working tree limpo, tests verde, prod estável.

**Sprint γ (futuro, opcional)**:
- [ ] Sprint γ "D&D Profundo" — combat HUD mobile, quick-cast spells, spell components V/S/M, random encounters em viagem, identify magic items, reputação por facção (~10h)
- [ ] Quick wins de polish do plano detalhado (boss telegraph, crit screen shake, time-of-day visual, quest log progress bar, share highlight social, sound moeda, tooltip stats, avatar maker, hall of fame, persona-switch mid-campaign)
- [ ] Regenerar token Cloudflare em produção — user colou no chat sessão anterior, recomendo trocar por boa prática (Workers AI Read não é destrutivo mas zero risco preferível)

**Bugs latentes não resolvidos**:
- [ ] Cloudflare Llama 3.3 70B ocasionalmente retorna response vazia mesmo com retry — agora joga erro e cascade não tem fallback (é último). Mitigação atual: timeouts maiores. Próximo passo: parser melhor OU adicionar 5º provider grátis.
- [ ] `exactOptionalPropertyTypes` adiado em Sprint E (18+ erros TS em 10 arquivos, ~2-3h pra corrigir)
- [ ] Split `campaign.ts` (932 LOC) — 3 ciclos imports identificados em Sprint E

**Memórias relevantes**:
- `feedback_zero_budget.md` em `C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/` — João reagiu duro a sugestão de fallback Anthropic. Default a free tier sempre.

## 6. Arquivos-chave tocados nesta sessão

**Novos**:
- `BUG_HUNTING_FINDINGS.md` — inventário static analysis
- `HANDOFF_2026-05-26_sprints-A-E.md` — handoff anterior (manhã)
- `HANDOFF_2026-05-26_sprint-alpha-beta.md` — ESTE handoff
- `src/client/campaign/narration-log.ts` — coração do chat refactor (300+ LOC)
- `src/server/anomaly-detector.ts` — anomaly compute puro + I/O wrapper
- `src/server/dm-error-breakdown.ts` — categorizeError pure + timeline + breakdown
- `scripts/adversarial/probes.ts` + `run-probes.ts` + tests — Sprint D framework
- `scripts/e2e/scenarios.ts` + `runner.ts` + `impls/smoke-9.ts` + tests — Sprint B framework
- `src/dnd/__tests__/property-*.test.ts` (5 arquivos) — fast-check property tests

**Modificados (críticos pra α+β)**:
- `src/client/campaign/campaign-screen.ts` — refactor incremental, NarrationLog integration, promptAndTakeAction, suppressNextPlayerEcho
- `src/server/dm/prompts.ts` — exemplos give_item, regra explícita, persona Zueiro
- `src/server/dm/dm.ts` — telemetria effectiveProvider, timeouts maiores
- `src/server/dm/providers/cloudflare.ts` — parser inline tool_calls + timeout 45s
- `src/server/dm/providers/cascade.ts` — lastSuccessfulProvider + lastFailedProvider
- `src/server/dm/providers/cerebras.ts` — throw em empty + default llama-3.3-70b
- `src/server/routes/api.ts` — 3 endpoints diagnostic novos
- `src/dnd/dm-personality.ts` — persona Zueiro (6ª opção)

## 7. Deploy / ambiente

- **Último commit em prod**: `e8f726e` (Cloudflare timeout fix). Deploy validado: `/api/health` retornando `hasCloudflare:true` + uptime fresh.
- **Render NÃO auto-deploya** em push. Manual deploy via Chrome MCP em `https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg` → "Manual Deploy" → "Deploy latest commit". Padrão: depois de cada feature OU de cada sprint, fazer deploy.
- **Cascade provider ativo**: `cascade(cerebras→gemini→groq→cloudflare)` confirmado em `/api/dm/health`.
- **Tests**: 762/762 verde (1 skipped — flaky). Typecheck limpo.
- **Quirks**:
  - `vitest.config.ts` força `singleFork:true` — não mudar (SQLITE_BUSY)
  - Cloudflare retorna tool_calls inline no text (Llama 3.3 70B) — parser em `cloudflare.ts:parseInlineToolCalls` cobre
  - Echo do player duplica quando auto-retry silent dispara — counter `suppressNextPlayerEcho` em `campaign-screen.ts` cobre

## 8. 🎯 O que falar na próxima conversa

**Opção curta (executar tudo autônomo):**
> Lê `HANDOFF_2026-05-26_sprint-alpha-beta.md` na raiz do projeto. Quero que execute Sprint α + β COMPLETOS de forma autônoma, sem parar pra perguntar nada. Sem gastar dinheiro (zero budget, free tier only). Sem interação minha — só me avisa no fim com resumo. Segue a ordem de execução da seção 4 do handoff (A.1 → A.4 → A.2 → A.3 → deploy α → B.2 → B.1 → B.3 → B.4 → deploy β). Para cada feature: implementa + tests + commit atômico + push origin/main. Deploy via Chrome MCP no Render dashboard após cada sprint completar. Se B.4 (bonus action) ficar apertado de tempo, adia pra Sprint γ futuro — não bloqueia deploy do resto. Tests precisam manter 762+ verde sempre. Atualiza este handoff no final com o que foi feito + estado de prod.

**Opções específicas (executar só uma parte):**

1. **Só Sprint α autônomo (~8h):**
   > Lê `HANDOFF_2026-05-26_sprint-alpha-beta.md` seção 4 "SPRINT α — Indução + Loop Curto". Executa A.1 (suggested actions chips) + A.4 (voice input) + A.2 (item rarity) + A.3 (inspirações) de forma autônoma, na ordem dada. Commit atômico por feature, push origin/main, deploy via Chrome MCP no final. Zero budget. Sem interação minha. Tests 762+ verde. Atualiza handoff no fim.

2. **Só A.1 Suggested Actions (~3h, maior ROI single feature):**
   > Lê seção A.1 do `HANDOFF_2026-05-26_sprint-alpha-beta.md`. Implementa só essa feature: nova tool suggest_actions, handler salva em state.suggestedActions, prompt do DM com exemplo + regra "SEMPRE chame junto da narração", client renderiza chips abaixo da última narração no NarrationLog. Tests cobrindo handler + UI. Commit + push + deploy.

3. **Só Sprint β autônomo (~10h, assume α já feito):**
   > Lê `HANDOFF_2026-05-26_sprint-alpha-beta.md` seção 4 "SPRINT β — Mundo Vivo". Pré-requisito: Sprint α deve estar commitado/deployado. Executa B.2 (achievements UI) + B.1 (NPC roster) + B.3 (vendor/shop) + B.4 (bonus action se der tempo). Adia B.4 pra Sprint γ se ficar apertado. Mesmas regras: autônomo, zero budget, commits atômicos, deploy no fim.

4. **Investigar bug latente Cloudflare empty response:**
   > Cloudflare Llama 3.3 70B ocasionalmente retorna response vazia mesmo com retry no `dm.ts`. Hoje throw em `cloudflare.ts:parseInlineToolCalls` se text+toolCalls vazios → CascadeProvider failover. Mas Cloudflare é último — sem fallback. Investiga padrão dos casos (via `/api/dm/errors?days=7` filter category=empty_response provider=cloudflare). Propõe fix: parser melhor OU 5º provider grátis (Together AI? Mistral?). Sem habilitar pago sem confirmar.

Começa com a **Opção curta** se quiser executar tudo. Se quiser fatiar, vai na 1, 2 ou 3 nessa ordem (cada uma assume a anterior feita).

---

**Mensagem do João pra próxima sessão:**

> Queremos fazer sem parar todas as tarefas. Não podemos gastar dinheiro. Não haverá interação minha para conclusão da tarefa, então precisa fazer de forma autônoma.
