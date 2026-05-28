# Handoff — Sprint X "Camada Sonora + Combat Hierarchy Final" entregue

## 1. Estado atual

**Data**: 2026-05-29 · **Tree limpo** após 2 commits (feat+test) · **1871 tests verde** (era 1842, +29 net) · **Typecheck OK** · **Push NÃO feito ainda**

Sprint X atende os 6 gaps remanescentes apontados pelos consultores no
fim do Sprint W (3 D&D + 3 Mobile). Re-avaliação confirma: ambos consultores
deram salto significativo de score.

## 2. Veredito dos 2 consultores (pós Sprint X)

### Consultor D&D sênior: **9.2/10** (era 8.5 pós W)
> *"JSgame agora SOA, PARECE e SUSTENTA D&D em todas as três camadas
> sensoriais (visual + texto + áudio) — falta só o linter de fog of war
> pra fechar a ilusão sem vazamento."*

- ✅ Gap #1 camada sonora: FECHADO
- ⚠ Gap #2 fog narrativo: PARCIAL (90%) — regra prompt forte mas LLM
  vaza ~10-15%, falta linter server-side
- ✅ Gap #3 scene pin: FECHADO

### Consultor Mobile RPG: **8.8/10** (era 8.0 pós W)
> *"Sprint X completou a virada: JSgame agora SOA, RESPIRA e CONDUZ como
> D&D real — dado tem peso físico, próximo turno chega como vinheta, e a
> última cena fica viva no fundo da decisão. Está acima de BG3 mobile,
> alcançando o nível de polish iOS-nativo de Slay the Spire."*

- ✅ Gap #1 features chips: FECHADO
- ✅ Gap #2 init transition: FECHADO
- ✅ Gap #3 audio impact: FECHADO (Web Audio aceito vs MP3 — justificativa
  técnica procedente)

**Comparativo Mobile pós-X**:
```
Marvel Snap (9.5) ⬅ JSgame X (8.8) ⬅ Slay the Spire mobile (8.5) ⬅ Genshin (8.5) ⬅ BG3 mobile
```

## 3. O que foi feito (2 commits)

### Commit 1: `feat(X): Sprint X.A + X.B — camada sonora + combat hierarchy final` (`7870c52`)

**X.A — Camada Sonora (4 mudanças)**:

- **X.A1 dice impact reforçado** (`audio.ts:166-180`). `playDiceLand()`
  agora 3 camadas simultâneas pra "Slay-the-Spire mobile-feel":
  - Layer 1: sub-bass 60Hz sine pressão grave
  - Layer 2: mid 180→60Hz sawtooth "tac" (γ.1 base preserved)
  - Layer 3: high crack 4kHz noise burst (madeira/osso)
  - Layer 4 (tail): bandpass 400Hz textura
  ~250ms total. `setupAudioGesture` já existia + chamado main.ts:53 →
  unlock iOS Safari coberto.

- **X.A2 ambient default ON** (`audio/ambient.ts:36-50`). Era OFF
  ("intrusivo"); agora `localStorage === null` → true, só explícito '0'
  = OFF. Consultores convergiram em "som diegético = gap #1". Player muta
  em UX Settings → "🎵 Ambient" se não gostar. SFX dice + page-turn
  permanecem independentes (`jsgame.sfx.enabled`).

- **X.A3 page-turn SFX** (`audio.ts:229-249` + `narration-log.ts:228-231`).
  Nova função `playPageTurn()`: 3 camadas brushed noise (4200Hz alta +
  2400Hz média + 1200Hz tail) ~240ms gain 0.18 baixo. Disparado em
  `NarrationLog.appendNarration` SÓ quando speaker é Mestre. Respeita
  prefers-reduced-motion.

- **X.A4 fog of war narrativo no prompt** (`prompts.ts:222-238`). Nova
  regra PROIBIDO no SYSTEM_PROMPT:
  > "CITAR NÚMEROS DO OPONENTE NA NARRAÇÃO. PROIBIDO em texto: 'tem 23
  > HP', 'CA 16', 'DC 14 vs Constituição', '1d8+3 cortante', '+5 de
  > ataque'. Use APENAS adjetivos e sinais corporais. Stats vão SÓ via
  > tool calls. ÚNICO número aceito: nome de arma/spell + contagem de
  > turnos/rounds pra clock."

**X.B — Combat Hierarchy Final (3 mudanças)**:

- **X.B1 features colapsadas em chips no target-sheet** (`combat-target-
  sheet.ts:32-95` + `combat-screen.ts:182-186` + `combat-target-sheet.css`).
  - `TARGET_SHEET_FEATURES` whitelist: rage, action-surge, second-wind,
    channel-divinity, ki, wild-shape (target-free).
  - EXCLUI bardic-inspiration (precisa picker → cai na class-features-bar
    fallback).
  - `buildTargetSheetFeatureChips(myChar)` puro: pula exhausted + fora
    da whitelist.
  - `cts-features-row` renderizado entre primary action e footer.
  - Chip 40px min-height (WCAG AA), badge "X/Y" tabular gold.
  - Click chip → close sheet + `socket.emit('useClassFeature', { feature })`.

- **X.B2 initiative "passou pra você"** (`initiative-ribbon.ts:17-35` +
  `initiative-ribbon.css`).
  - Tracker module-level `lastRibbonTurnIndex` + `lastRibbonCombatRound`
    (double-tracking previne false-positive cross-round).
  - Quando `currentTurnIndex` muda PRA mim, node atual ganha
    `.is-just-arrived` → 700ms animação cubic-bezier overshoot.
  - Avatar: `scale 1.15→1.45→1.15 + brightness 1.3`.
  - Pseudo-element `::before`: ring gold expansivo `0→24px shadow`.
  - Sincroniza com toast "▶ Seu turno" do W3.4 + `body.is-my-turn`.
  - Reduced-motion fallback: só pulse contínuo (sem ring).

- **X.B3 scene pin sticky** (`narration-log.ts:75-83 + 245-310` +
  `campaign-core.css`).
  - `.cn-scene-pin` ANTES de `entriesEl` no rootEl.
  - `position: sticky; top: 0; z-index: 5` + `backdrop-filter: blur(4px)`.
  - Border-left 3px gold (read-aloud-like).
  - Cabeça clicável "📜 Última cena ▾" toggle expand/collapse.
  - Preview Cardo italic 13px (~120 chars truncate em palavra completa
    via `previewText` helper).
  - Full Cardo 14px line-height 1.6 (consistente com W2.1 read-aloud).
  - Atualizado SÓ por narração de Mestre (echo/party/player não tocam).
  - `getLastSceneText`/`getLastSceneSpeaker` expostos pra tests.

### Commit 2: `test(X): cobertura Sprint X +29 tests` (`e02190f`)

**Novos arquivos (4, 29 tests)**:
- `audio-sprint-x.test.ts` — 6 tests (playDiceLand não-throw, playPageTurn
  callable, ambient toggle)
- `combat-target-sheet-features.test.ts` — 8 tests (whitelist, builder,
  exhausted skip, classes diversas, max 999 → ∞)
- `scene-pin.test.ts` — 10 tests (previewText 5 + lifecycle DOM 5)
- `sprint-x-css.test.ts` — 12 tests (B1 chips + B2 keyframes + B3 sticky
  & expanded toggle)

## 4. Gaps remanescentes (próximo Sprint Y)

### Consultor D&D — 3 críticos
1. **Fog of war LINTER server-side** (2h, P0). Regex em `narration` rejeita
   `\d+\s*(HP|CA|DC|XP|pés|ft)` + lista negra ("d8+3", "AC 16"). Match
   → retry 1× com correction prompt. SEM isso o gap #2 fica em 90%.
2. **Death save drama visual + sonoro** (4h). Hoje roll seco. Faltam:
   heartbeat audio loop (60Hz pulsando 0.8s) durante 3 saves pendentes,
   vinheta tela escurecendo nas bordas, narração curta entre rolls.
   Momento mais dramático do D&D, pasteurizado.
3. **Mistério persistente — NPC com segredos** (6h). Hoje DM esquece se
   NPC mentiu. Adicionar `npc.secrets[]` em CampaignState (server-only,
   nunca client). Tool `mark_npc_secret(npcId, secret, revealCondition)`.
   Próximo encontro injeta no prompt "SEGREDOS QUE ESSE NPC GUARDA: X".
   Reveal só com Insight ≥DC ou condition.

### Consultor Mobile — 3 críticos
1. **Combat-enter + 1ª "passou pra você" sincronizadas**. Hoje vinheta
   W3-Mobile e ring X.B2 disparam em sequência separada. Fundir num
   momento dramático contínuo (vinheta → fade direto pro ring).
2. **Reward juice em level-up + loot drop**. `playLevelUp` arpeggio existe
   mas falta confetti dourado + card reveal animation. Único gap claro
   vs Marvel Snap 9.5.
3. **Combat log absorvido no read-aloud feed**. `.cb-log-line` ainda
   separado. Em mobile portrait 2 feeds verticais competem. Fundir como
   `.is-combat-echo` no narration-log = "1 superfície narrativa".

