# Handoff — Sessão Mobile Polish + Trilha + Mestre Experiente + Polish Strategy

## 1. Estado atual

Data: 2026-05-28. Working tree limpo, 1111 tests verdes, último commit `4d7d699` em prod via auto-deploy do Render. Nenhuma pendência bloqueante — o que falta é executar o plano de polish (6 sprints, ~42h) que ficou documentado.

## 2. O que foi feito nesta sessão

1. **Mobile Polish 4/4 completa** — tokens `--m-*`, `.m-stack`/`.m-row`/`.m-modal` pattern, 7 modais viraram bottom-sheets, sheet/wizard/profile/lobby polidos, audit em 5 viewports. Commits `8df4cb6` → `d3304f5`. +52 tests.
2. **Trilha medieval procedural** — 8 moods com modos eclesiásticos (Dorian/Phrygian/etc), sequencer lookAhead, 8 instrumentos sintetizados, wire-up automático por estado. Commit `add61b8`. +14 tests.
3. **Actions direcionadas em tudo** — fallback exploration (chips sempre visíveis quando LLM esquece `suggest_actions`) + habilitar chips em combate com variant visual avermelhado. Commit `1bf8fdc`. +9 tests.
4. **Mestre Experiente v2** — reescrita do `SYSTEM_PROMPT` com DECISION TREE, TABELA DE DCs, FAIL FORWARD, 18 perícias catalogadas por pilar, skill-check-detector expandido (12→18 patterns), auto-inject pós-DM, telemetria `rollsPerActionRatio` + `avgDistinctSkillsPerSession`. Commit `b6f6ce0`. +10 tests.
5. **Cenas com peso** — fix do viés taverna (currentLocation hardcoded), chips contextuais smart com `extractNarrationEntities` (NPCs+landmarks da última narração), NARRATIVE MOMENTUM no prompt (But/Therefore, 12 Hard Moves, Clocks, exemplo concreto). Commit `cc0c8fa`. +19 tests.
6. **Strategy Polish Geral** — plano profundo de 6 sprints (α/β/γ/δ/ε/ζ) documentado em `STRATEGY_POLISH_GERAL.md`. Commit `4d7d699`.

Total: 5 features grandes + 1 docs strategy. 1007 → 1111 tests (+104). Zero regressões.

## 3. Contexto técnico relevante

- **Default `currentLocation`** mudou de `'Início — taverna sem nome'` para `''` (vazio). Cold opens agora setam `locationLabel` real. Coop/sessão 2+ usa `pickFallbackLocation()` com 12 opções variadas. Polui menos o prompt do LLM.
- **Skill check forçado em dois pontos**: pre-DM (γ.2 original) E post-DM (novo). Se LLM esquece `request_skill_check`, server detecta via `detectImpliedSkillCheck()` e injeta `pendingCheck`. Anexa linha discreta na narração indicando DC.
- **Chips contextuais** seguem hierarquia: chips reais do DM (via `suggest_actions`) → fallback smart (parse última narração) → fallback genérico. Sempre 4 chips, nunca menos.
- **Prompt do DM** está grande (~7KB) mas estruturado em seções nomeadas (DECISION TREE, TABELA DE DCs, VARIEDADE DE PERÍCIAS, FAIL FORWARD, NARRATIVE MOMENTUM, etc). Refinos futuros: editar seção específica, não reescrever do zero.
- **Telemetria nova** (`rollsPerActionRatio`, `avgDistinctSkillsPerSession`, `topSkills`) emite a partir de `action_taken` event. Precisa 24-48h de prod pra baseline real. Endpoint: `GET /api/dm/ux-funnel?days=7`.
- **Memória global do João**: `feedback_zero_budget.md` em `C:/Users/JOÃO/.claude/projects/C--Users-JO-O-JSgame/memory/` — não habilitar Anthropic sem confirmação explícita.
- **Auto-deploy do Render** ativo no main — cada push gera build. Deploy ID típico: `dep-d8b6g0tckfvc73cnmcrg` ou similar. URL: https://jsgame-drpe.onrender.com.

## 4. Fix/padrão central

Pattern de fallback contextual reaproveitável — qualquer "campo derivado do estado" que precisa de fallback:

