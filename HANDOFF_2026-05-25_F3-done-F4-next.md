# JSgame — Handoff 2026-05-25 (F3 done · F4 = next)

> **Pra retomar a sessão**: cola isso no início da próxima conversa:
> *"Lê `C:\Users\JOÃO\JSgame\HANDOFF_2026-05-25_F3-done-F4-next.md`. F3 deployed, jogo já tem Mestre IA + exploração funcionando. Quero F4 (combate D&D real)."*

---

## 1. Estado atual (o que JÁ funciona)

| Fase | Status | Commit |
|---|---|---|
| **F1 — Foundation** (Vite+TS+Socket.io+SQLite+D&D core) | ✅ | `b4279f9` |
| **F2 — Wizard de criação de PJ** (5 steps, point buy, 13 raças, 12 classes, 13 antecedentes) | ✅ | `875d7e9` + 3 fixes |
| **F3 — Mestre IA + Modo Exploração** (DM Groq Llama 3.3 + ações + skill check d20) | ✅ | `b234293` |
| **F4 — Combate D&D real** | ⏳ próxima | — |
| **F5 — Polish + Coop multi-player** | ⏳ depois | — |

**Stack consolidado**: Vite + TypeScript strict + Socket.io + Express + sql.js + groq-sdk + @anthropic-ai/sdk · DOM puro · mobile-first.

**Última verificação**: tsc clean, 58/58 vitest passando, server boot OK com `dmProvider: "groq", hasGroq: true`.

---

## 2. Como rodar (próxima sessão começa por aqui)

```powershell
cd C:\Users\JOÃO\JSgame
npm run dev          # sobe backend (3001) + frontend (5173) concurrent
```

Abre **http://localhost:5173** (desktop) ou **http://192.168.15.3:5173** (mobile mesma WiFi).

### Fluxo do jogo já implementado

1. Home → digita nome de jogador
2. **⚔ Novo Personagem** → wizard 5 steps (Raça → Classe → Atributos point buy 27 → Antecedente → Revisão+Save)
3. Volta pra Home com personagem salvo
4. **▶ Jogar** no card do personagem → entra na campanha
5. Mestre IA narra cena de abertura
6. Player clica botão de ação (🔍 Explorar, 🗣 Falar, ⚔ Atacar, etc) OU digita ação livre
7. Mestre IA responde, pode pedir skill check
8. Banner "🎲 Rolar d20" aparece → overlay animado → resultado + narrativa de consequência

---

## 3. O que F4 precisa entregar (próxima fase)

### F4 — Combate D&D 5e real (~10-14h)

Hoje o `start_combat` tool grava enemies no `campaign.state.combat` mas **não há UI de combate ainda**. F4 entrega:

**Server-side**:
- `src/server/combat.ts` (NOVO): engine de combate D&D
  - `rollInitiative(party + enemies)` — d20 + Des mod por participante, ordena
  - `getCurrentTurn()` / `nextTurn()` — gerencia turn order
  - `Player Action`: Ataque (d20+prof+str/dex vs CA, dmg dice), Esquivar, Disparada (×2 mov), Desengajar, Ajudar, Esconder, Preparar, Usar Item, Lançar Magia (placeholder)
  - `Enemy AI`: simples — escolhe alvo aleatório vivo, ataca com `attackBonus` declarado pelo DM
  - **Action economy**: 1 Ação + 1 Bônus + Movimento + Reação por turno
  - 14 condições do Apêndice A aplicáveis (já tem em `dnd/conditions.ts`)
  - HP a 0 = inconsciente (não morto — death saves opcional V2)
- `src/server/dm/prompts.ts`: novas tools `enemy_attack`, `enemy_cast_spell`, `apply_condition`, `end_combat_with_outcome` (vitória/derrota narrada pelo DM)
- `src/server/dm/tools.ts`: validar essas tools (clamp ataque, condições válidas)
- `src/server/campaign.ts`: integrar combat engine. Modo `combat` ativa overlay de combate.
- `src/server/index.ts`: novos socket events `combatAction` (ataque/esquiva/etc), `endTurn`

