# JSgame · Estratégia "Polish Geral — Cada Arresta Lixada"

> **Filosofia**: O jogo já tem o coração funcionando (D&D 5e completo, IA cascade, coop, mobile-nativo, trilha medieval, chips contextuais, momentum narrativo). Agora é POLISH — 6 sprints temáticos pra cada arresta visível, cada microatrito, cada momento "isso podia ser melhor". Não é refazer — é lapidar.

> **Princípio guia**: cada sprint resolve UMA hipótese central + 4-6 fixes mensuráveis. Commit atômico por sprint. Tests sempre verde (1111+ hoje). Sem feature nova grande — só lapidação.

> **Objetivo final**: o jogo ficar tão fluido que o jogador esqueça que está usando software e foque só na narrativa.

---

## 1. Diagnóstico do estado atual

### O que JÁ está bom (não mexer)
- D&D 5e core completo (PHB embarcado, 18 perícias, condições, action economy)
- IA cascade 5 providers + persona system + DM Mestre Experiente v2
- Skill check auto-inject (γ.2 + post-DM) — força mais dados
- Cold opens com locationLabel + fallback (12 cenários variados)
- Chips contextuais smart (exploração + combat, NPC/landmark extraction)
- Narrative Momentum no prompt (But/Therefore + 12 Hard Moves + Clocks)
- Mobile polish completo (bottom-sheets, hit targets ≥40px, sticky headers)
- Trilha medieval procedural 8 moods
- 1111 tests passando, zero regressões nos últimos 30 commits

### Onde estão as arestas (foco do polish)

Análise por camada:

| Camada | Arresta confirmada | Sprint |
|---|---|---|
| **Onboarding** | Primeira sessão pode ser confusa — onde começar? como criar PJ? | **α** |
| **Login/Auth** | Magic link UX (espera, fallback se email não chega) | **α** |
| **Home → primeira cena** | Tempo do click "Jogar" até a primeira narração visível | **α** |
| **Combate** | Disparidade entre botões fixos + chips dinâmicos pode confundir | **β** |
| **Combat feedback** | Buff/debuff visual, damage numbers, HP transitions | **β** |
| **DM latência** | "Mestre pensando…" 5-15s — UX pesada quando sem streaming | **γ** |
| **DM error recovery** | Quando LLM falha, retry visível mas pouco actionável | **γ** |
| **Coop presence** | Outros players: onde estão? digitando? offline? | **δ** |
| **Coop reconnect** | F5 ou rede caiu — quão graceful? | **δ** |
| **Coop chat** | Player→party chat existe mas é minimalista | **δ** |
| **Acessibilidade** | Keyboard nav incompleta, screen reader sem ARIA em tudo | **ε** |
| **Erros & recovery** | Mensagens técnicas demais, sem call-to-action claro | **ε** |
| **Empty states** | Sem quest? sem NPC? sem achievement? Mostra como? | **ε** |
| **Microinteractions** | Hover, transitions, feedback haptic ainda inconsistentes | **ζ** |
| **Copy/tone** | Strings UI poderiam ter mais "voz" sombria-trickster | **ζ** |
| **Loading states** | Skeleton vs spinner vs none — inconsistente entre telas | **ζ** |

---

## 2. Princípios não-negociáveis

1. **Tests sempre verde** (1111+). Typecheck OK em cada commit. SingleFork SQLite mantido.
2. **Zero budget** — só free tiers (Cerebras/Gemini/Groq/Cloudflare/Mistral). Anthropic só com confirmação explícita.
3. **Mobile-nativo mantido** — qualquer fix CSS desktop tem que validar em 360×740.
4. **Conservador com prompt** — refinar incremental, não reescrever do zero (já está bem treinado).
5. **Reusar primitivas** — `.m-modal`, `attachSwipeDown`, `cn-chip`, sequencer audio, etc. Não criar pattern paralelo.
6. **prefers-reduced-motion respeitado** em toda anim nova.
7. **Telemetria sempre que possível** — toda mudança UX mensurável tem evento.
8. **Push origin/main após cada sprint** OK.

---

## 3. Os 6 sprints

### Sprint POLISH α — "Primeira Impressão Inesquecível" (~8h)

**Hipótese**: Os primeiros 90 segundos definem se o player joga ou desiste. Hoje há atrito em login + criação + primeira cena.

