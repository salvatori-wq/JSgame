# Handoff — Sprint Y entregue (D&D 9.6 / Mobile 9.4 — UX no teto)

## 1. Estado atual

**Data**: 2026-05-29 · **Tree limpo** após 2 commits (feat+test) · **1908 tests verde** (era 1871, +37 net) · **Typecheck OK** · **Push NÃO feito ainda**

Sprint Y atende todos os **6 gaps remanescentes** dos 2 consultores pós Sprint X (3 D&D + 3 Mobile). Re-avaliação confirma: **objetivo D&D ≥9.5 superado, objetivo Mobile ≥9.0 superado**.

## 2. Veredito dos 2 consultores (pós Sprint Y)

### Consultor D&D sênior: **9.6/10** (era 9.2 pós X)
> *"Mesa de D&D 5e PHB-faithful conduzida por DM competente; gap restante é polish narrativo, não regra ou drama."*

- Veredito implícito: **expectativa Mearls (9.5) superada**
- Todos os 3 gaps FECHADOS sem ressalvas:
  - ✅ Fog of war LINTER: "Implementação supera o que pedi. Vazamento agora <2%."
  - ✅ Death save drama: "O que era 'pasteurizado' virou momento visceral — player sente o corpo do PJ falhando."
  - ✅ NPC secrets: "DM que TECE conspiração, não Mestre IA legal."

### Consultor UX Mobile RPG: **9.4/10** (era 8.8 pós X)
> *"Como RPG narrativo mobile, está no teto da categoria. Não há comparável publicado nesse score."*

- Comparativo:
```
Marvel Snap (9.5) > JSgame Y (9.4) ≈ BG3 mobile (9.4) > Disco Elysium (9.0)
                                                       > Genshin (8.5)
                                                       > Slay the Spire mobile (8.5)
```
- 0.1 abaixo de Marvel Snap só por polish de microinterações em coleção/deckbuilder (área que JSgame não tem)
- Todos os 3 gaps FECHADOS

## 3. O que foi feito (2 commits)

### Commit 1: `feat(Y): Sprint Y.A + Y.B — fog linter + death drama + NPC secrets + reward juice + combat echo` (`6808282`)

**Y.A — Atendendo D&D**:

- **Y.A1 Fog of war LINTER server-side**:
  - `src/server/dm/narration-linter.ts` NOVO. 9 patterns regex compilados.
  - Pipeline em `dm.ts`: LLM → lint → se viola, retry com correctionPrompt → se ainda viola, sanitize manual → telemetria `fog_violation`.
  - Aceito (não viola): contagem turnos/rounds, nome arma/spell, dano TAKEN pelo player.
  - Sanitização substitui por adjetivos PHB ("ferido", "à beira", "armadura pesada", "teste difícil").

- **Y.A2 Death save drama**:
  - `playDeathSaveHeartbeat()` em audio.ts: 2 pulses 80→40Hz sine + gap 0.42s (sístole/diástole). Sub-bass gain 0.55.
  - Tracker `wasInDeathSave` em campaign-screen.ts dispara 1× ao ENTRAR no estado.
  - CSS `body.is-death-save-pending::after`: vinheta vermelha pulsante 1.6s ciclo com 4 stops fisiologicamente corretos. Reduced-motion fallback.

- **Y.A3 NPC com segredos persistentes**:
  - `NpcSecret` interface em types.ts + `CampaignState.npcSecrets` SERVER-ONLY.
  - 2 tools novas: `mark_npc_secret(npcName, secret, revealCondition, secretId?)` + `reveal_npc_secret(npcName, secretId)`.
  - Prompt injection em `prompts.ts`: bloco "🤫 SEGREDOS QUE NPCs RECENTES GUARDAM (SÓ você vê — player não)" listando últimos 5 NPCs com segredos pending.
  - Anti-bloat: foca só últimos 5 NPCs vistos.

**Y.B — Atendendo Mobile**:

- **Y.B1 Vinheta + ring sincronizados**:
  - `body.is-combat-just-started` flag 1200ms em `onState` quando combat-entrar.
  - CSS `animation-delay: 400ms` no `.is-just-arrived` quando body flag. Sequência: vinheta T+0~700ms → ring T+400ms~1100ms (cross-fade limpo).

