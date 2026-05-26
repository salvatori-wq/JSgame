# JSgame · Contexto pro Claude

> **Auto-carregado quando Claude inicia em `C:\Users\JOÃO\JSgame\`.**

## O que é

D&D 5e online coop com Mestre IA. Stack: Vite + TypeScript strict + Socket.io + Express + sql.js + groq-sdk.
DOM puro (sem Phaser/React). Mobile-first. Sessões 30 min.

Cave Run (jogo antigo, em `C:\Users\JOÃO\D&D online\`) está em prod com deploy Render — **NUNCA tocar**.
JSgame nasceu separado, do zero, aproveitando aprendizados do Cave Run.

## Status atual

- ✅ **F1** Foundation (config, server, client, D&D core: dice/attributes/races/classes/skills/conditions/backgrounds)
- ✅ **F2** Wizard de criação de PJ (5 steps point buy 27)
- ✅ **F3** Mestre IA Groq + Modo Exploração (cena narrada + ações + skill check d20)
- ⏳ **F4** Combate D&D real (initiative + ataques + AI inimigos + condições) — **PRÓXIMA**
- ⏳ **F5** Polish + Coop multi-player + Magias + Rest + PWA

**Pra retomar**: leia `HANDOFF_2026-05-25_F3-done-F4-next.md` na raiz.

## Comandos essenciais

```bash
npm run dev          # backend (3001) + frontend (5173) em paralelo
npm run typecheck    # tsc --noEmit
npm test             # vitest (58 tests passando)
```

URLs: http://localhost:5173 (desktop) · http://192.168.15.3:5173 (mobile)

## Decisões NÃO rediscutir

| Decisão | Por quê |
|---|---|
| DOM puro (sem framework) | D&D é texto/UI, não canvas |
| sql.js (não better-sqlite3) | Sem Visual Studio Build Tools no Windows |
| `Object.assign` no state update | Spread cria new ref → step recebe stale closure (bug F2.fix3) |
| Validação server-side TODA tool call | LLM mente — clampe sempre |
| Persona DM Sombrio+Sarcástico+Trickster BR | Validada no Cave Run, 2-4 frases curtas |
| Timeout 12s + retry sem tools em 400 | Llama 4 Scout falha em ~26% calls complexas |

## Arquivos-chave (mapa rápido)

```
src/client/main.ts                          # router (home/wizard/sheet/campaign)
src/client/character-creation/wizard.ts     # state machine (com Object.assign fix)
src/client/campaign/campaign-screen.ts      # exploration UI
src/server/index.ts                         # Express + Socket.io + REST + 4 socket handlers
src/server/campaign.ts                      # Campaign engine (startSession/takeAction/resolveSkillCheck)
src/server/dm/dm.ts                         # DungeonMaster + FallbackDM
src/server/dm/prompts.ts                    # SYSTEM_PROMPT D&D + 7 tools
src/server/dm/tools.ts                      # validação server-side TODA tool call
src/shared/types.ts                         # CharacterSheet, CampaignState, socket events
src/dnd/*.ts                                # Regras D&D 5e (PHB embarcado)
```

## Aprendizados aplicados (Cave Run → JSgame)

- Path Windows sem `&` evita problemas com npm/git
- sql.js em vez de better-sqlite3 evita compile native
- DOM puro em vez de Phaser fica mais rápido em mobile
- Vitest desde dia 1 (58 tests rodando) evita regressão
- Footer dentro do dynamic re-render (state stale é o inimigo)
- Mobile portrait body classes desde o boot (vars `--m-vh`, `--m-safe-*`)

## Git

Local em `C:\Users\JOÃO\JSgame\`. **Sem GitHub remote ainda** — só commits locais.
Commits: F1 → F2 → F2.fix1/2/3 → F3.

```bash
git log --oneline | head -10
```

## Feedback persistente do João

- Execução rápida + decisões executivas (não perguntar muito)
- Sempre que abrir nova conversa nesse projeto, comece lendo `HANDOFF_*.md` mais recente
- Cave Run e JSgame em pastas isoladas — nunca cruzar config/código

## Estado Atual

> Última atualização: 2026-05-26 (fim sessão deploy + plano playtest)

### Concluído nesta sessão
- 12 commits novos (S2 + A3 + A4 + A5 + M1-4 + B6 + B7 + T1) — 469→533 tests verdes (+64)
- Deploy prod live (`git push origin main` + manual deploy via Chrome MCP)
- Gemini Flash ativo (env var configurada via Render dashboard, DM_PROVIDER removido pra auto-detect priorizar Gemini)
- `/api/health` retorna: `hasGemini:true, activeProvider:DungeonMaster, dmProvider:auto`
- Plano profundo de playtest documentado em `PLAYTEST_PLAN.md`

### Pendente / Próximos passos
- [ ] **Executar playtest seguindo `PLAYTEST_PLAN.md`** — 12 features novas precisam validação end-to-end (counterspell, dodge, auto-recap, friend invites, tutorial, etc)
- [ ] Configurar `BREVO_API_KEY` no Render (atualmente friend invites vão em dev-log)
- [ ] TODOs técnicos do handoff: split `connection.ts` (648 LOC), split `campaign.ts` (932 LOC), hook telemetria em mais pontos, pact magic warlock, spell slots nv 6-9

### Decisões importantes desta sessão
- DM_PROVIDER deletado do env: factory.ts auto-detect prioriza Gemini > Anthropic > Groq por qualidade
- vitest.config.ts criado com `singleFork:true` pra evitar SQLITE_BUSY entre test files
- Counterspell mecânico: dm-tool-applier bloqueia apply_damage/apply_condition quando pendingEnemySpell.cancelled
- Dodge: combat-flag `dodging` impõe disadvantage; limpa no INÍCIO do próximo turno (PHB pág 192)

### Arquivos-chave criados nesta sessão
- `src/server/friends.ts` — friend graph + invite por email
- `src/server/metrics.ts` — telemetria DAU/WAU/error rate
- `src/server/campaign-handlers/{item,rest}-handler.ts` — split de campaign.ts
- `src/dnd/consumables.ts` — catálogo poções id-based
- `src/client/toast.ts` — toast UI genérico
- `src/client/campaign/exploration-tutorial.ts` — tutorial 6 cards
- `PLAYTEST_PLAN.md` — protocolo de playtest + bug-fix eficiente
- `HANDOFF_2026-05-26_playtest-pronto.md` — handoff abertura próxima sessão