#### α.1 — Magic link com fallback "anônimo" mais visível
Hoje login tem magic link + botão anônimo, mas anônimo está discreto. Player que não recebe email rapidamente desiste. **Fix**: botão "Jogar sem cadastro" no topo do card login (ainda permite criar conta depois).

#### α.2 — Home: hierarquia "Jogar JÁ" maior
Hoje 3 prefab PJs aparecem em scroll, mas "Personagem Customizado (Wizard)" empata visualmente. Player novato deveria ver `▶ JOGAR JÁ → Borin` como CTA dominante. **Fix**: hierarquia visual prefab > customizado, com hint "ou crie do zero".

#### α.3 — Wizard step 1-2 simplificar default
Player customizado escolhe raça → classe → atributos → background → review. Pode ser longo na 1ª vez. **Fix**: botão "🎲 Randomizar tudo" no topo do wizard (cria PJ válido balanceado em 1 click + permite editar antes de salvar).

#### α.4 — Primeiro skill check overlay com tutorial inline
Player vê o overlay de skill check pela 1ª vez, vê chips "Inspiração" e "Rolar d20" sem entender. **Fix**: na 1ª sessão, overlay tem hint persistente "👆 toque pra rolar o d20" + breve explicação do DC.

#### α.5 — "Time to first roll" ≤30s
Telemetria atual mostra `timeToFirstRollMs`. Meta: p50 ≤30s. **Fix**: pre-load NarrationLog componente, pre-warm AudioContext em primeiro click (mobile policy), pre-fetch primeiro provider LLM antes do player escolher PJ.

#### α.6 — Loading state "Mestre preparando…" rico
Hoje thinking indicator é simples ("⋯ Mestre pensando"). **Fix**: dicas rotativas durante load ("Sabia que pode usar Inspiração pra rolar 2d20?", "Atalho: digite a ação e Enter direto"), ETA visual baseado em latência média do provider.

**Métricas-alvo**:
- timeToFirstRollMs p50: hoje desconhecido → meta **≤30s**
- dropoff entre home click e first action: hoje desconhecido → instrumentar + meta **<10%**

**Commit**: `feat(polish-α): primeira impressão — login fallback + home hierarquia + randomize wizard + tutorial overlay`

---

### Sprint POLISH β — "Combate sem Atrito" (~10h)

**Hipótese**: Combate é o coração mecânico de D&D. Atrito aqui = player não volta. Hoje há disparidade visual entre botões fixos + chips dinâmicos + feedback de hit/dmg inconsistente.

#### β.1 — Unificar action layer combat
Hoje combat tem: botões fixos (Atacar/Esquivar/Disparada/etc) + chips dinâmicos suggested (vermelhos) + class features bar + economy badge. Muito a parsear. **Fix**: hierarquia clara — chips dinâmicos PRIMEIRO (acima), botões fixos SEGUNDO (default), features TERCEIRO (sob ⋯), economy COMPACTO no header.

#### β.2 — Damage number polish
Hoje floating numbers existem mas crit + miss + heal ainda têm font/anim inconsistente. **Fix**: paleta unificada (vermelho-amarelo-verde-cinza), anim curva única, posição relativa ao target consistente.

#### β.3 — HP bar transitions narrativas
Hoje HP bar tem flash + critical pulse. Faltam: **damage tick** (delta visível por 800ms), **death cross overlay** (ao zerar HP), **stagger animation** (HP <25% em vermelho pulsante).

#### β.4 — Status condition pills mais ricas
Hoje conditions aparecem como pills (severe/moderate/mild). Faltam **icons claros** (poisoned=🧪, prone=🔻, grappled=🤝, etc) + **tooltip on tap** explicando efeito mecânico.

#### β.5 — Initiative tracker com avatar visíveis
Hoje tracker scroll-x com nome + número. **Fix**: avatar emoji por participant (race+class) + animação "vez atual" mais óbvia + condition pills inline na initiative row.

#### β.6 — Combat log mais legível
Hoje log é monospace. **Fix**: cor por tipo (player ataca = dourado, enemy ataca = vermelho, skill check = ciano, crit = amarelo brilhante). Bold em nome de attacker/target. Auto-scroll com "↓ N novas" tipo narration.

#### β.7 — "End turn" sugerido quando econ vazia
Hoje action economy mostra slots usados. **Fix**: quando todos slots gastos, chip flutuante "✓ Encerrar turno" pulsa pra player não esquecer.

**Métricas-alvo**:
- combat_action_blocked: <5% das tentativas (econ confusion)
- average_combat_duration: medir + meta ≤4 rounds pra encounter médio

