# JSgame · Plano executável próximas 3 rodadas

> **Estado inicial**: 414/414 tests verdes, typecheck limpo, 30 commits acumulados pra push prod. A+B+C completos. PT-BR único (i18n descartado por enquanto). Zero-budget mantido.

## 🎯 Critérios universais (todas as rodadas)

- **Tests verdes a cada commit**: `npm test -- --run` + `npm run typecheck` ANTES de cada `git commit`. Se quebrar, fix antes de prosseguir.
- **Commit semântico por sub-task**: `<código> — <título> (<resumo>)` + Co-Authored-By trailer.
- **Sem entrar em F28 (inventory profundo)** — vetado pelo João.
- **Sem sugerir serviço pago** — zero-budget inviolável.
- **Não tocar em Cave Run** (`C:\Users\JOÃO\D&D online\`).
- **Mobile-first**: cada UI nova precisa funcionar em viewport 375x812 (testar via preview_resize).
- **Parar em 80% janela contexto** e fazer handoff parcial. Não acumular trabalho sem commit.

## 🚦 Pré-rodadas (executar ANTES da Rodada 1)

### P1 — Push pra prod (~10 min)
Validar deploy de 30 commits acumulados em Render.

**Passos**:
1. `git status` confirma nada uncommitted local.
2. `git push origin main`.
3. Aguardar Render build (~2-3 min). Acompanhar via `gh run list` se houver workflow ou dashboard manual.
4. Smoke: `curl -s https://jsgame-drpe.onrender.com/api/health | head -c 200` → verificar `"ok":true` + `dmProvider:"gemini"`.
5. Se Gemini retornar 401, garantir `GEMINI_API_KEY` setada no Render dashboard.

**Critério done**: `/api/health` retorna ok + dmProvider gemini + hasGemini true em prod.

### P2 — Playtest E2E coop (depende de amigo do João)
Antes de seguir, João + amigo abrem 2 sessões e testam:
- Coop visibility (echo de ação + chat livre).
- Reconnection (cair wifi 30s, volta automático).
- Tutorial first-combat aparece pra novo player.
- Mobile combat tabs (se algum jogar pelo celular).

**Critério done**: lista de bugs específicos coletada (console F12 + server log). Pode ficar pendente sem bloquear rodadas técnicas; só prioriza bug-fix se aparecer regressão crítica.

---

## 📦 RODADA 1 — Fix gaps de visibility + variedade DM (~8h)

> **Objetivo**: completar feedback visual mecânico (sem isso F23/F25/A2 ficam invisíveis no client) + adicionar 5 estilos narrativos. Cobre 3 sub-tasks independentes.

### 1A — Racial damage profile auto-populated (~2h)

**Por quê**: F26 implementou resistances/immunities/vulnerabilities no schema, mas wizard nunca popula. Resultado: Tiefling não resiste fogo, Anão não resiste veneno. Apenas inimigos (Esqueleto) têm tags.

**Arquivos a tocar**:
- `src/dnd/races.ts`: adicionar field opcional `defaultResistances?: DamageType[]`, `defaultImmunities?: DamageType[]`, `defaultVulnerabilities?: DamageType[]` em RaceDef.
- Popular em raças com tags PHB:
  - `tiefling` → `defaultResistances: ['fogo']`
  - `anao-colina` e `anao-montanha` → `defaultResistances: ['veneno']` (Resiliência Anã RAW)
  - `draconato` → considerar ancestry breath weapon (opcional, deixar TODO)
- `src/client/character-creation/wizard.ts` em `buildCharacterSheet`:
  ```ts
  const race = getRace(state.raceId);
  if (race.defaultResistances) sheet.resistances = [...race.defaultResistances];
  ```
- `src/dnd/__tests__/races.test.ts` (criar): testar Tiefling tem fogo, Anão tem veneno, Humano não tem.

**Critério done**: novo PJ Tiefling criado tem `resistances:['fogo']` no JSON salvo via `/api/characters POST`. Inimigo ataca fogo: dano halved.

**Commit msg**: `1A — Racial damage profile auto-populated no wizard (Tiefling resist fogo, Anão resist veneno)`.

### 1B — UI badges visuais para state mecânico (~3-4h)

**Por quê**: backend F23 (rage), F25 (concentration), A2 (buffs) já funciona. Player não vê visualmente que está concentrando até quebrar magia por dano. Não vê que tem Bardic Inspiration ativo. Não sabe que aliado está em rage.

**Arquivos a tocar**:
- `src/client/campaign/campaign-screen.ts` em `renderPartyPanel` (~linha 470):
  - Após `cp-pj-exhaustion`, adicionar:
    ```ts
    p.concentratingOn
      ? el('div', { class: 'cp-pj-conc', text: `🧠 Conc: ${p.concentratingOn}` })
      : null,
    p.activeBuffs && p.activeBuffs.length > 0
      ? el('div', { class: 'cp-pj-buffs', text: p.activeBuffs.map(b => `✨ ${b.source}`).join(' · ') })
      : null,
    ```
  - Rage detection: precisa importar flag de class-features-engine OR adicionar `p.conditions.includes('rage' as never)`. Server lado: emit `condition-applied` com text já cobre. Considerar adicionar conditionId='rage' explicit ao apply.
- `src/client/styles/campaign-party.css`: novas classes `.cp-pj-conc` (cor amarela) `.cp-pj-buffs` (cor verde) `.cp-pj-rage` (cor vermelha).
- `src/client/combat/combat-screen.ts` em `renderEnemyCard`: similar pra enemy.conditions ter ícones visíveis (já tem `cb-enemy-cond` text but adicionar coloring por tipo).

**Critério done**: na campaign, party panel mostra badges claros pra cada PJ com concentration/buff/rage ativos. Validar via preview eval `document.querySelectorAll('.cp-pj-conc, .cp-pj-buffs').length > 0` depois de cast Bless.

**Commit msg**: `1B — UI badges visuais: concentração + buffs ativos + rage no party panel`.

### 1C — DM personality presets (~3h)

**Por quê**: SYSTEM_PROMPT fixo "Sombrio+Sarcástico+Trickster BR". Adicionar 5 personalidades muda gameplay drasticamente sem custo extra de tokens.

**Arquivos a tocar**:
- `src/dnd/dm-personality.ts` (NOVO):
  ```ts
  export type DmPersonality = 'sombrio' | 'epico' | 'comedia' | 'noir' | 'pulp';
  
  export interface DmPersonalityDef {
    id: DmPersonality;
    label: string;
    icon: string;
    systemPromptOverride: string; // substitui o tom no SYSTEM_PROMPT base
    description: string;          // mostrado no UI
  }
  
  export const PERSONALITIES: Record<DmPersonality, DmPersonalityDef> = {
    sombrio:  { ... },  // atual: sarcástico + cínico
    epico:    { ... },  // Tolkien, drama heroico
    comedia:  { ... },  // Monty Python, slapstick
    noir:     { ... },  // Lovecraft, ambíguo, mistério
    pulp:     { ... },  // Indiana Jones, ritmo rápido
  };
  ```
- `src/shared/types.ts`: `CampaignState.dmPersonality?: DmPersonality`.
- `src/server/dm/prompts.ts`: `SYSTEM_PROMPT` aceita `personality` arg, monta dinâmico.
- `src/server/dm/dm.ts`: passa `camp.state.dmPersonality` ao narrate.
- `src/client/lobby/lobby-screen.ts`: dropdown de personality antes de "Começar Crônica". Default 'sombrio'.
- `src/client/campaign/campaign-screen.ts` header: indicador discreto da personality ativa.
- Tests `src/server/__tests__/dm-personality.test.ts`: cobre que cada preset retorna SYSTEM_PROMPT distinto não-vazio.

**Critério done**: criar campanha 'epico' → DM narra com tom Tolkien (validar manualmente uma narração). Personality persiste em DB via saveCampaign.

**Commit msg**: `1C — DM personality presets (5 estilos: sombrio/épico/comédia/noir/pulp)`.

### Rodada 1 — Critério de done
- 3 commits feitos (1A, 1B, 1C).
- Tests ainda 414+ verdes.
- Smoke playtest mobile + desktop sem erros.

---

## 📦 RODADA 2 — Counterspell + organizar código (~10h)

> **Objetivo**: completar F25 (concentration + counterspell), refatorar `index.ts` (1200 LOC) em routes/sockets organizados.

### 2A — Counterspell + Dispel Magic (~4-5h)

**Por quê**: F25 já implementou concentration enforce + upcasting + ritual, mas Counterspell era TODO. Sem reaction system, casters jogam half-baked.

**Arquivos a tocar**:
- `src/dnd/spells.ts`: garantir `counterspell` (nv 3, action: reaction) e `dispel-magic` (nv 3) já existem. Se não, criar com effect `{ kind: 'counter' }`.
- `src/shared/types.ts`: adicionar `CombatActionKind = ... | 'counterspell-react' | 'dispel-magic-cast'`. Adicionar socket event `castReaction({ spellId, sourceId, slotLevel })`.
- `src/server/spells-engine.ts`:
  - `resolveCounterspell(caster, sourceCast, slotLevel)`: PHB pág 228. Slot ≥3 = auto-cancel. Slot < spell level cast = save Int DC 10+spellLevel.
  - `resolveDispelMagic(caster, target, slotLevel)`: cancela 1 buff ativo no target.
- `src/server/combat.ts` ou novo `reaction-engine.ts`:
  - Flag `reactionUsedThisRound: boolean` por PJ no combat-local flag (já existe pattern).
- `src/server/index.ts` socket handler `castReaction`.
- `src/server/dm/tools.ts` + `prompts.ts`: NOVO tool `enemy_casts_spell` que DM emite ANTES de resolver inimigo cast. Server emite event `pendingReactionWindow` pros casters do party (3s timeout).
- `src/client/combat/counterspell-prompt.ts` (NOVO): modal "Inimigo conjurando X. Counterspell? (3s)". Botão sim/não. Timeout auto-no.
- Tests `src/server/__tests__/reactions.test.ts`: cobre counterspell slot 3 auto-cancel, slot 1 vs nv 5 spell precisa save, dispel magic remove buff random.

**Critério done**: em combat, inimigo conjura → caster vê modal counterspell → escolhe sim → enemy cast cancelado, slot do counterspell consumido. Tests cobrem 5+ cenários.

**Commit msg**: `2A — Reaction system + Counterspell + Dispel Magic (PHB pág 228)`.

### 2B — Refactor index.ts → routes/* + sockets/* (~3-5h)

**Por quê**: `src/server/index.ts` tem 1200 LOC misturando Express routes (REST /api/) com socket handlers + helpers + lifecycle. F35 só extraiu dm-tool-applier. Próximo bug fica MUITO difícil de achar.

**Estrutura alvo**:
```
src/server/
├── index.ts (~200 LOC: bootstrap + wire registries)
├── routes/
│   ├── health.ts     (GET /api/health)
│   ├── characters.ts (CRUD /api/characters)
│   ├── campaigns.ts  (GET /api/campaigns)
│   ├── auth.ts       (login, /verify, logout)
│   ├── tombstones.ts (F19)
│   ├── highlights.ts (F20)
│   ├── streaks.ts    (F20)
│   └── achievements.ts
├── sockets/
│   ├── campaign-room.ts (joinCampaign, takeAction, combatAction, useClassFeature)
│   ├── lobby-room.ts    (createLobby, joinLobby, lobbyStartCampaign, etc)
│   ├── rest-room.ts     (shortRest, longRest, rollDeathSave)
│   └── meta.ts          (chat, disconnect handlers)
```

**Estratégia segura**:
1. Não tocar lógica — só MOVER blocks.
2. Helpers compartilhados (broadcastState, withThinkingBroadcast, drainAchievements, drainHighlights, flushPostCombatRewards) → `src/server/sockets/helpers.ts`.
3. Cada socket handler recebe `(io, socket, ctx)` onde ctx tem `{ campaigns, dm, lobbyManager, activeCampaignIdRef, activePlayerIdRef }`.
4. activeCampaignId/activePlayerId — passar como ref `{ current: string | null }` pra preservar closure-per-socket.
5. Cada extração: 1 commit. Roda tests entre cada.

**Critério done**: `wc -l src/server/index.ts` ≤ 250. Cada arquivo de route/socket ≤ 300 LOC. Tests passam (especialmente campaign-coop.test.ts que valida socket flow).

**Commit msgs** (4-6 commits):
- `2B.1 — Extract routes/health + routes/characters + routes/campaigns de index.ts`
- `2B.2 — Extract routes/auth + routes/tombstones + routes/highlights de index.ts`
- `2B.3 — Extract sockets/lobby-room + sockets/rest-room`
- `2B.4 — Extract sockets/campaign-room (joinCampaign + takeAction + combatAction)`
- `2B.5 — Extract sockets/helpers + finalize index.ts ≤250 LOC`

### Rodada 2 — Critério de done
- 5-7 commits feitos (2A + 2B sub-commits).
- Tests 420+ verdes (novos reaction tests).
- `wc -l src/server/index.ts` ≤ 250.
- Smoke playtest combat com 2 PJs (1 mago) → inimigo conjura → counterspell funciona.

---

## 📦 RODADA 3 — Diferenciar produto (~7h)

> **Objetivo**: features que dão wow factor + viral potential.

### 3A — Highlight reel exportável HTML (~5-6h)

**Por quê**: F20 já marca highlights. Próximo: gerar HTML estático compartilhável "Sessão 3 — Lyra atravessou ponte enquanto Borin distraiu ogro". Viral potential pra atrair amigos.

**Arquivos a tocar**:
- `src/server/highlights.ts`: já existe `listHighlights(userId)`. Adicionar `generateHighlightsHtml(userId, campaignId)` que retorna string HTML standalone (CSS inline, sem deps).
- `src/server/index.ts` (ou routes/highlights.ts se já refatorado): GET `/api/highlights/:campaignId/export` retorna HTML com headers `Content-Type: text/html`.
- HTML template:
  - Header com PJ portrait emoji (race + class glyph) + campaign name + sessions count.
  - Timeline cards: cada highlight com timestamp, ícone (kill/speech/choice/twist/moment), summary.
  - Footer com link "jogue você também".
  - CSS inline pra que funcione offline e em mobile.
- `src/client/profile/profile-screen.ts`: botão "📜 Exportar Sessão" em cada campanha listada, abre nova tab `/api/highlights/:campaignId/export`.
- Tests `src/server/__tests__/highlights-export.test.ts`: cobre que generateHighlightsHtml retorna HTML válido com pelo menos 1 `<div class="hl-card">` quando há highlights, vazio com placeholder quando não.

**Critério done**: clicar "Exportar Sessão" no profile abre HTML página com timeline visual. Salvar como `.html` no celular abre offline.

**Commit msg**: `3A — Highlight reel HTML exportável (compartilhável standalone)`.

### 3B — Player escolhe dificuldade de combate (~2h)

**Por quê**: B3 implementou encounter builder, mas DM decide sozinho. Player quer agency.

**Arquivos a tocar**:
- `src/shared/types.ts`: `CampaignState.combatDifficulty?: 'easy' | 'medium' | 'hard' | 'deadly' | 'auto'` (default 'auto').
- `src/server/dm/prompts.ts`: incluir `combatDifficulty` no SYSTEM_PROMPT — instrução "Quando iniciar combate, preferir start_combat_balanced com difficulty=<combatDifficulty>".
- `src/server/dm/dm.ts`: passar `camp.state.combatDifficulty` no NarrationContext.
- `src/client/campaign/campaign-screen.ts`: header dropdown "⚔ Dificuldade" com 5 opções. Mudança emite `updateCampaignSettings({ combatDifficulty })`.
- Socket event novo `updateCampaignSettings`.
- Tests cobre persistência da difficulty.

**Critério done**: player muda difficulty pra 'deadly', próximo combate DM usa start_combat_balanced com deadly automaticamente.

**Commit msg**: `3B — Player escolhe dificuldade de combate via dropdown (DM respeita)`.

### Rodada 3 — Critério de done
- 2 commits feitos.
- Tests 425+ verdes.
- Smoke: exportar HTML, abrir em browser limpo, visual ok.

---

## 🏁 Critério de stop autônomo

Próxima sessão deve PARAR e fazer handoff parcial quando QUALQUER um destes ocorrer:
- **80% janela de contexto**: medir via percepção. Stop, commit pendente, escrever handoff curto.
- **Tests quebraram e fix não trivial**: stop, debug, se demorar >30 min escrever handoff com bug aberto.
- **Bloqueio externo**: precisar de input do João (decisão de design, escolha de nome, etc).
- **Rodada 3 completa**: stop e parabeniza.

## 📊 Estimativas

| Rodada | Sub-tasks | Tempo | Commits | Tests +/- |
|---|---|---|---|---|
| Pre  | P1+P2     | 0h (manual) | 0  | 0 |
| 1    | 1A+1B+1C  | ~8h  | 3       | +5-10  |
| 2    | 2A+2B     | ~10h | 5-7     | +6-10  |
| 3    | 3A+3B     | ~7h  | 2       | +5     |
| **Σ** | 7 tasks | **~25h** | **10-12** | **+16-25** |

## 🛠 Comandos de validação (executar entre commits)

```bash
npm run typecheck    # tsc --noEmit
npm test -- --run    # vitest run
git status --short   # confirma working clean
git log --oneline | head -5  # verifica commit anterior
```

## 🔥 Quando algo der errado

- **Test quebra**: NÃO comente o test pra fazer passar. Fix o código que quebrou ou reverte o commit.
- **Typecheck quebra**: leia o erro exato, fix antes de qualquer commit.
- **`npm install` necessário**: NÃO instalar deps novas sem confirmação. Stack atual cobre tudo.
- **Render deploy falhar**: ler logs build no dashboard. Se for ENV var faltando, escrever no handoff e seguir.

## 📋 Padrões que NÃO mudaram

- DOM puro (sem framework migration)
- sql.js (não trocar pra better-sqlite3)
- Gemini Flash default, Groq fallback, Anthropic OFF
- Persona DM Sombrio+Sarcástico+Trickster BR (rodada 1C ADICIONA outras, NÃO substitui)
- Validação server-side TODA tool call
- Timeout 12s + retry sem tools em 400 LLM
- Mobile-first body classes via main.ts (já com fix is-portrait-narrow)
- F28 inventory profundo: VETADO

## 🎯 Recomendação ordem execução

```
P1 (push prod)              [0h, manual João]
↓
P2 (playtest amigo)         [pendente, não bloqueia]
↓
1A → 1B → 1C                [Rodada 1, ~8h]
↓
HANDOFF PARCIAL se >70% janela
↓
2A → 2B                     [Rodada 2, ~10h]
↓
HANDOFF PARCIAL se >70% janela
↓
3A → 3B                     [Rodada 3, ~7h]
↓
HANDOFF FINAL + push prod
```
