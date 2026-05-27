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

> Última atualização: 2026-05-28 (Mobile Polish 4/4 COMPLETO — JSgame mobile-NATIVO)

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

### Mobile Polish — 4 sessões temáticas, 1007→1059 tests (+52)
- MP1 Fundação Mobile — tokens --m-* + helpers .m-stack/.m-row/.m-modal + swipe-down (`8df4cb6`)
- MP2 Combat & Header — header 2-row mobile, narration flex:1, initiative fade, enemy 1-col, action 2-col (`baa24d7`)
- MP3 7 Modais Bottom-Sheet — inv/shop/cs/mem/ach/npc/qlm com header sticky + body scroll + swipe-down (`c857880`)
- MP4 Sheet+Wizard+Profile+Lobby+Finais — vitals 3-col, attrs 3-col, sheet skills 1-col, profile sticky tabs, toques transversais (`d3304f5`)
- Veja `HANDOFF_2026-05-28_mobile-polish-done.md` pra detalhes

### Pendente / Próximos passos
- [x] ~~Manual Deploy no Render~~ — auto-deployed: `dep-d8b6g0tckfvc73cnmcrg` (commit `d3304f5`)
- [ ] Validar Mobile Polish em https://jsgame-drpe.onrender.com em mobile real (após deploy completar)
- [ ] Configurar `MISTRAL_API_KEY` no Render (γ.4 ativar)
- [ ] Aguardar 24-48h após deploy pra baseline real de `/api/dm/ux-funnel`
- [ ] **Playtest qualitativo Mobile** — validar bottom-sheets + sticky headers + hit targets em device real
- [ ] **Sprint δ "CORAÇÃO RÁPIDO" (~10h)** — SSE streaming (só se latência for atrito real)
- [ ] Onboarding inline tutorial primeira vez (se time_to_first_roll ainda alto)

### Decisões importantes Mobile Polish
- `--m-*` tokens (11) ficam em _tokens.css, override de --gap-loose via body.is-portrait-narrow
- `.m-modal` pattern aplicado VIA CSS selectors compostos em 7 modais (zero refactor DOM)
- `attachSwipeDown` é novo (com velocity check), `onSwipeDown` legacy mantido — usar attach* em código novo
- Pattern visual bottom-sheet: animation 220ms cubic-bezier slide-up + handlebar opcional
- prefers-reduced-motion respeitado em TODAS animações novas (modal slide, etc)
- Hit target ≥40px (m-hit) ou ≥44px (m-hit-cta) enforced em todos botões mobile
- CSS-only para 95% das mudanças — apenas 2 mudanças DOM: wrapper .camp-header-chips +
  onSwipeDown adicionado no quest-log-modal

### Arquivos-chave Mobile Polish
- `src/client/styles/_tokens.css` — 11 tokens --m-* + override gap-loose mobile
- `src/client/styles/m-layout.css` — helpers .m-stack/.m-row/.m-hit*, pattern .m-modal,
  bottom-sheet aplicado a 7 modais, toques finais transversais (tap-highlight, scroll-padding)
- `src/client/m-swipe-down.ts` — attachSwipeDown helper (velocity + handlebar)
- `src/client/__tests__/m-swipe-down.test.ts` — 7 tests (threshold, velocity, etc)
- `src/client/__tests__/mobile-polish-css.test.ts` — 45 CSS snapshot tests
- `HANDOFF_2026-05-28_mobile-polish-done.md` — handoff atual

### Arquivos-chave Sprint γ
- `src/client/dice/dice-3d.ts` — Dado reusável 3D-ish CSS
- `src/client/dice/dice-roll-overlay.ts` — modal genérico de roll
- `src/client/haptic.ts` — navigator.vibrate wrapper
- `src/server/skill-check-detector.ts` — 12 keyword patterns
- `src/server/dm/providers/mistral.ts` — provider Mistral free tier
- `src/server/ux-funnel.ts` — computeUxFunnel agregado
- `src/client/campaign/header-overflow-menu.ts` — popover ⋯