```ts
// src/server/campaign.ts (linha ~1035)
if (this.state.suggestedActions.length === 0) {
  const lastNarration = response.narration && response.narration.trim().length > 0
    ? response.narration
    : this.narrationLog[this.narrationLog.length - 1];
  this.state.suggestedActions = generateFallbackChips(this.state, lastNarration);
}
```

E o extractor de entidades (regex defensivo, pure function):

```ts
// src/server/dm/narration-entities.ts
export function extractNarrationEntities(narration: string): {
  npcs: string[];      // nomes próprios + papéis (guarda/taverneiro/etc)
  landmarks: string[]; // nouns de cenário (porta/baú/altar/etc)
}
```

Esse padrão (LLM tenta → server complementa via parsing do que LLM gerou) pode ser replicado pra: `quests` (extrair objetivos da narração se DM esqueceu `set_quest`), `npcs` (extrair NPCs falados se DM esqueceu `npc_speaks`), etc.

## 5. Follow-ups sugeridos

Nenhum bloqueante. Sugestões pra próxima sessão (todas opcionais):

- [ ] **Sprint α — Primeira Impressão Inesquecível** (~8h, prioridade alta — primeira impressão define retenção)
- [ ] **Sprint β — Combate sem Atrito** (~10h, prioridade alta — combat é coração mecânico)
- [ ] **Sprint γ — Vida da Cena** (~8h, requer SSE/streaming infrastructure — mais complexo)
- [ ] **Sprint δ — Coop Sem Drama** (~6h, só se coop está em uso real)
- [ ] **Sprint ε — Acessibilidade & Resiliência** (~6h, audit WCAG + error boundary)
- [ ] **Sprint ζ — Cada Pixel Conta** (~4h, polish final — fazer por último)
- [ ] **Validar métricas em prod** — ler `/api/dm/ux-funnel?days=2` depois de 24-48h, ver se `rollsPerActionRatio` subiu vs antes do Mestre Experiente
- [ ] **Playtest qualitativo** das 3 reclamações resolvidas: cold open variado, chips contextuais, narração com peso (cascata But/Therefore)
- [ ] **Configurar `MISTRAL_API_KEY` no Render** (pendente desde γ.4, não-bloqueante — outros providers cobrem)

## 6. Arquivos-chave tocados

- `C:/Users/JOÃO/JSgame/STRATEGY_POLISH_GERAL.md` — plano dos 6 sprints
- `C:/Users/JOÃO/JSgame/HANDOFF_2026-05-28_mobile-polish-done.md` — handoff Mobile Polish (já existia)
- `C:/Users/JOÃO/JSgame/CLAUDE.md` — atualizado com seção Mobile Polish + decisões
- `C:/Users/JOÃO/JSgame/src/server/dm/prompts.ts` — `SYSTEM_PROMPT` v2 com DECISION TREE + NARRATIVE MOMENTUM (~7KB)
- `C:/Users/JOÃO/JSgame/src/server/dm/suggest-fallback.ts` — fallback chips smart (usa narração)
- `C:/Users/JOÃO/JSgame/src/server/dm/narration-entities.ts` — extractor NPCs/landmarks (NOVO)
- `C:/Users/JOÃO/JSgame/src/server/cold-opens.ts` — `locationLabel` + `pickFallbackLocation`
- `C:/Users/JOÃO/JSgame/src/server/skill-check-detector.ts` — 18 patterns cobrindo todas as 18 perícias
- `C:/Users/JOÃO/JSgame/src/server/campaign.ts` — auto-inject pós-DM, default location vazio
- `C:/Users/JOÃO/JSgame/src/server/ux-funnel.ts` — `rollsPerActionRatio` + `avgDistinctSkillsPerSession` + `topSkills`
- `C:/Users/JOÃO/JSgame/src/client/audio/ambient.ts` — trilha medieval 8 moods (NOVO)
- `C:/Users/JOÃO/JSgame/src/client/audio/instruments.ts` — pluck/flute/drum/bell/heartbeat (NOVO)
- `C:/Users/JOÃO/JSgame/src/client/audio/sequencer.ts` — lookAhead scheduler (NOVO)
- `C:/Users/JOÃO/JSgame/src/client/audio/modes.ts` — modos eclesiásticos (NOVO)
- `C:/Users/JOÃO/JSgame/src/client/styles/m-layout.css` — bottom-sheets pattern (Mobile Polish)
- `C:/Users/JOÃO/JSgame/src/client/m-swipe-down.ts` — attachSwipeDown helper (NOVO)

