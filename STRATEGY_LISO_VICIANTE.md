# JSgame · Estratégia "Liso, Polido & Viciante"

> **Filosofia**: polish > novas features. Cada elemento que existe hoje merece terminar de ser feito — som, animação, feedback tátil, mobile-OK, copy clara. **Funcionalidades simples mas BONITAS e INTUITIVAS.** Quando o dado aparece, é chamativo (visual + som + tátil). Quando NPC fala, é memorável. Quando combate começa, tem peso. A IA continua sendo o coração que bate — rápida e confiável — mas é o polish geral que faz o player querer ficar.

## 1. Diagnóstico — Por que o jogo ainda não é "gostoso"

Não falta feature. Falta **acabamento** das que existem.

| Onde dói | Por que dói |
|---|---|
| **Dado é tímido** | Aparece só em skill check + save. Combate roll é texto. d20 visual existe mas sem peso/sombra/3D. Som único playD20() — sem tap-tap-tap rolando, sem thud, sem ting de crit. Sem haptic mobile. |
| **DM esquece de pedir rolls** | α.1 + REGRA DE OURO ajudaram mas LLM ainda narra direto às vezes. Player passa 5 turnos sem rolar — vira "ler livro". |
| **Latência DM** | 8-30s. Player olha tela parada, dispersa. Thinking indicator existe mas não convence "tá vindo". |
| **First 5 minutos** | Nome → wizard 5 passos → escolha DM → começo. Player anônimo desiste antes de jogar. |
| **Combate sem peso** | Click no inimigo → texto "atacou, 18 vs CA 13 = hit". Sem zoom, sem cinegrafia, sem "wow" no crit. |
| **Loot silencioso** | Item entra no inventário, toast tiny "+1 item". Sem TCG-card-reveal momento. |
| **Mobile reordenado mas não polido** | 10+ botões no header, modais que pousam OK mas sem floating tab, sem drag handles. |
| **β.4 só V1** | Action economy só EXIBE. Player atira 5 attacks por turno sem bloqueio. Não é D&D. |
| **Zero razão pra voltar** | Sessão acaba → nada chama amanhã. |

**O que precisa: cada interação memorável precisa de coreografia de 3 sentidos — visual + som + tátil. Cada erro precisa de fix. Cada friction tem que ser ironed.**

## 2. Princípios não-negociáveis

1. **Polish antes de feature nova**: 1 botão lindo > 5 botões mal-acabados. Cada item ganha: animação 60fps, som procedural (já temos Web Audio), feedback hover/active/disabled, mobile fit em 360px.
2. **A IA é o coração que bate**: rápida (streaming), confiável (cascade 5 providers), inteligente (forçar rolls quando narrativa pede).
3. **Reusar primitivas α+β, não recriar**: NarrationLog, modal-overlay, rarity glow, achievements counters, NPC roster, action economy — tudo plantado, agora é colher.
4. **Simples > complexo**: novo feature deve caber em 1 commit pequeno (~300 LOC + tests). Refactor maior = adia.
5. **Zero budget + tests verde sempre**.

## 3. Plano — 4 Sprints temáticos (~46h total)

### Sprint γ "POLISH FUNDAÇÃO" (~14h)

> **Objetivo**: corrigir bugs + acabar β.4 + fazer o DADO ser chamativo + audit mobile. Cada elemento que já existe ganha acabamento.

#### γ.1 — Dado chamativo (combate + skill check + save) (4h)
Hoje o dado só "tá ali" em skill-check overlay. Falta:

- **Visual 3D-ish**: d20 CSS com perspective + transform 3D, sombra projetada na "mesa" (radial-gradient blur), face brilha em crit (gradient dourado), tremula em nat1 (filter hue-rotate vermelho)
- **Som rico em camadas**:
  - Durante rolling: loop sutil "tap-tap-tap" (3 noise bursts/seg) que acelera→desacelera
  - Landing: thud baixo (180Hz sawtooth)
  - Nat20: ting metálico ascendente (já tem mas reforçar)
  - Nat1: thunk surdo + sub-bass drop
