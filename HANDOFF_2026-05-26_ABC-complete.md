# Handoff completo — Rodadas A+B+C — 2026-05-26

## Estado: 8 de 8 itens completos ✅

Tudo verde: **414/414 tests, typecheck limpo, smoke playtest sem erros (desktop + mobile)**.

## Commits desta extensão (4 novos)

```
2b84498  C1 — Mobile combat tabs/swipe (Inimigos / Ações / Log)
734c448  B2 — Tutorial first-combat overlay (5 cards)
d43e18d  A1 — Coop reconnection + race lobby + spectator transcript
69a5a37  docs: handoff parcial (interim)
```

Combinado com a sessão anterior:

```
2b84498  C1 — Mobile combat tabs/swipe
734c448  B2 — Tutorial first-combat overlay
d43e18d  A1 — Coop reconnection + race lobby + spectator transcript
9e009d9  C3 — Voice TTS narrações DM
14c1409  B3 — Encounter builder
5e2b9ea  A2+B1 — Buff engine genérico + Smart enemy AI
9eaebda  fix(coop): players vêem ações + chat livre + filtra erros
```

## Tudo Completo ✅

### A1 — Coop reconnection + race lobby + spectator
1. **Spectator transcript ao vivo**: skill check + save results agora viram entrada permanente no narration log com speaker `🎲 <PJname>` / `🛡 <PJname>`, contendo mecânica completa (roll vs DC + verdict). Aliados sempre veem quem rolou e como foi.
2. **Race lobby**: botão "Começar Crônica" agora mostra `⏳ Aguardando N: <nomes> (X/Y)` quando não está allReady. Tooltip explica.
3. **Reconnection robustez**: novo handler `socket.on('connect')` em main.ts detecta reconnects (count > 0) e re-emite `joinCampaign` se currentView é `campaign`. Player 2 que perde wifi 5s agora volta automático sem precisar refresh.

### A2 — Buff engine genérico
- `src/server/buff-engine.ts`: ActiveBuff schema + add/consume/readAcBonus/tickEndOfTurn/clearAll.
- 5 factories: Bardic Inspiration (+1d6 attack), Bless (+1d4 attack+save, sources distintos), Guidance (+1d4 skill), Shield (+5 AC 1 turno), Faerie Fire (advantage).
- 4 hooks: combat.resolvePlayerAttack (attack buffs + advantage), combat.resolveEnemyTurn (AC passive), campaign.resolveSkillCheck (Guidance), campaign.resolveSavingThrow (Bless save). longRest clearAll.
- class-features.applyBardicInspiration agora aplica buff REAL (não placeholder).

### B1 — Combat AI smarter
- Boss/elite scoring: low-HP ×50, concentratingOn +30, casters +20, active buffs +15.
- Non-boss continua random (skirmisher).

### B2 — Tutorial first-combat overlay
- `combat-tutorial.ts`: 5 cards navegáveis (Atacar, Esquivar/Disparada, Habilidades de Classe, Ações Especiais, Glossário).
- Dispara automático em campaign-screen.onState quando transição exploration → combat e shouldShowCombatTutorial().
- ESC/← →/click backdrop pulam. Botão "Pular tutorial" + "✓ Entendi". localStorage `jsgame.tutorial.combat.v1`.
- CSS: ct-modal com fade-in + glow gold, ícone 56px, navegação bem polida.

### B3 — Encounter builder profissional
- `encounter-builder.ts`: XP_THRESHOLDS PHB DMG pág 82, encounterMultiplier (×1.5 para 2, ×2 para 3-6, etc), pickEncounter heurística.
- DM tool `start_combat_balanced` — LLM diz só "easy/medium/hard/deadly" + flavor, server escolhe inimigos balanceados do bestiary.

### C1 — Mobile combat tabs/swipe
- Mobile portrait: tab strip `⚔ Inimigos | 🎲 Ações | 📜 Log` (header + initiative ficam sempre visíveis).
- Touch swipe horizontal (delta > 60px) navega entre tabs.
- Desktop: tabs `display: none` → comportamento original (tudo visível).
- Estado persiste em `window.__combatTab` entre re-renders.

### C2 — PWA install (já estava pronto)
- manifest.webmanifest + sw.js + `<link rel="manifest">` no HTML.

### C3 — Voice TTS narrações DM
- `voice-tts.ts`: wrapper Web Speech API com PT-BR voice detection. Toggle 🗣/🤐 no header campaign.
- Só lê narrações do Mestre (não chat livre / echo de ação) pra não poluir.

## Stats da sessão

| Métrica | Antes | Depois |
|---|---|---|
| Tests | 398 | **414** (+16 buff engine + smart AI + encounter builder) |
| Mecânica D&D | strings de buff sem efeito | engine completo + 5 spells reais |
| Enemy AI | 100% random | boss heuristic 4-factor scoring |
| DM workflow | declarar monsterId/CR manual | "deadly" + flavor → server balanceia |
| TTS narração | mute | Web Speech API PT-BR opcional |
| First-combat UX | shock therapy | 5-card tutorial com glossário |
| Coop visibility | players cegos | echo + chat + spectator transcript + reconnect |
| Mobile combat | scroll infinito | 3 tabs swipeable |

## Commits locais acumulados (não pushados)

**29 commits** desde último deploy (`603e168` F10 em prod). Quando quiser push:

```bash
git push origin main
```

Env vars necessárias prod: `GEMINI_API_KEY` (free tier 1500/dia).

## Próximos passos sugeridos

Pendente do João + amigo: **playtest E2E coop real** com os fixes A1 (especialmente reconnection — se cair wifi e voltar, agora deve recuperar sem refresh).

Apostas longas do plano original ainda em aberto (opcionais):
- World persistente (cross-campaign memory)
- Async/play-by-post mode  
- DM personality presets (Heroic Epic / Grim Dark / Slapstick / Noir)
- Highlight reel exportável HTML/PDF

Refatorações pendentes:
- F35 só extraiu dm-tool-applier; routes/sockets ainda em index.ts (1200 LOC).
- F26 racial damage profile auto-populated no wizard (Tiefling=resist fogo).
- Counterspell/Dispel Magic interactions (F25 noted como TODO).

## Mensagem pra próxima conversa

> Lê `HANDOFF_2026-05-26_ABC-complete.md`. Rodadas A+B+C concluídas (8 tasks, 8 commits novos). 414/414 tests, typecheck limpo. 29 commits acumulados pra push prod quando quiser. Próximo: playtest E2E coop real (validar A1 reconnect + tutorial first-combat + mobile tabs com 2 jogadores reais).