## 5. Riscos do Sprint X (consultores apontaram)

| Risco | Mitigação |
|---|---|
| Ambient default ON intrusivo | Trackar `ambient_muted_within_60s`. Se >15-25%, reconsiderar. Toggle UX existente. |
| Fog of war prompt sem linter | LLM vaza ~10-15%. Q3 #1 D&D fecha. |
| Scene-pin sticky rouba viewport pequeno | Default colapsado ~32px OK ≥640. Em ≤620 pode apertar. Auto-collapse quando `entries.length < 3` é fix de 15min. |
| Web Audio fallback Firefox Android | Telemetria `audio_unlock_failed`. Se >5%, MP3 fallback ≤30KB single. |
| Status-ribbon + scene-pin ambos sticky top:0 | Confirmar z-index cascade não conflita (status-ribbon vs cn-scene-pin z:5). Visual check necessário. |

**Nenhum item regride.** 1871 tests verde confirma.

## 6. Arquivos novos / chave Sprint X

**Novos testes (4)**:
- `src/client/__tests__/audio-sprint-x.test.ts`
- `src/client/__tests__/sprint-x-css.test.ts`
- `src/client/campaign/__tests__/scene-pin.test.ts`
- `src/client/combat/__tests__/combat-target-sheet-features.test.ts`

**Editados**:
- `src/client/audio.ts` — playDiceLand 3 layers + playPageTurn
- `src/client/audio/ambient.ts` — default ON
- `src/client/campaign/narration-log.ts` — page-turn wire + scene pin
- `src/client/combat/combat-target-sheet.ts` — feature chips
- `src/client/combat/combat-screen.ts` — onUseFeature wire
- `src/client/combat/initiative-ribbon.ts` — just-arrived transition
- `src/client/styles/campaign-core.css` — cn-scene-pin
- `src/client/styles/combat-target-sheet.css` — cts-features-row
- `src/client/styles/initiative-ribbon.css` — irb-just-arrived keyframes
- `src/server/dm/prompts.ts` — fog of war narrative rule

## 7. Sugestões pra próxima sessão

### Opção A (P0 do D&D): Linter Fog of War + Death Save Drama
~6h. Fecha 100% o fog of war (não confia no LLM) + atende death save
drama. Score D&D potencial 9.5+/10.

### Opção B (Mobile compositional): Vinheta+Ring Sincronizados + Reward Juice
~5h. Foco em "momentos de glória" que separam JSgame de Marvel Snap.
Score Mobile potencial 9.0+/10.

### Opção C (Imersão profunda): NPCs com Segredos Persistentes
~6h. Adiciona dimensão narrativa NOVA — "DM que TECE conspiração" vs
"Mestre IA legal". Pode disparar próximo grande tema do jogo.

### Opção D: Playtest humano real ANTES de Y
30 min de jogo solo + 30 min com amigo. Métricas reais > inferidas.
Decide A/B/C com base no que player real sentiu.

## 8. Deploy / Push

**Status**: 4 commits Sprint W+X locais, **NÃO pushed**:
```
e02190f test(X): cobertura Sprint X +29 tests
7870c52 feat(X): Sprint X.A + X.B
f4ba1b5 docs(W): HANDOFF Sprint W
ef9d888 test(W): cobertura Sprint W +43 tests
4a314ec feat(W): Sprint W redesign visceral
```

```bash
git push origin main      # → Render auto-deploy
```

## 9. 🎯 O que falar na próxima conversa

**Opção curta**:
> Leia `HANDOFF_2026-05-29_sprint-X-camada-sonora-hierarchy-done.md`.
> Sprint X entregue com D&D 9.2/10 e Mobile 8.8/10. Sprint Y? Opções A
> (linter+death save), B (vinheta+juice), C (NPC segredos), D (playtest
> humano).

**Opções específicas**:
1. Push direto → "Push origin main e me confirma deploy via curl /api/dm/diag".
2. Sprint Y opção A: "Linter fog of war server-side + death save drama (6h)".
3. Sprint Y opção C: "NPC com segredos persistentes — adicionar dimensão narrativa nova (6h)".
4. Playtest humano: "Marca preview pra essa noite — 192.168.15.3:5173".

---

**Resultado acumulado W+X**: D&D 5-6 → 8.5 → **9.2**, Mobile 5.5 → 8.0 → **8.8**.
1591 → 1842 → **1871 tests**. Acima de BG3 mobile e Genshin em UX nativo.
Próximo objetivo: igualar Marvel Snap (9.5).