**Client-side**:
- `src/client/combat/combat-screen.ts` (NOVO): UI de combate
  - Initiative tracker (lista vertical com participante atual destacado)
  - Player turn: botões Ataque (drag em enemy ou click), Esquivar, Disparada, etc
  - Enemy portraits com HP bar + condições + AC
  - Log de combate (ataques, dano, condições aplicadas)
- `src/client/combat/attack-overlay.ts` (NOVO): visualização de ataque
  - d20 anim → hit/miss vs CA → damage roll → result
  - Mesma estética do skill-check-overlay
- `styles.css`: section combat (~400 linhas)

**Tests**:
- `src/dnd/__tests__/combat.test.ts`: initiative ordering, attack roll vs AC, damage calculation, condition application

**Verify**: smoke real — criar PJ → começar sessão → Mestre cria combate (player digita "ataco o goblin") → UI combat abre → roleia initiative → player ataca → enemy ataca → vitória/derrota → volta pra exploration mode.

### Decisões de design pendentes pra F4

1. **Death saves** ou **inconsciente até cura**? Recomendação: simplificar — HP=0 = inconsciente, party pode curar; só morre se DM `apply_damage` em PJ inconsciente.
2. **Enemy AI** quão esperto? Recomendação: random target alive → ataca. DM pode override via tool `enemy_action_custom` futuramente.
3. **Magias**? Recomendação: stub no F4 (carta-genérica "Lançar Magia → narra como gostaria") e implementar lista real de magias D&D em F5.
4. **Critical fumble** (nat 1 em ataque)? D&D 5e RAW não tem. Recomendação: seguir RAW (só miss).

---

## 4. Estrutura atual do projeto (mapa pra retomar)

```
C:\Users\JOÃO\JSgame\
├── .env                          # GROQ_API_KEY funcional
├── .env.example
├── .gitignore                    # node_modules, .run-data, *.db, .env
├── .claude/launch.json           # preview tools (jsgame-backend :3001, jsgame-frontend :5173)
├── package.json                  # vite, ts, socket.io, sql.js, groq-sdk, @anthropic-ai/sdk
├── tsconfig.json                 # strict, ES2022, paths @client/@server/@shared/@dnd
├── vite.config.ts                # proxy /api e /socket.io → :3001
├── index.html
├── README.md
├── HANDOFF_2026-05-25_F3-done-F4-next.md   # ⬅ ESTE arquivo
├── .run-data/jsgame.db           # SQLite — characters + campaigns persistidos
└── src/
    ├── client/
    │   ├── main.ts                              # router (home/wizard/sheet/campaign)
    │   ├── api.ts                               # fetch tipado
    │   ├── util.ts                              # el(), escapeHtml, uuid, ownerName
    │   ├── styles.css                           # ~2000 linhas (tema gótico + wizard + campaign + sc)
    │   ├── character-creation/
    │   │   ├── wizard.ts                        # state machine 5 steps (com Object.assign fix)
    │   │   ├── step-race.ts                     # grid 13 raças
    │   │   ├── step-class.ts                    # grid 12 classes
    │   │   ├── step-abilities.ts                # point buy 27 interativo
    │   │   ├── step-background.ts               # 13 antecedentes + picker perícias (estado 1/2 UX)
    │   │   └── step-review.ts                   # ficha completa + save
    │   └── campaign/
    │       ├── campaign-screen.ts               # exploration UI (log + ações + input livre)
    │       └── skill-check-overlay.ts           # d20 animado
    │
    ├── server/
    │   ├── index.ts                             # Express + Socket.io + 5 REST + 4 socket handlers
    │   ├── persistence.ts                       # sql.js: characters + campaigns CRUD (write-throttle 2s)
    │   ├── campaign.ts                          # Campaign engine: startSession/takeAction/resolveSkillCheck
    │   ├── util.ts                              # uuid()
    │   └── dm/
    │       ├── dm.ts                            # DungeonMaster + FallbackDM + extractJson tolerante
    │       ├── prompts.ts                       # SYSTEM_PROMPT D&D + 7 tools
    │       ├── tools.ts                         # validação server-side TODA tool call
    │       └── providers/
    │           ├── base.ts                      # DMProvider interface
    │           ├── groq.ts                      # Llama 3.3 70B (free tier)
    │           ├── anthropic.ts                 # Claude Haiku (pago)
    │           └── factory.ts                   # auto-detect por env
    │
    ├── shared/types.ts                          # CharacterSheet, CampaignState, Socket events
    │
    └── dnd/                                     # Regras D&D 5e (PHB embarcado)
        ├── dice.ts          + __tests__/dice.test.ts       # 14 tests
        ├── attributes.ts    + __tests__/attributes.test.ts # 44 tests
        ├── races.ts                                        # 13 raças/subraças
        ├── classes.ts                                      # 12 classes hit die/saves
        ├── skills.ts                                       # 18 perícias + DCs
        ├── conditions.ts                                   # 14 do Apêndice A
        └── backgrounds.ts                                  # 13 antecedentes
```