**Commit**: `feat(polish-β): combate sem atrito — action layer + damage + status + initiative`

---

### Sprint POLISH γ — "Vida da Cena" (~8h)

**Hipótese**: Entre player ação e DM resposta há 3-15s. Esse gap é onde o jogo morre. Streaming + loading inteligente + transições suaves.

#### γ.1 — SSE streaming da narração
Hoje DM resposta é all-at-once. Player espera 8s vendo "⋯ pensando" e narração aparece de uma vez. **Fix**: server emite via SSE/socket-stream char por char, client renderiza com typewriter (já existe `is-streaming` CSS) — sensação de "DM digitando ao vivo".

#### γ.2 — Pre-fetch próxima narração
Quando player clica chip ou digita action, antes mesmo de pressionar Enter, podemos começar a chamar LLM em background (com fallback se cancelar). **Fix**: speculative execution — economiza ~2s percebidos.

#### γ.3 — Transition entre cenas via "describe_scene"
Quando DM chama `describe_scene` (mudança de location), client mostra fade-out → location header pulsa → fade-in. Hoje é abrupto. **Fix**: scene-change animation 600ms suave.

#### γ.4 — Error recovery rico
Hoje quando LLM falha aparece card vermelho "tentar novamente". **Fix**: card menciona QUAL provider falhou + ETA do próximo cascade + botão "ver detalhes" expansível com timeline de tentativas.

#### γ.5 — Auto-retry silent + cap
Hoje há auto-retry single. **Fix**: 2 silent retries (300ms apart) antes de mostrar erro ao player. Se mesmo assim falhar, mostra erro + sugere ação alternativa.

#### γ.6 — Thinking indicator com tempo real
Hoje "Mestre pensando…" sem tempo. **Fix**: contador secs visível depois de 3s ("Mestre pensando… 5s"), passou 10s troca pra "Mestre demorando, espere mais um pouco…", passou 20s troca pra "Tentando outro provedor…".

**Métricas-alvo**:
- p50 time-to-first-char (streaming): <800ms (vs hoje ~3-5s pra texto completo)
- dm_silence p90: hoje medido → meta ≤10s
- narration_error rate: hoje medido → meta ≤2%

**Commit**: `feat(polish-γ): vida da cena — SSE streaming + pre-fetch + transitions + error recovery`

---

### Sprint POLISH δ — "Coop Sem Drama" (~6h)

**Hipótese**: Coop até 3 funciona, mas presence/sync/reconnect podem ser confusos. Player em coop precisa SENTIR os aliados sempre.

#### δ.1 — Presence indicators por player
Hoje party panel mostra HP/conditions. Falta: **online status dot** (verde/cinza), **"X está digitando…"** quando player digita custom action, **"X está rolando dado"** durante skill check overlay.

#### δ.2 — Reconnect graceful
Hoje F5/disconnect tenta rejoin via lastSession. Pode falhar silent. **Fix**: status banner sticky top "🔌 Reconectando…" com retry automático + manual button + timeout claro.

#### δ.3 — Chat coop mais visível
Hoje camp-chat-bar existe mas é minimalista. **Fix**: messages com avatar + nome do player + timestamp curto. Notification badge no chat se nova msg enquanto outra modal aberta.

#### δ.4 — Player turn indicator
Em combat, quando NÃO é meu turno, hoje botões disable mas pouco óbvio. **Fix**: overlay sutil "Vez de [PlayerName]" + estimated time + "vamos torcer 🤞" copy charmoso.

#### δ.5 — Lobby personality picker visual
Hoje lobby tem personality picker (host only). **Fix**: cada personality option com **preview de narração curta** ("Sombrio: 'A taverna range. Algo te observa.'") pra host saber o que escolhe.

**Métricas-alvo**:
- coop_disconnect_recovered: meta ≥95%
- chat_messages_per_session: medir tendência
- player_turn_idle_time: medir + reduzir

**Commit**: `feat(polish-δ): coop sem drama — presence + reconnect + chat + turn indicator`

---

### Sprint POLISH ε — "Acessibilidade & Resiliência" (~6h)

**Hipótese**: Jogo precisa ser pra TODOS — keyboard, screen reader, contrast — e sobreviver erros sem quebrar a experiência.

