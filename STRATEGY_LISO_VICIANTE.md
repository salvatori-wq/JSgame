# JSgame · Estratégia "Liso & Viciante"

> Filosofia: **A IA é o coração. Tudo orbita em torno de fazer o Mestre IA responder rápido, narrar bem, e o player querer voltar.** Funcionalidades simples mas bonitas e intuitivas. Toda nova feature constrói EM CIMA do que α+β plantaram, sem refazer.

## 1. Diagnóstico — Onde o jogo trava hoje

Mesmo com Sprint α+β completo, existem 7 atritos que matam a sensação de "viciante":

| Atrito | Sintoma | Impacto |
|---|---|---|
| **1. Latência DM 20-45s** | Player espera, dispersa, abre outra aba | Bloqueia loop curto |
| **2. Echo "Player → ação" chega depois da narração** | Visual confuso, parece bug | Quebra confiança no jogo |
| **3. Onboarding: wizard 5 passos** | First-run abandona antes de jogar | Conversão baixa |
| **4. Sem "loot screen" pós-combate** | Items entram silenciosos no inventário | Sem dopamina de recompensa |
| **5. β.4 só V1 (display)** | Player pode atacar 5× num turno | Não é D&D real |
| **6. Cloudflare empty response sem fallback** | Último provider sem rede de segurança | DM "vazio" mata sessão |
| **7. Zero retenção entre sessões** | Player termina sessão 1, nunca volta | LTV = 0 |

**O coração precisa bater rápido (1+6), o jogo precisa ser intuitivo (3), o loop curto precisa dopamina (4+5), e o player precisa ter motivo pra voltar (7).**

## 2. Princípios não-negociáveis

1. **IA = coração**: cada minuto de dev investido pode ser comparado a "essa mudança fez a IA responder melhor / mais rápido / mais coerente?". Se não, deprioriza.
2. **Simples e bonito > complexo e feio**: rather 1 feature polida do que 5 meio-prontas. Toda nova UI deve ter animação 60fps, mobile-first, escapeHtml safe, e respeitar prefers-reduced-motion.
3. **Interligar α+β, não recriar**: cada nova feature de Sprint γ+ deve REUTILIZAR primitivas existentes (NarrationLog, modal-overlay, achievements counters, NPC roster) — não criar paralelo.
4. **Zero budget**: free tier sempre. Cerebras/Gemini/Groq/Cloudflare já cobrem.
5. **TDD + commit atômico**: 1 feature = tests + commit + push. Tests verde sempre.

## 3. Plano — 4 Sprints temáticos (~50h total)

### Sprint γ "LISO" (~12h) — Estabilidade + completar β.4

> **Objetivo**: cada sessão hoje em prod deve rodar sem nenhum bug visível. Loop combate→exploração→combate sem regressão.

#### γ.1 — β.4 V2: Action Economy mecânico (3h)
Continua do V1 de β.4. Hook `consumeActionEconomy()` em:
- `combat.ts`: attack/dodge/dash/disengage → consome action
- `spells-engine.ts`: castSpell → consome action OU bonus dependendo de `spell.castingTime`
- `class-features-engine.ts`: rage/second-wind → bonus; action-surge → grant +1 action
- Bloquear retorna `false` quando slot=false → handler aborta com toast "Já gastou ação esse turno"
- UI desabilita botões cujo slot=false (não só visual)

Tests: +15 (attack rejeita 2ª, bonus-then-action OK, action-surge dobra, dash consome action+movimento).

#### γ.2 — Race condition echo player (1h)
Fix: server emite `dmNarration { speaker: "▶ Player" }` ANTES de chamar LLM. Hoje vai inline no fluxo, e se LLM responde rápido o order se inverte. Mudar pra emit pre-LLM síncronamente.

#### γ.3 — Cloudflare empty response fallback (2h)
Hoje quando CF retorna `{ text: "", toolCalls: [] }` joga erro mas é o último provider — sem fallback. Solução:
- Adicionar 5º provider grátis: **Mistral free tier** (`mistral-small-latest`, 1 req/s, free)
- OU implementar **"degraded narration mode"**: server gera narração canned baseada em playerAction (regex match + template) — quebra imersão mas não trava o jogo

Tests: +5 (empty → fallback → degraded; cascade triggers Mistral).

#### γ.4 — Mobile audit + viewport fix (3h)
- Abre cada modal em 360px e 414px (iPhone SE/12) — verifica overflow
- Skill-check overlay: tem botão Inspiração que pode quebrar layout?
- Shop modal: grid auto-fit 240px pode causar 1-column ugly em mobile (verificar)
- Achievements modal: 5 abas em mobile vira scroll horizontal feio
- Tests: snapshot tests em jsdom-like, ou apenas review manual com CSS audit

