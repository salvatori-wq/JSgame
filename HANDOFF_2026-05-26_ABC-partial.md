# Handoff parcial — Rodadas A+B+C — 2026-05-26

## Estado: 5 de 8 itens completos. 3 pendentes pra próxima sessão.

Limite de contexto atingido (~90%). Parando como combinado. Tudo verde: 414/414 tests, typecheck limpo.

## Commits desta sessão (5)

```
9e009d9  C3 — Voice TTS narrações DM (Web Speech API, zero custo)
14c1409  B3 — Encounter builder (DM tool start_combat_balanced)
5e2b9ea  A2+B1 — Buff engine genérico + Smart enemy AI
adc668f  docs: handoff coop visibility fix
9eaebda  fix(coop): players agora vêem ações + chat livre + filtra erros de race
```

## Completos ✅

### A2 — Buff engine genérico
- `src/server/buff-engine.ts` NOVO: ActiveBuff schema + add/consume/readAcBonus/tickEndOfTurn/clearAll.
- Factories: Bardic Inspiration (+1d6 attack 1 charge), Bless (+1d4 attack+save 10 turns), Guidance (+1d4 skill 1 charge), Shield (+5 AC 1 turn), Faerie Fire (advantage 10 turns).
- Hooks em combat.resolvePlayerAttack (attack buffs + advantage), combat.resolveEnemyTurn (AC passive), campaign.resolveSkillCheck (Guidance), campaign.resolveSavingThrow (Bless save), campaign.longRest (clear).
- class-features.applyBardicInspiration agora aplica buff REAL no aliado, não só log.
- `sheet.activeBuffs?: ActiveBuff[]` em CharacterSheet.

### B1 — Combat AI smarter
- Boss/elite agora score-based: prioriza low-HP (×50), concentrating-on-spell (+30), casters (+20), active buffs (+15).
- Skirmisher (non-boss) continua random — comportamento esperado.

### B3 — Encounter builder
- `src/dnd/encounter-builder.ts` NOVO: XP_THRESHOLDS PHB DMG, encounterMultiplier, pickEncounter heurística (easy/medium = 1 monstro CR média; hard/deadly = 1 boss + minions).
- DM tool `start_combat_balanced` valida difficulty + flavor.
- `dm-tool-applier` case 'start_combat_balanced' chama pickEncounter + picksToEnemyInputs.
- LLM agora pode só dizer "deadly" e server escolhe inimigos do bestiary balanceados.

### C3 — Voice TTS narrações DM
- `src/client/voice-tts.ts` NOVO: wrapper Web Speech API com PT-BR voice detection.
- Toggle 🗣/🤐 no header, persiste em localStorage.
- `onNarration` chama ttsSpeak APENAS quando speaker é "Mestre" (não chat livre nem echo de ação).
- Zero custo, zero dependência nova.

### C2 — PWA install (já estava pronto)
- `public/manifest.webmanifest` + `public/sw.js` + `<link rel="manifest">` no HTML já existiam.
- 3 icons (192, 512, maskable). Cache-first com fallback. Ignora /api e /socket.io.

## Pendentes pra próxima sessão ⏳

### A1 — Coop reconnection + race lobby + spectator (NÃO INICIADO)
Estimativa: ~4-6h. Plano:

1. **rejoinCampaign socket recovery**: testar que se Player B perde wifi e volta, ele consegue rejoinar a mesma campanha (getLastSession() no localStorage já tem). Server precisa aceitar rejoinCampaign quando socket é novo mas characterId está na party.
2. **Race lobby**: host não pode clicar "Começar Crônica" antes de todos players terem status `ready`. Banner: "Esperando 2/3 jogadores" + disable botão.
3. **Spectator transcrição ao vivo**: quando aliado rola skill check, em vez de só toast, broadcast `dmNarration` `speaker: "🎲 <PJname>"` com `text: "rolou X em <skill> vs DC Y → SUCESSO/FALHOU"` pra entrar no histórico permanente.

Arquivos: `src/server/index.ts` (rejoinCampaign handler), `src/server/lobby.ts` (validação start), `src/client/lobby/lobby-screen.ts` (banner waiting), `src/server/campaign.ts` resolveSkillCheck (broadcast result narration).

### B2 — Tutorial / onboarding overlay first-combat (NÃO INICIADO)
Estimativa: ~4-5h. Plano:

1. Detect first-combat: `camp.combatStartCount === 1 && state.combat?.active === true && !localStorage.getItem('jsgame.tutorial.combat.seen')`.
2. Overlay com setas SVG/CSS apontando 3 botões: "Atacar (clica em inimigo)", "Esquivar (default fim de turno)", botões de classe (rage/surge).
3. Glossário rápido: card explicando CA = "armadura", DC = "dificuldade", vantagem = "rola 2d20 pega maior".
4. Botão "Entendi" salva flag no localStorage.

Arquivos: `src/client/onboarding-tour.ts` (extend existing), CSS novo em features.css.

### C1 — Mobile combat tabs/swipe (NÃO INICIADO)
Estimativa: ~5-7h. Plano:

1. Em viewport `<600px`, combat-screen renderiza tab-strip: `🛡 Party | ⚔ Enemies | 📜 Log | 🎲 Actions`.
2. Cada tab é um `<section>` com `display: none` quando não-ativo.
3. Swipe horizontal (touchstart/touchend delta-X > 50) navega entre tabs.
4. Active tab persiste em state local da screen.

Arquivos: `src/client/combat/combat-screen.ts` (renderTabsLayout vs renderFlatLayout), CSS em combat.css mobile-portrait media query.

## Resultado da sessão

| Antes | Depois |
|---|---|
| Buffs eram strings sem efeito | Buff engine completo + 5 factories + 4 hooks |
| Enemy AI: 100% random | Boss heuristic scoring (4 fatores) |
| DM precisa pensar monsterId | DM diz "easy/medium/hard/deadly" |
| Sem voz | TTS PT-BR opcional |
| 398 tests | 414 tests (+16) |

## Próxima conversa — cole isto

> Lê HANDOFF_2026-05-26_ABC-partial.md. Pendentes: A1 (coop reconnect + race lobby + spectator transcript), B2 (tutorial first-combat), C1 (mobile combat tabs). Estimativa ~13-18h total. Atacar nesta ordem: B2 (maior impacto retenção) → A1 (confiabilidade coop) → C1 (mobile UX). Regra zero-budget mantida. Tests 414/414 ainda verdes.

## Acumulado local — push pra Render

Agora são **25 commits locais** acumulados (era 21 no handoff anterior + 4 da sessão atual). Quando quiser deploy, `git push origin main`. Env var necessária: `GEMINI_API_KEY`.