---

## 5. Decisões técnicas tomadas (não rediscutir)

| Decisão | Por quê |
|---|---|
| **Vite + DOM puro** (sem Phaser, sem React) | D&D é texto/UI, não canvas. Mobile-first. Mais rápido. |
| **sql.js** (não better-sqlite3) | Usuário sem Visual Studio Build Tools. sql.js é pure-JS. |
| **groq-sdk** direto (não openai SDK) | Já tava no package.json, API similar. |
| **Object.assign** no wizard.update (não spread) | Spread cria new object → step recebe ref obsoleta. Bug crítico F2.fix3. |
| **Footer dentro do dynamic re-render** (steps) | Footer congelava em disabled. Fix em F2.fix1. |
| **Picker de perícias visível ao escolher antecedente** | Estado 1/2 — esconde grid de antecedentes, mostra picker prominente. F2.fix2. |
| **Persona DM Sombrio+Sarcástico+Trickster** (BR coloquial) | Validada no Cave Run. 2-4 frases por narração. Nunca poético. |
| **Validação TODA tool call server-side** | Aprendizado Cave Run — LLM mente, server clampa/sanitize. |
| **Timeout 12s** + retry sem tools em 400 | Llama 4 Scout falha em ~26% calls com tools complexas. |
| **Write-throttle 2s** sql.js flush | Não flushar a cada save (custo I/O). |
| **Mobile body classes** desde o boot | `is-touch`, `is-portrait-narrow`, `vertical-layout` via `--m-vh`/`--m-safe-*`. |

---

## 6. Comandos úteis (próxima sessão)

```bash
# Subir tudo
npm run dev

# Só backend
npm run dev:server    # tsx watch src/server/index.ts (porta 3001)

# Só frontend
npm run dev:client    # vite (porta 5173)

# Typecheck
npm run typecheck     # ou: node node_modules/typescript/bin/tsc --noEmit

# Tests
npm test              # vitest run
npm run test:watch    # vitest watch

# Health check
curl http://localhost:3001/api/health

# DB inspect (SQLite)
# .run-data/jsgame.db — abre com DB Browser for SQLite, ou:
# Tabelas: characters, campaigns. Snapshot JSON na coluna sheet/state.

# Git
git log --oneline | head -10
git status --short
```

---

## 7. O que NÃO está pronto ainda (backlog organizado)

### Crítico pra F4 (combate)
- [ ] Combat engine server-side
- [ ] Initiative tracker UI
- [ ] Attack action (d20 vs CA + damage roll)
- [ ] Enemy AI simples
- [ ] Condition application + display
- [ ] Magic spells (stub no F4, lista real F5)
- [ ] Vitória/derrota → volta exploration mode

### Polish (F5)
- [ ] **Coop multi-player real** — 2-3 players na mesma campanha
- [ ] Detecção de skill check via campaignState.pendingCheck (não regex no texto)
- [ ] Skill check usa skill correto (server tem, cliente mostra placeholder)
- [ ] Short rest + Long rest (Hit Dice spend / spell slots reset)
- [ ] Lista real de magias D&D 5e (~50 spells comuns)
- [ ] Inventory UI completo + equipment swap
- [ ] Death saves opcionais
- [ ] Save de "campanha em progresso" + load
- [ ] PWA (manifest + service worker)
- [ ] Deploy Render