- **Tátil mobile**: `navigator.vibrate(50)` no clique de rolar, `vibrate([100,50,100])` no nat20, `vibrate(300)` no nat1
- **Dado em combate também**: ataque dispara mini-overlay 800ms com d20 girando ANTES do "hit/miss" text aparecer. Dano: dice menor (d6/d8) rola visualmente também
- **Crit fullscreen flash**: borda dourada pulsa 600ms, screen shake leve (translate animation)

Reusa `sc-die-rolling` CSS + estende `audio.ts` (`playDiceRolling()`, `playDiceLand()`).

Tests: dado CSS classes corretas por estado, som tocado em sequence, vibration API gracefully degraded.

#### γ.2 — DM força mais rolls (anti-cheese checker) (2h)
Server-side detector: se player ação livre contém keyword e DM NÃO chamou request_skill_check → server auto-injeta ANTES da narração da DM:

| Keyword na ação | Skill forçado | DC default |
|---|---|---|
| "investig*", "examin*", "procur*", "vasculh*" | investigacao | 12 |
| "persuad*", "convenc*", "negoc*" | persuasao | 13 |
| "intimid*", "amedront*" | intimidacao | 13 |
| "engan*", "minto", "ilud*" | enganacao | 14 |
| "escut*", "ouv*", "not*" | percepcao | 12 |
| "esgu*", "furtad*", "esconde*" | furtividade | 13 |
| "escal*", "salt*", "balanc*" | atletismo | 12 |

Pure function `detectImpliedSkillCheck(action, details)` testável. Hook em `Campaign.takeAction` antes do DM call.

Tests: +8 (cada keyword dispara skill correto, sem keyword passa direto, DM check explícito não duplica).

#### γ.3 — β.4 V2: Action Economy mecânico (3h)
Hook `consumeActionEconomy()` em todos handlers de combate:
- `combat.ts`: attack/dodge/dash/disengage/grapple/shove/help/hide → consome `action`
- `class-features-engine.ts`: rage/second-wind → bonus; action-surge → grant +1 action
- `spells-engine.ts`: castSpell olha `spell.castingTime` (action / bonus / reaction)
- Retorna `false` quando slot=false → handler emite error "Já gastou ação esse turno"
- UI desabilita botões cujo slot=false (visual + funcional)

Tests: +15 (attack rejeita 2ª, bonus+action OK, action-surge dobra disponíveis, dash consome action+movement).

#### γ.4 — Echo player race fix + Cloudflare fallback (2h)
- Echo player aparece DEPOIS narração às vezes — fix: server emit echo síncrono ANTES do LLM call
- Cloudflare empty response sem fallback → adiciona **Mistral free tier** como 5º provider OU template "degraded narration" baseado em playerAction (regex match)

Tests: +5.

#### γ.5 — Mobile audit completo (2h)
- Cada modal aberto em viewport 360px e 414px
- Header reorganização: 10 botões → 5 visíveis + menu hamburger "⋯" com resto
- Modais com swipe-down fechamento (já tem em alguns — padroniza em todos)
- Skill-check overlay com botão Inspiração não pode overflow
- Combat-screen action economy badge em mobile vira 2-linhas em vez de 1
- prefers-reduced-motion: dado anima 200ms ao invés de 1200ms

Tests: snapshot CSS em viewport widths críticos.

#### γ.6 — Telemetria UX baseline (1h)
Métricas novas no `metrics_events`:
- `time_to_first_narration_ms`
- `time_to_first_roll_ms`
- `session_duration_ms`
- `rolls_per_session`
- `bounce_on_wizard_step`
- `dm_silence_seconds`

Endpoint `GET /api/dm/ux-funnel?days=7` consolida tudo. Sem isso, ganhos de δ/ε/ζ ficam intangíveis.

**Deploy γ → prod**. Tests 863 → ~905. Métricas-alvo: rolls_per_session > 8 (de provavelmente ~2).

---

### Sprint δ "CORAÇÃO RÁPIDO" (~10h)