#### ε.1 — Keyboard navigation completa
Hoje TAB pula entre alguns elementos mas pula skill check overlay, modais bottom-sheet, action chips. **Fix**: focus management completo, focus trap em modais, ESC fecha modal, Enter confirma CTA, atalhos teclado documentados (`?` pra ver shortcuts).

#### ε.2 — ARIA labels em tudo
Hoje botões emoji-only (🎒 inventory) não têm aria-label. Screen readers leem "🎒 button" — incompreensível. **Fix**: aria-label em todos botões icon-only, role=dialog em modais, role=status em loading, role=alert em error.

#### ε.3 — Contrast audit
Hoje paleta dourado em fundo escuro funciona, mas alguns greys (var(--ink-mute)) podem não atingir 4.5:1 WCAG AA. **Fix**: audit + ajustar variáveis afetadas.

#### ε.4 — Empty states ricos
Hoje "Nenhuma quest ainda", "Inventário vazio", "Sem NPCs conhecidos" são textos secos. **Fix**: ilustração simples (emoji + frase charmosa) + call-to-action ("Quests aparecem quando NPCs te pedem favor. Tente falar com alguém.").

#### ε.5 — Error boundary global client
Hoje JS error crash silencioso no client. **Fix**: global error boundary que captura + mostra "Algo quebrou, tente recarregar" + envia telemetria + permite continuar sem reload.

#### ε.6 — Session resilience
Hoje rejoin tenta lastSession LocalStorage. **Fix**: estado completo do PJ + scene em IndexedDB com timestamp, restaura em ≤2s mesmo offline (mostra "modo offline" se backend down).

**Métricas-alvo**:
- WCAG AA contrast: 100% das telas principais
- keyboard_only_completable: 100% dos fluxos críticos
- error_boundary_caught: medir tendência (<1 por sessão)

**Commit**: `feat(polish-ε): acessibilidade & resiliência — keyboard + ARIA + contrast + empty + errors`

---

### Sprint POLISH ζ — "Cada Pixel Conta" (~4h)

**Hipótese**: Os 20% finais que diferenciam um jogo "bom" de um jogo "memorável". Microinteractions, copy, transitions, polish de polish.

#### ζ.1 — Microinteractions universais
- Hover suave em todos botões (transform translateY -1px)
- Active state com scale(0.97) pra feedback tátil
- Long-press no mobile abre tooltip
- Haptic feedback em crit/level-up/quest complete

#### ζ.2 — Copy review pass
- Strings UI passadas por revisão de tom (sombrio+trickster consistente)
- Botões: "Salvar" → "Salvar pergaminho", "Excluir" → "Queimar", etc
- Tooltips charmosos
- Empty states com tom narrativo

#### ζ.3 — Loading states consistentes
Hoje algumas telas mostram spinner, outras skeleton, outras nada. **Fix**: 3-tier system: <500ms = nada, 500ms-3s = thinking indicator unified, >3s = skeleton com hint contextual.

#### ζ.4 — Transitions entre rotas
Hoje router-level (home→wizard→sheet→campaign) é abrupto. **Fix**: fade 200ms entre rotas, scroll restore no back.

#### ζ.5 — Polish visual final
- Sombras consistentes (3 tiers só)
- Border-radius sistema (3 tiers: 4/6/12px)
- Glow effects gold em CTAs importantes
- Scrollbar custom (sutil dourado)

#### ζ.6 — Audit final 5 viewports + screenshots
Como Mobile Polish — audit 360/390/414/768/1280 com screenshots documentados.

**Métricas-alvo**:
- Sessões >5min: tendência up
- "Apenas isso?" feedback: 0
- Polish satisfaction qualitativa via playtest

**Commit**: `feat(polish-ζ): cada pixel conta — microinteractions + copy + loading + transitions`

---

## 4. Cronograma de execução

```
Sprint α  (Primeira Impressão)        ~8h   →  commit + push + tests verde
Sprint β  (Combate sem Atrito)        ~10h  →  commit + push + tests verde
Sprint γ  (Vida da Cena)              ~8h   →  commit + push + tests verde
Sprint δ  (Coop Sem Drama)            ~6h   →  commit + push + tests verde
Sprint ε  (Acessibilidade)            ~6h   →  commit + push + tests verde
Sprint ζ  (Cada Pixel Conta)          ~4h   →  commit + push + tests verde
Deploy + handoff                      ~0.5h →  via Render auto-deploy

Total: ~42.5h, 6 commits feature + 1 docs handoff
```