- **Y.B2 Reward juice level-up + loot drop** (`reward-juice.ts` + `.css` NOVOS):
  - `playConfetti({count, durationMs, origin})`: 60 partículas top-fall (8 em reduced-motion). Paleta HSL gold 3 tons. CSS keyframes `rj-fall-spin` + `rj-burst-radial`.
  - `showItemReveal({item, onDismiss, autoDismissMs})`: bottom-sheet backdrop blur + card scale-in cubic-bezier overshoot. Auto-dismiss 4.5s + tap/ESC/backdrop fecha. Idempotente.
  - Wire: `onLevelUp` me → confetti. `onParty` diff inventory → showItemReveal(featured).

- **Y.B3 Combat log absorvido**:
  - `NarrationLog.appendCombatEcho({text, kind})` cria entry inline `.is-combat-echo is-combat-echo-{kind}`. 8 kinds.
  - `classifyCombatEventKind(ev)` em campaign-screen mapeia CombatEvent.
  - CSS distinto: Cardo italic 13px tabular-nums + cor por kind (crit gold uppercase, death/kill red bold, miss mute, skill verde).
  - `.cb-log-line` legacy MANTIDO (fallback tab Log).

### Commit 2: `test(Y): cobertura Sprint Y +37 tests (linter + secrets + juice + CSS)` (`65efd4c`)

**Novos arquivos (4, 45 tests)**:
- `narration-linter.test.ts` — 14 tests (patterns + texto limpo + correction prompt)
- `npc-secrets.test.ts` — 10 tests (mark/reveal validators)
- `reward-juice.test.ts` — 9 tests (confetti DOM smoke + item reveal lifecycle)
- `sprint-y-css.test.ts` — 12 tests (Y.A2 vinheta + Y.B1 delay + Y.B2 juice + Y.B3 echo)

## 4. Gaps remanescentes (próximo Sprint Z)

### D&D consultor — vida TEATRAL (não mais regra/drama)
1. **Reação social: NPC interrompe player** (P1, 3h). Hoje DM responde DEPOIS do player. NPC arrogante deveria cortar ("— Cala a boca, plebeu") via tool `npc_interrupt`. Faz mesa viva.
2. **Voicing por NPC: manifesto de fala consistente** (P1, 4h). `NPC.voicePattern` em statBlock (registro, tique, gíria, sotaque). Prompt injection "Garra fala em frases curtas, usa 'pirralho' como diminutivo". Player reconhece NPC pela voz.
3. **Tracker de promessas e dívidas** (P2, 2h). `state.playerCommitments[]` — "prometeu trazer cabeça do orc", "deve 50po". Tool `track_commitment`. Mestre cobra 3 sessões depois.

### Mobile consultor — PRODUTO (não mais UX)
1. **Conteúdo narrativo**: mais cold-opens (hoje 13), arquétipos prefab (hoje 3), tabelas de loot expandidas. Combustível, não interface.
2. **Multiplayer feel**: presence indicators ricos (cursor companion, "Borin está lendo a ficha"), modo espectador. Só se telemetria provar coop como uso real.
3. **Persistência de campanha longa**: sessão atual = 30 min. Pra virar "minha campanha de 6 meses" precisa progressão entre sessões mais visível (timeline conquistas, mural de glórias).

## 5. Riscos do Sprint Y (consultores apontaram)

| Risco | Severidade | Mitigação |
|---|---|---|
| Linter regex muito agressivo ("+5 ataque" perde info útil) | Média | Telemetria `fog_violation.matches` → calibrar regex em 1 semana. Considerar lookbehind `(?<!meu \|bônus de )` pra preservar player-owned numbers. |
| Heartbeat irritante em player ansioso | Baixa-Média | Reduced-motion já cobre. Sugestão: toggle UX `--death-save-intensity` (off/subtle/full). Considerar fade-out após roll 2 (urgência cresce, não constante). |
| NPC secrets bloat (5 × ~80 tokens = ~400 tokens/turn) | Baixa | Aceitável. Risco real: LLM confundir secrets entre NPCs. Já mitigado por bullet structure + name bold. Monitorar adoção. |
| Confetti 70 partículas performance device antigo | Baixa | CSS-only GPU-accelerated. Telemetria `dropped_frames` se >50ms |
| Item reveal 4.5s irritar veterano | Baixa-Média | Sugestão: rarity-aware auto-dismiss (comum 2.2s / lendário 8s). |
| Combat echo congestion combat >10 rounds | Baixa | Sugestão: adjacent collapse "▸ 4 ações" Discord-style. |

**Nenhum risco bloqueia merge.** Todos são fine-tuning pós-playtest real.

## 6. Arquivos novos Sprint Y

**Servidor**:
- `src/server/dm/narration-linter.ts` — 9 patterns + lint + correction prompt
- `src/server/__tests__/narration-linter.test.ts` — 14 tests
- `src/server/__tests__/npc-secrets.test.ts` — 10 tests