> **Objetivo**: player percebe DM começando a responder em <1s. Mesmo Cloudflare 30s sente que algo está acontecendo.

#### δ.1 — Server-Sent Events real streaming (4h)
Substitui typewriter FAKE (texto chega completo, client anima) por SSE real:
- Server: socket emit `dmNarrationChunk { text, isFinal }` conforme tokens chegam
- Cerebras/Gemini/Groq/Cloudflare suportam streaming nativo
- NarrationLog ganha `appendChunk(text)` em vez de `appendNarration(full)`
- Player vê palavras APARECENDO em tempo real

Mata sensação "travado".

Tests: chunk buffer parse, mid-stream cancel, recovery de chunk perdido.

#### δ.2 — Provider tuning paralelo (2h)
Hoje cascade é serial. Mudança:
- Cerebras+Groq em PARALELO (race condition: primeiro a responder ganha, cancela outro)
- Cerebras 1.5s timeout (rápido — se falhar, falha rápido)
- Gemini fallback 6s
- Cloudflare 30s (último, vale a pena esperar)
- Mistral (de γ.4) também na corrida

Free tiers aguentam (Cerebras 30/min, Groq 30/min).

#### δ.3 — Predictive chips fallback (2h)
Enquanto DM responde, mostra 3 chips genéricos baseados em `currentLocation` + `lastAction`:
- Taverna: "Pedir bebida" / "Ouvir conversas" / "Procurar trabalho"
- Masmorra: "Avançar cauteloso" / "Procurar armadilhas" / "Voltar"
- Combate: usa combat actions existentes

Se DM responder com suggest_actions, sobrescreve. Se esquecer, fallback fica. **Player vê opções imediatamente** mesmo com DM travando.

#### δ.4 — Optimistic echo (1h)
Player clica → echo "▶ Player: ação" aparece INSTANTÂNEO no log (antes de socket.emit). Server NÃO emite echo (suppressNextPlayerEcho já existe). Se server rejeitar, retira com fade.

Latência percebida 200-500ms → 0ms.

#### δ.5 — Smoke test E2E em prod (1h)
Script que roda 5 cenários completos em prod: create PJ → start → 3 actions → combat → win → loot. Falha = exit 1. CronCreate diário, alerta em Slack/email se quebra.

**Deploy δ → prod**. Métrica: time_to_first_token cai de ~8000 pra <800ms.

---

### Sprint ε "PRIMEIRO CONTATO" (~12h)

> **Objetivo**: novo player joga 1 sessão completa sem confusão. Loot e level-up dão dopamina TCG-style.

#### ε.1 — Quick-Start 3 PJs pré-fab (3h)
Substitui wizard 5 passos como FIRST PATH:
- 3 cards no home: **Borin** (Anão Guerreiro Soldado) · **Lyra** (Elfa Maga Sábia) · **Sina** (Halfling Ladina Charlatã)
- Click = PJ criado completo, vai direto pra DM persona
- Botão pequeno "Customizar" = wizard tradicional (power users)

Conversão first-run deve dobrar.

#### ε.2 — Loot Screen pós-combate (2h)
Hoje: combate acaba → toast +XP → silêncio.

Novo: overlay full-screen 3s:
- Title "VITÓRIA" em font-heading grande
- XP ganho com counter animado (0 → 100)
- Items como cards TCG-style (reusa rarity de α.2 + glow + loot-burst)
- Botão "Continuar" + auto-dismiss após 3s
- Som: chime ascendente + dice-land se item raro+

Reusa CSS rarity-* já existente.

#### ε.3 — Tutorial inline first-time (2h)
Tooltips flutuantes em PRIMEIRA aparição de cada elemento:
- Primeiro skill check: "Esse é o d20! Modifier + bônus de proficiência. DC = dificuldade."
- Primeiro combate: setas pra HP, AC, iniciativa, "click no inimigo pra atacar"
- Primeira inspiração: "Botão dourado força advantage. Use sabiamente."
- Primeiro level up: "Você ganhou +HP, slots de magia, talvez nova feature."