#### γ.5 — Telemetria UX (2h)
- Métricas novas no `metrics_events`: `time_to_first_narration_ms`, `time_to_skill_check_ms`, `session_duration_ms`, `bounce_on_wizard_step`, `dm_silence_seconds`
- Endpoint `/api/dm/ux-funnel?days=7` mostra: wizard completion rate, sessões abandonadas no minuto X, latência média DM por provider

#### γ.6 — Smoke test E2E real (1h)
- Roda 5 cenários completos em prod via script: create PJ → start session → take 3 actions → enter combat → win → loot received. Falha = exit code 1, alerta.
- Pode rodar como CronCreate diário.

**Deploy γ → prod via Chrome MCP**. Tests: 863 → ~895 verde.

---

### Sprint δ "CORAÇÃO RÁPIDO" (~10h) — A IA precisa pulsar

> **Objetivo**: player percebe DM começando a responder em <2s. Mesmo com Cloudflare 30s, sente que algo TÁ acontecendo.

#### δ.1 — Server-Sent Events real streaming (4h)
Hoje typewriter é FAKE — narração completa chega, e client anima. Substituir por SSE real:
- Server: `POST /api/dm/stream` retorna `text/event-stream` chunks conforme LLM gera
- Cerebras/Gemini/Groq/Cloudflare TODOS suportam streaming nativo
- Client: substitui parte do socket por EventSource OU socket.io stream chunks
- NarrationLog ganha `appendChunk(text)` ao invés de `appendNarration(full)`

Player vê palavras APARECENDO em tempo real. **Mata a sensação de "travado"**.

Tests: streaming buffer parse, mid-stream cancel ao mudar de ação, recover de chunk perdido.

#### δ.2 — Provider tuning agressivo (2h)
- Cerebras: 1.5s timeout (em vez de 8s) — se for falhar, falha rápido
- Gemini: 6s timeout
- Groq: 4s
- Cloudflare: 30s (último, vale a pena esperar)
- Mistral (novo δ adição): 8s timeout
- "Tier 1 first": tenta Cerebras+Groq em PARALELO, primeiro a responder ganha

Risco: dobra request count. Free tiers aguentam (Cerebras 30 req/min, Groq 30 req/min).

#### δ.3 — Predictive chips fallback (2h)
Enquanto DM responde, mostrar 3 chips genéricos baseados em `currentLocation` + `lastAction`:
- Em taverna: "Pedir bebida" / "Ouvir conversas" / "Procurar trabalho"
- Em masmorra: "Avançar com cautela" / "Procurar armadilhas" / "Voltar"
- Em combate: usa combat actions já existentes

Player vê opções IMEDIATAMENTE, mesmo antes da DM responder. Se DM responder com `suggest_actions`, sobrescreve. Se DM esquecer, fallback fica.

#### δ.4 — Optimistic echo (1h)
Hoje player clica → manda pro server → server emit echo → vai pro log. Latência 200-500ms só pro próprio echo aparecer.

Mudar: client APPEND echo `▶ Player: ação` no log INSTANTÂNEO ao clicar, antes mesmo de socket.emit. Server NÃO emite echo (já tem flag suppressNextPlayerEcho). Se server rejeitar (mutex coop), retira do log com fade.

#### δ.5 — Cache de "rascunhos" comuns (1h)
- Primeira narração de campanha nova com personality `sombrio`: cacheia template
- Cache hit reduz latência da abertura de 30s pra 200ms
- Pequeno mas frequente — cada nova campanha começa com cache

**Deploy δ → prod**. Métrica chave: `time_to_first_token_ms` deve cair de ~8000 pra <800.

---

### Sprint ε "BONITO & ONBOARDING" (~12h) — First-run e dopamina

> **Objetivo**: novo player joga 1 sessão completa sem confusão. Cada momento marcante tem visual + som que dá vontade de gravar e mostrar pros amigos.

#### ε.1 — Quick-Start (3h)
Substitui "wizard 5 passos" como FIRST PATH. Player vê:
- 3 cards: **Borin** (Anão Guerreiro Soldado) · **Lyra** (Elfa Maga Sábia) · **Sina** (Halfling Ladina Charlatã)
- Click = PJ criado completo, vai direto pra escolha de DM persona
- "Customizar" botão pequeno = wizard tradicional (mantém pra power users)

Conversão first-run deve dobrar.

Tests: +5 (pré-fab válido, atributos corretos, equipped weapons inicial).

#### ε.2 — Loot Screen pós-combate (2h)
Hoje: combate acaba → notification toast "+100 XP" → silêncio.

Novo: overlay full-screen 3s com:
- Title "VITÓRIA"
- XP ganho com counter animado (0 → 100)
- Items recebidos como cards estilo TCG (usa rarity de α.2 com glow)
- Botão "Continuar" + auto-dismiss

