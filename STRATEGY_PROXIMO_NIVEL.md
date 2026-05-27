# JSgame · Estratégia "Próximo Nível"

> **Filosofia**: O JSgame tem fundação sólida — D&D 5e core embarcado, IA cascade de 5 providers, mobile-nativo dockstyle, 6 sprints POLISH completos. **O plano POLISH original ficou cumprido**. Agora a meta muda: deixar o jogo **mais fiel ao D&D real, mais gostoso de jogar, mais intuitivo, mais eficiente** — sem perder a leveza atual.
>
> **Princípio guia**: cada sprint resolve uma HIPÓTESE central + 5-8 fixes mensuráveis. A interface continua sendo a alma — toda mudança passa pelo crivo "isso aproxima o player do jogo ou afasta?". Mobile-first sempre.
>
> **Objetivo final**: o player abre o app, esquece que está usando software, vive 30 minutos de D&D real com narrador IA, e quer voltar amanhã.

---

## 1. Diagnóstico (estado verificado 2026-05-27)

### O que JÁ funciona bem (não mexer)
- **D&D core (~70% PHB)**: 13 raças, 12 classes, 13 backgrounds, 18 skills, 14 conditions, 13 damage types, multiclasse, leveling auto até nv 20, encounter builder, spell slots full casters/half/pact, descanso, death saves, initiative+turn order, action economy v2
- **IA**: Cascade 5 providers (Cerebras/Gemini/Groq/Cloudflare/Mistral free tier), Mestre Experiente prompt v2, fail forward + DC tables, callback de NPCs/promessas, backstory drives DM, error recovery rico end-to-end (γ.4)
- **UX**: Mobile dock estilo Uber (fix urgente), microinteractions globais, ARIA via MutationObserver, condition icons + tooltips, combat log colorido, HP transitions narrativas, route fade-in, thinking indicator rico, contrast WCAG AA, error boundary global
- **Telemetria**: Funil honesto (first_narration / first_player_action / first_dm_response), session-debug com stage classifier (7 stages), client metrics whitelist
- **Audio**: Trilha medieval procedural 8 moods + dice 3-camadas + haptic
- **Coop**: Lobby, partyChat, reconnect graceful banner, turn indicator

### Onde estão os gaps verificados (foco do plano)

| Eixo | Gap concreto | Impacto |
|---|---|---|
| 🎲 **D&D fidelidade** | Feats database vazia (só plannedLevel4Choice flag) | Player sem opção real em level up |
| 🎲 | Traits/Ideals/Bonds/Flaws sem estrutura ou UI | DM não tem com que ancorar |
| 🎲 | ASI apenas em nv 4 (PHB tem 8/12/16/19 também) | Build trancado em mid-game |
| 🎲 | Advantage/Disadvantage não é mecânica genérica | DM narra "vantagem" mas não rola 2d20 |
| 🎲 | Saving throw fórmula não exposta na UI | Player não vê o save acontecer |
| 🎲 | Prepared spells: flag existe, UI de escolha ausente | Caster nunca prepara — usa qualquer cantrip aleatório |
| 🎒 **Itemização** | Inventory cru — sem peso, sem slots claros | Inventário vira lixo "tem 30 itens" sem leitura |
| 🎒 | Weapon/armor database simplificada (PHB tem ~30+13) | Armas todas parecem iguais ao DM |
| 🎒 | Magic items quase ausentes | Sem loot recompensador |
| 🎒 | Shop sem rarity tiers | Tudo "comum", sem aspiração |
| 🎯 **Engajamento** | Highlight não convida volta (sem share) | Sessão acaba e sumiu |
| 🎯 | Cemitério seco — só nome+epitáfio | Morte não tem peso lúdico |
| 🎯 | "Continue de onde parou" hoje é só ID — sem preview cena | Player abre home, esquece o que estava fazendo |
| 🎯 | Sessão sem milestones marcados | Crit/morte/boss kill passam batidos |
| 🧭 **Intuitividade** | Tutorial só 1 vez (skill check) | Combate/magia/descanso sem onboarding |
| 🧭 | Termos D&D sem glossário ("nat 20", "DC", "AC") | Novato perdido |
| 🧭 | Sem "modo treino" — todo PJ é live | Player pode quebrar sem entender |
| 🧭 | Sem hints contextuais nas mecânicas novas | Magia 1ª vez = clique no escuro |
| ⚡ **Eficiência** | `narration_error` rate 15-50% em sessões longas | Player espera ver erro |
| ⚡ | Sem streaming SSE — narração chega all-at-once | Latência percebida alta |
| ⚡ | Sem cache de prompts comuns | Re-gera mesmo prompt N vezes |
| ⚡ | Provider sem auto-monitoring de qualidade | Falha silenciosa |
| 🤝 **Coop** | Sem presence (typing/online/rolling) | Coop parece solitário |
| 🤝 | Chat seco — sem avatar/timestamp/badge | Mensagens somem |
| 🤝 | Lobby personality picker sem preview | Host escolhe no escuro |

---

## 2. Princípios não-rediscutir