Cada commit:
- Tests novos passando (target +30 total ao longo do polish)
- Typecheck OK
- Push origin/main
- Suíte permanece verde (1111+ → 1140+ ao final)

Deploy via auto-deploy do Render entre sprints OK (cada commit gera build).

---

## 5. O que NÃO está nesse plano

Cortado explicitamente — fora do escopo de POLISH:

- ~~SSE streaming server-side completo~~ — γ.1 cobre só client-side perception; server precisa mudança grande de arquitetura, deixar pra Sprint δ ou ε futuro
- ~~Drag-and-drop inventory~~ — over-engineering pra mobile
- ~~Voice DM (TTS narration)~~ — já existe Voice TTS opcional
- ~~Native mobile app~~ — DOM puro mantido
- ~~Internationalization (i18n)~~ — pt-BR-only por design
- ~~Multi-language LLM~~ — DM responde em pt-BR
- ~~Custom monster builder~~ — bestiary atual cobre
- ~~Magic item crafting~~ — fora de escopo MVP
- ~~PvP combat~~ — coop é cooperativo por design
- ~~Modding API~~ — over-engineering
- ~~Spectator mode~~ — fora de escopo
- ~~Replay system~~ — handoff/recap já cobre

Se sobrar tempo em algum sprint, prioridade é AUDIT final via 5 viewports + playtest em vez de adicionar.

---

## 6. Métricas-validação consolidadas

Tabela de telemetria total — meta após os 6 sprints:

| Métrica | Antes | Pós-polish |
|---|---|---|
| time_to_first_roll_ms p50 | desconhecido | **≤30000** |
| dm_silence_seconds avg | medido γ.6 | **≤10** |
| rolls_per_action_ratio | medido | **≥0.40** |
| avg_distinct_skills_per_session | medido | **≥5** |
| combat_action_blocked rate | medido | **≤5%** |
| narration_error rate | medido | **≤2%** |
| coop_disconnect_recovered | desconhecido | **≥95%** |
| tests totais | 1111 | **1140+** |
| WCAG AA contrast | parcial | **100%** |
| keyboard-only completable | parcial | **100%** |
| Telas auditadas em 360×740 | 20+ | **30+** |
| Empty states ricos | 0/8 | **8/8** |

Métricas qualitativas (validar via playtest):
- "O jogo abre rápido" — sim/não
- "Combate é claro" — sim/não
- "Mestre tem peso" — sim/não (já melhorou em Cenas com Peso)
- "Coop funciona" — sim/não
- "Acessível teclado-only" — sim/não

---

## 7. Como cada sprint constrói o próximo

| α entrega | β usa | γ usa | δ usa | ε usa | ζ usa |
|---|---|---|---|---|---|
| pre-warm LLM + timer | ✓ thinking | ✓ streaming | ✓ presence latency | ✓ resilience | ✓ loading |
| randomize wizard | (não) | (não) | ✓ rapid lobby join | ✓ keyboard nav | ✓ transition |
| tutorial overlay | ✓ combat tutorial | (não) | (não) | ✓ a11y patterns | ✓ copy review |
| home hierarquia | (não) | (não) | (não) | ✓ contrast | ✓ pixel polish |

β entrega action layer unificado → γ usa pra streaming visual mais óbvio
γ entrega streaming infra → δ usa pra "X digitando" presence
δ entrega presence pattern → ε usa pra status indicators a11y
ε entrega error boundary → ζ usa pra polish de erros

**Sem desperdício, sem retrabalho. Cada peça serve múltiplas seções.**

---

## 8. Princípio guia

> "Polish não é UM lugar — é TODOS os lugares onde o player olha 2x e pensa
> 'esse podia ser melhor'. Hoje JSgame tem o coração (D&D real) + corpo (mobile-
> nativo) + esqueleto (DM com peso). Falta a pele — onde cada toque tem
> feedback, cada erro tem recuperação, cada espera tem propósito, cada vazio
> tem charme. Depois desse polish, vira **jogo que se joga sozinho** — o player
> esquece que tem software no meio."

A IA é o coração ❤️, o mobile é o corpo 💄, o DM com peso é o esqueleto 🦴, e
agora **o polish é a pele** ✨ — onde tudo fica conectado e vivo.

---

**Próxima sessão**: começar lendo este plano + `CLAUDE.md → Estado Atual` + `HANDOFF_*.md` mais recente. Execução autônoma sprint-por-sprint OK, ou pode pedir confirmação por sprint pra calibrar foco.