Reusa CSS rarity de α.2 e animação `loot-burst`. Visual sem ser pesado.

#### ε.3 — Audio polish + mood adaptativo (2h)
- Música ambiente já existe (F21). Refinar transições: combat→exploration deve fade 1.5s
- Novo: música por tipo de local (`currentLocation.includes("taverna")` → loop calmo; "masmorra" → drone tenso)
- Som "level up" mais épico
- Sound "crit" em combate consecutivo: combo crescente

#### ε.4 — First combat interactive tutorial (2h)
Tutorial atual mostra cards estáticos. Novo: tutorial inline em CADA primeira aparição:
- Primeiro skill check: tooltip flutuante "Esse é o d20! Adiciona seu modificador + bônus de proficiência. DC = dificuldade."
- Primeiro combate: setas apontando "Esse é seu HP" / "Essa é sua iniciativa" / "Clica no inimigo pra atacar"
- Dismissible mas sticky até interação real com cada elemento

Cobertura: 6-8 first-time elements. Persistência via `localStorage[`jsgame.tutorial.${id}`]`.

#### ε.5 — Header reorganização mobile (1h)
Header hoje tem 10+ botões (Sair, SFX, Music, Notifs, TTS, Memória, Difficulty, Quest, Achievements, NPCs, Share). Em mobile vira soup.
- Agrupa em menu hamburger "⋯" (settings)
- Mantém visíveis: Sair · Quest · Achievements · NPCs · Share (5 max)
- Rest vai pro overflow menu

#### ε.6 — Color tokens + dark mode polish (1h)
- Audit `_tokens.css`: contraste WCAG AA em todos pares
- Ajustar `--ink-mute` que ficou ilegível em alguns lugares
- Garante que toda nova rarity-* tem texto legível em background dark

#### ε.7 — Achievement unlock animation (1h)
Toast atual é simples. Adiciona:
- Burst de partículas CSS (sparkles dourados)
- Tier visual no toast (bronze→platinum cores)
- Som específico por tier (já tem? confirmar)

**Deploy ε → prod**. Métrica chave: first-session completion rate.

---

### Sprint ζ "VICIANTE" (~14h) — Volta amanhã

> **Objetivo**: player que terminou 1 sessão tem 3 razões claras pra voltar amanhã. Cada sessão N+1 sente mais profunda que N.

#### ζ.1 — Daily Challenges (3h)
Reusa `metrics_events` e `achievements_counters`. Adiciona:
- Tabela `daily_challenges (date, user_id, challenge_id, completed_at)`
- 5 challenges rotativos: "Ganha 1 inspiração", "Conjure 3 magias", "Visite local novo", "Vença combate sem dano", "Persuade NPC hostil"
- UI no header: badge "🎯 3/5 desafios"
- Reward: +50 XP bonus + entrada no leaderboard semanal

#### ζ.2 — Meta-progressão "Almas" (3h)
Jogador anônimo: só XP da campanha. Jogador logado: ganha **alma** quando:
- PJ morre (1 alma)
- Termina sessão 5 da campanha (3 almas)
- Mata boss (1 alma)
- Unlock achievement gold+ (1 alma)

Almas desbloqueiam:
- 5 almas → personality DM nova "místico" (Hermes/Tarot vibes)
- 10 almas → raça secreta (drow / tiefling fire-blood)
- 15 almas → classe secreta (artificer)
- 25 almas → "New Game+" (PJ começa nv 5, mas ambient music dark mode permanente)

Reusa tabela `achievements_counters` (key `souls_total`).

#### ζ.3 — Random encounters em viagem (2h)
Hoje `tool advance_time` só passa tempo. Novo:
- 30% chance de disparar encounter aleatório baseado em region
- Server gera encontro: 1d4 bandits / lobo selvagem / mercador errante / ruína antiga
- DM narra abertura usando `start_combat_balanced` ou `npc_speaks`

Quebra a previsibilidade. Mundo parece vivo.

#### ζ.4 — Hall of Fame compartilhável (2h)
Reusa highlights de F20. Adiciona:
- Modal "🌟 Salão da Fama" no header (user logado)
- Top 5 highlights de TODAS as campanhas do user
- Export como imagem (canvas render) com PJ portrait + quote + data
- Share button → copy link público `/h/:slug` que abre highlight standalone (sem login)

#### ζ.5 — Weekly leaderboard (2h)
Tabela `weekly_scores (week_start, user_id, kills, xp, sessions)`.
- Header mostra rank semanal do user
- Modal leaderboard top 10 (anonimo se quiser, ou displayName)
- Reset toda segunda