Dismissible mas sticky até interação real. localStorage gateia.

#### ε.4 — Audio mood adaptativo refino (1h)
- Música ambiente já existe (F21). Refinar transições: combat→exploration fade 1.5s
- Novo: música por tipo de local (`location.includes("taverna")` → loop calmo; "masmorra" → drone tenso; "cidade" → festivo)
- Level up: som épico-er (3-note arpeggio → 5-note)

#### ε.5 — Header reorganização mobile completa (1h)
γ.5 fez audit, ε.5 implementa fix completo:
- 5 botões visíveis: Sair · Quest · Achievements · NPCs · Share
- Menu "⋯" overflow: SFX · Music · Notifs · TTS · Memória · Difficulty · Personality
- Settings menu modal-overlay em mobile (não dropdown)

#### ε.6 — Achievement unlock animation polish (1h)
Toast atual é simples. Adiciona:
- Burst de partículas CSS (sparkles dourados em 6 direções)
- Tier visual no border (bronze→platinum cores)
- Som específico por tier (bronze: chime curto; platinum: fanfare)
- Confetti CSS no platinum

#### ε.7 — Color tokens + contraste audit (1h)
- Audit `_tokens.css`: contraste WCAG AA em todos pares (`--ink-mute` parece ilegível em alguns lugares)
- Rarity-* texto legível em background dark
- Dark mode polish geral

#### ε.8 — Save indicator visual (1h)
Hoje saveCampaign é silencioso. Add badge canto sup-direito "✓ Salvo às 14:32" que aparece 2s depois de cada save. Confiança visual pro player.

**Deploy ε → prod**. Métrica: first-session completion >70%.

---

### Sprint ζ "VOLTA AMANHÃ" (~10h)

> **Objetivo**: 3 razões claras pra player voltar no dia seguinte. Cada sessão N+1 sente mais profunda.

#### ζ.1 — Daily Challenges (3h)
Reusa `metrics_events` + `achievements_counters`. Nova tabela `daily_challenges(date, user_id, challenge_id, completed_at)`.

5 challenges rotativos:
- "Ganha 1 inspiração" (α.3)
- "Conjure 3 magias"
- "Visite local novo" (β.1 NPC roster check)
- "Vença combate sem dano"
- "Persuade NPC hostil" (β.1 relationship adjust)

UI: badge no header "🎯 3/5". Reward: +50 XP bonus + entrada no leaderboard semanal.

#### ζ.2 — Meta-progressão "Almas" (3h)
User anônimo: só XP. User logado ganha **alma** quando:
- PJ morre (1 alma)
- Termina sessão 5 (3 almas)
- Mata boss (1)
- Unlock achievement gold+ (1)

Almas desbloqueiam:
- 5 → DM personality nova "místico"
- 10 → raça secreta (drow/tiefling fire)
- 15 → classe secreta (artificer)
- 25 → New Game+ (PJ começa nv 5)

Reusa `achievements_counters` (key `souls_total`).

#### ζ.3 — Hall of Fame compartilhável (2h)
Reusa highlights de F20:
- Modal "🌟 Salão da Fama" header (user logado)
- Top 5 highlights de TODAS as campanhas
- Export como imagem (canvas) com PJ portrait + quote + data
- Share link público `/h/:slug` (sem login)

#### ζ.4 — Weekly leaderboard light (1h)
Tabela `weekly_scores(week_start, user_id, kills, xp, sessions)`. Header mostra rank semanal. Modal top 10. Reset toda segunda.

#### ζ.5 — Surprise mechanics (1h)
- 1% chance loot lendário em ANY combate (não só boss)
- 0.5% chance NPC mítico aparece (visão de divindade, quest impossível)
- Easter egg: 3 nat20 seguidos = avatar ganha border dourada permanente
- Combat com 0 dano + boss = título "Imaculado" visível no party panel

**Deploy ζ → prod**. Métrica: D1 retention >40%.

---

## 4. Cronograma sugerido