1. **Mobile-first sempre**. Cada fix valida em 360×740 antes de desktop.
2. **A interface é a alma**. UX é prioridade sobre engenharia bonita.
3. **D&D 5e PHB é a fonte da verdade**. Não inventar regras — replicar.
4. **Pegada "Uber"** validada pelo João — bottom dock fixed em mobile combate, chat e ações sempre acessíveis.
5. **Eventos críticos do PJ precisam DRAMA visual** — morte, crit, level up, boss kill. Não passa batido nunca.
6. **Zero budget LLM** — só free tiers. Anthropic só com confirmação explícita.
7. **Tests sempre verde** (1179+). Typecheck OK em cada commit.
8. **prefers-reduced-motion** respeitado em toda anim.
9. **Telemetria sempre que possível** — evento + dashboard.
10. **Push origin/main após cada sprint** OK. Deploy manual Render quando travar.

---

## 3. Os 9 sprints temáticos

Letras gregas continuação dos 6 POLISH (α/β/γ/δ/ε/ζ). Próximas: **ο η θ ι κ λ μ ν ξ** (omicron/eta/theta/iota/kappa/lambda/mu/nu/xi).

> **Sprint ο vai PRIMEIRO** — interface é a alma (memória `feedback_interface_alma`). UX dinâmica pegada Uber é fundação visual que todas as mecânicas D&D vão habitar. Inverte ordem original (η D&D era #1) porque player só sente "isso é D&D real" se a tela já está viva.

### Sprint ο — "Pegada Uber — Tela Viva" (~12h)

**Hipótese**: tela atual tem fundação sólida (dock mobile, sticky, bottom-sheets, microinteractions ζ). Mas falta **rítmo Uber** — status sempre denso e legível, ação principal sempre 1 tap, navegação por contexto não por menu, chat perfeito, transitions cinematográficas entre modos. Cada decisão UI passa pelo crivo: "isso reduz cognitive load do player?".

#### ο.1 Status Ribbon Inteligente (~1.5h)
Header colapsa pra **ribbon de status mode-aware** — 1 linha densa de info crítica que muda forma conforme estado:
- **Exploração**: `🌲 Caverna do Trovão · Borin 28/30 ❤ · ✦ 2/3 · 🥇 1820xp`
- **Combate**: `⚔️ Round 3 · Sua vez · ⏱ 23s · ⚡✦↩️🚶 ··`
- **Social** (NPC ativo): `🗣 Verena (Taverneira) · 😐 neutra · ⏳ aguardando`
- **Pós-rest**: `🌙 Madrugada · ❤ +12 · ✦ ✦✦✦ slots`
Tap no ribbon expande pra header completo com overflow (quests/ach/npc/share). Como Uber: "João · Camry preto · ⭐ 4.9 · 3 min" — status comprimido contextualmente. Salva 40-60px de tela permanente (mais narration visível).

#### ο.2 Chat Perfeito (Coop Foco) (~2.5h)
Chat hoje misturado no log de narração + input bar sticky bottom. Refactor pra **separação clara**:
- **Floating chat pill** canto inferior direito (40×40px) com badge contador unread. Z-index acima de tudo, exceto modals abertos.
- **Tap abre sheet bottom 60% tela** (slide-up 220ms), narração ainda visível em cima. Header da sheet mostra "Party Chat (3 online)".
- **Cada mensagem**: avatar emoji raça/classe (⚔️🧝‍♀️🧙‍♂️) + nome + texto + timestamp relativo ("agora"/"2m"/"1h").
- **Typing indicator** quando aliado escrevendo (socket event `playerTyping`): "Lyra digitando..." pequeno abaixo da última msg.
- **Long-tap mensagem pra reagir** com 5 emojis quick-react (👍❤😂😱🎉) — server broadcast `messageReaction`.
- **Notification badge** na pill quando msg nova chega + chat fechado.
- **Auto-mute visual** durante pendingCheck/turn própria (pill dim 50%).
Solo: pill esconde. Apenas coop ativa.

#### ο.3 Action Dock Topicizado (~2h)
Action grid hoje tem 8+ botões flat. Refactor pra **4 tópicos cards** + drill-down:
- **TÓPICOS visíveis** sempre (cards 80×80px com glyph grande): `⚔️ Combate · 🔍 Explorar · 🗣 Social · ⚡ Magia` (oculta se não-caster) + slot `🎒 Inventário · 😴 Rest`.
- **Tap em tópico** expande sub-ações no mesmo espaço dock (slide-in 200ms da direita) — ex: `🗣 Social` revela `Persuadir · Enganar · Intimidar · Atuação`.
- **Sticky bottom row** (em combate): chip "⏱ End Turn" sempre visível bottom-right, NUNCA covered.
- **Custom action** vira "✎ Ação livre" como 5º tópico, abre input expansível (3-line textarea com counter).
- **Suggested chips do DM** continuam acima das tópicos (sobrepostos visualmente).
Reduz cognitive load: player vê 4-5 cards em vez de 8-12 buttons.

#### ο.4 Initiative Ribbon Uber-Style (~1.5h)
Tracker atual horizontal scroll com cards pequenos. Refactor pra **timeline Uber-like**:
- **Ribbon completo** acima da narration (visible só em combate): `→ Borin → 👹 Goblin → Lyra → 👹 Hobgoblin → loop`.
- **Avatar 40px** (mobile) / 48px (desktop) + nome curto. Current pulsando dourado com glow.
- **Connector animado** entre participantes ativo (progress fill 0→100% conforme turn pessoa rola).
- **Tap em participante expande** mini-card: HP/AC/conditions/initiative. Tap de novo fecha.
- **Indicação de morto/inconsciente**: avatar grayscale + skull overlay.
- Em coop, indicador de "↓ você é o próximo" se PJ atual é aliado.

#### ο.5 Bottom-Sheets Stack + Swipe Avançado (~1.5h)
Modals já são bottom-sheet com swipe-down. Refinar:
- **Stack** — inventory aberto + tap em item "Cast Spell" → spell-cast vira **segunda sheet por cima** (não substitui). Swipe-down volta pra inventory. Backdrop fica mais escuro a cada layer.
- **Half/Full toggle** — swipe-up de 60% pra 100% tela. Indicador handlebar muda forma.
- **Velocity-aware** — swipe rápido fecha mesmo se distância < 30%; swipe lento exige 50%+.
- **Pull-to-refresh** em listas longas (achievements grid, quest log) com loader dourado.
- **Backdrop click fecha** topmost sheet. ESC global já funciona (ε).
- **Animação 60fps** com requestAnimationFrame + transform GPU-accel.

#### ο.6 Toast/Peek System Unificado (~1.5h)
Toasts hoje isolados (toastError, toastInfo) sem queue. Sistema unificado:
- **Toast queue** bottom-right (1 slot principal) — `toast({ kind, text, actions?, duration? })`.
- **Peek notifications** (3s autodismiss) pra eventos não-críticos: `+50 XP`, `Quest "Salvar a vila" aceita`, `Lyra entrou na campanha`, `Tomou Poção de Cura (+8 HP)`.
- **Action toasts** com botão inline: `⚠️ Borin caiu` + `[💉 Curar]` `[🎲 Death Save]`.
- **Stack max 3** visíveis simultaneamente, FIFO. Recentes empilham acima.
- **Categorias visuais**: success (verde), info (azul), warning (amber), error (vermelho), achievement (dourado-shimmer).
- **Tap toast pra ver detalhes** (expand pra mini-modal in-place).
- Integra combo SFX existente (β.1).

#### ο.7 Visual Rhythm + Mode Transitions (~1.5h)
Microinteractions já existem (ζ); falta **orquestração cinematográfica**:
- **Entrar em combate** = vinheta vermelha fade-in 400ms + dock muda cor (border-top blood) + initiative ribbon slide-up + SFX "drums of war".
- **Sair de combate** (vitória) = vinheta dourada 800ms + XP toast cascading + level-up overlay se procede.
- **Sair de combate** (derrota) = vinheta preta fade-in + drone som + opção "Restart from last save".
- **Scene change** (location muda) = pulse no header + flash de location-name 1.2s (refinar γ.3).
- **Long rest** = "dissolve to dawn" — fade tela pra dourado-pálido 1.5s, restore values com tick animation no party panel.
- **Revive** (HP volta de 0) = vinheta cura verde 600ms + chime SFX + party member glow pulse.
- **Tab switches em combat** com slide-X 200ms (não cut bruto).
- **Death drama** já existe (c779ae5 vinheta vermelha + tombstone). Manter, refinar timing.
- `prefers-reduced-motion` respeitado em TODAS (fallback instant).

#### ο.8 Density Profiles + UX Settings (~1h)
Tela hoje tem 1 tamanho fixo. Adicionar **configs de tela** no overflow menu:
- **3 perfis densidade**: Compacto / Padrão / Confortável — affects padding/font/hit-targets globalmente.
- **Font scale** 0.9× / 1.0× / 1.15× / 1.3× (acessibilidade) salvo localStorage `ux.fontScale`.
- **Contraste boost** toggle — intensifica gold/blood, dim background +10%.
- **Tap target boost** — hit targets 44 → 56px (devices com touch fino tipo Apple Pencil).
- **Animação speed** — Slow / Normal / Fast / Instant (overrides prefers-reduced-motion override-wins).
- **Typewriter speed** — Instant / Slow / Normal / Fast (resolve issue de leitores rápidos).
- Tudo salva em `localStorage.uxPrefs` JSON.

**Métricas-alvo**:
- `time_to_first_action`: hoje desconhecido, meta <8s pós-narração inicial
- `chat_open_per_coop_session`: meta >5 (com pill flutuante deve subir)
- `topic_drill_completion_rate`: do tap em tópico até action emitted, meta >85%
- `mode_transition_smooth_pct`: medir frame rate em combate-entry (alvo 60fps)

**Commit sugestão**:
- `feat(ui-ο.1+2): status ribbon + chat perfeito` (~4h)
- `feat(ui-ο.3+4): action dock topicizado + initiative ribbon` (~3.5h)
- `feat(ui-ο.5+6): sheets stack + toast system` (~3h)
- `feat(ui-ο.7+8): transitions + density profiles` (~2.5h)

Total 4 commits OU 8 separados (1 por sub-sprint).

---

### Sprint η — "Mestre que Joga D&D de Verdade" (~10h)

**Hipótese**: o player não sente que está jogando D&D 5e — sente que está jogando "narrativa com dado". Mecânicas profundas (feats, traits, advantage) faltam.

#### η.1 Database de Feats PHB (~3h)
40+ feats do PHB (Alert, Lucky, Great Weapon Master, Tough, War Caster, etc) em `src/dnd/feats.ts`. Cada feat: prerequisite, effect text, mecânica server-side onde aplicável (ex: Alert = +5 initiative). Wire em wizard step "ASI ou Feat?".

#### η.2 Personality (Traits/Ideals/Bonds/Flaws) estruturado (~2h)
Estrutura no CharacterSheet (já tem `personalityTraits[]` mas não populado pelo wizard). Cada background tem 6 traits + 6 ideals + 6 bonds + 6 flaws aleatórios (PHB cap 4). Wizard novo step (opcional, skip-able) "Personalidade". DM lê e usa em narrações.

#### η.3 ASI choice em nv 8/12/16/19 (~1h)
Hoje só nv 4 tem `plannedLevel4Choice`. Estender pra ASI choice automática em todos os níveis ASI PHB. Pop-up "Escolhe: +2 atributo ou feat" ao level up.

#### η.4 Advantage/Disadvantage genérico (~2h)
`rollD20WithMode(mode: 'normal' | 'advantage' | 'disadvantage')` em `dice.ts`. DM pode emitir `apply_advantage` tool. Conditions já existentes (caído = disadv ataques ranged) aplicam automaticamente. Visual: dado mostra 2d20 com highlight no escolhido.

#### η.5 Prepared spells UI rica (~1.5h)
Caster com spellbook (Mago) ou known-spells (Bruxo/Feiticeiro) precisa de tela "Preparar magias" pós long rest. Hoje campo existe (`spellsPrepared`) mas player nunca seleciona. Modal preparado: lista magias da classe, marca quais quer "preparar" pra essa aventura. Limite = int/wis mod + nv classe.

#### η.6 Saving throws explícitos na UI (~0.5h)
Hoje saves do PJ acontecem via `pendingSave` mas roll visual é genérico. Mostrar fórmula completa: "Save SAB (DC 15) — você rola d20 + 2 (mod SAB) + 2 (proficiência) = total". Player aprende D&D vendo.

**Métricas-alvo**:
- `spells_prepared_per_session` (novo): >2 em casters
- `feat_picked_at_level_up` (novo): >50% das escolhas
- Players que mencionam trait/bond em ação custom: medir

**Commit**: `feat(dnd-η): mestre joga D&D real — feats + personality + advantage`

---

### Sprint θ — "Inventário Vivo" (~8h)

**Hipótese**: inventário hoje é lista crua de strings. Tirar emoção do loot, sem aspiração por equipamento.

#### θ.1 Weapon database completa (~2h)
PHB ~30 weapons em `src/dnd/weapons.ts`: simple/martial/melee/ranged/finesse/heavy/light/loading/reach/thrown/two-handed/versatile/ammunition. Cada uma: damage dice + damage type + properties + cost + weight. DM consulta pra descrever ataques fielmente.

#### θ.2 Armor + Shield database (~1h)
PHB 13 armors em `src/dnd/armors.ts`: light/medium/heavy, AC formula (com/sem DEX limit), stealth disadvantage, strength req, cost, weight. Shield separado (+2 AC).

#### θ.3 Magic items tier 1 (10 commons + 5 uncommons) (~2h)
Bag of Holding, Bracers of Defense, Cloak of Elvenkind, Boots of Striding, Headband of Intellect, Pearl of Power, Wand of Magic Missiles, Ring of Protection, Cape of the Mountebank, Belt of Hill Giant Strength. Cada um: mechanical effect server-side + tooltip.

#### θ.4 Shop com rarity tiers (~1h)
Hoje shop genérico. Adicionar tier visual: ⚪ Common · 🟢 Uncommon · 🔵 Rare · 🟣 Very Rare · 🟠 Legendary. Cores nos cards + filter por tier. Loja pode ter "comum" sempre, "incomum" 30% chance, "raro" pra grandes cidades.

#### θ.5 Equip slots claros (~1h)
Inventory atual: lista flat. Refactor visual: 3 zonas claras: ARMA principal · ARMA secundária · ARMADURA · ESCUDO · ACESSÓRIO ANEL · etc. Drag-and-drop opcional (toggle), default tap-to-equip.

#### θ.6 Encumbrance opcional (~1h)
Toggle no settings: "Regras de peso PHB" on/off. Se on, calcula peso total vs carga (STR × 15). Over → speed reduced. Default off (PHB já considera "variant rule" geralmente off).

**Métricas-alvo**:
- `magic_item_acquired_per_session`: >0.5
- `weapon_unique_weapons_used`: >2 por PJ em vida
- Players que olham inventory >3x por sessão: medir

**Commit**: `feat(dnd-θ): inventário vivo — weapons + armors + magic items + rarity`

---

### Sprint ι — "Sessão Que Convida Voltar" (~7h)

**Hipótese**: hoje player joga 1 sessão e some. Não há gancho emocional pra voltar amanhã.

#### ι.1 Highlight automático compartilhável (~2h)
DM detecta momentos chave (crit nat 20, morte de PJ/boss, quest concluída, descoberta importante) e gera um "highlight" — card visual com narração + ilustração emoji + tag + timestamp. Botão "Compartilhar" gera URL pública `/highlight/{id}` com OG image básico. Vira viral.

#### ι.2 "Continue de onde parou" rico no home (~1h)
Hoje home lista crônicas com ID + sessionN + data. Adicionar PREVIEW: última narração (140 chars + reticências), location atual, PJs no party, HP atual. Player abre, lê, lembra, clica "Continuar".

#### ι.3 Cemitério com cause of death (~1.5h)
Hoje tumba tem nome+epitáfio+raça/classe. Adicionar: cause of death (boss que matou, último golpe), last words gerados pelo DM no momento de morrer ("Foi o orc maldito... o frio sobe..."), tempo vivo da campanha. Drama lúdico.

#### ι.4 Milestones visuais na sessão (~1h)
Quando crit/morte/level up/boss kill/quest done acontece, marca um chip dourado na timeline da sessão. Player vê "🏆 3 grandes momentos hoje" no fim. Pode ver replay simplificado.

#### ι.5 "Vidas em risco" badge no home (~0.5h)
Se PJ tem currentHp < 50% em sessão pausada, badge "⚠ Borin está ferido" no card da crônica. Convida volta urgente.

#### ι.6 Session recap automático ao retomar (~1h)
"Anteriormente..." já existe pra sessão 2+. Adicionar opção de "ver narração completa anterior" (último 20 linhas) ao abrir sessão pausada. Player não fica perdido.

**Métricas-alvo**:
- `session_resumed_within_24h`: >40%
- `highlight_shared_link_clicked`: track conversion
- Tempo médio entre sessões do mesmo PJ: reduzir

**Commit**: `feat(retention-ι): sessão convida voltar — highlights + preview + cemitério rico`

---

### Sprint κ — "Onboarding de Mestre" (~6h)

**Hipótese**: novato perdido. Termos D&D não explicados, mecânicas só descobertas tropeçando.

#### κ.1 Tutorial interativo guiado primeira sessão (~2h)
Overlay tipo Duolingo na 1ª sessão: passo a passo "1. Leia a cena. 2. Clique em uma ação ou digite livre. 3. Quando aparecer dado, role." Cada passo highlight visual do componente. localStorage flag por user.

#### κ.2 Glossário com botão "?" universal (~1h)
Botão "?" no header da campanha abre modal Glossário: termos D&D explicados em PT-BR coloquial — DC, AC, save, advantage, crit, nat 20, slot, cantrip, prof bonus, etc. Cada termo searchable. Pode abrir do skill check overlay também.

#### κ.3 Hints contextuais em mecânicas novas (~1.5h)
Quando combate começa pela 1ª vez → hint "Cada turno você tem 1 ação + 1 bônus + 1 reação + movimento". Quando magia 1ª vez → "Toque na magia, escolha alvo". Quando descanso → "Curto: recupera HD. Longo: recupera HP+slots". Flag por mecânica em localStorage.

#### κ.4 "Modo Treino" — sessão tutorial pré-fab (~1h)
Card extra no home: "🎓 Modo Treino — aprende D&D em 10 min". Cenário scripted: anão entra na taverna, 1 perception check, 1 conversa, 1 encontro fácil (1 goblin), 1 level up. Player faz, sente como funciona, depois cria PJ real.

#### κ.5 Tooltip permanente em conditions/skills (~0.5h)
JÁ TEM em conditions (β.4). Estender pra TODA aparição de skill name, ability score, weapon property. Tooltip explica em 1 linha.

**Métricas-alvo**:
- `tutorial_completed_pct`: >70% dos novos players
- `glossario_opened_per_session`: >1 nas 3 primeiras sessões
- `time_to_first_combat_understanding`: subjetivo via survey

**Commit**: `feat(onboarding-κ): novato vira mestre — tutorial guiado + glossário + hints`

---

### Sprint λ — "Combate Cinematográfico" (~7h)

**Hipótese**: combate funciona mecanicamente mas falta DRAMA. Spell sem efeito visual, boss sem mecânica especial, crit sem narração épica.

#### λ.1 Action layer unification (β.1 pendente, ~1.5h)
Refactor combat-screen: hierarquia clara — chips dinâmicos (DM sugeridas) primeiro, action grid (8 ações) segundo sob "⋯ mais", class features sob outro "⋯", economy compacto inline no header. Mobile dock já tem isso bem.

#### λ.2 Spell visual effects por escola (~2h)
Fireball cast = pequena anim CSS partícula vermelha · Healing Word = verde · Magic Missile = setas roxas · Shield reaction = halo azul. CSS-only com keyframes + position absolute. Respeita reduced-motion.

#### λ.3 Enemy AI variada por arquetipo (~2h)
Hoje todo enemy "ataca PJ mais fraco". Adicionar 4 patterns: 🩸 Bruto (ataca quem tankou último) · 🎯 Sniper (ataca caster) · 🛡 Guardião (protege aliado) · 🃏 Trickster (debuff antes de dano). Cada bestiary monster ganha 1 pattern.

#### λ.4 Boss mechanics multi-fase (~1h)
Boss com `phases: [{ hpThreshold: 100, abilities: [...] }, { hpThreshold: 50, abilities: [...] }]`. Quando HP cruza threshold, DM narra mudança ("o orco arranca a corrente do braço — agora ataca em frenesi"). Adiciona 1-2 abilities novas. Aumenta drama.

#### λ.5 Crit narrado dramaticamente (~0.5h)
Hoje nat 20 = damage dobrado + visual. Adicionar: DM RECEBE info de crit + narra especial ("a espada de Borin atravessa a armadura como manteiga"). Server passa flag `wasCritical` no prompt do próximo narrate.

**Métricas-alvo**:
- `combat_rounds_avg`: hoje desconhecido, meta 3-5
- `boss_killed_with_phase_change`: track
- `crit_narration_quality`: subjective

**Commit**: `feat(combat-λ): combate cinematográfico — action layer + spell vfx + boss phases`

---

### Sprint μ — "Mestre Que Não Falha" (~6h)

**Hipótese**: `narration_error` rate 15-50% em prod (dado verificado). Cada erro = player vê "Mestre travou" e perde imersão.

#### μ.1 Streaming SSE servidor (γ.1 pendente, ~2h)
Provider retorna chunks via async iterator. Server emit `dmNarrationChunk` socket events. Client renderiza char por char (já tem CSS `is-streaming`). Sensação "DM digitando". Reduz time-to-first-char de 3-5s pra <800ms.

#### μ.2 Cache de prompts comuns (~1.5h)
Sistema prompt + DM Tools são fixos (~7KB tokens). Hoje refeito a cada call. Adicionar prefix caching (suportado por Anthropic/Gemini com flag). Reduz tokens custo + latência 30-50%.

#### μ.3 Provider health monitoring auto-swap (~1.5h)
Cascade atual tenta em ordem fixa. Adicionar: track last_n_errors por provider; se >30% nas últimas 10 chamadas, promove próximo provider pra primário automaticamente. Reverte após 5 sucessos. Auto-cura sem deploy.

#### μ.4 Pre-fetch speculative (γ.2 pendente, ~1h)
Quando player começa a digitar action custom, dispara LLM call em background com input parcial. Se enviar, usa resultado. Se mudar/cancelar, ignora. Economiza 2-3s percebidos.

**Métricas-alvo**:
- `narration_error_rate`: hoje 15-50% → meta <5%
- `time_to_first_char` (novo, streaming): <800ms p50
- `llm_tokens_per_session`: reduzir 30% com cache

**Commit**: `feat(reliability-μ): mestre não falha — streaming + cache + auto-swap`

---

### Sprint ν — "Coop de Verdade" (~5h)

**Hipótese**: coop até 3 funciona mecânicamente mas falta SENSAÇÃO de companhia. δ.1/δ.3/δ.5 pendentes do POLISH GERAL.

#### ν.1 Presence indicators completos (~1.5h)
Socket events `playerTyping`, `playerRolling`. Party panel mostra dot verde/cinza online/offline. Quando aliado digita ação custom, "Lyra está digitando…" pequeno abaixo do nome. Quando aliado vai rolar skill, "Sina está rolando…".

#### ν.2 Chat polish (avatar+timestamp+badge) (~1.5h)
Camp-chat-bar hoje minimalista. Cada mensagem ganha: avatar emoji (raça/classe), nome, timestamp curto ("agora", "2m", "1h"). Notification badge no chat se nova msg enquanto modal aberto. Long-tap pra react com emoji.

#### ν.3 Lobby personality picker com preview (~1h)
Host hoje escolhe DM personality (sombrio/sarcástico/trickster) sem saber a diferença. Adicionar preview de narração curta por opção: hover/tap mostra exemplo de 1 frase ("Sombrio: 'A taverna range. Algo te observa.'").

#### ν.4 Coop sync robusto (~1h)
Quando player B entra em sessão ativa, vê últimas 5 narrações + state completo imediatamente. Hoje pode atrasar. Server sempre envia snapshot completo no joinCampaign — refactor pra garantir.

**Métricas-alvo**:
- `coop_sessions_pct`: hoje desconhecido, meta >20%
- `chat_messages_per_coop_session`: >5
- `coop_player_drop_during_session`: <10%

**Commit**: `feat(coop-ν): coop de verdade — presence + chat rico + lobby preview`

---

### Sprint ξ — "Pendências Acumuladas" (~4h)

**Hipótese**: 6 pequenos fixes pendentes dos sprints POLISH anteriores. Limpar a casa antes de partir pra features grandes.

- ξ.1 ε.6 IndexedDB session resilience (~1.5h) — cache state offline, hidratar em ≤2s
- ξ.2 α.5 pre-warm LLM (~30min) — fetch HEAD nos providers no joinCampaign
- ξ.3 ζ.6 audit 5 viewports + screenshots (~1h) — quando preview tool voltar a funcionar
- ξ.4 BUG-002 tutorial exploração não dispara em rejoin (~30min) — fix race condition state↔narration
- ξ.5 BUG-004 spell slots nv 6-9 ausentes (~30min) — preencher tabela PHB completa
- ξ.6 BUG-005 Pact magic regenera em short rest (~30min) — fix Bruxo

**Commit**: `chore(ξ): pendências limpadas — IndexedDB + pre-warm + audit + 3 bugs antigos`

---

## 4. Cronograma de execução

```
Sprint ο  (Pegada Uber — Tela Viva)  ~12h  →  4 commits (status+chat / dock+initiative / sheets+toasts / transitions+density)
Sprint η  (Mestre joga D&D)          ~13h  →  6 commits (feats engine / personality / ASI ext / advantage / prepared / saves UI)
Sprint θ  (Inventário Vivo)          ~8h   →  3 commits (weapons / armors / magic items)
Sprint ι  (Convida Voltar)           ~7h   →  2 commits (highlights / cemitério)
Sprint κ  (Onboarding Mestre)        ~6h   →  2 commits (tutorial / glossário)
Sprint λ  (Combate Cinematográfico)  ~7h   →  2 commits (action layer / spell vfx)
Sprint μ  (Mestre Não Falha)         ~6h   →  2 commits (streaming / monitoring)
Sprint ν  (Coop de Verdade)          ~5h   →  2 commits (presence / chat polish refino)
Sprint ξ  (Pendências)               ~4h   →  1 commit batched

Total: ~68h, 24 commits feature + handoffs entre
```

Cada commit: tests novos passando, typecheck OK, push origin/main. Deploy manual Render quando necessário.

### Ordem recomendada (por ROI/dependência)

1. **ο** (Pegada Uber — Tela Viva) — interface é alma. UX dinâmica é fundação visual; todas as features futuras vão habitar essa tela. Sem UI viva, mecânica não brilha. **Memória `feedback_interface_alma` exige este foco**.
2. **η** (D&D fidelidade) — base mecânica D&D real. Sem feats/traits/advantage, mestre não tem alma mecânica.
3. **ξ** (pendências) — limpa terreno antes de feature grande. Bugs P1 saem.
4. **κ** (onboarding) — novato chegando precisa entender ANTES de mais features chegarem.
5. **λ** (combate cinematográfico) — combate é coração mecânico, drama eleva. ο.7 (mode transitions) já abriu caminho.
6. **θ** (inventário vivo) — loot recompensa, mas só faz sentido se combate é dramático (λ primeiro).
7. **ι** (convida voltar) — retention só importa se experiência é boa (ο/η/λ/θ primeiro).
8. **μ** (mestre não falha) — qualidade LLM sustenta tudo, mas streaming é refactor — fazer quando hipótese central provada.
9. **ν** (coop refino) — ο.2 já entrega chat perfeito; ν só refina presence + lobby preview.

---

## 5. Métricas-validação consolidadas

| Métrica | Hoje | Pós-plano |
|---|---|---|
| Fidelidade D&D 5e PHB | ~70% | **>85%** |
| narration_error_rate | 15-50% | **<5%** |
| time_to_first_char (streaming) | n/a | **<800ms** |
| spells_prepared_per_session (casters) | 0 | **>2** |
| feats_picked_at_level_up | 0% | **>50%** |
| tutorial_completed_pct (novos) | n/a | **>70%** |
| session_resumed_within_24h | desconhecido | **>40%** |
| coop_sessions_pct | desconhecido | **>20%** |
| magic_item_acquired_per_session | 0 | **>0.5** |
| highlight_shared_link_clicked | n/a | **>15% das sessões** |
| Tests totais | 1179 | **1320+** |
| Bugs P1/P2 abertos | 4 | **0** |
| **UX (Sprint ο)** | — | — |
| time_to_first_action | desconhecido | **<8s pós-narração inicial** |
| chat_opens_per_coop_session | n/a | **>5** |
| topic_drill_completion_rate | n/a | **>85%** |
| mode_transition_fps | n/a | **60fps** |
| ui_density_pref_changed | n/a | **track distribution** |
| toast_actions_clicked_pct | n/a | **>30% nos actionable** |

Métricas qualitativas (validar via playtest):
- "Esse jogo é D&D de verdade" — sim/não
- "Eu entendi as mecânicas" — sim/não
- "Quero jogar amanhã" — sim/não
- "Coop foi divertido" — sim/não (se aplicável)

---

## 6. O que NÃO está nesse plano

Cortado explicitamente — fora do escopo:

- ~~Voice DM (TTS narration)~~ — Voice TTS opcional já existe
- ~~Native mobile app~~ — DOM puro mantido (PWA cobre)
- ~~Internationalization~~ — pt-BR-only por design
- ~~Multi-language LLM~~ — DM responde em pt-BR
- ~~Custom monster builder~~ — bestiary atual cobre
- ~~PvP combat~~ — coop é cooperativo por design
- ~~Modding API~~ — over-engineering
- ~~Replay system completo~~ — milestones cobrem suficientemente
- ~~Maps grid/movement tático~~ — D&D theater of mind é a aposta
- ~~Sistema de fé/divindades~~ — cleric/paladin abstraem via classe
- ~~Crafting system~~ — fora do escopo, shop cobre necessidade
- ~~Sound design completo (música original)~~ — trilha procedural cobre

Se sobrar tempo em algum sprint, prioridade é **playtest qualitativo** > adicionar mais features.

---

## 7. Como cada sprint constrói o próximo

| Sprint | Entrega | Próximo usa |
|---|---|---|
| **ο** | status ribbon, chat perfeito, dock topicizado, sheets stack, toast system, mode transitions, density profiles | η habita action dock topicizado; λ herda mode transitions; ν refina chat ο.2; toda feature futura usa toast/sheets |
| η | feats engine, personality estruturado, advantage genérico, ASI estendido, prepared spells, saves UI | λ usa feats em combate + Action Dock ο.3 abriga novas ações; ι usa traits no cemitério |
| ξ | bugs limpos, IndexedDB | μ usa IDB pra cache local de prompts |
| κ | tutorial framework, glossário | toda mecânica nova vira hint contextual aqui; ο.8 density profile já tem settings escopo |
| λ | action layer unificada, spell vfx, boss multi-fase | θ usa enemy AI variada pra dropar magic items; ο.7 transitions já entrega entry/exit combat |
| θ | weapons/armors/magic items database | ι usa magic items como highlight + cemitério "morreu portando X" |
| ι | highlight infrastructure + share | DM usa highlight como callback ("lembra do crit?") |
| μ | streaming + cache + auto-swap | toda narração futura é instantânea |
| ν | presence indicators + lobby preview | coop vira default real; chat já entregue em ο.2 |

**Sem desperdício. Cada peça serve múltiplas seções. Sprint ο é a fundação visual que todo o resto habita.**

---

## 8. Decisões grandes pra discutir antes

### D7 — Sprint ο.2 (chat): floating pill ou inline bar atual?
- Pill flutuante reduz fricção de abrir chat mas pode tampar UI em portrait estreito (360×640). Inline bar mantém status quo mas exige scroll pra ver narration.
- **Recomendação**: floating pill 40×40px canto inferior-direito, **com auto-hide** se inativo >10s e narration em foco. Coop only. Solo esconde.

### D8 — Sprint ο.3 (action dock): 4 tópicos ou 5-6?
- 4 tópicos cabem perfeitamente em 360px (2x2 grid 80×80px). 5-6 exigem scroll ou diminuir tamanho.
- **Recomendação**: **4 tópicos primários** sempre visíveis (Combate/Explorar/Social/Magia se caster) + slot "⋯ Mais" expansível pra Inventory/Rest/etc. Custom action = 5º card.

### D9 — Sprint ο.5 (sheets stack): max layers?
- Quantas sheets podem empilhar? 2 é prático (inventory → cast spell). 3+ vira labirinto.
- **Recomendação**: **max 2 layers**. Tentar abrir 3º substitui o topmost (não empilha).

### D1 — Sprint η.1 (feats database): full PHB ou top 20?
- PHB tem ~40 feats. Implementar todos = ~3h. Top 20 mais usados = ~1.5h.
- **Recomendação**: top 20 inicial (Alert, Lucky, GWM, Tough, War Caster, Sentinel, Sharpshooter, Mage Slayer, Polearm Master, Crossbow Expert, Mobile, Defensive Duelist, Lucky, Resilient, Tough, Magic Initiate, Skill Expert, Inspiring Leader, Healer, Telekinetic). Adicionar mais conforme demanda.

### D2 — Sprint θ.6 (encumbrance): default on ou off?
- D&D 5e PHB lista como "variant rule" — geralmente off.
- **Recomendação**: toggle no settings, default OFF. Hardcore players ligam.

### D3 — Sprint μ.1 (streaming SSE): refactor mexer no provider abstraction?
- DMProvider interface hoje `generate(): Promise<DMRawResponse>`. Streaming exige `generateStream(): AsyncIterator`.
- **Recomendação**: adicionar como método OPCIONAL no interface. Providers que não suportam (FallbackDM) continuam não-stream. Cascade ordena providers stream-capable primeiro.

### D4 — Sprint κ.1 (tutorial Duolingo-style): bloqueante ou dismissable?
- Bloqueante força aprendizado mas chato.
- **Recomendação**: dismissable com "Pular tutorial" bem visível. Telemetria mede quantos completam.

### D5 — Sprint ι.1 (highlight share): página pública gera OG image dinâmica?
- OG image dinâmica requer endpoint backend que renderiza HTML→PNG (Puppeteer/Satori). Custo médio.
- **Recomendação**: começar SEM OG image (só metadata estático). Adicionar OG dinâmico apenas se share virar viral real.

### D6 — Sprint λ.2 (spell vfx): CSS-only ou Canvas?
- CSS-only é leve, sem dep, performant. Canvas dá controle granular mas custo.
- **Recomendação**: CSS-only com keyframes + position absolute. Validado já em β.3 (damage tick, death cross).

---

## 9. Princípio guia final

> "JSgame não vai ser **mais um** RPG online. Vai ser **o D&D 5e que cabe no bolso** — fiel, intuitivo, gostoso, ágil. Cada player que abre o app deve sentir: 'isso é D&D real, jogável em qualquer lugar, em qualquer momento'. A IA é o Mestre que sempre tá disponível, lembra de você, narra com peso. O mobile é o livro de regras + tabuleiro + ficha tudo em 360 pixels."

A IA é o **coração** ❤️ · o mobile é o **corpo** 💄 · o D&D real é o **esqueleto** 🦴 · o polish é a **pele** ✨ · agora **as mecânicas viram a alma** 🪶 — onde cada decisão do player é regra real, cada vitória é épica, cada morte tem peso.

---

## 10. Próximo passo

**Recomendação revisada**: começar pelo **Sprint ο** (Pegada Uber — Tela Viva). Memória `feedback_interface_alma` já validou: interface é a alma. UX dinâmica é fundação visual que todas as features futuras vão habitar — sem ela, η/λ/θ não brilham.

Sequência ideal:
1. **Sprint ο** primeiro (~12h, 4 commits batched) — entrega tela viva, chat perfeito, dock topicizado, mode transitions, density.
2. **Sprint η** segundo (~13h, 6 commits) — mecânica D&D real habita a tela viva de ο. Feats funcionam, advantage rola 2d20 visíveis, prepared spells via modal sheet (ο.5 stack).
3. **Sprint ξ** depois — limpa 6 pendências antigas (IndexedDB, pre-warm, audit, bugs).
4. Resto conforme dependências da seção 4.

Na próxima sessão:
1. Eu leio este plano + handoff atualizado
2. Decisões D1-D9 confirmadas em 5 min
3. Executo ο.1+ο.2 primeiro (status ribbon + chat perfeito, ~4h) → commit batched
4. Você revisa visual no preview / device → ajustamos antes de seguir pra ο.3+ο.4

Pode ser também:
- Começar **direto por ο.2 (chat)** se for prioridade afirmada (~2.5h focado)
- Começar **Sprint η** se preferir D&D mecânica primeiro (~13h)
- Começar **Sprint ξ** (pendências) se quiser limpar antes de escalar (~4h fixos)

**Cronograma realista**: 9 sprints × ~1.3 sessões cada = ~12 sessões. Em ~14-16 conversas, JSgame vira referência de "D&D 5e mobile com IA Mestre + UX viva".