#### ζ.6 — Surprise mechanics (2h)
- 1% chance de loot lendário em ANY combate (não só boss)
- 0.5% chance de NPC mítico aparecer (visão de uma divindade, oferece quest impossível)
- Easter eggs: combos de ações específicas disparam highlights únicos
- "Lucky dice" cosmético: avatar de player que rolou 3 nat20 seguidos ganha border dourada permanente

**Deploy ζ → prod**. Métrica chave: D1 retention (player volta no dia seguinte).

---

## 4. Cronograma sugerido (executável autônomo)

```
Dia 1 (12h)  →  Sprint γ "LISO"
                4 commits, deploy
                
Dia 2 (10h)  →  Sprint δ "CORAÇÃO RÁPIDO"  
                5 commits, deploy
                Métrica: time_to_first_token cai 10x
                
Dia 3 (12h)  →  Sprint ε "BONITO & ONBOARDING"
                7 commits, deploy
                Quick-start + loot screen + tutorial inline
                
Dia 4 (14h)  →  Sprint ζ "VICIANTE"
                6 commits, deploy
                Daily + meta-progressão + leaderboard
                
Total: 48h, 22 commits, 4 deploys
```

Tudo executável autônomo. Zero budget mantido. Tests permanecem verde sempre.

## 5. Como cada sprint conecta com α+β já feito

| Sprint α+β |  →  | Como γδεζ reusa |
|---|---|---|
| α.1 suggested chips | → | δ.3 fallback predictive chips usa mesma UI; γ.1 testa β.4 V2 não afeta |
| α.2 item rarity | → | ε.2 loot screen usa rarity glow; ζ.6 loot lendário usa tier `lendario` |
| α.3 inspirações | → | ζ.1 daily challenge "ganha inspiração"; ε.4 tutorial primeira inspiração |
| α.4 voice input | → | δ.1 streaming pode ler TTS chunk-by-chunk paralelo |
| β.1 NPC roster | → | ζ.4 Hall of Fame inclui top NPCs; γ.4 mobile audit roster modal |
| β.2 achievements | → | ζ.1 daily challenges reusa counters; ζ.2 almas tier baseado em achievements |
| β.3 vendor | → | ζ.2 almas como currency adicional além de gold; ε.2 loot screen pode mostrar preço estimado |
| β.4 V1 economy | → | γ.1 vira V2 mecânico; ε.4 tutorial primeira bonus action |

**Cada sprint TIRA proveito do que já está em prod. Nada é refeito.**

## 6. Métricas de sucesso (com endpoints existentes)

Reusa telemetria de Sprint γ.5:
- **time_to_first_token_ms** (target: <800 pós-δ, atualmente ~8000)
- **first_session_completion_rate** (target: >70% pós-ε, atualmente provavelmente ~30%)
- **D1_retention** (target: >40% pós-ζ, atualmente desconhecido)
- **avg_session_duration_min** (target: >25 pós-ε, atualmente desconhecido)
- **dm_silence_seconds_per_session** (target: <30s pós-δ, atualmente ~120s)
- **achievements_unlocked_per_session** (target: >2 pós-ζ.2)

Endpoint novo: `GET /api/dm/ux-metrics?days=N` consolida tudo num dashboard JSON.

## 7. Pra próxima conversa

**Opção mais alta-ROI primeiro:**
> Lê `STRATEGY_LISO_VICIANTE.md`. Executa Sprint γ "LISO" autônomo (4 commits: β.4 V2, race echo fix, Cloudflare fallback Mistral, mobile audit, telemetria UX). Deploy via Chrome MCP no fim. Zero budget. Tests verde.

**Se quiser priorizar IA mais rápida (mais impacto perceptível):**
> Executa Sprint δ "CORAÇÃO RÁPIDO" — server-sent events streaming real + provider tuning paralelo + predictive chips fallback + optimistic echo. Vai mudar a sensação do jogo de "travado" pra "fluído".

**Se quiser conversão de novos players:**
> Executa Sprint ε "BONITO & ONBOARDING" — quick-start 3 PJs pré-fab + loot screen pós-combate + tutorial inline + mobile header reorganization + audio polish. First-run vira experiência boa.

**Se quiser retention:**
> Executa Sprint ζ "VICIANTE" — daily challenges + meta-progressão Almas + Hall of Fame compartilhável + weekly leaderboard + surprise mechanics. Player tem motivo pra voltar amanhã.

---

**Princípio guia desta estratégia:**

> "A IA é o coração. Se a IA não bate rápido, nada do resto importa. Se a IA bate rápido mas o jogo é confuso, o player nunca chega a ver. Se a IA bate rápido E o jogo é intuitivo, o player viceja — mas só volta se há razão pra voltar."

Por isso a ordem: γ (estabilizar) → δ (acelerar coração) → ε (intuitivo+bonito) → ζ (motivação pra voltar).
