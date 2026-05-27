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

> Última atualização: 2026-05-26 23:46 (Sprint γ + Densidade COMPLETOS)

### Sprint γ "POLISH FUNDAÇÃO" — 6 commits, 877→939 tests
- γ.1 Dado 3D + som 3-camadas + haptic + combate (`14c19a8`)
- γ.2 DM força mais rolls via 12 keywords (`c504a6e`)
- γ.3 Echo player race fix (`8d6bba8`)
- γ.4 Mistral provider 5º cascade (`950207d`)
- γ.5 Mobile audit + header overflow 10→5 (`845af26`)
- γ.6 Telemetria UX baseline + /api/dm/ux-funnel (`c4f43a5`)

### Estratégia "Densidade" — 4 features profundas, 939→1007 tests
- F1 Primeiro Minuto Magia — 3 PJs pré-fab + 13 cold opens (`e892937`)
- F2 Crit que faz suar — combat drama visual+som+narração (`fe8d39b`)
- F3 Mestre que Lembra — RAG contextual + callback detector (`78eb823`)
- F4 PJ que Faz Sentido — backstory drives DM (`b9a6a8e`)
- Deploy disparado (dep-d8b5lobeo5us73akf350)
- Veja `HANDOFF_2026-05-27_densidade-done.md` pra detalhes

### Pendente / Próximos passos
- [ ] Configurar `MISTRAL_API_KEY` no Render (γ.4 ativar)
- [ ] Aguardar 24-48h após deploy pra baseline real de `/api/dm/ux-funnel`
- [ ] **Playtest qualitativo** — validar F1/F2/F3/F4 em uso real antes de avançar
- [ ] Após métricas reais, decidir: iterar prompt (se callback/backstory baixos) ou avançar
- [ ] **Sprint δ "CORAÇÃO RÁPIDO" (~10h)** — SSE streaming (só se latência for atrito real)
- [ ] Onboarding inline tutorial primeira vez (se time_to_first_roll ainda alto)

### Decisões importantes Sprint γ
- happy-dom devDep adicionada pra DOM em tests do client (mais leve que jsdom)
- Difficulty dropdown movido do header pro overflow menu (prompt numerado)
- Dummy DM response em γ.2 quando server detecta skill check (sem chamar LLM)
- Mistral entra após Cloudflare no cascade (4 anteriores mais rápidos)
- prefers-reduced-motion universal em dice.css + overflow-menu.css

### Arquivos-chave Sprint γ
- `src/client/dice/dice-3d.ts` — Dado reusável 3D-ish CSS
- `src/client/dice/dice-roll-overlay.ts` — modal genérico de roll
- `src/client/haptic.ts` — navigator.vibrate wrapper
- `src/server/skill-check-detector.ts` — 12 keyword patterns
- `src/server/dm/providers/mistral.ts` — provider Mistral free tier
- `src/server/ux-funnel.ts` — computeUxFunnel agregado
- `src/client/campaign/header-overflow-menu.ts` — popover ⋯
- `HANDOFF_2026-05-27_sprint-gamma-done.md` — handoff atual