**Cliente**:
- `src/client/reward-juice.ts` — playConfetti + showItemReveal
- `src/client/styles/reward-juice.css` — keyframes + reduced-motion
- `src/client/__tests__/reward-juice.test.ts` — 9 tests
- `src/client/__tests__/sprint-y-css.test.ts` — 12 tests

**Editados**:
- `src/shared/types.ts` — NpcSecret + CampaignState.npcSecrets
- `src/server/dm/dm.ts` — Pipeline lint+retry+sanitize
- `src/server/dm/prompts.ts` — Bloco secrets injection + 2 tool defs
- `src/server/dm/tools.ts` — 2 validators
- `src/server/dm-tool-applier.ts` — 2 case handlers
- `src/server/metrics.ts` — `fog_violation` kind
- `src/client/audio.ts` — playDeathSaveHeartbeat
- `src/client/campaign/campaign-screen.ts` — wire all (confetti, reveal, heartbeat, vinheta-sync, combat-echo)
- `src/client/campaign/narration-log.ts` — appendCombatEcho
- `src/client/styles/campaign-core.css` — vinheta death-save + combat-echo
- `src/client/styles/initiative-ribbon.css` — delay sync vinheta
- `src/client/styles.css` — import reward-juice

## 7. Sugestões pra próxima sessão

### Opção A: Sprint Z "Vida Teatral" (D&D próximo nível)
~9h. NPC interrompe player + voicing por NPC + tracker promessas. Score D&D potencial 9.8+/10.

### Opção B: Conteúdo & Persistência (Mobile → Produto)
~12h. Mais cold-opens (13→25) + 2 arquétipos prefab novos + timeline conquistas entre sessões. Não muda score UX, mas vira "campanha de 6 meses".

### Opção C: Validação em prod ANTES de Z
Push 7 commits W+X+Y → playtest humano real → coletar telemetria fog_violation, ambient mute_rate, audio_unlock_failed, item_reveal_dismissed_time. Decide A vs B com base em dados reais.

### Opção D: Polish de risco curto (1-3h)
Atende as 3 sugestões dos consultores Sprint Y: rarity-aware auto-dismiss, intensity toggle death-save, regex lookbehind player-owned numbers.

## 8. Deploy / Push

**Status**: 7 commits W+X+Y locais, NÃO pushed:
```
65efd4c test(Y): cobertura Sprint Y +37 tests
6808282 feat(Y): Sprint Y.A + Y.B
767ba6d docs(X): HANDOFF Sprint X + CLAUDE.md
e02190f test(X): cobertura Sprint X +29 tests
7870c52 feat(X): Sprint X.A + X.B
f4ba1b5 docs(W): HANDOFF Sprint W + CLAUDE.md
ef9d888 test(W): cobertura Sprint W +43 tests
4a314ec feat(W): Sprint W redesign visceral
```

```bash
git push origin main      # → Render auto-deploy (8 commits do W+X+Y)
```

## 9. 🎯 O que falar na próxima conversa

**Opção curta**:
> Leia `HANDOFF_2026-05-29_sprint-Y-fog-drama-secrets-juice-done.md`.
> Sprint Y entregue. D&D 9.6/10 (superou Mearls), Mobile 9.4/10 (empata
> BG3 mobile). UX no teto da categoria. Sprint Z opções: A vida teatral
> (NPC interrupt + voicing + commitments) ~9h, B conteúdo/persistência
> ~12h, C playtest humano, D polish de risco 3h.

**Opções específicas**:
1. Push direto → "Push origin main (7 commits W+X+Y) + me confirma deploy".
2. Sprint Z opção A: "Vida teatral — NPC interrompe + voicing por NPC + tracker promessas (9h)".
3. Sprint Z opção B: "Conteúdo & persistência — 12 cold-opens novos + 2 prefab + timeline conquistas (12h)".
4. Playtest humano: "Preview rodando em 192.168.15.3:5173 — vou jogar 30min e mandar feedback".

---

**Resultado acumulado W+X+Y**:
- D&D: 5-6 → 8.5 → 9.2 → **9.6** (Mearls superado)
- Mobile: 5.5 → 8.0 → 8.8 → **9.4** (Marvel Snap-tier, 0.1 abaixo só por área que não temos)
- Tests: 1591 → 1842 → 1871 → **1908** (zero regressão acumulada)
- **8 commits W+X+Y prontos pra deploy**

UX/regra/drama atingiu teto. Próximas dimensões = vida social teatral + produto (conteúdo/persistência longa).