```
Dia 1 (14h)  →  Sprint γ "POLISH FUNDAÇÃO"
                6 commits, deploy
                Dado chamativo + força mais rolls + β.4 V2 + mobile + telemetria
                
Dia 2 (10h)  →  Sprint δ "CORAÇÃO RÁPIDO"  
                5 commits, deploy
                Streaming SSE + paralelo + predictive + optimistic
                
Dia 3 (12h)  →  Sprint ε "PRIMEIRO CONTATO"
                8 commits, deploy
                Quick-start + loot screen + tutorial inline + audio mood + header + achievement burst + contraste + save badge
                
Dia 4 (10h)  →  Sprint ζ "VOLTA AMANHÃ"
                5 commits, deploy
                Daily + almas + hall of fame + leaderboard + surprise

Total: 46h, 24 commits, 4 deploys
```

## 5. Como cada sprint reutiliza α+β

| α+β já feito | Polish em γδεζ |
|---|---|
| α.1 suggested chips | δ.3 fallback predictive usa mesma UI |
| α.2 item rarity | ε.2 loot screen TCG card-reveal usa glow rarity; ζ.5 1% lendário |
| α.3 inspirações | ε.3 tutorial primeira inspiração; ζ.1 daily challenge |
| α.4 voice input | δ.1 streaming TTS chunk-by-chunk paralelo |
| β.1 NPC roster | ζ.3 Hall of Fame; γ.5 mobile audit modal NPCs |
| β.2 achievements | ζ.1 daily counters; ζ.2 almas tier-based; ε.6 unlock polish |
| β.3 vendor | ζ.2 almas currency adicional; ε.2 loot screen mostra preço estimado |
| β.4 V1 economy | γ.3 vira V2 mecânico; ε.3 tutorial first bonus action |

## 6. Métricas-alvo

Reusa telemetria de γ.6:

| Métrica | Hoje | Pós-γ | Pós-δ | Pós-ε | Pós-ζ |
|---|---|---|---|---|---|
| `rolls_per_session` | ~2 | >8 | >8 | >10 | >12 |
| `time_to_first_token_ms` | ~8000 | ~8000 | <800 | <800 | <800 |
| `first_session_completion_rate` | ~30% | ~40% | ~50% | >70% | >70% |
| `dm_silence_seconds_per_session` | ~120 | ~100 | <30 | <30 | <30 |
| `D1_retention` | desconhecido | — | — | — | >40% |
| `achievements_unlocked_per_session` | ~0.5 | ~0.5 | ~0.5 | ~1 | >2 |

## 7. Pra próxima conversa

**Recomendado — começa pelo polish base:**
> Lê `STRATEGY_LISO_VICIANTE.md`. Executa Sprint γ "POLISH FUNDAÇÃO" autônomo: dado chamativo (visual 3D + som rico + tátil) + DM força mais rolls (anti-cheese checker) + β.4 V2 mecânico + echo race fix + Cloudflare/Mistral fallback + mobile audit + telemetria UX baseline. 6 commits, deploy via Chrome MCP. Tests verde. Zero budget. Sem interação minha.

**Se quiser ir direto pra IA mais rápida:**
> Executa Sprint δ "CORAÇÃO RÁPIDO" — SSE streaming + paralelo + predictive + optimistic + smoke test prod.

**Se quiser focar em first-time experience:**
> Executa Sprint ε "PRIMEIRO CONTATO" — quick-start 3 PJs + loot screen TCG + tutorial inline + audio mood + header mobile + achievement burst + contraste + save badge.

**Se quiser retention:**
> Executa Sprint ζ "VOLTA AMANHÃ" — daily + almas + Hall of Fame + leaderboard + surprise mechanics.

---

**Princípio guia desta estratégia:**

> "Não falta feature. Falta cada elemento que existe HOJE merecer terminar de ser feito. Polish > complexidade. Cada interação memorável precisa de coreografia de 3 sentidos — visual + som + tátil. A IA é o coração, e o resto do corpo precisa estar lindo pra alguém querer ficar."