### Nice-to-have (V2)
- [ ] Multi-classe e Talentos (PHB cap 6)
- [ ] Subclasses (Champion, Arcane Knight, etc no nv 3)
- [ ] Combat grid 2D opcional
- [ ] Voice chat integration
- [ ] Mestre IA learning entre campanhas (memória global)
- [ ] Replay de campanhas

---

## 8. Recomendação pra próxima sessão (escolha um)

**Opção A — começar F4 direto** (mais rápido, fluxo natural):
> "Lê HANDOFF_2026-05-25_F3-done-F4-next.md. Implementa F4: combate D&D 5e real. Combat engine server + initiative tracker UI + ataque/esquiva/dano + enemy AI simples. Stub magias pra F5."

**Opção B — validar F3 em coop primeiro** (descobrir bugs reais antes de F4):
> "Lê HANDOFF_2026-05-25_F3-done-F4-next.md. Antes de F4, quero coop básico: 2 players na mesma campanha. Adapta socket events pra broadcast pra room. Smoke test eu + 1 amigo em 2 dispositivos."

**Opção C — polish F3 primeiro** (UX mais sólida):
> "Lê HANDOFF_2026-05-25_F3-done-F4-next.md. Polish F3: detecta skill check via campaignState.pendingCheck (não regex), usa skill correto no overlay, pendingCheck sai de combat também."

**Opção D — você decide na hora**:
> "Lê HANDOFF_2026-05-25_F3-done-F4-next.md. Mostra o roadmap, eu decido."

---

## 9. Aprendizados que valem ouro (não esquecer)

1. **Bugs de state em DOM puro são MUITO chatos de debugar** — `Object.assign` vs spread quase me pegou. Sempre prefira mutar in-place se há múltiplas referências.
2. **HMR do Vite reload nem sempre é confiável pra mudanças de TypeScript** — quando bug parece persistir, peça Ctrl+Shift+R ou aba anônima.
3. **Vitest desde o dia 1 salva retrabalho** — F2 com 58 tests do D&D core garantiu que refatoração de wizard não quebrasse regras.
4. **Server validation > LLM trust** — Cave Run me ensinou: clampe TODA tool call. JSgame nasceu com isso.
5. **Mobile portrait-narrow body class** desde o boot evita CSS desktop-leaky.
6. **Footer dentro do re-render** — se a UI tem state derivado, TODO output deve re-renderizar junto. Closure stale é o inimigo.
7. **DM Groq Llama 4 Scout dá 400 em ~26% das tool calls complexas** — retry sem tools resgata a narração. Llama 3.3 70B versatile é mais estável mas TPD menor.
8. **D&D 5e regras nucleares** que sempre uso: modifier = `floor((score-10)/2)`, proficiency bonus nv 1-4 = +2, DCs padrão 5/10/15/20/25/30, point buy 27 (8=0pts, 15=9pts).

---

## 10. Memórias do Claude que persistem (atualizar depois)

Adicionar em `MEMORY.md`:
- `project_jsgame.md` — info macro do JSgame (path, stack, fases entregues)
- Cave Run continua em `D&D online/` — deploy Render ativo, não tocar.

Memórias velhas que ainda valem:
- `reference_windows_path_amp.md` — `&` no path quebra npm. JSgame em path limpo evita.
- `reference_vite_optimize_quirk.md` — sql.js travava optimizeDeps. JSgame usa sql.js só server-side (não Vite).
- `feedback_design_hugo.md` — refs StS/Hellcards/Hades. NUNCA Vampire Survivors.
- `feedback_ritmo.md` — João prefere execução rápida + decisões executivas.
- `feedback_separacao_projetos.md` — Cave Run e JSgame em pastas separadas. Nunca cruzar.

---

**FIM DO HANDOFF.** Cole o início desta página na próxima conversa pra retomar do zero com contexto completo.