## 7. Deploy / ambiente

- Último commit em prod: `4d7d699` (auto-deploy do Render pega tudo do main)
- URL prod: https://jsgame-drpe.onrender.com
- Render dashboard: https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
- Auto-deploy ativo — push to main = deploy automático em ~5min
- Quirks: SingleFork SQLite mantido no vitest (sequencial por causa de SQLITE_BUSY)
- Free tier: Cerebras/Gemini/Groq/Cloudflare/Mistral cascade — Anthropic NÃO habilitado (memória `feedback_zero_budget`)
- Backend port 3001, frontend 5173 em dev — `npm run dev` sobe os dois

## 8. 🎯 O que falar na próxima conversa

**Opção curta (retomar trabalho sem decidir agora):**

> Lê `STRATEGY_POLISH_GERAL.md` na raiz do JSgame e `HANDOFF_2026-05-28_polish-strategy.md`. Última sessão deixou plano de 6 sprints de polish documentado. Me propõe por onde começar com base no estado atual — se preferir sugerir um sprint pra atacar agora ou se primeiro deveria validar as métricas em prod das mudanças recentes (Mestre Experiente, cold opens, narrative momentum).

**Opções específicas (se já souber o que atacar):**

1. **Executar Sprint α "Primeira Impressão Inesquecível":**
   > Lê `STRATEGY_POLISH_GERAL.md` seção Sprint α. Execute autônomo os 6 fixes (α.1-α.6): login fallback anônimo visível, home hierarquia prefab > customizado, randomize tudo no wizard, tutorial inline no primeiro skill check overlay, time-to-first-roll p50 ≤30s, thinking indicator com dicas rotativas. Tests sempre verde (1111+). Commit atômico `feat(polish-α)`. Push origin/main. Pode ir.

2. **Executar Sprint β "Combate sem Atrito":**
   > Lê `STRATEGY_POLISH_GERAL.md` seção Sprint β. Execute autônomo os 7 fixes (β.1-β.7): unificar action layer combat (chips dinâmicos > botões fixos > features), damage numbers polish unificado, HP bar transitions narrativas (tick/cross/stagger), condition pills com icons+tooltip, initiative com avatars emoji, combat log colorido, "encerrar turno" sugerido quando econ vazia. Tests verde. Commit `feat(polish-β)`. Push. Pode ir.

3. **Validar métricas em prod primeiro:**
   > Acessa `https://jsgame-drpe.onrender.com/api/dm/ux-funnel?days=2` e me reporta os números — especialmente `rollsPerActionRatio`, `avgDistinctSkillsPerSession`, `topSkills`, `timeToFirstRollMs`, `narration_error`. Compare com baseline esperado do plano polish (`STRATEGY_POLISH_GERAL.md` seção 6). Se algum estiver muito ruim, sugere fix antes de mergulhar nos sprints.

4. **Playtest qualitativo das mudanças recentes:**
   > Quero testar manualmente as 3 mudanças do commit `cc0c8fa` (Cenas com Peso) ANTES de fazer mais sprints. Inicia preview, abre o jogo em mobile (360×740), clica num prefab PJ, observa: (a) cold open NÃO é taverna, (b) chips são contextuais à cena, (c) narrações têm cascata But/Therefore com 2-3 elementos reagindo. Me reporta o que funciona e o que ainda parece fraco.

5. **Atacar follow-up específico do prompt:**
   > Aplica o pattern de fallback contextual (descrito no handoff seção 4) também pra `quests` e `npcs`. Se DM esquecer `set_quest` mas narração contém "preciso que você", server cria quest automática. Se DM esquecer `npc_speaks` mas narração tem fala entre aspas, server registra NPC. Reusa lógica de `narration-entities.ts`.

Começa com a Opção curta se não tiver certeza — vou ler o plano + handoff e te propor caminho informado. Se já souber qual sprint quer atacar, vai direto numa das 5.
